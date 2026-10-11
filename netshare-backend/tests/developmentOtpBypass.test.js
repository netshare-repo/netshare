import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import authRoutes from '../routes/authRoutes.js';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
const prefix = `dev_otp_bypass_${Date.now()}`;
const password = 'LocalPass123';
const signup = (suffix, role = 'platform_client') => ({
  name: prefix,
  email: `${prefix}_${suffix}@test.io`,
  password,
  role,
  verificationMethod: 'email',
});

beforeAll(async () => { await mongoose.connect(process.env.MONGO_URI); });
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => {
  const users = await User.find({ name: prefix }).select('_id');
  await Wallet.deleteMany({ userId: { $in: users.map(user => user._id) } });
  await User.deleteMany({ _id: { $in: users.map(user => user._id) } });
  await mongoose.disconnect();
});

const enableBypass = () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DEV_SKIP_OTP_VERIFICATION', 'true');
};

it('locally registers without OTP, creates one wallet, and returns a usable token', async () => {
  enableBypass();
  const body = signup('new');
  const response = await request(app).post('/auth/register').send(body);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ verificationRequired: false, user: { email: body.email } });
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.devOtp).toBeUndefined();
  expect((await request(app).post('/auth/verify-signup-otp')
    .send({ email: body.email, otp: '123456' })).body.message).toContain('Sign in');
  expect((await request(app).post('/auth/resend-signup-otp')
    .send({ email: body.email })).body.message).toContain('Sign in');
  const user = await User.findOne({ email: body.email });
  expect(user.isVerified).toBe(true);
  expect(user.signupOtpHash).toBeNull();
  expect(await Wallet.countDocuments({ userId: user._id })).toBe(1);
  expect((await Wallet.findOne({ userId: user._id })).balance).toBe(500);
  expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${response.body.token}`)).status).toBe(200);
});

it('finishes an existing unverified account only after the right password, without duplicate wallet credit', async () => {
  enableBypass();
  const body = signup('existing');
  const user = await User.create({ ...body, password: await bcrypt.hash(password, 10), isVerified: false });
  expect((await request(app).post('/auth/login').send({ email: body.email, password: 'WrongPass123' })).status).toBe(401);
  expect((await User.findById(user._id)).isVerified).toBe(false);
  expect(await Wallet.countDocuments({ userId: user._id })).toBe(0);
  const duplicate = await request(app).post('/auth/register').send(body);
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.message).toContain('Sign in');
  const responses = await Promise.all([0, 1].map(() => request(app).post('/auth/login')
    .send({ email: body.email, password })));
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect((await User.findById(user._id)).isVerified).toBe(true);
  expect(await Wallet.countDocuments({ userId: user._id })).toBe(1);
  expect((await Wallet.findOne({ userId: user._id })).balance).toBe(500);
});

it('never bypasses OTP in production or when the flag is disabled', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DEV_SKIP_OTP_VERIFICATION', 'true');
  const body = signup('production');
  const response = await request(app).post('/auth/register').send(body);
  expect(response.status).toBe(201);
  expect(response.body.token).toBeUndefined();
  expect((await User.findOne({ email: body.email })).isVerified).toBe(false);

  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DEV_SKIP_OTP_VERIFICATION', 'false');
  const normal = await request(app).post('/auth/register').send(signup('disabled'));
  expect(normal.status).toBe(201);
  expect(normal.body.token).toBeUndefined();
  expect((await User.findOne({ email: signup('disabled').email })).isVerified).toBe(false);
});
