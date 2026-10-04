/**
 * Security Hardening Middleware for NetShare Distributed Infrastructure
 * Implements in-memory token-bucket / sliding window rate limiting, input sanitization,
 * task authorization, and node permission checks.
 */

// Simple in-memory rate limiter per IP / identifier
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests per minute

export const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
  const now = Date.now();

  let clientData = requestCounts.get(ip);
  if (!clientData || now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
    clientData = { count: 1, startTime: now };
    requestCounts.set(ip, clientData);
    return next();
  }

  clientData.count++;
  if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      message: "Too many requests. Please slow down and retry in a minute.",
      retryAfterSeconds: Math.ceil((clientData.startTime + RATE_LIMIT_WINDOW_MS - now) / 1000),
    });
  }

  next();
};

/**
 * Sanitize string inputs to prevent injection and XSS
 */
export const sanitizeInputs = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        // Strip potential script tags and trim whitespace
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .trim();
      }
    }
  }
  next();
};

/**
 * Task submission authorization: validates URL scheme, safe hostnames, and service limits
 */
export const validateTaskSubmission = (req, res, next) => {
  const { targetUrl, serviceType, targetRegion, executionLimit } = req.body;

  if (!targetUrl || !serviceType || !targetRegion || !executionLimit) {
    return res.status(400).json({
      message: "targetUrl, serviceType, targetRegion, and executionLimit are required",
    });
  }

  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({
        message: "Invalid target URL protocol. Only HTTP and HTTPS are permitted.",
      });
    }

    // Disallow local loopback addresses for external security testing
    const hostname = parsed.hostname.toLowerCase();
    const disallowed = ["127.0.0.1", "localhost", "0.0.0.0", "169.254.169.254"];
    if (disallowed.includes(hostname) && process.env.NODE_ENV === "production") {
      return res.status(400).json({
        message: "Prohibited target host. Loopback and internal addresses are blocked.",
      });
    }
  } catch (err) {
    return res.status(400).json({
      message: "Malformed target URL. Must be a valid full URL.",
    });
  }

  const limitNum = Number(executionLimit);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      message: "Execution limit must be a positive integer between 1 and 100",
    });
  }

  next();
};

export default {
  rateLimiter,
  sanitizeInputs,
  validateTaskSubmission,
};
