import {
  createScreenshotUploadGrant,
  readScreenshotArtifact,
  storeScreenshotUpload,
} from '../services/screenshotArtifactService.js';

const grantFields = new Set(['nodeId', 'routingSessionId', 'contentType', 'sizeBytes', 'sha256']);
const invalidGrantRequest = () => Object.assign(new Error('Unexpected screenshot upload authorization fields'), {
  status: 400,
  statusCode: 400,
  code: 'INVALID_UPLOAD_GRANT_REQUEST',
  isOperational: true,
});

export const authorizeScreenshotUpload = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).some(key => !grantFields.has(key))) throw invalidGrantRequest();
    const grant = await createScreenshotUploadGrant({
      taskId: req.params.id,
      nodeId: req.body?.nodeId,
      routingSessionId: req.body?.routingSessionId,
      userId: req.user._id,
      contentType: req.body?.contentType,
      sizeBytes: req.body?.sizeBytes,
      sha256: req.body?.sha256,
    });
    return res.status(201).json(grant);
  } catch (error) { return next(error); }
};

export const uploadScreenshotArtifact = async (req, res, next) => {
  try {
    const reference = await storeScreenshotUpload({
      taskId: req.params.id,
      artifactId: req.params.artifactId,
      userId: req.user._id,
      grantToken: req.get('X-NetShare-Artifact-Grant'),
      contentType: req.get('Content-Type')?.split(';', 1)[0]?.toLowerCase(),
      bytes: req.body,
    });
    return res.status(201).json({ artifact: reference });
  } catch (error) { return next(error); }
};

export const downloadScreenshotArtifact = async (req, res, next) => {
  try {
    const artifact = await readScreenshotArtifact({
      taskId: req.params.id,
      artifactId: req.params.artifactId,
      userId: req.user._id,
    });
    res.set({
      'Content-Type': artifact.contentType,
      'Content-Length': String(artifact.sizeBytes),
      'Content-Disposition': `attachment; filename="netshare-screenshot-${req.params.artifactId}.png"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
    });
    return res.status(200).send(artifact.bytes);
  } catch (error) { return next(error); }
};
