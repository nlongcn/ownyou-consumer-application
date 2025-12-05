/**
 * Events Mock API Tests - Sprint 7
 *
 * Tests for Ticketmaster, Eventbrite, and Meetup mock APIs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TicketmasterMock,
  EventbriteMock,
  MeetupMock,
} from '../events';
import type { EventSearchParams } from '../types';

describe('TicketmasterMock', () => {
  let ticketmasterMock: TicketmasterMock;

  beforeEach(() => {
    ticketmasterMock = new TicketmasterMock({ seed: 12345 });
  });

  describe('searchEvents', () => {
    it('should return events matching location', async () => {
      const params: EventSearchParams = {
        location: 'Los Angeles',
        limit: 5,
      };

      const result = await ticketmasterMock.searchEvents(params);

      expect(result.events).toHaveLength(5);
      expect(result.totalCount).toBeGreaterThanOrEqual(5);
      expect(result.searchId).toBeDefined();
      result.events.forEach((event) => {
        expect(event.venue.city).toBe('Los Angeles');
        expect(event.id).toBeDefined();
        expect(event.name).toBeDefined();
        expect(event.startDateTime).toBeDefined();
      });
    });

    it('should filter by category', async () => {
      const params: EventSearchParams = {
        location: 'New York',
        category: 'music',
        limit: 3,
      };

      const result = await ticketmasterMock.searchEvents(params);

      result.events.forEach((event) => {
        expect(event.category).toBe('music');
      });
    });

    it('should filter by date range', async () => {
      const params: EventSearchParams = {
        location: 'Chicago',
        startDate: '2025-12-01',
        endDate: '2025-12-31',
        limit: 5,
      };

      const result = await ticketmasterMock.searchEvents(params);

      result.events.forEach((event) => {
        const eventDate = new Date(event.startDateTime);
        expect(eventDate.getMonth()).toBe(11); // December
        expect(eventDate.getFullYear()).toBe(2025);
      });
    });

    it('should filter by price range', async () => {
      const params: EventSearchParams = {
        location: 'San Francisco',
        priceMin: 20,
        priceMax: 100,
        limit: 3,
      };

      const result = await ticketmasterMock.searchEvents(params);

      result.events.forEach((event) => {
        expect(event.priceRange.min).toBeGreaterThanOrEqual(20);
        expect(event.priceRange.max).toBeLessThanOrEqual(100);
      });
    });

    it('should sort by date when specified', async () => {
      const params: EventSearchParams = {
        location: 'Seattle',
        sortBy: 'date',
        limit: 5,
      };

      const result = await ticketmasterMock.searchEvents(params);

      for (let i = 1; i < result.events.length; i++) {
        const prevDate = new Date(result.events[i - 1].startDateTime);
        const currDate = new Date(result.events[i].startDateTime);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    });
  });

  describe('checkAvailability', () => {
    it('should return ticket availability for event', async () => {
      const result = await ticketmasterMock.checkAvailability({
        eventId: 'event_1',
        quantity: 2,
      });

      expect(result.eventId).toBe('event_1');
      expect(typeof result.available).toBe('boolean');
      expect(result.sections).toBeInstanceOf(Array);
      result.sections.forEach((section) => {
        expect(section.sectionId).toBeDefined();
        expect(section.name).toBeDefined();
        expect(section.price).toBeGreaterThan(0);
        expect(section.available).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

describe('EventbriteMock', () => {
  let eventbriteMock: EventbriteMock;

  beforeEach(() => {
    eventbriteMock = new EventbriteMock({ seed: 12345 });
  });

  describe('searchEvents', () => {
    it('should return events with organizer info', async () => {
      const params: EventSearchParams = {
        location: 'San Francisco',
        limit: 3,
      };

      const result = await eventbriteMock.searchEvents(params);

      result.events.forEach((event) => {
        expect(event.organizer).toBeDefined();
        expect(event.ticketUrl).toBeDefined();
      });
    });

    it('should search by query text', async () => {
      const params: EventSearchParams = {
        location: 'New York',
        query: 'tech conference',
        limit: 3,
      };

      const result = await eventbriteMock.searchEvents(params);

      result.events.forEach((event) => {
        const searchText = `${event.name} ${event.description}`.toLowerCase();
        expect(
          searchText.includes('tech') || searchText.includes('conference')
        ).toBe(true);
      });
    });
  });

  describe('getEventDetails', () => {
    it('should return detailed event information', async () => {
      const result = await eventbriteMock.getEventDetails('event_1');

      expect(result.id).toBe('event_1');
      expect(result.name).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.venue).toBeDefined();
      expect(result.tags).toBeInstanceOf(Array);
    });
  });
});

describe('MeetupMock', () => {
  let meetupMock: MeetupMock;

  beforeEach(() => {
    meetupMock = new MeetupMock({ seed: 12345 });
  });

  describe('searchEvents', () => {
    it('should return community events', async () => {
      const params: EventSearchParams = {
        location: 'Austin',
        category: 'technology',
        limit: 3,
      };

      const result = await meetupMock.searchEvents(params);

      result.events.forEach((event) => {
        expect(event.category).toBe('technology');
        expect(event.priceRange.min).toBe(0); // Meetups are typically free
      });
    });

    it('should filter by radius', async () => {
      const params: EventSearchParams = {
        location: 'Denver',
        radius: 10,
        limit: 3,
      };

      const result = await meetupMock.searchEvents(params);

      expect(result.events.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getGroupEvents', () => {
    it('should return events for a specific group', async () => {
      const result = await meetupMock.getGroupEvents('group_1');

      expect(result.groupId).toBe('group_1');
      expect(result.events).toBeInstanceOf(Array);
      result.events.forEach((event) => {
        expect(event.organizer).toBeDefined();
      });
    });
  });
});
