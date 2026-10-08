import mongoose from 'mongoose';
import Wallet from '../models/Wallet.js';
import CreditTransaction from '../models/CreditTransaction.js';
import logger from '../lib/logger.js';
import config from '../config/env.js';

/**
 * Checks if the current MongoDB connection supports transactions (replica set).
 */
const supportsTransactions = () => {
  try {
    const topology = mongoose.connection?.client?.topology;
    if (!topology) return false;
    const description = topology.description || topology.s?.description;
    if (!description) return false;
    return description.type === 'ReplicaSetWithPrimary' || description.type === 'Sharded';
  } catch {
    return false;
  }
};

/**
 * Deduct credits from user wallet with atomic transaction.
 * Creates a CreditTransaction record in the same atomic operation.
 */
export const deductCredits = async ({ userId, taskId = null, amount, description, idempotencyKey = null, session: externalSession = null }) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  if (externalSession) {
    if (idempotencyKey && await CreditTransaction.exists({ userId, idempotencyKey }).session(externalSession)) {
      return Wallet.findOne({ userId }).session(externalSession);
    }
    const wallet = await Wallet.findOne({ userId }).session(externalSession);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amount) throw new Error('Insufficient wallet balance');
    wallet.balance -= amount;
    wallet.spentCredits += amount;
    wallet.withdrawableCredits = Math.max(0, (wallet.withdrawableCredits || 0) - amount);
    await wallet.save({ session: externalSession });
    await CreditTransaction.create([{ userId, taskId, type: 'debit', amount, description,
      status: 'completed', ...(idempotencyKey && { idempotencyKey }) }], { session: externalSession });
    return wallet;
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await CreditTransaction.findOne({ idempotencyKey });
    if (existing) {
      logger.warn({ idempotencyKey, userId }, 'Duplicate debit operation prevented');
      const wallet = await Wallet.findOne({ userId });
      return wallet;
    }
  }

  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let resultWallet;
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Wallet not found');
        if (wallet.balance < amount) throw new Error('Insufficient wallet balance');

        wallet.balance -= amount;
        wallet.spentCredits += amount;
        wallet.withdrawableCredits = Math.max(0, (wallet.withdrawableCredits || 0) - amount);
        await wallet.save({ session });

        await CreditTransaction.create([{
          userId,
          taskId,
          type: 'debit',
          amount,
          description,
          status: 'completed',
          ...(idempotencyKey && { idempotencyKey }),
        }], { session });

        resultWallet = wallet;
      });
      session.endSession();
      return resultWallet;
    } catch (err) {
      session.endSession();
      throw err;
    }
  } else {
    // Fallback: non-transactional (standalone MongoDB)
    if (config.isProduction) {
      logger.error({ userId, amount }, 'CRITICAL: MongoDB transactions unavailable in production — refusing financial operation');
      throw new Error('Financial operations require MongoDB transaction support. Configure a replica set.');
    }
    logger.warn({ userId, amount }, 'MongoDB transactions not available — using non-atomic wallet operation (dev only)');
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amount) throw new Error('Insufficient wallet balance');

    wallet.balance -= amount;
    wallet.spentCredits += amount;
    wallet.withdrawableCredits = Math.max(0, (wallet.withdrawableCredits || 0) - amount);
    await wallet.save();

    await CreditTransaction.create({
      userId,
      taskId,
      type: 'debit',
      amount,
      description,
      status: 'completed',
      ...(idempotencyKey && { idempotencyKey }),
    });

    return wallet;
  }
};

/**
 * Add credits to user wallet with atomic transaction.
 */
export const addCredits = async ({ userId, taskId = null, amount, description, idempotencyKey = null, withdrawable = false, session: externalSession = null }) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  if (externalSession) {
    if (idempotencyKey && await CreditTransaction.exists({ userId, idempotencyKey }).session(externalSession)) {
      return Wallet.findOne({ userId }).session(externalSession);
    }
    const wallet = await Wallet.findOne({ userId }).session(externalSession);
    if (!wallet) throw new Error('Wallet not found');
    wallet.balance += amount;
    wallet.earnedCredits += amount;
    if (withdrawable) wallet.withdrawableCredits = (wallet.withdrawableCredits || 0) + amount;
    await wallet.save({ session: externalSession });
    await CreditTransaction.create([{ userId, taskId, type: 'credit', amount, description,
      status: 'completed', ...(idempotencyKey && { idempotencyKey }) }], { session: externalSession });
    return wallet;
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await CreditTransaction.findOne({ idempotencyKey });
    if (existing) {
      logger.warn({ idempotencyKey, userId }, 'Duplicate credit operation prevented');
      const wallet = await Wallet.findOne({ userId });
      return wallet;
    }
  }

  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let resultWallet;
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Wallet not found');

        wallet.balance += amount;
        wallet.earnedCredits += amount;
        if (withdrawable) wallet.withdrawableCredits = (wallet.withdrawableCredits || 0) + amount;
        await wallet.save({ session });

        await CreditTransaction.create([{
          userId,
          taskId,
          type: 'credit',
          amount,
          description,
          status: 'completed',
          ...(idempotencyKey && { idempotencyKey }),
        }], { session });

        resultWallet = wallet;
      });
      session.endSession();
      return resultWallet;
    } catch (err) {
      session.endSession();
      throw err;
    }
  } else {
    if (config.isProduction) {
      logger.error({ userId, amount }, 'CRITICAL: MongoDB transactions unavailable in production — refusing financial operation');
      throw new Error('Financial operations require MongoDB transaction support. Configure a replica set.');
    }
    logger.warn({ userId, amount }, 'MongoDB transactions not available — using non-atomic wallet operation (dev only)');
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found');

    wallet.balance += amount;
    wallet.earnedCredits += amount;
    if (withdrawable) wallet.withdrawableCredits = (wallet.withdrawableCredits || 0) + amount;
    await wallet.save();

    await CreditTransaction.create({
      userId,
      taskId,
      type: 'credit',
      amount,
      description,
      status: 'completed',
      ...(idempotencyKey && { idempotencyKey }),
    });

    return wallet;
  }
};

export default { deductCredits, addCredits };
