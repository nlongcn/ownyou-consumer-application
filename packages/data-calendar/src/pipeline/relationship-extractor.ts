/**
 * Relationship Extractor - Sprint 8
 *
 * Extracts relationship signals from calendar events based on attendee patterns.
 * Identifies frequent contacts and shared activities for Ikigai "Relationships" dimension.
 */

import {
  type CalendarEvent,
  type FrequentContact,
  type SharedEventPattern,
  type EventType,
  type TimePattern,
  type CalendarPipelineConfig,
  DEFAULT_CALENDAR_CONFIG,
} from '../types.js';

/**
 * Relationship extractor configuration
 */
export interface RelationshipExtractorConfig {
  minEventsForFrequentContact?: number;
  relationshipDecayDays?: number;
  weekendStartHour?: number;
  weekendEndHour?: number;
  minFreeHoursForFreeWeekend?: number;
  /** Weight for recency in relationship strength calculation (0-1) */
  recencyWeight?: number;
  /** Weight for frequency in relationship strength calculation (0-1) */
  frequencyWeight?: number;
  /** Maximum events to count for frequency factor */
  maxEventsForFrequency?: number;
}

/**
 * Contact interaction data (internal)
 */
interface ContactInteraction {
  email: string;
  name: string | null;
  events: {
    eventType: EventType;
    date: string;
    duration: number;
  }[];
}

/**
 * Extract frequent contacts from calendar events
 */
export function extractFrequentContacts(
  events: CalendarEvent[],
  config: RelationshipExtractorConfig = {}
): FrequentContact[] {
  const minEvents = config.minEventsForFrequentContact ?? DEFAULT_CALENDAR_CONFIG.minEventsForFrequentContact;
  const decayDays = config.relationshipDecayDays ?? DEFAULT_CALENDAR_CONFIG.relationshipDecayDays;
  const recencyWeight = config.recencyWeight ?? DEFAULT_CALENDAR_CONFIG.recencyWeight;
  const frequencyWeight = config.frequencyWeight ?? DEFAULT_CALENDAR_CONFIG.frequencyWeight;
  const maxEventsForFrequency = config.maxEventsForFrequency ?? DEFAULT_CALENDAR_CONFIG.maxEventsForFrequency;

  // Build contact interaction map
  const contactMap = new Map<string, ContactInteraction>();

  for (const event of events) {
    const duration = calculateEventDuration(event);

    for (const attendee of event.attendees) {
      if (!attendee.email) continue;

      let contact = contactMap.get(attendee.email);
      if (!contact) {
        contact = {
          email: attendee.email,
          name: attendee.name,
          events: [],
        };
        contactMap.set(attendee.email, contact);
      }

      contact.events.push({
        eventType: event.eventType,
        date: event.startTime,
        duration,
      });

      // Update name if we have one and didn't before
      if (attendee.name && !contact.name) {
        contact.name = attendee.name;
      }
    }
  }

  // Convert to FrequentContact array
  const frequentContacts: FrequentContact[] = [];
  const now = Date.now();

  for (const contact of contactMap.values()) {
    if (contact.events.length < minEvents) continue;

    // Sort events by date (most recent first)
    contact.events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Get unique event types
    const eventTypes = [...new Set(contact.events.map(e => e.eventType))];

    // Calculate relationship strength (0-1) using configurable weights
    const lastEventDate = new Date(contact.events[0].date).getTime();
    const daysSinceLastEvent = (now - lastEventDate) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 1 - daysSinceLastEvent / decayDays);
    const frequencyFactor = Math.min(contact.events.length / maxEventsForFrequency, 1);
    const relationshipStrength = (recencyFactor * recencyWeight + frequencyFactor * frequencyWeight);

    frequentContacts.push({
      email: contact.email,
      name: contact.name,
      sharedEventCount: contact.events.length,
      lastSharedEvent: contact.events[0].date,
      commonActivities: eventTypes,
      relationshipStrength: Math.round(relationshipStrength * 100) / 100,
    });
  }

  // Sort by relationship strength
  frequentContacts.sort((a, b) => b.relationshipStrength - a.relationshipStrength);

  return frequentContacts;
}

/**
 * Extract shared event patterns per contact
 */
export function extractSharedEventPatterns(
  events: CalendarEvent[]
): Record<string, SharedEventPattern[]> {
  const patterns: Record<string, Map<EventType, { count: number; lastDate: string; totalDuration: number }>> = {};

  for (const event of events) {
    const duration = calculateEventDuration(event);

    for (const attendee of event.attendees) {
      if (!attendee.email) continue;

      if (!patterns[attendee.email]) {
        patterns[attendee.email] = new Map();
      }

      const typePatterns = patterns[attendee.email];
      const existing = typePatterns.get(event.eventType);

      if (existing) {
        existing.count++;
        existing.totalDuration += duration;
        if (new Date(event.startTime) > new Date(existing.lastDate)) {
          existing.lastDate = event.startTime;
        }
      } else {
        typePatterns.set(event.eventType, {
          count: 1,
          lastDate: event.startTime,
          totalDuration: duration,
        });
      }
    }
  }

  // Convert to output format
  const result: Record<string, SharedEventPattern[]> = {};

  for (const [email, typePatterns] of Object.entries(patterns)) {
    result[email] = [];
    for (const [eventType, data] of typePatterns.entries()) {
      result[email].push({
        eventType,
        count: data.count,
        lastOccurrence: data.lastDate,
        averageDuration: Math.round(data.totalDuration / data.count),
      });
    }
    // Sort by count
    result[email].sort((a, b) => b.count - a.count);
  }

  return result;
}

/**
 * Detect busy time patterns
 */
export function detectBusyTimePatterns(events: CalendarEvent[]): TimePattern[] {
  // Track occurrences by day of week and hour
  const timeSlots = new Map<string, { eventTypes: EventType[]; count: number }>();

  for (const event of events) {
    if (event.isAllDay) continue;

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    const dayOfWeek = start.getDay();
    const startHour = start.getHours();
    const endHour = end.getHours();

    for (let hour = startHour; hour <= endHour && hour < 24; hour++) {
      const key = `${dayOfWeek}-${hour}`;
      const existing = timeSlots.get(key);

      if (existing) {
        existing.count++;
        existing.eventTypes.push(event.eventType);
      } else {
        timeSlots.set(key, {
          count: 1,
          eventTypes: [event.eventType],
        });
      }
    }
  }

  // Convert to TimePattern array
  const patterns: TimePattern[] = [];
  const totalDays = Math.ceil(
    (Math.max(...events.map(e => new Date(e.startTime).getTime())) -
      Math.min(...events.map(e => new Date(e.startTime).getTime()))) /
      (1000 * 60 * 60 * 24 * 7)
  );

  for (const [key, data] of timeSlots) {
    const [dayStr, hourStr] = key.split('-');
    const dayOfWeek = parseInt(dayStr, 10);
    const startHour = parseInt(hourStr, 10);

    // Only include if occurs frequently (>30% of weeks)
    const frequency = totalDays > 0 ? data.count / totalDays : 0;
    if (frequency < 0.3) continue;

    // Most common event type for this slot
    const typeCounts = new Map<EventType, number>();
    for (const type of data.eventTypes) {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
    const mostCommonType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    patterns.push({
      dayOfWeek,
      startHour,
      endHour: startHour + 1,
      frequency: Math.round(frequency * 100) / 100,
      eventType: mostCommonType,
    });
  }

  // Sort by frequency
  patterns.sort((a, b) => b.frequency - a.frequency);

  return patterns;
}

/**
 * Detect free weekends
 */
export function detectFreeWeekends(
  events: CalendarEvent[],
  config: RelationshipExtractorConfig = {}
): string[] {
  const weekendStartHour = config.weekendStartHour ?? DEFAULT_CALENDAR_CONFIG.weekendStartHour;
  const weekendEndHour = config.weekendEndHour ?? DEFAULT_CALENDAR_CONFIG.weekendEndHour;
  const minFreeHours = config.minFreeHoursForFreeWeekend ?? DEFAULT_CALENDAR_CONFIG.minFreeHoursForFreeWeekend;

  // Get unique weekend dates in the event range
  const weekends = new Map<string, { totalEventHours: number; date: Date }>();

  // Find date range from events
  const dates = events.map(e => new Date(e.startTime));
  if (dates.length === 0) return [];

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Iterate through weekends
  const current = new Date(minDate);
  current.setHours(0, 0, 0, 0);

  while (current <= maxDate) {
    const day = current.getDay();

    // Saturday or Sunday
    if (day === 0 || day === 6) {
      const weekendKey = getWeekendKey(current);
      if (!weekends.has(weekendKey)) {
        weekends.set(weekendKey, { totalEventHours: 0, date: new Date(current) });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // Calculate event hours for each weekend
  for (const event of events) {
    if (event.isAllDay) continue;

    const start = new Date(event.startTime);
    const day = start.getDay();

    if (day !== 0 && day !== 6) continue;

    const weekendKey = getWeekendKey(start);
    const weekend = weekends.get(weekendKey);

    if (weekend) {
      const duration = calculateEventDuration(event) / 60; // Convert to hours
      weekend.totalEventHours += duration;
    }
  }

  // Find free weekends (less than threshold hours of events)
  const freeWeekends: string[] = [];
  const weekendHours = (weekendEndHour - weekendStartHour) * 2; // 2 days

  for (const [key, data] of weekends) {
    const freeHours = weekendHours - data.totalEventHours;
    if (freeHours >= minFreeHours) {
      freeWeekends.push(data.date.toISOString().split('T')[0]);
    }
  }

  return freeWeekends;
}

/**
 * Get unique weekend key from date
 */
function getWeekendKey(date: Date): string {
  const year = date.getFullYear();
  const weekNum = getWeekNumber(date);
  return `${year}-W${weekNum}`;
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Calculate event duration in minutes
 */
function calculateEventDuration(event: CalendarEvent): number {
  const start = new Date(event.startTime).getTime();
  const end = new Date(event.endTime).getTime();
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Get total unique attendees count
 */
export function getUniqueAttendeesCount(events: CalendarEvent[]): number {
  const emails = new Set<string>();

  for (const event of events) {
    for (const attendee of event.attendees) {
      if (attendee.email) {
        emails.add(attendee.email);
      }
    }
  }

  return emails.size;
}

/**
 * Calculate average events per week
 */
export function calculateAverageEventsPerWeek(events: CalendarEvent[]): number {
  if (events.length === 0) return 0;

  const dates = events.map(e => new Date(e.startTime).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);

  const weeks = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 7));

  return Math.round((events.length / weeks) * 10) / 10;
}
