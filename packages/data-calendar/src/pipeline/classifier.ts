/**
 * Calendar Event Classifier - Sprint 8
 *
 * Classifies calendar events into IAB categories for advertising insights.
 */

import type { IABClassification } from '@ownyou/iab-classifier';
import {
  type CalendarEvent,
  type EventType,
  type CalendarPipelineConfig,
  DEFAULT_CALENDAR_CONFIG,
  EVENT_TYPE_TO_IAB,
} from '../types.js';

/**
 * Classifier configuration
 */
export interface ClassifierConfig {
  confidenceThreshold?: number;
  modelTier?: 'fast' | 'standard' | 'premium';
}

/**
 * Calendar event classifier
 */
export class CalendarEventClassifier {
  private config: ClassifierConfig;

  constructor(config: ClassifierConfig = {}) {
    this.config = {
      confidenceThreshold: config.confidenceThreshold ?? DEFAULT_CALENDAR_CONFIG.confidenceThreshold,
      modelTier: config.modelTier ?? DEFAULT_CALENDAR_CONFIG.modelTier,
    };
  }

  /**
   * Classify a single event
   */
  async classify(event: CalendarEvent, userId: string): Promise<CalendarEvent> {
    // Map event type to IAB category
    const iabMapping = EVENT_TYPE_TO_IAB[event.eventType];

    // Build IAB classification
    const iabClassification: IABClassification = {
      category: {
        tier1Id: iabMapping.tier1Id,
        tier1Name: iabMapping.tier1Name,
        tier2Id: this.getTier2Id(event),
        tier2Name: this.getTier2Name(event),
      },
      confidence: this.calculateConfidence(event),
      source: 'calendar',
      timestamp: Date.now(),
      textPreview: this.buildTextPreview(event),
    };

    // Only include if confidence meets threshold
    if (iabClassification.confidence < (this.config.confidenceThreshold ?? 0.5)) {
      return event; // Return without classification
    }

    return {
      ...event,
      iabClassification,
    };
  }

  /**
   * Classify multiple events
   */
  async classifyBatch(events: CalendarEvent[], userId: string): Promise<CalendarEvent[]> {
    return Promise.all(events.map(event => this.classify(event, userId)));
  }

  /**
   * Get IAB Tier 2 ID based on event details
   */
  private getTier2Id(event: CalendarEvent): string | undefined {
    // Map event types to more specific IAB tier 2 categories
    const tier2Map: Record<EventType, string | undefined> = {
      meeting: 'IAB3-1', // Business > Career
      social: 'IAB14-7', // Society > Social Events
      appointment: 'IAB7-1', // Health & Fitness > General Health
      travel: 'IAB20-18', // Travel > Hotels
      entertainment: 'IAB1-6', // Arts & Entertainment > Movies
      exercise: 'IAB7-4', // Health & Fitness > Exercise
      learning: 'IAB5-1', // Education > Adult Education
      volunteer: 'IAB14-3', // Society > Charity
      personal: undefined,
      unknown: undefined,
    };

    return tier2Map[event.eventType];
  }

  /**
   * Get IAB Tier 2 name based on event details
   */
  private getTier2Name(event: CalendarEvent): string | undefined {
    const tier2Names: Record<EventType, string | undefined> = {
      meeting: 'Career',
      social: 'Social Events',
      appointment: 'General Health',
      travel: 'Hotels',
      entertainment: 'Movies',
      exercise: 'Exercise',
      learning: 'Adult Education',
      volunteer: 'Charity',
      personal: undefined,
      unknown: undefined,
    };

    return tier2Names[event.eventType];
  }

  /**
   * Calculate classification confidence based on event data
   */
  private calculateConfidence(event: CalendarEvent): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for events with clear titles
    if (event.title && event.title.length > 3 && event.title !== 'Untitled Event') {
      confidence += 0.2;
    }

    // Higher confidence for non-unknown event types
    if (event.eventType !== 'unknown') {
      confidence += 0.1;
    }

    // Higher confidence for events with attendees (more context)
    if (event.attendees.length > 0) {
      confidence += 0.1;
    }

    // Higher confidence for events with location
    if (event.location) {
      confidence += 0.05;
    }

    // Cap at 0.95
    return Math.min(confidence, 0.95);
  }

  /**
   * Build text preview for classification context
   */
  private buildTextPreview(event: CalendarEvent): string {
    const parts: string[] = [];

    parts.push(`Event: ${event.title}`);

    if (event.location) {
      parts.push(`Location: ${event.location}`);
    }

    if (event.attendees.length > 0) {
      parts.push(`Attendees: ${event.attendees.length}`);
    }

    const start = new Date(event.startTime);
    parts.push(`Date: ${start.toLocaleDateString()}`);

    return parts.join(' | ');
  }
}

/**
 * Create a calendar classifier
 */
export function createCalendarClassifier(config?: ClassifierConfig): CalendarEventClassifier {
  return new CalendarEventClassifier(config);
}

/**
 * Get Ikigai-relevant events from classified events
 */
export function getIkigaiEvents(events: CalendarEvent[]): {
  socialEvents: CalendarEvent[];
  experienceEvents: CalendarEvent[];
  volunteerEvents: CalendarEvent[];
} {
  const socialTypes: EventType[] = ['social'];
  const experienceTypes: EventType[] = ['travel', 'entertainment', 'exercise'];
  const volunteerTypes: EventType[] = ['volunteer'];

  return {
    socialEvents: events.filter(e => socialTypes.includes(e.eventType)),
    experienceEvents: events.filter(e => experienceTypes.includes(e.eventType)),
    volunteerEvents: events.filter(e => volunteerTypes.includes(e.eventType)),
  };
}

/**
 * Get event type distribution
 */
export function getEventTypeDistribution(
  events: CalendarEvent[]
): Record<EventType, number> {
  const distribution: Record<EventType, number> = {
    meeting: 0,
    social: 0,
    appointment: 0,
    travel: 0,
    entertainment: 0,
    exercise: 0,
    learning: 0,
    volunteer: 0,
    personal: 0,
    unknown: 0,
  };

  for (const event of events) {
    distribution[event.eventType]++;
  }

  return distribution;
}
