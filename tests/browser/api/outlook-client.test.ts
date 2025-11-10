/**
 * Unit Tests for Outlook Graph API Client
 *
 * Tests URL construction, batch processing, filtering, and error handling
 * WITHOUT making actual API calls (mocking fetch)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OutlookClient } from '../../../src/browser/api/outlook-client'

// Mock global fetch
global.fetch = vi.fn()

describe('OutlookClient', () => {
  let client: OutlookClient
  const mockToken = 'mock_outlook_token_12345'

  beforeEach(() => {
    client = new OutlookClient(mockToken)
    vi.mocked(global.fetch).mockClear()
  })

  describe('listMessages', () => {
    it('should construct correct URL with filter and pagination', async () => {
      const mockResponse = {
        '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/messages',
        value: [
          {
            id: 'msg1',
            subject: 'Test Subject 1',
            bodyPreview: 'Preview 1',
            body: { contentType: 'text', content: 'Body 1' },
            from: { emailAddress: { address: 'sender@example.com', name: 'Sender' } },
            toRecipients: [{ emailAddress: { address: 'recipient@example.com' } }],
            sentDateTime: '2025-01-10T10:00:00Z',
            receivedDateTime: '2025-01-10T10:01:00Z',
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            isDraft: false
          }
        ]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await client.listMessages('isRead eq false', 50, 10, 'receivedDateTime desc')

      // Verify fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledTimes(1)
      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const url = callArgs[0] as string

      expect(url).toContain('https://graph.microsoft.com/v1.0/me/messages')
      expect(url).toContain('%24top=50')
      expect(url).toContain('%24orderBy=receivedDateTime+desc')
      expect(url).toContain('%24filter=isRead+eq+false')
      expect(url).toContain('%24skip=10')

      // Verify authorization header
      const options = callArgs[1] as RequestInit
      expect((options.headers as Headers).get('Authorization')).toBe(`Bearer ${mockToken}`)

      // Verify response
      expect(result.value).toHaveLength(1)
      expect(result.value[0].id).toBe('msg1')
      expect(result.value[0].subject).toBe('Test Subject 1')
    })

    it('should enforce maximum $top of 999', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] })
      } as Response)

      await client.listMessages(undefined, 9999) // Try to request 9999

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).toContain('%24top=999') // Should be capped at 999
    })

    it('should throw error on API failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      await expect(client.listMessages()).rejects.toThrow('Outlook API error: 401 Unauthorized')
    })
  })

  describe('getMessage', () => {
    it('should fetch single message with select parameter', async () => {
      const mockMessage = {
        id: 'msg123',
        subject: 'Test Subject',
        bodyPreview: 'Test preview',
        body: { contentType: 'html', content: '<p>Test</p>' },
        from: { emailAddress: { address: 'sender@example.com', name: 'Sender' } },
        toRecipients: [{ emailAddress: { address: 'recipient@example.com' } }],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: true,
        importance: 'high',
        isRead: true,
        isDraft: false
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessage
      } as Response)

      const result = await client.getMessage('msg123', 'subject,from,receivedDateTime')

      // Verify URL includes $select parameter
      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).toContain('/me/messages/msg123')
      expect(url).toContain('$select=subject,from,receivedDateTime')

      expect(result.id).toBe('msg123')
      expect(result.subject).toBe('Test Subject')
    })

    it('should fetch message without select parameter', async () => {
      const mockMessage = {
        id: 'msg456',
        subject: 'Another Test',
        bodyPreview: 'Preview',
        body: { contentType: 'text', content: 'Text body' },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessage
      } as Response)

      const result = await client.getMessage('msg456')

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).not.toContain('$select')
      expect(result.id).toBe('msg456')
    })
  })

  describe('batchGetMessages', () => {
    it('should chunk requests into batches of 20', async () => {
      // Create 35 message requests (should result in 2 batches: 20 + 15)
      const messageIds = Array.from({ length: 35 }, (_, i) => `msg${i}`)

      // Mock batch responses
      const mockBatchResponse1 = {
        responses: Array.from({ length: 20 }, (_, i) => ({
          id: i.toString(),
          status: 200,
          body: {
            id: `msg${i}`,
            subject: `Subject ${i}`,
            bodyPreview: `Preview ${i}`,
            body: { contentType: 'text', content: 'Body' },
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [],
            sentDateTime: '2025-01-10T10:00:00Z',
            receivedDateTime: '2025-01-10T10:01:00Z',
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            isDraft: false
          }
        }))
      }

      const mockBatchResponse2 = {
        responses: Array.from({ length: 15 }, (_, i) => ({
          id: i.toString(),
          status: 200,
          body: {
            id: `msg${i + 20}`,
            subject: `Subject ${i + 20}`,
            bodyPreview: `Preview ${i + 20}`,
            body: { contentType: 'text', content: 'Body' },
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [],
            sentDateTime: '2025-01-10T10:00:00Z',
            receivedDateTime: '2025-01-10T10:01:00Z',
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            isDraft: false
          }
        }))
      }

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse1
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse2
        } as Response)

      const results = await client.batchGetMessages(messageIds)

      // Verify 2 batch requests were made
      expect(global.fetch).toHaveBeenCalledTimes(2)

      // Verify all results returned
      expect(results).toHaveLength(35)
      expect(results[0].messageId).toBe('msg0')
      expect(results[34].messageId).toBe('msg34')

      // Verify batch request structure
      const firstBatchUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(firstBatchUrl).toContain('/$batch')

      const firstBatchOptions = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
      expect(firstBatchOptions.method).toBe('POST')
      const headers = firstBatchOptions.headers as Headers
      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle individual message failures gracefully', async () => {
      const messageIds = ['msg1', 'msg2', 'msg3']

      // Mock batch response: msg1 success, msg2 fail, msg3 success
      const mockBatchResponse = {
        responses: [
          {
            id: '0',
            status: 200,
            body: {
              id: 'msg1',
              subject: 'Success 1',
              bodyPreview: 'Preview 1',
              body: { contentType: 'text', content: 'Body 1' },
              from: { emailAddress: { address: 'sender@example.com' } },
              toRecipients: [],
              sentDateTime: '2025-01-10T10:00:00Z',
              receivedDateTime: '2025-01-10T10:01:00Z',
              hasAttachments: false,
              importance: 'normal',
              isRead: false,
              isDraft: false
            }
          },
          {
            id: '1',
            status: 404,
            body: {
              error: {
                code: 'ResourceNotFound',
                message: 'Message not found'
              }
            }
          },
          {
            id: '2',
            status: 200,
            body: {
              id: 'msg3',
              subject: 'Success 3',
              bodyPreview: 'Preview 3',
              body: { contentType: 'text', content: 'Body 3' },
              from: { emailAddress: { address: 'sender@example.com' } },
              toRecipients: [],
              sentDateTime: '2025-01-10T10:00:00Z',
              receivedDateTime: '2025-01-10T10:01:00Z',
              hasAttachments: false,
              importance: 'normal',
              isRead: false,
              isDraft: false
            }
          }
        ]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBatchResponse
      } as Response)

      const results = await client.batchGetMessages(messageIds)

      expect(results).toHaveLength(3)
      expect(results[0].message).toBeDefined()
      expect(results[0].message!.id).toBe('msg1')
      expect(results[1].error).toBeDefined()
      expect(results[1].error).toContain('Message not found')
      expect(results[2].message).toBeDefined()
      expect(results[2].message!.id).toBe('msg3')
    })

    it('should handle batch API errors', async () => {
      const messageIds = ['msg1', 'msg2']

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response)

      await expect(client.batchGetMessages(messageIds)).rejects.toThrow(
        'Outlook batch API error: 500 Internal Server Error'
      )
    })
  })

  describe('fetchAllMessages', () => {
    it('should handle pagination with @odata.nextLink', async () => {
      // Mock first page
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'msg1',
              subject: 'Subject 1',
              bodyPreview: 'Preview 1',
              body: { contentType: 'text', content: 'Body 1' },
              from: { emailAddress: { address: 'sender@example.com' } },
              toRecipients: [],
              sentDateTime: '2025-01-10T10:00:00Z',
              receivedDateTime: '2025-01-10T10:01:00Z',
              hasAttachments: false,
              importance: 'normal',
              isRead: false,
              isDraft: false
            },
            {
              id: 'msg2',
              subject: 'Subject 2',
              bodyPreview: 'Preview 2',
              body: { contentType: 'text', content: 'Body 2' },
              from: { emailAddress: { address: 'sender@example.com' } },
              toRecipients: [],
              sentDateTime: '2025-01-10T10:00:00Z',
              receivedDateTime: '2025-01-10T10:01:00Z',
              hasAttachments: false,
              importance: 'normal',
              isRead: false,
              isDraft: false
            }
          ],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$skip=2'
        })
      } as Response)

      // Mock second page (no nextLink = last page)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: 'msg3',
              subject: 'Subject 3',
              bodyPreview: 'Preview 3',
              body: { contentType: 'text', content: 'Body 3' },
              from: { emailAddress: { address: 'sender@example.com' } },
              toRecipients: [],
              sentDateTime: '2025-01-10T10:00:00Z',
              receivedDateTime: '2025-01-10T10:01:00Z',
              hasAttachments: false,
              importance: 'normal',
              isRead: false,
              isDraft: false
            }
          ]
        })
      } as Response)

      const messages = await client.fetchAllMessages('isRead eq false')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(messages).toHaveLength(3)
      expect(messages[0].id).toBe('msg1')
      expect(messages[2].id).toBe('msg3')
    })

    it('should respect maxMessages limit', async () => {
      // Mock page with 999 messages
      const mockMessages = Array.from({ length: 999 }, (_, i) => ({
        id: `msg${i}`,
        subject: `Subject ${i}`,
        bodyPreview: `Preview ${i}`,
        body: { contentType: 'text', content: `Body ${i}` },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }))

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: mockMessages,
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$skip=999'
        })
      } as Response)

      const messages = await client.fetchAllMessages(undefined, 250) // Limit to 250

      expect(messages).toHaveLength(250)
      expect(messages[0].id).toBe('msg0')
      expect(messages[249].id).toBe('msg249')
    })
  })

  describe('searchMessages', () => {
    it('should construct search URL with query and top', async () => {
      const mockResponse = {
        value: [
          {
            id: 'msg1',
            subject: 'Important Email',
            bodyPreview: 'Search result preview',
            body: { contentType: 'text', content: 'Body' },
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [],
            sentDateTime: '2025-01-10T10:00:00Z',
            receivedDateTime: '2025-01-10T10:01:00Z',
            hasAttachments: false,
            importance: 'normal',
            isRead: false,
            isDraft: false
          }
        ]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await client.searchMessages('subject:important', 25)

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).toContain('%24search=%22subject%3Aimportant%22')
      expect(url).toContain('%24top=25')

      expect(result.value).toHaveLength(1)
      expect(result.value[0].subject).toBe('Important Email')
    })
  })

  describe('getMessageCount', () => {
    it('should request count with $count parameter', async () => {
      const mockResponse = {
        '@odata.count': 42,
        value: []
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const count = await client.getMessageCount('isRead eq false')

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(url).toContain('%24count=true')
      expect(url).toContain('%24top=1')
      expect(url).toContain('%24filter=isRead+eq+false')

      const options = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
      const headers = options.headers as Headers
      expect(headers.get('ConsistencyLevel')).toBe('eventual')

      expect(count).toBe(42)
    })

    it('should return 0 if no count in response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] })
      } as Response)

      const count = await client.getMessageCount()
      expect(count).toBe(0)
    })
  })

  describe('body extraction methods', () => {
    it('should extract plain text body when contentType is text', () => {
      const mockMessage = {
        id: 'msg1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: {
          contentType: 'text',
          content: 'Plain text content'
        },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      const result = client.getPlainTextBody(mockMessage)
      expect(result).toBe('Plain text content')
    })

    it('should strip HTML tags when contentType is html', () => {
      const mockMessage = {
        id: 'msg1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: {
          contentType: 'html',
          content: '<p>HTML &nbsp;content with&lt;tags&gt;&amp;entities</p>'
        },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      const result = client.getPlainTextBody(mockMessage)
      expect(result).toContain('HTML')
      expect(result).toContain('content')
      expect(result).not.toContain('<p>')
      expect(result).not.toContain('&nbsp;')
    })

    it('should extract HTML body when contentType is html', () => {
      const mockMessage = {
        id: 'msg1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: {
          contentType: 'html',
          content: '<h1>Hello</h1><p>World</p>'
        },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      const result = client.getHtmlBody(mockMessage)
      expect(result).toBe('<h1>Hello</h1><p>World</p>')
    })

    it('should wrap plain text in <pre> when contentType is text', () => {
      const mockMessage = {
        id: 'msg1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: {
          contentType: 'text',
          content: 'Plain <text> & "quotes"'
        },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      const result = client.getHtmlBody(mockMessage)
      expect(result).toContain('<pre>')
      expect(result).toContain('&lt;text&gt;')
      expect(result).toContain('&amp;')
      expect(result).toContain('&quot;')
    })
  })

  describe('email address extraction', () => {
    it('should extract sender email address', () => {
      const mockMessage = {
        id: 'msg1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: { contentType: 'text', content: 'Body' },
        from: {
          emailAddress: {
            name: 'John Doe',
            address: 'john.doe@example.com'
          }
        },
        toRecipients: [],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      const email = client.getSenderEmail(mockMessage)
      expect(email).toBe('john.doe@example.com')
    })

    it('should extract recipient email addresses', () => {
      const mockMessage = {
        id: 'msg1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: { contentType: 'text', content: 'Body' },
        from: { emailAddress: { address: 'sender@example.com' } },
        toRecipients: [
          { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
          { emailAddress: { name: 'Bob', address: 'bob@example.com' } }
        ],
        sentDateTime: '2025-01-10T10:00:00Z',
        receivedDateTime: '2025-01-10T10:01:00Z',
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        isDraft: false
      }

      const emails = client.getRecipientEmails(mockMessage)
      expect(emails).toHaveLength(2)
      expect(emails[0]).toBe('alice@example.com')
      expect(emails[1]).toBe('bob@example.com')
    })
  })

  describe('updateAccessToken', () => {
    it('should update token and use it in subsequent requests', async () => {
      const newToken = 'new_outlook_token_67890'

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] })
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
