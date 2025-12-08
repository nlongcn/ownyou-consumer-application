/**
 * Calendar Store Persistence - Sprint 8
 *
 * Persists calendar events and profiles to LangGraph Store using v13 namespaces.
 * Compliant with v13 C2 (unconditional writes) and C1 (NS.* factory usage).
 */

import { NS } from '@ownyou/shared-types';
import {
  type CalendarEvent,
  type CalendarProfile,
  type CalendarSyncResult,
  type EventType,
  type FrequentContact,
  type SharedEventPattern,
  type TimePattern,
} from '../types.js';
import {
  extractFrequentContacts,
  extractSharedEventPatterns,
  detectBusyTimePatterns,
  detectFreeWeekends,
  getUniqueAttendeesCount,
  calculateAverageEventsPerWeek,
} from '../pipeline/relationship-extractor.js';
import { getIkigaiEvents, getEventTypeDistribution } from '../pipeline/classifier.js';

/**
 * Store interface (compatible with LangGraph Store)
 */
export interface Store {
  put(namespace: readonly string[], key: string, value: unknown): Promise<void>;
  get(namespace: readonly string[], key: string): Promise<unknown | null>;
  search(namespace: readonly string[]): Promise<{ key: string; value: unknown }[]>;
  delete(namespace: readonly string[], key: string): Promise<void>;
}

/**
 * Calendar store configuration
 */
export interface CalendarStoreConfig {
  minEventsForFrequentContact?: number;
  relationshipDecayDays?: number;
}

/**
 * Calendar store for persistence
 */
export class CalendarStore {
  private store: Store;
  private config: CalendarStoreConfig;

  constructor(store: Store, config: CalendarStoreConfig = {}) {
    this.store = store;
    this.config = {
      minEventsForFrequentContact: config.minEventsForFrequentContact ?? 3,
      relationshipDecayDays: config.relationshipDecayDays ?? 90,
    };
  }

  /**
   * Save calendar events to store (v13 C2 compliant - always writes)
   */
  async saveEvents(userId: string, events: CalendarEvent[]): Promise<void> {
    const namespace = NS.calendarEvents(userId);

    // Group events by date for efficient retrieval
    const eventsByDate = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const date = event.startTime.split('T')[0]; // ISO date part only
      const dateEvents = eventsByDate.get(date) || [];
      dateEvents.push(event);
      eventsByDate.set(date, dateEvents);
    }

    // Save each date group
    for (const [date, dateEvents] of eventsByDate) {
      await this.store.put(namespace, `date_${date}`, dateEvents);
    }

    // Save metadata (v13 C2: always write even if empty)
    const metadata = {
      isEmpty: events.length === 0,
      eventCount: events.length,
      dateRange: {
        earliest: events.length > 0 ? events[0].startTime : null,
        latest: events.length > 0 ? events[events.length - 1].startTime : null,
      },
      updatedAt: Date.now(),
    };

    await this.store.put(namespace, 'latest', metadata);
  }

  /**
   * Get all events for a user
   */
  async getEvents(userId: string): Promise<CalendarEvent[]> {
    const namespace = NS.calendarEvents(userId);
    const results = await this.store.search(namespace);

    const events: CalendarEvent[] = [];

    for (const result of results) {
      if (result.key.startsWith('date_') && Array.isArray(result.value)) {
        events.push(...(result.value as CalendarEvent[]));
      }
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return events;
  }

  /**
   * Get events in a date range
   */
  async getEventsInRange(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const events = await this.getEvents(userId);
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return events.filter(e => {
      const eventTime = new Date(e.startTime).getTime();
      return eventTime >= start && eventTime <= end;
    });
  }

  /**
   * Build and save calendar profile (v13 C2 compliant)
   */
  async saveProfile(userId: string, events: CalendarEvent[]): Promise<CalendarProfile> {
    const namespace = NS.calendarProfile(userId);

    // Extract relationship data
    const frequentContacts = extractFrequentContacts(events, this.config);
    const sharedEvents = extractSharedEventPatterns(events);
    const busyTimes = detectBusyTimePatterns(events);
    const freeWeekends = detectFreeWeekends(events, this.config);

    // Get event type distribution
    const eventTypeDistribution = getEventTypeDistribution(events);

    // Get Ikigai-relevant events
    const { socialEvents, experienceEvents, volunteerEvents } = getIkigaiEvents(events);

    // Build profile
    const profile: CalendarProfile = {
      userId,
      lastSync: Date.now(),
      frequentContacts,
      sharedEvents,
      eventTypeDistribution,
      busyTimes,
      freeWeekends,
      socialEvents,
      experienceEvents,
      volunteerEvents,
      totalEvents: events.length,
      averageEventsPerWeek: calculateAverageEventsPerWeek(events),
      uniqueAttendees: getUniqueAttendeesCount(events),
    };

    // Save profile (v13 C2: unconditional write)
    await this.store.put(namespace, 'profile', profile);

    return profile;
  }

  /**
   * Get calendar profile for a user
   */
  async getProfile(userId: string): Promise<CalendarProfile | null> {
    const namespace = NS.calendarProfile(userId);
    const profile = await this.store.get(namespace, 'profile');
    return profile as CalendarProfile | null;
  }

  /**
   * Record sync result
   */
  async recordSync(userId: string, result: CalendarSyncResult): Promise<void> {
    const namespace = NS.calendarEvents(userId);

    // Get existing sync history
    const existing = (await this.store.get(namespace, 'sync_history')) as CalendarSyncResult[] | null;
    const history = existing || [];

    // Add new result
    history.unshift(result);

    // Keep only last 10 syncs
    const trimmed = history.slice(0, 10);

    await this.store.put(namespace, 'sync_history', trimmed);
  }

  /**
   * Get sync history
   */
  async getSyncHistory(userId: string): Promise<CalendarSyncResult[]> {
    const namespace = NS.calendarEvents(userId);
    const history = await this.store.get(namespace, 'sync_history');
    return (history as CalendarSyncResult[]) || [];
  }

  /**
   * Delete all calendar data for a user
   */
  async deleteUserData(userId: string): Promise<void> {
    const eventsNamespace = NS.calendarEvents(userId);
    const profileNamespace = NS.calendarProfile(userId);

    // Get all event keys and delete
    const eventResults = await this.store.search(eventsNamespace);
    for (const result of eventResults) {
      await this.store.delete(eventsNamespace, result.key);
    }

    // Delete profile
    await this.store.delete(profileNamespace, 'profile');
  }
}

/**
 * Create a calendar store
 */
export function createCalendarStore(store: Store, config?: CalendarStoreConfig): CalendarStore {
  return new CalendarStore(store, config);
}
