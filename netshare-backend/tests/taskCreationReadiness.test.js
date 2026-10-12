import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateTarget, estimateTaskPrice, runTransaction, transactionsSupported } = vi.hoisted(() => ({
  validateTarget: vi.fn(),
  estimateTaskPrice: vi.fn(),
  runTransaction: vi.fn(),
  transactionsSupported: vi.fn(),
}));

vi.mock('../services/targetValidationService.js', () => ({ validateTarget }));
vi.mock('../services/pricingService.js', () => ({ estimateTaskPrice }));
vi.mock('../lib/mongoTransaction.js', () => ({
  runTransaction,
  supportsMongoTransactions: transactionsSupported,
}));

import { createTask } from '../controllers/taskController.js';

describe('client task creation readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateTarget.mockResolvedValue({ valid: true });
    transactionsSupported.mockReturnValue(false);
  });

  it('returns an actionable 503 without pricing or charging when MongoDB transactions are unavailable', async () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    await createTask({
      body: {
        targetUrl: 'https://example.com',
        serviceType: 'accessibility_testing',
        targetRegion: 'Pakistan',
        executionLimit: 1,
      },
    }, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      message: expect.stringContaining('MongoDB'),
    });
    expect(estimateTaskPrice).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
