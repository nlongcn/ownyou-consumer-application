/**
 * Email Providers Tests - Sprint 1b
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MicrosoftEmailProvider, GoogleEmailProvider, createEmailProvider } from '../providers';
import type { FetchOptions } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MicrosoftEmailProvider', () => {
  let provider: MicrosoftEmailProvider;

  beforeEach(() => {
    provider = new MicrosoftEmailProvider();
    mockFetch.mockReset();
  });

  describe('provider property', () => {
    it('should return "microsoft"', () => {
      expect(provider.provider).toBe('microsoft');
    });
  });

  describe('fetchEmails', () => {
    it('should fetch emails successfully', async () => {
      const mockResponse = {
        value: [
          {
            id: 'msg1',
            subject: 'Test Subject',
            from: { emailAddress: { address: 'sender@example.com', name: 'Sender' } },
            toRecipients: [{ emailAddress: { address: 'recipient@example.com' } }],
            body: { contentType: 'text', content: 'Test body' },
            receivedDateTime: '2024-01-15T10:00:00Z',
            isRead: false,
            hasAttachments: false,
          },
        ],
        '@odata.count': 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.fetchEmails('test-token');

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].id).toBe('msg1');
      expect(result.emails[0].subject).toBe('Test Subject');
      expect(result.emails[0].from).toBe('sender@example.com');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const result = await provider.fetchEmails('invalid-token');

      expect(result.emails).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('401');
    });

    it('should apply date filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });

      const options: FetchOptions = {
        after: new Date('2024-01-01'),
        before: new Date('2024-01-31'),
      };

      await provider.fetchEmails('test-token', options);

      const callUrl = mockFetch.mock.calls[0][0];
      // URL params get encoded, so $filter becomes %24filter
      expect(callUrl).toContain('%24filter=');
      expect(callUrl).toContain('receivedDateTime');
    });

    it('should skip specified IDs', async () => {
      const mockResponse = {
        value: [
          {
            id: 'msg1',
            subject: 'Test 1',
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [],
            body: { contentType: 'text', content: 'Body 1' },
            receivedDateTime: '2024-01-15T10:00:00Z',
            isRead: false,
            hasAttachments: false,
          },
          {
            id: 'msg2',
            subject: 'Test 2',
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [],
            body: { contentType: 'text', content: 'Body 2' },
            receivedDateTime: '2024-01-15T11:00:00Z',
            isRead: false,
            hasAttachments: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.fetchEmails('test-token', {
        skipIds: ['msg1'],
      });

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].id).toBe('msg2');
    });

    it('should strip HTML from body content', async () => {
      const mockResponse = {
        value: [
          {
            id: 'msg1',
            subject: 'Test',
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [],
            body: { contentType: 'html', content: '<html><body><p>Hello <b>World</b></p></body></html>' },
            receivedDateTime: '2024-01-15T10:00:00Z',
            isRead: false,
            hasAttachments: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.fetchEmails('test-token');

      expect(result.emails[0].body).toBe('Hello World');
      expect(result.emails[0].bodyHtml).toContain('<html>');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await provider.testConnection('valid-token');

      expect(result).toBe(true);
    });

    it('should return false on failed connection', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await provider.testConnection('invalid-token');

      expect(result).toBe(false);
    });
  });
});

describe('GoogleEmailProvider', () => {
  let provider: GoogleEmailProvider;

  beforeEach(() => {
    provider = new GoogleEmailProvider();
    mockFetch.mockReset();
  });

  describe('provider property', () => {
    it('should return "google"', () => {
      expect(provider.provider).toBe('google');
    });
  });

  describe('fetchEmails', () => {
    it('should fetch emails successfully', async () => {
      // First call: list messages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          messages: [{ id: 'msg1', threadId: 'thread1' }],
          resultSizeEstimate: 1,
        }),
      });

      // Second call: get message details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'msg1',
          threadId: 'thread1',
          labelIds: ['INBOX'],
          snippet: 'Test snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Date', value: 'Mon, 15 Jan 2024 10:00:00 +0000' },
            ],
            mimeType: 'text/plain',
            body: { data: 'VGVzdCBib2R5', size: 9 }, // base64 of "Test body"
          },
          internalDate: '1705312800000',
        }),
      });

      const result = await provider.fetchEmails('test-token');

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].id).toBe('msg1');
      expect(result.emails[0].subject).toBe('Test Subject');
    });

    it('should handle empty message list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [] }),
      });

      const result = await provider.fetchEmails('test-token');

      expect(result.emails).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      const result = await provider.fetchEmails('invalid-token');

      expect(result.emails).toHaveLength(0);
      expect(result.errors).toBeDefined();
    });

    it('should build Gmail query for date filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [] }),
      });

      const options: FetchOptions = {
        after: new Date('2024-01-01T00:00:00Z'),
        folders: ['inbox'],
      };

      await provider.fetchEmails('test-token', options);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('q=');
      // URL params get encoded, so after: becomes after%3A
      expect(callUrl).toContain('after%3A');
      expect(callUrl).toContain('in%3Ainbox');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await provider.testConnection('valid-token');

      expect(result).toBe(true);
    });

    it('should return false on failed connection', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await provider.testConnection('invalid-token');

      expect(result).toBe(false);
    });
  });
});

describe('createEmailProvider', () => {
  it('should create MicrosoftEmailProvider', () => {
    const provider = createEmailProvider('microsoft');
    expect(provider).toBeInstanceOf(MicrosoftEmailProvider);
  });

  it('should create GoogleEmailProvider', () => {
    const provider = createEmailProvider('google');
    expect(provider).toBeInstanceOf(GoogleEmailProvider);
  });

  it('should throw for unknown provider', () => {
    // @ts-expect-error - Testing invalid input
    expect(() => createEmailProvider('unknown')).toThrow('Unknown email provider');
  });
});
