import { beforeAll, afterAll, it, expect } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import NodeDevice from '../models/NodeDevice.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import CreditTransaction from '../models/CreditTransaction.js';
import Notification from '../models/Notification.js';
import adminRoutes from '../routes/adminRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import walletRoutes from '../routes/walletRoutes.js';
import nodeRoutes from '../routes/nodeRoutes.js';
import { spawnSync } from 'node:child_process';
import { MetricsCollector } from '../../netshare-agent/src/metricsCollector.js';
import generateToken from '../utils/generateToken.js';
import bcrypt from 'bcryptjs';
import AdminLog from '../models/AdminLog.js';
import { claimTaskOnNode } from '../services/allocationClaimService.js';
import TestingTask from '../models/TestingTask.js';
const app = express(); app.use(express.json({ limit: '10mb' }));
app.use('/admin', adminRoutes); app.use('/users', userRoutes); app.use('/wallet', walletRoutes);
app.use('/node', nodeRoutes);
let admin, user, outsider, node;
const auth = u => ({ Authorization: `Bearer ${generateToken(u._id)}` });
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await WithdrawalRequest.init(); await CreditTransaction.init(); await Notification.init();
  [admin, user, outsider] = await User.create(['admin', 'node_participant', 'platform_client'].map((role, index) => ({
    name: 'Phase 9', email: `phase9_${Date.now()}_${index}@test.io`, password: bcrypt.hashSync('Phase9Password1', 4), role,
    isVerified: true, signupOtpHash: 'private-otp', resetOtpHash: 'private-reset' })));
  await Wallet.create({ userId: user._id, balance: 300, withdrawableCredits: 250 });
  node = await NodeDevice.create({ userId: user._id, deviceName: 'Phase9 test', region: 'P9', apiKey: `p9-${Date.now()}` });
});
afterAll(async () => {
  const ids = [admin, user, outsider].filter(Boolean).map(u => u._id);
  for (const model of [Wallet, WithdrawalRequest, CreditTransaction, Notification, NodeDevice]) await model.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } }); await mongoose.disconnect();
});
it('changes own persisted role with confirmation/password and rejects admin escalation or active participation', async () => {
  const change = body => request(app).put('/users/role').set(auth(outsider)).send(body);
  const input = { role: 'both', password: 'Phase9Password1', confirm: true };
  expect((await change({ ...input, confirm: false })).status).toBe(400);
  expect((await change({ ...input, password: 'bad' })).status).toBe(401);
  expect((await change({ ...input, role: 'admin' })).status).toBe(400);
  expect((await change(input)).status).toBe(200);
  expect((await User.findById(outsider._id)).role).toBe('both');
  const active = await NodeDevice.create({ userId: outsider._id, deviceName: 'busy role fixture', region: 'P9', status: 'active' });
  expect((await change({ ...input, role: 'platform_client' })).status).toBe(409);
  await active.deleteOne();
  expect((await change({ ...input, role: 'platform_client' })).status).toBe(200);
});
it('audits idempotent read-only restriction and prevents new allocations or writes', async () => {
  const url = `/admin/users/${user._id}/restrict`;
  expect((await request(app).put(url).set(auth(outsider)).send({ note: 'Review needed' })).status).toBe(403);
  expect((await request(app).put(url).set(auth(admin)).send({ note: '' })).status).toBe(400);
  for (let i = 0; i < 2; i++) expect((await request(app).put(url).set(auth(admin)).send({ note: 'Review needed' })).status).toBe(200);
  expect(await AdminLog.countDocuments({ targetId: user._id, action: 'RESTRICT_USER' })).toBe(1);
  expect((await request(app).get('/users/profile').set(auth(user))).status).toBe(200);
  expect((await request(app).put('/users/profile').set(auth(user)).send({ name: 'forbidden' })).status).toBe(403);
  await NodeDevice.updateOne({ _id: node._id }, { status: 'active', healthScore: 100, lastSeenAt: new Date() });
  const task = await TestingTask.create({ clientId: outsider._id, targetUrl: 'https://example.com', serviceType: 'performance_testing', targetRegion: 'P9', executionLimit: 1, estimatedCost: 10 });
  expect(await claimTaskOnNode(task._id, node._id, 'P9')).toBeNull();
  expect((await TestingTask.findById(task._id)).assignedNodeId).toBeNull();
  await task.deleteOne();
  await User.updateOne({ _id: user._id }, { status: 'active' });
});
it('redacts credential and OTP material from own profile and admin lists/details', async () => {
  for (const [url, caller, field] of [['/users/profile', user, 'user'], [`/admin/users/${user._id}`, admin, 'user']]) {
    const res = await request(app).get(url).set(auth(caller)); expect(res.status).toBe(200);
    expect(res.body[field].password).toBeUndefined(); expect(res.body[field].signupOtpHash).toBeUndefined();
    expect(res.body[field].resetOtpHash).toBeUndefined();
  }
  const details = await request(app).get(`/admin/users/${user._id}`).set(auth(admin));
  expect(details.body.nodes[0].apiKey).toBeUndefined(); expect(details.body.wallet.balance).toBe(300);
  const list = await request(app).get('/admin/users').set(auth(admin));
  expect(list.body.users.every(u => !u.password && !u.signupOtpHash && !u.resetOtpHash)).toBe(true);
});
it('admin details reject unauthorized, invalid and missing users', async () => {
  expect((await request(app).get(`/admin/users/${user._id}`).set(auth(outsider))).status).toBe(403);
  expect((await request(app).get('/admin/users/bad-id').set(auth(admin))).status).toBe(400);
  expect((await request(app).get(`/admin/users/${new mongoose.Types.ObjectId()}`).set(auth(admin))).status).toBe(404);
});
it('dashboard exposes accounted bandwidth and honest fresh-node measurements', async () => {
  await NodeDevice.updateOne({ _id: node._id }, { status: 'active', latencyMs: 12, lastSeenAt: new Date() });
  const res = await request(app).get('/admin/dashboard').set(auth(admin)); expect(res.status).toBe(200);
  expect(res.body.bandwidth.totalMB).toBeGreaterThanOrEqual(0);
  expect(res.body.network.freshnessSeconds).toBe(60); expect(res.body.network.freshNodes).toBeGreaterThan(0);
  expect(res.body.network.sampledAt).toBeTruthy();
});
it('validates photo type, canonical encoding, signature and size and stores only the owner photo', async () => {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB8sAAAAASUVORK5CYII=';
  const res = await request(app).put('/users/profile').set(auth(user)).send({ photo: { mimeType: 'image/png', base64 }, userId: outsider._id });
  expect(res.status).toBe(200); expect(res.body.user.profileImage).toBe(`data:image/png;base64,${base64}`);
  expect((await User.findById(outsider._id)).profileImage).toBe('');
  for (const photo of [{ mimeType: 'image/svg+xml', base64 }, { mimeType: 'image/jpeg', base64 },
    { mimeType: 'image/png', base64: '*' }, { mimeType: 'image/png', base64: 'a'.repeat(3 * 1024 * 1024) }]) {
    expect((await request(app).put('/users/profile').set(auth(user)).send({ photo })).status).toBe(400);
  }
  expect((await request(app).put('/users/profile').set(auth(user)).send({ profileImage: 'https://untrusted.test/image' })).status).toBe(400);
  expect((await request(app).put('/users/profile').send({ photo: { mimeType: 'image/png', base64 } })).status).toBe(401);
});
it('retries a withdrawal exactly once and rejects a changed request with the same key', async () => {
  const input = { amount: 25, method: 'easypaisa', accountDetails: 'Account 123456789', requestId: 'phase9-retry-12345678' };
  const results = await Promise.all([0, 1, 2].map(() => request(app).post('/wallet/withdrawals').set(auth(user)).send(input)));
  expect(results.some(r => r.status === 201)).toBe(true);
  const retry = await request(app).post('/wallet/withdrawals').set(auth(user)).send(input);
  expect(retry.status).toBe(201);
  expect(await WithdrawalRequest.countDocuments({ userId: user._id })).toBe(1);
  expect((await Wallet.findOne({ userId: user._id })).balance).toBe(275);
  expect((await request(app).post('/wallet/withdrawals').set(auth(user)).send({ ...input, amount: 26 })).status).toBe(409);
  expect((await request(app).post('/wallet/withdrawals').set(auth(outsider)).send(input)).status).toBe(403);
});

it('validates node limits, applies a shared cap in both directions and preserves heartbeat freshness', async () => {
  const before = await NodeDevice.findById(node._id);
  for (const body of [{ speedCapMbps: 0 }, { bandwidthLimit: -1 }, { maxConcurrentTasks: 1.5 }, { region: {} }, { uploadSpeedCapMbps: true }]) {
    expect((await request(app).put('/node/settings').set(auth(user)).send(body)).status).toBe(400);
  }
  const updated = await request(app).put('/node/settings').set(auth(user)).send({ speedCapMbps: 2 });
  expect(updated.status).toBe(200);
  expect(updated.body.node.uploadSpeedCapMbps).toBe(2);
  expect(updated.body.node.downloadSpeedCapMbps).toBe(2);
  expect(new Date(updated.body.node.lastSeenAt).getTime()).toBe(before.lastSeenAt.getTime());
  await NodeDevice.updateOne({ _id: node._id }, { currentActiveTasks: 1 });
  expect((await request(app).put('/node/settings').set(auth(user)).send({ speedCapMbps: 3 })).status).toBe(409);
  await NodeDevice.updateOne({ _id: node._id }, { currentActiveTasks: 0 });
});

it('retires the legacy daemon and never fabricates missing CPU samples', () => {
  const result = spawnSync(process.execPath, ['../netshare-agent/agent.js'], { encoding: 'utf8', timeout: 5000 });
  expect(result.status).toBe(1); expect(result.stderr).toContain('retired');
  const collector = new MetricsCollector();
  collector.getCpuTimes = () => collector.previousCpu;
  expect(collector.getCpuUsagePercent()).toBeNull();
});
