import mongoose from 'mongoose';
import logger from './logger.js';
import { stopTaskWorker } from '../workers/taskWorker.js';

let httpServer = null;
let ioInstance = null;
let isShuttingDown = false;

export const registerShutdownHandlers = (server, io) => {
  httpServer = server;
  ioInstance = io;
  
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info({ signal }, 'Graceful shutdown initiated...');
    
    // 1. Stop accepting new connections
    if (httpServer) {
      httpServer.close(() => {
        logger.info('HTTP server closed.');
      });
    }
    
    // 2. Close Socket.IO
    if (ioInstance) {
      try {
        ioInstance.close();
        logger.info('Socket.IO server closed.');
      } catch (err) {
        logger.error({ err }, 'Error closing Socket.IO');
      }
    }
    
    // 3. Stop task worker
    try {
      await stopTaskWorker();
      logger.info('Task worker stopped.');
    } catch (err) {
      logger.error({ err }, 'Error stopping task worker');
    }
    
    // 4. Close MongoDB
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
    } catch (err) {
      logger.error({ err }, 'Error closing MongoDB');
    }
    
    logger.info('Shutdown complete. Exiting.');
    process.exit(0);
  };
  
  // Bounded shutdown window
  const forceShutdown = (signal) => {
    shutdown(signal);
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };
  
  process.on('SIGTERM', () => forceShutdown('SIGTERM'));
  process.on('SIGINT', () => forceShutdown('SIGINT'));
  
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled Promise Rejection');
  });
  
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught Exception — shutting down');
    forceShutdown('uncaughtException');
  });
};

export default registerShutdownHandlers;
