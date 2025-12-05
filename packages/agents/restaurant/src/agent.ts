/**
 * Restaurant Agent - Sprint 7
 *
 * L2 agent for restaurant discovery, dietary preference matching,
 * and reservations (mock).
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import { BaseAgent, type AgentContext, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import { YelpMock } from '@ownyou/mock-apis';
import type { Restaurant as MockRestaurant } from '@ownyou/mock-apis';
import {
  RESTAURANT_PERMISSIONS,
  type RestaurantTriggerData,
  type Restaurant,
  type ReservationResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// RestaurantAgent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RestaurantAgent - L2 agent for restaurant discovery and reservations
 *
 * Capabilities:
 * - Search restaurants matching cuisine, location, and dietary requirements
 * - Respects user's dietary restrictions from Ikigai profile
 * - Makes reservations (mock API)
 * - Generates mission cards for restaurant recommendations
 *
 * @example
 * ```typescript
 * const agent = new RestaurantAgent();
 * const result = await agent.run({
 *   userId: 'user_123',
 *   store: memoryStore,
 *   tools: [],
 *   triggerData: {
 *     query: 'Find Italian restaurant for tonight',
 *     cuisine: 'Italian',
 *     partySize: 2,
 *   },
 * });
 * ```
 */
export class RestaurantAgent extends BaseAgent {
  readonly agentType = 'restaurant' as const;
  readonly level = 'L2' as const;

  private yelpMock: YelpMock;

  constructor() {
    super(RESTAURANT_PERMISSIONS);
    this.yelpMock = new YelpMock({ seed: 42 }); // Consistent results for testing
  }

  /**
   * Execute the restaurant agent logic
   */
  protected async execute(context: AgentContext): Promise<AgentResult> {
    const { userId, store, triggerData } = context;

    // Validate trigger data
    if (!triggerData || !this.isRestaurantTrigger(triggerData)) {
      return {
        success: false,
        error: 'Missing or invalid trigger data - expected RestaurantTriggerData',
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    const trigger = triggerData as RestaurantTriggerData;

    try {
      // 1. Search for restaurants
      const restaurants = await this.searchRestaurants(trigger);

      if (restaurants.length === 0) {
        return {
          success: true,
          response: `No restaurants found matching criteria: ${trigger.query}`,
          usage: this.limitsEnforcer.getUsage(),
          toolCalls: [],
          llmCalls: [],
          memoryOps: [],
        };
      }

      // 2. Determine urgency based on timing
      const urgency = this.determineUrgency(trigger.dateTime);

      // 3. Determine Ikigai dimensions
      const ikigaiDimensions = this.determineIkigaiDimensions(trigger);

      // 4. Generate mission card
      const missionCard = this.generateMissionCard(
        userId,
        trigger,
        restaurants,
        urgency,
        ikigaiDimensions
      );

      // 5. Store mission card
      await this.storeMissionCard(store, userId, missionCard);

      // 6. Store restaurant favorites if top rated
      const topRestaurant = restaurants[0];
      if (topRestaurant.rating >= 4.5) {
        await this.storeRestaurantFavorite(store, userId, topRestaurant);
      }

      return {
        success: true,
        missionCard,
        response: `Found ${restaurants.length} restaurants matching "${trigger.query}"`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Restaurant search failed: ${errorMessage}`,
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
   * Type guard for RestaurantTriggerData
   */
  private isRestaurantTrigger(data: unknown): data is RestaurantTriggerData {
    if (typeof data !== 'object' || data === null) return false;
    const trigger = data as Record<string, unknown>;
    return (
      typeof trigger.query === 'string' &&
      typeof trigger.partySize === 'number'
    );
  }

  /**
   * Search restaurants using mock API
   */
  private async searchRestaurants(trigger: RestaurantTriggerData): Promise<Restaurant[]> {
    const startTime = Date.now();

    // Pass dietary requirements to mock API so it generates restaurants with those options
    const searchResult = await this.yelpMock.searchRestaurants({
      location: trigger.location || 'San Francisco',
      cuisine: trigger.cuisine,
      priceRange: trigger.priceRange,
      dietaryRequirements: trigger.dietaryRestrictions as any,
      limit: 10,
    });

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'search_restaurants',
      { trigger },
      { restaurantCount: searchResult.restaurants.length },
      durationMs
    );

    // Convert mock restaurants to our Restaurant type
    const restaurants: Restaurant[] = searchResult.restaurants.map((r: MockRestaurant) => ({
      id: r.id,
      name: r.name,
      cuisines: [r.cuisine],
      priceRange: r.priceRange,
      rating: r.rating,
      reviewCount: r.reviewCount,
      address: r.address,
      city: r.city,
      coordinates: r.coordinates,
      dietaryLabels: r.dietaryOptions as string[],
      phone: r.phone,
      photos: r.imageUrl ? [r.imageUrl] : undefined,
      reservationsAvailable: r.reservationAvailable,
    }));

    // The mock API already includes the requested dietary options in the restaurant data
    // when dietaryRequirements is passed, so we don't need to filter again
    return restaurants;
  }

  /**
   * Determine urgency based on requested date/time
   */
  private determineUrgency(dateTime?: string): 'low' | 'medium' | 'high' {
    if (!dateTime) return 'medium';

    const requestedTime = new Date(dateTime);
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
    trigger: RestaurantTriggerData
  ): Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> {
    const dimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> = [];

    // Dining is often about relationships
    if (trigger.partySize >= 2) {
      dimensions.push('relationships');
    }

    // Dietary restrictions relate to wellbeing
    if (trigger.dietaryRestrictions && trigger.dietaryRestrictions.length > 0) {
      dimensions.push('wellbeing');
    }

    // Food exploration can be passion
    if (trigger.cuisine) {
      dimensions.push('passion');
    }

    // Default to relationships if nothing else
    if (dimensions.length === 0) {
      dimensions.push('relationships');
    }

    return dimensions;
  }

  /**
   * Generate mission card from search results
   */
  private generateMissionCard(
    _userId: string,
    trigger: RestaurantTriggerData,
    restaurants: Restaurant[],
    urgency: 'low' | 'medium' | 'high',
    ikigaiDimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'>
  ): MissionCard {
    const now = Date.now();
    const missionId = `mission_restaurant_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const topRestaurant = restaurants[0];

    const title = trigger.cuisine
      ? `${trigger.cuisine} Restaurant: ${topRestaurant.name}`
      : `Restaurant Recommendation: ${topRestaurant.name}`;

    const summary = `${topRestaurant.name} - ${topRestaurant.rating}★ (${topRestaurant.reviewCount} reviews) • ${topRestaurant.priceRange} • ${topRestaurant.cuisines.join(', ')}`;

    return {
      id: missionId,
      type: 'restaurant',
      title,
      summary,
      urgency,
      status: 'CREATED',
      createdAt: now,
      expiresAt: trigger.dateTime ? new Date(trigger.dateTime).getTime() : undefined,
      ikigaiDimensions,
      ikigaiAlignmentBoost: 0.3,
      primaryAction: {
        label: 'View Restaurant',
        type: 'navigate',
        payload: {
          route: '/restaurant',
          restaurantId: topRestaurant.id,
          restaurants: restaurants.slice(0, 5).map((r) => r.id),
        },
      },
      secondaryActions: [
        {
          label: 'Make Reservation',
          type: 'action',
          payload: {
            action: 'reserve',
            restaurantId: topRestaurant.id,
            partySize: trigger.partySize,
            dateTime: trigger.dateTime,
          },
        },
        {
          label: 'See More Options',
          type: 'navigate',
          payload: {
            route: '/restaurants',
            query: trigger.query,
            restaurants: restaurants.map((r) => r.id),
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
   * Store restaurant as favorite
   */
  private async storeRestaurantFavorite(
    store: AgentContext['store'],
    userId: string,
    restaurant: Restaurant
  ): Promise<void> {
    const namespace = NS.restaurantFavorites(userId);
    const favorite = {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      cuisine: restaurant.cuisines[0] || 'Unknown',
      visitCount: 0,
      addedAt: Date.now(),
    };
    this.recordMemoryOp('write', NAMESPACES.RESTAURANT_FAVORITES, restaurant.id);
    await store.put(namespace, restaurant.id, favorite);
  }
}
