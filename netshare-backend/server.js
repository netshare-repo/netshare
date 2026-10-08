import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/env.js';
import connectDB from './config/db.js';
import logger from './lib/logger.js';
import { registerShutdownHandlers } from './lib/shutdown.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';
import { rateLimiter, sanitizeInputs } from './middleware/securityMiddleware.js';
import { initSocketServer, getConnectedNodesList } from './services/socketService.js';
import { initTaskQueue } from './services/taskQueueService.js';
import { startTaskWorker } from './workers/taskWorker.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import nodeRoutes from './routes/nodeRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { adminOperationsRoutes, disputeRoutes, notificationRoutes } from './routes/operationsRoutes.js';
import { startMonitoring } from './services/monitoringService.js';
import AnomalyAlert from './models/AnomalyAlert.js';
import Notification from './models/Notification.js';
import Dispute from './models/Dispute.js';
import TaskResult from './models/TaskResult.js';
import CreditTransaction from './models/CreditTransaction.js';
import TopUpRequest from './models/TopUpRequest.js';
import WithdrawalRequest from './models/WithdrawalRequest.js';
import { startTaskRecovery } from './services/taskRecoveryService.js';

// Connect to MongoDB
await connectDB();
// Do not serve writes before the deduplication/ownership indexes are ready.
await Promise.all([AnomalyAlert.init(), Notification.init(), Dispute.init(), TaskResult.init(),
  CreditTransaction.init(), TopUpRequest.init(), WithdrawalRequest.init()]);

const app = express();
const httpServer = http.createServer(app);

// ─── Security & Parsing Middleware ─────────────────────────────────────────────

// Request correlation ID (first, so all middleware can use it)
app.use(requestIdMiddleware);

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for API-only server; frontend served separately
  crossOriginEmbedderPolicy: false,
}));

// CORS — configured origins, not wildcard
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn({ origin }, 'CORS: rejected request from unknown origin');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);
app.use(sanitizeInputs);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/health/')) return; // Don't log health checks
    logger.info({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      userId: req.user?._id?.toString(),
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ─── Health / System Endpoints ─────────────────────────────────────────────────

app.use('/health', healthRoutes);

// Legacy health endpoint (backward compatibility)
app.get('/api/health', (req, res) => {
  const connectedNodes = getConnectedNodesList();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    executionPlane: {
      socketServer: 'active',
      connectedNodesCount: connectedNodes.length,
      connectedNodes,
    },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'NetShare Distributed Real-Time Backend API is running',
    status: 'OK',
    plane: 'Hybrid Control & Real-Time Execution Plane',
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/node', nodeRoutes);
app.use('/api/nodes', nodeRoutes); // Legacy compatibility alias
app.use('/api/wallet', walletRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/admin', adminOperationsRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Error Handling ────────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Socket.IO ─────────────────────────────────────────────────────────────────

const io = await initSocketServer(httpServer);

// ─── Task Queue & Worker ───────────────────────────────────────────────────────

(async () => {
  await initTaskQueue();
  startTaskWorker();
  if (config.nodeEnv !== 'test') startTaskRecovery();
})();

// ─── Start Server ──────────────────────────────────────────────────────────────

httpServer.listen(config.port, () => {
  logger.info({
    port: config.port,
    env: config.nodeEnv,
    mongo: config.mongoUri.replace(/\/\/.*@/, '//***@'),
  }, `[NetShare] Server running on http://localhost:${config.port}`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

registerShutdownHandlers(httpServer, io);
if (config.nodeEnv !== 'test') startMonitoring();

export { app, httpServer, io };
