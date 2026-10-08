import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import NodeDevice from '../models/NodeDevice.js';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import TaskSession from '../models/TaskSession.js';
import RoutingSession from '../models/RoutingSession.js';
import CreditTransaction from '../models/CreditTransaction.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import AnomalyAlert from '../models/AnomalyAlert.js';
import Notification from '../models/Notification.js';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import MarketplaceOrder from '../models/MarketplaceOrder.js';
import AdminLog from '../models/AdminLog.js';
import sessionRoutes from '../routes/sessionRoutes.js';
import taskRoutes from '../routes/taskRoutes.js';
import marketplaceRoutes from '../routes/marketplaceRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import authRoutes from '../routes/authRoutes.js';
import generateToken from '../utils/generateToken.js';
import { createRoutingSession } from '../services/routingSessionService.js';
import { settleTaskResult } from '../services/taskSettlementService.js';
import { handleTaskFailure } from '../services/secureTaskRoutingService.js';
import { claimTaskOnNode, releaseUnstartedAssignment } from '../services/allocationClaimService.js';
import { recoverPersistedTasks } from '../services/taskRecoveryService.js';
import { getMemoryQueue } from '../services/taskQueueService.js';
import { receiveNodeTelemetry, authenticateSocketHandshake } from '../services/socketService.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { createTopUp, reviewTopUp, createWithdrawal, reviewWithdrawal } from '../services/paymentService.js';
import { reconcileNotifications } from '../services/notificationService.js';

// Real replica-set writes; HTTP results are explicit fixtures, NOT Android E2E.
const app = express();
app.use(express.json());
app.use('/api/sessions', sessionRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
let client, other, contributor, admin, node, task, route;
let userIds = [];
const auth = user => ({ Authorization: `Bearer ${generateToken(user._id)}` });
const payload = () => ({ taskId: String(task._id), success: true, statusCode: 200,
  latencyMs: 22, bandwidthUsedMB: 0.1, uploadBandwidthMB: 0, successRate: 100, packetLoss: 0 });

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const model of [User, Wallet, TaskResult, CreditTransaction, AnomalyAlert, Notification]) await model.init();
  [client, other, contributor, admin] = await User.create(['platform_client', 'platform_client', 'node_participant', 'admin']
    .map((role, index) => ({ name: `RC ${index}`, email: `rc8_${Date.now()}_${index}@test.io`, password: 'fixture-hash', role, isVerified: true })));
  userIds = [client, other, contributor, admin].map(user => user._id);
  await Wallet.create(userIds.map(userId => ({ userId, balance: 1000, earnedCredits: 500, withdrawableCredits: 500 })));
});
beforeEach(async () => {
  vi.restoreAllMocks();
  node = await NodeDevice.create({ userId: contributor._id, deviceName: 'RC8 fixture', region: 'RC8', status: 'active',
    bandwidthLimitMB: 1000, healthScore: 100, lastSeenAt: new Date(), maxConcurrentTasks: 2, currentActiveTasks: 1,
    apiKey: `rc-secret-${new mongoose.Types.ObjectId()}` });
  task = await TestingTask.create({ clientId: client._id, targetUrl: 'https://example.com', serviceType: 'performance_testing',
    targetRegion: 'RC8', executionLimit: 1, estimatedCost: 10, status: 'running', assignedNodeId: node._id });
  route = (await createRoutingSession({ taskId: task._id, clientId: client._id, nodeId: node._id })).session;
  await RoutingSession.updateOne({ _id: route._id }, { status: 'active' });
  await TaskSession.create({ taskId: task._id, clientId: client._id, nodeId: node._id, sessionToken: 'secret-session', status: 'running' });
});
afterAll(async () => {
  const nodes = await NodeDevice.find({ userId: { $in: userIds } }).select('_id');
  for (const model of [TestingTask, TaskResult, TaskSession, RoutingSession]) await model.deleteMany({ clientId: { $in: userIds } });
  await BandwidthUsage.deleteMany({ nodeId: { $in: nodes.map(item => item._id) } });
  await AnomalyAlert.deleteMany({ dedupKey: /^settlement-review:/ });
  for (const model of [Wallet, CreditTransaction, Notification, MarketplaceOrder]) await model.deleteMany({ userId: { $in: userIds } });
  await MarketplaceProduct.deleteMany({ name: /^RC8/ });
  await AdminLog.deleteMany({ adminId: { $in: userIds } });
  await NodeDevice.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await mongoose.disconnect();
});

describe('Phase 8 release security and replica-set acceptance', () => {
  it('enforces the OTP attempt limit instead of leaving protection helpers unused', async () => {
    const signup = await User.create({ name: 'RC OTP lock', email: `rc8_otp_lock_${Date.now()}@test.io`,
      password: 'fixture', role: 'platform_client', isVerified: false,
      signupOtpHash: crypto.createHash('sha256').update('123456').digest('hex'), signupOtpExpires: new Date(Date.now() + 60000) });
    userIds.push(signup._id);
    for (let index = 0; index < 5; index++) expect((await request(app).post('/api/auth/verify-signup-otp')
      .send({ email: signup.email, otp: '999999' })).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-signup-otp').send({ email: signup.email, otp: '123456' })).status).toBe(429);
    expect((await User.findById(signup._id)).isVerified).toBe(false);
  });
  it('verifies an OTP and creates its wallet atomically under concurrent requests', async () => {
    const signup = await User.create({ name: 'RC signup', email: `rc8_signup_${Date.now()}@test.io`,
      password: 'fixture', role: 'platform_client', isVerified: false,
      signupOtpHash: crypto.createHash('sha256').update('123456').digest('hex'), signupOtpExpires: new Date(Date.now() + 60000) });
    userIds.push(signup._id);
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app).post('/api/auth/verify-signup-otp')
      .send({ email: signup.email, otp: '123456' })));
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    expect(results.every(result => [200, 400, 409].includes(result.status))).toBe(true);
    expect(await Wallet.countDocuments({ userId: signup._id })).toBe(1);
    expect((await User.findById(signup._id)).isVerified).toBe(true);
  });
  it('rolls verification back if wallet creation fails', async () => {
    const signup = await User.create({ name: 'RC rollback', email: `rc8_signup_rollback_${Date.now()}@test.io`,
      password: 'fixture', role: 'platform_client', isVerified: false,
      signupOtpHash: crypto.createHash('sha256').update('123456').digest('hex'), signupOtpExpires: new Date(Date.now() + 60000) });
    userIds.push(signup._id);
    vi.spyOn(Wallet, 'create').mockRejectedValueOnce(new Error('injected wallet failure'));
    expect((await request(app).post('/api/auth/verify-signup-otp').send({ email: signup.email, otp: '123456' })).status).toBe(500);
    expect((await User.findById(signup._id)).isVerified).toBe(false);
    expect(await Wallet.countDocuments({ userId: signup._id })).toBe(0);
  });
  it('releases only unstarted assignments once, preserving paused nodes and refusing running replay', async () => {
    await TestingTask.updateOne({ _id: task._id }, { status: 'assigned' });
    await RoutingSession.updateOne({ _id: route._id }, { status: 'negotiating' });
    await NodeDevice.updateOne({ _id: node._id }, { status: 'paused' });
    const releases = await Promise.all(Array.from({ length: 8 }, () => releaseUnstartedAssignment(task._id, node._id, route._id)));
    expect(releases.filter(Boolean)).toHaveLength(1);
    expect((await NodeDevice.findById(node._id)).currentActiveTasks).toBe(0);
    expect((await NodeDevice.findById(node._id)).status).toBe('paused');
    expect((await TestingTask.findById(task._id)).status).toBe('pending');
    expect((await RoutingSession.findById(route._id)).status).toBe('failed');
    await TestingTask.updateOne({ _id: task._id }, { status: 'running', assignedNodeId: node._id });
    expect(await releaseUnstartedAssignment(task._id, node._id, route._id)).toBeNull();
  });
  it('changes the owning account password even though protected requests redact the stored hash', async () => {
    await User.updateOne({ _id: other._id }, { password: await bcrypt.hash('OriginalPass123', 10) });
    const response = await request(app).put('/api/users/change-password').set(auth(other)).send({ oldPassword: 'OriginalPass123', newPassword: 'ReplacementPass123' });
    expect(response.status).toBe(200);
    expect(await bcrypt.compare('ReplacementPass123', (await User.findById(other._id)).password)).toBe(true);
    expect((await request(app).put('/api/users/profile').set(auth(other)).send({ name: 12 })).status).toBe(400);
  });
  it('rejects unverified API access and blocked API-key socket access', async () => {
    await User.updateOne({ _id: other._id }, { isVerified: false });
    expect((await request(app).get('/api/tasks/my-tasks').set(auth(other))).status).toBe(403);
    await User.updateOne({ _id: other._id }, { isVerified: true });
    await User.updateOne({ _id: contributor._id }, { status: 'blocked' });
    let error;
    await authenticateSocketHandshake({ handshake: { auth: { apiKey: node.apiKey } } }, result => { error = result; });
    expect(error?.message).toMatch(/not authorized/);
    await User.updateOne({ _id: contributor._id }, { status: 'active' });
  });
  it('telemetry replay cannot reactivate a paused node or inflate billable bandwidth', async () => {
    await NodeDevice.updateOne({ _id: node._id }, { status: 'paused', usedBandwidthMB: 7 });
    for (let index = 0; index < 3; index++) await receiveNodeTelemetry(node._id, { status: 'active', bandwidthUsedMB: 10, latencyMs: 12 });
    const updated = await NodeDevice.findById(node._id);
    expect(updated.status).toBe('paused');
    expect(updated.usedBandwidthMB).toBe(7);
    expect(await BandwidthUsage.countDocuments({ nodeId: node._id })).toBe(0);
  });
  it('uses a real elected replica-set primary and rolls back writes', async () => {
    expect((await mongoose.connection.db.admin().command({ hello: 1 })).setName).toBeTruthy();
    const balance = (await Wallet.findOne({ userId: client._id })).balance;
    await expect(runTransaction(async session => {
      await Wallet.updateOne({ userId: client._id }, { $inc: { balance: -10 } }, { session });
      throw new Error('injected rollback');
    })).rejects.toThrow('injected rollback');
    expect((await Wallet.findOne({ userId: client._id })).balance).toBe(balance);
  });
  it('blocks unrelated session readers and redacts credentials for the owner and assigned node', async () => {
    const session = await TaskSession.findOne({ taskId: task._id });
    for (const path of [`/api/sessions/${session._id}`, `/api/sessions/task/${task._id}`]) {
      expect((await request(app).get(path).set(auth(other))).status).toBe(403);
      expect((await request(app).get(path)).status).toBe(401);
      for (const user of [client, contributor, admin]) {
        const response = await request(app).get(path).set(auth(user));
        expect(response.status).toBe(200);
        expect(response.body.session.sessionToken).toBeUndefined();
        expect(response.body.session.nodeId.apiKey).toBeUndefined();
      }
    }
  });
  it('never leaks assigned node API keys in client task details/list', async () => {
    for (const path of [`/api/tasks/${task._id}`, '/api/tasks/my-tasks']) {
      const response = await request(app).get(path).set(auth(client));
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain(node.apiKey);
    }
  });
  it('rolls result, reward, task, bandwidth, and capacity back if wallet credit fails', async () => {
    const balance = (await Wallet.findOne({ userId: contributor._id })).balance;
    const spy = vi.spyOn(CreditTransaction, 'create').mockRejectedValueOnce(new Error('injected ledger failure'));
    await expect(settleTaskResult(route._id, payload())).rejects.toThrow('injected ledger failure');
    spy.mockRestore();
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(0);
    expect(await BandwidthUsage.countDocuments({ taskId: task._id })).toBe(0);
    expect((await TestingTask.findById(task._id)).status).toBe('running');
    expect((await NodeDevice.findById(node._id)).currentActiveTasks).toBe(1);
    expect((await Wallet.findOne({ userId: contributor._id })).balance).toBe(balance);
    expect(await AnomalyAlert.countDocuments({ dedupKey: `settlement-review:${task._id}` })).toBe(1);
    expect((await settleTaskResult(route._id, payload())).settled).toBe(true);
  });
  it('commits exactly once under 12 concurrent result deliveries and preserves terminal state on late failures', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => settleTaskResult(route._id, payload())));
    expect(results.filter(result => result.settled)).toHaveLength(1);
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'credit' })).toBe(1);
    expect(await BandwidthUsage.countDocuments({ taskId: task._id })).toBe(1);
    await Promise.all(Array.from({ length: 8 }, () => handleTaskFailure(route._id, task._id, 'late_disconnect')));
    expect((await TestingTask.findById(task._id)).status).toBe('settled');
    expect((await NodeDevice.findById(node._id)).currentActiveTasks).toBe(0);
  });
  it.each([NaN, Infinity, -1, '0.1', 2048])('rejects forged/malformed bandwidth %s without settlement', async value => {
    await expect(settleTaskResult(route._id, { ...payload(), bandwidthUsedMB: value })).rejects.toMatchObject({ code: 'INVALID_RESULT' });
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(0);
  });
  it('rejects results from expired or failed routes', async () => {
    await RoutingSession.updateOne({ _id: route._id }, { status: 'failed' });
    await expect(settleTaskResult(route._id, payload())).rejects.toMatchObject({ code: 'INACTIVE_ROUTE' });
  });
  it('handles duplicate failure exactly once without resurrecting an offline node', async () => {
    await NodeDevice.updateOne({ _id: node._id }, { status: 'offline', currentActiveTasks: 2 });
    await Promise.all(Array.from({ length: 8 }, () => handleTaskFailure(route._id, task._id, 'node_disconnected')));
    const updated = await NodeDevice.findById(node._id);
    expect(updated.status).toBe('offline');
    expect(updated.currentActiveTasks).toBe(1);
    expect((await RoutingSession.findById(route._id)).status).toBe('failed');
  });
  it('does not claim an ineligible node and rolls the task claim back', async () => {
    await TestingTask.updateOne({ _id: task._id }, { status: 'pending', assignedNodeId: null });
    await NodeDevice.updateOne({ _id: node._id }, { status: 'offline' });
    expect(await claimTaskOnNode(task._id, node._id, 'RC8')).toBeNull();
    expect((await TestingTask.findById(task._id)).status).toBe('pending');
    expect((await TestingTask.findById(task._id)).assignedNodeId).toBeNull();
  });
  it('allocates multiple clients across multiple nodes without overbooking or duplicate assignment', async () => {
    const nodes = await NodeDevice.create(Array.from({ length: 3 }, (_, index) => ({ userId: contributor._id,
      deviceName: `RC8 capacity ${index}`, region: 'RC8CAP', status: 'active', bandwidthLimitMB: 1000,
      healthScore: 100, lastSeenAt: new Date(), maxConcurrentTasks: 2, currentActiveTasks: 0 })));
    const tasks = await TestingTask.create(Array.from({ length: 6 }, (_, index) => ({ clientId: index % 2 ? client._id : other._id,
      targetUrl: 'https://example.com', serviceType: 'performance_testing', targetRegion: 'RC8CAP', estimatedCost: 10,
      executionLimit: 1, status: 'pending' })));
    const claims = await Promise.all(tasks.flatMap((item, index) => Array.from({ length: 3 }, () =>
      claimTaskOnNode(item._id, nodes[Math.floor(index / 2)]._id, 'RC8CAP'))));
    expect(claims.filter(Boolean)).toHaveLength(6);
    for (const item of nodes) expect((await NodeDevice.findById(item._id)).currentActiveTasks).toBe(2);
    expect(await TestingTask.countDocuments({ _id: { $in: tasks.map(item => item._id) }, status: 'assigned' })).toBe(6);
  });
  it('prevents stock oversell and orphan debits under concurrent marketplace purchases', async () => {
    const product = await MarketplaceProduct.create({ name: 'RC8 scarce stock', description: 'fixture', requiredCredits: 5, stock: 1, status: 'active' });
    const balance = (await Wallet.findOne({ userId: client._id })).balance;
    const attempts = await Promise.all(Array.from({ length: 8 }, () => request(app).post('/api/marketplace/orders').set(auth(client)).send({ productId: product._id })));
    expect(attempts.filter(result => result.status === 201)).toHaveLength(1);
    expect(await MarketplaceOrder.countDocuments({ productId: product._id })).toBe(1);
    expect((await MarketplaceProduct.findById(product._id)).stock).toBe(0);
    expect((await Wallet.findOne({ userId: client._id })).balance).toBe(balance - 5);
  });
  it('rolls back marketplace inventory and order if debit fails', async () => {
    const product = await MarketplaceProduct.create({ name: 'RC8 rollback', description: 'fixture', requiredCredits: 999999, stock: 1, status: 'active' });
    expect((await request(app).post('/api/marketplace/orders').set(auth(client)).send({ productId: product._id })).status).toBe(500);
    expect(await MarketplaceOrder.countDocuments({ productId: product._id })).toBe(0);
    expect((await MarketplaceProduct.findById(product._id)).stock).toBe(1);
  });
  it('recovers expired persisted tasks without replay and repopulates pending work when Redis is unavailable', async () => {
    await RoutingSession.updateOne({ _id: route._id }, { status: 'negotiating', expiresAt: new Date(Date.now() - 1) });
    const pending = await TestingTask.create({ clientId: client._id, targetUrl: 'https://example.com', serviceType: 'performance_testing',
      targetRegion: 'RC8', executionLimit: 1, estimatedCost: 10, status: 'pending' });
    const recovered = await recoverPersistedTasks();
    expect(recovered.failed).toBeGreaterThanOrEqual(1);
    expect((await TestingTask.findById(task._id)).status).toBe('failed');
    expect(getMemoryQueue().jobs.some(job => String(job.data.taskId) === String(pending._id))).toBe(true);
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(0);
  });
  it('handles concurrent top-up approvals and withdrawals without lost wallet updates', async () => {
    const input = { amount: 100, paymentMethod: 'easypaisa', referenceNumber: `RC8${Date.now()}`,
      proofMime: 'image/png', proofBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64') };
    const topup = await createTopUp(contributor._id, input);
    await Wallet.updateOne({ userId: contributor._id }, { balance: 200, withdrawableCredits: 200 });
    const approvals = await Promise.allSettled(Array.from({ length: 8 }, () => reviewTopUp(topup._id, admin._id, 'approved', 'fixture proof verified')));
    expect(approvals.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(approvals.filter(item => item.status === 'rejected').every(item => item.reason.status === 409)).toBe(true);
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => createWithdrawal(contributor._id,
      { amount: 100, method: 'easypaisa', accountDetails: '03001234567' })));
    const accepted = attempts.filter(result => result.status === 'fulfilled').map(result => result.value);
    expect(accepted).toHaveLength(2);
    for (const withdrawal of accepted) {
      await reviewWithdrawal(withdrawal._id, admin._id, 'approved', 'fixture review');
      const processing = await Promise.allSettled(Array.from({ length: 4 }, () => reviewWithdrawal(withdrawal._id, admin._id, 'processed', 'fixture paid')));
      expect(processing.filter(item => item.status === 'fulfilled')).toHaveLength(1);
      expect(processing.filter(item => item.status === 'rejected').every(item => item.reason.status === 409)).toBe(true);
    }
    expect((await Wallet.findOne({ userId: contributor._id })).balance).toBe(100);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `topup:${topup._id}` })).toBe(1);
    await reconcileNotifications();
    expect(await Notification.countDocuments({ userId: contributor._id })).toBeGreaterThan(0);
  });
  it('uses production configuration to disable demo/legacy endpoints, not a mutable test flag', async () => {
    const code = `const {developmentOnly}=await import('./middleware/productionGuard.js');
      for(let i=0;i<6;i++){let status; developmentOnly({}, {status(s){status=s;return this},json(){console.log(status)}},()=>{throw Error('BYPASS')});}`;
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), env: {
        ...process.env, NODE_ENV: 'production', JWT_SECRET: 'fixture-production-secret-32-characters', SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '2526', SMTP_USER: 'fixture', SMTP_PASS: 'fixture', SMTP_FROM: 'fixture@test.io' } });
      let stdout = '', stderr = '';
      child.stdout.on('data', data => stdout += data);
      child.stderr.on('data', data => stderr += data);
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
    });
    expect(output.match(/410/g)).toHaveLength(6);
  });
});
