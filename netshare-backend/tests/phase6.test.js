import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server.js';
import User from '../models/User.js';
import TestingTask from '../models/TestingTask.js';
import NodeDevice from '../models/NodeDevice.js';
import TaskResult from '../models/TaskResult.js';
import Wallet from '../models/Wallet.js';
import TopUpRequest from '../models/TopUpRequest.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import MarketplaceOrder from '../models/MarketplaceOrder.js';
import CreditTransaction from '../models/CreditTransaction.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import AnomalyAlert from '../models/AnomalyAlert.js';
import Notification from '../models/Notification.js';
import Dispute from '../models/Dispute.js';
import AdminLog from '../models/AdminLog.js';
import generateToken from '../utils/generateToken.js';
import { recordAlert, detectAnomalies } from '../services/anomalyService.js';
import { reconcileNotifications, notifyOnce } from '../services/notificationService.js';
import { reportRange, reportCsv } from '../services/reportService.js';
import { createTopUp, reviewTopUp, createWithdrawal, reviewWithdrawal } from '../services/paymentService.js';

let client, other, nodeUser, admin, node;
const auth = user => ({ Authorization: `Bearer ${generateToken(user._id)}` });
const oid = () => new mongoose.Types.ObjectId();
const task = (extra = {}) => TestingTask.create({ clientId: client._id, targetUrl: 'https://example.com',
  serviceType: 'performance_testing', targetRegion: 'PK', executionLimit: 1, estimatedCost: 10, ...extra });
let counter = 0;
const topupInput = () => ({ amount: 20, paymentMethod: 'jazzcash', referenceNumber: `PHASE6REF${++counter}`,
  proofMime: 'image/png', proofBase64: Buffer.from([137,80,78,71,13,10,26,10]).toString('base64') });
const order = () => MarketplaceOrder.create({ userId: client._id, productId: oid(), productName: 'Phase6 item', creditsSpent: 15 });
const submit = reference => request(app).post('/api/disputes').set(auth(client)).send({ relatedType: 'task', relatedId: String(reference._id), description: 'Please investigate this result.' });

beforeAll(async () => {
  [client, other, nodeUser, admin] = await User.create(['platform_client', 'platform_client', 'node_participant', 'admin'].map((role, index) =>
    ({ name: `Phase6 ${index}`, email: `test_phase6_${index}@test.io`, password: 'hashed-password', role, isVerified: true })));
  node = await NodeDevice.create({ userId: nodeUser._id, deviceName: 'test_phase6_node', region: 'PK', bandwidthLimitMB: 100 });
  await Wallet.create([{ userId: client._id, balance: 500 }, { userId: nodeUser._id, balance: 500, withdrawableCredits: 300 }]);
  for (const model of [AnomalyAlert, Dispute, Notification, AdminLog, CreditTransaction, TopUpRequest, WithdrawalRequest]) await model.init();
});
afterAll(async () => {
  vi.restoreAllMocks();
  const userIds = [client, other, nodeUser, admin].filter(Boolean).map(user => user._id);
  await AdminLog.deleteMany({ adminId: admin?._id });
  for (const model of [Notification, Dispute, Wallet, TopUpRequest, WithdrawalRequest, CreditTransaction, MarketplaceOrder]) await model.deleteMany({ userId: { $in: userIds } });
  await AnomalyAlert.deleteMany({ relatedUserId: { $in: userIds } });
  await TestingTask.deleteMany({ clientId: { $in: userIds } });
  await TaskResult.deleteMany({ clientId: { $in: userIds } });
  await BandwidthUsage.deleteMany({ nodeId: node?._id });
  await NodeDevice.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
});

describe('Phase 6 alerts, reports, disputes and notifications', () => {
  it('deduplicates concurrent anomaly creation and node/admin notifications', async () => {
    const input = { dedupKey: `phase6:${node._id}`, relatedDeviceId: node._id, relatedUserId: nodeUser._id,
      alertType: 'dedup_fixture', severity: 'high', description: 'Node limit exceeded.', createdAt: new Date() };
    const alerts = await Promise.all([recordAlert(input), recordAlert(input), recordAlert(input)]);
    expect(new Set(alerts.map(item => String(item._id))).size).toBe(1);
    expect(await AnomalyAlert.countDocuments({ dedupKey: input.dedupKey })).toBe(1);
    expect(await Notification.countDocuments({ userId: nodeUser._id, eventKey: `warning:${alerts[0]._id}` })).toBe(1);
    expect(await Notification.countDocuments({ userId: admin._id, eventKey: `alert:${alerts[0]._id}` })).toBe(1);
  });
  it('detects repeated failures, abnormal nodes and task bursts from stored data', async () => {
    await TestingTask.insertMany(Array.from({ length: 20 }, (_, index) => ({ clientId: other._id,
      targetUrl: 'https://example.com', serviceType: 'performance_testing', targetRegion: 'PK', estimatedCost: 10, executionLimit: 1,
      status: index < 3 ? 'failed' : 'pending', assignedNodeId: index < 3 ? node._id : null })));
    await NodeDevice.updateOne({ _id: node._id }, { usedBandwidthMB: 101, currentActiveTasks: 2 });
    await detectAnomalies(); await detectAnomalies();
    expect(await AnomalyAlert.countDocuments({ relatedDeviceId: node._id, alertType: 'repeated_task_failures' })).toBe(1);
    expect(await AnomalyAlert.countDocuments({ relatedDeviceId: node._id, alertType: 'abnormal_node' })).toBe(1);
    expect(await AnomalyAlert.countDocuments({ relatedUserId: other._id, alertType: 'task_burst' })).toBe(1);
    expect((await AnomalyAlert.findOne({ relatedDeviceId: node._id })).detector).toBe('rules-v1');
  });
  it('detects suspicious rejected payments and bursts without ML claims', async () => {
    for (let index = 0; index < 10; index++) {
      const record = await createTopUp(client._id, topupInput());
      if (index < 3) await TopUpRequest.updateOne({ _id: record._id }, { status: 'rejected' });
    }
    await detectAnomalies();
    expect(await AnomalyAlert.countDocuments({ relatedUserId: client._id, alertType: 'topup_rejections' })).toBe(1);
    expect(await AnomalyAlert.countDocuments({ relatedUserId: client._id, alertType: 'topup_burst' })).toBe(1);
  });
  it('reviews alerts with audit logs and identical retry has no second effect', async () => {
    const alert = await AnomalyAlert.findOne({ relatedDeviceId: node._id });
    const endpoint = `/api/admin/alerts/${alert._id}/review`;
    expect((await request(app).put(endpoint).set(auth(client)).send({ status: 'under_review', adminNote: 'Investigating' })).status).toBe(403);
    expect((await request(app).put(endpoint).set(auth(admin)).send({ status: 'under_review', adminNote: 'Investigating' })).status).toBe(200);
    const body = { status: 'resolved', adminNote: 'Limits corrected' };
    expect((await request(app).put(endpoint).set(auth(admin)).send(body)).status).toBe(200);
    expect((await request(app).put(endpoint).set(auth(admin)).send(body)).status).toBe(200);
    expect(await AdminLog.countDocuments({ targetId: alert._id, action: 'ALERT_RESOLVED' })).toBe(1);
    expect((await request(app).put(endpoint).set(auth(admin)).send({ status: 'dismissed', adminNote: 'New decision' })).status).toBe(409);
  });
  it('rejects unauthenticated and non-admin operational reads', async () => {
    for (const path of ['/api/admin/alerts', '/api/admin/reports', '/api/admin/reports/export', '/api/admin/disputes']) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set(auth(client))).status).toBe(403);
    }
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).post('/api/disputes')).status).toBe(401);
  });
  it('filters stored report data by inclusive UTC days and exports CSV', async () => {
    await task({ status: 'completed', createdAt: new Date('2020-01-02T23:59:59Z') });
    await task({ status: 'failed', createdAt: new Date('2020-01-03T00:00:00Z') });
    await BandwidthUsage.create({ nodeId: node._id, sessionId: 'phase6', uploadBandwidthMB: 2, downloadBandwidthMB: 3,
      totalBandwidthMB: 5, timestamp: new Date('2020-01-02T12:00:00Z') });
    await CreditTransaction.create({ userId: client._id, amount: 7, type: 'debit', description: 'Phase6 report fixture', status: 'completed', createdAt: new Date('2020-01-02T12:00:00Z') });
    const url = '/api/admin/reports?from=2020-01-02&to=2020-01-02';
    const response = await request(app).get(url).set(auth(admin));
    expect(response.status).toBe(200);
    expect(response.body.report.tasks).toEqual([{ _id: 'completed', count: 1, credits: 10 }]);
    expect(response.body.report.bandwidth.totalMB).toBe(5);
    expect(response.body.report.ledger).toEqual([{ _id: 'debit', count: 1, credits: 7 }]);
    expect(response.body.report.basis).toContain('current snapshots');
    const csv = await request(app).get('/api/admin/reports/export?from=2020-01-02&to=2020-01-02').set(auth(admin));
    expect(csv.status).toBe(200); expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('attachment'); expect(csv.text).toContain('completed_count');
    expect(csv.text).not.toContain('accountDetails');
  });
  it('validates report dates, filters, IDs and pagination; escapes CSV formulas', async () => {
    for (const query of ['from=bad', 'from=2026-02-30', 'from=2026-10-03&to=2026-10-01', 'from=2020-01-01&to=2022-01-01', 'from[$ne]=x']) {
      expect((await request(app).get(`/api/admin/reports?${query}`).set(auth(admin))).status).toBe(400);
    }
    expect(() => reportRange({ from: '2026-02-29' })).toThrow();
    const response = await request(app).get('/api/admin/reports').set(auth(admin));
    expect(reportCsv({ ...response.body.report, basis: '=HYPERLINK("bad")' })).toContain("'=HYPERLINK");
    expect((await request(app).get('/api/admin/alerts?status=bad').set(auth(admin))).status).toBe(400);
    expect((await request(app).get('/api/notifications?offset=-1').set(auth(client))).status).toBe(400);
    expect((await request(app).put('/api/admin/alerts/not-an-id/review').set(auth(admin)).send({})).status).toBe(400);
  });
  it('submits an owned task dispute and prevents concurrent duplicates', async () => {
    const reference = await task();
    const results = await Promise.all([submit(reference), submit(reference)]);
    expect(results.map(res => res.status).sort()).toEqual([201, 409]);
    expect(await Dispute.countDocuments({ relatedId: reference._id })).toBe(1);
  });
  it('rejects cross-user and nonexistent dispute references and invalid descriptions', async () => {
    const reference = await task({ clientId: other._id });
    expect((await submit(reference)).status).toBe(404);
    expect((await submit({ _id: oid() })).status).toBe(404);
    for (const body of [{ relatedType: 'wallet', relatedId: String(oid()), description: 'A valid description' },
      { relatedType: 'task', relatedId: String(reference._id), description: 'short' },
      { relatedType: 'task', relatedId: {}, description: 'A valid description' }]) {
      expect((await request(app).post('/api/disputes').set(auth(client)).send(body)).status).toBe(400);
    }
  });
  it('accepts owned order/topup/withdrawal references and hides others in lists', async () => {
    const references = [['order', await order()], ['topup', await createTopUp(client._id, topupInput())],
      ['withdrawal', await createWithdrawal(nodeUser._id, { amount: 10, method: 'jazzcash', accountDetails: '03001234567' })]];
    for (const [type, reference] of references) {
      const owner = type === 'withdrawal' ? nodeUser : client;
      const body = { relatedType: type, relatedId: String(reference._id), description: 'Please review this payment or order.' };
      expect((await request(app).post('/api/disputes').set(auth(other)).send(body)).status).toBe(404);
      expect((await request(app).post('/api/disputes').set(auth(owner)).send(body)).status).toBe(201);
    }
    const list = await request(app).get('/api/disputes').set(auth(other));
    expect(list.body.disputes).toEqual([]);
    expect((await request(app).get('/api/disputes').set(auth(client))).body.disputes.every(item => item.userId === String(client._id))).toBe(true);
  });
  it('permits node task disputes only when that node has a recorded result', async () => {
    const reference = await task({ status: 'completed' });
    const body = { relatedType: 'task', relatedId: String(reference._id), description: 'Please review my task reward.' };
    expect((await request(app).post('/api/disputes').set(auth(nodeUser)).send(body)).status).toBe(404);
    await TaskResult.create({ taskId: reference._id, nodeId: node._id, clientId: client._id, nodeUserId: nodeUser._id,
      serviceType: 'performance_testing', targetUrl: 'https://example.com' });
    expect((await request(app).post('/api/disputes').set(auth(nodeUser)).send(body)).status).toBe(201);
  });
  it('enforces dispute transitions, notes, authorization and exactly-once resolution audit', async () => {
    const res = await submit(await task()); const id = res.body.dispute._id;
    const endpoint = `/api/admin/disputes/${id}/review`;
    expect((await request(app).put(endpoint).set(auth(client)).send({ status: 'under_review', adminNote: 'Reviewing' })).status).toBe(403);
    expect((await request(app).put(endpoint).set(auth(admin)).send({ status: 'resolved', adminNote: 'Too early' })).status).toBe(409);
    expect((await request(app).put(endpoint).set(auth(admin)).send({ status: 'under_review', adminNote: '' })).status).toBe(400);
    expect((await request(app).put(endpoint).set(auth(admin)).send({ status: 'under_review', adminNote: 'Reviewing evidence' })).status).toBe(200);
    const results = await Promise.all([1, 2].map(() => request(app).put(endpoint).set(auth(admin)).send({ status: 'resolved', adminNote: 'Evidence reviewed' })));
    expect(results.every(result => [200, 409].includes(result.status))).toBe(true);
    expect(results.some(result => result.status === 200)).toBe(true);
    const dispute = await Dispute.findById(id);
    expect(dispute.status).toBe('resolved'); expect(dispute.history).toHaveLength(2);
    expect(await AdminLog.countDocuments({ targetId: id, action: 'DISPUTE_RESOLVED' })).toBe(1);
    expect(await Notification.countDocuments({ eventKey: `dispute:${id}:resolved` })).toBe(1);
  });
  it('rolls back review state and notification when audit persistence fails', async () => {
    const res = await submit(await task()); const id = res.body.dispute._id;
    const spy = vi.spyOn(AdminLog, 'create').mockRejectedValueOnce(new Error('Injected audit failure'));
    const response = await request(app).put(`/api/admin/disputes/${id}/review`).set(auth(admin)).send({ status: 'under_review', adminNote: 'Testing rollback' });
    spy.mockRestore();
    expect(response.status).toBe(500); expect((await Dispute.findById(id)).status).toBe('open');
    expect(await Notification.countDocuments({ eventKey: `dispute:${id}:under_review` })).toBe(0);
  });
  it('dismisses reviewed disputes with an audit trail', async () => {
    const res = await submit(await task()); const endpoint = `/api/admin/disputes/${res.body.dispute._id}/review`;
    await request(app).put(endpoint).set(auth(admin)).send({ status: 'under_review', adminNote: 'Checking evidence' });
    const response = await request(app).put(endpoint).set(auth(admin)).send({ status: 'dismissed', adminNote: 'No issue found' });
    expect(response.status).toBe(200); expect(response.body.dispute.status).toBe('dismissed');
  });
  it('generates terminal task notifications with settled/completed dedup and durable retries', async () => {
    const success = await task({ status: 'completed', assignedNodeId: node._id }); const failure = await task({ status: 'failed' });
    await reconcileNotifications();
    await TestingTask.updateOne({ _id: success._id }, { status: 'settled' });
    await reconcileNotifications();
    expect(await Notification.countDocuments({ relatedId: success._id, type: 'task_status', userId: client._id })).toBe(1);
    expect(await Notification.countDocuments({ relatedId: success._id, type: 'task_status', userId: nodeUser._id })).toBe(1);
    expect((await Notification.findOne({ relatedId: failure._id })).message).toContain('failed');
  });
  it('generates each payment transition notification within the payment transaction', async () => {
    const approved = await createTopUp(client._id, topupInput());
    const rejected = await createTopUp(client._id, topupInput());
    await reviewTopUp(String(approved._id), admin._id, 'approved', 'Proof verified');
    await reviewTopUp(String(rejected._id), admin._id, 'rejected', 'Proof mismatched');
    const withdrawal = await createWithdrawal(nodeUser._id, { amount: 10, method: 'jazzcash', accountDetails: '03001234567' });
    await reviewWithdrawal(String(withdrawal._id), admin._id, 'approved', 'Account verified');
    await reviewWithdrawal(String(withdrawal._id), admin._id, 'processed', 'Manual payout sent');
    await reconcileNotifications();
    expect(await Notification.countDocuments({ relatedId: approved._id })).toBe(1);
    expect(await Notification.countDocuments({ relatedId: rejected._id })).toBe(1);
    expect(await Notification.countDocuments({ relatedId: withdrawal._id })).toBe(3);
  });
  it('rolls back payment approval if atomic notification persistence fails', async () => {
    const record = await createTopUp(client._id, topupInput());
    const before = await Wallet.findOne({ userId: client._id });
    const spy = vi.spyOn(Notification, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Injected delivery failure'));
    await expect(reviewTopUp(String(record._id), admin._id, 'approved', 'Verified proof')).rejects.toThrow('Injected delivery failure');
    spy.mockRestore();
    expect((await TopUpRequest.findById(record._id)).status).toBe('pending');
    expect((await Wallet.findOne({ userId: client._id })).balance).toBe(before.balance);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `topup:${record._id}` })).toBe(0);
    expect(await AdminLog.countDocuments({ targetId: record._id })).toBe(0);
  });
  it('atomically generates order status notification and prevents duplicate refunds', async () => {
    const record = await order(); const before = await Wallet.findOne({ userId: client._id });
    const endpoint = `/api/marketplace/admin/orders/${record._id}/status`;
    const results = await Promise.all([1, 2].map(() => request(app).put(endpoint).set(auth(admin)).send({ status: 'cancelled', fulfilmentNote: 'Refund approved' })));
    expect(results.some(res => res.status === 200)).toBe(true);
    expect((await Wallet.findOne({ userId: client._id })).balance).toBe(before.balance + 15);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `order:refund:${record._id}` })).toBe(1);
    expect(await Notification.countDocuments({ eventKey: `order:${record._id}:cancelled` })).toBe(1);
    expect((await request(app).put(endpoint).set(auth(admin)).send({ status: 'fulfilled' })).status).toBe(409);
    expect((await request(app).put(endpoint).set(auth(other)).send({ status: 'fulfilled' })).status).toBe(403);
  });
  it('lists owned notifications/counts, protects read actions, and preserves read timestamp on retry', async () => {
    const event = { userId: other._id, eventKey: 'phase6:read-test', type: 'task_status', message: 'Task complete.', createdAt: new Date() };
    const records = await Promise.all([notifyOnce(event), notifyOnce(event)]);
    expect(String(records[0]._id)).toBe(String(records[1]._id));
    const id = records[0]._id;
    expect((await request(app).put(`/api/notifications/${id}/read`).set(auth(client))).status).toBe(404);
    const first = await request(app).put(`/api/notifications/${id}/read`).set(auth(other));
    const second = await request(app).put(`/api/notifications/${id}/read`).set(auth(other));
    expect(first.status).toBe(200); expect(second.body.notification.readAt).toBe(first.body.notification.readAt);
    await notifyOnce(event); expect((await Notification.findById(id)).status).toBe('read');
    const list = await request(app).get('/api/notifications').set(auth(other));
    expect(list.body.notifications.every(item => item.userId === String(other._id))).toBe(true);
    await request(app).put('/api/notifications/read-all').set(auth(other));
    expect((await request(app).get('/api/notifications').set(auth(other))).body.unreadCount).toBe(0);
  });
});
