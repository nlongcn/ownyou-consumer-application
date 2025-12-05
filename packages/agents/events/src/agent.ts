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
} from './types';

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

  constructor() {
    super(EVENTS_PERMISSIONS);
    this.ticketmasterMock = new TicketmasterMock({ seed: 42 });
    this.calendarMock = new CalendarMock({ seed: 42 });
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
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    const trigger = triggerData as EventsTriggerData;

    try {
      // 1. Search for events
      const events = await this.searchEvents(trigger);

      if (events.length === 0) {
        return {
          success: true,
          response: `No events found matching criteria: ${trigger.query}`,
          usage: this.limitsEnforcer.getUsage(),
          toolCalls: [],
          llmCalls: [],
          memoryOps: [],
        };
      }

      // 2. Check calendar for the top event if date is specified
      const topEvent = events[0];
      let hasConflict = false;
      if (topEvent.startDateTime) {
        hasConflict = await this.checkCalendarConflict(userId, topEvent.startDateTime);
      }

      // 3. Determine urgency based on timing
      const urgency = this.determineUrgency(trigger.dateRange);

      // 4. Determine Ikigai dimensions
      const ikigaiDimensions = this.determineIkigaiDimensions(trigger);

      // 5. Generate mission card
      const missionCard = this.generateMissionCard(
        userId,
        trigger,
        events,
        urgency,
        ikigaiDimensions,
        hasConflict
      );

      // 6. Store mission card
      await this.storeMissionCard(store, userId, missionCard);

      // 7. Store event favorite if it's a popular event
      if (topEvent.ticketAvailability === 'limited') {
        await this.storeEventFavorite(store, userId, topEvent);
      }

      return {
        success: true,
        missionCard,
        response: `Found ${events.length} events matching "${trigger.query}"${hasConflict ? ' (calendar conflict detected)' : ''}`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Event search failed: ${errorMessage}`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
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

  /**
   * Search events using mock API
   */
  private async searchEvents(trigger: EventsTriggerData): Promise<Event[]> {
    const startTime = Date.now();

    const searchResult = await this.ticketmasterMock.searchEvents({
      location: trigger.location || 'San Francisco',
      category: trigger.category as MockEventCategory | undefined,
      startDate: trigger.dateRange?.start,
      endDate: trigger.dateRange?.end,
      priceMin: trigger.priceRange?.min,
      priceMax: trigger.priceRange?.max,
      query: trigger.query,
      limit: 10,
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
   */
  private determineUrgency(dateRange?: { start: string; end: string }): 'low' | 'medium' | 'high' {
    if (!dateRange?.start) return 'medium';

    const requestedTime = new Date(dateRange.start);
    const now = new Date();
    const hoursUntil = (requestedTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil < 4) return 'high';
    if (hoursUntil < 24) return 'high';
    if (hoursUntil < 72) return 'medium';
    return 'low';
  }

  /**
   * Determine Ikigai dimensions based on context
   */
  private determineIkigaiDimensions(
    trigger: EventsTriggerData
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

    // Default to passion if nothing else
    if (dimensions.length === 0) {
      dimensions.push('passion');
    }

    return [...new Set(dimensions)]; // Remove duplicates
  }

  /**
   * Generate mission card from search results
   */
  private generateMissionCard(
    _userId: string,
    trigger: EventsTriggerData,
    events: Event[],
    urgency: 'low' | 'medium' | 'high',
    ikigaiDimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'>,
    hasConflict: boolean
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
      ikigaiAlignmentBoost: 0.3,
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
      evidenceRefs: [],
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
   */
  private async storeEventFavorite(
    store: AgentContext['store'],
    userId: string,
    event: Event
  ): Promise<void> {
    const namespace = NS.eventFavorites(userId);
    const favorite = {
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
}
