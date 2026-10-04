import dotenv from 'dotenv';
dotenv.config();

const requiredInProduction = ['MONGO_URI', 'JWT_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const missing = requiredInProduction.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  isDevelopment: !isProduction,
  port: parseInt(process.env.PORT || '8000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/netshare_db',
  jwt: {
    secret: process.env.JWT_SECRET || 'netshare_dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@netshare.io',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5001',
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
});

if (!isProduction && config.jwt.secret === 'netshare_dev_secret_change_me') {
  console.warn('[Config] WARNING: Using default JWT secret. Set JWT_SECRET for production.');
}

export default config;
