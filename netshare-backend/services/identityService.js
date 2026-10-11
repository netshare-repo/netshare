import User from '../models/User.js';
export const normalizePhone = value => {
  if (typeof value !== 'string') return '';
  const phone = value.replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
};
// Only the verified channel is an authentication identity; contact numbers
// attached to email accounts must never become password-reset credentials.
export const findIdentity = value => {
  if (typeof value !== 'string' || !value.trim()) return Promise.resolve(null);
  return value.includes('@') ? User.findOne({ email: value.trim().toLowerCase() })
    : (normalizePhone(value) ? User.findOne({ phone: normalizePhone(value), verificationMethod: 'sms' }) : Promise.resolve(null));
};

const emailIdentityFilter = { email: { $type: 'string', $gt: '' } };
const phoneIdentityFilter = {
  verificationMethod: 'sms',
  phone: { $type: 'string', $gt: '' },
};

const samePhoneFilter = index => {
  const filter = index?.partialFilterExpression;
  return filter?.verificationMethod === 'sms' &&
    filter?.phone?.$type === 'string' && filter?.phone?.$gt === '';
};

const listIndexesOrEmpty = async collection => {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
};

export const ensureIdentityIndexes = async () => {
  const collection = User.collection;

  // Never guess which account owns a conflicting SMS login identity. Stop with
  // a concise, actionable error and leave every user record untouched.
  const [duplicateSmsPhones, invalidSmsPhones] = await Promise.all([
    collection.aggregate([
      { $match: phoneIdentityFilter },
      { $group: { _id: '$phone', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ]).toArray(),
    collection.find({
      verificationMethod: 'sms',
      $or: [
        { phone: { $not: /^\+[1-9]\d{7,14}$/ } },
        { phone: { $exists: false } },
      ],
    }, { projection: { _id: 1 } }).limit(20).toArray(),
  ]);
  if (duplicateSmsPhones.length || invalidSmsPhones.length) {
    const error = new Error(
      `SMS identity index migration blocked: ${duplicateSmsPhones.length} duplicate phone group(s), ` +
      `${invalidSmsPhones.length} invalid SMS account(s). Resolve the reported user IDs before restart.`
    );
    error.code = 'IDENTITY_INDEX_CONFLICT';
    error.details = {
      duplicateSmsPhones: duplicateSmsPhones.map(group => ({
        phoneSuffix: String(group._id).slice(-4),
        count: group.count,
      })),
      invalidSmsUserIds: invalidSmsPhones.map(user => String(user._id)),
    };
    throw error;
  }

  let indexes = await listIndexesOrEmpty(collection);
  const existingPhone = indexes.find(index => index.name === 'identity_phone_unique');
  if (existingPhone && !samePhoneFilter(existingPhone)) {
    // The old index covered ordinary email-account contact numbers. Startup is
    // not accepting traffic yet, so replace it only after the SMS preflight.
    await collection.dropIndex(existingPhone.name);
  }

  await collection.createIndex(
    { email: 1 },
    { name: 'identity_email_unique', unique: true, partialFilterExpression: emailIdentityFilter }
  );
  await collection.createIndex(
    { phone: 1 },
    { name: 'identity_phone_unique', unique: true, partialFilterExpression: phoneIdentityFilter }
  );

  // Build replacement uniqueness protection before removing the old non-sparse
  // email index, which permits only one phone-only account (missing email).
  indexes = await listIndexesOrEmpty(collection);
  if (indexes.some(i => i.name === 'identity_email_unique') && indexes.some(i => i.name === 'email_1' && i.unique)) {
    await collection.dropIndex('email_1');
  }
};
