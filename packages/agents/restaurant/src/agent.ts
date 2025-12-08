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
  type RestaurantFavorite,
  type UrgencyThresholds,
  DEFAULT_URGENCY_THRESHOLDS,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RestaurantAgent configuration options
 * v13 compliant - all magic numbers extracted to config
 */
export interface RestaurantAgentConfig {
  /** Default location for restaurant searches when user has no stored preference */
  defaultLocation?: string;
  /** Seed for mock API (for deterministic testing) */
  mockSeed?: number;
  /** Minimum rating to auto-add restaurant to favorites */
  favoriteRatingThreshold?: number;
  /** Ikigai alignment boost for restaurant mission cards */
  ikigaiAlignmentBoost?: number;
  /** Maximum number of restaurants to return from search */
  searchLimit?: number;
  /** Urgency thresholds for determining mission urgency */
  urgencyThresholds?: UrgencyThresholds;
}

const DEFAULT_CONFIG: Required<RestaurantAgentConfig> = {
  defaultLocation: '', // Empty = require explicit location or user memory lookup
  mockSeed: 42,
  favoriteRatingThreshold: 4.5,
  ikigaiAlignmentBoost: 0.3,
  searchLimit: 10,
  urgencyThresholds: DEFAULT_URGENCY_THRESHOLDS,
};

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
  private config: Required<RestaurantAgentConfig>;

  constructor(config: RestaurantAgentConfig = {}) {
    super(RESTAURANT_PERMISSIONS);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.yelpMock = new YelpMock({ seed: this.config.mockSeed });
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
        // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
      } as AgentResult;
    }

    const trigger = triggerData as RestaurantTriggerData;

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

      // 3. Merge dietary restrictions from trigger and Ikigai profile
      const dietaryRestrictions = this.mergeDietaryRestrictions(
        trigger.dietaryRestrictions,
        ikigaiProfile?.dietaryPreferences
      );

      // 4. Search for restaurants with resolved location and merged restrictions
      const restaurants = await this.searchRestaurants({
        ...trigger,
        location,
        dietaryRestrictions,
      });

      if (restaurants.length === 0) {
        return {
          success: true,
          response: `No restaurants found matching criteria: ${trigger.query}`,
          // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
        } as AgentResult;
      }

      // 5. Determine urgency based on timing (using config thresholds)
      const urgency = this.determineUrgency(trigger.dateTime);

      // 6. Determine Ikigai dimensions (enhanced with profile data)
      const ikigaiDimensions = this.determineIkigaiDimensions(trigger, ikigaiProfile);

      // 7. Generate mission card with evidence refs
      const missionCard = this.generateMissionCard(
        userId,
        trigger,
        restaurants,
        urgency,
        ikigaiDimensions,
        evidenceRefs
      );

      // 8. Store mission card
      await this.storeMissionCard(store, userId, missionCard);

      // 9. Store restaurant favorites if top rated
      const topRestaurant = restaurants[0];
      if (topRestaurant.rating >= this.config.favoriteRatingThreshold) {
        await this.storeRestaurantFavorite(store, userId, topRestaurant);
      }

      return {
        success: true,
        missionCard,
        response: `Found ${restaurants.length} restaurants matching "${trigger.query}"`,
        // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
      } as AgentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Restaurant search failed: ${errorMessage}`,
        // Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
      } as AgentResult;
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
    // Only query is required; partySize is optional (defaults to 1)
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
  ): Promise<{ dietaryPreferences?: string[]; favoriteActivities?: string[] } | null> {
    try {
      const namespace = NS.ikigaiProfile(userId);
      const result = await store.get(namespace, 'profile');
      this.recordMemoryOp('read', NAMESPACES.IKIGAI_PROFILE, 'profile');

      if (result) {
        return result as { dietaryPreferences?: string[]; favoriteActivities?: string[] };
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
    trigger: RestaurantTriggerData
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

  /**
   * Merge dietary restrictions from trigger and Ikigai profile
   * Combines without duplicates
   */
  private mergeDietaryRestrictions(
    triggerRestrictions?: string[],
    profilePreferences?: string[]
  ): string[] | undefined {
    const combined = new Set<string>();

    if (triggerRestrictions) {
      triggerRestrictions.forEach((r) => combined.add(r.toLowerCase()));
    }
    if (profilePreferences) {
      profilePreferences.forEach((p) => combined.add(p.toLowerCase()));
    }

    return combined.size > 0 ? [...combined] : undefined;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Restaurant Search
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Search restaurants using mock API
   */
  private async searchRestaurants(trigger: RestaurantTriggerData): Promise<Restaurant[]> {
    const startTime = Date.now();

    // Pass dietary requirements to mock API so it generates restaurants with those options
    const searchResult = await this.yelpMock.searchRestaurants({
      location: trigger.location || this.config.defaultLocation,
      cuisine: trigger.cuisine,
      priceRange: trigger.priceRange,
      dietaryRequirements: trigger.dietaryRestrictions as any,
      limit: this.config.searchLimit,
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
   * Uses config thresholds per Sprint 7 spec lesson I2
   */
  private determineUrgency(dateTime?: string): 'low' | 'medium' | 'high' {
    if (!dateTime) return 'medium';

    const requestedTime = new Date(dateTime);
    const now = new Date();
    const hoursUntil = (requestedTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const thresholds = this.config.urgencyThresholds;
    if (hoursUntil < thresholds.highHours) return 'high';
    if (hoursUntil < thresholds.mediumHours) return 'medium';
    return 'low';
  }

  /**
   * Ikigai dimension type
   */
  private static readonly IkigaiDimensionType = ['passion', 'mission', 'profession', 'vocation', 'relationships', 'wellbeing', 'growth', 'contribution'] as const;

  /**
   * Determine Ikigai dimensions based on context and user's Ikigai profile
   * Enhanced to use profile data per v13 Section 2.9
   */
  private determineIkigaiDimensions(
    trigger: RestaurantTriggerData,
    ikigaiProfile?: { dietaryPreferences?: string[]; favoriteActivities?: string[] } | null
  ): Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> {
    const dimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> = [];

    // Dining is often about relationships (default partySize is 1)
    const partySize = trigger.partySize ?? 1;
    if (partySize >= 2) {
      dimensions.push('relationships');
    }

    // Dietary restrictions relate to wellbeing (from trigger or profile)
    const hasDietaryFocus =
      (trigger.dietaryRestrictions && trigger.dietaryRestrictions.length > 0) ||
      (ikigaiProfile?.dietaryPreferences && ikigaiProfile.dietaryPreferences.length > 0);
    if (hasDietaryFocus) {
      dimensions.push('wellbeing');
    }

    // Food exploration can be passion
    if (trigger.cuisine) {
      dimensions.push('passion');
    }

    // Check if dining is in user's favorite activities
    if (ikigaiProfile?.favoriteActivities?.some(a =>
      a.toLowerCase().includes('food') ||
      a.toLowerCase().includes('dining') ||
      a.toLowerCase().includes('culinary')
    )) {
      if (!dimensions.includes('passion')) {
        dimensions.push('passion');
      }
    }

    // Default to relationships if nothing else
    if (dimensions.length === 0) {
      dimensions.push('relationships');
    }

    return [...new Set(dimensions)]; // Remove duplicates
  }

  /**
   * Generate mission card from search results
   * Now accepts evidenceRefs for v13 compliance
   */
  private generateMissionCard(
    _userId: string,
    trigger: RestaurantTriggerData,
    restaurants: Restaurant[],
    urgency: 'low' | 'medium' | 'high',
    ikigaiDimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'>,
    evidenceRefs: string[] = []
  ): MissionCard {
    const now = Date.now();
    const missionId = `mission_restaurant_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const topRestaurant = restaurants[0];

    const title = trigger.cuisine
      ? `${trigger.cuisine} Restaurant: ${topRestaurant.name}`
      : `Restaurant Recommendation: ${topRestaurant.name}`;

    const summary = `${topRestaurant.name} - ${topRestaurant.rating}★ (${topRestaurant.reviewCount} reviews) • ${topRestaurant.priceRange} • ${topRestaurant.cuisines.join(', ')}`;

    // Add restaurant reference to evidence
    const allEvidence = [...evidenceRefs, `restaurant:${topRestaurant.id}`];

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
      ikigaiAlignmentBoost: this.config.ikigaiAlignmentBoost,
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
            partySize: trigger.partySize ?? 1,
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
   * Store restaurant as favorite
   * Populates all fields in RestaurantFavorite per Sprint 7 spec lesson I4
   */
  private async storeRestaurantFavorite(
    store: AgentContext['store'],
    userId: string,
    restaurant: Restaurant
  ): Promise<void> {
    const namespace = NS.restaurantFavorites(userId);
    const now = Date.now();

    // Create a complete RestaurantFavorite with all fields populated
    const favorite: RestaurantFavorite = {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      cuisine: restaurant.cuisines[0] || 'Unknown',
      userRating: undefined, // Not rated yet - will be set when user rates
      notes: undefined, // No notes yet - will be set when user adds notes
      lastVisited: undefined, // Not visited yet - just discovered/favorited
      visitCount: 0,
      addedAt: now,
    };

    this.recordMemoryOp('write', NAMESPACES.RESTAURANT_FAVORITES, restaurant.id);
    await store.put(namespace, restaurant.id, favorite);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Episode Recording Overrides (v13 Section 8.4.2)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override describeTrigger for restaurant-specific episode situation
   */
  protected override describeTrigger(trigger: unknown): string {
    if (!trigger || !this.isRestaurantTrigger(trigger)) {
      return 'Restaurant search without specific criteria';
    }

    const t = trigger as RestaurantTriggerData;
    const parts: string[] = [];

    if (t.cuisine) parts.push(`${t.cuisine} cuisine`);
    if (t.location) parts.push(`in ${t.location}`);
    if (t.partySize && t.partySize > 1) parts.push(`for ${t.partySize} people`);
    if (t.dateTime) parts.push(`on ${new Date(t.dateTime).toLocaleDateString()}`);
    if (t.dietaryRestrictions?.length) parts.push(`with ${t.dietaryRestrictions.join(', ')} options`);
    if (t.priceRange) parts.push(`(${t.priceRange} price range)`);

    return parts.length > 0
      ? `User searched for restaurant: ${parts.join(', ')}`
      : `User searched for restaurants: "${t.query}"`;
  }

  /**
   * Override extractTags for restaurant-specific episode tags
   */
  protected override extractTags(trigger: unknown, mission: import('@ownyou/shared-types').MissionCard): string[] {
    const baseTags = super.extractTags(trigger, mission);

    if (trigger && this.isRestaurantTrigger(trigger)) {
      const t = trigger as RestaurantTriggerData;
      if (t.cuisine) baseTags.push(`cuisine:${t.cuisine.toLowerCase()}`);
      if (t.priceRange) baseTags.push(`price:${t.priceRange}`);
      if (t.dietaryRestrictions) {
        t.dietaryRestrictions.forEach((d) => baseTags.push(`dietary:${d.toLowerCase()}`));
      }
    }

    return [...new Set(baseTags)]; // Remove duplicates
  }
}
