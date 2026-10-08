import mongoose from "mongoose";
import { Buffer } from "node:buffer";
import Wallet from "../models/Wallet.js";
import CreditTransaction from "../models/CreditTransaction.js";
import TopUpRequest from "../models/TopUpRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import AdminLog from "../models/AdminLog.js";
import { statusNotification } from './notificationService.js';

const methods = new Set(["bank_transfer", "easypaisa", "jazzcash"]);
const MAX_PROOF_BYTES = 2 * 1024 * 1024;
const paymentError = (status, message) => Object.assign(new Error(message), { status });

export const eligibleWithdrawalBalance = (wallet) => Math.max(0,
  Math.min(wallet?.balance || 0, wallet?.withdrawableCredits || 0));

const validAmount = (amount) => Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000;

export const validateProof = (mime, encoded) => {
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > Math.ceil(MAX_PROOF_BYTES * 4 / 3) + 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw paymentError(400, "Payment proof must be a file of at most 2 MB");
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.length || data.length > MAX_PROOF_BYTES || data.toString("base64") !== encoded) {
    throw paymentError(400, "Invalid payment proof encoding or size");
  }
  const isPng = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPdf = data.subarray(0, 5).toString("ascii") === "%PDF-";
  if (!((mime === "image/png" && isPng) || (mime === "image/jpeg" && isJpeg) ||
      (mime === "application/pdf" && isPdf))) {
    throw paymentError(400, "Payment proof must be a PNG, JPEG, or PDF matching its file type");
  }
  return data;
};

export const createTopUp = async (userId, input) => {
  const { amount, paymentMethod, referenceNumber, proofMime, proofBase64 } = input || {};
  if (!validAmount(amount) || !methods.has(paymentMethod)) throw paymentError(400, "Invalid amount or payment method");
  const reference = typeof referenceNumber === "string" ? referenceNumber.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_\/-]{5,63}$/.test(reference)) throw paymentError(400, "Invalid payment reference");
  const proofData = validateProof(proofMime, proofBase64);
  try {
    return await TopUpRequest.create({
      userId, amount, paymentMethod, referenceNumber: reference,
      referenceKey: reference.toUpperCase(), proofMime, proofSize: proofData.length, proofData,
    });
  } catch (error) {
    if (error.code === 11000) throw paymentError(409, "Payment reference already submitted");
    throw error;
  }
};

const transactionsAvailable = () => {
  const type = mongoose.connection?.client?.topology?.description?.type;
  return type === "ReplicaSetWithPrimary" || type === "Sharded";
};

const withFinancialTransaction = async (operation) => {
  if (!transactionsAvailable()) throw paymentError(503, "Financial actions require a MongoDB replica set");
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await operation(session); }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    return result;
  } catch (error) {
    if (error.code === 11000 || error.code === 112 || error.hasErrorLabel?.("TransientTransactionError")) {
      throw paymentError(409, "Payment state changed; refresh and retry");
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

const adminNote = (value, required = false) => {
  const note = typeof value === "string" ? value.trim() : "";
  if (note.length > 500 || (required && note.length < 3)) throw paymentError(400, "Valid admin note is required");
  return note;
};

const audit = async (session, adminId, action, targetId, details) => {
  await AdminLog.create([{ adminId, action, targetType: "wallet", targetId, details }], { session });
};

export const reviewTopUp = (id, adminId, decision, noteInput) => withFinancialTransaction(async (session) => {
  if (!mongoose.isValidObjectId(id)) throw paymentError(400, "Invalid top-up ID");
  if (!new Set(["approved", "rejected"]).has(decision)) throw paymentError(400, "Invalid decision");
  const note = adminNote(noteInput, decision === "rejected");
  const request = await TopUpRequest.findById(id).session(session);
  if (!request) throw paymentError(404, "Top-up request not found");
  if (request.status !== "pending") throw paymentError(409, "Top-up already reviewed");

  if (decision === "approved") {
    const wallet = await Wallet.findOneAndUpdate({ userId: request.userId },
      { $inc: { balance: request.amount } }, { new: true, session });
    if (!wallet) throw paymentError(404, "Wallet not found");
    await CreditTransaction.create([{
      userId: request.userId, type: "credit", amount: request.amount,
      description: `Verified top-up ${request._id}`, status: "completed",
      idempotencyKey: `topup:${request._id}`,
    }], { session });
  }
  request.status = decision;
  request.adminNote = note;
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  await request.save({ session });
  await audit(session, adminId, `TOPUP_${decision.toUpperCase()}`, request._id,
    `Top-up ${request._id} ${decision}; ${note}`);
  await statusNotification('topup', request, session);
  return request;
});

export const createWithdrawal = (userId, input) => withFinancialTransaction(async (session) => {
  const { amount, method, accountDetails } = input || {};
  if (!validAmount(amount) || !methods.has(method)) throw paymentError(400, "Invalid amount or withdrawal method");
  const account = typeof accountDetails === "string" ? accountDetails.trim() : "";
  if (account.length < 5 || account.length > 120 || /[\r\n<>]/.test(account)) {
    throw paymentError(400, "Valid withdrawal account details are required");
  }
  // Reserve only net earned credits. Demo/top-up credits cannot be cashed out.
  const wallet = await Wallet.findOneAndUpdate({
    userId, balance: { $gte: amount }, withdrawableCredits: { $gte: amount },
  }, { $inc: { balance: -amount, withdrawableCredits: -amount } }, { new: true, session });
  if (!wallet) throw paymentError(409, "Insufficient eligible withdrawal balance");

  const request = new WithdrawalRequest({ userId, amount, method, accountDetails: account });
  await request.save({ session });
  await CreditTransaction.create([{
    userId, type: "debit", amount, description: `Withdrawal reserved ${request._id}`,
    status: "completed", idempotencyKey: `withdrawal:reserve:${request._id}`,
  }], { session });
  await statusNotification('withdrawal', request, session);
  return request;
});

export const reviewWithdrawal = (id, adminId, decision, noteInput) => withFinancialTransaction(async (session) => {
  if (!mongoose.isValidObjectId(id)) throw paymentError(400, "Invalid withdrawal ID");
  if (!new Set(["approved", "rejected", "processed"]).has(decision)) throw paymentError(400, "Invalid decision");
  const note = adminNote(noteInput, decision === "rejected" || decision === "processed");
  const request = await WithdrawalRequest.findById(id).session(session);
  if (!request) throw paymentError(404, "Withdrawal request not found");
  if (decision === "processed" && request.status !== "approved") throw paymentError(409, "Withdrawal must be approved before processing");
  if (decision !== "processed" && !["pending", "approved"].includes(request.status)) {
    throw paymentError(409, "Withdrawal already finalized");
  }
  if (decision === "approved" && request.status !== "pending") throw paymentError(409, "Withdrawal already reviewed");

  if (decision === "rejected") {
    const wallet = await Wallet.findOneAndUpdate({ userId: request.userId },
      { $inc: { balance: request.amount, withdrawableCredits: request.amount } }, { new: true, session });
    if (!wallet) throw paymentError(409, "Withdrawal refund cannot be applied safely");
    await CreditTransaction.create([{
      userId: request.userId, type: "credit", amount: request.amount,
      description: `Rejected withdrawal refund ${request._id}`, status: "completed",
      idempotencyKey: `withdrawal:refund:${request._id}`,
    }], { session });
  }

  request.status = decision;
  request.adminNote = note;
  if (decision === "processed") {
    request.processedBy = adminId;
    request.processedAt = new Date();
  } else {
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
  }
  await request.save({ session });
  await audit(session, adminId, `WITHDRAWAL_${decision.toUpperCase()}`, request._id,
    `Withdrawal ${request._id} ${decision}; ${note}`);
  await statusNotification('withdrawal', request, session);
  return request;
});
