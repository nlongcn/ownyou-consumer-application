/**
 * Restaurant Mock API Tests - Sprint 7
 *
 * Tests for Yelp, OpenTable, and Google Places mock APIs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  YelpMock,
  OpenTableMock,
  GooglePlacesMock,
} from '../restaurants';
import type {
  RestaurantSearchParams,
  ReservationParams,
} from '../types';

describe('YelpMock', () => {
  let yelpMock: YelpMock;

  beforeEach(() => {
    yelpMock = new YelpMock({ seed: 12345 });
  });

  describe('searchRestaurants', () => {
    it('should return restaurants matching location', async () => {
      const params: RestaurantSearchParams = {
        location: 'San Francisco',
        limit: 5,
      };

      const result = await yelpMock.searchRestaurants(params);

      expect(result.restaurants).toHaveLength(5);
      expect(result.totalCount).toBeGreaterThanOrEqual(5);
      expect(result.searchId).toBeDefined();
      result.restaurants.forEach((restaurant) => {
        expect(restaurant.city).toBe('San Francisco');
        expect(restaurant.id).toBeDefined();
        expect(restaurant.name).toBeDefined();
        expect(restaurant.rating).toBeGreaterThanOrEqual(1);
        expect(restaurant.rating).toBeLessThanOrEqual(5);
      });
    });

    it('should filter by cuisine type', async () => {
      const params: RestaurantSearchParams = {
        location: 'New York',
        cuisine: 'Italian',
        limit: 3,
      };

      const result = await yelpMock.searchRestaurants(params);

      result.restaurants.forEach((restaurant) => {
        expect(restaurant.cuisine.toLowerCase()).toContain('italian');
      });
    });

    it('should filter by price range', async () => {
      const params: RestaurantSearchParams = {
        location: 'Los Angeles',
        priceRange: '$$',
        limit: 3,
      };

      const result = await yelpMock.searchRestaurants(params);

      result.restaurants.forEach((restaurant) => {
        expect(restaurant.priceRange).toBe('$$');
      });
    });

    it('should filter by dietary requirements', async () => {
      const params: RestaurantSearchParams = {
        location: 'Seattle',
        dietaryRequirements: ['vegetarian', 'gluten-free'],
        limit: 3,
      };

      const result = await yelpMock.searchRestaurants(params);

      result.restaurants.forEach((restaurant) => {
        expect(restaurant.dietaryOptions).toContain('vegetarian');
        expect(restaurant.dietaryOptions).toContain('gluten-free');
      });
    });

    it('should sort by rating when specified', async () => {
      const params: RestaurantSearchParams = {
        location: 'Chicago',
        sortBy: 'rating',
        limit: 5,
      };

      const result = await yelpMock.searchRestaurants(params);

      for (let i = 1; i < result.restaurants.length; i++) {
        expect(result.restaurants[i - 1].rating).toBeGreaterThanOrEqual(
          result.restaurants[i].rating
        );
      }
    });
  });

  describe('getMenu', () => {
    it('should return menu for restaurant', async () => {
      const result = await yelpMock.getMenu('restaurant_1');

      expect(result.restaurantId).toBe('restaurant_1');
      expect(result.sections).toBeInstanceOf(Array);
      expect(result.sections.length).toBeGreaterThan(0);
      result.sections.forEach((section) => {
        expect(section.name).toBeDefined();
        expect(section.items).toBeInstanceOf(Array);
        section.items.forEach((item) => {
          expect(item.name).toBeDefined();
          expect(item.price).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('checkDietary', () => {
    it('should check dietary accommodation availability', async () => {
      const result = await yelpMock.checkDietary('restaurant_1', [
        'vegetarian',
        'gluten-free',
      ]);

      expect(result.restaurantId).toBe('restaurant_1');
      expect(result.accommodations).toBeDefined();
      expect(typeof result.accommodations.vegetarian).toBe('boolean');
      expect(typeof result.accommodations['gluten-free']).toBe('boolean');
    });
  });
});

describe('OpenTableMock', () => {
  let openTableMock: OpenTableMock;

  beforeEach(() => {
    openTableMock = new OpenTableMock({ seed: 12345 });
  });

  describe('searchRestaurants', () => {
    it('should return restaurants with reservation availability', async () => {
      const params: RestaurantSearchParams = {
        location: 'San Francisco',
        dateTime: '2025-12-10T19:00:00Z',
        partySize: 4,
        limit: 3,
      };

      const result = await openTableMock.searchRestaurants(params);

      expect(result.restaurants).toHaveLength(3);
      result.restaurants.forEach((restaurant) => {
        expect(restaurant.reservationAvailable).toBe(true);
      });
    });
  });

  describe('makeReservation', () => {
    it('should create a reservation and return confirmation', async () => {
      const params: ReservationParams = {
        restaurantId: 'restaurant_1',
        partySize: 4,
        dateTime: '2025-12-10T19:00:00Z',
        guestName: 'John Doe',
        phone: '555-1234',
        email: 'john@example.com',
      };

      const result = await openTableMock.makeReservation(params);

      expect(result.confirmationNumber).toBeDefined();
      expect(result.confirmationNumber.length).toBeGreaterThan(0);
      expect(result.restaurantId).toBe('restaurant_1');
      expect(result.partySize).toBe(4);
      expect(result.status).toBe('confirmed');
    });

    it('should handle special requests', async () => {
      const params: ReservationParams = {
        restaurantId: 'restaurant_1',
        partySize: 2,
        dateTime: '2025-12-10T20:00:00Z',
        guestName: 'Jane Doe',
        phone: '555-5678',
        specialRequests: 'Window table, anniversary dinner',
      };

      const result = await openTableMock.makeReservation(params);

      expect(result.status).toBe('confirmed');
    });
  });

  describe('checkAvailability', () => {
    it('should return available time slots', async () => {
      const result = await openTableMock.checkAvailability(
        'restaurant_1',
        '2025-12-10',
        4
      );

      expect(result.restaurantId).toBe('restaurant_1');
      expect(result.date).toBe('2025-12-10');
      expect(result.slots).toBeInstanceOf(Array);
      result.slots.forEach((slot) => {
        expect(slot.time).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof slot.available).toBe('boolean');
      });
    });
  });
});

describe('GooglePlacesMock', () => {
  let googlePlacesMock: GooglePlacesMock;

  beforeEach(() => {
    googlePlacesMock = new GooglePlacesMock({ seed: 12345 });
  });

  describe('searchRestaurants', () => {
    it('should return restaurants with detailed location info', async () => {
      const params: RestaurantSearchParams = {
        location: 'San Francisco',
        limit: 3,
      };

      const result = await googlePlacesMock.searchRestaurants(params);

      result.restaurants.forEach((restaurant) => {
        expect(restaurant.coordinates).toBeDefined();
        expect(restaurant.coordinates.latitude).toBeDefined();
        expect(restaurant.coordinates.longitude).toBeDefined();
        expect(restaurant.address).toBeDefined();
      });
    });
  });

  describe('getPlaceDetails', () => {
    it('should return detailed place information', async () => {
      const result = await googlePlacesMock.getPlaceDetails('restaurant_1');

      expect(result.id).toBe('restaurant_1');
      expect(result.name).toBeDefined();
      expect(result.hours).toBeDefined();
      expect(result.hours.monday).toBeDefined();
    });
  });
});
