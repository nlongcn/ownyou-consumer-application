/**
 * Google Gmail Email Provider - Sprint 1b
 *
 * Fetches emails from Gmail API
 */

import type { EmailProviderClient, Email, FetchOptions, FetchResult } from '../types';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

/**
 * Gmail message header
 */
interface GmailHeader {
  name: string;
  value: string;
}

/**
 * Gmail message part
 */
interface GmailPart {
  mimeType: string;
  body: {
    data?: string;
    size: number;
  };
  parts?: GmailPart[];
}

/**
 * Gmail message response
 */
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: GmailHeader[];
    mimeType: string;
    body: {
      data?: string;
      size: number;
    };
    parts?: GmailPart[];
  };
  internalDate: string;
}

/**
 * Gmail list messages response
 */
interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Google Gmail Email Provider
 *
 * Uses Gmail API to fetch emails from Gmail
 */
export class GoogleEmailProvider implements EmailProviderClient {
  readonly provider = 'google' as const;

  /**
   * Fetch emails from Gmail API
   *
   * @param accessToken OAuth access token with gmail.readonly scope
   * @param options Fetch options
   * @returns Fetch result with emails
   */
  async fetchEmails(accessToken: string, options?: FetchOptions): Promise<FetchResult> {
    const maxResults = options?.maxResults ?? 50;
    const errors: string[] = [];

    try {
      // Build query parameters for list
      const params = new URLSearchParams();
      params.set('maxResults', String(maxResults));

      // Build Gmail search query
      const queryParts: string[] = [];
      if (options?.after) {
        queryParts.push(`after:${Math.floor(options.after.getTime() / 1000)}`);
      }
      if (options?.before) {
        queryParts.push(`before:${Math.floor(options.before.getTime() / 1000)}`);
      }
      if (options?.folders && options.folders.length > 0) {
        queryParts.push(`in:${options.folders.join(' OR in:')}`);
      }
      if (queryParts.length > 0) {
        params.set('q', queryParts.join(' '));
      }

      // List message IDs
      const listUrl = `${GMAIL_API_BASE}/users/me/messages?${params.toString()}`;

      const listResponse = await fetch(listUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        throw new Error(`Gmail API error: ${listResponse.status} - ${errorText}`);
      }

      const listData = await listResponse.json() as GmailListResponse;

      if (!listData.messages || listData.messages.length === 0) {
        return {
          emails: [],
          totalCount: 0,
        };
      }

      // Filter out skipped IDs
      const messageIds = listData.messages
        .map(m => m.id)
        .filter(id => !options?.skipIds?.includes(id));

      // Fetch full message details in parallel (batch of 10)
      const emails: Email[] = [];
      const batchSize = 10;

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const batchEmails = await Promise.all(
          batch.map(id => this.fetchMessage(accessToken, id))
        );
        emails.push(...batchEmails.filter((e): e is Email => e !== null));
      }

      return {
        emails,
        nextPageToken: listData.nextPageToken,
        totalCount: listData.resultSizeEstimate,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Gmail fetch failed:', errorMessage);

      return {
        emails: [],
        errors: [errorMessage],
      };
    }
  }

  /**
   * Fetch single message details
   */
  private async fetchMessage(accessToken: string, messageId: string): Promise<Email | null> {
    try {
      const url = `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch message ${messageId}: ${response.status}`);
        return null;
      }

      const data = await response.json() as GmailMessage;
      return this.convertMessage(data);

    } catch (error) {
      console.warn(`Error fetching message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Test connection to Gmail API
   *
   * @param accessToken OAuth access token
   * @returns True if connection successful
   */
  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${GMAIL_API_BASE}/users/me/profile`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Convert Gmail message to our Email format
   */
  private convertMessage(msg: GmailMessage): Email {
    const headers = msg.payload.headers;

    // Extract headers
    const subject = this.getHeader(headers, 'Subject') || '(No Subject)';
    const from = this.getHeader(headers, 'From') || '';
    const to = this.getHeader(headers, 'To')?.split(',').map(s => s.trim()) || [];
    const dateStr = this.getHeader(headers, 'Date');

    // Extract body
    const { text, html } = this.extractBody(msg.payload);

    return {
      id: msg.id,
      subject,
      from: this.extractEmail(from),
      to: to.map(t => this.extractEmail(t)),
      body: text || msg.snippet || '',
      bodyHtml: html,
      date: dateStr ? new Date(dateStr) : new Date(parseInt(msg.internalDate)),
      metadata: {
        threadId: msg.threadId,
        labelIds: msg.labelIds,
      },
    };
  }

  /**
   * Get header value by name
   */
  private getHeader(headers: GmailHeader[], name: string): string | undefined {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value;
  }

  /**
   * Extract email address from "Name <email@example.com>" format
   */
  private extractEmail(str: string): string {
    const match = str.match(/<([^>]+)>/);
    return match ? match[1] : str.trim();
  }

  /**
   * Extract text and HTML body from message payload
   */
  private extractBody(payload: GmailMessage['payload']): { text?: string; html?: string } {
    let text: string | undefined;
    let html: string | undefined;

    const processPayload = (part: GmailPart | GmailMessage['payload']) => {
      if (part.body?.data) {
        const decoded = this.decodeBase64(part.body.data);
        if (part.mimeType === 'text/plain') {
          text = decoded;
        } else if (part.mimeType === 'text/html') {
          html = decoded;
        }
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          processPayload(subPart);
        }
      }
    };

    processPayload(payload);

    // If only HTML, convert to text
    if (!text && html) {
      text = this.stripHtml(html);
    }

    return { text, html };
  }

  /**
   * Decode base64url encoded string
   */
  private decodeBase64(data: string): string {
    // Gmail uses URL-safe base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    try {
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      // Fallback for non-UTF8
      return atob(base64);
    }
  }

  /**
   * Simple HTML to text conversion
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
