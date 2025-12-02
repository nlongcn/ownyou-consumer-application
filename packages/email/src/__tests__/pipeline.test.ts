/**
 * Email Pipeline Tests - Sprint 1b
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmailPipeline,
  createPipeline,
  sanitizeEmailForClassification,
  batchEmails,
} from '../pipeline';
import type { Email, IABClassification, PipelineConfig } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EmailPipeline', () => {
  const mockConfig: PipelineConfig = {
    userId: 'test-user',
    provider: 'microsoft',
    fetchOptions: { maxResults: 10 },
    runClassification: false,
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create pipeline with microsoft provider', () => {
      const pipeline = new EmailPipeline(mockConfig);
      expect(pipeline.providerType).toBe('microsoft');
    });

    it('should create pipeline with google provider', () => {
      const pipeline = new EmailPipeline({ ...mockConfig, provider: 'google' });
      expect(pipeline.providerType).toBe('google');
    });
  });

  describe('run', () => {
    it('should return empty result when no emails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });

      const pipeline = new EmailPipeline(mockConfig);
      const result = await pipeline.run('test-token');

      expect(result.emailsFetched).toBe(0);
      expect(result.emailsClassified).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should fetch emails without classification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [
            {
              id: 'msg1',
              subject: 'Test',
              from: { emailAddress: { address: 'sender@test.com' } },
              toRecipients: [],
              body: { contentType: 'text', content: 'Body' },
              receivedDateTime: '2024-01-15T10:00:00Z',
              isRead: false,
              hasAttachments: false,
            },
          ],
        }),
      });

      const pipeline = new EmailPipeline(mockConfig);
      const result = await pipeline.run('test-token');

      expect(result.emailsFetched).toBe(1);
      expect(result.emailsClassified).toBe(0); // No classifier provided
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should run classifier when enabled and provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [
            {
              id: 'msg1',
              subject: 'Flight Booking Confirmation',
              from: { emailAddress: { address: 'booking@airline.com' } },
              toRecipients: [],
              body: { contentType: 'text', content: 'Your flight is booked' },
              receivedDateTime: '2024-01-15T10:00:00Z',
              isRead: false,
              hasAttachments: false,
            },
          ],
        }),
      });

      const mockClassifications: IABClassification[] = [
        {
          emailId: 'msg1',
          tier1Category: 'Travel',
          tier1Id: 'IAB20',
          tier2Category: 'Air Travel',
          tier2Id: 'IAB20-1',
          confidence: 0.95,
          classifiedAt: new Date(),
        },
      ];

      const mockClassifier = vi.fn().mockResolvedValue(mockClassifications);

      const pipeline = new EmailPipeline({
        ...mockConfig,
        runClassification: true,
      });
      const result = await pipeline.run('test-token', mockClassifier);

      expect(result.emailsFetched).toBe(1);
      expect(result.emailsClassified).toBe(1);
      expect(result.classificationsStored).toBe(1);
      expect(mockClassifier).toHaveBeenCalledTimes(1);
    });

    it('should handle classification errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [
            {
              id: 'msg1',
              subject: 'Test',
              from: { emailAddress: { address: 'sender@test.com' } },
              toRecipients: [],
              body: { contentType: 'text', content: 'Body' },
              receivedDateTime: '2024-01-15T10:00:00Z',
              isRead: false,
              hasAttachments: false,
            },
          ],
        }),
      });

      const mockClassifier = vi.fn().mockRejectedValue(new Error('LLM API error'));

      const pipeline = new EmailPipeline({
        ...mockConfig,
        runClassification: true,
      });
      const result = await pipeline.run('test-token', mockClassifier);

      expect(result.emailsFetched).toBe(1);
      expect(result.emailsClassified).toBe(0);
      expect(result.errors).toContain('Classification failed: LLM API error');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const pipeline = new EmailPipeline(mockConfig);
      const result = await pipeline.run('test-token');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('testConnection', () => {
    it('should delegate to provider', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const pipeline = new EmailPipeline(mockConfig);
      const result = await pipeline.testConnection('test-token');

      expect(result).toBe(true);
    });
  });
});

describe('createPipeline', () => {
  it('should create EmailPipeline instance', () => {
    const pipeline = createPipeline({
      userId: 'user1',
      provider: 'google',
    });

    expect(pipeline).toBeInstanceOf(EmailPipeline);
    expect(pipeline.providerType).toBe('google');
  });
});

describe('sanitizeEmailForClassification', () => {
  it('should extract subject and sender domain', () => {
    const email: Email = {
      id: 'msg1',
      subject: 'Flight Booking',
      from: 'booking@united.com',
      to: ['user@example.com'],
      body: 'Your flight details...',
      date: new Date(),
    };

    const sanitized = sanitizeEmailForClassification(email);

    expect(sanitized.subject).toBe('Flight Booking');
    expect(sanitized.senderDomain).toBe('united.com');
    expect(sanitized.hasAttachments).toBe(false);
  });

  it('should handle email with name format', () => {
    const email: Email = {
      id: 'msg1',
      subject: 'Order Shipped',
      from: 'Amazon <noreply@amazon.com>',
      to: ['user@example.com'],
      body: 'Your order has shipped',
      date: new Date(),
    };

    const sanitized = sanitizeEmailForClassification(email);

    // The extractDomain function matches @([^>]+) so it captures until >
    expect(sanitized.senderDomain).toBe('amazon.com');
  });

  it('should detect attachments from metadata', () => {
    const email: Email = {
      id: 'msg1',
      subject: 'Document',
      from: 'sender@company.com',
      to: ['user@example.com'],
      body: 'Please see attached',
      date: new Date(),
      metadata: { hasAttachments: true },
    };

    const sanitized = sanitizeEmailForClassification(email);

    expect(sanitized.hasAttachments).toBe(true);
  });

  it('should handle missing metadata', () => {
    const email: Email = {
      id: 'msg1',
      subject: 'Hello',
      from: 'sender@test.com',
      to: [],
      body: 'Hi',
      date: new Date(),
    };

    const sanitized = sanitizeEmailForClassification(email);

    expect(sanitized.hasAttachments).toBe(false);
  });
});

describe('batchEmails', () => {
  const createEmails = (count: number): Email[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `msg${i}`,
      subject: `Subject ${i}`,
      from: `sender${i}@test.com`,
      to: [],
      body: `Body ${i}`,
      date: new Date(),
    }));

  it('should batch emails with default size', () => {
    const emails = createEmails(25);
    const batches = batchEmails(emails);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(10);
    expect(batches[1]).toHaveLength(10);
    expect(batches[2]).toHaveLength(5);
  });

  it('should batch emails with custom size', () => {
    const emails = createEmails(15);
    const batches = batchEmails(emails, 5);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(5);
    expect(batches[1]).toHaveLength(5);
    expect(batches[2]).toHaveLength(5);
  });

  it('should handle empty array', () => {
    const batches = batchEmails([]);
    expect(batches).toHaveLength(0);
  });

  it('should handle fewer emails than batch size', () => {
    const emails = createEmails(3);
    const batches = batchEmails(emails, 10);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
  });
});
