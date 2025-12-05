/**
 * CircuitBreakerRegistry Tests - v13 Section 6.11.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreakerRegistry, API_CONFIGS } from '../circuit-breaker';

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  describe('initialization', () => {
    it('should create breakers for configured APIs', () => {
      const apis = registry.getRegisteredApis();
      expect(apis).toContain('serpapi');
      expect(apis).toContain('rss');
      expect(apis).toContain('plaid');
      expect(apis.length).toBeGreaterThan(0);
    });

    it('should load default API configs', () => {
      const serpConfig = registry.getConfig('serpapi');
      expect(serpConfig).toBeDefined();
      expect(serpConfig?.name).toBe('serpapi');
      expect(serpConfig?.failureThreshold).toBe(5);
      expect(serpConfig?.timeoutMs).toBe(5000);
    });
  });

  describe('execute', () => {
    it('should execute operation successfully', async () => {
      const result = await registry.execute('serpapi', async () => {
        return { success: true };
      });
      expect(result).toEqual({ success: true });
    });

    it('should execute operation directly if no breaker configured', async () => {
      const result = await registry.execute('unknown_api', async () => {
        return { success: true };
      });
      expect(result).toEqual({ success: true });
    });

    it('should call fallback when operation fails and circuit opens', async () => {
      const failingOp = () => Promise.reject(new Error('API Error'));
      const fallback = () => ({ fallback: true });

      // Fail enough times to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await registry.execute('serpapi', failingOp);
        } catch {
          // Expected to fail
        }
      }

      // Circuit should be open now
      expect(registry.isOpen('serpapi')).toBe(true);

      // Should use fallback
      const result = await registry.execute('serpapi', failingOp, fallback);
      expect(result).toEqual({ fallback: true });
    });

    it('should throw without fallback when circuit is open', async () => {
      const failingOp = () => Promise.reject(new Error('API Error'));

      // Fail enough times to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await registry.execute('serpapi', failingOp);
        } catch {
          // Expected
        }
      }

      await expect(registry.execute('serpapi', failingOp))
        .rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('circuit state', () => {
    it('should open circuit after failure threshold', async () => {
      const failingOp = () => Promise.reject(new Error('API Error'));

      // serpapi has failureThreshold of 5
      for (let i = 0; i < 5; i++) {
        expect(registry.isOpen('serpapi')).toBe(false);
        try {
          await registry.execute('serpapi', failingOp);
        } catch {
          // Expected
        }
      }

      expect(registry.isOpen('serpapi')).toBe(true);
    });

    it('should close circuit on success', async () => {
      const failingOp = () => Promise.reject(new Error('API Error'));
      const successOp = () => Promise.resolve({ success: true });

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await registry.execute('serpapi', failingOp);
        } catch {
          // Expected
        }
      }

      expect(registry.isOpen('serpapi')).toBe(true);

      // Reset to allow test
      registry.reset('serpapi');
      expect(registry.isOpen('serpapi')).toBe(false);

      // Successful call
      await registry.execute('serpapi', successOp);
      expect(registry.isOpen('serpapi')).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const successOp = vi.fn().mockResolvedValue({ success: true });
      const result = await registry.executeWithRetry('serpapi', successOp);
      expect(result).toEqual({ success: true });
      expect(successOp).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure', async () => {
      let attempts = 0;
      const flakeyOp = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
        return { success: true };
      });

      const result = await registry.executeWithRetry('serpapi', flakeyOp);
      expect(result).toEqual({ success: true });
      expect(flakeyOp).toHaveBeenCalledTimes(2);
    });

    it('should call fallback after retries exhausted', async () => {
      const failingOp = vi.fn().mockRejectedValue(new Error('Persistent error'));
      const fallback = () => ({ fallback: true });

      const result = await registry.executeWithRetry('serpapi', failingOp, fallback);
      expect(result).toEqual({ fallback: true });
      // 1 initial + 2 retries (serpapi has retries: 2)
      expect(failingOp).toHaveBeenCalledTimes(3);
    });
  });

  describe('stats', () => {
    it('should track statistics', async () => {
      const successOp = () => Promise.resolve({ success: true });
      const failingOp = () => Promise.reject(new Error('Error'));

      // Some successes
      await registry.execute('serpapi', successOp);
      await registry.execute('serpapi', successOp);

      // Some failures
      try {
        await registry.execute('serpapi', failingOp);
      } catch {
        // Expected
      }

      const stats = registry.getStats('serpapi');
      expect(stats).toBeDefined();
      expect(stats?.totalRequests).toBe(3);
      expect(stats?.successCount).toBe(2);
      expect(stats?.failureCount).toBe(1);
    });

    it('should get all stats', async () => {
      await registry.execute('serpapi', async () => ({ success: true }));
      await registry.execute('rss', async () => ({ success: true }));

      const allStats = registry.getAllStats();
      expect(allStats).toBeDefined();
      expect(allStats.serpapi).toBeDefined();
      expect(allStats.rss).toBeDefined();
    });
  });

  describe('critical APIs', () => {
    it('should identify critical APIs', () => {
      expect(registry.isCritical('plaid')).toBe(true);
      expect(registry.isCritical('serpapi')).toBe(false);
      expect(registry.isCritical('rss')).toBe(false);
    });
  });

  describe('registration', () => {
    it('should register new APIs', () => {
      registry.register('custom_api', {
        name: 'custom_api',
        failureThreshold: 3,
        resetTimeoutMs: 10000,
        halfOpenRequests: 1,
        critical: true,
        retries: 1,
        timeoutMs: 5000,
      });

      expect(registry.getRegisteredApis()).toContain('custom_api');
      expect(registry.isCritical('custom_api')).toBe(true);
    });

    it('should unregister APIs', () => {
      expect(registry.getRegisteredApis()).toContain('serpapi');
      registry.unregister('serpapi');
      expect(registry.getRegisteredApis()).not.toContain('serpapi');
    });
  });

  describe('reset', () => {
    it('should reset single API', async () => {
      const failingOp = () => Promise.reject(new Error('Error'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await registry.execute('serpapi', failingOp);
        } catch {
          // Expected
        }
      }

      expect(registry.isOpen('serpapi')).toBe(true);
      registry.reset('serpapi');
      expect(registry.isOpen('serpapi')).toBe(false);
    });

    it('should reset all APIs', async () => {
      const failingOp = () => Promise.reject(new Error('Error'));

      // Open multiple circuits
      for (let i = 0; i < 10; i++) {
        try {
          await registry.execute('serpapi', failingOp);
          await registry.execute('rss', failingOp);
        } catch {
          // Expected
        }
      }

      registry.resetAll();
      expect(registry.isOpen('serpapi')).toBe(false);
      expect(registry.isOpen('rss')).toBe(false);
    });
  });
});
