import mongoose from 'mongoose';

export const supportsMongoTransactions = () =>
  ['ReplicaSetWithPrimary', 'Sharded'].includes(
    mongoose.connection?.client?.topology?.description?.type
  );

// Review state, audit, and notifications must commit together; never silently degrade.
export const runTransaction = async (operation) => {
  if (!supportsMongoTransactions()) {
    throw Object.assign(new Error('This operation requires a MongoDB replica set'), { status: 503 });
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await operation(session); }, {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
    });
    return result;
  } catch (error) {
    if (error.code === 11000 || error.code === 112) {
      throw Object.assign(new Error('State changed; refresh and retry'), { status: 409 });
    }
    throw error;
  } finally { await session.endSession(); }
};
