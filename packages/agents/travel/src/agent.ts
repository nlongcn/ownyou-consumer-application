/**
 * Travel Agent - Sprint 7
 *
 * L3 agent for comprehensive travel planning with
 * multi-step workflow orchestration.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import { BaseAgent, type AgentContext, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import {
  GoogleFlightsMock,
  TripAdvisorMock,
  BookingMock,
} from '@ownyou/mock-apis';
import type {
  Flight as MockFlight,
  Hotel as MockHotel,
  Activity as MockActivity,
} from '@ownyou/mock-apis';
import {
  TRAVEL_PERMISSIONS,
  type TravelTriggerData,
  type TripPlan,
  type FlightSelection,
  type HotelSelection,
  type ItineraryDay,
  type ItineraryActivity,
  type VisaInfo,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// TravelAgent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TravelAgent - L3 agent for comprehensive travel planning
 *
 * L3 Limits:
 * - max_tool_calls: 25
 * - max_llm_calls: 10
 * - timeout_seconds: 300
 *
 * Capabilities:
 * - Search flights with multiple options
 * - Search hotels at destination
 * - Build day-by-day itineraries with activities
 * - Check visa requirements
 * - Generates comprehensive trip plans
 *
 * @example
 * ```typescript
 * const agent = new TravelAgent();
 * const result = await agent.run({
 *   userId: 'user_123',
 *   store: memoryStore,
 *   tools: [],
 *   triggerData: {
 *     query: 'Plan a trip to Paris',
 *     origin: 'San Francisco',
 *     destination: 'Paris',
 *     departureDate: '2025-06-15',
 *     returnDate: '2025-06-22',
 *     travelers: 2,
 *   },
 * });
 * ```
 */
export class TravelAgent extends BaseAgent {
  readonly agentType = 'travel' as const;
  readonly level = 'L3' as const;

  private flightsMock: GoogleFlightsMock;
  private tripAdvisorMock: TripAdvisorMock;
  private bookingMock: BookingMock;

  constructor() {
    super(TRAVEL_PERMISSIONS);
    this.flightsMock = new GoogleFlightsMock({ seed: 42 });
    this.tripAdvisorMock = new TripAdvisorMock({ seed: 42 });
    this.bookingMock = new BookingMock({ seed: 42 });
  }

  /**
   * Execute the travel agent logic
   */
  protected async execute(context: AgentContext): Promise<AgentResult> {
    const { userId, store, triggerData } = context;

    // Validate trigger data
    if (!triggerData || !this.isTravelTrigger(triggerData)) {
      return {
        success: false,
        error: 'Missing or invalid trigger data - expected TravelTriggerData',
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    const trigger = triggerData as TravelTriggerData;

    try {
      // Initialize trip plan
      const tripPlan: Partial<TripPlan> = {
        id: `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        origin: trigger.origin,
        destination: trigger.destination,
        startDate: trigger.departureDate,
        endDate: trigger.returnDate || trigger.departureDate,
        travelers: trigger.travelers || 1,
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Step 1: Check visa if nationality provided
      if (trigger.nationality) {
        const visaInfo = await this.checkVisa(trigger.destination, trigger.nationality);
        tripPlan.visaInfo = visaInfo;
      }

      // Step 2: Search flights
      const flights = await this.searchFlights(trigger);
      if (flights.length > 0) {
        tripPlan.flight = this.selectBestFlight(flights, trigger);
      }

      // Step 3: Search return flights for round trips
      if (trigger.returnDate) {
        const returnFlights = await this.searchReturnFlights(trigger);
        if (returnFlights.length > 0) {
          tripPlan.returnFlight = this.selectBestFlight(returnFlights, trigger);
        }
      }

      // Step 4: Search hotels
      const hotels = await this.searchHotels(trigger);
      if (hotels.length > 0) {
        tripPlan.hotel = this.selectBestHotel(hotels, trigger);
      }

      // Step 5: Build itinerary if requested
      if (trigger.includeActivities || trigger.interests?.length) {
        tripPlan.itinerary = await this.buildItinerary(trigger);
      }

      // Step 6: Calculate total costs
      tripPlan.estimatedCost = this.calculateCosts(tripPlan);

      // Step 7: Determine urgency and Ikigai dimensions
      const urgency = this.determineUrgency(trigger.departureDate);
      const ikigaiDimensions = this.determineIkigaiDimensions(trigger);

      // Step 8: Generate mission card
      const missionCard = this.generateMissionCard(
        userId,
        trigger,
        tripPlan as TripPlan,
        urgency,
        ikigaiDimensions
      );

      // Step 9: Store trip plan and mission card
      await this.storeTripPlan(store, userId, tripPlan as TripPlan);
      await this.storeMissionCard(store, userId, missionCard);

      return {
        success: true,
        missionCard,
        response: `Trip to ${trigger.destination} planned successfully. Total estimated cost: $${tripPlan.estimatedCost?.total}`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Travel planning failed: ${errorMessage}`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods - Type Guards
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Type guard for TravelTriggerData
   */
  private isTravelTrigger(data: unknown): data is TravelTriggerData {
    if (typeof data !== 'object' || data === null) return false;
    const trigger = data as Record<string, unknown>;
    return (
      typeof trigger.query === 'string' &&
      typeof trigger.origin === 'string' &&
      typeof trigger.destination === 'string' &&
      typeof trigger.departureDate === 'string'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods - API Calls
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check visa requirements
   */
  private async checkVisa(destination: string, nationality: string): Promise<VisaInfo> {
    const startTime = Date.now();

    const result = await this.tripAdvisorMock.checkVisa(destination, nationality);

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'check_visa',
      { destination, nationality },
      { visaRequired: result.visaRequired },
      durationMs
    );

    return {
      destination: result.destination,
      nationality: result.nationality,
      visaRequired: result.visaRequired,
      visaType: result.visaType,
      stayDuration: result.stayDuration,
      processingTime: result.processingTime,
      notes: result.notes,
    };
  }

  /**
   * Search for outbound flights
   */
  private async searchFlights(trigger: TravelTriggerData): Promise<MockFlight[]> {
    const startTime = Date.now();

    const result = await this.flightsMock.searchFlights({
      origin: trigger.origin,
      destination: trigger.destination,
      departureDate: trigger.departureDate,
      cabin: trigger.cabinClass,
      maxPrice: trigger.budget?.max,
      limit: 10,
    });

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'search_flights',
      { origin: trigger.origin, destination: trigger.destination },
      { flightCount: result.flights.length },
      durationMs
    );

    return result.flights;
  }

  /**
   * Search for return flights
   */
  private async searchReturnFlights(trigger: TravelTriggerData): Promise<MockFlight[]> {
    if (!trigger.returnDate) return [];

    const startTime = Date.now();

    const result = await this.flightsMock.searchFlights({
      origin: trigger.destination,
      destination: trigger.origin,
      departureDate: trigger.returnDate,
      cabin: trigger.cabinClass,
      maxPrice: trigger.budget?.max,
      limit: 10,
    });

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'search_flights',
      { origin: trigger.destination, destination: trigger.origin, return: true },
      { flightCount: result.flights.length },
      durationMs
    );

    return result.flights;
  }

  /**
   * Search for hotels
   */
  private async searchHotels(trigger: TravelTriggerData): Promise<MockHotel[]> {
    const startTime = Date.now();

    const result = await this.bookingMock.searchHotels({
      destination: trigger.destination,
      checkIn: trigger.departureDate,
      checkOut: trigger.returnDate || trigger.departureDate,
      guests: trigger.travelers || 1,
      maxPrice: trigger.budget?.max ? trigger.budget.max / 7 : undefined, // Per night
      limit: 10,
    });

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'search_hotels',
      { destination: trigger.destination },
      { hotelCount: result.hotels.length },
      durationMs
    );

    return result.hotels;
  }

  /**
   * Build day-by-day itinerary
   */
  private async buildItinerary(trigger: TravelTriggerData): Promise<ItineraryDay[]> {
    const startTime = Date.now();

    // Get activities from TripAdvisor
    const activityResult = await this.tripAdvisorMock.getActivities(trigger.destination);

    const durationMs = Date.now() - startTime;
    this.recordToolCall(
      'build_itinerary',
      { destination: trigger.destination, interests: trigger.interests },
      { activityCount: activityResult.activities.length },
      durationMs
    );

    // Calculate number of days
    const startDate = new Date(trigger.departureDate);
    const endDate = new Date(trigger.returnDate || trigger.departureDate);
    const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Build itinerary days
    const itinerary: ItineraryDay[] = [];
    const activities = activityResult.activities;

    for (let i = 0; i < dayCount; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);

      // Assign 2-3 activities per day
      const dayActivities: ItineraryActivity[] = [];
      const activitiesPerDay = Math.min(3, Math.ceil(activities.length / dayCount));

      for (let j = 0; j < activitiesPerDay; j++) {
        const actIndex = (i * activitiesPerDay + j) % activities.length;
        const act = activities[actIndex];
        if (act) {
          dayActivities.push(this.convertActivity(act, j));
        }
      }

      itinerary.push({
        dayNumber: i + 1,
        date: dayDate.toISOString().split('T')[0],
        theme: this.getDayTheme(i, dayCount),
        activities: dayActivities,
      });
    }

    return itinerary;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods - Selection Logic
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Select best flight based on trigger preferences
   */
  private selectBestFlight(flights: MockFlight[], trigger: TravelTriggerData): FlightSelection {
    // Sort by preference (price for budget, duration otherwise)
    const sorted = [...flights].sort((a, b) => {
      if (trigger.travelStyle === 'budget') {
        return a.price - b.price;
      }
      return a.duration - b.duration;
    });

    const best = sorted[0];
    return {
      flightId: best.id,
      airline: best.airline,
      flightNumber: best.flightNumber,
      origin: best.departure.airport,
      destination: best.arrival.airport,
      departureDateTime: best.departure.dateTime,
      arrivalDateTime: best.arrival.dateTime,
      duration: best.duration,
      stops: best.stops,
      price: best.price,
      cabin: best.cabin,
    };
  }

  /**
   * Select best hotel based on trigger preferences
   */
  private selectBestHotel(hotels: MockHotel[], trigger: TravelTriggerData): HotelSelection {
    // Sort by preference
    const sorted = [...hotels].sort((a, b) => {
      if (trigger.travelStyle === 'luxury') {
        return b.starRating - a.starRating;
      }
      if (trigger.travelStyle === 'budget') {
        return a.pricePerNight - b.pricePerNight;
      }
      return b.userRating - a.userRating;
    });

    const best = sorted[0];
    const nights = this.calculateNights(trigger.departureDate, trigger.returnDate);

    return {
      hotelId: best.id,
      name: best.name,
      starRating: best.starRating,
      address: best.address,
      city: best.city,
      checkIn: trigger.departureDate,
      checkOut: trigger.returnDate || trigger.departureDate,
      roomType: best.roomTypes[0]?.name || 'Standard Room',
      pricePerNight: best.pricePerNight,
      totalPrice: best.pricePerNight * nights,
      amenities: best.amenities,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods - Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert mock activity to itinerary activity
   */
  private convertActivity(act: MockActivity, index: number): ItineraryActivity {
    const startHour = 9 + index * 3; // 9am, 12pm, 3pm
    return {
      id: act.id,
      name: act.name,
      type: act.type,
      startTime: `${startHour.toString().padStart(2, '0')}:00`,
      endTime: `${(startHour + 2).toString().padStart(2, '0')}:00`,
      location: act.location,
      description: act.description,
      estimatedCost: act.estimatedCost,
      bookingRequired: act.bookingRequired,
      bookingUrl: act.bookingUrl,
    };
  }

  /**
   * Get theme for a day based on position
   */
  private getDayTheme(dayIndex: number, totalDays: number): string {
    if (dayIndex === 0) return 'Arrival & Exploration';
    if (dayIndex === totalDays - 1) return 'Departure Day';
    const themes = ['Cultural Discovery', 'Local Experience', 'Adventure Day', 'Relaxation'];
    return themes[(dayIndex - 1) % themes.length];
  }

  /**
   * Calculate number of nights
   */
  private calculateNights(startDate: string, endDate?: string): number {
    if (!endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calculate total trip costs
   */
  private calculateCosts(tripPlan: Partial<TripPlan>): TripPlan['estimatedCost'] {
    const flightCost = (tripPlan.flight?.price || 0) + (tripPlan.returnFlight?.price || 0);
    const hotelCost = tripPlan.hotel?.totalPrice || 0;

    let activityCost = 0;
    if (tripPlan.itinerary) {
      for (const day of tripPlan.itinerary) {
        for (const activity of day.activities) {
          activityCost += activity.estimatedCost || 0;
        }
      }
    }

    return {
      flights: flightCost,
      hotel: hotelCost,
      activities: activityCost,
      total: flightCost + hotelCost + activityCost,
      currency: 'USD',
    };
  }

  /**
   * Determine urgency based on departure date
   */
  private determineUrgency(departureDate: string): 'low' | 'medium' | 'high' {
    const departure = new Date(departureDate);
    const now = new Date();
    const daysUntil = (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntil < 3) return 'high';
    if (daysUntil < 14) return 'medium';
    return 'low';
  }

  /**
   * Determine Ikigai dimensions based on travel context
   */
  private determineIkigaiDimensions(
    trigger: TravelTriggerData
  ): Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> {
    const dimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> = [];

    // Travel companions indicate relationships
    if (trigger.companions && trigger.companions.length > 0) {
      dimensions.push('relationships');
    }

    // Travel style determines dimensions
    switch (trigger.travelStyle) {
      case 'cultural':
        dimensions.push('growth');
        dimensions.push('passion');
        break;
      case 'adventure':
        dimensions.push('passion');
        dimensions.push('wellbeing');
        break;
      case 'relaxation':
        dimensions.push('wellbeing');
        break;
      case 'business':
        dimensions.push('profession');
        break;
      default:
        dimensions.push('passion');
    }

    // Default to passion if nothing else
    if (dimensions.length === 0) {
      dimensions.push('passion');
    }

    return [...new Set(dimensions)];
  }

  /**
   * Generate mission card from trip plan
   */
  private generateMissionCard(
    _userId: string,
    trigger: TravelTriggerData,
    tripPlan: TripPlan,
    urgency: 'low' | 'medium' | 'high',
    ikigaiDimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'>
  ): MissionCard {
    const now = Date.now();
    const missionId = `mission_travel_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const title = `Trip to ${trigger.destination}`;
    const dateRange = trigger.returnDate
      ? `${trigger.departureDate} - ${trigger.returnDate}`
      : trigger.departureDate;
    const summary = `${trigger.origin} → ${trigger.destination} • ${dateRange} • $${tripPlan.estimatedCost.total} total`;

    return {
      id: missionId,
      type: 'travel',
      title,
      summary,
      urgency,
      status: 'CREATED',
      createdAt: now,
      expiresAt: new Date(trigger.departureDate).getTime(),
      ikigaiDimensions,
      ikigaiAlignmentBoost: 0.4, // Travel is high-impact
      primaryAction: {
        label: 'View Trip Plan',
        type: 'navigate',
        payload: {
          route: '/trip',
          tripId: tripPlan.id,
        },
      },
      secondaryActions: [
        {
          label: 'Book Flights',
          type: 'action',
          payload: {
            action: 'book_flights',
            tripId: tripPlan.id,
            flightId: tripPlan.flight?.flightId,
          },
        },
        {
          label: 'Book Hotel',
          type: 'action',
          payload: {
            action: 'book_hotel',
            tripId: tripPlan.id,
            hotelId: tripPlan.hotel?.hotelId,
          },
        },
        {
          label: 'View Itinerary',
          type: 'navigate',
          payload: {
            route: '/itinerary',
            tripId: tripPlan.id,
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
   * Store trip plan in memory
   */
  private async storeTripPlan(
    store: AgentContext['store'],
    userId: string,
    tripPlan: TripPlan
  ): Promise<void> {
    const namespace = NS.travelItineraries(userId);
    this.recordMemoryOp('write', NAMESPACES.TRAVEL_ITINERARIES, tripPlan.id);
    await store.put(namespace, tripPlan.id, tripPlan);
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
}
