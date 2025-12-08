/**
 * Calendar Event Fetcher - Sprint 8
 *
 * Fetches calendar events from providers (mock or real)
 * and handles pagination.
 */

import {
  type CalendarEvent,
  type CalendarFetchResult,
  type CalendarPipelineConfig,
  DEFAULT_CALENDAR_CONFIG,
} from '../types.js';
import { createMockCalendarClient, type MockCalendarClient } from '../providers/mock.js';

/**
 * Calendar fetcher configuration
 */
export interface CalendarFetcherConfig {
  useMock?: boolean;
  daysBack?: number;
  daysForward?: number;
  maxEventsPerRequest?: number;
}

/**
 * Calendar event fetcher
 */
export class CalendarEventFetcher {
  private config: CalendarFetcherConfig;
  private mockClient?: MockCalendarClient;

  constructor(config: CalendarFetcherConfig = {}) {
    this.config = {
      useMock: config.useMock ?? true,
      daysBack: config.daysBack ?? DEFAULT_CALENDAR_CONFIG.daysBack,
      daysForward: config.daysForward ?? DEFAULT_CALENDAR_CONFIG.daysForward,
      maxEventsPerRequest: config.maxEventsPerRequest ?? DEFAULT_CALENDAR_CONFIG.maxEventsPerRequest,
    };

    if (this.config.useMock) {
      this.mockClient = createMockCalendarClient({
        eventCount: 100,
        daysRange: Math.max(this.config.daysBack || 30, this.config.daysForward || 90),
      });
    }
  }

  /**
   * Fetch events from the calendar provider
   */
  async fetchEvents(
    accessToken: string,
    userId: string,
    syncToken?: string
  ): Promise<CalendarFetchResult> {
    if (this.config.useMock && this.mockClient) {
      return this.mockClient.fetchEvents(syncToken);
    }

    // Real implementation would use Google/Microsoft APIs
    throw new Error('Real calendar providers not yet implemented. Use mock mode.');
  }

  /**
   * Fetch all events with pagination
   */
  async fetchAllEvents(accessToken: string, userId: string): Promise<{
    events: CalendarEvent[];
    syncToken?: string;
  }> {
    const allEvents: CalendarEvent[] = [];
    let syncToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchEvents(accessToken, userId, syncToken);
      allEvents.push(...result.events);
      syncToken = result.nextSyncToken;
      hasMore = result.hasMore;
    }

    return { events: allEvents, syncToken };
  }

  /**
   * Fetch events in a specific date range
   */
  async fetchEventsInRange(
    accessToken: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    if (this.config.useMock && this.mockClient) {
      return this.mockClient.getEventsInRange(startDate.toISOString(), endDate.toISOString());
    }

    throw new Error('Real calendar providers not yet implemented. Use mock mode.');
  }

  /**
   * Fetch upcoming events (next N days)
   */
  async fetchUpcomingEvents(
    accessToken: string,
    userId: string,
    days: number = 30
  ): Promise<CalendarEvent[]> {
    const startDate = new Date();
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    return this.fetchEventsInRange(accessToken, userId, startDate, endDate);
  }

  /**
   * Fetch past events (last N days)
   */
  async fetchPastEvents(
    accessToken: string,
    userId: string,
    days: number = 30
  ): Promise<CalendarEvent[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    return this.fetchEventsInRange(accessToken, userId, startDate, endDate);
  }
}

/**
 * Create a calendar fetcher
 */
export function createCalendarFetcher(config?: CalendarFetcherConfig): CalendarEventFetcher {
  return new CalendarEventFetcher(config);
}
