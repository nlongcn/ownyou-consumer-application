/**
 * Unit Tests for Gmail API Client
 *
 * Tests URL construction, batch processing, base64 decoding, and error handling
 * WITHOUT making actual API calls (mocking fetch)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GmailClient } from '../../../src/browser/api/gmail-client'

// Mock global fetch
global.fetch = vi.fn()

describe('GmailClient', () => {
  let client: GmailClient
  const mockToken = 'mock_access_token_12345'

  beforeEach(() => {
    client = new GmailClient(mockToken)
    vi.mocked(global.fetch).mockClear()
  })

  describe('listMessages', () => {
    it('should construct correct URL with query parameters', async () => {
      const mockResponse = {
        messages: [
          { id: 'msg1', threadId: 'thread1' },
          { id: 'msg2', threadId: 'thread2' }
        ],
        resultSizeEstimate: 2
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await client.listMessages('is:unread', 50, 'page_token_123')

      // Verify fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledTimes(1)
      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const url = callArgs[0] as string

      expect(url).toContain('https://gmail.googleapis.com/gmail/v1/users/me/messages')
      expect(url).toContain('maxResults=50')
      expect(url).toContain('q=is%3Aunread')
      expect(url).toContain('pageToken=page_token_123')

      // Verify authorization header
      const options = callArgs[1] as RequestInit
      expect((options.headers as Headers).get('Authorization')).toBe(`Bearer ${mockToken}`)

      // Verify response
      expect(result.messages).toHaveLength(2)
      expect(result.messages![0].id).toBe('msg1')
    })

    it('should enforce maximum maxResults of 500', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] })
      } as Response)

      await client.listMessages(undefined, 9999) // Try to request 9999

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).toContain('maxResults=500') // Should be capped at 500
    })

    it('should throw error on API failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      await expect(client.listMessages()).rejects.toThrow('Gmail API error: 401 Unauthorized')
    })
  })

  describe('getMessage', () => {
    it('should fetch single message with format parameter', async () => {
      const mockMessage = {
        id: 'msg123',
        threadId: 'thread123',
        snippet: 'Test message',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'Subject', value: 'Test Subject' },
            { name: 'From', value: 'sender@example.com' }
          ]
        }
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessage
      } as Response)

      const result = await client.getMessage('msg123', 'metadata')

      // Verify URL includes format parameter
      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).toContain('/users/me/messages/msg123')
      expect(url).toContain('format=metadata')

      expect(result.id).toBe('msg123')
      expect(result.snippet).toBe('Test message')
    })
  })

  describe('batchGetMessages', () => {
    it('should chunk requests into batches of 50', async () => {
      // Create 75 message requests (should result in 2 batches: 50 + 25)
      const requests = Array.from({ length: 75 }, (_, i) => ({
        messageId: `msg${i}`,
        format: 'metadata' as const
      }))

      // Mock successful responses for each individual getMessage call
      vi.mocked(global.fetch).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'mock_id',
            threadId: 'mock_thread',
            snippet: 'mock'
          })
        } as Response)
      )

      const results = await client.batchGetMessages(requests)

      // Verify 75 fetch calls were made (one per message)
      expect(global.fetch).toHaveBeenCalledTimes(75)

      // Verify all results returned
      expect(results).toHaveLength(75)
      expect(results[0].messageId).toBe('msg0')
      expect(results[74].messageId).toBe('msg74')
    })

    it('should handle individual message failures gracefully', async () => {
      const requests = [
        { messageId: 'msg1', format: 'full' as const },
        { messageId: 'msg2', format: 'full' as const },
        { messageId: 'msg3', format: 'full' as const }
      ]

      // Mock: msg1 success, msg2 fail, msg3 success
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'msg1', threadId: 'thread1', snippet: 'Success' })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'msg3', threadId: 'thread3', snippet: 'Success' })
        } as Response)

      const results = await client.batchGetMessages(requests)

      expect(results).toHaveLength(3)
      expect(results[0].message).toBeDefined()
      expect(results[0].message!.id).toBe('msg1')
      expect(results[1].error).toBeDefined()
      expect(results[1].error!.message).toContain('404')
      expect(results[2].message).toBeDefined()
      expect(results[2].message!.id).toBe('msg3')
    })
  })

  describe('fetchAllMessageIds', () => {
    it('should handle pagination correctly', async () => {
      // Mock first page
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [
            { id: 'msg1', threadId: 'thread1' },
            { id: 'msg2', threadId: 'thread2' }
          ],
          nextPageToken: 'page2_token'
        })
      } as Response)

      // Mock second page (no nextPageToken = last page)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [
            { id: 'msg3', threadId: 'thread3' }
          ]
        })
      } as Response)

      const ids = await client.fetchAllMessageIds('is:unread')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(ids).toEqual(['msg1', 'msg2', 'msg3'])
    })

    it('should respect maxMessages limit', async () => {
      // Mock page with 500 messages
      const mockMessages = Array.from({ length: 500 }, (_, i) => ({
        id: `msg${i}`,
        threadId: `thread${i}`
      }))

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: mockMessages,
          nextPageToken: 'page2_token'
        })
      } as Response)

      const ids = await client.fetchAllMessageIds(undefined, 250) // Limit to 250

      expect(ids).toHaveLength(250)
      expect(ids[0]).toBe('msg0')
      expect(ids[249]).toBe('msg249')
    })
  })

  describe('getHeader', () => {
    it('should extract header value case-insensitively', () => {
      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'Subject', value: 'Test Subject' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'Content-Type', value: 'text/html' }
          ]
        }
      }

      expect(client.getHeader(mockMessage, 'subject')).toBe('Test Subject')
      expect(client.getHeader(mockMessage, 'SUBJECT')).toBe('Test Subject')
      expect(client.getHeader(mockMessage, 'from')).toBe('sender@example.com')
      expect(client.getHeader(mockMessage, 'Non-Existent')).toBeUndefined()
    })

    it('should return undefined if no payload', () => {
      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test'
      }

      expect(client.getHeader(mockMessage, 'Subject')).toBeUndefined()
    })
  })

  describe('getPlainTextBody', () => {
    it('should extract plain text body from single part', () => {
      const plainTextBase64 = 'SGVsbG8gV29ybGQh' // "Hello World!" in base64url

      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'text/plain',
          headers: [],
          body: {
            size: 12,
            data: plainTextBase64
          }
        }
      }

      const result = client.getPlainTextBody(mockMessage)
      expect(result).toBe('Hello World!')
    })

    it('should extract plain text body from multipart message', () => {
      const plainTextBase64 = 'VGhpcyBpcyBwbGFpbiB0ZXh0' // "This is plain text"

      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'multipart/alternative',
          headers: [],
          parts: [
            {
              mimeType: 'text/plain',
              headers: [],
              body: {
                size: 18,
                data: plainTextBase64
              }
            },
            {
              mimeType: 'text/html',
              headers: [],
              body: {
                size: 30,
                data: 'PGh0bWw-PHAgPnRleHQ8L3A-PC9odG1sPg'
              }
            }
          ]
        }
      }

      const result = client.getPlainTextBody(mockMessage)
      expect(result).toBe('This is plain text')
    })

    it('should return undefined if no text/plain part found', () => {
      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'text/html',
          headers: [],
          body: {
            size: 20,
            data: 'PGh0bWw-dGVzdDwvaHRtbD4'
          }
        }
      }

      const result = client.getPlainTextBody(mockMessage)
      expect(result).toBeUndefined()
    })
  })

  describe('getHtmlBody', () => {
    it('should extract HTML body from single part', () => {
      const htmlBase64 = 'PGgxPkhlbGxvPC9oMT4' // "<h1>Hello</h1>" in base64url

      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'text/html',
          headers: [],
          body: {
            size: 14,
            data: htmlBase64
          }
        }
      }

      const result = client.getHtmlBody(mockMessage)
      expect(result).toBe('<h1>Hello</h1>')
    })

    it('should extract HTML body from nested multipart', () => {
      const htmlBase64 = 'PHA-SGVsbG88L3A-' // "<p>Hello</p>"

      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [],
          parts: [
            {
              mimeType: 'multipart/alternative',
              headers: [],
              parts: [
                {
                  mimeType: 'text/plain',
                  headers: [],
                  body: { size: 5, data: 'SGVsbG8' }
                },
                {
                  mimeType: 'text/html',
                  headers: [],
                  body: { size: 11, data: htmlBase64 }
                }
              ]
            }
          ]
        }
      }

      const result = client.getHtmlBody(mockMessage)
      expect(result).toBe('<p>Hello</p>')
    })
  })

  describe('base64 decoding', () => {
    it('should decode base64url with proper padding', () => {
      // Test various padding scenarios
      const testCases = [
        { encoded: 'SGVsbG8', decoded: 'Hello' }, // No padding needed
        { encoded: 'SGVsbG8h', decoded: 'Hello!' }, // 1 padding
        { encoded: 'SGVsbG8gV29ybGQ', decoded: 'Hello World' }, // 2 padding
        { encoded: 'VGVzdA', decoded: 'Test' } // No padding
      ]

      testCases.forEach(({ encoded, decoded }) => {
        const mockMessage = {
          id: 'msg1',
          threadId: 'thread1',
          snippet: 'test',
          payload: {
            mimeType: 'text/plain',
            headers: [],
            body: {
              size: decoded.length,
              data: encoded
            }
          }
        }

        const result = client.getPlainTextBody(mockMessage)
        expect(result).toBe(decoded)
      })
    })

    it('should handle URL-safe characters (- and _)', () => {
      // base64url uses - instead of + and _ instead of /
      const urlSafeBase64 = 'VGVzdC1fVGVzdA' // "Test-_Test"

      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'test',
        payload: {
          mimeType: 'text/plain',
          headers: [],
          body: {
            size: 10,
            data: urlSafeBase64
          }
        }
      }

      const result = client.getPlainTextBody(mockMessage)
      expect(result).toBeDefined()
    })
  })

  describe('updateAccessToken', () => {
    it('should update token and use it in subsequent requests', async () => {
      const newToken = 'new_token_67890'

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] })
      } as Response)

      client.updateAccessToken(newToken)
      await client.listMessages()

      const options = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
      expect((options.headers as Headers).get('Authorization')).toBe(`Bearer ${newToken}`)
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network failure'))

      await expect(client.listMessages()).rejects.toThrow('Network failure')
    })

    it('should handle malformed JSON responses', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      } as Response)

      await expect(client.listMessages()).rejects.toThrow('Invalid JSON')
    })
  })
})
