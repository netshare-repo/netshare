import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  dedupKey: { type: String, required: true, unique: true },
  relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedDeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'NodeDevice' },
  relatedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestingTask' },
  alertType: { type: String, required: true },
  severity: { type: String, enum: ['warning', 'high', 'critical'], required: true },
  description: { type: String, required: true },
  evidence: mongoose.Schema.Types.Mixed,
  detector: { type: String, default: 'rules-v1', immutable: true },
  status: { type: String, enum: ['open', 'under_review', 'resolved', 'dismissed'], default: 'open', index: true },
  adminNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });
export default mongoose.model('AnomalyAlert', schema);
