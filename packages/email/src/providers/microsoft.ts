/**
 * Microsoft Graph Email Provider - Sprint 1b
 *
 * Fetches emails from Microsoft Graph API (Outlook/Office 365)
 */

import type { EmailProviderClient, Email, FetchOptions, FetchResult } from '../types';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Microsoft Graph email message response
 */
interface GraphMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  body: {
    contentType: string;
    content: string;
  };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

/**
 * Microsoft Graph list messages response
 */
interface GraphMessagesResponse {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
}

/**
 * Microsoft Graph Email Provider
 *
 * Uses Microsoft Graph API to fetch emails from Outlook/Office 365
 */
export class MicrosoftEmailProvider implements EmailProviderClient {
  readonly provider = 'microsoft' as const;

  /**
   * Fetch emails from Microsoft Graph API
   *
   * @param accessToken OAuth access token with Mail.Read scope
   * @param options Fetch options
   * @returns Fetch result with emails
   */
  async fetchEmails(accessToken: string, options?: FetchOptions): Promise<FetchResult> {
    const maxResults = options?.maxResults ?? 50;
    const errors: string[] = [];

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.set('$top', String(maxResults));
      params.set('$select', 'id,subject,from,toRecipients,body,receivedDateTime,isRead,hasAttachments');
      params.set('$orderby', 'receivedDateTime desc');

      // Add date filters if specified
      const filters: string[] = [];
      if (options?.after) {
        filters.push(`receivedDateTime ge ${options.after.toISOString()}`);
      }
      if (options?.before) {
        filters.push(`receivedDateTime le ${options.before.toISOString()}`);
      }
      if (filters.length > 0) {
        params.set('$filter', filters.join(' and '));
      }

      const url = `${GRAPH_API_BASE}/me/messages?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as GraphMessagesResponse;

      // Convert to our Email format
      const emails: Email[] = data.value
        .filter(msg => {
          // Skip if in skipIds
          if (options?.skipIds?.includes(msg.id)) {
            return false;
          }
          return true;
        })
        .map(msg => this.convertMessage(msg));

      return {
        emails,
        nextPageToken: data['@odata.nextLink'],
        totalCount: data['@odata.count'],
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Microsoft email fetch failed:', errorMessage);

      return {
        emails: [],
        errors: [errorMessage],
      };
    }
  }

  /**
   * Test connection to Microsoft Graph API
   *
   * @param accessToken OAuth access token
   * @returns True if connection successful
   */
  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${GRAPH_API_BASE}/me`, {
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
   * Convert Microsoft Graph message to our Email format
   */
  private convertMessage(msg: GraphMessage): Email {
    // Extract text from HTML body if content type is html
    let bodyText = msg.body.content;
    let bodyHtml: string | undefined;

    if (msg.body.contentType === 'html') {
      bodyHtml = msg.body.content;
      // Simple HTML to text conversion
      bodyText = this.stripHtml(msg.body.content);
    }

    return {
      id: msg.id,
      subject: msg.subject || '(No Subject)',
      from: msg.from?.emailAddress?.address || '',
      to: msg.toRecipients?.map(r => r.emailAddress?.address).filter(Boolean) || [],
      body: bodyText,
      bodyHtml,
      date: new Date(msg.receivedDateTime),
      metadata: {
        isRead: msg.isRead,
        hasAttachments: msg.hasAttachments,
      },
    };
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
