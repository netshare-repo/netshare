import CreditTransaction from '../models/CreditTransaction.js';

const idempotencyFilter = { idempotencyKey: { $type: 'string' } };

const isCurrentIdempotencyIndex = index =>
  index?.unique === true &&
  index?.sparse !== true &&
  index?.partialFilterExpression?.idempotencyKey?.$type === 'string';

const listIndexesOrEmpty = async collection => {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
};

export const ensureFinancialIndexes = async () => {
  const collection = CreditTransaction.collection;
  const duplicates = await collection.aggregate([
    { $match: idempotencyFilter },
    { $group: { _id: '$idempotencyKey', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ]).toArray();

  if (duplicates.length) {
    const error = new Error(
      `Credit transaction index migration blocked: ${duplicates.length} duplicate idempotency key group(s). Resolve them before restart.`
    );
    error.code = 'FINANCIAL_INDEX_CONFLICT';
    error.details = duplicates.map(group => ({
      keyPrefix: String(group._id).split(':', 1)[0],
      count: group.count,
    }));
    throw error;
  }

  const indexes = await listIndexesOrEmpty(collection);
  const existing = indexes.find(index => index.name === 'idempotencyKey_1');
  if (existing && !isCurrentIdempotencyIndex(existing)) {
    // Startup has not accepted traffic yet and duplicate keys were ruled out.
    await collection.dropIndex(existing.name);
  }
  await collection.createIndex(
    { idempotencyKey: 1 },
    {
      name: 'idempotencyKey_1',
      unique: true,
      partialFilterExpression: idempotencyFilter,
    }
  );
};
