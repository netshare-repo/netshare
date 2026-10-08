import TestingTask from '../models/TestingTask.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import CreditTransaction from '../models/CreditTransaction.js';
import Wallet from '../models/Wallet.js';
import TopUpRequest from '../models/TopUpRequest.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import MarketplaceOrder from '../models/MarketplaceOrder.js';
import User from '../models/User.js';

const bad = message => Object.assign(new Error(message), { status: 400 });
export const reportRange = (query, now = new Date()) => {
  if (Object.keys(query).some(key => !['from', 'to'].includes(key))) throw bad('Unknown report filter');
  const parse = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad('Dates must be YYYY-MM-DD');
    const result = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) throw bad('Invalid date');
    return result;
  };
  const end = parse(query.to ?? now.toISOString().slice(0, 10));
  const start = query.from === undefined ? new Date(end.getTime() - 29 * 86400_000) : parse(query.from);
  const exclusiveEnd = new Date(end.getTime() + 86400_000);
  if (start > end || exclusiveEnd - start > 366 * 86400_000) throw bad('Date range must be ordered and no more than 366 days');
  return { start, end: exclusiveEnd, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};

export const buildReport = async (query) => {
  const range = reportRange(query);
  const match = (field = 'createdAt') => ({ [field]: { $gte: range.start, $lt: range.end } });
  const statuses = (model, amount) => model.aggregate([
    { $match: match() }, { $group: { _id: '$status', count: { $sum: 1 }, ...(amount && { credits: { $sum: `$${amount}` } }) } },
    { $sort: { _id: 1 } },
  ]);
  const [tasks, bandwidth, topups, withdrawals, orders, ledger, wallets, newUsers] = await Promise.all([
    statuses(TestingTask, 'estimatedCost'),
    BandwidthUsage.aggregate([{ $match: match('timestamp') }, { $group: { _id: null, records: { $sum: 1 },
      uploadMB: { $sum: '$uploadBandwidthMB' }, downloadMB: { $sum: '$downloadBandwidthMB' }, totalMB: { $sum: '$totalBandwidthMB' } } }]),
    statuses(TopUpRequest, 'amount'), statuses(WithdrawalRequest, 'amount'), statuses(MarketplaceOrder, 'creditsSpent'),
    CreditTransaction.aggregate([{ $match: { ...match(), status: 'completed' } },
      { $group: { _id: '$type', count: { $sum: 1 }, credits: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    Wallet.aggregate([{ $group: { _id: null, count: { $sum: 1 }, balance: { $sum: '$balance' },
      withdrawableCredits: { $sum: '$withdrawableCredits' } } }]),
    User.countDocuments(match()),
  ]);
  return { from: range.from, to: range.to, timezone: 'UTC', generatedAt: new Date().toISOString(),
    basis: 'Tasks/payments/orders by creation date and current status; ledger by posting date; bandwidth by observation date. Wallets are current snapshots, not historical balances.',
    tasks, bandwidth: bandwidth[0] || { records: 0, uploadMB: 0, downloadMB: 0, totalMB: 0 },
    payments: { topups, withdrawals }, orders, ledger, walletSnapshot: wallets[0] || { count: 0, balance: 0, withdrawableCredits: 0 }, newUsers };
};

export const reportCsv = report => {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [['section', 'metric', 'value'], ['period', 'from_UTC', report.from], ['period', 'to_UTC_inclusive', report.to],
    ['period', 'basis', report.basis], ['users', 'new_users', report.newUsers]];
  for (const [section, value] of Object.entries({ tasks: report.tasks, topups: report.payments.topups,
    withdrawals: report.payments.withdrawals, orders: report.orders, ledger: report.ledger })) {
    for (const group of value) for (const [metric, count] of Object.entries(group)) if (metric !== '_id') rows.push([section, `${group._id}_${metric}`, count]);
  }
  for (const [section, value] of Object.entries({ bandwidth: report.bandwidth, wallet_current_snapshot: report.walletSnapshot })) {
    for (const [metric, count] of Object.entries(value)) if (metric !== '_id') rows.push([section, metric, count]);
  }
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
};
