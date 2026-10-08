import { AppError } from '../middleware/errorMiddleware.js';
import AnomalyAlert from '../models/AnomalyAlert.js';
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import AdminLog from '../models/AdminLog.js';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import MarketplaceOrder from '../models/MarketplaceOrder.js';
import TopUpRequest from '../models/TopUpRequest.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { statusNotification } from '../services/notificationService.js';
import { buildReport, reportCsv } from '../services/reportService.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const validId = id => { if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) fail(400, 'Invalid reference ID'); };
export const handle = fn => async (req, res, next) => { try { await fn(req, res); } catch (error) {
  next(error.status ? new AppError(error.message, error.status, 'OPERATIONS_ERROR') : error);
} };
const page = query => {
  const offset = Number(query.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, 'Invalid pagination offset');
  return offset;
};
const states = ['open', 'under_review', 'resolved', 'dismissed'];
const filterStatus = (query, allowed) => {
  if (query.status === undefined || query.status === '') return {};
  if (typeof query.status !== 'string' || !allowed.includes(query.status)) fail(400, 'Invalid status filter');
  return { status: query.status };
};

export const listAlerts = handle(async (req, res) => {
  const filter = filterStatus(req.query, states);
  res.json({ alerts: await AnomalyAlert.find(filter).sort({ createdAt: -1, _id: -1 }).skip(page(req.query)).limit(50), total: await AnomalyAlert.countDocuments(filter) });
});
export const listDisputes = handle(async (req, res) => {
  const filter = { ...filterStatus(req.query, states), ...(req.user.role !== 'admin' && { userId: req.user._id }) };
  res.json({ disputes: await Dispute.find(filter).sort({ createdAt: -1, _id: -1 }).skip(page(req.query)).limit(50), total: await Dispute.countDocuments(filter) });
});
export const createDispute = handle(async (req, res) => {
  const { relatedType, relatedId, description } = req.body || {};
  validId(relatedId);
  const mapping = { task: [TestingTask, 'clientId'], order: [MarketplaceOrder, 'userId'], topup: [TopUpRequest, 'userId'], withdrawal: [WithdrawalRequest, 'userId'] };
  if (!Object.hasOwn(mapping, relatedType)) fail(400, 'Invalid dispute reference type');
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) fail(400, 'Description must be 10–2000 characters');
  const [model, ownerField] = mapping[relatedType];
  let owned = await model.exists({ _id: relatedId, [ownerField]: req.user._id });
  // Participating nodes may dispute their own recorded task result, not any task.
  if (!owned && relatedType === 'task') owned = await TaskResult.exists({ taskId: relatedId, nodeUserId: req.user._id });
  if (!owned) fail(404, 'Owned reference not found');
  try {
    const dispute = await Dispute.create({ userId: req.user._id, relatedType, relatedId, description: description.trim() });
    res.status(201).json({ dispute });
  } catch (error) { if (error.code === 11000) fail(409, 'A dispute already exists for this reference'); throw error; }
});

export const review = (model, type) => handle(async (req, res) => {
  validId(req.params.id);
  const { status, adminNote } = req.body || {};
  if (!['under_review', 'resolved', 'dismissed'].includes(status) || typeof adminNote !== 'string' || adminNote.trim().length < 3 || adminNote.length > 1000) fail(400, 'Valid status and admin note (3–1000 characters) required');
  const record = await runTransaction(async session => {
    const record = await model.findById(req.params.id).session(session);
    if (!record) fail(404, 'Record not found');
    if (record.status === status && record.adminNote === adminNote.trim()) return record; // Identical retry has no second effect/audit.
    if ((record.status === 'open' && status !== 'under_review') || record.status !== 'open' && record.status !== 'under_review' || record.status === status) fail(409, 'Invalid review transition');
    record.status = status; record.adminNote = adminNote.trim(); record.reviewedBy = req.user._id; record.reviewedAt = new Date();
    if (type === 'dispute') record.history.push({ status, note: record.adminNote, adminId: req.user._id, at: record.reviewedAt });
    await record.save({ session });
    await AdminLog.create([{ adminId: req.user._id, action: `${type.toUpperCase()}_${status.toUpperCase()}`,
      targetType: 'system', targetId: record._id, details: record.adminNote }], { session });
    if (type === 'dispute') await statusNotification('dispute', record, session);
    return record;
  });
  res.json({ [type]: record });
});
export const reviewAlert = review(AnomalyAlert, 'alert');
export const reviewDispute = review(Dispute, 'dispute');
export const getReport = handle(async (req, res) => {
  const report = await buildReport(req.query);
  if (req.path.endsWith('/export')) {
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="netshare-report-${report.from}-${report.to}.csv"`).send(reportCsv(report));
  } else res.json({ report });
});
export const listNotifications = handle(async (req, res) => {
  const filter = { userId: req.user._id, ...filterStatus(req.query, ['read', 'unread']) };
  res.json({ notifications: await Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(page(req.query)).limit(50),
    unreadCount: await Notification.countDocuments({ userId: req.user._id, status: 'unread' }), total: await Notification.countDocuments(filter) });
});
export const readNotification = handle(async (req, res) => {
  validId(req.params.id);
  await Notification.updateOne({ _id: req.params.id, userId: req.user._id, status: 'unread' }, { $set: { status: 'read', readAt: new Date() } });
  const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
  if (!notification) fail(404, 'Notification not found');
  res.json({ notification });
});
export const readAllNotifications = handle(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, status: 'unread' }, { $set: { status: 'read', readAt: new Date() } });
  res.json({ message: 'Notifications marked read' });
});
