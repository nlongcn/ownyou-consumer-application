/**
 * Calendar Event Normalizer - Sprint 8
 *
 * Normalizes calendar events from different providers (Google, Microsoft)
 * into a unified format and classifies event types.
 */

import {
  type CalendarEvent,
  type EventType,
  type GoogleCalendarEventRaw,
  type MicrosoftCalendarEventRaw,
  type Attendee,
  type RecurringPattern,
  EVENT_TYPE_KEYWORDS,
} from '../types.js';

/**
 * Normalize a Google Calendar event to OwnYou format
 */
export function normalizeGoogleEvent(raw: GoogleCalendarEventRaw): CalendarEvent {
  const now = Date.now();

  // Determine if all-day event
  const isAllDay = !!raw.start?.date && !raw.start?.dateTime;

  // Get start and end times
  const startTime = raw.start?.dateTime || raw.start?.date || new Date().toISOString();
  const endTime = raw.end?.dateTime || raw.end?.date || startTime;

  // Normalize attendees
  const attendees: Attendee[] = (raw.attendees || []).map(a => ({
    email: a.email,
    name: a.displayName || null,
    responseStatus: normalizeResponseStatus(a.responseStatus),
    isOptional: a.optional || false,
    isOrganizer: a.organizer || false,
  }));

  // Get organizer
  const organizer: Attendee | null = raw.organizer
    ? {
        email: raw.organizer.email,
        name: raw.organizer.displayName || null,
        responseStatus: 'accepted',
        isOrganizer: true,
      }
    : null;

  // Classify event type
  const eventType = classifyEventType(raw.summary || '', raw.description || '', raw.location);

  // Parse recurrence
  const recurringPattern = parseGoogleRecurrence(raw.recurrence);

  return {
    id: `google_${raw.id}`,
    providerId: raw.id,
    provider: 'google',
    title: raw.summary || 'Untitled Event',
    description: raw.description || null,
    startTime,
    endTime,
    isAllDay,
    location: raw.location || null,
    attendees,
    organizer,
    eventType,
    recurring: !!raw.recurringEventId || !!raw.recurrence,
    recurringPattern,
    fetchedAt: now,
    updatedAt: now,
  };
}

/**
 * Normalize a Microsoft Calendar event to OwnYou format
 */
export function normalizeMicrosoftEvent(raw: MicrosoftCalendarEventRaw): CalendarEvent {
  const now = Date.now();

  // Determine if all-day event
  const isAllDay = raw.isAllDay || false;

  // Get start and end times
  const startTime = raw.start?.dateTime || new Date().toISOString();
  const endTime = raw.end?.dateTime || startTime;

  // Normalize attendees
  const attendees: Attendee[] = (raw.attendees || []).map(a => ({
    email: a.emailAddress?.address || '',
    name: a.emailAddress?.name || null,
    responseStatus: normalizeMicrosoftResponseStatus(a.status?.response),
    isOptional: a.type === 'optional',
    isOrganizer: false,
  }));

  // Get organizer
  const organizer: Attendee | null = raw.organizer?.emailAddress
    ? {
        email: raw.organizer.emailAddress.address || '',
        name: raw.organizer.emailAddress.name || null,
        responseStatus: 'accepted',
        isOrganizer: true,
      }
    : null;

  // Classify event type
  const eventType = classifyEventType(
    raw.subject || '',
    raw.body?.content || '',
    raw.location?.displayName
  );

  // Parse recurrence
  const recurringPattern = parseMicrosoftRecurrence(raw.recurrence);

  return {
    id: `microsoft_${raw.id}`,
    providerId: raw.id,
    provider: 'microsoft',
    title: raw.subject || 'Untitled Event',
    description: raw.body?.content || null,
    startTime,
    endTime,
    isAllDay,
    location: raw.location?.displayName || null,
    attendees,
    organizer,
    eventType,
    recurring: !!raw.recurrence,
    recurringPattern,
    fetchedAt: now,
    updatedAt: now,
  };
}

/**
 * Normalize Google response status
 */
function normalizeResponseStatus(
  status?: string
): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
  switch (status) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentative':
      return 'tentative';
    default:
      return 'needsAction';
  }
}

/**
 * Normalize Microsoft response status
 */
function normalizeMicrosoftResponseStatus(
  response?: string
): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
  switch (response?.toLowerCase()) {
    case 'accepted':
    case 'organizer':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentativelyaccepted':
    case 'tentative':
      return 'tentative';
    default:
      return 'needsAction';
  }
}

/**
 * Classify event type based on title, description, and location
 */
export function classifyEventType(
  title: string,
  description: string,
  location?: string | null
): EventType {
  const text = `${title} ${description} ${location || ''}`.toLowerCase();

  // Check each event type's keywords
  const scores: Partial<Record<EventType, number>> = {};

  for (const [type, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    const eventType = type as EventType;
    let score = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Title matches are weighted higher
        if (title.toLowerCase().includes(keyword.toLowerCase())) {
          score += 3;
        } else {
          score += 1;
        }
      }
    }

    if (score > 0) {
      scores[eventType] = score;
    }
  }

  // Return highest scoring type, or unknown
  const entries = Object.entries(scores) as [EventType, number][];
  if (entries.length === 0) {
    return 'unknown';
  }

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Parse Google Calendar recurrence rules (RRULE format)
 */
function parseGoogleRecurrence(recurrence?: string[]): RecurringPattern | undefined {
  if (!recurrence || recurrence.length === 0) {
    return undefined;
  }

  const rrule = recurrence.find(r => r.startsWith('RRULE:'));
  if (!rrule) {
    return undefined;
  }

  const parts = rrule.replace('RRULE:', '').split(';');
  const params: Record<string, string> = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      params[key] = value;
    }
  }

  const frequency = params.FREQ?.toLowerCase() as RecurringPattern['frequency'];
  if (!frequency || !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
    return undefined;
  }

  const pattern: RecurringPattern = {
    frequency,
    interval: parseInt(params.INTERVAL || '1', 10),
  };

  if (params.BYDAY) {
    pattern.daysOfWeek = parseDaysOfWeek(params.BYDAY);
  }

  if (params.UNTIL) {
    pattern.endDate = params.UNTIL;
  }

  if (params.COUNT) {
    pattern.count = parseInt(params.COUNT, 10);
  }

  return pattern;
}

/**
 * Parse Microsoft recurrence pattern
 */
function parseMicrosoftRecurrence(
  recurrence?: MicrosoftCalendarEventRaw['recurrence']
): RecurringPattern | undefined {
  if (!recurrence?.pattern) {
    return undefined;
  }

  const freqMap: Record<string, RecurringPattern['frequency']> = {
    daily: 'daily',
    weekly: 'weekly',
    absoluteMonthly: 'monthly',
    relativeMonthly: 'monthly',
    absoluteYearly: 'yearly',
    relativeYearly: 'yearly',
  };

  const frequency = freqMap[recurrence.pattern.type || ''];
  if (!frequency) {
    return undefined;
  }

  const pattern: RecurringPattern = {
    frequency,
    interval: recurrence.pattern.interval || 1,
  };

  if (recurrence.pattern.daysOfWeek) {
    pattern.daysOfWeek = recurrence.pattern.daysOfWeek.map(d => dayNameToNumber(d));
  }

  if (recurrence.range?.endDate) {
    pattern.endDate = recurrence.range.endDate;
  }

  if (recurrence.range?.numberOfOccurrences) {
    pattern.count = recurrence.range.numberOfOccurrences;
  }

  return pattern;
}

/**
 * Parse BYDAY format (MO,TU,WE,TH,FR,SA,SU) to day numbers
 */
function parseDaysOfWeek(byday: string): number[] {
  const dayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };

  return byday
    .split(',')
    .map(d => dayMap[d.trim().toUpperCase()])
    .filter(n => n !== undefined);
}

/**
 * Convert day name to number
 */
function dayNameToNumber(dayName: string): number {
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  return dayMap[dayName.toLowerCase()] ?? 0;
}

/**
 * Calculate event duration in minutes
 */
export function calculateEventDuration(event: CalendarEvent): number {
  const start = new Date(event.startTime).getTime();
  const end = new Date(event.endTime).getTime();
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Check if event is in the past
 */
export function isEventPast(event: CalendarEvent): boolean {
  return new Date(event.endTime).getTime() < Date.now();
}

/**
 * Check if event is recurring
 */
export function isRecurringEvent(event: CalendarEvent): boolean {
  return event.recurring;
}

/**
 * Get events on a specific date
 */
export function getEventsOnDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return events.filter(e => {
    const eventStart = new Date(e.startTime);
    return eventStart >= startOfDay && eventStart <= endOfDay;
  });
}

/**
 * Get weekend events
 */
export function getWeekendEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(e => {
    const day = new Date(e.startTime).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  });
}

/**
 * Get events by type
 */
export function getEventsByType(events: CalendarEvent[], type: EventType): CalendarEvent[] {
  return events.filter(e => e.eventType === type);
}
