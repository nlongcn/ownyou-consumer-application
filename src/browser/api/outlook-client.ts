/**
 * Outlook Graph API TypeScript Client
 *
 * Browser-based Microsoft Graph API client for Outlook emails using OAuth tokens from extension.
 * Provides methods for fetching messages, handling pagination, and batch requests.
 *
 * Microsoft Graph Mail API Documentation: https://learn.microsoft.com/en-us/graph/api/resources/message
 */

export interface OutlookMessage {
  id: string
  subject: string
  bodyPreview: string
  body: OutlookItemBody
  from: OutlookRecipient
  toRecipients: OutlookRecipient[]
  ccRecipients?: OutlookRecipient[]
  bccRecipients?: OutlookRecipient[]
  replyTo?: OutlookRecipient[]
  sentDateTime: string  // ISO 8601
  receivedDateTime: string  // ISO 8601
  hasAttachments: boolean
  importance: 'low' | 'normal' | 'high'
  isRead: boolean
  isDraft: boolean
  internetMessageId?: string
  conversationId?: string
  parentFolderId?: string
  categories?: string[]
}

export interface OutlookItemBody {
  contentType: 'text' | 'html'
  content: string
}

export interface OutlookRecipient {
  emailAddress: OutlookEmailAddress
}

export interface OutlookEmailAddress {
  name?: string
  address: string
}

export interface OutlookMessagesListResponse {
  '@odata.context'?: string
  '@odata.nextLink'?: string
  value: OutlookMessage[]
}

export interface OutlookBatchRequest {
  id: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: unknown
}

export interface OutlookBatchResponse {
  responses: Array<{
    id: string
    status: number
    headers?: Record<string, string>
    body?: OutlookMessage | { error: { code: string; message: string } }
  }>
}

export class OutlookClient {
  private readonly BASE_URL = 'https://graph.microsoft.com/v1.0'
  private readonly DEFAULT_TOP = 100  // Max results per request
  private readonly BATCH_SIZE = 20  // Graph API allows up to 20 batch requests

  constructor(private accessToken: string) {}

  /**
   * List messages with optional filtering and pagination
   *
   * @param filter OData filter query (e.g., "isRead eq false", "from/emailAddress/address eq 'example@outlook.com'")
   * @param top Maximum number of messages to return (1-999, default 100)
   * @param skip Number of messages to skip (for pagination)
   * @param orderBy Sort order (e.g., "receivedDateTime desc")
   * @returns List of messages and next link for pagination
   */
  async listMessages(
    filter?: string,
    top: number = this.DEFAULT_TOP,
    skip?: number,
    orderBy: string = 'receivedDateTime desc'
  ): Promise<OutlookMessagesListResponse> {
    const params = new URLSearchParams({
      $top: Math.min(top, 999).toString(),
      $orderBy: orderBy
    })

    if (filter) {
      params.append('$filter', filter)
    }

    if (skip !== undefined) {
      params.append('$skip', skip.toString())
    }

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/me/messages?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get a single message by ID
   *
   * @param messageId Outlook message ID
   * @param select Comma-separated list of properties to return (e.g., "subject,from,receivedDateTime")
   * @returns Message object
   */
  async getMessage(
    messageId: string,
    select?: string
  ): Promise<OutlookMessage> {
    let url = `${this.BASE_URL}/me/messages/${messageId}`

    if (select) {
      url += `?$select=${select}`
    }

    const response = await this.fetchWithAuth(url)

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Fetch multiple messages in batch (optimized)
   *
   * Graph API supports up to 20 batch requests per call.
   * This method automatically chunks requests into batches.
   *
   * @param messageIds Array of message IDs to fetch
   * @returns Array of messages with error handling per message
   */
  async batchGetMessages(
    messageIds: string[]
  ): Promise<Array<{ messageId: string; message?: OutlookMessage; error?: string }>> {
    const results: Array<{ messageId: string; message?: OutlookMessage; error?: string }> = []

    // Process in chunks of BATCH_SIZE
    for (let i = 0; i < messageIds.length; i += this.BATCH_SIZE) {
      const chunk = messageIds.slice(i, i + this.BATCH_SIZE)
      const chunkResults = await this.processBatch(chunk)
      results.push(...chunkResults)
    }

    return results
  }

  /**
   * Process a single batch of messages (internal)
   */
  private async processBatch(
    messageIds: string[]
  ): Promise<Array<{ messageId: string; message?: OutlookMessage; error?: string }>> {
    // Build batch request
    const batchRequest: { requests: OutlookBatchRequest[] } = {
      requests: messageIds.map((id, index) => ({
        id: index.toString(),
        method: 'GET',
        url: `/me/messages/${id}`
      }))
    }

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/$batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchRequest)
      }
    )

    if (!response.ok) {
      throw new Error(`Outlook batch API error: ${response.status} ${response.statusText}`)
    }

    const batchResponse: OutlookBatchResponse = await response.json()

    // Map responses back to message IDs
    return batchResponse.responses.map((resp, index) => {
      const messageId = messageIds[index]

      if (resp.status === 200 && resp.body && !('error' in resp.body)) {
        return {
          messageId,
          message: resp.body as OutlookMessage
        }
      } else {
        const error = resp.body && 'error' in resp.body
          ? resp.body.error.message
          : `HTTP ${resp.status}`

        return {
          messageId,
          error
        }
      }
    })
  }

  /**
   * Fetch all messages matching filter (handles pagination automatically)
   *
   * WARNING: Can be slow and memory-intensive for large mailboxes.
   * Consider using listMessages() with pagination instead.
   *
   * @param filter OData filter query
   * @param maxMessages Maximum total messages to fetch (default: no limit)
   * @returns Array of messages
   */
  async fetchAllMessages(
    filter?: string,
    maxMessages?: number
  ): Promise<OutlookMessage[]> {
    const allMessages: OutlookMessage[] = []
    let nextLink: string | undefined

    while (true) {
      let response: OutlookMessagesListResponse

      if (nextLink) {
        // Use @odata.nextLink for pagination
        const res = await this.fetchWithAuth(nextLink)
        if (!res.ok) {
          throw new Error(`Outlook API error: ${res.status} ${res.statusText}`)
        }
        response = await res.json()
      } else {
        // First request
        response = await this.listMessages(filter, 999)
      }

      allMessages.push(...response.value)

      console.log(`[Outlook Client] Fetched ${response.value.length} messages (total: ${allMessages.length})`)

      // Check if we've reached the limit
      if (maxMessages && allMessages.length >= maxMessages) {
        return allMessages.slice(0, maxMessages)
      }

      // Check if there are more pages
      if (!response['@odata.nextLink']) {
        break
      }

      nextLink = response['@odata.nextLink']
    }

    return allMessages
  }

  /**
   * Search messages with query string
   *
   * @param query Search query (e.g., "from:sender@example.com", "subject:important")
   * @param top Maximum results
   * @returns Search results
   */
  async searchMessages(
    query: string,
    top: number = 50
  ): Promise<OutlookMessagesListResponse> {
    const params = new URLSearchParams({
      $search: `"${query}"`,
      $top: top.toString()
    })

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/me/messages?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`Outlook search API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get message count in mailbox
   */
  async getMessageCount(filter?: string): Promise<number> {
    const params = new URLSearchParams({
      $count: 'true',
      $top: '1'  // Minimal data transfer
    })

    if (filter) {
      params.append('$filter', filter)
    }

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/me/messages?${params.toString()}`,
      {
        headers: {
          'ConsistencyLevel': 'eventual'  // Required for $count
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data['@odata.count'] || 0
  }

  /**
   * Get plain text body from message
   */
  getPlainTextBody(message: OutlookMessage): string {
    if (message.body.contentType === 'text') {
      return message.body.content
    }

    // If HTML, strip tags (basic)
    return this.stripHtmlTags(message.body.content)
  }

  /**
   * Get HTML body from message
   */
  getHtmlBody(message: OutlookMessage): string {
    if (message.body.contentType === 'html') {
      return message.body.content
    }

    // If plain text, wrap in basic HTML
    return `<pre>${this.escapeHtml(message.body.content)}</pre>`
  }

  /**
   * Extract sender email address
   */
  getSenderEmail(message: OutlookMessage): string {
    return message.from.emailAddress.address
  }

  /**
   * Extract recipient email addresses
   */
  getRecipientEmails(message: OutlookMessage): string[] {
    return message.toRecipients.map(r => r.emailAddress.address)
  }

  /**
   * Strip HTML tags (basic implementation)
   */
  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * Fetch with authorization header
   */
  private async fetchWithAuth(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${this.accessToken}`)
    headers.set('Accept', 'application/json')

    // Merge headers
    const newOptions: RequestInit = {
      ...options,
      headers
    }

    return fetch(url, newOptions)
  }

  /**
   * Update access token (for token refresh)
   */
  updateAccessToken(newToken: string): void {
    this.accessToken = newToken
  }
}
