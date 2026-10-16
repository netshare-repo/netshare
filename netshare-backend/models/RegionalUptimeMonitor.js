import mongoose from 'mongoose';

const regionalUptimeMonitorSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientRequestKey: { type: String, maxlength: 100, default: undefined },
  requestHash: { type: String, match: /^[a-f0-9]{64}$/, default: undefined },
  targetUrl: { type: String, required: true, maxlength: 2048 },
  targetRegion: { type: String, required: true, trim: true, maxlength: 80 },
  expectedStatusCode: { type: Number, required: true, min: 100, max: 599 },
  intervalMinutes: { type: Number, required: true, min: 5, max: 1440 },
  maxRuns: { type: Number, required: true, min: 1, max: 500 },
  scheduledRuns: { type: Number, default: 0, min: 0 },
  inFlightRuns: { type: Number, default: 0, min: 0, max: 1 },
  completedRuns: { type: Number, default: 0, min: 0 },
  failedRuns: { type: Number, default: 0, min: 0 },
  perRunCredits: { type: Number, required: true, min: 1 },
  creditBudget: { type: Number, required: true, min: 1 },
  availableCredits: { type: Number, required: true, min: 0 },
  inFlightCredits: { type: Number, default: 0, min: 0 },
  spentCredits: { type: Number, default: 0, min: 0 },
  refundedCredits: { type: Number, default: 0, min: 0 },
  pricingSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['active', 'completed', 'budget_exhausted', 'cancelled'], default: 'active', index: true },
  nextRunAt: { type: Date, default: null, index: true },
  lastRunAt: { type: Date, default: null },
  terminalAt: { type: Date, default: null },
}, { timestamps: true });

regionalUptimeMonitorSchema.index({ status: 1, nextRunAt: 1 });
regionalUptimeMonitorSchema.index({ clientId: 1, createdAt: -1 });
regionalUptimeMonitorSchema.index({ clientId: 1, clientRequestKey: 1 }, {
  unique: true,
  partialFilterExpression: { clientRequestKey: { $type: 'string' } },
});

export default mongoose.model('RegionalUptimeMonitor', regionalUptimeMonitorSchema);
