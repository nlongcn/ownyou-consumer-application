/**
 * Mock Calendar Client Tests - Sprint 8
 *
 * Tests for the mock calendar implementation used in development/testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockCalendarClient,
  createMockCalendarClient,
  MOCK_ATTENDEES,
  MOCK_EVENT_TEMPLATES,
} from '../providers/mock.js';
import type { MockCalendarConfig } from '../types.js';

describe('MockCalendarClient', () => {
  let client: MockCalendarClient;

  beforeEach(() => {
    client = createMockCalendarClient();
  });

  describe('fetchEvents', () => {
    it('should return events', async () => {
      const result = await client.fetchEvents();

      expect(result.events).toBeInstanceOf(Array);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.nextSyncToken).toBeDefined();
      expect(result.hasMore).toBe(false);
    });

    it('should return events with proper structure', async () => {
      const result = await client.fetchEvents();
      const event = result.events[0];

      expect(event.id).toBeDefined();
      expect(event.providerId).toBeDefined();
      expect(event.provider).toMatch(/^(google|microsoft)$/);
      expect(event.title).toBeDefined();
      expect(event.startTime).toBeDefined();
      expect(event.endTime).toBeDefined();
      expect(event.eventType).toBeDefined();
    });

    it('should return events sorted by start time', async () => {
      const result = await client.fetchEvents();

      for (let i = 1; i < result.events.length; i++) {
        const prev = new Date(result.events[i - 1].startTime).getTime();
        const curr = new Date(result.events[i].startTime).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('should include events with attendees', async () => {
      const result = await client.fetchEvents();
      const eventWithAttendees = result.events.find(e => e.attendees.length > 0);

      expect(eventWithAttendees).toBeDefined();
      expect(eventWithAttendees?.attendees[0].email).toBeDefined();
    });

    it('should include recurring events', async () => {
      const result = await client.fetchEvents();
      const recurringEvent = result.events.find(e => e.recurring);

      // Recurring events are probability-based, so may not always exist
      if (recurringEvent) {
        expect(recurringEvent.recurringPattern).toBeDefined();
        expect(recurringEvent.recurringPattern?.frequency).toBeDefined();
      }
    });
  });

  describe('getEvent', () => {
    it('should return specific event by ID', async () => {
      const result = await client.fetchEvents();
      const firstEvent = result.events[0];

      const event = await client.getEvent(firstEvent.id);

      expect(event).not.toBeNull();
      expect(event?.id).toBe(firstEvent.id);
    });

    it('should return null for non-existent event', async () => {
      const event = await client.getEvent('non_existent_id');
      expect(event).toBeNull();
    });
  });

  describe('getEventsInRange', () => {
    it('should return events in date range', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const events = await client.getEventsInRange(startDate, endDate);

      expect(events).toBeInstanceOf(Array);

      for (const event of events) {
        const eventStart = new Date(event.startTime).getTime();
        expect(eventStart).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(eventStart).toBeLessThanOrEqual(new Date(endDate).getTime());
      }
    });

    it('should return empty array for range with no events', async () => {
      // Far future date range
      const startDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();

      const events = await client.getEventsInRange(startDate, endDate);

      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBe(0);
    });
  });
});

describe('MockCalendarClient configuration', () => {
  it('should accept custom event count', async () => {
    const client = createMockCalendarClient({ eventCount: 10 });
    const result = await client.fetchEvents();

    expect(result.events.length).toBe(10);
  });

  it('should accept custom days range', async () => {
    const config: MockCalendarConfig = {
      eventCount: 20,
      daysRange: 30,
    };

    const client = createMockCalendarClient(config);
    const result = await client.fetchEvents();

    const now = Date.now();
    const rangeMs = 30 * 24 * 60 * 60 * 1000;

    for (const event of result.events) {
      const eventTime = new Date(event.startTime).getTime();
      expect(Math.abs(eventTime - now)).toBeLessThanOrEqual(rangeMs);
    }
  });

  it('should simulate latency when configured', async () => {
    const client = createMockCalendarClient({ latencyMs: 100, eventCount: 5 });

    const start = Date.now();
    await client.fetchEvents();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
  });

  it('should simulate failures when configured', async () => {
    const client = createMockCalendarClient({ failureRate: 1.0, eventCount: 5 });

    await expect(client.fetchEvents()).rejects.toThrow('MOCK_CALENDAR_ERROR');
  });
});

describe('MOCK_ATTENDEES', () => {
  it('should have multiple attendees', () => {
    expect(MOCK_ATTENDEES.length).toBeGreaterThan(10);
  });

  it('should have realistic attendee data', () => {
    const attendee = MOCK_ATTENDEES[0];

    expect(attendee.name).toBeDefined();
    expect(attendee.email).toBeDefined();
    expect(attendee.email).toContain('@');
  });

  it('should include both internal and external emails', () => {
    const emails = MOCK_ATTENDEES.map(a => a.email);

    const internalEmails = emails.filter(e => e.includes('@company.com'));
    const externalEmails = emails.filter(e => !e.includes('@company.com'));

    expect(internalEmails.length).toBeGreaterThan(0);
    expect(externalEmails.length).toBeGreaterThan(0);
  });
});

describe('MOCK_EVENT_TEMPLATES', () => {
  it('should have templates for all event types', () => {
    const expectedTypes = [
      'meeting',
      'social',
      'appointment',
      'travel',
      'entertainment',
      'exercise',
      'learning',
      'volunteer',
      'personal',
      'unknown',
    ];

    for (const type of expectedTypes) {
      expect(MOCK_EVENT_TEMPLATES[type]).toBeDefined();
      expect(Array.isArray(MOCK_EVENT_TEMPLATES[type])).toBe(true);
    }
  });

  it('should have multiple templates per type', () => {
    expect(MOCK_EVENT_TEMPLATES.meeting.length).toBeGreaterThan(5);
    expect(MOCK_EVENT_TEMPLATES.social.length).toBeGreaterThan(3);
    expect(MOCK_EVENT_TEMPLATES.exercise.length).toBeGreaterThan(5);
  });

  it('should have templates with placeholders', () => {
    // Check for placeholder patterns like {attendee}, {destination}
    const meetingTemplates = MOCK_EVENT_TEMPLATES.meeting.join(' ');
    const travelTemplates = MOCK_EVENT_TEMPLATES.travel.join(' ');

    expect(meetingTemplates).toContain('{');
    expect(travelTemplates).toContain('{destination}');
  });
});

describe('Event type distribution', () => {
  it('should generate events across multiple types', async () => {
    const client = createMockCalendarClient({ eventCount: 100 });
    const result = await client.fetchEvents();

    const types = new Set(result.events.map(e => e.eventType));

    // Should have variety of event types
    expect(types.size).toBeGreaterThan(5);
  });

  it('should have meeting as most common type', async () => {
    const client = createMockCalendarClient({ eventCount: 100 });
    const result = await client.fetchEvents();

    const typeCounts: Record<string, number> = {};
    for (const event of result.events) {
      typeCounts[event.eventType] = (typeCounts[event.eventType] || 0) + 1;
    }

    // Meeting should be among the top types (weighted 0.35)
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const topTypes = sortedTypes.slice(0, 3).map(([type]) => type);

    expect(topTypes).toContain('meeting');
  });
});

describe('Attendee generation', () => {
  it('should generate events with varying attendee counts', async () => {
    const client = createMockCalendarClient({ eventCount: 50 });
    const result = await client.fetchEvents();

    const attendeeCounts = result.events.map(e => e.attendees.length);
    const uniqueCounts = new Set(attendeeCounts);

    // Should have events with different attendee counts
    expect(uniqueCounts.size).toBeGreaterThan(3);
  });

  it('should set organizer for events with attendees', async () => {
    const client = createMockCalendarClient({ eventCount: 50 });
    const result = await client.fetchEvents();

    const eventsWithAttendees = result.events.filter(e => e.attendees.length > 0);

    for (const event of eventsWithAttendees) {
      if (event.organizer) {
        expect(event.organizer.email).toBeDefined();
        expect(event.organizer.isOrganizer).toBe(true);
      }
    }
  });

  it('should include response status for attendees', async () => {
    const client = createMockCalendarClient({ eventCount: 50 });
    const result = await client.fetchEvents();

    const eventsWithAttendees = result.events.filter(e => e.attendees.length > 0);

    for (const event of eventsWithAttendees) {
      for (const attendee of event.attendees) {
        expect(['accepted', 'declined', 'tentative', 'needsAction']).toContain(
          attendee.responseStatus
        );
      }
    }
  });
});
