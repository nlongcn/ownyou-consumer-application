/**
 * Store Persistence Tests - Sprint 8
 *
 * Tests for calendar data persistence to LangGraph Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NS } from '@ownyou/shared-types';
import { CalendarStore, createCalendarStore, type Store } from '../store/persistence.js';
import type { CalendarEvent, CalendarSyncResult, EventType } from '../types.js';

/**
 * Create a mock store for testing
 */
function createMockStore(): Store & {
  data: Map<string, Map<string, unknown>>;
  putCalls: { namespace: readonly string[]; key: string; value: unknown }[];
} {
  const data = new Map<string, Map<string, unknown>>();
  const putCalls: { namespace: readonly string[]; key: string; value: unknown }[] = [];

  return {
    data,
    putCalls,

    async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
      const nsKey = namespace.join('/');
      if (!data.has(nsKey)) {
        data.set(nsKey, new Map());
      }
      data.get(nsKey)!.set(key, value);
      putCalls.push({ namespace, key, value });
    },

    async get(namespace: readonly string[], key: string): Promise<unknown | null> {
      const nsKey = namespace.join('/');
      return data.get(nsKey)?.get(key) ?? null;
    },

    async search(namespace: readonly string[]): Promise<{ key: string; value: unknown }[]> {
      const nsKey = namespace.join('/');
      const nsData = data.get(nsKey);
      if (!nsData) return [];

      return Array.from(nsData.entries()).map(([key, value]) => ({ key, value }));
    },

    async delete(namespace: readonly string[], key: string): Promise<void> {
      const nsKey = namespace.join('/');
      data.get(nsKey)?.delete(key);
    },
  };
}

describe('CalendarStore', () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let calendarStore: CalendarStore;

  beforeEach(() => {
    mockStore = createMockStore();
    calendarStore = createCalendarStore(mockStore);
  });

  describe('saveEvents', () => {
    it('should save events using NS.calendarEvents namespace', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveEvents('user_123', events);

      const expectedNamespace = NS.calendarEvents('user_123');
      const putCalls = mockStore.putCalls.filter(
        call =>
          call.namespace[0] === expectedNamespace[0] && call.namespace[1] === expectedNamespace[1]
      );

      expect(putCalls.length).toBeGreaterThan(0);
    });

    it('should group events by date', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
        createTestEvent('evt_002', '2025-01-15T14:00:00Z', 'social'),
        createTestEvent('evt_003', '2025-01-16T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveEvents('user_123', events);

      const dateCalls = mockStore.putCalls.filter(c => c.key.startsWith('date_'));
      expect(dateCalls.length).toBe(2); // Two different dates
    });

    it('should store metadata', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveEvents('user_123', events);

      const latestCall = mockStore.putCalls.find(c => c.key === 'latest');
      expect(latestCall).toBeDefined();
      expect((latestCall?.value as { eventCount: number }).eventCount).toBe(1);
    });

    it('should write even when empty (v13 C2 compliance)', async () => {
      await calendarStore.saveEvents('user_123', []);

      const latestCall = mockStore.putCalls.find(c => c.key === 'latest');
      expect(latestCall).toBeDefined();
      expect((latestCall?.value as { isEmpty: boolean }).isEmpty).toBe(true);
      expect((latestCall?.value as { eventCount: number }).eventCount).toBe(0);
    });
  });

  describe('getEvents', () => {
    it('should retrieve all saved events', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
        createTestEvent('evt_002', '2025-01-16T10:00:00Z', 'social'),
      ];

      await calendarStore.saveEvents('user_123', events);
      const retrieved = await calendarStore.getEvents('user_123');

      expect(retrieved.length).toBe(2);
      expect(retrieved.map(e => e.id).sort()).toEqual(['evt_001', 'evt_002']);
    });

    it('should return empty array when no events', async () => {
      const retrieved = await calendarStore.getEvents('user_no_data');
      expect(retrieved).toEqual([]);
    });

    it('should return events sorted by start time', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_002', '2025-01-16T10:00:00Z', 'meeting'),
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveEvents('user_123', events);
      const retrieved = await calendarStore.getEvents('user_123');

      expect(retrieved[0].id).toBe('evt_001');
      expect(retrieved[1].id).toBe('evt_002');
    });
  });

  describe('getEventsInRange', () => {
    it('should return events within date range', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-10T10:00:00Z', 'meeting'),
        createTestEvent('evt_002', '2025-01-15T10:00:00Z', 'meeting'),
        createTestEvent('evt_003', '2025-01-20T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveEvents('user_123', events);
      const retrieved = await calendarStore.getEventsInRange(
        'user_123',
        '2025-01-12T00:00:00Z',
        '2025-01-18T00:00:00Z'
      );

      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe('evt_002');
    });
  });

  describe('saveProfile', () => {
    it('should build and save calendar profile', async () => {
      const events: CalendarEvent[] = [
        createTestEventWithAttendees('evt_001', '2025-01-15T10:00:00Z', 'meeting', [
          'alice@test.com',
          'bob@test.com',
        ]),
        createTestEventWithAttendees('evt_002', '2025-01-16T18:00:00Z', 'social', [
          'alice@test.com',
        ]),
      ];

      const profile = await calendarStore.saveProfile('user_123', events);

      expect(profile.userId).toBe('user_123');
      expect(profile.totalEvents).toBe(2);
      expect(profile.uniqueAttendees).toBe(2);
    });

    it('should extract frequent contacts', async () => {
      const events: CalendarEvent[] = [
        createTestEventWithAttendees('evt_001', '2025-01-15T10:00:00Z', 'meeting', ['alice@test.com']),
        createTestEventWithAttendees('evt_002', '2025-01-16T10:00:00Z', 'meeting', ['alice@test.com']),
        createTestEventWithAttendees('evt_003', '2025-01-17T10:00:00Z', 'meeting', ['alice@test.com']),
      ];

      const profile = await calendarStore.saveProfile('user_123', events);

      expect(profile.frequentContacts.length).toBe(1);
      expect(profile.frequentContacts[0].email).toBe('alice@test.com');
      expect(profile.frequentContacts[0].sharedEventCount).toBe(3);
    });

    it('should extract Ikigai events', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
        createTestEvent('evt_002', '2025-01-15T18:00:00Z', 'social'),
        createTestEvent('evt_003', '2025-01-16T10:00:00Z', 'travel'),
        createTestEvent('evt_004', '2025-01-17T10:00:00Z', 'volunteer'),
      ];

      const profile = await calendarStore.saveProfile('user_123', events);

      expect(profile.socialEvents.length).toBe(1);
      expect(profile.experienceEvents.length).toBe(1); // travel
      expect(profile.volunteerEvents.length).toBe(1);
    });

    it('should use NS.calendarProfile namespace', async () => {
      await calendarStore.saveProfile('user_123', []);

      const expectedNamespace = NS.calendarProfile('user_123');
      const putCall = mockStore.putCalls.find(
        call =>
          call.namespace[0] === expectedNamespace[0] &&
          call.namespace[1] === expectedNamespace[1] &&
          call.key === 'profile'
      );

      expect(putCall).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('should retrieve saved profile', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveProfile('user_123', events);
      const profile = await calendarStore.getProfile('user_123');

      expect(profile).not.toBeNull();
      expect(profile?.userId).toBe('user_123');
      expect(profile?.totalEvents).toBe(1);
    });

    it('should return null when no profile exists', async () => {
      const profile = await calendarStore.getProfile('user_no_profile');
      expect(profile).toBeNull();
    });
  });

  describe('recordSync', () => {
    it('should record sync results', async () => {
      const syncResult: CalendarSyncResult = {
        success: true,
        newEvents: 25,
        updatedEvents: 3,
        removedEvents: 1,
        classifiedCount: 23,
        syncedAt: Date.now(),
      };

      await calendarStore.recordSync('user_123', syncResult);

      const history = await calendarStore.getSyncHistory('user_123');
      expect(history.length).toBe(1);
      expect(history[0].newEvents).toBe(25);
    });

    it('should maintain sync history (max 10)', async () => {
      // Record 15 syncs
      for (let i = 0; i < 15; i++) {
        await calendarStore.recordSync('user_123', {
          success: true,
          newEvents: i,
          updatedEvents: 0,
          removedEvents: 0,
          classifiedCount: i,
          syncedAt: Date.now() + i,
        });
      }

      const history = await calendarStore.getSyncHistory('user_123');
      expect(history.length).toBe(10);
      // Most recent should be first
      expect(history[0].newEvents).toBe(14);
    });
  });

  describe('deleteUserData', () => {
    it('should delete all calendar data for user', async () => {
      const events: CalendarEvent[] = [
        createTestEvent('evt_001', '2025-01-15T10:00:00Z', 'meeting'),
      ];

      await calendarStore.saveEvents('user_123', events);
      await calendarStore.saveProfile('user_123', events);

      await calendarStore.deleteUserData('user_123');

      const retrievedEvents = await calendarStore.getEvents('user_123');
      const retrievedProfile = await calendarStore.getProfile('user_123');

      expect(retrievedEvents.length).toBe(0);
      expect(retrievedProfile).toBeNull();
    });
  });
});

describe('createCalendarStore', () => {
  it('should create a store with default config', () => {
    const mockStore = createMockStore();
    const store = createCalendarStore(mockStore);
    expect(store).toBeInstanceOf(CalendarStore);
  });

  it('should accept custom config', () => {
    const mockStore = createMockStore();
    const store = createCalendarStore(mockStore, {
      minEventsForFrequentContact: 5,
      relationshipDecayDays: 60,
    });
    expect(store).toBeInstanceOf(CalendarStore);
  });
});

// Helper functions

function createTestEvent(id: string, startTime: string, eventType: EventType): CalendarEvent {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    id,
    providerId: id,
    provider: 'google',
    title: 'Test Event',
    description: null,
    startTime,
    endTime: end.toISOString(),
    isAllDay: false,
    location: null,
    attendees: [],
    organizer: null,
    eventType,
    recurring: false,
    fetchedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createTestEventWithAttendees(
  id: string,
  startTime: string,
  eventType: EventType,
  emails: string[]
): CalendarEvent {
  const event = createTestEvent(id, startTime, eventType);
  event.attendees = emails.map(email => ({
    email,
    name: email.split('@')[0],
    responseStatus: 'accepted' as const,
  }));
  return event;
}
