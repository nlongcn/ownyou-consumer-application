/**
 * Relationship Extractor Tests - Sprint 8
 *
 * Tests for extracting relationship signals from calendar events.
 */

import { describe, it, expect } from 'vitest';
import {
  extractFrequentContacts,
  extractSharedEventPatterns,
  detectBusyTimePatterns,
  detectFreeWeekends,
  getUniqueAttendeesCount,
  calculateAverageEventsPerWeek,
} from '../pipeline/relationship-extractor.js';
import type { CalendarEvent, Attendee, EventType } from '../types.js';

describe('extractFrequentContacts', () => {
  it('should extract frequent contacts from events', () => {
    const events = createEventsWithAttendees([
      { email: 'alice@test.com', name: 'Alice', count: 5 },
      { email: 'bob@test.com', name: 'Bob', count: 3 },
      { email: 'carol@test.com', name: 'Carol', count: 1 },
    ]);

    const contacts = extractFrequentContacts(events, { minEventsForFrequentContact: 3 });

    expect(contacts.length).toBe(2); // Alice and Bob meet threshold
    expect(contacts[0].email).toBe('alice@test.com');
    expect(contacts[0].sharedEventCount).toBe(5);
  });

  it('should calculate relationship strength', () => {
    const events = createEventsWithAttendees([
      { email: 'frequent@test.com', name: 'Frequent', count: 10 },
    ]);

    const contacts = extractFrequentContacts(events, { minEventsForFrequentContact: 1 });

    expect(contacts.length).toBe(1);
    expect(contacts[0].relationshipStrength).toBeGreaterThan(0);
    expect(contacts[0].relationshipStrength).toBeLessThanOrEqual(1);
  });

  it('should track common activities', () => {
    const events: CalendarEvent[] = [
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
      createEventWithAttendee('alice@test.com', 'Alice', 'social'),
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
    ];

    const contacts = extractFrequentContacts(events, { minEventsForFrequentContact: 1 });

    expect(contacts.length).toBe(1);
    expect(contacts[0].commonActivities).toContain('meeting');
    expect(contacts[0].commonActivities).toContain('social');
  });

  it('should sort by relationship strength', () => {
    const events = createEventsWithAttendees([
      { email: 'occasional@test.com', name: 'Occasional', count: 3 },
      { email: 'frequent@test.com', name: 'Frequent', count: 10 },
    ]);

    const contacts = extractFrequentContacts(events, { minEventsForFrequentContact: 1 });

    // More frequent contact should have higher strength
    expect(contacts[0].sharedEventCount).toBeGreaterThan(contacts[1].sharedEventCount);
  });

  it('should return empty array when no contacts meet threshold', () => {
    const events = createEventsWithAttendees([
      { email: 'rare@test.com', name: 'Rare', count: 1 },
    ]);

    const contacts = extractFrequentContacts(events, { minEventsForFrequentContact: 5 });

    expect(contacts.length).toBe(0);
  });

  it('should handle events with no attendees', () => {
    const events: CalendarEvent[] = [
      createEvent('evt1', '2025-01-15T10:00:00Z', 'personal'),
    ];

    const contacts = extractFrequentContacts(events);

    expect(contacts.length).toBe(0);
  });
});

describe('extractSharedEventPatterns', () => {
  it('should extract event patterns per contact', () => {
    const events: CalendarEvent[] = [
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
      createEventWithAttendee('alice@test.com', 'Alice', 'social'),
    ];

    const patterns = extractSharedEventPatterns(events);

    expect(patterns['alice@test.com']).toBeDefined();
    expect(patterns['alice@test.com'].length).toBe(2); // meeting and social

    const meetingPattern = patterns['alice@test.com'].find(p => p.eventType === 'meeting');
    expect(meetingPattern?.count).toBe(2);
  });

  it('should track last occurrence', () => {
    const now = Date.now();
    const events: CalendarEvent[] = [
      createEventWithAttendeeAt('alice@test.com', 'Alice', 'meeting', now - 7 * 24 * 60 * 60 * 1000),
      createEventWithAttendeeAt('alice@test.com', 'Alice', 'meeting', now),
    ];

    const patterns = extractSharedEventPatterns(events);
    const meetingPattern = patterns['alice@test.com'].find(p => p.eventType === 'meeting');

    expect(meetingPattern?.lastOccurrence).toBeDefined();
  });

  it('should sort patterns by count', () => {
    const events: CalendarEvent[] = [
      createEventWithAttendee('alice@test.com', 'Alice', 'social'),
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
    ];

    const patterns = extractSharedEventPatterns(events);

    expect(patterns['alice@test.com'][0].eventType).toBe('meeting');
    expect(patterns['alice@test.com'][0].count).toBe(3);
  });
});

describe('detectBusyTimePatterns', () => {
  it('should detect recurring busy times', () => {
    // Create events on same day/time across multiple weeks
    const events: CalendarEvent[] = [];

    for (let week = 0; week < 8; week++) {
      const date = new Date('2025-01-13T10:00:00Z'); // Monday 10 AM
      date.setDate(date.getDate() + week * 7);
      events.push(createEvent(`evt_${week}`, date.toISOString(), 'meeting'));
    }

    const patterns = detectBusyTimePatterns(events);

    // Should detect Monday 10 AM as busy pattern
    const mondayPattern = patterns.find(p => p.dayOfWeek === 1 && p.startHour === 10);
    expect(mondayPattern).toBeDefined();
  });

  it('should include frequency in patterns', () => {
    const events: CalendarEvent[] = [];

    for (let week = 0; week < 4; week++) {
      const date = new Date('2025-01-13T09:00:00Z');
      date.setDate(date.getDate() + week * 7);
      events.push(createEvent(`evt_${week}`, date.toISOString(), 'meeting'));
    }

    const patterns = detectBusyTimePatterns(events);

    for (const pattern of patterns) {
      // Frequency is normalized by weeks, and can exceed 1 if multiple events
      // occur in the same time slot across the time range
      expect(pattern.frequency).toBeGreaterThan(0);
      expect(typeof pattern.frequency).toBe('number');
    }
  });

  it('should skip all-day events', () => {
    const events: CalendarEvent[] = [
      {
        ...createEvent('allday', '2025-01-15T00:00:00Z', 'travel'),
        isAllDay: true,
      },
    ];

    const patterns = detectBusyTimePatterns(events);

    // All-day event shouldn't create specific hour patterns
    expect(patterns.length).toBe(0);
  });
});

describe('detectFreeWeekends', () => {
  it('should detect weekends with no events', () => {
    // Create weekday events only
    const events: CalendarEvent[] = [
      createEvent('evt1', '2025-01-13T10:00:00Z', 'meeting'), // Monday
      createEvent('evt2', '2025-01-14T10:00:00Z', 'meeting'), // Tuesday
      createEvent('evt3', '2025-01-20T10:00:00Z', 'meeting'), // Monday
    ];

    const freeWeekends = detectFreeWeekends(events);

    // Weekend of Jan 18-19 should be free
    expect(freeWeekends.length).toBeGreaterThan(0);
  });

  it('should consider weekend with few events as free', () => {
    const events: CalendarEvent[] = [
      createEvent('weekday', '2025-01-13T10:00:00Z', 'meeting'),
      createEvent('weekend', '2025-01-18T10:00:00Z', 'social'), // 1 hour event on Saturday
    ];

    const freeWeekends = detectFreeWeekends(events, {
      minFreeHoursForFreeWeekend: 16,
    });

    // 1 hour event still leaves plenty of free time
    expect(freeWeekends.length).toBeGreaterThan(0);
  });

  it('should return empty when no date range', () => {
    const freeWeekends = detectFreeWeekends([]);
    expect(freeWeekends.length).toBe(0);
  });
});

describe('getUniqueAttendeesCount', () => {
  it('should count unique attendees', () => {
    const events: CalendarEvent[] = [
      createEventWithAttendee('alice@test.com', 'Alice', 'meeting'),
      createEventWithAttendee('bob@test.com', 'Bob', 'meeting'),
      createEventWithAttendee('alice@test.com', 'Alice', 'social'), // Duplicate
    ];

    const count = getUniqueAttendeesCount(events);

    expect(count).toBe(2);
  });

  it('should return 0 for events without attendees', () => {
    const events: CalendarEvent[] = [
      createEvent('evt1', '2025-01-15T10:00:00Z', 'personal'),
    ];

    const count = getUniqueAttendeesCount(events);

    expect(count).toBe(0);
  });
});

describe('calculateAverageEventsPerWeek', () => {
  it('should calculate average events per week', () => {
    const events: CalendarEvent[] = [];

    // Create 8 events over 4 weeks = 2 per week
    for (let i = 0; i < 8; i++) {
      const date = new Date('2025-01-01T10:00:00Z');
      date.setDate(date.getDate() + i * 3); // Every 3 days
      events.push(createEvent(`evt_${i}`, date.toISOString(), 'meeting'));
    }

    const avg = calculateAverageEventsPerWeek(events);

    // Should be approximately 2 events per week
    expect(avg).toBeGreaterThan(1);
    expect(avg).toBeLessThan(4);
  });

  it('should return 0 for empty events', () => {
    const avg = calculateAverageEventsPerWeek([]);
    expect(avg).toBe(0);
  });

  it('should handle single event', () => {
    const events: CalendarEvent[] = [
      createEvent('single', '2025-01-15T10:00:00Z', 'meeting'),
    ];

    const avg = calculateAverageEventsPerWeek(events);

    // Single event over 1 week minimum
    expect(avg).toBe(1);
  });
});

// Helper functions

function createEvent(id: string, startTime: string, eventType: EventType): CalendarEvent {
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

function createEventWithAttendee(
  email: string,
  name: string,
  eventType: EventType
): CalendarEvent {
  const event = createEvent(`evt_${Math.random()}`, new Date().toISOString(), eventType);
  event.attendees = [
    {
      email,
      name,
      responseStatus: 'accepted',
    },
  ];
  return event;
}

function createEventWithAttendeeAt(
  email: string,
  name: string,
  eventType: EventType,
  timestamp: number
): CalendarEvent {
  const event = createEvent(`evt_${Math.random()}`, new Date(timestamp).toISOString(), eventType);
  event.attendees = [
    {
      email,
      name,
      responseStatus: 'accepted',
    },
  ];
  return event;
}

function createEventsWithAttendees(
  attendeeSpecs: Array<{ email: string; name: string; count: number }>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const spec of attendeeSpecs) {
    for (let i = 0; i < spec.count; i++) {
      events.push(createEventWithAttendee(spec.email, spec.name, 'meeting'));
    }
  }

  return events;
}
