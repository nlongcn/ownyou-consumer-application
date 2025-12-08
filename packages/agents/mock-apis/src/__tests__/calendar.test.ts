/**
 * Calendar Mock API Tests - Sprint 7
 *
 * Tests for mock calendar data used by agents.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarMock } from '../calendar';

describe('CalendarMock', () => {
  let calendarMock: CalendarMock;

  beforeEach(() => {
    calendarMock = new CalendarMock({ seed: 12345 });
  });

  describe('getEvents', () => {
    it('should return events for date range', async () => {
      const result = await calendarMock.getEvents(
        'user_1',
        '2025-12-01',
        '2025-12-31'
      );

      expect(result.events).toBeInstanceOf(Array);
      result.events.forEach((event) => {
        expect(event.id).toBeDefined();
        expect(event.title).toBeDefined();
        expect(event.startDateTime).toBeDefined();
        expect(event.endDateTime).toBeDefined();
      });
    });

    it('should filter events within date range', async () => {
      const result = await calendarMock.getEvents(
        'user_1',
        '2025-12-10',
        '2025-12-15'
      );

      result.events.forEach((event) => {
        const eventDate = new Date(event.startDateTime);
        expect(eventDate.getDate()).toBeGreaterThanOrEqual(10);
        expect(eventDate.getDate()).toBeLessThanOrEqual(15);
      });
    });
  });

  describe('getAvailability', () => {
    it('should return availability slots for a date', async () => {
      const result = await calendarMock.getAvailability('user_1', '2025-12-15');

      expect(result.date).toBe('2025-12-15');
      expect(result.slots).toBeInstanceOf(Array);
      result.slots.forEach((slot) => {
        expect(slot.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(slot.endTime).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof slot.available).toBe('boolean');
      });
    });

    it('should include both available and busy slots', async () => {
      const result = await calendarMock.getAvailability('user_1', '2025-12-16');

      const hasAvailable = result.slots.some((s) => s.available);
      const hasBusy = result.slots.some((s) => !s.available);

      expect(hasAvailable || hasBusy).toBe(true);
    });
  });

  describe('addEvent', () => {
    it('should add a new event to calendar', async () => {
      const event = {
        title: 'Team Meeting',
        startDateTime: '2025-12-20T10:00:00Z',
        endDateTime: '2025-12-20T11:00:00Z',
        location: 'Conference Room A',
      };

      const result = await calendarMock.addEvent('user_1', event);

      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event.id).toBeDefined();
      expect(result.event.title).toBe('Team Meeting');
    });

    it('should detect conflicts with existing events', async () => {
      // First add an event
      await calendarMock.addEvent('user_1', {
        title: 'Existing Meeting',
        startDateTime: '2025-12-21T14:00:00Z',
        endDateTime: '2025-12-21T15:00:00Z',
      });

      // Try to add conflicting event
      const result = await calendarMock.addEvent('user_1', {
        title: 'Conflicting Meeting',
        startDateTime: '2025-12-21T14:30:00Z',
        endDateTime: '2025-12-21T15:30:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
    });
  });

  describe('checkFreeWeekend', () => {
    it('should identify free weekends', async () => {
      const result = await calendarMock.checkFreeWeekend('user_1', '2025-12');

      expect(result.weekends).toBeInstanceOf(Array);
      result.weekends.forEach((weekend) => {
        expect(weekend.saturday).toBeDefined();
        expect(weekend.sunday).toBeDefined();
        expect(typeof weekend.isFree).toBe('boolean');
      });
    });
  });

  describe('inviteFriends', () => {
    it('should create invitations for an event', async () => {
      const result = await calendarMock.inviteFriends('event_1', [
        'friend_1@example.com',
        'friend_2@example.com',
      ]);

      expect(result.eventId).toBe('event_1');
      expect(result.invitations).toBeInstanceOf(Array);
      expect(result.invitations).toHaveLength(2);
      result.invitations.forEach((invitation) => {
        expect(invitation.email).toBeDefined();
        expect(invitation.status).toBe('pending');
      });
    });
  });
});
