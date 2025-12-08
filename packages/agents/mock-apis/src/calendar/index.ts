/**
 * Calendar Mock API - Sprint 7
 *
 * Mock calendar data for Events and Travel agents.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type {
  CalendarEvent,
  CalendarAvailability,
  TimeSlot,
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

const EVENT_TITLES = [
  'Team Meeting',
  'Lunch with John',
  'Project Review',
  'Doctor Appointment',
  'Coffee with Sarah',
  'Dentist',
  'Gym',
  'Yoga Class',
  'Dinner Reservation',
  'Movie Night',
  'Birthday Party',
  'Client Call',
];

// ─────────────────────────────────────────────────────────────────────────────
// CalendarMock
// ─────────────────────────────────────────────────────────────────────────────

export class CalendarMock {
  private random: () => number;
  private config: MockApiConfig;
  private events: Map<string, CalendarEvent[]> = new Map();

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  /**
   * Get events for a user within a date range
   */
  async getEvents(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{ events: CalendarEvent[] }> {
    await this.simulateLatency();

    // Get or generate events for user
    let userEvents = this.events.get(userId);
    if (!userEvents) {
      userEvents = this.generateEventsForUser(userId, startDate, endDate);
      this.events.set(userId, userEvents);
    }

    // Filter events within date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const filteredEvents = userEvents.filter((event) => {
      const eventDate = new Date(event.startDateTime);
      return eventDate >= start && eventDate <= end;
    });

    return { events: filteredEvents };
  }

  /**
   * Get availability slots for a specific date
   */
  async getAvailability(userId: string, date: string): Promise<CalendarAvailability> {
    await this.simulateLatency();

    // Get events for that day
    const { events } = await this.getEvents(userId, date, date);

    // Generate time slots
    const slots: TimeSlot[] = [];
    for (let hour = 8; hour < 22; hour++) {
      const startTime = `${String(hour).padStart(2, '0')}:00`;
      const endTime = `${String(hour + 1).padStart(2, '0')}:00`;

      // Check if slot is busy
      const slotStart = new Date(`${date}T${startTime}:00Z`);
      const slotEnd = new Date(`${date}T${endTime}:00Z`);

      const isBusy = events.some((event) => {
        const eventStart = new Date(event.startDateTime);
        const eventEnd = new Date(event.endDateTime);
        return slotStart < eventEnd && slotEnd > eventStart;
      });

      slots.push({
        startTime,
        endTime,
        available: !isBusy,
      });
    }

    return { date, slots };
  }

  /**
   * Add an event to the calendar
   */
  async addEvent(
    userId: string,
    event: Omit<CalendarEvent, 'id'>
  ): Promise<{ success: boolean; event?: CalendarEvent; conflict?: boolean }> {
    await this.simulateLatency();

    // Check for conflicts - directly check the stored events
    const eventStart = new Date(event.startDateTime);
    const eventEnd = new Date(event.endDateTime);

    // Get all user events directly from storage (don't use getEvents which may regenerate)
    const userEvents = this.events.get(userId) || [];

    // Check for conflicts with existing events
    const hasConflict = userEvents.some((e) => {
      const eStart = new Date(e.startDateTime);
      const eEnd = new Date(e.endDateTime);
      // Check if events overlap
      return eventStart < eEnd && eventEnd > eStart;
    });

    if (hasConflict) {
      return { success: false, conflict: true };
    }

    // Add the event
    const newEvent: CalendarEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...event,
    };

    userEvents.push(newEvent);
    this.events.set(userId, userEvents);

    return { success: true, event: newEvent };
  }

  /**
   * Check for free weekends in a month
   */
  async checkFreeWeekend(
    userId: string,
    yearMonth: string // YYYY-MM format
  ): Promise<{ weekends: Array<{ saturday: string; sunday: string; isFree: boolean }> }> {
    await this.simulateLatency();

    const [year, month] = yearMonth.split('-').map(Number);
    const weekends: Array<{ saturday: string; sunday: string; isFree: boolean }> = [];

    // Find all weekends in the month
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === 6) {
        // Saturday
        const saturday = date.toISOString().split('T')[0];
        const sunday = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Check if weekend is free
        const { events: satEvents } = await this.getEvents(userId, saturday, saturday);
        const { events: sunEvents } = await this.getEvents(userId, sunday, sunday);

        weekends.push({
          saturday,
          sunday,
          isFree: satEvents.length === 0 && sunEvents.length === 0,
        });
      }
      date.setDate(date.getDate() + 1);
    }

    return { weekends };
  }

  /**
   * Create invitations for an event
   */
  async inviteFriends(
    eventId: string,
    emails: string[]
  ): Promise<{
    eventId: string;
    invitations: Array<{ email: string; status: 'pending' | 'sent' | 'failed' }>;
  }> {
    await this.simulateLatency();

    const invitations = emails.map((email) => ({
      email,
      status: 'pending' as const,
    }));

    return { eventId, invitations };
  }

  /**
   * Generate mock events for a user
   */
  private generateEventsForUser(
    userId: string,
    startDate: string,
    endDate: string
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate 2-4 events per week
    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const eventsToGenerate = Math.floor(days / 7) * (2 + Math.floor(this.random() * 3));

    for (let i = 0; i < eventsToGenerate; i++) {
      const eventDate = new Date(start.getTime() + this.random() * (end.getTime() - start.getTime()));
      const hour = 9 + Math.floor(this.random() * 10); // 9am - 7pm
      eventDate.setHours(hour, 0, 0, 0);

      const durationHours = 1 + Math.floor(this.random() * 2);

      events.push({
        id: `event_${userId}_${i}`,
        title: EVENT_TITLES[Math.floor(this.random() * EVENT_TITLES.length)],
        startDateTime: eventDate.toISOString(),
        endDateTime: new Date(eventDate.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
        allDay: false,
        location: this.random() > 0.5 ? 'Office' : undefined,
      });
    }

    return events;
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}
