import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import TopUpRequest from "../models/TopUpRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import CreditTransaction from "../models/CreditTransaction.js";
import AdminLog from "../models/AdminLog.js";
import generateToken from "../utils/generateToken.js";

let client;
let other;
let node;
let admin;
let noWallet;
let tokens;
const pngProof = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64");
let referenceCounter = 0;
const topUp = (reference = `PHASE5REF${++referenceCounter}`) => ({
  amount: 120, paymentMethod: "easypaisa", referenceNumber: reference,
  proofMime: "image/png", proofBase64: pngProof,
});
const auth = (user) => ({ Authorization: `Bearer ${tokens[user]}` });

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await User.deleteMany({ email: { $regex: /^test_phase5_/ } });
  [client, other, node, admin, noWallet] = await User.create([
    { name: "Phase5 Client", email: "test_phase5_client@test.io", password: "hashed-password", role: "platform_client", isVerified: true },
    { name: "Phase5 Other", email: "test_phase5_other@test.io", password: "hashed-password", role: "platform_client", isVerified: true },
    { name: "Phase5 Node", email: "test_phase5_node@test.io", password: "hashed-password", role: "node_participant", isVerified: true },
    { name: "Phase5 Admin", email: "test_phase5_admin@test.io", password: "hashed-password", role: "admin", isVerified: true },
    { name: "Phase5 No Wallet", email: "test_phase5_no_wallet@test.io", password: "hashed-password", role: "platform_client", isVerified: true },
  ]);
  tokens = Object.fromEntries(Object.entries({ client, other, node, admin, noWallet })
    .map(([key, user]) => [key, generateToken(user._id)]));
  await Wallet.create([
    { userId: client._id, balance: 500, earnedCredits: 0, spentCredits: 0 },
    { userId: other._id, balance: 500, earnedCredits: 0, spentCredits: 0 },
    { userId: node._id, balance: 600, earnedCredits: 400, withdrawableCredits: 400, spentCredits: 0 },
    { userId: admin._id, balance: 0, earnedCredits: 0, spentCredits: 0 },
  ]);
  await TopUpRequest.init();
  await WithdrawalRequest.init();
  await CreditTransaction.init();
});

afterAll(async () => {
  const userIds = [client, other, node, admin, noWallet].filter(Boolean).map((user) => user._id);
  const topUpIds = (await TopUpRequest.find({ userId: { $in: userIds } })).map((item) => item._id);
  const withdrawalIds = (await WithdrawalRequest.find({ userId: { $in: userIds } })).map((item) => item._id);
  await AdminLog.deleteMany({ targetId: { $in: [...topUpIds, ...withdrawalIds] } });
  await CreditTransaction.deleteMany({ userId: { $in: userIds } });
  await TopUpRequest.deleteMany({ userId: { $in: userIds } });
  await WithdrawalRequest.deleteMany({ userId: { $in: userIds } });
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
});

describe("Phase 5 manual payments", () => {
  it("submits a top-up with proof, remains pending, and lists only the owner's history", async () => {
    const response = await request(app).post("/api/wallet/top-ups").set(auth("client")).send(topUp());
    expect(response.status).toBe(201);
    expect(response.body.request.status).toBe("pending");
    expect(response.body.request.proofData).toBeUndefined();
    expect((await Wallet.findOne({ userId: client._id })).balance).toBe(500);
    const mine = await request(app).get("/api/wallet/top-ups").set(auth("client"));
    const theirs = await request(app).get("/api/wallet/top-ups").set(auth("other"));
    expect(mine.body.requests.some((item) => item._id === response.body.request._id)).toBe(true);
    expect(theirs.body.requests.some((item) => item._id === response.body.request._id)).toBe(false);
    expect((await request(app).get(`/api/admin/payments/top-ups/${response.body.request._id}/proof`).set(auth("client"))).status).toBe(403);
    const proof = await request(app).get(`/api/admin/payments/top-ups/${response.body.request._id}/proof`).set(auth("admin"));
    expect(proof.status).toBe(200);
    expect(proof.headers["content-type"]).toContain("image/png");
  });

  it("rejects duplicate references and malformed or oversized proof", async () => {
    const reference = `PHASE5REF${++referenceCounter}`;
    expect((await request(app).post("/api/wallet/top-ups").set(auth("client")).send(topUp(reference))).status).toBe(201);
    expect((await request(app).post("/api/wallet/top-ups").set(auth("other"))
      .send({ ...topUp(reference.toLowerCase()), paymentMethod: "jazzcash" })).status).toBe(409);
    expect((await request(app).post("/api/wallet/top-ups").set(auth("client"))
      .send({ ...topUp(), proofMime: "application/pdf" })).status).toBe(400);
    expect((await request(app).post("/api/wallet/top-ups").set(auth("client"))
      .send({ ...topUp(), proofBase64: "A".repeat(2_800_000) })).status).toBe(400);
  });

  it("approves once under concurrent admin requests and records one ledger and audit entry", async () => {
    const created = await request(app).post("/api/wallet/top-ups").set(auth("client")).send(topUp());
    const id = created.body.request._id;
    expect((await request(app).post(`/api/admin/payments/top-ups/${id}/approve`).set(auth("client")).send({})).status).toBe(403);
    const responses = await Promise.all([
      request(app).post(`/api/admin/payments/top-ups/${id}/approve`).set(auth("admin")).send({ adminNote: "Verified manually" }),
      request(app).post(`/api/admin/payments/top-ups/${id}/approve`).set(auth("admin")).send({ adminNote: "Verified manually" }),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([200, 409]);
    expect((await Wallet.findOne({ userId: client._id })).balance).toBe(620);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `topup:${id}` })).toBe(1);
    expect(await AdminLog.countDocuments({ targetId: id, action: "TOPUP_APPROVED" })).toBe(1);
    expect((await TopUpRequest.findById(id)).status).toBe("approved");
  });

  it("rejects a top-up without crediting, and rolls back approval when wallet is missing", async () => {
    const rejected = await request(app).post("/api/wallet/top-ups").set(auth("client")).send(topUp());
    const id = rejected.body.request._id;
    expect((await request(app).post(`/api/admin/payments/top-ups/${id}/reject`).set(auth("admin"))
      .send({ adminNote: "Reference not found" })).status).toBe(200);
    expect((await request(app).post(`/api/admin/payments/top-ups/${id}/approve`).set(auth("admin")).send({})).status).toBe(409);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `topup:${id}` })).toBe(0);
    const noWalletRequest = await request(app).post("/api/wallet/top-ups").set(auth("noWallet")).send(topUp());
    const missingId = noWalletRequest.body.request._id;
    expect((await request(app).post(`/api/admin/payments/top-ups/${missingId}/approve`).set(auth("admin")).send({})).status).toBe(404);
    expect((await TopUpRequest.findById(missingId)).status).toBe("pending");
    expect(await AdminLog.countDocuments({ targetId: missingId })).toBe(0);
  });

  it("blocks client withdrawal and insufficient eligible balance without creating a request", async () => {
    expect((await request(app).post("/api/wallet/withdrawals").set(auth("client"))
      .send({ amount: 10, method: "easypaisa", accountDetails: "03001234567" })).status).toBe(403);
    const response = await request(app).post("/api/wallet/withdrawals").set(auth("node"))
      .send({ amount: 401, method: "easypaisa", accountDetails: "03001234567" });
    expect(response.status).toBe(409);
    expect(await WithdrawalRequest.countDocuments({ userId: node._id })).toBe(0);
    expect((await Wallet.findOne({ userId: node._id })).balance).toBe(600);
  });

  it("reserves credits atomically, enforces owner history, and refunds rejection once", async () => {
    const created = await request(app).post("/api/wallet/withdrawals").set(auth("node"))
      .send({ amount: 100, method: "bank_transfer", accountDetails: "Account 12345" });
    expect(created.status).toBe(201);
    const id = created.body.request._id;
    expect((await Wallet.findOne({ userId: node._id })).balance).toBe(500);
    expect((await Wallet.findOne({ userId: node._id })).withdrawableCredits).toBe(300);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `withdrawal:reserve:${id}` })).toBe(1);
    expect((await request(app).get("/api/wallet/withdrawals").set(auth("other"))).body.requests).toHaveLength(0);
    expect((await request(app).post(`/api/admin/payments/withdrawals/${id}/reject`).set(auth("node"))
      .send({ adminNote: "Invalid account" })).status).toBe(403);
    const responses = await Promise.all([
      request(app).post(`/api/admin/payments/withdrawals/${id}/reject`).set(auth("admin")).send({ adminNote: "Invalid account" }),
      request(app).post(`/api/admin/payments/withdrawals/${id}/reject`).set(auth("admin")).send({ adminNote: "Invalid account" }),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([200, 409]);
    expect((await Wallet.findOne({ userId: node._id })).balance).toBe(600);
    expect((await Wallet.findOne({ userId: node._id })).withdrawableCredits).toBe(400);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `withdrawal:refund:${id}` })).toBe(1);
    expect(await AdminLog.countDocuments({ targetId: id, action: "WITHDRAWAL_REJECTED" })).toBe(1);
  });

  it("approves then processes a withdrawal once without a second debit", async () => {
    const created = await request(app).post("/api/wallet/withdrawals").set(auth("node"))
      .send({ amount: 75, method: "jazzcash", accountDetails: "03007654321" });
    const id = created.body.request._id;
    expect((await request(app).post(`/api/admin/payments/withdrawals/${id}/process`).set(auth("admin"))
      .send({ adminNote: "Paid externally" })).status).toBe(409);
    expect((await request(app).post(`/api/admin/payments/withdrawals/${id}/approve`).set(auth("admin"))
      .send({ adminNote: "Account checked" })).status).toBe(200);
    const responses = await Promise.all([
      request(app).post(`/api/admin/payments/withdrawals/${id}/process`).set(auth("admin")).send({ adminNote: "Payout reference 123" }),
      request(app).post(`/api/admin/payments/withdrawals/${id}/process`).set(auth("admin")).send({ adminNote: "Payout reference 123" }),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([200, 409]);
    expect((await WithdrawalRequest.findById(id)).status).toBe("processed");
    expect((await Wallet.findOne({ userId: node._id })).balance).toBe(525);
    expect((await Wallet.findOne({ userId: node._id })).withdrawableCredits).toBe(325);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `withdrawal:reserve:${id}` })).toBe(1);
    expect(await AdminLog.countDocuments({ targetId: id, action: "WITHDRAWAL_PROCESSED" })).toBe(1);
  });

  it("prevents concurrent withdrawal requests from overspending eligible credits", async () => {
    const body = { amount: 250, method: "easypaisa", accountDetails: "03001234567" };
    const responses = await Promise.all([
      request(app).post("/api/wallet/withdrawals").set(auth("node")).send(body),
      request(app).post("/api/wallet/withdrawals").set(auth("node")).send(body),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
    const acceptedId = responses.find((item) => item.status === 201).body.request._id;
    const wallet = await Wallet.findOne({ userId: node._id });
    expect(wallet.balance).toBe(275);
    expect(wallet.spentCredits).toBe(0);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: `withdrawal:reserve:${acceptedId}` })).toBe(1);
  });

  it("does not make manually topped-up credits eligible for withdrawal", async () => {
    const created = await request(app).post("/api/wallet/top-ups").set(auth("node")).send(topUp());
    const id = created.body.request._id;
    expect((await request(app).post(`/api/admin/payments/top-ups/${id}/approve`).set(auth("admin"))
      .send({ adminNote: "Verified" })).status).toBe(200);
    const wallet = await Wallet.findOne({ userId: node._id });
    expect(wallet.balance).toBe(395); // balance after the earlier 250-credit withdrawal reservation
    expect(wallet.withdrawableCredits).toBe(75);
  });
});
