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

  /** Number of diners */
  partySize: number;

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

  /** User's rating */
  userRating?: number;

  /** Notes */
  notes?: string;

  /** Last visited */
  lastVisited?: string;

  /** Times visited */
  visitCount: number;

  /** Added timestamp */
  addedAt: number;
}

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
  ],
};
