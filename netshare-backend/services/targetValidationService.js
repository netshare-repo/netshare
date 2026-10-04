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

/**
 * Validates a target URL for safe HTTP testing execution.
 * Blocks SSRF, private networks, non-HTTP protocols, etc.
 * 
 * @param {string} targetUrl - The URL to validate
 * @returns {{ valid: boolean, reason?: string, resolvedIp?: string }}
 */
export const validateTarget = async (targetUrl) => {
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
  
  // 3. Hostname checks
  const hostname = parsed.hostname.toLowerCase();
  
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: 'Blocked hostname. Internal/local targets are not permitted.' };
  }
  
  if (BLOCKED_EXACT_IPS.includes(hostname)) {
    return { valid: false, reason: 'Blocked IP address. Cloud metadata and loopback addresses are not permitted.' };
  }
  
  // 4. Check if hostname is a raw IP
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
  
  // 5. DNS resolution — resolve hostname and validate resolved IP
  try {
    const addresses = await dns.resolve4(hostname);
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: 'DNS resolution failed. No A records found.' };
    }
    
    const resolvedIp = addresses[0];
    
    if (isPrivateIPv4(resolvedIp)) {
      logger.warn({ hostname, resolvedIp }, 'DNS rebinding attempt detected: hostname resolves to private IP');
      return { valid: false, reason: 'Hostname resolves to a private/reserved IP address. This may be a DNS rebinding attack.' };
    }
    
    if (BLOCKED_EXACT_IPS.includes(resolvedIp)) {
      return { valid: false, reason: 'Hostname resolves to a blocked IP address.' };
    }
    
    return { valid: true, resolvedIp };
  } catch (dnsErr) {
    // If DNS resolution fails, still allow (could be an IPv6-only host or DNS timeout)
    logger.warn({ hostname, err: dnsErr.message }, 'DNS resolution warning — proceeding with caution');
    return { valid: true, resolvedIp: 'unresolved' };
  }
};

export default { validateTarget };
