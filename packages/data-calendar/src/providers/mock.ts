/**
 * Mock Calendar Provider - Sprint 8
 *
 * Mock implementation of calendar APIs for development and testing.
 * Generates realistic calendar events with attendees for relationship extraction.
 */

import {
  type CalendarEvent,
  type Attendee,
  type RecurringPattern,
  type EventType,
  type MockCalendarConfig,
  type CalendarFetchResult,
  EVENT_TYPE_KEYWORDS,
} from '../types.js';

/**
 * Default mock configuration
 */
const DEFAULT_MOCK_CONFIG: Required<MockCalendarConfig> = {
  eventCount: 50,
  daysRange: 90,
  failureRate: 0,
  latencyMs: 50,
  uniqueAttendees: 15,
  recurringEventPercentage: 0.2,
};

/**
 * Mock attendee names and emails
 */
const MOCK_ATTENDEES: Array<{ name: string; email: string }> = [
  { name: 'Alice Johnson', email: 'alice.johnson@company.com' },
  { name: 'Bob Smith', email: 'bob.smith@company.com' },
  { name: 'Carol Williams', email: 'carol.williams@company.com' },
  { name: 'David Brown', email: 'david.brown@company.com' },
  { name: 'Eva Martinez', email: 'eva.martinez@company.com' },
  { name: 'Frank Garcia', email: 'frank.garcia@external.com' },
  { name: 'Grace Lee', email: 'grace.lee@company.com' },
  { name: 'Henry Wilson', email: 'henry.wilson@company.com' },
  { name: 'Iris Chen', email: 'iris.chen@company.com' },
  { name: 'Jack Taylor', email: 'jack.taylor@company.com' },
  { name: 'Kate Anderson', email: 'kate.anderson@external.com' },
  { name: 'Leo Thomas', email: 'leo.thomas@company.com' },
  { name: 'Maria Garcia', email: 'maria.garcia@company.com' },
  { name: 'Nathan White', email: 'nathan.white@company.com' },
  { name: 'Olivia Davis', email: 'olivia.davis@company.com' },
  { name: 'Dr. Sarah Mitchell', email: 'dr.mitchell@health.com' },
  { name: 'Yoga Studio', email: 'booking@yogastudio.com' },
  { name: 'Local Gym', email: 'reservations@localgym.com' },
  { name: 'Community Center', email: 'events@communitycenter.org' },
  { name: 'Red Cross Volunteer', email: 'volunteer@redcross.org' },
];

/**
 * Mock event templates by type
 */
const MOCK_EVENT_TEMPLATES: Record<EventType, string[]> = {
  meeting: [
    'Weekly Team Standup',
    'Project Planning Meeting',
    'Sprint Review',
    'Sprint Retrospective',
    '1:1 with {attendee}',
    'Product Demo',
    'Design Review',
    'Tech Interview - {role}',
    'All Hands Meeting',
    'Quarterly Planning',
    'Budget Review',
    'Client Call - {company}',
  ],
  social: [
    'Dinner with {attendee}',
    'Birthday Party',
    'Happy Hour',
    'Lunch with {attendee}',
    'Brunch',
    'Game Night',
    'House Party',
    'Coffee catch-up',
    'Family Reunion',
    'Celebration Dinner',
  ],
  appointment: [
    'Dentist Appointment',
    'Doctor Checkup',
    'Haircut',
    'Car Service',
    'Therapy Session',
    'Vet Appointment',
    'Eye Exam',
    'Massage',
    'Legal Consultation',
  ],
  travel: [
    'Flight to {destination}',
    'Hotel Check-in',
    'Road Trip to {destination}',
    'Vacation - {destination}',
    'Business Trip - {destination}',
    'Conference Travel',
    'Weekend Getaway',
  ],
  entertainment: [
    'Concert - {artist}',
    'Movie Night',
    'Theater: {show}',
    'Sports Game - {team}',
    'Museum Visit',
    'Art Exhibition',
    'Comedy Show',
    'Jazz Night',
  ],
  exercise: [
    'Morning Run',
    'Gym Session',
    'Yoga Class',
    'Pilates',
    'Swimming',
    'Tennis Match',
    'Golf',
    'Hiking - {trail}',
    'CrossFit',
    'Spin Class',
    'Personal Training',
  ],
  learning: [
    'Online Course: {topic}',
    'Workshop: {topic}',
    'Webinar - {topic}',
    'Language Lesson',
    'Music Lesson',
    'Photography Class',
    'Cooking Class',
    'Seminar: {topic}',
  ],
  volunteer: [
    'Volunteer at Food Bank',
    'Community Cleanup',
    'Charity Run',
    'Fundraiser Event',
    'Mentoring Session',
    'Red Cross Volunteering',
    'Animal Shelter Volunteer',
  ],
  personal: ['Focus Time', 'Personal Block', 'Do Not Disturb', 'Deep Work', 'Planning Time'],
  unknown: ['TBD', 'Placeholder', 'Blocked'],
};

/**
 * Placeholder values for templates
 */
const PLACEHOLDERS = {
  attendee: ['Alice', 'Bob', 'Carol', 'David', 'Eva'],
  role: ['Software Engineer', 'Product Manager', 'Designer', 'Data Scientist'],
  company: ['Acme Corp', 'TechStart', 'Global Inc', 'Innovate LLC'],
  destination: ['New York', 'San Francisco', 'Chicago', 'Miami', 'Seattle', 'London', 'Tokyo'],
  artist: ['Taylor Swift', 'Ed Sheeran', 'Coldplay', 'Local Band', 'Symphony Orchestra'],
  show: ['Hamilton', 'Wicked', 'The Lion King', 'Chicago', 'Dear Evan Hansen'],
  team: ['Lakers', 'Giants', 'Yankees', 'Warriors', 'Local FC'],
  trail: ['Blue Ridge', 'Pacific Crest', 'Appalachian', 'Local Loop'],
  topic: ['Machine Learning', 'Leadership', 'Design Thinking', 'Project Management', 'Data Analysis'],
};

/**
 * Mock calendar client
 */
export class MockCalendarClient {
  private config: Required<MockCalendarConfig>;
  private events: CalendarEvent[] = [];
  private syncToken = 0;

  constructor(config: MockCalendarConfig = {}) {
    this.config = { ...DEFAULT_MOCK_CONFIG, ...config };
    this.events = this.generateEvents();
  }

  /**
   * Simulate latency
   */
  private async delay(): Promise<void> {
    if (this.config.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
    }
  }

  /**
   * Simulate failure
   */
  private checkFailure(): void {
    if (Math.random() < this.config.failureRate) {
      throw new Error('MOCK_CALENDAR_ERROR: Simulated API failure');
    }
  }

  /**
   * Generate mock events
   */
  private generateEvents(): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Generate unique IDs
    let eventId = 1;

    for (let i = 0; i < this.config.eventCount; i++) {
      // Distribute events across past and future
      const daysOffset = Math.floor(
        Math.random() * this.config.daysRange * 2 - this.config.daysRange
      );
      const eventDate = new Date(now + daysOffset * msPerDay);

      // Pick random event type (weighted toward meetings)
      const eventType = this.pickEventType();

      // Generate event from template
      const template = this.pickTemplate(eventType);
      const title = this.fillTemplate(template);

      // Generate time
      const { startTime, endTime, isAllDay } = this.generateEventTime(eventDate, eventType);

      // Generate attendees based on event type
      const { attendees, organizer } = this.generateAttendees(eventType);

      // Determine if recurring
      const isRecurring =
        Math.random() < this.config.recurringEventPercentage &&
        (eventType === 'meeting' || eventType === 'exercise' || eventType === 'learning');

      const event: CalendarEvent = {
        id: `evt_${String(eventId++).padStart(6, '0')}`,
        providerId: `google_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36)}`,
        provider: Math.random() > 0.5 ? 'google' : 'microsoft',
        title,
        description: this.generateDescription(eventType),
        startTime,
        endTime,
        isAllDay,
        location: this.generateLocation(eventType),
        attendees,
        organizer,
        eventType,
        recurring: isRecurring,
        recurringPattern: isRecurring ? this.generateRecurringPattern(eventType) : undefined,
        fetchedAt: now,
        updatedAt: now,
      };

      events.push(event);
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return events;
  }

  /**
   * Pick event type with weighted probability
   */
  private pickEventType(): EventType {
    const weights: Record<EventType, number> = {
      meeting: 0.35, // Most common
      social: 0.15,
      appointment: 0.08,
      travel: 0.05,
      entertainment: 0.08,
      exercise: 0.12,
      learning: 0.07,
      volunteer: 0.03,
      personal: 0.05,
      unknown: 0.02,
    };

    const random = Math.random();
    let cumulative = 0;

    for (const [type, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (random <= cumulative) {
        return type as EventType;
      }
    }

    return 'meeting';
  }

  /**
   * Pick random template for event type
   */
  private pickTemplate(eventType: EventType): string {
    const templates = MOCK_EVENT_TEMPLATES[eventType];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Fill template placeholders
   */
  private fillTemplate(template: string): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      const values = PLACEHOLDERS[key as keyof typeof PLACEHOLDERS];
      if (values) {
        return values[Math.floor(Math.random() * values.length)];
      }
      return key;
    });
  }

  /**
   * Generate event time based on type
   */
  private generateEventTime(
    date: Date,
    eventType: EventType
  ): { startTime: string; endTime: string; isAllDay: boolean } {
    // Some events are all-day
    if (eventType === 'travel' && Math.random() > 0.5) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + Math.floor(Math.random() * 5) + 1);
      return {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isAllDay: true,
      };
    }

    // Time ranges by event type
    const timeRanges: Record<EventType, { startMin: number; startMax: number; duration: number }> =
      {
        meeting: { startMin: 9, startMax: 17, duration: 60 },
        social: { startMin: 17, startMax: 20, duration: 120 },
        appointment: { startMin: 8, startMax: 17, duration: 60 },
        travel: { startMin: 6, startMax: 20, duration: 180 },
        entertainment: { startMin: 18, startMax: 21, duration: 150 },
        exercise: { startMin: 6, startMax: 19, duration: 60 },
        learning: { startMin: 9, startMax: 19, duration: 90 },
        volunteer: { startMin: 9, startMax: 14, duration: 180 },
        personal: { startMin: 9, startMax: 17, duration: 120 },
        unknown: { startMin: 9, startMax: 17, duration: 60 },
      };

    const range = timeRanges[eventType];
    const startHour = Math.floor(Math.random() * (range.startMax - range.startMin)) + range.startMin;
    const startMinute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];

    const start = new Date(date);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(start.getTime() + range.duration * 60 * 1000);

    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      isAllDay: false,
    };
  }

  /**
   * Generate attendees based on event type
   */
  private generateAttendees(
    eventType: EventType
  ): { attendees: Attendee[]; organizer: Attendee | null } {
    // Some events typically have no attendees
    if (['personal', 'appointment', 'unknown'].includes(eventType)) {
      return { attendees: [], organizer: null };
    }

    // Exercise events might have instructor
    if (eventType === 'exercise') {
      if (Math.random() > 0.5) {
        return { attendees: [], organizer: null };
      }
    }

    // Determine attendee count by type
    const attendeeCounts: Record<string, { min: number; max: number }> = {
      meeting: { min: 2, max: 8 },
      social: { min: 1, max: 6 },
      entertainment: { min: 1, max: 4 },
      exercise: { min: 0, max: 2 },
      learning: { min: 0, max: 3 },
      volunteer: { min: 1, max: 5 },
      travel: { min: 0, max: 3 },
    };

    const range = attendeeCounts[eventType] || { min: 0, max: 2 };
    const count = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

    if (count === 0) {
      return { attendees: [], organizer: null };
    }

    // Pick random attendees
    const shuffled = [...MOCK_ATTENDEES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, this.config.uniqueAttendees));

    const attendees: Attendee[] = selected.map((a, index) => ({
      email: a.email,
      name: a.name,
      responseStatus: this.pickResponseStatus(),
      isOptional: index > 2 && Math.random() > 0.7,
      isOrganizer: index === 0,
    }));

    // First attendee is organizer
    const organizer: Attendee = {
      email: attendees[0].email,
      name: attendees[0].name,
      responseStatus: 'accepted',
      isOrganizer: true,
    };

    return { attendees, organizer };
  }

  /**
   * Pick random response status
   */
  private pickResponseStatus(): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
    const rand = Math.random();
    if (rand < 0.7) return 'accepted';
    if (rand < 0.85) return 'tentative';
    if (rand < 0.95) return 'needsAction';
    return 'declined';
  }

  /**
   * Generate event description
   */
  private generateDescription(eventType: EventType): string | null {
    if (Math.random() > 0.6) return null;

    const descriptions: Record<EventType, string[]> = {
      meeting: [
        'Discuss project status and blockers',
        'Review Q4 goals',
        'Sync on deliverables',
        'Regular check-in',
      ],
      social: [
        "Let's catch up!",
        'Looking forward to seeing everyone',
        'Casual get-together',
        'BYOB!',
      ],
      appointment: ['Regular checkup', 'Follow-up appointment', 'Initial consultation'],
      travel: ['Remember to pack!', 'Confirmation #: ABC123', 'Direct flight'],
      entertainment: ['Tickets confirmed', 'Meet at entrance', 'Doors open at 7 PM'],
      exercise: ['Bring water and towel', 'Outdoor class weather permitting', 'HIIT focus'],
      learning: [
        'Bring laptop',
        'Prerequisites: completed module 1',
        'Certificate upon completion',
      ],
      volunteer: [
        'Thank you for helping!',
        'Meet at main entrance',
        'Wear comfortable clothes',
      ],
      personal: ['No meetings please', 'Deep work time'],
      unknown: [],
    };

    const options = descriptions[eventType];
    return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
  }

  /**
   * Generate event location
   */
  private generateLocation(eventType: EventType): string | null {
    if (Math.random() > 0.7) return null;

    const locations: Record<EventType, string[]> = {
      meeting: ['Conference Room A', 'Zoom', 'Google Meet', 'Teams', 'Main Office'],
      social: [
        'Italian Bistro',
        "Murphy's Pub",
        'Central Park',
        "John's House",
        'Downtown Restaurant',
      ],
      appointment: ['Medical Center', 'Dental Office', 'Hair Salon', 'Wellness Spa'],
      travel: ['SFO Airport', 'LAX Airport', 'Grand Hotel', 'Highway 101'],
      entertainment: ['Concert Hall', 'AMC Theater', 'Sports Arena', 'Art Museum'],
      exercise: ['Downtown Gym', 'Yoga Studio', 'Tennis Club', 'Hiking Trail'],
      learning: ['Community College', 'Online', 'Tech Hub', 'Library'],
      volunteer: ['Food Bank', 'Community Center', 'Animal Shelter', 'Local Park'],
      personal: [],
      unknown: [],
    };

    const options = locations[eventType];
    return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
  }

  /**
   * Generate recurring pattern
   */
  private generateRecurringPattern(eventType: EventType): RecurringPattern {
    const patterns: RecurringPattern[] = [
      { frequency: 'daily', interval: 1 },
      { frequency: 'weekly', interval: 1 },
      { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] }, // MWF
      { frequency: 'weekly', interval: 2 },
      { frequency: 'monthly', interval: 1 },
    ];

    // Exercise tends to be more frequent
    if (eventType === 'exercise') {
      return patterns[Math.floor(Math.random() * 3)];
    }

    // Meetings are usually weekly
    if (eventType === 'meeting') {
      return patterns[1 + Math.floor(Math.random() * 2)];
    }

    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  /**
   * Fetch events (with sync token support)
   */
  async fetchEvents(syncToken?: string): Promise<CalendarFetchResult> {
    await this.delay();
    this.checkFailure();

    let events = this.events;

    // If sync token provided, return only newer events
    if (syncToken) {
      const tokenNum = parseInt(syncToken, 10);
      events = this.events.filter((_, index) => index >= tokenNum);
    }

    // Increment sync token
    this.syncToken++;

    return {
      events,
      nextSyncToken: String(this.syncToken),
      hasMore: false,
    };
  }

  /**
   * Get specific event by ID
   */
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    await this.delay();
    this.checkFailure();

    return this.events.find(e => e.id === eventId) || null;
  }

  /**
   * Get events in date range
   */
  async getEventsInRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    await this.delay();
    this.checkFailure();

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return this.events.filter(e => {
      const eventStart = new Date(e.startTime).getTime();
      return eventStart >= start && eventStart <= end;
    });
  }
}

/**
 * Create a mock calendar client
 */
export function createMockCalendarClient(config?: MockCalendarConfig): MockCalendarClient {
  return new MockCalendarClient(config);
}

/**
 * Generate mock events directly (for testing)
 */
export function generateMockEvents(count: number, daysRange: number = 90): CalendarEvent[] {
  const client = new MockCalendarClient({ eventCount: count, daysRange });
  // Access internal events through fetch
  const result = client.fetchEvents();
  return result instanceof Promise ? [] : (result as CalendarFetchResult).events;
}

/**
 * Export mock attendees for testing
 */
export { MOCK_ATTENDEES, MOCK_EVENT_TEMPLATES };
