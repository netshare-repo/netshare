import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventKey: { type: String, required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  relatedType: String,
  relatedId: mongoose.Schema.Types.ObjectId,
  status: { type: String, enum: ['unread', 'read'], default: 'unread' },
  readAt: Date,
}, { timestamps: true });
schema.index({ userId: 1, eventKey: 1 }, { unique: true });
schema.index({ userId: 1, status: 1, createdAt: -1 });
export default mongoose.model('Notification', schema);
