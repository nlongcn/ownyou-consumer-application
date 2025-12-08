/**
 * Types Tests - Sprint 8
 *
 * Tests for calendar data type definitions and constants.
 */

import { describe, it, expect } from 'vitest';
import {
  type CalendarEvent,
  type CalendarProfile,
  type EventType,
  type Attendee,
  type FrequentContact,
  DEFAULT_CALENDAR_CONFIG,
  EVENT_TYPE_KEYWORDS,
  EVENT_TYPE_TO_IAB,
} from '../types.js';

describe('CalendarEvent type', () => {
  it('should allow valid calendar event', () => {
    const event: CalendarEvent = {
      id: 'evt_001',
      providerId: 'google_abc123',
      provider: 'google',
      title: 'Team Meeting',
      description: 'Weekly sync',
      startTime: '2025-01-15T10:00:00Z',
      endTime: '2025-01-15T11:00:00Z',
      isAllDay: false,
      location: 'Conference Room A',
      attendees: [],
      organizer: null,
      eventType: 'meeting',
      recurring: false,
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(event.id).toBe('evt_001');
    expect(event.provider).toBe('google');
    expect(event.eventType).toBe('meeting');
  });

  it('should allow event with attendees', () => {
    const attendees: Attendee[] = [
      { email: 'alice@test.com', name: 'Alice', responseStatus: 'accepted' },
      { email: 'bob@test.com', name: 'Bob', responseStatus: 'tentative' },
    ];

    const event: CalendarEvent = {
      id: 'evt_002',
      providerId: 'microsoft_xyz789',
      provider: 'microsoft',
      title: 'Project Kickoff',
      description: null,
      startTime: '2025-01-16T14:00:00Z',
      endTime: '2025-01-16T15:00:00Z',
      isAllDay: false,
      location: null,
      attendees,
      organizer: attendees[0],
      eventType: 'meeting',
      recurring: false,
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(event.attendees.length).toBe(2);
    expect(event.organizer?.email).toBe('alice@test.com');
  });

  it('should allow all-day events', () => {
    const event: CalendarEvent = {
      id: 'evt_003',
      providerId: 'google_vacation',
      provider: 'google',
      title: 'Vacation',
      description: 'Beach trip',
      startTime: '2025-02-01T00:00:00Z',
      endTime: '2025-02-05T00:00:00Z',
      isAllDay: true,
      location: 'Miami',
      attendees: [],
      organizer: null,
      eventType: 'travel',
      recurring: false,
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(event.isAllDay).toBe(true);
    expect(event.eventType).toBe('travel');
  });

  it('should allow recurring events with pattern', () => {
    const event: CalendarEvent = {
      id: 'evt_004',
      providerId: 'google_standup',
      provider: 'google',
      title: 'Daily Standup',
      description: 'Quick sync',
      startTime: '2025-01-15T09:00:00Z',
      endTime: '2025-01-15T09:15:00Z',
      isAllDay: false,
      location: 'Zoom',
      attendees: [],
      organizer: null,
      eventType: 'meeting',
      recurring: true,
      recurringPattern: {
        frequency: 'daily',
        interval: 1,
      },
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(event.recurring).toBe(true);
    expect(event.recurringPattern?.frequency).toBe('daily');
  });
});

describe('CalendarProfile type', () => {
  it('should allow valid calendar profile', () => {
    const profile: CalendarProfile = {
      userId: 'user_123',
      lastSync: Date.now(),
      frequentContacts: [],
      sharedEvents: {},
      eventTypeDistribution: {
        meeting: 10,
        social: 5,
        appointment: 2,
        travel: 1,
        entertainment: 3,
        exercise: 8,
        learning: 2,
        volunteer: 1,
        personal: 4,
        unknown: 0,
      },
      busyTimes: [],
      freeWeekends: [],
      socialEvents: [],
      experienceEvents: [],
      volunteerEvents: [],
      totalEvents: 36,
      averageEventsPerWeek: 9,
      uniqueAttendees: 15,
    };

    expect(profile.userId).toBe('user_123');
    expect(profile.totalEvents).toBe(36);
  });

  it('should allow profile with frequent contacts', () => {
    const contact: FrequentContact = {
      email: 'colleague@work.com',
      name: 'Colleague',
      sharedEventCount: 12,
      lastSharedEvent: '2025-01-15T10:00:00Z',
      commonActivities: ['meeting', 'social'],
      relationshipStrength: 0.85,
    };

    const profile: CalendarProfile = {
      userId: 'user_456',
      lastSync: Date.now(),
      frequentContacts: [contact],
      sharedEvents: {
        'colleague@work.com': [
          { eventType: 'meeting', count: 8, lastOccurrence: '2025-01-15', averageDuration: 60 },
          { eventType: 'social', count: 4, lastOccurrence: '2025-01-10', averageDuration: 120 },
        ],
      },
      eventTypeDistribution: {
        meeting: 10,
        social: 5,
        appointment: 0,
        travel: 0,
        entertainment: 0,
        exercise: 0,
        learning: 0,
        volunteer: 0,
        personal: 0,
        unknown: 0,
      },
      busyTimes: [],
      freeWeekends: [],
      socialEvents: [],
      experienceEvents: [],
      volunteerEvents: [],
      totalEvents: 15,
      averageEventsPerWeek: 3.5,
      uniqueAttendees: 5,
    };

    expect(profile.frequentContacts.length).toBe(1);
    expect(profile.frequentContacts[0].relationshipStrength).toBe(0.85);
  });
});

describe('EventType', () => {
  it('should include all expected event types', () => {
    const types: EventType[] = [
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

    // Verify all types are valid by using them
    types.forEach(type => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('DEFAULT_CALENDAR_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CALENDAR_CONFIG.daysBack).toBe(30);
    expect(DEFAULT_CALENDAR_CONFIG.daysForward).toBe(90);
    expect(DEFAULT_CALENDAR_CONFIG.maxEventsPerRequest).toBe(250);
    expect(DEFAULT_CALENDAR_CONFIG.confidenceThreshold).toBe(0.5);
    expect(DEFAULT_CALENDAR_CONFIG.modelTier).toBe('fast');
  });

  it('should have relationship extraction defaults', () => {
    expect(DEFAULT_CALENDAR_CONFIG.minEventsForFrequentContact).toBe(3);
    expect(DEFAULT_CALENDAR_CONFIG.relationshipDecayDays).toBe(90);
  });

  it('should have free weekend detection defaults', () => {
    expect(DEFAULT_CALENDAR_CONFIG.weekendStartHour).toBe(8);
    expect(DEFAULT_CALENDAR_CONFIG.weekendEndHour).toBe(22);
    expect(DEFAULT_CALENDAR_CONFIG.minFreeHoursForFreeWeekend).toBe(16);
  });
});

describe('EVENT_TYPE_KEYWORDS', () => {
  it('should have keywords for all event types', () => {
    const types: EventType[] = [
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

    types.forEach(type => {
      expect(EVENT_TYPE_KEYWORDS[type]).toBeDefined();
      expect(Array.isArray(EVENT_TYPE_KEYWORDS[type])).toBe(true);
    });
  });

  it('should have meaningful keywords for meetings', () => {
    expect(EVENT_TYPE_KEYWORDS.meeting).toContain('meeting');
    expect(EVENT_TYPE_KEYWORDS.meeting).toContain('standup');
    expect(EVENT_TYPE_KEYWORDS.meeting).toContain('sync');
  });

  it('should have meaningful keywords for social events', () => {
    expect(EVENT_TYPE_KEYWORDS.social).toContain('dinner');
    expect(EVENT_TYPE_KEYWORDS.social).toContain('party');
    expect(EVENT_TYPE_KEYWORDS.social).toContain('happy hour');
  });

  it('should have meaningful keywords for exercise', () => {
    expect(EVENT_TYPE_KEYWORDS.exercise).toContain('gym');
    expect(EVENT_TYPE_KEYWORDS.exercise).toContain('yoga');
    expect(EVENT_TYPE_KEYWORDS.exercise).toContain('run');
  });
});

describe('EVENT_TYPE_TO_IAB', () => {
  it('should map all event types to IAB categories', () => {
    const types: EventType[] = [
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

    types.forEach(type => {
      expect(EVENT_TYPE_TO_IAB[type]).toBeDefined();
      expect(EVENT_TYPE_TO_IAB[type].tier1Id).toBeDefined();
      expect(EVENT_TYPE_TO_IAB[type].tier1Name).toBeDefined();
    });
  });

  it('should map travel to IAB20', () => {
    expect(EVENT_TYPE_TO_IAB.travel.tier1Id).toBe('IAB20');
    expect(EVENT_TYPE_TO_IAB.travel.tier1Name).toBe('Travel');
  });

  it('should map entertainment to IAB1', () => {
    expect(EVENT_TYPE_TO_IAB.entertainment.tier1Id).toBe('IAB1');
    expect(EVENT_TYPE_TO_IAB.entertainment.tier1Name).toBe('Arts & Entertainment');
  });

  it('should map exercise to IAB7', () => {
    expect(EVENT_TYPE_TO_IAB.exercise.tier1Id).toBe('IAB7');
    expect(EVENT_TYPE_TO_IAB.exercise.tier1Name).toBe('Health & Fitness');
  });

  it('should map learning to IAB5', () => {
    expect(EVENT_TYPE_TO_IAB.learning.tier1Id).toBe('IAB5');
    expect(EVENT_TYPE_TO_IAB.learning.tier1Name).toBe('Education');
  });
});

describe('Attendee type', () => {
  it('should allow all response statuses', () => {
    const statuses: Array<Attendee['responseStatus']> = [
      'accepted',
      'declined',
      'tentative',
      'needsAction',
    ];

    statuses.forEach(status => {
      const attendee: Attendee = {
        email: 'test@test.com',
        name: 'Test',
        responseStatus: status,
      };
      expect(attendee.responseStatus).toBe(status);
    });
  });
});
