import { beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import authRoutes from '../routes/authRoutes.js';
import { ensureIdentityIndexes, findIdentity, normalizePhone } from '../services/identityService.js';
import { sendSmsOtp } from '../services/smsService.js';
import { refreshDailyBudgets, trafficPolicyFor } from '../services/trafficPolicyService.js';
import { ensureFinancialIndexes } from '../services/indexMigrationService.js';
import NodeDevice from '../models/NodeDevice.js';
const app = express(); app.use(express.json()); app.use('/auth', authRoutes);
const ids = [];
const prefix = `p9identity_${Date.now()}`;
const phone = `+199${String(Date.now()).slice(-9)}`;
const registration = { name: prefix, password: 'IdentityPass1', role: 'node_participant', verificationMethod: 'sms', phone };
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await ensureIdentityIndexes();
  await ensureFinancialIndexes();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => {
  const users = await User.find({ name: prefix }).select('_id');
  const allIds = [...ids, ...users.map(u => u._id)];
  await Wallet.deleteMany({ userId: { $in: allIds } }); await NodeDevice.deleteMany({ userId: { $in: allIds } });
  await User.deleteMany({ _id: { $in: allIds } }); await mongoose.disconnect();
});
const provider = () => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', `AC${'1'.repeat(32)}`); vi.stubEnv('TWILIO_AUTH_TOKEN', 'fixture-only');
  vi.stubEnv('TWILIO_FROM', '+15555550123');
  const fetch = vi.fn(async () => new Response(JSON.stringify({ sid: 'SMfixture', status: 'queued' }), { status: 201 }));
  vi.stubGlobal('fetch', fetch); return fetch;
};
it('phone-only signup uses selected SMS channel, verifies atomically and allows phone login', async () => {
  const fetch = provider();
  const created = await request(app).post('/auth/register').send(registration);
  expect(created.status).toBe(201); expect(created.body.identifier).toBe(phone); expect(created.body.devOtp).toBeUndefined();
  const sent = new URLSearchParams(fetch.mock.calls[0][1].body);
  expect(sent.get('To')).toBe(phone); const otp = sent.get('Body').match(/code: (\d{6})/)[1];
  const saved = await findIdentity(phone); ids.push(saved._id);
  expect(saved.email).toBeUndefined(); expect(saved.signupOtpHash).toBe(crypto.createHash('sha256').update(otp).digest('hex'));
  expect((await request(app).post('/auth/login').send({ identifier: phone, password: registration.password })).status).toBe(403);
  const responses = await Promise.all([0, 1].map(() => request(app).post('/auth/verify-signup-otp').send({ identifier: phone, otp })));
  expect(responses.filter(r => r.status === 200)).toHaveLength(1);
  expect(await Wallet.countDocuments({ userId: saved._id })).toBe(1);
  expect((await request(app).post('/auth/login').send({ identifier: phone, password: registration.password })).status).toBe(200);
});
it('canonical phone uniqueness survives racing registration and supports multiple phone-only users', async () => {
  provider(); const otherPhone = `${phone.slice(0, -1)}${(Number(phone.at(-1)) + 1) % 10}`;
  const responses = await Promise.all([0, 1].map(() => request(app).post('/auth/register').send({ ...registration, phone: otherPhone })));
  expect(responses.filter(r => r.status === 201)).toHaveLength(1);
  expect(await User.countDocuments({ phone: otherPhone })).toBe(1);
  expect(normalizePhone('+1 (555) 555-0123')).toBe('+15555550123');
  expect((await request(app).post('/auth/register').send({ ...registration, phone: '03001234567' })).status).toBe(400);
});
it('allows duplicate legacy contact phones but keeps SMS login phones unique', async () => {
  const sharedContact = '03357244455';
  const contacts = await User.create([0, 1].map(index => ({
    name: prefix,
    email: `${prefix}_contact_${index}@test.io`,
    phone: sharedContact,
    password: 'fixture',
    role: 'platform_client',
    verificationMethod: 'email',
    isVerified: true,
  })));
  ids.push(...contacts.map(user => user._id));
  await ensureIdentityIndexes();
  expect(await User.countDocuments({ phone: sharedContact })).toBe(2);

  const smsPhone = '+19955557777';
  const first = await User.create({
    name: prefix, phone: smsPhone, password: 'fixture', role: 'platform_client',
    verificationMethod: 'sms', isVerified: true,
  });
  ids.push(first._id);
  await expect(User.create({
    name: prefix, phone: smsPhone, password: 'fixture', role: 'platform_client',
    verificationMethod: 'sms', isVerified: true,
  })).rejects.toMatchObject({ code: 11000 });
});
it('migrates legacy financial idempotency indexes idempotently', async () => {
  await ensureFinancialIndexes();
  const index = (await mongoose.connection.collection('credittransactions').indexes())
    .find(item => item.name === 'idempotencyKey_1');
  expect(index.unique).toBe(true);
  expect(index.sparse).not.toBe(true);
  expect(index.partialFilterExpression).toEqual({ idempotencyKey: { $type: 'string' } });
});
it('SMS unavailable/rejected/slow never reports accepted delivery or activates an account', async () => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', '');
  expect((await request(app).post('/auth/register').send({ ...registration, phone: '+19955559999' })).status).toBe(503);
  const fetch = provider(); fetch.mockResolvedValue(new Response('{}', { status: 500 }));
  expect((await request(app).post('/auth/register').send({ ...registration, phone: '+19955559999' })).status).toBe(503);
  expect((await findIdentity('+19955559999')).isVerified).toBe(false);
  await expect(sendSmsOtp(phone, '123456', 'signup', async (_url, options) => {
    expect(options.signal).toBeInstanceOf(AbortSignal); expect(options.redirect).toBe('error');
    throw new DOMException('Timeout', 'TimeoutError');
  })).rejects.toMatchObject({ status: 503 });
});
it('an unverified contact number never becomes a login or password-reset identity', async () => {
  const user = await User.create({ name: prefix, email: `${prefix}@test.io`, phone: '+19955558888',
    password: 'fixture', role: 'platform_client', isVerified: true }); ids.push(user._id);
  expect(await findIdentity(user.phone)).toBeNull();
  expect((await findIdentity(user.email.toUpperCase()))._id.toString()).toBe(String(user._id));
});
it('daily rollover is idempotent and cannot reopen quota beneath in-flight assignments', async () => {
  const userId = new mongoose.Types.ObjectId(); ids.push(userId);
  const node = await NodeDevice.create({ userId, deviceName: 'quota fixture', region: 'Q',
    bandwidthDay: '2020-01-01', usedBandwidthMB: 100, currentActiveTasks: 1 });
  await refreshDailyBudgets(node._id, new Date('2026-10-09T12:00:00Z'));
  expect((await NodeDevice.findById(node._id)).usedBandwidthMB).toBe(100);
  await NodeDevice.updateOne({ _id: node._id }, { currentActiveTasks: 0 });
  await Promise.all([0, 1, 2].map(() => refreshDailyBudgets(node._id, new Date('2026-10-09T12:00:00Z'))));
  const refreshed = await NodeDevice.findById(node._id);
  expect(refreshed.usedBandwidthMB).toBe(0); expect(refreshed.bandwidthDay).toBe('2026-10-09');
  const policy = trafficPolicyFor(refreshed); expect(policy.dailyLimitBytes).toBe(2048 * 1024 * 1024);
  expect(policy.uploadMbps).toBe(5); expect(policy.downloadMbps).toBe(10);
  expect(() => trafficPolicyFor({ ...refreshed.toObject(), uploadSpeedCapMbps: NaN })).toThrow();
});
