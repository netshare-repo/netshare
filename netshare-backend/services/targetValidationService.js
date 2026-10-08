import { URL } from 'url';
import dns from 'dns/promises';
import net from 'net';
import logger from '../lib/logger.js';

/**
 * Private/reserved IP ranges that must NEVER be targeted.
 */
const BLOCKED_IP_RANGES = [
  // IPv4 loopback
  { start: '127.0.0.0', end: '127.255.255.255' },
  // IPv4 private RFC1918
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255' },
  // Loopback
  { start: '0.0.0.0', end: '0.255.255.255' },
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.gke.internal',
];

const BLOCKED_EXACT_IPS = [
  '169.254.169.254', // Cloud metadata endpoint (AWS, GCP, Azure)
  '::1',             // IPv6 loopback
  'fe80::1',         // IPv6 link-local
];

const ipToLong = (ip) => {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

const isPrivateIPv4 = (ip) => {
  if (!net.isIPv4(ip)) return false;
  const ipLong = ipToLong(ip);
  return BLOCKED_IP_RANGES.some(range => {
    const startLong = ipToLong(range.start);
    const endLong = ipToLong(range.end);
    return ipLong >= startLong && ipLong <= endLong;
  });
};

const isBlockedIPv6 = (ip) => {
  if (!net.isIPv6(ip)) return false;
  const normalized = ip.toLowerCase();
  // Block loopback, link-local, and unique local
  return normalized === '::1' ||
         normalized.startsWith('fe80:') ||
         normalized.startsWith('fc') ||
         normalized.startsWith('fd') ||
         normalized === '::' ||
         normalized.startsWith('::ffff:127.') ||
         normalized.startsWith('::ffff:10.') ||
         normalized.startsWith('::ffff:192.168.') ||
         normalized.startsWith('::ffff:172.');
};

const ALLOWED_DEFAULT_PORTS = [80, 443, 8080, 8443];

/**
 * Validates a target URL for safe HTTP testing execution.
 * Blocks SSRF, private networks, non-HTTP protocols, unauthorized ports, etc.
 * 
 * @param {string} targetUrl - The URL to validate
 * @param {object} [options] - Optional custom options
 * @param {number[]} [options.allowedPorts] - Explicitly allowed ports
 * @returns {Promise<{ valid: boolean, reason?: string, resolvedIp?: string }>}
 */
export const validateTarget = async (targetUrl, options = {}) => {
  // 1. Parse URL
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL.' };
  }
  
  // 2. Protocol check — only http: and https:
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }

  // 3. Port check — prevent port scanning / arbitrary service abuse
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const targetPort = parsed.port ? parseInt(parsed.port, 10) : defaultPort;
  const allowedPorts = options.allowedPorts || ALLOWED_DEFAULT_PORTS;

  if (isNaN(targetPort) || !allowedPorts.includes(targetPort)) {
    return {
      valid: false,
      reason: `Unauthorized port: ${parsed.port || targetPort}. Only authorized HTTP/HTTPS ports (${allowedPorts.join(', ')}) are permitted.`,
    };
  }
  
  // 4. Hostname checks
  const hostname = parsed.hostname.toLowerCase();
  
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: 'Blocked hostname. Internal/local targets are not permitted.' };
  }
  
  if (BLOCKED_EXACT_IPS.includes(hostname)) {
    return { valid: false, reason: 'Blocked IP address. Cloud metadata and loopback addresses are not permitted.' };
  }
  
  // 5. Check if hostname is a raw IP
  if (net.isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, reason: 'Private/reserved IPv4 address. RFC1918 and loopback ranges are blocked.' };
    }
    return { valid: true, resolvedIp: hostname };
  }
  
  if (net.isIPv6(hostname)) {
    if (isBlockedIPv6(hostname)) {
      return { valid: false, reason: 'Blocked IPv6 address. Loopback and link-local addresses are not permitted.' };
    }
    return { valid: true, resolvedIp: hostname };
  }
  
  // 6. DNS resolution — validate every address and fail closed. Allowing an
  // unresolved hostname would turn transient DNS failures into an SSRF bypass.
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: 'DNS resolution failed. No addresses found.' };
    }

    for (const { address } of addresses) {
      if (isPrivateIPv4(address) || isBlockedIPv6(address) || BLOCKED_EXACT_IPS.includes(address)) {
        logger.warn({ hostname, resolvedIp: address }, 'DNS rebinding attempt detected: hostname resolves to blocked IP');
        return { valid: false, reason: 'Hostname resolves to a private/reserved IP address. This may be a DNS rebinding attack.' };
      }
    }

    return { valid: true, resolvedIp: addresses[0].address };
  } catch (dnsErr) {
    logger.warn({ hostname, err: dnsErr.message }, 'DNS resolution failed — target rejected');
    return { valid: false, reason: `DNS resolution failed: ${dnsErr.code || dnsErr.message}` };
  }
};

/**
 * Validates an HTTP redirect target before following.
 * Protects against SSRF through unsafe redirects (e.g. 302 -> 169.254.169.254 or localhost).
 *
 * @param {string} originalUrl - The base request URL
 * @param {string} redirectLocation - The Location header value
 * @param {object} [options]
 * @returns {Promise<{ valid: boolean, resolvedUrl?: string, reason?: string }>}
 */
export const validateRedirect = async (originalUrl, redirectLocation, options = {}) => {
  if (!redirectLocation) {
    return { valid: false, reason: 'Empty redirect location.' };
  }

  let resolvedRedirect;
  try {
    resolvedRedirect = new URL(redirectLocation, originalUrl).toString();
  } catch {
    return { valid: false, reason: 'Invalid redirect URL format.' };
  }

  const validation = options.authorizedHost || options.authorizedPort
    ? await validateTaskExecutionTarget({
        targetUrl: resolvedRedirect,
        authorizedHost: options.authorizedHost,
        authorizedPort: options.authorizedPort,
        authorizedMethod: options.authorizedMethod || 'GET',
      })
    : await validateTarget(resolvedRedirect, options);
  if (!validation.valid) {
    return {
      valid: false,
      reason: `Unsafe redirect blocked: ${validation.reason}`,
      resolvedUrl: resolvedRedirect,
    };
  }

  return {
    valid: true,
    resolvedUrl: resolvedRedirect,
    resolvedIp: validation.resolvedIp,
  };
};

/**
 * Node-side target enforcement: ensures execution target strictly matches
 * the task-authorized target parameters and security policies.
 *
 * @param {object} params
 * @param {string} params.targetUrl
 * @param {string} [params.authorizedHost]
 * @param {number} [params.authorizedPort]
 * @param {string} [params.authorizedMethod]
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
export const validateTaskExecutionTarget = async ({
  targetUrl,
  authorizedHost,
  authorizedPort,
  authorizedMethod = 'GET',
}) => {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { valid: false, reason: 'Malformed target URL' };
  }

  // 1. Method check: only GET or HEAD allowed for network testing
  const normalizedMethod = (authorizedMethod || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(normalizedMethod)) {
    return { valid: false, reason: `Unauthorized HTTP method '${authorizedMethod}'. Only GET/HEAD allowed.` };
  }

  // 2. Host check: must strictly match authorizedHost if provided
  if (authorizedHost && parsed.hostname.toLowerCase() !== authorizedHost.toLowerCase()) {
    return {
      valid: false,
      reason: `Target host '${parsed.hostname}' does not match authorized host '${authorizedHost}'`,
    };
  }

  // 3. Port check: must match authorizedPort if provided
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const currentPort = parsed.port ? parseInt(parsed.port, 10) : defaultPort;
  if (authorizedPort && currentPort !== authorizedPort) {
    return {
      valid: false,
      reason: `Target port ${currentPort} does not match authorized port ${authorizedPort}`,
    };
  }

  // 4. Run general safety validation
  const targetCheck = await validateTarget(targetUrl, {
    allowedPorts: authorizedPort ? [authorizedPort] : ALLOWED_DEFAULT_PORTS,
  });

  return targetCheck;
};

export default {
  validateTarget,
  validateRedirect,
  validateTaskExecutionTarget,
  ALLOWED_DEFAULT_PORTS,
};
