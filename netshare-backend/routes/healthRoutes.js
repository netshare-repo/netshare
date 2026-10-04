import express from 'express';
import mongoose from 'mongoose';
import { getIsRedisAvailable } from '../services/taskQueueService.js';
import config from '../config/env.js';

const router = express.Router();

/**
 * GET /health/live — Liveness probe.
 * Returns 200 if the process is running.
 */
router.get('/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * GET /health/ready — Readiness probe.
 * Returns 200 only if critical dependencies are reachable.
 */
router.get('/ready', async (req, res) => {
  const checks = {
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: getIsRedisAvailable() ? 'connected' : 'unavailable',
    config: config.isProduction ? (config.jwt.secret.length >= 32 ? 'valid' : 'weak_secret') : 'dev_mode',
  };
  
  const isReady = checks.mongodb === 'connected';
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
