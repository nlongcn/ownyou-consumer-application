/**
 * Mock API Types - Sprint 7
 *
 * Type definitions for mock external APIs used by Restaurant, Events, and Travel agents.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant Types (Yelp, OpenTable, Google Places)
// ─────────────────────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  rating: number;
  reviewCount: number;
  address: string;
  city: string;
  phone: string;
  website?: string;
  menuUrl?: string;
  imageUrl?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  hours: BusinessHours;
  dietaryOptions: DietaryOption[];
  ambiance: string[];
  noiseLevel: 'quiet' | 'moderate' | 'loud';
  reservationAvailable: boolean;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string; // HH:MM format
  close: string; // HH:MM format
  closed?: boolean;
}

export type DietaryOption =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'halal'
  | 'kosher'
  | 'dairy-free'
  | 'nut-free'
  | 'pescatarian';

export interface RestaurantSearchParams {
  cuisine?: string;
  location: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  dietaryRequirements?: DietaryOption[];
  partySize?: number;
  dateTime?: string; // ISO 8601
  ambiance?: string;
  sortBy?: 'rating' | 'distance' | 'price' | 'popularity';
  limit?: number;
}

export interface RestaurantSearchResult {
  restaurants: Restaurant[];
  totalCount: number;
  searchId: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietaryInfo: DietaryOption[];
  popular?: boolean;
  imageUrl?: string;
}

export interface MenuResult {
  restaurantId: string;
  sections: MenuSection[];
  lastUpdated: string;
}

export interface MenuSection {
  name: string;
  items: MenuItem[];
}

export interface ReservationParams {
  restaurantId: string;
  partySize: number;
  dateTime: string; // ISO 8601
  specialRequests?: string;
  guestName: string;
  phone: string;
  email?: string;
}

export interface ReservationResult {
  confirmationNumber: string;
  restaurantId: string;
  restaurantName: string;
  dateTime: string;
  partySize: number;
  status: 'confirmed' | 'pending' | 'waitlisted';
  cancellationPolicy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events Types (Ticketmaster, Eventbrite, Meetup)
// ─────────────────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
  subcategory?: string;
  venue: Venue;
  startDateTime: string; // ISO 8601
  endDateTime?: string;
  imageUrl?: string;
  ticketUrl?: string;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  ticketAvailability: 'available' | 'limited' | 'sold_out';
  organizer: string;
  ageRestriction?: string;
  tags: string[];
}

export type EventCategory =
  | 'music'
  | 'sports'
  | 'arts'
  | 'comedy'
  | 'theater'
  | 'food'
  | 'networking'
  | 'technology'
  | 'outdoors'
  | 'wellness'
  | 'family'
  | 'other';

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  capacity?: number;
}

export interface EventSearchParams {
  query?: string;
  category?: EventCategory;
  location: string;
  radius?: number; // in miles
  startDate?: string; // ISO 8601
  endDate?: string;
  priceMin?: number;
  priceMax?: number;
  sortBy?: 'date' | 'relevance' | 'popularity' | 'price';
  limit?: number;
}

export interface EventSearchResult {
  events: Event[];
  totalCount: number;
  searchId: string;
}

export interface TicketAvailabilityParams {
  eventId: string;
  quantity: number;
}

export interface TicketAvailabilityResult {
  eventId: string;
  available: boolean;
  sections: TicketSection[];
}

export interface TicketSection {
  sectionId: string;
  name: string;
  price: number;
  available: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Travel Types (Google Flights, TripAdvisor, Booking.com)
// ─────────────────────────────────────────────────────────────────────────────

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  departure: FlightSegment;
  arrival: FlightSegment;
  duration: number; // minutes
  stops: number;
  price: number;
  currency: string;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  seatsAvailable: number;
  baggage: BaggageInfo;
  refundable: boolean;
}

export interface FlightSegment {
  airport: string; // IATA code
  city: string;
  dateTime: string; // ISO 8601
  terminal?: string;
  gate?: string;
}

export interface BaggageInfo {
  carryOn: boolean;
  checkedBags: number;
  checkedBagFee?: number;
}

export interface FlightSearchParams {
  origin: string; // IATA code or city
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;
  passengers: number;
  cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
  directOnly?: boolean;
  maxPrice?: number;
  sortBy?: 'price' | 'duration' | 'departure' | 'arrival';
  limit?: number;
}

export interface FlightSearchResult {
  flights: Flight[];
  totalCount: number;
  searchId: string;
}

export interface Hotel {
  id: string;
  name: string;
  starRating: number;
  userRating: number;
  reviewCount: number;
  address: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  pricePerNight: number;
  currency: string;
  amenities: string[];
  imageUrls: string[];
  roomTypes: RoomType[];
  freeCancellation: boolean;
  breakfastIncluded: boolean;
}

export interface RoomType {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
  bedType: string;
  pricePerNight: number;
  available: boolean;
}

export interface HotelSearchParams {
  destination: string;
  /** Country - inferred from destination if not provided */
  country?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  guests: number;
  rooms?: number;
  minStarRating?: number;
  maxPrice?: number;
  amenities?: string[];
  sortBy?: 'price' | 'rating' | 'distance' | 'popularity';
  limit?: number;
}

export interface HotelSearchResult {
  hotels: Hotel[];
  totalCount: number;
  searchId: string;
}

export interface VisaRequirement {
  destination: string;
  nationality: string;
  visaRequired: boolean;
  visaType?: string;
  stayDuration?: number; // days
  processingTime?: string;
  applicationUrl?: string;
  notes?: string;
}

export interface ItineraryDay {
  day: number;
  date: string;
  activities: Activity[];
}

export interface Activity {
  id: string;
  name: string;
  type: 'sightseeing' | 'dining' | 'entertainment' | 'transport' | 'relaxation';
  startTime: string; // HH:MM
  endTime: string;
  location: string;
  description: string;
  estimatedCost?: number;
  bookingRequired: boolean;
  bookingUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  attendees?: string[];
  recurring?: boolean;
}

export interface CalendarAvailability {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
}

export interface TimeSlot {
  startTime: string; // HH:MM
  endTime: string;
  available: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock API Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface MockApiConfig {
  /** Simulated latency in ms */
  latency?: number;
  /** Random failure rate (0-1) */
  failureRate?: number;
  /** Seed for deterministic random data */
  seed?: number;
}
