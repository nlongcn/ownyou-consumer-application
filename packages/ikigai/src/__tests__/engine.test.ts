/**
 * Engine Tests - v13 Section 2.1-2.5
 *
 * Tests for inference engine, batch processor, and data sanitizer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeDataForLLM, sanitizePII } from '../engine/data-sanitizer';
import { BatchProcessor } from '../engine/batch-processor';
import type { UserDataBundle } from '../types';

describe('Data Sanitizer', () => {
  describe('sanitizePII', () => {
    it('should redact email addresses', () => {
      const text = 'Contact john@example.com for more info';
      const result = sanitizePII(text);

      expect(result).not.toContain('john@example.com');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact phone numbers', () => {
      const text = 'Call me at 555-123-4567 or +1 (555) 987-6543';
      const result = sanitizePII(text);

      expect(result).not.toContain('555-123-4567');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const text = 'Card: 1234-5678-9012-3456';
      const result = sanitizePII(text);

      expect(result).not.toContain('1234-5678-9012-3456');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact SSN', () => {
      const text = 'SSN: 123-45-6789';
      const result = sanitizePII(text);

      expect(result).not.toContain('123-45-6789');
      expect(result).toContain('[REDACTED]');
    });

    it('should preserve non-PII text', () => {
      const text = 'Meeting at the coffee shop tomorrow';
      const result = sanitizePII(text);

      expect(result).toBe(text);
    });
  });

  describe('sanitizeDataForLLM', () => {
    it('should return message when no data available', async () => {
      const emptyData: UserDataBundle = {
        iabClassifications: [],
        emails: [],
      };

      const result = await sanitizeDataForLLM(emptyData, 90);

      expect(result).toBe('No data available for the specified time window.');
    });

    it('should format IAB classifications', async () => {
      const data: UserDataBundle = {
        iabClassifications: [
          {
            key: 'iab-1',
            value: {
              taxonomy_id: 'Travel/Hotels',
              confidence: 0.85,
              summary: 'Interest in hotel bookings',
              date: Date.now(),
            },
          },
        ],
        emails: [],
      };

      const result = await sanitizeDataForLLM(data, 90);

      expect(result).toContain('## User Interests (IAB Classifications)');
      expect(result).toContain('Travel/Hotels');
      expect(result).toContain('85%');
    });

    it('should format email data', async () => {
      const data: UserDataBundle = {
        iabClassifications: [],
        emails: [
          {
            key: 'email-1',
            value: {
              subject: 'Your flight booking confirmation',
              sender_name: 'Airlines Inc',
              date: Date.now(),
              summary: 'Flight to Paris confirmed',
            },
          },
        ],
      };

      const result = await sanitizeDataForLLM(data, 90);

      expect(result).toContain('## Email Activity');
      expect(result).toContain('Airlines Inc');
      expect(result).toContain('flight booking');
    });

    it('should filter data by date window', async () => {
      const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days ago
      const recentDate = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      const data: UserDataBundle = {
        iabClassifications: [
          {
            key: 'old',
            value: {
              taxonomy_id: 'Old/Data',
              confidence: 0.5,
              date: oldDate,
            },
          },
          {
            key: 'recent',
            value: {
              taxonomy_id: 'Recent/Data',
              confidence: 0.9,
              date: recentDate,
            },
          },
        ],
        emails: [],
      };

      const result = await sanitizeDataForLLM(data, 90);

      expect(result).toContain('Recent/Data');
      expect(result).not.toContain('Old/Data');
    });

    it('should truncate long output', async () => {
      const data: UserDataBundle = {
        iabClassifications: Array(200).fill({
          key: 'test',
          value: {
            taxonomy_id: 'Test/Category with long description for testing',
            confidence: 0.8,
            summary: 'A very long summary text '.repeat(50),
            date: Date.now(),
          },
        }),
        emails: [],
      };

      const result = await sanitizeDataForLLM(data, 90);

      expect(result.length).toBeLessThanOrEqual(8100); // Max + buffer for truncation message
    });
  });
});

describe('Batch Processor', () => {
  let batchProcessor: BatchProcessor;

  beforeEach(() => {
    batchProcessor = new BatchProcessor({
      batchWindow: 'daily',
      minItemsThreshold: 10,
    });
  });

  describe('checkBatchReadiness', () => {
    it('should return ready when threshold is met', () => {
      const data: UserDataBundle = {
        iabClassifications: Array(15).fill({
          key: 'test',
          value: { date: Date.now() },
        }),
        emails: [],
      };

      const readiness = batchProcessor.checkBatchReadiness('user-1', data);

      expect(readiness.ready).toBe(true);
      expect(readiness.reason).toBe('threshold');
      expect(readiness.pendingItems).toBeGreaterThanOrEqual(10);
    });

    it('should return not ready when below threshold', () => {
      // First, complete an inference so we have a state
      batchProcessor.markCompleted('user-1');

      const data: UserDataBundle = {
        iabClassifications: Array(5).fill({
          key: 'test',
          value: { date: Date.now() },
        }),
        emails: [],
      };

      const readiness = batchProcessor.checkBatchReadiness('user-1', data);

      expect(readiness.ready).toBe(false);
      expect(readiness.reason).toBe('not_ready');
    });

    it('should return ready for first inference with data', () => {
      const data: UserDataBundle = {
        iabClassifications: [{ key: 'test', value: { date: Date.now() } }],
        emails: [],
      };

      const readiness = batchProcessor.checkBatchReadiness('new-user', data);

      expect(readiness.ready).toBe(true);
      expect(readiness.reason).toBe('threshold');
    });
  });

  describe('forceReady', () => {
    it('should always return ready with manual reason', () => {
      const readiness = batchProcessor.forceReady('user-1');

      expect(readiness.ready).toBe(true);
      expect(readiness.reason).toBe('manual');
    });
  });

  describe('markProcessing', () => {
    it('should update state to processing', () => {
      batchProcessor.markProcessing('user-1');

      const state = batchProcessor.getState('user-1');

      expect(state?.status).toBe('processing');
    });
  });

  describe('markCompleted', () => {
    it('should update state and schedule next inference', () => {
      const beforeTime = Date.now();
      batchProcessor.markCompleted('user-1');
      const afterTime = Date.now();

      const state = batchProcessor.getState('user-1');

      expect(state?.status).toBe('idle');
      expect(state?.lastInferenceAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state?.lastInferenceAt).toBeLessThanOrEqual(afterTime);
      expect(state?.nextScheduledAt).toBeGreaterThan(afterTime);
    });
  });

  describe('markFailed', () => {
    it('should set status to pending for retry', () => {
      batchProcessor.markProcessing('user-1');
      batchProcessor.markFailed('user-1');

      const state = batchProcessor.getState('user-1');

      expect(state?.status).toBe('pending');
    });
  });

  describe('resetState', () => {
    it('should remove user state', () => {
      batchProcessor.markCompleted('user-1');
      expect(batchProcessor.getState('user-1')).toBeDefined();

      batchProcessor.resetState('user-1');
      expect(batchProcessor.getState('user-1')).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      batchProcessor.updateConfig({ minItemsThreshold: 20 });

      // Verify by checking that threshold check uses new value
      const data: UserDataBundle = {
        iabClassifications: Array(15).fill({
          key: 'test',
          value: { date: Date.now() },
        }),
        emails: [],
      };

      batchProcessor.markCompleted('user-1'); // Set initial state
      const readiness = batchProcessor.checkBatchReadiness('user-1', data);

      // 15 items is now below threshold of 20
      expect(readiness.ready).toBe(false);
    });
  });

  describe('weekly batch window', () => {
    it('should schedule for next Sunday', () => {
      const weeklyProcessor = new BatchProcessor({
        batchWindow: 'weekly',
        minItemsThreshold: 10,
      });

      weeklyProcessor.markCompleted('user-1');
      const state = weeklyProcessor.getState('user-1');

      const nextDate = new Date(state!.nextScheduledAt);
      expect(nextDate.getDay()).toBe(0); // Sunday
      expect(nextDate.getHours()).toBe(3); // 3 AM
    });
  });
});
