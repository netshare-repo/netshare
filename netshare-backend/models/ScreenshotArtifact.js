import mongoose from 'mongoose';

const storedObjectStatuses = ['pending', 'uploading', 'stored', 'registered'];

const screenshotArtifactSchema = new mongoose.Schema({
  artifactId: { type: String, required: true, unique: true, index: true, match: /^[a-f0-9]{32}$/ },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestingTask', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NodeDevice', required: true, index: true },
  routingSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoutingSession', required: true, index: true },
  taskResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskResult', default: null, index: true },
  contentType: { type: String, required: true, enum: ['image/png'] },
  sizeBytes: { type: Number, required: true, min: 1, max: 2 * 1024 * 1024 },
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  width: { type: Number, min: 1, max: 3840, default: null },
  height: { type: Number, min: 1, max: 4320, default: null },
  storageProvider: { type: String, required: true, maxlength: 40 },
  storageKey: {
    type: String,
    default: null,
    select: false,
    maxlength: 100,
    required() { return storedObjectStatuses.includes(this.status); },
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'uploading', 'stored', 'registered', 'failed', 'expired', 'deleted'],
    default: 'pending',
    index: true,
  },
  uploadGrantHash: {
    type: String,
    default: null,
    select: false,
    match: /^[a-f0-9]{64}$/,
    required() { return ['pending', 'uploading'].includes(this.status); },
  },
  uploadGrantExpiresAt: { type: Date, required: true, index: true },
  uploadStartedAt: { type: Date, default: null },
  uploadedAt: { type: Date, default: null },
  registeredAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
  deletedAt: { type: Date, default: null },
  deletionReason: { type: String, default: null, maxlength: 80 },
}, { timestamps: true, collection: 'screenshot_artifacts' });

screenshotArtifactSchema.index(
  { taskId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'uploading', 'stored', 'registered'] } } },
);
screenshotArtifactSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model('ScreenshotArtifact', screenshotArtifactSchema);
