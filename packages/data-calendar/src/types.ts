/**
 * Calendar Data Types - Sprint 8
 *
 * Type definitions for calendar event processing, relationship extraction,
 * and IAB classification of calendar data.
 */

import type { IABClassification } from '@ownyou/iab-classifier';

/**
 * Calendar provider types
 */
export type CalendarProvider = 'google' | 'microsoft';

/**
 * Event type classification
 */
export type EventType =
  | 'meeting' // Work meetings
  | 'social' // Dinners, parties
  | 'appointment' // Doctor, haircut
  | 'travel' // Flights, trips
  | 'entertainment' // Concerts, movies
  | 'exercise' // Gym, sports
  | 'learning' // Classes, workshops
  | 'volunteer' // Charity events
  | 'personal' // Personal time blocks
  | 'unknown';

/**
 * Attendee response status
 */
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'needsAction';

/**
 * Recurring event pattern
 */
export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N frequency units
  daysOfWeek?: number[]; // 0-6 for weekly patterns
  endDate?: string; // ISO date when recurrence ends
  count?: number; // Number of occurrences
}

/**
 * Event attendee information
 */
export interface Attendee {
  email: string;
  name: string | null;
  responseStatus: ResponseStatus;
  isOptional?: boolean;
  isOrganizer?: boolean;
}

/**
 * Normalized calendar event
 */
export interface CalendarEvent {
  id: string;
  providerId: string; // Google/Microsoft event ID
  provider: CalendarProvider;

  // Core event data
  title: string;
  description: string | null;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  isAllDay: boolean;
  location: string | null;

  // Attendees (for relationship extraction)
  attendees: Attendee[];
  organizer: Attendee | null;

  // Classification
  eventType: EventType;
  iabClassification?: IABClassification;

  // Recurrence
  recurring: boolean;
  recurringPattern?: RecurringPattern;

  // Metadata
  fetchedAt: number;
  updatedAt: number;
}

/**
 * Raw event from Google Calendar API
 */
export interface GoogleCalendarEventRaw {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
    optional?: boolean;
    organizer?: boolean;
  }[];
  organizer?: {
    email: string;
    displayName?: string;
  };
  recurrence?: string[];
  recurringEventId?: string;
}

/**
 * Raw event from Microsoft Graph Calendar API
 */
export interface MicrosoftCalendarEventRaw {
  id: string;
  subject?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  isAllDay?: boolean;
  location?: {
    displayName?: string;
  };
  attendees?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
    status?: {
      response?: string;
    };
    type?: string;
  }[];
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  recurrence?: {
    pattern?: {
      type?: string;
      interval?: number;
      daysOfWeek?: string[];
    };
    range?: {
      type?: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
}

/**
 * Time pattern for busy/free analysis
 */
export interface TimePattern {
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  startHour: number; // 0-23
  endHour: number; // 0-23
  frequency: number; // How often this pattern occurs (0-1)
  eventType: EventType; // Typical event type at this time
}

/**
 * Frequent contact from relationship extraction
 */
export interface FrequentContact {
  email: string;
  name: string | null;
  sharedEventCount: number;
  lastSharedEvent: string; // ISO date
  commonActivities: EventType[];
  relationshipStrength: number; // 0-1 based on frequency
}

/**
 * Shared event pattern with a contact
 */
export interface SharedEventPattern {
  eventType: EventType;
  count: number;
  lastOccurrence: string; // ISO date
  averageDuration: number; // minutes
}

/**
 * Calendar profile for a user
 */
export interface CalendarProfile {
  userId: string;
  lastSync: number;

  // Relationship signals
  frequentContacts: FrequentContact[];
  sharedEvents: Record<string, SharedEventPattern[]>; // email → patterns

  // Activity patterns
  eventTypeDistribution: Record<EventType, number>;
  busyTimes: TimePattern[];
  freeWeekends: string[]; // ISO dates of free weekends

  // For Ikigai
  socialEvents: CalendarEvent[]; // "Relationships" dimension
  experienceEvents: CalendarEvent[]; // "Experiences" dimension
  volunteerEvents: CalendarEvent[]; // "Giving" dimension

  // Statistics
  totalEvents: number;
  averageEventsPerWeek: number;
  uniqueAttendees: number;
}

/**
 * Calendar sync result
 */
export interface CalendarSyncResult {
  success: boolean;
  newEvents: number;
  updatedEvents: number;
  removedEvents: number;
  classifiedCount: number;
  syncedAt: number;
  nextSyncToken?: string;
  error?: string;
}

/**
 * Calendar pipeline configuration
 */
export interface CalendarPipelineConfig {
  // Fetching options
  daysBack: number; // How many days back to fetch
  daysForward: number; // How many days forward to fetch
  maxEventsPerRequest: number;

  // Classification options
  confidenceThreshold: number;
  modelTier: 'fast' | 'standard' | 'premium';

  // Relationship extraction
  minEventsForFrequentContact: number;
  relationshipDecayDays: number; // Days since last event before strength decreases
  recencyWeight: number; // Weight for recency in relationship strength (0-1)
  frequencyWeight: number; // Weight for frequency in relationship strength (0-1)
  maxEventsForFrequency: number; // Max events before frequency factor caps at 1.0

  // Free time detection
  weekendStartHour: number; // Hour when weekend "starts" (e.g., Saturday 8 AM)
  weekendEndHour: number; // Hour when weekend "ends" (e.g., Sunday 10 PM)
  minFreeHoursForFreeWeekend: number;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_CALENDAR_CONFIG: CalendarPipelineConfig = {
  daysBack: 30,
  daysForward: 90,
  maxEventsPerRequest: 250,
  confidenceThreshold: 0.5,
  modelTier: 'fast',
  minEventsForFrequentContact: 3,
  relationshipDecayDays: 90,
  recencyWeight: 0.6, // Recency contributes 60% to relationship strength
  frequencyWeight: 0.4, // Frequency contributes 40% to relationship strength
  maxEventsForFrequency: 20, // Cap frequency factor at 20 events
  weekendStartHour: 8,
  weekendEndHour: 22,
  minFreeHoursForFreeWeekend: 16,
};

/**
 * Mock calendar configuration
 */
export interface MockCalendarConfig {
  eventCount?: number;
  daysRange?: number;
  failureRate?: number;
  latencyMs?: number;
  uniqueAttendees?: number;
  recurringEventPercentage?: number;
}

/**
 * Calendar fetcher result
 */
export interface CalendarFetchResult {
  events: CalendarEvent[];
  nextSyncToken?: string;
  hasMore: boolean;
}

/**
 * Event type keywords for classification
 */
export const EVENT_TYPE_KEYWORDS: Record<EventType, string[]> = {
  meeting: [
    'meeting',
    'standup',
    'sync',
    '1:1',
    'one-on-one',
    'review',
    'planning',
    'sprint',
    'retro',
    'call',
    'conference',
    'interview',
    'demo',
  ],
  social: [
    'dinner',
    'lunch',
    'brunch',
    'party',
    'birthday',
    'happy hour',
    'drinks',
    'celebration',
    'reunion',
    'hangout',
    'catch up',
    'get together',
  ],
  appointment: [
    'doctor',
    'dentist',
    'haircut',
    'massage',
    'therapy',
    'checkup',
    'appointment',
    'consultation',
    'exam',
    'vet',
  ],
  travel: [
    'flight',
    'trip',
    'vacation',
    'hotel',
    'travel',
    'airport',
    'departure',
    'arrival',
    'road trip',
  ],
  entertainment: [
    'concert',
    'movie',
    'show',
    'theater',
    'theatre',
    'game',
    'match',
    'festival',
    'museum',
    'exhibition',
  ],
  exercise: [
    'gym',
    'workout',
    'run',
    'yoga',
    'pilates',
    'fitness',
    'swim',
    'tennis',
    'golf',
    'hike',
    'bike',
    'training',
    'crossfit',
    'class',
  ],
  learning: [
    'class',
    'course',
    'workshop',
    'seminar',
    'webinar',
    'training',
    'lecture',
    'lesson',
    'study',
    'tutorial',
  ],
  volunteer: [
    'volunteer',
    'charity',
    'donation',
    'community',
    'nonprofit',
    'non-profit',
    'fundraiser',
    'helping',
    'service',
  ],
  personal: ['focus', 'block', 'personal', 'me time', 'private', 'busy', 'do not disturb'],
  unknown: [],
};

/**
 * IAB category mapping for event types
 */
export const EVENT_TYPE_TO_IAB: Record<EventType, { tier1Id: string; tier1Name: string }> = {
  meeting: { tier1Id: 'IAB3', tier1Name: 'Business' },
  social: { tier1Id: 'IAB14', tier1Name: 'Society' },
  appointment: { tier1Id: 'IAB7', tier1Name: 'Health & Fitness' },
  travel: { tier1Id: 'IAB20', tier1Name: 'Travel' },
  entertainment: { tier1Id: 'IAB1', tier1Name: 'Arts & Entertainment' },
  exercise: { tier1Id: 'IAB7', tier1Name: 'Health & Fitness' },
  learning: { tier1Id: 'IAB5', tier1Name: 'Education' },
  volunteer: { tier1Id: 'IAB14', tier1Name: 'Society' },
  personal: { tier1Id: 'IAB9', tier1Name: 'Hobbies & Interests' },
  unknown: { tier1Id: 'IAB24', tier1Name: 'Uncategorized' },
};
