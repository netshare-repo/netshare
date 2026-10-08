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

// ---------------------------------------------------------------------------
// WebRTC ICE configuration (STUN + TURN)
// STUN: WEBRTC_STUN_URLS=stun:stun1.example.com:3478,stun:stun2.example.com:3478
//        Falls back to Google public STUN only in non-production.
// TURN: WEBRTC_TURN_URL, WEBRTC_TURN_USERNAME, WEBRTC_TURN_CREDENTIAL
//        All three must be set together. Never hardcoded.
// ---------------------------------------------------------------------------
const buildIceConfig = () => {
  // Flat STUN URL strings (node-datachannel native format)
  const stunUrls = process.env.WEBRTC_STUN_URLS
    ? process.env.WEBRTC_STUN_URLS.split(',').map(s => s.trim()).filter(Boolean)
    : (!isProduction ? ['stun:stun.l.google.com:19302'] : []);

  // W3C RTCIceServer format (for clients / Flutter app)
  const iceServersW3C = stunUrls.length > 0
    ? [{ urls: stunUrls }]
    : [];

  // node-datachannel flat string format
  const iceServersFlat = [...stunUrls];

  // TURN server — requires all three env vars (never hardcoded)
  const turnUrl = process.env.WEBRTC_TURN_URL;
  const turnUsername = process.env.WEBRTC_TURN_USERNAME;
  const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL;

  let turnConfig = null;
  if (turnUrl && turnUsername && turnCredential) {
    // W3C format for clients
    iceServersW3C.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    // node-datachannel format (URL only; credentials passed separately)
    iceServersFlat.push(turnUrl);
    turnConfig = { url: turnUrl, username: turnUsername, credential: turnCredential };
  } else if (isProduction && (!turnUrl || !turnUsername || !turnCredential)) {
    console.warn('[Config] WARNING: TURN server not configured. ICE may fail behind symmetric NAT.');
  }

  return { iceServersW3C, iceServersFlat, turnConfig };
};

const _iceConfig = buildIceConfig();

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
  mlTimeoutMs: Math.min(5000, Math.max(100, parseInt(process.env.ML_TIMEOUT_MS || '750', 10) || 750)),
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  webrtc: {
    // W3C RTCIceServer format (for Flutter clients / browser)
    iceServers: _iceConfig.iceServersW3C,
    // Flat string URL array (for node-datachannel PeerConnection)
    iceServersFlat: _iceConfig.iceServersFlat,
    // TURN config object (null if not configured)
    turnConfig: _iceConfig.turnConfig,
    // Maximum time (ms) to wait for ICE to connect before restart
    iceConnectionTimeoutMs: parseInt(process.env.WEBRTC_ICE_TIMEOUT_MS || '10000', 10),
    // Maximum time (ms) to wait for DataChannel to open after ICE connected
    dcOpenTimeoutMs: parseInt(process.env.WEBRTC_DC_OPEN_TIMEOUT_MS || '10000', 10),
    // Maximum time (ms) before an idle DataChannel is auto-closed
    idleTimeoutMs: parseInt(process.env.WEBRTC_IDLE_TIMEOUT_MS || '300000', 10),
    // Maximum ICE restart attempts before failing the session
    maxIceRestarts: parseInt(process.env.WEBRTC_MAX_ICE_RESTARTS || '3', 10),
    // DataChannel message protocol version
    messageVersion: 1,
  },
});

if (!isProduction && config.jwt.secret === 'netshare_dev_secret_change_me') {
  console.warn('[Config] WARNING: Using default JWT secret. Set JWT_SECRET for production.');
}

export default config;
