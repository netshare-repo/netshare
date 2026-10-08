import Notification from '../models/Notification.js';
import TestingTask from '../models/TestingTask.js';
import TopUpRequest from '../models/TopUpRequest.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import MarketplaceOrder from '../models/MarketplaceOrder.js';
import NodeDevice from '../models/NodeDevice.js';

export const notifyOnce = async (event, session = null) => {
  const insert = { ...event, createdAt: event.createdAt || new Date(), updatedAt: new Date() };
  try {
    return await Notification.findOneAndUpdate(
      { userId: event.userId, eventKey: event.eventKey },
      { $setOnInsert: insert }, { upsert: true, new: true, session, setDefaultsOnInsert: true, timestamps: false });
  } catch (error) {
    if (error.code !== 11000 || session) throw error;
    return Notification.findOne({ userId: event.userId, eventKey: event.eventKey });
  }
};

export const statusNotification = (relatedType, record, session = null) => notifyOnce({
  userId: record.userId || record.clientId,
  eventKey: `${relatedType}:${record._id}:${record.status}`,
  type: `${relatedType}_status`, relatedType, relatedId: record._id,
  message: `${relatedType === 'topup' ? 'Top-up' : relatedType} ${record._id}: ${record.status}.`,
  createdAt: new Date(), updatedAt: new Date(),
}, session);

// Durable-source reconciliation retries missed delivery after crashes and preserves read state.
// Cursor traversal bounds memory; no date cutoff silently discards older pending delivery.
export const reconcileNotifications = async () => {
  for (const [type, model, statuses] of [
    ['task', TestingTask, ['completed', 'settled', 'failed']],
    ['topup', TopUpRequest, ['approved', 'rejected']],
    ['withdrawal', WithdrawalRequest, ['pending', 'approved', 'rejected', 'processed']],
    ['order', MarketplaceOrder, ['pending', 'fulfilled', 'cancelled', 'rejected']],
  ]) {
    for await (const record of model.find({ status: { $in: statuses } }).lean().cursor()) {
      if (type === 'task' && record.status === 'settled') record.status = 'completed';
      await statusNotification(type, record);
      if (type === 'task' && record.assignedNodeId) {
        const node = await NodeDevice.findById(record.assignedNodeId).select('userId').lean();
        if (node && String(node.userId) !== String(record.clientId)) {
          await statusNotification(type, { ...record, userId: node.userId });
        }
      }
    }
  }
};
