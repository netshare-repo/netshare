import MarketplaceOrder from '../models/MarketplaceOrder.js';
import Wallet from '../models/Wallet.js';
import CreditTransaction from '../models/CreditTransaction.js';
import AdminLog from '../models/AdminLog.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { statusNotification } from './notificationService.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const changeOrderStatus = (id, adminId, status, note = '') => runTransaction(async session => {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) fail(400, 'Invalid order ID');
  if (!['pending', 'fulfilled', 'cancelled', 'rejected'].includes(status) || typeof note !== 'string' || note.length > 1000) fail(400, 'Invalid order status or note');
  const order = await MarketplaceOrder.findById(id).session(session);
  if (!order) fail(404, 'Marketplace order not found');
  if (order.status === status) return order;
  if (order.status !== 'pending') fail(409, 'Order already finalized');
  order.status = status; order.fulfilmentNote = note.trim();
  if (status === 'fulfilled') { order.fulfilledBy = adminId; order.fulfilledAt = new Date(); }
  if (status === 'cancelled' || status === 'rejected') {
    const wallet = await Wallet.findOneAndUpdate({ userId: order.userId },
      { $inc: { balance: order.creditsSpent } }, { new: true, session });
    if (!wallet) fail(409, 'Refund wallet not found');
    const [transaction] = await CreditTransaction.create([{ userId: order.userId, type: 'credit', amount: order.creditsSpent,
      description: `Refund for marketplace order ${id}`, status: 'completed', idempotencyKey: `order:refund:${id}` }], { session });
    order.refundedAt = new Date(); order.refundedCredits = order.creditsSpent; order.refundTransactionId = transaction._id;
  }
  await order.save({ session });
  await AdminLog.create([{ adminId, action: 'UPDATE_MARKETPLACE_ORDER', targetType: 'system', targetId: order._id,
    details: `Order ${status}; ${order.fulfilmentNote}` }], { session });
  await statusNotification('order', order, session);
  return order;
});
