/**
 * Travel Mock API Tests - Sprint 7
 *
 * Tests for Google Flights, TripAdvisor, and Booking.com mock APIs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GoogleFlightsMock,
  TripAdvisorMock,
  BookingMock,
} from '../travel';
import type { FlightSearchParams, HotelSearchParams } from '../types';

describe('GoogleFlightsMock', () => {
  let googleFlightsMock: GoogleFlightsMock;

  beforeEach(() => {
    googleFlightsMock = new GoogleFlightsMock({ seed: 12345 });
  });

  describe('searchFlights', () => {
    it('should return flights matching route', async () => {
      const params: FlightSearchParams = {
        origin: 'SFO',
        destination: 'JFK',
        departureDate: '2025-12-15',
        passengers: 1,
        limit: 5,
      };

      const result = await googleFlightsMock.searchFlights(params);

      expect(result.flights).toHaveLength(5);
      expect(result.totalCount).toBeGreaterThanOrEqual(5);
      expect(result.searchId).toBeDefined();
      result.flights.forEach((flight) => {
        expect(flight.departure.airport).toBe('SFO');
        expect(flight.arrival.airport).toBe('JFK');
        expect(flight.id).toBeDefined();
        expect(flight.airline).toBeDefined();
        expect(flight.price).toBeGreaterThan(0);
      });
    });

    it('should filter direct flights only', async () => {
      const params: FlightSearchParams = {
        origin: 'LAX',
        destination: 'ORD',
        departureDate: '2025-12-20',
        passengers: 2,
        directOnly: true,
        limit: 3,
      };

      const result = await googleFlightsMock.searchFlights(params);

      result.flights.forEach((flight) => {
        expect(flight.stops).toBe(0);
      });
    });

    it('should filter by cabin class', async () => {
      const params: FlightSearchParams = {
        origin: 'SEA',
        destination: 'MIA',
        departureDate: '2025-12-25',
        passengers: 1,
        cabin: 'business',
        limit: 3,
      };

      const result = await googleFlightsMock.searchFlights(params);

      result.flights.forEach((flight) => {
        expect(flight.cabin).toBe('business');
      });
    });

    it('should filter by max price', async () => {
      const params: FlightSearchParams = {
        origin: 'BOS',
        destination: 'LAX',
        departureDate: '2025-12-10',
        passengers: 1,
        maxPrice: 500,
        limit: 5,
      };

      const result = await googleFlightsMock.searchFlights(params);

      result.flights.forEach((flight) => {
        expect(flight.price).toBeLessThanOrEqual(500);
      });
    });

    it('should sort by price when specified', async () => {
      const params: FlightSearchParams = {
        origin: 'DEN',
        destination: 'ATL',
        departureDate: '2025-12-12',
        passengers: 1,
        sortBy: 'price',
        limit: 5,
      };

      const result = await googleFlightsMock.searchFlights(params);

      for (let i = 1; i < result.flights.length; i++) {
        expect(result.flights[i - 1].price).toBeLessThanOrEqual(
          result.flights[i].price
        );
      }
    });

    it('should include baggage info', async () => {
      const params: FlightSearchParams = {
        origin: 'PHX',
        destination: 'DFW',
        departureDate: '2025-12-18',
        passengers: 1,
        limit: 1,
      };

      const result = await googleFlightsMock.searchFlights(params);

      expect(result.flights[0].baggage).toBeDefined();
      expect(typeof result.flights[0].baggage.carryOn).toBe('boolean');
      expect(typeof result.flights[0].baggage.checkedBags).toBe('number');
    });
  });

  describe('getFlightDetails', () => {
    it('should return detailed flight information', async () => {
      const result = await googleFlightsMock.getFlightDetails('flight_1');

      expect(result.id).toBe('flight_1');
      expect(result.airline).toBeDefined();
      expect(result.flightNumber).toBeDefined();
      expect(result.departure).toBeDefined();
      expect(result.arrival).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});

describe('TripAdvisorMock', () => {
  let tripAdvisorMock: TripAdvisorMock;

  beforeEach(() => {
    tripAdvisorMock = new TripAdvisorMock({ seed: 12345 });
  });

  describe('searchHotels', () => {
    it('should return hotels matching destination', async () => {
      const params: HotelSearchParams = {
        destination: 'Paris',
        checkIn: '2025-12-20',
        checkOut: '2025-12-25',
        guests: 2,
        limit: 5,
      };

      const result = await tripAdvisorMock.searchHotels(params);

      expect(result.hotels).toHaveLength(5);
      expect(result.totalCount).toBeGreaterThanOrEqual(5);
      expect(result.searchId).toBeDefined();
      result.hotels.forEach((hotel) => {
        expect(hotel.city).toBe('Paris');
        expect(hotel.id).toBeDefined();
        expect(hotel.name).toBeDefined();
        expect(hotel.pricePerNight).toBeGreaterThan(0);
      });
    });

    it('should filter by star rating', async () => {
      const params: HotelSearchParams = {
        destination: 'Tokyo',
        checkIn: '2025-12-15',
        checkOut: '2025-12-18',
        guests: 1,
        minStarRating: 4,
        limit: 3,
      };

      const result = await tripAdvisorMock.searchHotels(params);

      result.hotels.forEach((hotel) => {
        expect(hotel.starRating).toBeGreaterThanOrEqual(4);
      });
    });

    it('should filter by max price', async () => {
      const params: HotelSearchParams = {
        destination: 'London',
        checkIn: '2025-12-10',
        checkOut: '2025-12-12',
        guests: 2,
        maxPrice: 200,
        limit: 3,
      };

      const result = await tripAdvisorMock.searchHotels(params);

      result.hotels.forEach((hotel) => {
        expect(hotel.pricePerNight).toBeLessThanOrEqual(200);
      });
    });

    it('should filter by amenities', async () => {
      const params: HotelSearchParams = {
        destination: 'Rome',
        checkIn: '2025-12-22',
        checkOut: '2025-12-26',
        guests: 2,
        amenities: ['wifi', 'pool'],
        limit: 3,
      };

      const result = await tripAdvisorMock.searchHotels(params);

      result.hotels.forEach((hotel) => {
        expect(hotel.amenities).toContain('wifi');
        expect(hotel.amenities).toContain('pool');
      });
    });

    it('should sort by rating when specified', async () => {
      const params: HotelSearchParams = {
        destination: 'Barcelona',
        checkIn: '2025-12-05',
        checkOut: '2025-12-08',
        guests: 2,
        sortBy: 'rating',
        limit: 5,
      };

      const result = await tripAdvisorMock.searchHotels(params);

      for (let i = 1; i < result.hotels.length; i++) {
        expect(result.hotels[i - 1].userRating).toBeGreaterThanOrEqual(
          result.hotels[i].userRating
        );
      }
    });
  });

  describe('getActivities', () => {
    it('should return activities for destination', async () => {
      const result = await tripAdvisorMock.getActivities('Paris');

      expect(result.destination).toBe('Paris');
      expect(result.activities).toBeInstanceOf(Array);
      result.activities.forEach((activity) => {
        expect(activity.name).toBeDefined();
        expect(activity.type).toBeDefined();
        expect(activity.estimatedCost).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('checkVisa', () => {
    it('should return visa requirements', async () => {
      const result = await tripAdvisorMock.checkVisa('France', 'US');

      expect(result.destination).toBe('France');
      expect(result.nationality).toBe('US');
      expect(typeof result.visaRequired).toBe('boolean');
    });
  });
});

describe('BookingMock', () => {
  let bookingMock: BookingMock;

  beforeEach(() => {
    bookingMock = new BookingMock({ seed: 12345 });
  });

  describe('searchHotels', () => {
    it('should return hotels with room availability', async () => {
      const params: HotelSearchParams = {
        destination: 'Amsterdam',
        checkIn: '2025-12-10',
        checkOut: '2025-12-13',
        guests: 2,
        rooms: 1,
        limit: 3,
      };

      const result = await bookingMock.searchHotels(params);

      result.hotels.forEach((hotel) => {
        expect(hotel.roomTypes).toBeInstanceOf(Array);
        expect(hotel.roomTypes.length).toBeGreaterThan(0);
        hotel.roomTypes.forEach((room) => {
          expect(room.name).toBeDefined();
          expect(room.pricePerNight).toBeGreaterThan(0);
          expect(typeof room.available).toBe('boolean');
        });
      });
    });

    it('should include cancellation policy info', async () => {
      const params: HotelSearchParams = {
        destination: 'Berlin',
        checkIn: '2025-12-15',
        checkOut: '2025-12-18',
        guests: 1,
        limit: 1,
      };

      const result = await bookingMock.searchHotels(params);

      expect(typeof result.hotels[0].freeCancellation).toBe('boolean');
    });
  });

  describe('getHotelDetails', () => {
    it('should return detailed hotel information', async () => {
      const result = await bookingMock.getHotelDetails('hotel_1');

      expect(result.id).toBe('hotel_1');
      expect(result.name).toBeDefined();
      expect(result.amenities).toBeInstanceOf(Array);
      expect(result.imageUrls).toBeInstanceOf(Array);
      expect(result.roomTypes).toBeInstanceOf(Array);
    });
  });

  describe('checkRoomAvailability', () => {
    it('should return room availability for dates', async () => {
      const result = await bookingMock.checkRoomAvailability(
        'hotel_1',
        '2025-12-20',
        '2025-12-23',
        2
      );

      expect(result.hotelId).toBe('hotel_1');
      expect(result.available).toBeDefined();
      expect(result.rooms).toBeInstanceOf(Array);
    });
  });
});
