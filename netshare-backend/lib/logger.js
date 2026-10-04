import pino from 'pino';
import config from '../config/env.js';

const logger = pino({
  level: config.logLevel,
  transport: config.isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never serialize these fields
  redact: {
    paths: ['password', 'otp', 'otpHash', 'token', 'jwt', 'apiKey', 'secret', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
  base: { service: 'netshare-backend' },
});

export default logger;

/**
 * Create a child logger with additional context
 */
export const createChildLogger = (context) => logger.child(context);
