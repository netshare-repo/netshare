import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  relatedType: { type: String, enum: ['task', 'order', 'topup', 'withdrawal'], required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  description: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['open', 'under_review', 'resolved', 'dismissed'], default: 'open', index: true },
  adminNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  history: [{ _id: false, status: String, note: String, adminId: mongoose.Schema.Types.ObjectId, at: Date }],
}, { timestamps: true });
schema.index({ userId: 1, relatedType: 1, relatedId: 1 }, { unique: true });
export default mongoose.model('Dispute', schema);
