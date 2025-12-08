/**
 * Restaurant Agent Types - Sprint 7
 *
 * Types for the Restaurant Agent including trigger data,
 * restaurant data, and permissions.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger data for restaurant agent activation
 */
export interface RestaurantTriggerData {
  /** Natural language query */
  query: string;

  /** Desired cuisine type */
  cuisine?: string;

  /** Number of diners (defaults to 1 if not specified) */
  partySize?: number;

  /** Desired date/time (ISO string) */
  dateTime?: string;

  /** Location for search */
  location?: string;

  /** Price range filter */
  priceRange?: '$' | '$$' | '$$$' | '$$$$';

  /** Dietary restrictions to respect */
  dietaryRestrictions?: string[];

  /** Specific restaurant ID for reservation */
  restaurantId?: string;

  /** Special requests for reservation */
  specialRequests?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restaurant from search results
 */
export interface Restaurant {
  /** Unique identifier */
  id: string;

  /** Restaurant name */
  name: string;

  /** Cuisine type(s) */
  cuisines: string[];

  /** Price range indicator */
  priceRange: '$' | '$$' | '$$$' | '$$$$';

  /** Rating (0-5) */
  rating: number;

  /** Number of reviews */
  reviewCount: number;

  /** Full address */
  address: string;

  /** City */
  city: string;

  /** Coordinates */
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  /** Dietary labels (vegan, vegetarian, gluten-free, etc.) */
  dietaryLabels?: string[];

  /** Phone number */
  phone?: string;

  /** Restaurant photos */
  photos?: string[];

  /** Whether reservations are supported */
  reservationsAvailable?: boolean;

  /** Operating hours */
  hours?: {
    [day: string]: string;
  };
}

/**
 * Reservation request
 */
export interface ReservationRequest {
  /** Restaurant ID */
  restaurantId: string;

  /** Reservation date/time */
  dateTime: string;

  /** Party size */
  partySize: number;

  /** Contact name */
  contactName?: string;

  /** Contact phone */
  contactPhone?: string;

  /** Special requests */
  specialRequests?: string;
}

/**
 * Reservation result
 */
export interface ReservationResult {
  /** Whether reservation was successful */
  success: boolean;

  /** Confirmation number */
  confirmationNumber?: string;

  /** Restaurant name */
  restaurantName?: string;

  /** Confirmed date/time */
  dateTime?: string;

  /** Confirmed party size */
  partySize?: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Restaurant favorites entry
 */
export interface RestaurantFavorite {
  /** Restaurant ID */
  restaurantId: string;

  /** Restaurant name */
  restaurantName: string;

  /** Cuisine type */
  cuisine: string;

  /** User's rating (1-5, undefined if not rated yet) */
  userRating?: number;

  /** User notes about this restaurant */
  notes?: string;

  /** Last visited timestamp (undefined if never visited, just favorited) */
  lastVisited?: number;

  /** Times visited */
  visitCount: number;

  /** Added timestamp */
  addedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types (v13 compliant - extracted magic numbers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Urgency threshold configuration
 * Extracted per Sprint 7 spec lesson I2
 */
export interface UrgencyThresholds {
  /** Hours until event for high urgency (default: 24) */
  highHours: number;
  /** Hours until event for medium urgency (default: 72) */
  mediumHours: number;
}

/**
 * Default urgency thresholds for restaurant agent
 */
export const DEFAULT_URGENCY_THRESHOLDS: UrgencyThresholds = {
  highHours: 24,
  mediumHours: 72,
};

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restaurant Agent Permissions (L2)
 *
 * Read: ikigaiProfile, iabClassifications, episodicMemory
 * Write: diningReservations, restaurantFavorites, episodicMemory, proceduralMemory:restaurant
 */
export const RESTAURANT_PERMISSIONS: AgentPermissions = {
  agentType: 'restaurant',
  memoryAccess: {
    read: [
      NAMESPACES.IKIGAI_PROFILE,
      NAMESPACES.IAB_CLASSIFICATIONS,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.PROCEDURAL_MEMORY,
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.ENTITIES,
      NAMESPACES.RELATIONSHIPS,
    ],
    write: [
      NAMESPACES.DINING_RESERVATIONS,
      NAMESPACES.RESTAURANT_FAVORITES,
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
      name: 'yelp-mock',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
    {
      name: 'opentable-mock',
      rateLimit: '50/hour',
      requiresUserConsent: false,
    },
  ],
  toolDefinitions: [
    {
      name: 'search_restaurants',
      description: 'Search for restaurants matching cuisine, location, and dietary requirements',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Search term (cuisine, restaurant name)' },
          location: { type: 'string', description: 'Location to search' },
          price: { type: 'string', description: 'Price range ($, $$, $$$, $$$$)' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Dietary restrictions' },
        },
        required: ['location'],
      },
    },
    {
      name: 'make_reservation',
      description: 'Book a table at a restaurant',
      parameters: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Restaurant ID' },
          dateTime: { type: 'string', description: 'ISO date/time for reservation' },
          partySize: { type: 'number', description: 'Number of diners' },
          specialRequests: { type: 'string', description: 'Special requests' },
        },
        required: ['restaurantId', 'dateTime', 'partySize'],
      },
    },
    {
      name: 'get_menu',
      description: 'Retrieve menu items for a restaurant',
      parameters: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Restaurant ID' },
          category: { type: 'string', description: 'Menu category filter (appetizers, mains, desserts)' },
        },
        required: ['restaurantId'],
      },
    },
    {
      name: 'check_dietary',
      description: 'Check if restaurant accommodates specific dietary requirements',
      parameters: {
        type: 'object',
        properties: {
          restaurantId: { type: 'string', description: 'Restaurant ID' },
          dietaryRestrictions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dietary restrictions to check (vegan, vegetarian, gluten-free, etc.)',
          },
        },
        required: ['restaurantId', 'dietaryRestrictions'],
      },
    },
  ],
};
