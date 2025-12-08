/**
 * Events Mock APIs - Sprint 7
 *
 * Mock implementations for Ticketmaster, Eventbrite, and Meetup.
 * Used by Events Agent until real API integration in Sprint 13.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type {
  Event,
  EventCategory,
  EventSearchParams,
  EventSearchResult,
  TicketAvailabilityParams,
  TicketAvailabilityResult,
  TicketSection,
  Venue,
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

const EVENT_NAMES: Record<EventCategory, string[]> = {
  music: ['Rock Festival', 'Jazz Night', 'Symphony Orchestra', 'Indie Concert', 'EDM Party'],
  sports: ['Basketball Game', 'Soccer Match', 'Marathon', 'Tennis Championship', 'Boxing Night'],
  arts: ['Art Exhibition', 'Sculpture Show', 'Photography Expo', 'Modern Art Gallery', 'Street Art Tour'],
  comedy: ['Stand-up Comedy', 'Improv Night', 'Comedy Festival', 'Late Night Laughs', 'Open Mic Comedy'],
  theater: ['Broadway Musical', 'Shakespeare Play', 'Contemporary Drama', 'Opera Night', 'Ballet Performance'],
  food: ['Food Festival', 'Wine Tasting', 'Cooking Class', 'Street Food Tour', 'Chef\'s Table'],
  networking: ['Startup Mixer', 'Industry Conference', 'Career Fair', 'Business Breakfast', 'Investor Meetup'],
  technology: ['Tech Conference', 'Hackathon', 'AI Summit', 'Developer Meetup', 'Startup Demo Day'],
  outdoors: ['Hiking Trip', 'Beach Cleanup', 'Camping Weekend', 'Kayaking Adventure', 'Bike Tour'],
  wellness: ['Yoga Retreat', 'Meditation Class', 'Wellness Workshop', 'Spa Day', 'Fitness Bootcamp'],
  family: ['Kids Festival', 'Family Fun Day', 'Zoo Visit', 'Theme Park Trip', 'Story Time'],
  other: ['Community Event', 'Charity Gala', 'Holiday Celebration', 'Cultural Festival', 'Workshop'],
};

const VENUE_NAMES = [
  'Madison Square Garden',
  'The Forum',
  'Convention Center',
  'City Hall Plaza',
  'Riverside Park',
  'Community Center',
  'Grand Theater',
  'Amphitheater',
  'Sports Arena',
  'Exhibition Hall',
];

const ORGANIZERS = [
  'City Events Co.',
  'Live Nation',
  'Local Arts Council',
  'Community Foundation',
  'Sports Entertainment Inc.',
  'Cultural Society',
  'Tech Hub',
  'Wellness Group',
];

function generateVenue(id: string, city: string, random: () => number): Venue {
  return {
    id,
    name: VENUE_NAMES[Math.floor(random() * VENUE_NAMES.length)],
    address: `${Math.floor(random() * 999) + 1} Event Street`,
    city,
    country: 'USA',
    coordinates: {
      latitude: 37.7749 + (random() - 0.5) * 0.1,
      longitude: -122.4194 + (random() - 0.5) * 0.1,
    },
    capacity: Math.floor(random() * 10000) + 500,
  };
}

function generateEvent(
  id: string,
  city: string,
  random: () => number,
  options?: {
    category?: EventCategory;
    startDate?: string;
    endDate?: string;
    priceMin?: number;
    priceMax?: number;
    query?: string;
  }
): Event {
  const categories: EventCategory[] = [
    'music', 'sports', 'arts', 'comedy', 'theater', 'food',
    'networking', 'technology', 'outdoors', 'wellness', 'family', 'other',
  ];

  const category = options?.category || categories[Math.floor(random() * categories.length)];
  const eventNames = EVENT_NAMES[category];
  const name = eventNames[Math.floor(random() * eventNames.length)];

  // Generate date within range if specified
  let startDateTime: Date;
  if (options?.startDate) {
    const start = new Date(options.startDate);
    const end = options?.endDate ? new Date(options.endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    startDateTime = new Date(start.getTime() + random() * (end.getTime() - start.getTime()));
  } else {
    startDateTime = new Date(Date.now() + random() * 90 * 24 * 60 * 60 * 1000);
  }

  // Generate price within range if specified
  let priceMin = Math.floor(random() * 50) + 10;
  let priceMax = priceMin + Math.floor(random() * 100) + 20;

  if (options?.priceMin !== undefined) {
    priceMin = Math.max(priceMin, options.priceMin);
  }
  if (options?.priceMax !== undefined) {
    priceMax = Math.min(priceMax, options.priceMax);
    priceMin = Math.min(priceMin, priceMax - 5);
  }

  const description = options?.query
    ? `${name} - featuring ${options.query}. Join us for an amazing experience.`
    : `${name} - Don't miss this amazing ${category} event in ${city}!`;

  const ticketOptions: ('available' | 'limited' | 'sold_out')[] = ['available', 'limited', 'sold_out'];

  return {
    id,
    name,
    description,
    category,
    subcategory: undefined,
    venue: generateVenue(`venue_${id}`, city, random),
    startDateTime: startDateTime.toISOString(),
    endDateTime: new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    imageUrl: `https://images.example.com/events/${id}.jpg`,
    ticketUrl: `https://tickets.example.com/${id}`,
    priceRange: {
      min: priceMin,
      max: priceMax,
      currency: 'USD',
    },
    ticketAvailability: ticketOptions[Math.floor(random() * ticketOptions.length)],
    organizer: ORGANIZERS[Math.floor(random() * ORGANIZERS.length)],
    ageRestriction: random() > 0.7 ? '21+' : undefined,
    tags: [category, city.toLowerCase(), random() > 0.5 ? 'popular' : 'new'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TicketmasterMock
// ─────────────────────────────────────────────────────────────────────────────

export class TicketmasterMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const events: Event[] = [];

    for (let i = 0; i < limit; i++) {
      const event = generateEvent(
        `event_tm_${i + 1}`,
        params.location,
        this.random,
        {
          category: params.category,
          startDate: params.startDate,
          endDate: params.endDate,
          priceMin: params.priceMin,
          priceMax: params.priceMax,
          query: params.query,
        }
      );
      events.push(event);
    }

    // Apply sorting
    if (params.sortBy === 'date') {
      events.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
    } else if (params.sortBy === 'price') {
      events.sort((a, b) => a.priceRange.min - b.priceRange.min);
    }

    return {
      events,
      totalCount: limit + Math.floor(this.random() * 100),
      searchId: `search_${Date.now()}`,
    };
  }

  async checkAvailability(params: TicketAvailabilityParams): Promise<TicketAvailabilityResult> {
    await this.simulateLatency();

    const sections: TicketSection[] = [
      { sectionId: 'section_1', name: 'General Admission', price: 50, available: Math.floor(this.random() * 100) },
      { sectionId: 'section_2', name: 'VIP', price: 150, available: Math.floor(this.random() * 20) },
      { sectionId: 'section_3', name: 'Premium', price: 250, available: Math.floor(this.random() * 10) },
    ];

    const available = sections.some((s) => s.available >= params.quantity);

    return {
      eventId: params.eventId,
      available,
      sections,
    };
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EventbriteMock
// ─────────────────────────────────────────────────────────────────────────────

export class EventbriteMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const events: Event[] = [];

    for (let i = 0; i < limit; i++) {
      const event = generateEvent(
        `event_eb_${i + 1}`,
        params.location,
        this.random,
        {
          category: params.category,
          startDate: params.startDate,
          endDate: params.endDate,
          query: params.query,
        }
      );
      events.push(event);
    }

    return {
      events,
      totalCount: limit + Math.floor(this.random() * 50),
      searchId: `search_${Date.now()}`,
    };
  }

  async getEventDetails(eventId: string): Promise<Event> {
    await this.simulateLatency();

    return generateEvent(eventId, 'San Francisco', this.random);
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MeetupMock
// ─────────────────────────────────────────────────────────────────────────────

export class MeetupMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const events: Event[] = [];

    for (let i = 0; i < limit; i++) {
      const event = generateEvent(
        `event_meetup_${i + 1}`,
        params.location,
        this.random,
        { category: params.category }
      );
      // Meetups are typically free or low cost
      event.priceRange = { min: 0, max: 0, currency: 'USD' };
      events.push(event);
    }

    return {
      events,
      totalCount: limit + Math.floor(this.random() * 30),
      searchId: `search_${Date.now()}`,
    };
  }

  async getGroupEvents(groupId: string): Promise<{ groupId: string; events: Event[] }> {
    await this.simulateLatency();

    const events: Event[] = [];
    for (let i = 0; i < 5; i++) {
      const event = generateEvent(`event_group_${groupId}_${i}`, 'San Francisco', this.random);
      event.priceRange = { min: 0, max: 0, currency: 'USD' };
      events.push(event);
    }

    return { groupId, events };
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

export { generateEvent, generateVenue };
