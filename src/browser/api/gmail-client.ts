/**
 * Gmail API TypeScript Client
 *
 * Browser-based Gmail API client using OAuth tokens from extension.
 * Provides methods for fetching messages, handling pagination, and batch requests.
 *
 * Gmail API Documentation: https://developers.google.com/gmail/api
 */

export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet: string
  payload?: GmailPayload
  sizeEstimate?: number
  historyId?: string
  internalDate?: string
  raw?: string  // Base64-encoded RFC 2822 message
}

export interface GmailPayload {
  partId?: string
  mimeType: string
  filename?: string
  headers: GmailHeader[]
  body?: GmailBody
  parts?: GmailPayload[]
}

export interface GmailHeader {
  name: string
  value: string
}

export interface GmailBody {
  attachmentId?: string
  size: number
  data?: string  // Base64-encoded body data
}

export interface GmailMessagesListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

export interface GmailBatchRequest {
  messageId: string
  format?: 'full' | 'metadata' | 'minimal' | 'raw'
}

export interface GmailBatchResponse {
  messageId: string
  message?: GmailMessage
  error?: { code: number; message: string }
}

export class GmailClient {
  private readonly BASE_URL = 'https://gmail.googleapis.com/gmail/v1'
  private readonly DEFAULT_MAX_RESULTS = 100
  private readonly BATCH_SIZE = 50  // Gmail API allows up to 100, but 50 is safer

  constructor(private accessToken: string) {}

  /**
   * List messages with optional query and pagination
   *
   * @param query Gmail search query (e.g., "is:unread", "from:example@gmail.com")
   * @param maxResults Maximum number of messages to return (1-500, default 100)
   * @param pageToken Token for pagination
   * @returns List of message IDs and next page token
   */
  async listMessages(
    query?: string,
    maxResults: number = this.DEFAULT_MAX_RESULTS,
    pageToken?: string
  ): Promise<GmailMessagesListResponse> {
    const params = new URLSearchParams({
      maxResults: Math.min(maxResults, 500).toString()
    })

    if (query) {
      params.append('q', query)
    }

    if (pageToken) {
      params.append('pageToken', pageToken)
    }

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/users/me/messages?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get a single message by ID
   *
   * @param messageId Gmail message ID
   * @param format Message format (full=all data, metadata=headers only, minimal=IDs only, raw=RFC 2822)
   * @returns Message object
   */
  async getMessage(
    messageId: string,
    format: 'full' | 'metadata' | 'minimal' | 'raw' = 'full'
  ): Promise<GmailMessage> {
    const params = new URLSearchParams({ format })

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/users/me/messages/${messageId}?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Fetch multiple messages in batch (optimized)
   *
   * Gmail API supports up to 100 batch requests per call.
   * This method automatically chunks requests into batches.
   *
   * @param requests Array of message IDs with optional format
   * @returns Array of messages with error handling per message
   */
  async batchGetMessages(
    requests: GmailBatchRequest[]
  ): Promise<GmailBatchResponse[]> {
    const results: GmailBatchResponse[] = []

    // Process in chunks of BATCH_SIZE
    for (let i = 0; i < requests.length; i += this.BATCH_SIZE) {
      const chunk = requests.slice(i, i + this.BATCH_SIZE)
      const chunkResults = await this.processBatch(chunk)
      results.push(...chunkResults)
    }

    return results
  }

  /**
   * Process a single batch of messages (internal)
   */
  private async processBatch(
    requests: GmailBatchRequest[]
  ): Promise<GmailBatchResponse[]> {
    // Use Promise.allSettled for parallel requests with individual error handling
    const promises = requests.map(async (req) => {
      try {
        const message = await this.getMessage(req.messageId, req.format || 'full')
        return {
          messageId: req.messageId,
          message
        }
      } catch (error) {
        return {
          messageId: req.messageId,
          error: {
            code: 500,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    })

    const results = await Promise.allSettled(promises)

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          messageId: requests[index].messageId,
          error: {
            code: 500,
            message: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          }
        }
      }
    })
  }

  /**
   * Fetch all messages matching query (handles pagination automatically)
   *
   * WARNING: Can be slow and memory-intensive for large mailboxes.
   * Consider using listMessages() with pagination instead.
   *
   * @param query Gmail search query
   * @param maxMessages Maximum total messages to fetch (default: no limit)
   * @returns Array of message IDs
   */
  async fetchAllMessageIds(
    query?: string,
    maxMessages?: number
  ): Promise<string[]> {
    const allIds: string[] = []
    let pageToken: string | undefined

    while (true) {
      const response = await this.listMessages(query, 500, pageToken)

      if (response.messages) {
        const ids = response.messages.map(m => m.id)
        allIds.push(...ids)

        console.log(`[Gmail Client] Fetched ${ids.length} message IDs (total: ${allIds.length})`)

        // Check if we've reached the limit
        if (maxMessages && allIds.length >= maxMessages) {
          return allIds.slice(0, maxMessages)
        }
      }

      // Check if there are more pages
      if (!response.nextPageToken) {
        break
      }

      pageToken = response.nextPageToken
    }

    return allIds
  }

  /**
   * Extract email headers by name
   */
  getHeader(message: GmailMessage, headerName: string): string | undefined {
    if (!message.payload?.headers) {
      return undefined
    }

    const header = message.payload.headers.find(
      h => h.name.toLowerCase() === headerName.toLowerCase()
    )

    return header?.value
  }

  /**
   * Extract plain text body from message
   */
  getPlainTextBody(message: GmailMessage): string | undefined {
    if (!message.payload) {
      return undefined
    }

    // Try to find text/plain part
    const textPart = this.findPartByMimeType(message.payload, 'text/plain')

    if (textPart?.body?.data) {
      return this.decodeBase64(textPart.body.data)
    }

    return undefined
  }

  /**
   * Extract HTML body from message
   */
  getHtmlBody(message: GmailMessage): string | undefined {
    if (!message.payload) {
      return undefined
    }

    // Try to find text/html part
    const htmlPart = this.findPartByMimeType(message.payload, 'text/html')

    if (htmlPart?.body?.data) {
      return this.decodeBase64(htmlPart.body.data)
    }

    return undefined
  }

  /**
   * Find payload part by MIME type (recursive)
   */
  private findPartByMimeType(
    payload: GmailPayload,
    mimeType: string
  ): GmailPayload | undefined {
    if (payload.mimeType === mimeType) {
      return payload
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const found = this.findPartByMimeType(part, mimeType)
        if (found) {
          return found
        }
      }
    }

    return undefined
  }

  /**
   * Decode base64url-encoded string
   */
  private decodeBase64(data: string): string {
    // Gmail uses base64url encoding (RFC 4648 §5)
    // Replace URL-safe characters and add padding
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const base64Padded = base64 + padding

    try {
      // Decode base64 to binary string
      const binaryString = atob(base64Padded)

      // Convert binary string to UTF-8
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      return new TextDecoder().decode(bytes)
    } catch (error) {
      console.error('[Gmail Client] Error decoding base64:', error)
      return data  // Return raw data if decoding fails
    }
  }

  /**
   * Fetch with authorization header
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${this.accessToken}`)
    headers.set('Accept', 'application/json')

    return fetch(url, {
      ...options,
      headers
    })
  }

  /**
   * Update access token (for token refresh)
   */
  updateAccessToken(newToken: string): void {
    this.accessToken = newToken
  }
}
