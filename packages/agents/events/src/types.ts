/**
 * Events Agent Types - Sprint 7
 *
 * Types for the Events Agent including trigger data,
 * event data, and permissions.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger data for events agent activation
 */
export interface EventsTriggerData {
  /** Natural language query */
  query: string;

  /** Event category filter */
  category?: EventCategory;

  /** Desired date range */
  dateRange?: {
    start: string; // ISO date
    end: string; // ISO date
  };

  /** Location for search */
  location?: string;

  /** Price range filter */
  priceRange?: {
    min?: number;
    max?: number;
  };

  /** Number of tickets needed */
  ticketCount?: number;

  /** User interests to match */
  interests?: string[];

  /** Companions to invite */
  companions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Data Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event category types
 */
export type EventCategory =
  | 'music'
  | 'sports'
  | 'arts'
  | 'comedy'
  | 'theater'
  | 'food'
  | 'networking'
  | 'technology'
  | 'outdoors'
  | 'wellness'
  | 'family'
  | 'other';

/**
 * Event from search results
 */
export interface Event {
  /** Unique identifier */
  id: string;

  /** Event name */
  name: string;

  /** Event description */
  description: string;

  /** Event category */
  category: EventCategory;

  /** Subcategory */
  subcategory?: string;

  /** Venue information */
  venue: Venue;

  /** Start date/time (ISO string) */
  startDateTime: string;

  /** End date/time (ISO string) */
  endDateTime?: string;

  /** Event image */
  imageUrl?: string;

  /** Ticket purchase URL */
  ticketUrl?: string;

  /** Price range */
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };

  /** Ticket availability status */
  ticketAvailability: 'available' | 'limited' | 'sold_out';

  /** Event organizer */
  organizer: string;

  /** Age restriction */
  ageRestriction?: string;

  /** Event tags */
  tags: string[];
}

/**
 * Venue information
 */
export interface Venue {
  /** Unique identifier */
  id: string;

  /** Venue name */
  name: string;

  /** Full address */
  address: string;

  /** City */
  city: string;

  /** State */
  state?: string;

  /** Country */
  country: string;

  /** Coordinates */
  coordinates: {
    latitude: number;
    longitude: number;
  };

  /** Venue capacity */
  capacity?: number;
}

/**
 * Calendar event for integration
 */
export interface CalendarEvent {
  /** Unique identifier */
  id: string;

  /** Event title */
  title: string;

  /** Start date/time (ISO string) */
  startDateTime: string;

  /** End date/time (ISO string) */
  endDateTime: string;

  /** All day event flag */
  allDay?: boolean;

  /** Event location */
  location?: string;

  /** Event description */
  description?: string;

  /** Attendees */
  attendees?: string[];

  /** Recurring event flag */
  recurring?: boolean;
}

/**
 * Event ticket information
 */
export interface EventTicket {
  /** Event ID */
  eventId: string;

  /** Event name */
  eventName: string;

  /** Event date/time */
  dateTime: string;

  /** Venue name */
  venueName: string;

  /** Number of tickets */
  ticketCount: number;

  /** Total price */
  totalPrice: number;

  /** Currency */
  currency: string;

  /** Confirmation number */
  confirmationNumber?: string;

  /** Purchase date */
  purchasedAt: number;
}

/**
 * Event favorites entry
 */
export interface EventFavorite {
  /** Event ID */
  eventId: string;

  /** Event name */
  eventName: string;

  /** Category */
  category: EventCategory;

  /** Venue name */
  venueName: string;

  /** Added timestamp */
  addedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Events Agent Permissions (L2)
 *
 * Read: ikigaiProfile, iabClassifications, episodicMemory, proceduralMemory
 * Write: eventTickets, eventFavorites, episodicMemory, proceduralMemory, missionCards
 */
export const EVENTS_PERMISSIONS: AgentPermissions = {
  agentType: 'events',
  memoryAccess: {
    read: [
      NAMESPACES.IKIGAI_PROFILE,
      NAMESPACES.IAB_CLASSIFICATIONS,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.PROCEDURAL_MEMORY,
    ],
    write: [
      NAMESPACES.EVENT_TICKETS,
      NAMESPACES.EVENT_FAVORITES,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.PROCEDURAL_MEMORY,
      NAMESPACES.MISSION_CARDS,
    ],
    search: [
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.PROCEDURAL_MEMORY,
    ],
  },
  externalApis: [
    {
      name: 'ticketmaster-mock',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
    {
      name: 'eventbrite-mock',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
    {
      name: 'calendar-mock',
      rateLimit: '200/hour',
      requiresUserConsent: false,
    },
  ],
  toolDefinitions: [
    {
      name: 'search_events',
      description: 'Search for events matching category, date range, and interests',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          category: { type: 'string', description: 'Event category' },
          location: { type: 'string', description: 'Location to search' },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
        required: ['location'],
      },
    },
    {
      name: 'check_availability',
      description: 'Check ticket availability for an event',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Event ID' },
          ticketCount: { type: 'number', description: 'Number of tickets needed' },
        },
        required: ['eventId', 'ticketCount'],
      },
    },
    {
      name: 'check_calendar',
      description: 'Check calendar for conflicts',
      parameters: {
        type: 'object',
        properties: {
          dateTime: { type: 'string', description: 'Date/time to check' },
        },
        required: ['dateTime'],
      },
    },
    {
      name: 'add_to_calendar',
      description: 'Add event to calendar',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Event ID' },
          title: { type: 'string', description: 'Calendar event title' },
          dateTime: { type: 'string', description: 'Event date/time' },
        },
        required: ['eventId', 'title', 'dateTime'],
      },
    },
  ],
};
