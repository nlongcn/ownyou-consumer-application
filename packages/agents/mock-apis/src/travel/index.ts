/**
 * Travel Mock APIs - Sprint 7
 *
 * Mock implementations for Google Flights, TripAdvisor, and Booking.com.
 * Used by Travel Agent until real API integration in Sprint 13.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type {
  Flight,
  FlightSearchParams,
  FlightSearchResult,
  FlightSegment,
  BaggageInfo,
  Hotel,
  HotelSearchParams,
  HotelSearchResult,
  RoomType,
  Activity,
  VisaRequirement,
  MockApiConfig,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded Random Generator
// ─────────────────────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const AIRLINES = [
  'United Airlines',
  'Delta Air Lines',
  'American Airlines',
  'Southwest Airlines',
  'JetBlue Airways',
  'Alaska Airlines',
  'Spirit Airlines',
  'Frontier Airlines',
];

const HOTEL_NAMES = [
  'Grand Hotel',
  'Marriott',
  'Hilton',
  'Hyatt Regency',
  'Four Seasons',
  'Ritz-Carlton',
  'Sheraton',
  'Westin',
  'Holiday Inn',
  'Best Western',
];

const HOTEL_AMENITIES = [
  'wifi',
  'pool',
  'gym',
  'spa',
  'restaurant',
  'bar',
  'room service',
  'parking',
  'concierge',
  'business center',
];

const ACTIVITY_TYPES: Array<'sightseeing' | 'dining' | 'entertainment' | 'transport' | 'relaxation'> = [
  'sightseeing',
  'dining',
  'entertainment',
  'transport',
  'relaxation',
];

const ACTIVITIES_BY_CITY: Record<string, string[]> = {
  Paris: ['Eiffel Tower Visit', 'Louvre Museum', 'Seine River Cruise', 'Montmartre Walk', 'French Cooking Class'],
  Tokyo: ['Shibuya Crossing', 'Senso-ji Temple', 'Sushi Workshop', 'Mt. Fuji Day Trip', 'Robot Restaurant'],
  London: ['Tower of London', 'British Museum', 'West End Show', 'Thames Cruise', 'Afternoon Tea'],
  Rome: ['Colosseum Tour', 'Vatican Museums', 'Trevi Fountain', 'Pasta Making Class', 'Trastevere Food Walk'],
  default: ['City Walking Tour', 'Local Food Tour', 'Museum Visit', 'Sunset Cruise', 'Cooking Class'],
};

function generateFlight(
  id: string,
  origin: string,
  destination: string,
  departureDate: string,
  random: () => number,
  options?: {
    directOnly?: boolean;
    cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
    maxPrice?: number;
  }
): Flight {
  const cabinTypes: ('economy' | 'premium_economy' | 'business' | 'first')[] = [
    'economy', 'premium_economy', 'business', 'first',
  ];
  const cabin = options?.cabin || cabinTypes[Math.floor(random() * 2)]; // Mostly economy/premium

  // Calculate base price by cabin
  const basePrices = { economy: 200, premium_economy: 400, business: 800, first: 1500 };
  let price = basePrices[cabin] + Math.floor(random() * 300);

  if (options?.maxPrice) {
    price = Math.min(price, options.maxPrice);
  }

  const stops = options?.directOnly ? 0 : Math.floor(random() * 3);
  const baseDuration = 180 + Math.floor(random() * 300); // 3-8 hours
  const duration = baseDuration + stops * 90; // Add layover time

  const departureTime = new Date(departureDate);
  departureTime.setHours(6 + Math.floor(random() * 14)); // 6am - 8pm
  departureTime.setMinutes(Math.floor(random() * 4) * 15); // 0, 15, 30, 45

  const arrivalTime = new Date(departureTime.getTime() + duration * 60 * 1000);

  const baggage: BaggageInfo = {
    carryOn: true,
    checkedBags: cabin === 'economy' ? 0 : cabin === 'premium_economy' ? 1 : 2,
    checkedBagFee: cabin === 'economy' ? 35 : undefined,
  };

  return {
    id,
    airline: AIRLINES[Math.floor(random() * AIRLINES.length)],
    flightNumber: `${String.fromCharCode(65 + Math.floor(random() * 26))}${String.fromCharCode(65 + Math.floor(random() * 26))}${Math.floor(random() * 9000) + 1000}`,
    departure: {
      airport: origin,
      city: origin,
      dateTime: departureTime.toISOString(),
      terminal: String(Math.floor(random() * 5) + 1),
    },
    arrival: {
      airport: destination,
      city: destination,
      dateTime: arrivalTime.toISOString(),
      terminal: String(Math.floor(random() * 5) + 1),
    },
    duration,
    stops,
    price,
    currency: 'USD',
    cabin,
    seatsAvailable: Math.floor(random() * 50) + 5,
    baggage,
    refundable: random() > 0.7,
  };
}

function generateHotel(
  id: string,
  city: string,
  random: () => number,
  options?: {
    minStarRating?: number;
    maxPrice?: number;
    amenities?: string[];
  }
): Hotel {
  let starRating = Math.floor(random() * 3) + 3; // 3-5 stars
  if (options?.minStarRating) {
    starRating = Math.max(starRating, options.minStarRating);
  }

  const basePriceByStars = { 3: 100, 4: 180, 5: 300 };
  let pricePerNight = (basePriceByStars[starRating as 3 | 4 | 5] || 150) + Math.floor(random() * 100);

  if (options?.maxPrice) {
    pricePerNight = Math.min(pricePerNight, options.maxPrice);
  }

  // Generate amenities - include required ones if specified
  const baseAmenities = HOTEL_AMENITIES.filter(() => random() > 0.4);
  const amenities = options?.amenities
    ? [...new Set([...baseAmenities, ...options.amenities])]
    : baseAmenities;

  const roomTypes: RoomType[] = [
    { id: `${id}_standard`, name: 'Standard Room', description: 'Comfortable standard room', maxGuests: 2, bedType: 'Queen', pricePerNight, available: random() > 0.2 },
    { id: `${id}_deluxe`, name: 'Deluxe Room', description: 'Spacious deluxe room with city view', maxGuests: 2, bedType: 'King', pricePerNight: pricePerNight * 1.3, available: random() > 0.3 },
    { id: `${id}_suite`, name: 'Suite', description: 'Luxurious suite with separate living area', maxGuests: 4, bedType: 'King', pricePerNight: pricePerNight * 2, available: random() > 0.5 },
  ];

  return {
    id,
    name: `${HOTEL_NAMES[Math.floor(random() * HOTEL_NAMES.length)]} ${city}`,
    starRating,
    userRating: Math.round((3.5 + random() * 1.5) * 10) / 10,
    reviewCount: Math.floor(random() * 2000) + 100,
    address: `${Math.floor(random() * 999) + 1} Hotel Boulevard`,
    city,
    country: 'France', // Default for demo
    coordinates: {
      latitude: 48.8566 + (random() - 0.5) * 0.1,
      longitude: 2.3522 + (random() - 0.5) * 0.1,
    },
    pricePerNight,
    currency: 'USD',
    amenities,
    imageUrls: [
      `https://images.example.com/hotels/${id}/1.jpg`,
      `https://images.example.com/hotels/${id}/2.jpg`,
    ],
    roomTypes,
    freeCancellation: random() > 0.3,
    breakfastIncluded: random() > 0.5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GoogleFlightsMock
// ─────────────────────────────────────────────────────────────────────────────

export class GoogleFlightsMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const flights: Flight[] = [];

    for (let i = 0; i < limit; i++) {
      const flight = generateFlight(
        `flight_${i + 1}`,
        params.origin,
        params.destination,
        params.departureDate,
        this.random,
        {
          directOnly: params.directOnly,
          cabin: params.cabin,
          maxPrice: params.maxPrice,
        }
      );
      flights.push(flight);
    }

    // Apply sorting
    if (params.sortBy === 'price') {
      flights.sort((a, b) => a.price - b.price);
    } else if (params.sortBy === 'duration') {
      flights.sort((a, b) => a.duration - b.duration);
    } else if (params.sortBy === 'departure') {
      flights.sort((a, b) => new Date(a.departure.dateTime).getTime() - new Date(b.departure.dateTime).getTime());
    }

    return {
      flights,
      totalCount: limit + Math.floor(this.random() * 50),
      searchId: `search_${Date.now()}`,
    };
  }

  async getFlightDetails(flightId: string): Promise<Flight> {
    await this.simulateLatency();

    return generateFlight(flightId, 'SFO', 'JFK', '2025-12-15', this.random);
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TripAdvisorMock
// ─────────────────────────────────────────────────────────────────────────────

export class TripAdvisorMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const hotels: Hotel[] = [];

    for (let i = 0; i < limit; i++) {
      const hotel = generateHotel(
        `hotel_ta_${i + 1}`,
        params.destination,
        this.random,
        {
          minStarRating: params.minStarRating,
          maxPrice: params.maxPrice,
          amenities: params.amenities,
        }
      );
      hotels.push(hotel);
    }

    // Apply sorting
    if (params.sortBy === 'rating') {
      hotels.sort((a, b) => b.userRating - a.userRating);
    } else if (params.sortBy === 'price') {
      hotels.sort((a, b) => a.pricePerNight - b.pricePerNight);
    }

    return {
      hotels,
      totalCount: limit + Math.floor(this.random() * 100),
      searchId: `search_${Date.now()}`,
    };
  }

  async getActivities(destination: string): Promise<{ destination: string; activities: Activity[] }> {
    await this.simulateLatency();

    const activityNames = ACTIVITIES_BY_CITY[destination] || ACTIVITIES_BY_CITY.default;
    const activities: Activity[] = activityNames.map((name, i) => ({
      id: `activity_${destination}_${i}`,
      name,
      type: ACTIVITY_TYPES[Math.floor(this.random() * ACTIVITY_TYPES.length)],
      startTime: '09:00',
      endTime: '12:00',
      location: destination,
      description: `Enjoy ${name} in beautiful ${destination}`,
      estimatedCost: Math.floor(this.random() * 100) + 20,
      bookingRequired: this.random() > 0.5,
      bookingUrl: `https://activities.example.com/${destination}/${i}`,
    }));

    return { destination, activities };
  }

  async checkVisa(destination: string, nationality: string): Promise<VisaRequirement> {
    await this.simulateLatency();

    // Simplified visa logic - US citizens don't need visa for most of Europe
    const noVisaCountries = ['France', 'Italy', 'Spain', 'Germany', 'UK', 'Japan', 'Canada', 'Mexico'];
    const visaRequired = nationality !== 'US' || !noVisaCountries.includes(destination);

    return {
      destination,
      nationality,
      visaRequired,
      visaType: visaRequired ? 'Tourist Visa' : undefined,
      stayDuration: 90,
      processingTime: visaRequired ? '5-10 business days' : undefined,
      notes: visaRequired ? 'Apply at least 3 weeks before travel' : 'No visa required for stays up to 90 days',
    };
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BookingMock
// ─────────────────────────────────────────────────────────────────────────────

export class BookingMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const hotels: Hotel[] = [];

    for (let i = 0; i < limit; i++) {
      const hotel = generateHotel(
        `hotel_booking_${i + 1}`,
        params.destination,
        this.random,
        {
          minStarRating: params.minStarRating,
          maxPrice: params.maxPrice,
          amenities: params.amenities,
        }
      );
      hotels.push(hotel);
    }

    return {
      hotels,
      totalCount: limit + Math.floor(this.random() * 80),
      searchId: `search_${Date.now()}`,
    };
  }

  async getHotelDetails(hotelId: string): Promise<Hotel> {
    await this.simulateLatency();

    return generateHotel(hotelId, 'Paris', this.random);
  }

  async checkRoomAvailability(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    guests: number
  ): Promise<{ hotelId: string; available: boolean; rooms: RoomType[] }> {
    await this.simulateLatency();

    const hotel = generateHotel(hotelId, 'Paris', this.random);
    const availableRooms = hotel.roomTypes.filter((r) => r.available && r.maxGuests >= guests);

    return {
      hotelId,
      available: availableRooms.length > 0,
      rooms: availableRooms,
    };
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

export { generateFlight, generateHotel };
