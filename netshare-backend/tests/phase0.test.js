import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server.js';

// Wait for DB connection
beforeAll(async () => {
  // Give server time to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
}, 15000);

afterAll(async () => {
  // Clean up test data
  try {
    const User = (await import('../models/User.js')).default;
    const Wallet = (await import('../models/Wallet.js')).default;
    await User.deleteMany({ email: { $regex: /^test_phase0_/ } });
    await Wallet.deleteMany({ userId: { $exists: false } });
  } catch (e) {
    // Connection may already be closed by another test suite
  }
});

describe('Phase 0: Security Foundation Tests', () => {
  // === REGISTRATION SECURITY ===
  
  describe('Registration — Admin Role Blocking', () => {
    it('should reject registration with role=admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Admin',
          email: 'test_phase0_admin@test.io',
          password: 'TestPass1',
          role: 'admin',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid role');
    });
    
    it('should allow registration with role=platform_client', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Client',
          email: 'test_phase0_client@test.io',
          password: 'TestPass1',
          role: 'platform_client',
        });
      
      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
    });
    
    it('should allow registration with role=node_participant', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Node',
          email: 'test_phase0_node@test.io',
          password: 'TestPass1',
          role: 'node_participant',
        });
      
      expect(res.status).toBe(201);
    });
    
    it('should allow registration with role=both', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Both',
          email: 'test_phase0_both@test.io',
          password: 'TestPass1',
          role: 'both',
        });
      
      expect(res.status).toBe(201);
    });
  });
  
  describe('Registration — devOtp behavior', () => {
    it('should include devOtp in development mode', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test DevOtp',
          email: 'test_phase0_devotp@test.io',
          password: 'TestPass1',
          role: 'platform_client',
        });
      
      expect(res.status).toBe(201);
      // In dev mode, devOtp should be present
      if (process.env.NODE_ENV === 'development') {
        expect(res.body.devOtp).toBeDefined();
      }
    });
  });
  
  // === AUTH MIDDLEWARE ===
  
  describe('Protected Routes', () => {
    it('should reject requests without JWT', async () => {
      const res = await request(app)
        .get('/api/users/profile');
      
      expect(res.status).toBe(401);
    });
    
    it('should reject requests with invalid JWT', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid_token_here');
      
      expect(res.status).toBe(401);
    });
  });
  
  // === HEALTH ENDPOINTS ===
  
  describe('Health Endpoints', () => {
    it('should respond to liveness probe', async () => {
      const res = await request(app).get('/health/live');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });
    
    it('should respond to readiness probe', async () => {
      const res = await request(app).get('/health/ready');
      
      expect(res.status).toBe(200);
      expect(res.body.checks.mongodb).toBe('connected');
    });
  });
  
  // === CORS ===
  
  describe('CORS', () => {
    it('should accept requests from configured origins', async () => {
      const res = await request(app)
        .get('/health/live')
        .set('Origin', 'http://localhost:5173');
      
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });
  
  // === SECURITY HEADERS ===
  
  describe('Security Headers', () => {
    it('should include Helmet security headers', async () => {
      const res = await request(app).get('/health/live');
      
      // Helmet sets these by default
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
  
  // === REQUEST ID ===
  
  describe('Request Correlation ID', () => {
    it('should return X-Request-ID header', async () => {
      const res = await request(app).get('/health/live');
      
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(/^req_/);
    });
    
    it('should accept and echo existing X-Request-ID', async () => {
      const res = await request(app)
        .get('/health/live')
        .set('X-Request-ID', 'test-correlation-123');
      
      expect(res.headers['x-request-id']).toBe('test-correlation-123');
    });
  });
  
  // === 404 ===
  
  describe('404 Handler', () => {
    it('should return structured 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeDefined();
    });
  });
  
  // === SSRF PROTECTION ===
  
  describe('SSRF Target Validation', () => {
    let validateTarget;
    
    beforeAll(async () => {
      const mod = await import('../services/targetValidationService.js');
      validateTarget = mod.validateTarget;
    });
    
    it('should block localhost', async () => {
      const result = await validateTarget('http://localhost/test');
      expect(result.valid).toBe(false);
    });
    
    it('should block 127.0.0.1', async () => {
      const result = await validateTarget('http://127.0.0.1/test');
      expect(result.valid).toBe(false);
    });
    
    it('should block RFC1918 10.x.x.x', async () => {
      const result = await validateTarget('http://10.0.0.1/admin');
      expect(result.valid).toBe(false);
    });
    
    it('should block RFC1918 192.168.x.x', async () => {
      const result = await validateTarget('http://192.168.1.1/admin');
      expect(result.valid).toBe(false);
    });
    
    it('should block cloud metadata endpoint', async () => {
      const result = await validateTarget('http://169.254.169.254/latest/meta-data/');
      expect(result.valid).toBe(false);
    });
    
    it('should block file:// protocol', async () => {
      const result = await validateTarget('file:///etc/passwd');
      expect(result.valid).toBe(false);
    });
    
    it('should block ftp:// protocol', async () => {
      const result = await validateTarget('ftp://evil.com/data');
      expect(result.valid).toBe(false);
    });
    
    it('should allow valid public URLs', async () => {
      const result = await validateTarget('https://httpbin.org/get');
      expect(result.valid).toBe(true);
    });
  });
});
