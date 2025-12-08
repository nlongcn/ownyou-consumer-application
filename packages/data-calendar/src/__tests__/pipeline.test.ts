/**
 * Pipeline Tests - Sprint 8
 *
 * Tests for calendar pipeline components: normalizer, fetcher, classifier.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeGoogleEvent,
  normalizeMicrosoftEvent,
  classifyEventType,
  calculateEventDuration,
  isEventPast,
  getEventsOnDate,
  getWeekendEvents,
  getEventsByType,
} from '../pipeline/normalizer.js';
import { CalendarEventFetcher, createCalendarFetcher } from '../pipeline/fetcher.js';
import {
  CalendarEventClassifier,
  createCalendarClassifier,
  getIkigaiEvents,
  getEventTypeDistribution,
} from '../pipeline/classifier.js';
import type { CalendarEvent, GoogleCalendarEventRaw, MicrosoftCalendarEventRaw } from '../types.js';

describe('normalizeGoogleEvent', () => {
  it('should normalize basic Google event', () => {
    const raw: GoogleCalendarEventRaw = {
      id: 'google_123',
      summary: 'Team Meeting',
      description: 'Weekly sync',
      start: { dateTime: '2025-01-15T10:00:00Z' },
      end: { dateTime: '2025-01-15T11:00:00Z' },
      location: 'Conference Room A',
    };

    const event = normalizeGoogleEvent(raw);

    expect(event.id).toBe('google_google_123');
    expect(event.providerId).toBe('google_123');
    expect(event.provider).toBe('google');
    expect(event.title).toBe('Team Meeting');
    expect(event.description).toBe('Weekly sync');
    expect(event.startTime).toBe('2025-01-15T10:00:00Z');
    expect(event.endTime).toBe('2025-01-15T11:00:00Z');
    expect(event.location).toBe('Conference Room A');
    expect(event.isAllDay).toBe(false);
  });

  it('should handle all-day events', () => {
    const raw: GoogleCalendarEventRaw = {
      id: 'google_allday',
      summary: 'Vacation',
      start: { date: '2025-02-01' },
      end: { date: '2025-02-05' },
    };

    const event = normalizeGoogleEvent(raw);

    expect(event.isAllDay).toBe(true);
    expect(event.title).toBe('Vacation');
  });

  it('should normalize attendees', () => {
    const raw: GoogleCalendarEventRaw = {
      id: 'google_attendees',
      summary: 'Meeting with Team',
      start: { dateTime: '2025-01-15T10:00:00Z' },
      end: { dateTime: '2025-01-15T11:00:00Z' },
      attendees: [
        { email: 'alice@test.com', displayName: 'Alice', responseStatus: 'accepted' },
        { email: 'bob@test.com', responseStatus: 'tentative' },
      ],
      organizer: { email: 'alice@test.com', displayName: 'Alice' },
    };

    const event = normalizeGoogleEvent(raw);

    expect(event.attendees.length).toBe(2);
    expect(event.attendees[0].email).toBe('alice@test.com');
    expect(event.attendees[0].name).toBe('Alice');
    expect(event.attendees[0].responseStatus).toBe('accepted');
    expect(event.attendees[1].name).toBeNull();
    expect(event.organizer?.email).toBe('alice@test.com');
  });

  it('should handle missing optional fields', () => {
    const raw: GoogleCalendarEventRaw = {
      id: 'google_minimal',
      start: { dateTime: '2025-01-15T10:00:00Z' },
      end: { dateTime: '2025-01-15T11:00:00Z' },
    };

    const event = normalizeGoogleEvent(raw);

    expect(event.title).toBe('Untitled Event');
    expect(event.description).toBeNull();
    expect(event.location).toBeNull();
    expect(event.attendees).toEqual([]);
    expect(event.organizer).toBeNull();
  });
});

describe('normalizeMicrosoftEvent', () => {
  it('should normalize basic Microsoft event', () => {
    const raw: MicrosoftCalendarEventRaw = {
      id: 'msft_123',
      subject: 'Project Review',
      body: { content: 'Quarterly review', contentType: 'text' },
      start: { dateTime: '2025-01-15T14:00:00Z' },
      end: { dateTime: '2025-01-15T15:00:00Z' },
      location: { displayName: 'Teams Call' },
      isAllDay: false,
    };

    const event = normalizeMicrosoftEvent(raw);

    expect(event.id).toBe('microsoft_msft_123');
    expect(event.providerId).toBe('msft_123');
    expect(event.provider).toBe('microsoft');
    expect(event.title).toBe('Project Review');
    expect(event.description).toBe('Quarterly review');
    expect(event.location).toBe('Teams Call');
    expect(event.isAllDay).toBe(false);
  });

  it('should normalize Microsoft attendees', () => {
    const raw: MicrosoftCalendarEventRaw = {
      id: 'msft_attendees',
      subject: 'Team Sync',
      start: { dateTime: '2025-01-15T10:00:00Z' },
      end: { dateTime: '2025-01-15T11:00:00Z' },
      attendees: [
        {
          emailAddress: { name: 'Carol', address: 'carol@test.com' },
          status: { response: 'accepted' },
          type: 'required',
        },
        {
          emailAddress: { address: 'dave@test.com' },
          status: { response: 'tentativelyAccepted' },
          type: 'optional',
        },
      ],
      organizer: { emailAddress: { name: 'Carol', address: 'carol@test.com' } },
    };

    const event = normalizeMicrosoftEvent(raw);

    expect(event.attendees.length).toBe(2);
    expect(event.attendees[0].email).toBe('carol@test.com');
    expect(event.attendees[0].responseStatus).toBe('accepted');
    expect(event.attendees[1].responseStatus).toBe('tentative');
    expect(event.attendees[1].isOptional).toBe(true);
  });
});

describe('classifyEventType', () => {
  it('should classify meeting events', () => {
    expect(classifyEventType('Weekly Team Meeting', '', '')).toBe('meeting');
    expect(classifyEventType('Sprint Planning', '', '')).toBe('meeting');
    expect(classifyEventType('1:1 with Manager', '', '')).toBe('meeting');
    expect(classifyEventType('Daily Standup', '', '')).toBe('meeting');
  });

  it('should classify social events', () => {
    expect(classifyEventType('Dinner with Friends', '', '')).toBe('social');
    expect(classifyEventType('Birthday Party', '', '')).toBe('social');
    expect(classifyEventType('Happy Hour', '', '')).toBe('social');
    expect(classifyEventType('Coffee catch up', '', '')).toBe('social');
  });

  it('should classify exercise events', () => {
    expect(classifyEventType('Morning Run', '', '')).toBe('exercise');
    expect(classifyEventType('Yoga Class', '', '')).toBe('exercise');
    expect(classifyEventType('Gym Session', '', '')).toBe('exercise');
  });

  it('should classify travel events', () => {
    expect(classifyEventType('Flight to NYC', '', '')).toBe('travel');
    expect(classifyEventType('Vacation', '', '')).toBe('travel');
    expect(classifyEventType('Hotel Check-in', '', '')).toBe('travel');
  });

  it('should classify entertainment events', () => {
    expect(classifyEventType('Concert', '', '')).toBe('entertainment');
    expect(classifyEventType('Movie Night', '', '')).toBe('entertainment');
    expect(classifyEventType('Theater Show', '', '')).toBe('entertainment');
  });

  it('should classify appointment events', () => {
    expect(classifyEventType('Dentist Appointment', '', '')).toBe('appointment');
    expect(classifyEventType('Doctor Checkup', '', '')).toBe('appointment');
    expect(classifyEventType('Haircut', '', '')).toBe('appointment');
  });

  it('should classify volunteer events', () => {
    expect(classifyEventType('Volunteer at Food Bank', '', '')).toBe('volunteer');
    expect(classifyEventType('Charity Event', '', '')).toBe('volunteer');
  });

  it('should classify learning events', () => {
    expect(classifyEventType('Online Course', '', '')).toBe('learning');
    expect(classifyEventType('Workshop', '', '')).toBe('learning');
    expect(classifyEventType('Webinar', '', '')).toBe('learning');
  });

  it('should return unknown for unclassifiable events', () => {
    expect(classifyEventType('TBD', '', '')).toBe('unknown');
    expect(classifyEventType('Random Event', '', '')).toBe('unknown');
  });

  it('should consider description and location', () => {
    // Location can help classify
    expect(classifyEventType('Event', '', 'Yoga Studio')).toBe('exercise');
    expect(classifyEventType('Event', 'This is a gym workout', '')).toBe('exercise');
  });
});

describe('calculateEventDuration', () => {
  it('should calculate duration in minutes', () => {
    const event: CalendarEvent = {
      id: 'test',
      providerId: 'test',
      provider: 'google',
      title: 'Test',
      description: null,
      startTime: '2025-01-15T10:00:00Z',
      endTime: '2025-01-15T11:30:00Z',
      isAllDay: false,
      location: null,
      attendees: [],
      organizer: null,
      eventType: 'meeting',
      recurring: false,
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(calculateEventDuration(event)).toBe(90); // 90 minutes
  });
});

describe('isEventPast', () => {
  it('should return true for past events', () => {
    const event: CalendarEvent = {
      id: 'test',
      providerId: 'test',
      provider: 'google',
      title: 'Past Event',
      description: null,
      startTime: '2020-01-15T10:00:00Z',
      endTime: '2020-01-15T11:00:00Z',
      isAllDay: false,
      location: null,
      attendees: [],
      organizer: null,
      eventType: 'meeting',
      recurring: false,
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(isEventPast(event)).toBe(true);
  });

  it('should return false for future events', () => {
    const futureDate = new Date(Date.now() + 86400000); // Tomorrow
    const event: CalendarEvent = {
      id: 'test',
      providerId: 'test',
      provider: 'google',
      title: 'Future Event',
      description: null,
      startTime: futureDate.toISOString(),
      endTime: new Date(futureDate.getTime() + 3600000).toISOString(),
      isAllDay: false,
      location: null,
      attendees: [],
      organizer: null,
      eventType: 'meeting',
      recurring: false,
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(isEventPast(event)).toBe(false);
  });
});

describe('getEventsOnDate', () => {
  it('should filter events for specific date', () => {
    const events: CalendarEvent[] = [
      createTestEvent('evt1', '2025-01-15T10:00:00Z'),
      createTestEvent('evt2', '2025-01-15T14:00:00Z'),
      createTestEvent('evt3', '2025-01-16T10:00:00Z'),
    ];

    const date = new Date('2025-01-15');
    const filtered = getEventsOnDate(events, date);

    expect(filtered.length).toBe(2);
    expect(filtered.map(e => e.id)).toContain('evt1');
    expect(filtered.map(e => e.id)).toContain('evt2');
  });
});

describe('getWeekendEvents', () => {
  it('should filter weekend events', () => {
    const events: CalendarEvent[] = [
      createTestEvent('evt1', '2025-01-13T10:00:00Z'), // Monday
      createTestEvent('evt2', '2025-01-18T10:00:00Z'), // Saturday
      createTestEvent('evt3', '2025-01-19T10:00:00Z'), // Sunday
    ];

    const weekendEvents = getWeekendEvents(events);

    expect(weekendEvents.length).toBe(2);
    expect(weekendEvents.map(e => e.id)).toContain('evt2');
    expect(weekendEvents.map(e => e.id)).toContain('evt3');
  });
});

describe('getEventsByType', () => {
  it('should filter events by type', () => {
    const events: CalendarEvent[] = [
      { ...createTestEvent('evt1', '2025-01-15T10:00:00Z'), eventType: 'meeting' },
      { ...createTestEvent('evt2', '2025-01-15T14:00:00Z'), eventType: 'social' },
      { ...createTestEvent('evt3', '2025-01-16T10:00:00Z'), eventType: 'meeting' },
    ];

    const meetings = getEventsByType(events, 'meeting');

    expect(meetings.length).toBe(2);
    expect(meetings.every(e => e.eventType === 'meeting')).toBe(true);
  });
});

describe('CalendarEventFetcher', () => {
  let fetcher: CalendarEventFetcher;

  beforeEach(() => {
    fetcher = createCalendarFetcher({ useMock: true });
  });

  it('should fetch events with mock client', async () => {
    const result = await fetcher.fetchEvents('access-token', 'user_123');

    expect(result.events).toBeInstanceOf(Array);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it('should fetch all events with pagination', async () => {
    const result = await fetcher.fetchAllEvents('access-token', 'user_123');

    expect(result.events).toBeInstanceOf(Array);
    expect(result.syncToken).toBeDefined();
  });

  it('should fetch upcoming events', async () => {
    const events = await fetcher.fetchUpcomingEvents('access-token', 'user_123', 30);

    expect(events).toBeInstanceOf(Array);

    const now = Date.now();
    for (const event of events) {
      const eventTime = new Date(event.startTime).getTime();
      expect(eventTime).toBeGreaterThanOrEqual(now - 24 * 60 * 60 * 1000); // Allow 1 day buffer
    }
  });
});

describe('CalendarEventClassifier', () => {
  let classifier: CalendarEventClassifier;

  beforeEach(() => {
    classifier = createCalendarClassifier();
  });

  it('should classify event with IAB category', async () => {
    const event = createTestEvent('evt1', '2025-01-15T10:00:00Z');
    event.title = 'Flight to New York';
    event.eventType = 'travel';

    const classified = await classifier.classify(event, 'user_123');

    expect(classified.iabClassification).toBeDefined();
    expect(classified.iabClassification?.category.tier1Id).toBe('IAB20');
    expect(classified.iabClassification?.category.tier1Name).toBe('Travel');
  });

  it('should set confidence based on event data', async () => {
    const eventWithDetails = createTestEvent('evt1', '2025-01-15T10:00:00Z');
    eventWithDetails.title = 'Team Meeting';
    eventWithDetails.eventType = 'meeting';
    eventWithDetails.location = 'Conference Room';
    eventWithDetails.attendees = [
      { email: 'alice@test.com', name: 'Alice', responseStatus: 'accepted' },
    ];

    const classified = await classifier.classify(eventWithDetails, 'user_123');

    expect(classified.iabClassification?.confidence).toBeGreaterThan(0.7);
  });

  it('should not classify if below confidence threshold', async () => {
    const strictClassifier = createCalendarClassifier({ confidenceThreshold: 1.0 });

    const event = createTestEvent('evt1', '2025-01-15T10:00:00Z');
    event.title = 'TBD';
    event.eventType = 'unknown';

    const classified = await strictClassifier.classify(event, 'user_123');

    expect(classified.iabClassification).toBeUndefined();
  });

  it('should classify batch of events', async () => {
    const events = [
      { ...createTestEvent('evt1', '2025-01-15T10:00:00Z'), eventType: 'meeting' as const },
      { ...createTestEvent('evt2', '2025-01-15T14:00:00Z'), eventType: 'social' as const },
    ];

    const classified = await classifier.classifyBatch(events, 'user_123');

    expect(classified.length).toBe(2);
    expect(classified[0].iabClassification).toBeDefined();
    expect(classified[1].iabClassification).toBeDefined();
  });
});

describe('getIkigaiEvents', () => {
  it('should extract Ikigai-relevant events', () => {
    const events: CalendarEvent[] = [
      { ...createTestEvent('evt1', '2025-01-15T10:00:00Z'), eventType: 'meeting' },
      { ...createTestEvent('evt2', '2025-01-15T14:00:00Z'), eventType: 'social' },
      { ...createTestEvent('evt3', '2025-01-16T10:00:00Z'), eventType: 'travel' },
      { ...createTestEvent('evt4', '2025-01-16T14:00:00Z'), eventType: 'volunteer' },
      { ...createTestEvent('evt5', '2025-01-17T10:00:00Z'), eventType: 'entertainment' },
    ];

    const ikigai = getIkigaiEvents(events);

    expect(ikigai.socialEvents.length).toBe(1);
    expect(ikigai.experienceEvents.length).toBe(2); // travel + entertainment
    expect(ikigai.volunteerEvents.length).toBe(1);
  });
});

describe('getEventTypeDistribution', () => {
  it('should count events by type', () => {
    const events: CalendarEvent[] = [
      { ...createTestEvent('evt1', '2025-01-15T10:00:00Z'), eventType: 'meeting' },
      { ...createTestEvent('evt2', '2025-01-15T14:00:00Z'), eventType: 'meeting' },
      { ...createTestEvent('evt3', '2025-01-16T10:00:00Z'), eventType: 'social' },
    ];

    const distribution = getEventTypeDistribution(events);

    expect(distribution.meeting).toBe(2);
    expect(distribution.social).toBe(1);
    expect(distribution.travel).toBe(0);
  });
});

// Helper function to create test events
function createTestEvent(id: string, startTime: string): CalendarEvent {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later

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
    eventType: 'meeting',
    recurring: false,
    fetchedAt: Date.now(),
    updatedAt: Date.now(),
  };
}
