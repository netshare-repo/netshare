import mongoose from 'mongoose';

const regionalUptimeRunSchema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegionalUptimeMonitor', required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestingTask', required: true, unique: true },
  region: { type: String, required: true, maxlength: 80 },
  expectedStatusCode: { type: Number, required: true, min: 100, max: 599 },
  costCredits: { type: Number, required: true, min: 1 },
  scheduledAt: { type: Date, required: true },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
  httpStatus: { type: Number, min: 0, max: 599, default: null },
  responseLatencyMs: { type: Number, min: 0, max: 300000, default: null },
  availabilitySuccess: { type: Boolean, default: null },
  errorReason: { type: String, maxlength: 1000, default: null },
  nodeRegion: { type: String, maxlength: 80, default: null },
}, { timestamps: true });

regionalUptimeRunSchema.index({ monitorId: 1, sequence: 1 }, { unique: true });
regionalUptimeRunSchema.index({ monitorId: 1, scheduledAt: -1 });

export default mongoose.model('RegionalUptimeRun', regionalUptimeRunSchema);
