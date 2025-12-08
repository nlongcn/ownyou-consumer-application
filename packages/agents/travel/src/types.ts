/**
 * Travel Agent Types - Sprint 7
 *
 * Types for the Travel Agent including trigger data,
 * trip plans, itineraries, and permissions.
 *
 * L3 Agent: Multi-step planning with flights, hotels, and activities
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger data for travel agent activation
 */
export interface TravelTriggerData {
  /** Natural language query */
  query: string;

  /** Origin city/airport */
  origin: string;

  /** Destination city/country */
  destination: string;

  /** Departure date (ISO string) */
  departureDate: string;

  /** Return date (ISO string) - optional for one-way */
  returnDate?: string;

  /** Number of travelers */
  travelers?: number;

  /** Budget range */
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };

  /** Travel style preferences */
  travelStyle?: TravelStyle;

  /** User nationality (for visa check) */
  nationality?: string;

  /** Preferred cabin class */
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';

  /** Specific interests for activity planning */
  interests?: string[];

  /** Travel companions */
  companions?: string[];

  /** Whether to include activities */
  includeActivities?: boolean;
}

/**
 * Travel style preferences
 */
export type TravelStyle =
  | 'budget'
  | 'comfort'
  | 'luxury'
  | 'adventure'
  | 'relaxation'
  | 'cultural'
  | 'business';

// ─────────────────────────────────────────────────────────────────────────────
// Trip Plan Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete trip plan with all components
 */
export interface TripPlan {
  /** Unique identifier */
  id: string;

  /** User who owns this plan */
  userId: string;

  /** Origin city */
  origin: string;

  /** Destination city */
  destination: string;

  /** Trip start date */
  startDate: string;

  /** Trip end date */
  endDate: string;

  /** Number of travelers */
  travelers: number;

  /** Selected flight option */
  flight?: FlightSelection;

  /** Return flight (for round trips) */
  returnFlight?: FlightSelection;

  /** Selected hotel */
  hotel?: HotelSelection;

  /** Day-by-day itinerary */
  itinerary?: ItineraryDay[];

  /** Visa requirement info */
  visaInfo?: VisaInfo;

  /** Total estimated cost */
  estimatedCost: {
    flights: number;
    hotel: number;
    activities: number;
    total: number;
    currency: string;
  };

  /** Plan status */
  status: 'draft' | 'confirmed' | 'booked' | 'completed' | 'cancelled';

  /** Created timestamp */
  createdAt: number;

  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Selected flight info
 */
export interface FlightSelection {
  flightId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDateTime: string;
  arrivalDateTime: string;
  duration: number;
  stops: number;
  price: number;
  cabin: string;
}

/**
 * Selected hotel info
 */
export interface HotelSelection {
  hotelId: string;
  name: string;
  starRating: number;
  address: string;
  city: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  pricePerNight: number;
  totalPrice: number;
  amenities: string[];
}

/**
 * Itinerary for a single day
 */
export interface ItineraryDay {
  /** Day number (1-based) */
  dayNumber: number;

  /** Date for this day */
  date: string;

  /** Theme for the day */
  theme?: string;

  /** Activities for this day */
  activities: ItineraryActivity[];

  /** Notes for this day */
  notes?: string;
}

/**
 * Activity within an itinerary day
 */
export interface ItineraryActivity {
  /** Activity ID */
  id: string;

  /** Activity name */
  name: string;

  /** Activity type */
  type: 'sightseeing' | 'dining' | 'entertainment' | 'transport' | 'relaxation';

  /** Start time (HH:mm) */
  startTime: string;

  /** End time (HH:mm) */
  endTime: string;

  /** Location */
  location: string;

  /** Description */
  description?: string;

  /** Estimated cost */
  estimatedCost?: number;

  /** Booking required? */
  bookingRequired: boolean;

  /** Booking URL */
  bookingUrl?: string;
}

/**
 * Visa requirement information
 */
export interface VisaInfo {
  destination: string;
  nationality: string;
  visaRequired: boolean;
  visaType?: string;
  stayDuration?: number;
  processingTime?: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step in the multi-step planning workflow
 */
export type OrchestratorStep =
  | 'initialize'
  | 'check_visa'
  | 'search_flights'
  | 'search_hotels'
  | 'build_itinerary'
  | 'generate_mission'
  | 'complete';

/**
 * Orchestrator state for workflow tracking
 */
export interface OrchestratorState {
  currentStep: OrchestratorStep;
  completedSteps: OrchestratorStep[];
  tripPlan: Partial<TripPlan>;
  errors: string[];
  startedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types (v13 compliant - extracted magic numbers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Urgency threshold configuration for travel
 * Extracted per Sprint 7 spec lesson I2
 */
export interface TravelUrgencyThresholds {
  /** Days until departure for high urgency (default: 3) */
  highDays: number;
  /** Days until departure for medium urgency (default: 14) */
  mediumDays: number;
}

/**
 * Default urgency thresholds for travel agent
 */
export const DEFAULT_TRAVEL_URGENCY_THRESHOLDS: TravelUrgencyThresholds = {
  highDays: 3,
  mediumDays: 14,
};

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Travel Agent Permissions (L3)
 *
 * L3 has higher limits than L2:
 * - max_tool_calls: 25
 * - max_llm_calls: 10
 * - timeout_seconds: 300
 *
 * Read: ikigaiProfile, episodicMemory, proceduralMemory, travelPreferences, calendar
 * Write: travelItineraries, episodicMemory, proceduralMemory, missionCards
 */
export const TRAVEL_PERMISSIONS: AgentPermissions = {
  agentType: 'travel',
  memoryAccess: {
    read: [
      NAMESPACES.IKIGAI_PROFILE,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.PROCEDURAL_MEMORY,
      NAMESPACES.TRAVEL_PREFERENCES,
      NAMESPACES.CALENDAR,
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.ENTITIES,
      NAMESPACES.RELATIONSHIPS,
      NAMESPACES.FINANCIAL_PROFILE,
    ],
    write: [
      NAMESPACES.TRAVEL_ITINERARIES,
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
      name: 'google-flights-mock',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
    {
      name: 'tripadvisor-mock',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
    {
      name: 'booking-mock',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
  ],
  toolDefinitions: [
    {
      name: 'search_flights',
      description: 'Search for flights between origin and destination',
      parameters: {
        type: 'object',
        properties: {
          origin: { type: 'string', description: 'Origin airport/city' },
          destination: { type: 'string', description: 'Destination airport/city' },
          departureDate: { type: 'string', description: 'Departure date (ISO)' },
          returnDate: { type: 'string', description: 'Return date (ISO)' },
          cabin: { type: 'string', description: 'Cabin class' },
        },
        required: ['origin', 'destination', 'departureDate'],
      },
    },
    {
      name: 'search_hotels',
      description: 'Search for hotels at destination',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Destination city' },
          checkIn: { type: 'string', description: 'Check-in date' },
          checkOut: { type: 'string', description: 'Check-out date' },
          guests: { type: 'number', description: 'Number of guests' },
        },
        required: ['destination', 'checkIn', 'checkOut'],
      },
    },
    {
      name: 'build_itinerary',
      description: 'Build day-by-day itinerary with activities',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Destination city' },
          startDate: { type: 'string', description: 'Trip start date' },
          endDate: { type: 'string', description: 'Trip end date' },
          interests: { type: 'array', items: { type: 'string' } },
        },
        required: ['destination', 'startDate', 'endDate'],
      },
    },
    {
      name: 'check_visa',
      description: 'Check visa requirements for destination',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Destination country' },
          nationality: { type: 'string', description: 'Traveler nationality' },
        },
        required: ['destination', 'nationality'],
      },
    },
  ],
};
