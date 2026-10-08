// Local production-mode acceptance + API benchmark. Never claims Android/TUN/NAT evidence.
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { RTCPeerConnection } from 'node-datachannel/polyfill';
import { io } from '../../netshare-frontend/node_modules/socket.io-client/build/esm/index.js';
import { executeSecureResidentialHttpTest } from '../../netshare-agent/src/secureTaskExecutor.js';

const mongoUri = process.env.RC_MONGO_URI;
if (!mongoUri || !/netshare_rc8_validation(?:\?|$)/.test(mongoUri)) throw new Error('Use isolated RC_MONGO_URI database netshare_rc8_validation');
const backendPort = Number(process.env.RC_PORT || 18081);
const base = `http://127.0.0.1:${backendPort}`;
const jwtSecret = randomUUID() + randomUUID();
const emailMessages = [];
const smtpSockets = new Set();
const smtp = net.createServer(socket => {
  smtpSockets.add(socket); socket.on('close', () => smtpSockets.delete(socket));
  socket.write('220 localhost RC validation SMTP\r\n');
  let buffer = '', data = false, message = '';
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const position = buffer.indexOf('\r\n'); const line = buffer.slice(0, position); buffer = buffer.slice(position + 2);
      if (data) { if (line === '.') { emailMessages.push(message); message = ''; data = false; socket.write('250 accepted\r\n'); }
        else message += line + '\r\n'; continue; }
      if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
      else if (/^AUTH/.test(line)) socket.write('235 authenticated\r\n');
      else if (/^DATA/.test(line)) { data = true; socket.write('354 end with dot\r\n'); }
      else if (/^QUIT/.test(line)) { socket.end('221 goodbye\r\n'); }
      else socket.write('250 OK\r\n');
    }
  });
});
smtp.listen(0, '127.0.0.1'); await once(smtp, 'listening');
const env = { ...process.env, NODE_ENV: 'production', MONGO_URI: mongoUri, PORT: String(backendPort), JWT_SECRET: jwtSecret,
  LOG_LEVEL: 'error', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_USER: 'fixture', SMTP_PASS: 'fixture',
  SMTP_FROM: 'rc@test.io', REDIS_PORT: '27029', ML_SERVICE_URL: 'http://127.0.0.1:27028', ML_TIMEOUT_MS: '100',
  WEBRTC_STUN_URLS: '', WEBRTC_TURN_URL: '', WEBRTC_TURN_USERNAME: '', WEBRTC_TURN_CREDENTIAL: '' };
let backend, logs = '', nodeSocket, pc;
const checks = [];
const measurements = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (predicate, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await delay(50); }
  throw new Error('Acceptance condition timed out');
};
async function start() {
  backend = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env, windowsHide: true });
  backend.stdout.on('data', data => logs += data);
  backend.stderr.on('data', data => logs += data);
  await waitFor(async () => { try { return (await fetch(base + '/health/ready')).ok; } catch { return false; } });
}
async function stop() {
  if (backend && backend.exitCode === null) { const exited = once(backend, 'exit'); backend.kill(); await exited; }
}
async function api(path, token = null, method = 'GET', body = null, expected = 200) {
  const response = await fetch(base + '/api' + path, { method, headers: {
    ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }) });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 150)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
async function benchmark(label, action, samples = 100, concurrency = 5) {
  for (let index = 0; index < 5; index++) await action();
  const times = []; let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next++ < samples) { const started = performance.now(); await action(); times.push(performance.now() - started); }
  }));
  times.sort((a, b) => a - b);
  const percentile = value => Number(times[Math.ceil(value * times.length) - 1].toFixed(2));
  measurements.push({ label, samples, concurrency, errors: 0, p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: times.at(-1) });
}

try {
  await mongoose.connect(mongoUri);
  const models = {};
  for (const name of ['User', 'Wallet', 'NodeDevice', 'TestingTask', 'TaskResult', 'RoutingSession', 'CreditTransaction', 'MarketplaceProduct', 'MarketplaceOrder', 'Notification']) {
    models[name] = (await import(`../models/${name}.js`)).default; await models[name].init();
  }
  const { User, Wallet, NodeDevice, TestingTask, TaskResult, RoutingSession, CreditTransaction, MarketplaceProduct } = models;
  const suffix = Date.now();
  const admin = await User.create({ name: 'RC administrator', email: `rcadmin${suffix}@test.io`, password: await bcrypt.hash('ReleaseTest123', 10), role: 'admin', isVerified: true });
  await Wallet.create({ userId: admin._id, balance: 0 });
  await start();
  const adminToken = (await api('/auth/login', null, 'POST', { email: admin.email, password: 'ReleaseTest123' })).token;
  async function register(role, index) {
    const email = `rc${suffix}${index}@test.io`;
    const response = await api('/auth/register', null, 'POST', { name: `RC ${index}`, email, role, password: 'ReleaseTest123' }, 201);
    assert.equal(response.devOtp, undefined);
    await waitFor(() => emailMessages.some(message => message.includes(email)));
    const message = emailMessages.find(message => message.includes(email));
    const otp = message.match(/>(\d{6})</)?.[1]; assert.ok(otp, 'Actual SMTP message contains an OTP');
    const verified = await api('/auth/verify-signup-otp', null, 'POST', { email, otp });
    assert.equal((await api('/wallet', verified.token)).wallet.balance, 0);
    return { token: verified.token, id: response.userId, email };
  }
  const client = await register('platform_client', 1), contributor = await register('node_participant', 2);
  checks.push('registration → actual local SMTP OTP → verification; production wallets start at zero');
  const topup = await api('/wallet/top-ups', client.token, 'POST', { amount: 100000, paymentMethod: 'bank_transfer',
    referenceNumber: `RCVALIDATION${suffix}`, proofMime: 'image/png', proofBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64') }, 201);
  await api(`/admin/payments/top-ups/${topup.request._id}/approve`, adminToken, 'POST', { adminNote: 'Local acceptance proof fixture, no real payment' });
  await api(`/admin/payments/top-ups/${topup.request._id}/approve`, adminToken, 'POST', { adminNote: 'Duplicate' }, 409);
  checks.push('manual top-up review and exactly-once credit (proof fixture; not external cash verification)');
  const registeredNode = await api('/node/register', contributor.token, 'POST', { deviceName: 'RC desktop WebRTC peer', deviceId: `rc-device-${suffix}`,
    region: 'RCLOCAL', bandwidthLimitMB: 1000, maxConcurrentTasks: 1 }, 201);
  const node = registeredNode.node;
  const key = (await api('/node/api-key', contributor.token)).apiKey;
  await api('/node/start', contributor.token, 'POST');
  let executed = 0, executionResult, routeId, settled;
  const candidates = []; let remoteReady = false;
  nodeSocket = io(base, { auth: { apiKey: key }, transports: ['websocket'], reconnection: false });
  nodeSocket.on('secure_route:ice_candidate', async event => {
    if (pc && remoteReady) await pc.addIceCandidate({ candidate: event.candidate, sdpMid: event.mid });
    else candidates.push(event);
  });
  nodeSocket.on('secure_route:offer', async event => {
    try {
      routeId = event.routingSessionId;
      pc = new RTCPeerConnection({ iceServers: [] });
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) nodeSocket.emit('secure_route:ice_candidate', { routingSessionId: routeId, authToken: event.authToken,
          candidate: candidate.candidate, mid: candidate.sdpMid || '0' });
      };
      pc.ondatachannel = ({ channel }) => {
        channel.onmessage = async ({ data }) => {
          const message = JSON.parse(data);
          if (message.type !== 'task_request') return;
          assert.equal(message.sessionId, routeId);
          assert.equal(executed++, 0, 'Task executes only once');
          const envelope = message.payload;
          executionResult = await executeSecureResidentialHttpTest(envelope.targetUrl, {
            authorizedHost: envelope.authorizedHost, authorizedPort: envelope.authorizedPort, timeoutMs: 15000 });
          const result = { ...executionResult, taskId: envelope.taskId };
          const raw = JSON.stringify({ v: 1, sessionId: routeId, type: 'task_result', msgId: randomUUID(), payload: result, sentAt: new Date().toISOString() });
          channel.send(raw); channel.send(raw); // Deliberate duplicate protocol event.
        };
      };
      await pc.setRemoteDescription({ type: 'offer', sdp: event.sdp }); remoteReady = true;
      for (const item of candidates.splice(0)) await pc.addIceCandidate({ candidate: item.candidate, sdpMid: item.mid });
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      nodeSocket.emit('secure_route:answer', { routingSessionId: routeId, authToken: event.authToken, sdp: answer.sdp });
    } catch (error) { settled = { error: error.message }; }
  });
  nodeSocket.on('secure_route:settled', event => { settled = event; });
  nodeSocket.on('secure_route:error', event => { settled = { error: event.message }; });
  await waitFor(() => nodeSocket.connected);
  await waitFor(async () => (await NodeDevice.findById(node._id)).status === 'active');
  const submission = await api('/tasks', client.token, 'POST', { targetUrl: 'https://example.com', serviceType: 'performance_testing',
    targetRegion: 'RCLOCAL', executionLimit: 1 }, 201);
  await waitFor(() => settled, 45000);
  assert.equal(settled.error, undefined); assert.equal(settled.settled, true, JSON.stringify(executionResult));
  assert.equal(executionResult.success, true); assert.ok(executionResult.downloadSizeBytes > 0);
  assert.equal(executionResult.downloadBandwidthMB, executionResult.downloadSizeBytes / (1024 * 1024));
  assert.equal(executionResult.packetLoss, null, 'HTTP execution cannot claim measured IP packet loss');
  assert.equal(await TaskResult.countDocuments({ taskId: submission.task._id }), 1);
  assert.equal(await CreditTransaction.countDocuments({ taskId: submission.task._id, type: 'credit' }), 1);
  checks.push(`production allocation → real localhost WebRTC/DataChannel → real HTTPS GET → result → exactly-once settlement (${executionResult.downloadSizeBytes} bytes); desktop peer, NO Android/TUN/NAT`);
  await api(`/tasks/${submission.task._id}/rating`, client.token, 'POST', { rating: 5 }, 201);
  assert.match(await api(`/tasks/${submission.task._id}/report.csv`, client.token), /taskId/);
  const withdrawal = await api('/wallet/withdrawals', contributor.token, 'POST', { amount: 1, method: 'easypaisa', accountDetails: '03001234567' }, 201);
  await api(`/admin/payments/withdrawals/${withdrawal.request._id}/approve`, adminToken, 'POST', { adminNote: 'Local acceptance review' });
  await api(`/admin/payments/withdrawals/${withdrawal.request._id}/process`, adminToken, 'POST', { adminNote: 'Local acceptance payout fixture' });
  const product = await MarketplaceProduct.create({ name: 'RC validation product', description: 'Local order fixture', requiredCredits: 5, stock: 1, status: 'active' });
  const order = await api('/marketplace/orders', client.token, 'POST', { productId: product._id }, 201);
  await api(`/marketplace/admin/orders/${order.order._id}/status`, adminToken, 'PUT', { status: 'fulfilled', fulfilmentNote: 'Acceptance fixture fulfilment' });
  const dispute = await api('/disputes', client.token, 'POST', { relatedType: 'task', relatedId: submission.task._id, description: 'Acceptance dispute fixture for task review' }, 201);
  await api(`/admin/disputes/${dispute.dispute._id}/review`, adminToken, 'PUT', { status: 'under_review', adminNote: 'Investigating fixture' });
  await api(`/admin/disputes/${dispute.dispute._id}/review`, adminToken, 'PUT', { status: 'resolved', adminNote: 'Resolved fixture' });
  assert.ok((await api('/notifications', client.token)).unreadCount > 0);
  await api('/notifications/read-all', client.token, 'PUT');
  await api('/admin/reports', adminToken); await api('/admin/reports/export', adminToken);
  checks.push('rating, CSV report, withdrawal, marketplace fulfilment, dispute, notifications/read state, admin reports');
  for (const [path, method] of [[`/tasks/${submission.task._id}/start`, 'PUT'], [`/tasks/${submission.task._id}/complete`, 'PUT'],
    [`/tasks/${submission.task._id}/fail`, 'PUT'], ['/wallet/demo-credit', 'POST']]) await api(path, contributor.token, method, {}, 410);
  checks.push('production legacy task mutations and demo funding return 410');
  nodeSocket.disconnect(); pc.close();
  // Force an expired persisted route, then crash the actual backend process.
  const orphan = await TestingTask.create({ clientId: client.id, assignedNodeId: node._id, status: 'assigned', targetUrl: 'https://example.com',
    serviceType: 'performance_testing', targetRegion: 'RCLOCAL', executionLimit: 1, estimatedCost: 1 });
  await RoutingSession.create({ taskId: orphan._id, clientId: client.id, nodeId: node._id, status: 'negotiating',
    authTokenHash: 'fixture-hash', authTokenExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() - 1) });
  await NodeDevice.updateOne({ _id: node._id }, { currentActiveTasks: 1 });
  await stop(); await start();
  await waitFor(async () => (await TestingTask.findById(orphan._id)).status === 'failed');
  assert.equal((await TestingTask.findById(submission.task._id)).status, 'settled');
  assert.equal(await CreditTransaction.countDocuments({ taskId: submission.task._id, type: 'credit' }), 1);
  assert.equal((await NodeDevice.findById(node._id)).currentActiveTasks, 0);
  const readiness = await (await fetch(base + '/health/ready')).json();
  assert.equal(readiness.checks.redis, 'unavailable');
  checks.push('actual process stop/start: expired work fails safely, settled task and wallet history survive, Redis unavailable');
  await stop(); await start();
  await benchmark('login', () => api('/auth/login', null, 'POST', { email: client.email, password: 'ReleaseTest123' }));
  await stop(); await start(); // Reset the actual IP rate-limit window between workloads.
  await benchmark('client_dashboard_API', () => api('/tasks/client/dashboard', client.token));
  await stop(); await start();
  await benchmark('task_submission_no_eligible_nodes', () => api('/tasks', client.token, 'POST', {
    targetUrl: 'https://example.com', serviceType: 'performance_testing', targetRegion: 'RCBENCH_NO_NODES', executionLimit: 1 }, 201));
  console.log(JSON.stringify({ date: new Date().toISOString(), node: process.version, mongo: (await mongoose.connection.db.admin().command({ hello: 1 })).setName,
    checks, MLfallbackObserved: logs.includes('JS fallback'), measurements, scope: 'localhost production API + real desktop WebRTC; no real Android/TUN/NAT; SMTP and payment fixtures' }, null, 2));
} catch (error) {
  console.error('RC VALIDATION FAILED:', error.stack);
  console.error(logs.slice(-3500)); process.exitCode = 1;
} finally {
  nodeSocket?.disconnect(); pc?.close(); await stop();
  for (const socket of smtpSockets) socket.destroy(); smtp.close();
  // Deliberately isolated acceptance database; never drop an operator database.
  await mongoose.disconnect();
}
