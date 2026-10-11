import User from '../models/User.js';
import NodeDevice from '../models/NodeDevice.js';
import TestingTask from '../models/TestingTask.js';
import ParticipationSession from '../models/ParticipationSession.js';
import AdminLog from '../models/AdminLog.js';
import { runTransaction } from '../lib/mongoTransaction.js';

const fail = (status, message) => Object.assign(new Error(message), { status });
export const changeAccountRole = (userId, role) => runTransaction(async session => {
  if (!['node_participant', 'platform_client', 'both'].includes(role)) throw fail(400, 'Invalid role');
  const user = await User.findOneAndUpdate({ _id: userId, role: { $ne: 'admin' }, status: 'active' },
    { $inc: { authorizationVersion: 1 } }, { new: true, session });
  if (!user) throw fail(403, 'Role change not permitted');
  if (user.role === role) return user;
  if (await TestingTask.exists({ clientId: userId, status: { $in: ['pending', 'assigned', 'running'] } }).session(session) ||
      await NodeDevice.exists({ userId, $or: [{ currentActiveTasks: { $gt: 0 } }, { status: { $in: ['active', 'busy', 'draining', 'paused'] } }] }).session(session) ||
      await ParticipationSession.exists({ userId, status: { $in: ['active', 'paused', 'draining'] } }).session(session)) {
    throw fail(409, 'Stop participation and finish active tasks before changing role');
  }
  user.role = role; await user.save({ session });
  await AdminLog.create([{ adminId: userId, action: 'CHANGE_OWN_ROLE', targetType: 'user', targetId: userId,
    details: `Account role changed to ${role}` }], { session });
  return user;
});

export const restrictAccount = (adminId, userId, note) => runTransaction(async session => {
  if (String(adminId) === String(userId)) throw fail(400, 'Cannot restrict yourself');
  if (typeof note !== 'string' || note.trim().length < 3 || note.length > 500) throw fail(400, 'Admin note must contain 3–500 characters');
  const user = await User.findById(userId).session(session);
  if (!user) throw fail(404, 'User not found');
  if (user.role === 'admin' || user.status === 'blocked') throw fail(409, 'Cannot restrict an admin or blocked account');
  if (user.status === 'restricted') return user;
  user.status = 'restricted'; user.authorizationVersion += 1; await user.save({ session });
  await NodeDevice.updateMany({ userId }, { $set: { status: 'inactive' } }, { session });
  await AdminLog.create([{ adminId, action: 'RESTRICT_USER', targetType: 'user', targetId: userId,
    details: `Read-only restriction: ${note.trim()}` }], { session });
  return user;
});
