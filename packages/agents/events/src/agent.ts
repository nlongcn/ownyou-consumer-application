/**
 * Events Agent - Sprint 7
 *
 * L2 agent for event discovery, calendar integration,
 * and ticket booking (mock).
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import { BaseAgent, type AgentContext, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import { TicketmasterMock, CalendarMock } from '@ownyou/mock-apis';
import type { Event as MockEvent, EventCategory as MockEventCategory } from '@ownyou/mock-apis';
import {
  EVENTS_PERMISSIONS,
  type EventsTriggerData,
  type Event,
  type EventCategory,
  type EventFavorite,
  type UrgencyThresholds,
  DEFAULT_URGENCY_THRESHOLDS,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EventsAgent configuration options
 * v13 compliant - all magic numbers extracted to config
 */
export interface EventsAgentConfig {
  /** Default location for event searches when user has no stored preference */
  defaultLocation?: string;
  /** Seed for mock APIs (for deterministic testing) */
  mockSeed?: number;
  /** Ikigai alignment boost for event mission cards */
  ikigaiAlignmentBoost?: number;
  /** Maximum number of events to return from search */
  searchLimit?: number;
  /** Urgency thresholds for determining mission urgency */
  urgencyThresholds?: UrgencyThresholds;
}

const DEFAULT_CONFIG: Required<EventsAgentConfig> = {
  defaultLocation: '', // Empty = require explicit location or user memory lookup
  mockSeed: 42,
  ikigaiAlignmentBoost: 0.3,
  searchLimit: 10,
  urgencyThresholds: DEFAULT_URGENCY_THRESHOLDS,
};

// ─────────────────────────────────────────────────────────────────────────────
// EventsAgent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EventsAgent - L2 agent for event discovery and calendar integration
 *
 * Capabilities:
 * - Search events matching category, date range, and interests
 * - Check calendar for conflicts
 * - Add events to calendar (mock API)
 * - Generates mission cards for event recommendations
 *
 * @example
 * ```typescript
 * const agent = new EventsAgent();
 * const result = await agent.run({
 *   userId: 'user_123',
 *   store: memoryStore,
 *   tools: [],
 *   triggerData: {
 *     query: 'Find music concerts this weekend',
 *     category: 'music',
 *     location: 'San Francisco',
 *   },
 * });
 * ```
 */
export class EventsAgent extends BaseAgent {
  readonly agentType = 'events' as const;
  readonly level = 'L2' as const;

  private ticketmasterMock: TicketmasterMock;
  private calendarMock: CalendarMock;
  private config: Required<EventsAgentConfig>;

  constructor(config: EventsAgentConfig = {}) {
    super(EVENTS_PERMISSIONS);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ticketmasterMock = new TicketmasterMock({ seed: this.config.mockSeed });
    this.calendarMock = new CalendarMock({ seed: this.config.mockSeed });
  }

  /**
   * Execute the events agent logic
   */
  protected async execute(context: AgentContext): Promise<AgentResult> {
    const { userId, store, triggerData } = context;

    // Validate trigger data
    if (!triggerData || !this.isEventsTrigger(triggerData)) {
      return {
        success: false,
        error: 'Missing or invalid trigger data - expected EventsTriggerData',
        // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
      } as AgentResult;
    }

    const trigger = triggerData as EventsTriggerData;

    // Track evidence refs for v13 compliance
    const evidenceRefs: string[] = [];

    try {
      // 1. Read user's Ikigai profile for personalization (v13 Section 2.9)
      const ikigaiProfile = await this.readIkigaiProfile(store, userId);
      if (ikigaiProfile) {
        evidenceRefs.push(`ikigai:${userId}`);
      }

      // 2. Resolve location: trigger > user semantic memory > config default
      const location = await this.resolveLocation(store, userId, trigger);
      if (!location) {
        return {
          success: false,
          error: 'No location specified and no default location found in user profile',
          // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
        } as AgentResult;
      }

      // 3. Search for events with resolved location
      const events = await this.searchEvents({
        ...trigger,
        location,
      });

      if (events.length === 0) {
        return {
          success: true,
          response: `No events found matching criteria: ${trigger.query}`,
          // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
        } as AgentResult;
      }

      // 4. Check calendar for the top event if date is specified
      const topEvent = events[0];
      let hasConflict = false;
      if (topEvent.startDateTime) {
        hasConflict = await this.checkCalendarConflict(userId, topEvent.startDateTime);
      }

      // 5. Determine urgency based on timing (using config thresholds)
      const urgency = this.determineUrgency(trigger.dateRange);

      // 6. Determine Ikigai dimensions (enhanced with profile data)
      const ikigaiDimensions = this.determineIkigaiDimensions(trigger, ikigaiProfile);

      // 7. Generate mission card with evidence refs
      const missionCard = this.generateMissionCard(
        userId,
        trigger,
        events,
        urgency,
        ikigaiDimensions,
        hasConflict,
        evidenceRefs
      );

      // 8. Store mission card
      await this.storeMissionCard(store, userId, missionCard);

      // 9. Store event favorite if it's a popular event
      if (topEvent.ticketAvailability === 'limited') {
        await this.storeEventFavorite(store, userId, topEvent);
      }

      return {
        success: true,
        missionCard,
        response: `Found ${events.length} events matching "${trigger.query}"${hasConflict ? ' (calendar conflict detected)' : ''}`,
        // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
      } as AgentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Event search failed: ${errorMessage}`,
        // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
      } as AgentResult;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Type guard for EventsTriggerData
   */
  private isEventsTrigger(data: unknown): data is EventsTriggerData {
    if (typeof data !== 'object' || data === null) return false;
    const trigger = data as Record<string, unknown>;
    return typeof trigger.query === 'string';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Ikigai and Location Resolution (v13 Section 2.9)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Read user's Ikigai profile from store
   * v13 Section 2.9: Agents read Ikigai profile for personalization
   */
  private async readIkigaiProfile(
    store: AgentContext['store'],
    userId: string
  ): Promise<{ interests?: string[]; favoriteActivities?: string[] } | null> {
    try {
      const namespace = NS.ikigaiProfile(userId);
      const result = await store.get(namespace, 'profile');
      this.recordMemoryOp('read', NAMESPACES.IKIGAI_PROFILE, 'profile');

      if (result) {
        return result as { interests?: string[]; favoriteActivities?: string[] };
      }
      return null;
    } catch {
      // Profile not found or error - continue without it
      return null;
    }
  }

  /**
   * Resolve location from trigger, user memory, or config
   * Priority: trigger.location > semantic memory > config.defaultLocation
   */
  private async resolveLocation(
    store: AgentContext['store'],
    userId: string,
    trigger: EventsTriggerData
  ): Promise<string | undefined> {
    // 1. Use explicit trigger location if provided
    if (trigger.location) {
      return trigger.location;
    }

    // 2. Try to read from user's semantic memory
    try {
      const namespace = NS.semanticMemory(userId);
      const result = await store.get(namespace, 'location_preferences');
      this.recordMemoryOp('read', NAMESPACES.SEMANTIC_MEMORY, 'location_preferences');

      if (result && typeof result === 'object' && 'defaultCity' in result) {
        return (result as { defaultCity: string }).defaultCity;
      }
    } catch {
      // Continue to fallback
    }

    // 3. Fall back to config default (may be empty string = require explicit)
    return this.config.defaultLocation || undefined;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Search
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Search events using mock API
   */
  private async searchEvents(trigger: EventsTriggerData): Promise<Event[]> {
    const startTime = Date.now();

    const searchResult = await this.ticketmasterMock.searchEvents({
      location: trigger.location || this.config.defaultLocation,
      category: trigger.category as MockEventCategory | undefined,
      startDate: trigger.dateRange?.start,
      endDate: trigger.dateRange?.end,
      priceMin: trigger.priceRange?.min,
      priceMax: trigger.priceRange?.max,
      query: trigger.query,
      limit: this.config.searchLimit,
    });

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'search_events',
      { trigger },
      { eventCount: searchResult.events.length },
      durationMs
    );

    // Convert mock events to our Event type
    const events: Event[] = searchResult.events.map((e: MockEvent) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      category: e.category as EventCategory,
      subcategory: e.subcategory,
      venue: {
        id: e.venue.id,
        name: e.venue.name,
        address: e.venue.address,
        city: e.venue.city,
        state: e.venue.state,
        country: e.venue.country,
        coordinates: e.venue.coordinates,
        capacity: e.venue.capacity,
      },
      startDateTime: e.startDateTime,
      endDateTime: e.endDateTime,
      imageUrl: e.imageUrl,
      ticketUrl: e.ticketUrl,
      priceRange: e.priceRange,
      ticketAvailability: e.ticketAvailability,
      organizer: e.organizer,
      ageRestriction: e.ageRestriction,
      tags: e.tags,
    }));

    return events;
  }

  /**
   * Check calendar for conflicts
   */
  private async checkCalendarConflict(userId: string, dateTime: string): Promise<boolean> {
    const startTime = Date.now();
    const date = dateTime.split('T')[0];

    const availability = await this.calendarMock.getAvailability(userId, date);

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'check_calendar',
      { userId, dateTime },
      { date, slotsChecked: availability.slots.length },
      durationMs
    );

    // Check if the event time slot is busy
    const eventHour = new Date(dateTime).getHours();
    const slot = availability.slots.find(s => {
      const slotHour = parseInt(s.startTime.split(':')[0], 10);
      return slotHour === eventHour;
    });

    return slot ? !slot.available : false;
  }

  /**
   * Determine urgency based on date range
   * Uses config thresholds per Sprint 7 spec lesson I2
   */
  private determineUrgency(dateRange?: { start: string; end: string }): 'low' | 'medium' | 'high' {
    if (!dateRange?.start) return 'medium';

    const requestedTime = new Date(dateRange.start);
    const now = new Date();
    const hoursUntil = (requestedTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const thresholds = this.config.urgencyThresholds;
    if (hoursUntil < thresholds.highHours) return 'high';
    if (hoursUntil < thresholds.mediumHours) return 'medium';
    return 'low';
  }

  /**
   * Determine Ikigai dimensions based on context and user's Ikigai profile
   * Enhanced to use profile data per v13 Section 2.9
   */
  private determineIkigaiDimensions(
    trigger: EventsTriggerData,
    ikigaiProfile?: { interests?: string[]; favoriteActivities?: string[] } | null
  ): Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> {
    const dimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> = [];

    // Events with companions are about relationships
    if (trigger.companions && trigger.companions.length > 0) {
      dimensions.push('relationships');
    }

    // Category-based dimensions
    switch (trigger.category) {
      case 'music':
      case 'arts':
      case 'theater':
      case 'comedy':
        dimensions.push('passion');
        break;
      case 'technology':
      case 'networking':
        dimensions.push('growth');
        dimensions.push('profession');
        break;
      case 'wellness':
      case 'outdoors':
        dimensions.push('wellbeing');
        break;
      case 'family':
        dimensions.push('relationships');
        break;
      case 'food':
        dimensions.push('passion');
        break;
      default:
        dimensions.push('passion');
    }

    // Check if event category aligns with user's interests from Ikigai profile
    if (ikigaiProfile?.interests && trigger.category) {
      const categoryLower = trigger.category.toLowerCase();
      const hasMatchingInterest = ikigaiProfile.interests.some(
        (interest) => interest.toLowerCase().includes(categoryLower) ||
          categoryLower.includes(interest.toLowerCase())
      );
      if (hasMatchingInterest && !dimensions.includes('passion')) {
        dimensions.push('passion');
      }
    }

    // Check if event type is in user's favorite activities
    if (ikigaiProfile?.favoriteActivities?.some(a =>
      a.toLowerCase().includes('event') ||
      a.toLowerCase().includes('concert') ||
      a.toLowerCase().includes('show') ||
      a.toLowerCase().includes('live')
    )) {
      if (!dimensions.includes('passion')) {
        dimensions.push('passion');
      }
    }

    // Default to passion if nothing else
    if (dimensions.length === 0) {
      dimensions.push('passion');
    }

    return [...new Set(dimensions)]; // Remove duplicates
  }

  /**
   * Generate mission card from search results
   * Now accepts evidenceRefs for v13 compliance
   */
  private generateMissionCard(
    _userId: string,
    trigger: EventsTriggerData,
    events: Event[],
    urgency: 'low' | 'medium' | 'high',
    ikigaiDimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'>,
    hasConflict: boolean,
    evidenceRefs: string[] = []
  ): MissionCard {
    const now = Date.now();
    const missionId = `mission_events_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const topEvent = events[0];

    const title = trigger.category
      ? `${this.capitalizeFirst(trigger.category)} Event: ${topEvent.name}`
      : `Event Recommendation: ${topEvent.name}`;

    const priceText = topEvent.priceRange.min === 0 && topEvent.priceRange.max === 0
      ? 'Free'
      : `$${topEvent.priceRange.min}-$${topEvent.priceRange.max}`;

    // Add event reference to evidence
    const allEvidence = [...evidenceRefs, `event:${topEvent.id}`];

    const summary = `${topEvent.name} at ${topEvent.venue.name} • ${priceText} • ${topEvent.ticketAvailability}${hasConflict ? ' ⚠️ Calendar conflict' : ''}`;

    return {
      id: missionId,
      type: 'events',
      title,
      summary,
      urgency,
      status: 'CREATED',
      createdAt: now,
      expiresAt: topEvent.startDateTime ? new Date(topEvent.startDateTime).getTime() : undefined,
      ikigaiDimensions,
      ikigaiAlignmentBoost: this.config.ikigaiAlignmentBoost,
      primaryAction: {
        label: 'View Event',
        type: 'navigate',
        payload: {
          route: '/event',
          eventId: topEvent.id,
          events: events.slice(0, 5).map((e) => e.id),
        },
      },
      secondaryActions: [
        {
          label: 'Buy Tickets',
          type: 'action',
          payload: {
            action: 'purchase',
            eventId: topEvent.id,
            ticketUrl: topEvent.ticketUrl,
          },
        },
        {
          label: 'Add to Calendar',
          type: 'action',
          payload: {
            action: 'add_calendar',
            eventId: topEvent.id,
            title: topEvent.name,
            dateTime: topEvent.startDateTime,
          },
        },
        {
          label: 'See More Events',
          type: 'navigate',
          payload: {
            route: '/events',
            query: trigger.query,
            events: events.map((e) => e.id),
          },
        },
        {
          label: 'Dismiss',
          type: 'confirm',
          payload: { action: 'dismiss' },
        },
      ],
      agentThreadId: `thread_${missionId}`,
      evidenceRefs: allEvidence,
    };
  }

  /**
   * Store mission card in memory
   */
  private async storeMissionCard(
    store: AgentContext['store'],
    userId: string,
    missionCard: MissionCard
  ): Promise<void> {
    const namespace = NS.missionCards(userId);
    this.recordMemoryOp('write', NAMESPACES.MISSION_CARDS, missionCard.id);
    await store.put(namespace, missionCard.id, missionCard);
  }

  /**
   * Store event as favorite
   * Uses proper EventFavorite type per Sprint 7 spec lesson I4
   */
  private async storeEventFavorite(
    store: AgentContext['store'],
    userId: string,
    event: Event
  ): Promise<void> {
    const namespace = NS.eventFavorites(userId);

    // Create a complete EventFavorite with all fields populated
    const favorite: EventFavorite = {
      eventId: event.id,
      eventName: event.name,
      category: event.category,
      venueName: event.venue.name,
      addedAt: Date.now(),
    };

    this.recordMemoryOp('write', NAMESPACES.EVENT_FAVORITES, event.id);
    await store.put(namespace, event.id, favorite);
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Episode Recording Overrides (v13 Section 8.4.2)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override describeTrigger for events-specific episode situation
   */
  protected override describeTrigger(trigger: unknown): string {
    if (!trigger || !this.isEventsTrigger(trigger)) {
      return 'Event search without specific criteria';
    }

    const t = trigger as EventsTriggerData;
    const parts: string[] = [];

    if (t.category) parts.push(`${t.category} events`);
    if (t.location) parts.push(`in ${t.location}`);
    if (t.dateRange?.start) {
      const startDate = new Date(t.dateRange.start).toLocaleDateString();
      const endDate = t.dateRange.end ? new Date(t.dateRange.end).toLocaleDateString() : '';
      parts.push(endDate ? `from ${startDate} to ${endDate}` : `on ${startDate}`);
    }
    if (t.companions?.length) parts.push(`with ${t.companions.length} companions`);
    if (t.priceRange?.max) parts.push(`(max $${t.priceRange.max})`);

    return parts.length > 0
      ? `User searched for events: ${parts.join(', ')}`
      : `User searched for events: "${t.query}"`;
  }

  /**
   * Override extractTags for events-specific episode tags
   */
  protected override extractTags(trigger: unknown, mission: import('@ownyou/shared-types').MissionCard): string[] {
    const baseTags = super.extractTags(trigger, mission);

    if (trigger && this.isEventsTrigger(trigger)) {
      const t = trigger as EventsTriggerData;
      if (t.category) baseTags.push(`category:${t.category}`);
      if (t.companions?.length) baseTags.push('group-activity');
      if (t.interests) {
        t.interests.forEach((i) => baseTags.push(`interest:${i.toLowerCase()}`));
      }
    }

    return [...new Set(baseTags)]; // Remove duplicates
  }
}
