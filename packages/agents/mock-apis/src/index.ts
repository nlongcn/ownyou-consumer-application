/**
 * @ownyou/mock-apis - Mock External APIs for Sprint 7 Agents
 *
 * Provides mock implementations of external APIs for Restaurant, Events, and Travel agents.
 * Real API integration will be implemented in Sprint 13.
 *
 * Main exports:
 * - Restaurant APIs: YelpMock, OpenTableMock, GooglePlacesMock
 * - Events APIs: TicketmasterMock, EventbriteMock, MeetupMock
 * - Travel APIs: GoogleFlightsMock, TripAdvisorMock, BookingMock
 * - Calendar: CalendarMock
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 3.6
 */

// Types
export * from './types';

// Restaurant APIs (Yelp, OpenTable, Google Places)
export {
  YelpMock,
  OpenTableMock,
  GooglePlacesMock,
} from './restaurants';

// Events APIs (Ticketmaster, Eventbrite, Meetup)
export {
  TicketmasterMock,
  EventbriteMock,
  MeetupMock,
} from './events';

// Travel APIs (Google Flights, TripAdvisor, Booking.com)
export {
  GoogleFlightsMock,
  TripAdvisorMock,
  BookingMock,
} from './travel';

// Calendar API
export { CalendarMock } from './calendar';
