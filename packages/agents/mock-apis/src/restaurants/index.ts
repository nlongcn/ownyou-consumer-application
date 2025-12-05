/**
 * Restaurant Mock APIs - Sprint 7
 *
 * Mock implementations for Yelp, OpenTable, and Google Places.
 * Used by Restaurant Agent until real API integration in Sprint 13.
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import type {
  Restaurant,
  RestaurantSearchParams,
  RestaurantSearchResult,
  MenuResult,
  MenuSection,
  ReservationParams,
  ReservationResult,
  DietaryOption,
  MockApiConfig,
  BusinessHours,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Seeded Random Generator for Deterministic Mock Data
// ─────────────────────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data Generators
// ─────────────────────────────────────────────────────────────────────────────

const CUISINES = [
  'Italian',
  'Japanese',
  'Mexican',
  'Chinese',
  'Indian',
  'Thai',
  'French',
  'Mediterranean',
  'American',
  'Korean',
  'Vietnamese',
  'Greek',
  'Spanish',
  'Middle Eastern',
];

const RESTAURANT_NAMES = [
  'The Golden Fork',
  'Sakura Garden',
  'Casa del Sol',
  'Dragon Palace',
  'Spice Route',
  'Bangkok Kitchen',
  'Le Petit Bistro',
  'Olive Grove',
  'Blue Moon Diner',
  'Seoul Kitchen',
  'Pho Paradise',
  'Athena\'s Table',
  'Tapas Bar',
  'Oasis Grill',
  'Trattoria Bella',
  'Sushi Master',
  'El Rancho',
  'Jade Emperor',
  'Curry House',
  'Lemongrass',
];

const AMBIANCE_OPTIONS = [
  'romantic',
  'casual',
  'upscale',
  'family-friendly',
  'trendy',
  'cozy',
  'lively',
  'quiet',
];

const DIETARY_OPTIONS: DietaryOption[] = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'halal',
  'kosher',
  'dairy-free',
  'nut-free',
  'pescatarian',
];

function generateDefaultHours(): BusinessHours {
  return {
    monday: { open: '11:00', close: '22:00' },
    tuesday: { open: '11:00', close: '22:00' },
    wednesday: { open: '11:00', close: '22:00' },
    thursday: { open: '11:00', close: '23:00' },
    friday: { open: '11:00', close: '23:00' },
    saturday: { open: '10:00', close: '23:00' },
    sunday: { open: '10:00', close: '21:00' },
  };
}

function generateRestaurant(
  id: string,
  city: string,
  random: () => number,
  options?: {
    cuisine?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    dietaryRequirements?: DietaryOption[];
  }
): Restaurant {
  const priceRanges: ('$' | '$$' | '$$$' | '$$$$')[] = ['$', '$$', '$$$', '$$$$'];
  const noiseOptions: ('quiet' | 'moderate' | 'loud')[] = ['quiet', 'moderate', 'loud'];

  const cuisine = options?.cuisine || CUISINES[Math.floor(random() * CUISINES.length)];
  const priceRange = options?.priceRange || priceRanges[Math.floor(random() * priceRanges.length)];

  // Generate dietary options - include required ones if specified
  const baseDietary = DIETARY_OPTIONS.filter(() => random() > 0.6);
  const dietaryOptions = options?.dietaryRequirements
    ? [...new Set([...baseDietary, ...options.dietaryRequirements])]
    : baseDietary;

  return {
    id,
    name: RESTAURANT_NAMES[Math.floor(random() * RESTAURANT_NAMES.length)] + ` ${id.slice(-2)}`,
    cuisine,
    priceRange,
    rating: Math.round((3 + random() * 2) * 10) / 10, // 3.0 - 5.0
    reviewCount: Math.floor(random() * 500) + 50,
    address: `${Math.floor(random() * 999) + 1} Main Street`,
    city,
    phone: `555-${String(Math.floor(random() * 10000)).padStart(4, '0')}`,
    website: `https://${id.replace('_', '')}.example.com`,
    menuUrl: `https://${id.replace('_', '')}.example.com/menu`,
    imageUrl: `https://images.example.com/${id}.jpg`,
    coordinates: {
      latitude: 37.7749 + (random() - 0.5) * 0.1,
      longitude: -122.4194 + (random() - 0.5) * 0.1,
    },
    hours: generateDefaultHours(),
    dietaryOptions: dietaryOptions as DietaryOption[],
    ambiance: AMBIANCE_OPTIONS.filter(() => random() > 0.7),
    noiseLevel: noiseOptions[Math.floor(random() * noiseOptions.length)],
    reservationAvailable: random() > 0.2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// YelpMock
// ─────────────────────────────────────────────────────────────────────────────

export class YelpMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchRestaurants(params: RestaurantSearchParams): Promise<RestaurantSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const restaurants: Restaurant[] = [];

    for (let i = 0; i < limit; i++) {
      const restaurant = generateRestaurant(
        `restaurant_yelp_${i + 1}`,
        params.location,
        this.random,
        {
          cuisine: params.cuisine,
          priceRange: params.priceRange,
          dietaryRequirements: params.dietaryRequirements,
        }
      );
      restaurants.push(restaurant);
    }

    // Apply sorting
    if (params.sortBy === 'rating') {
      restaurants.sort((a, b) => b.rating - a.rating);
    } else if (params.sortBy === 'price') {
      const priceOrder = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
      restaurants.sort((a, b) => priceOrder[a.priceRange] - priceOrder[b.priceRange]);
    }

    return {
      restaurants,
      totalCount: limit + Math.floor(this.random() * 50),
      searchId: `search_${Date.now()}`,
    };
  }

  async getMenu(restaurantId: string): Promise<MenuResult> {
    await this.simulateLatency();

    const sections: MenuSection[] = [
      {
        name: 'Appetizers',
        items: [
          { id: 'item_1', name: 'Spring Rolls', description: 'Crispy vegetable rolls', price: 8.99, category: 'appetizer', dietaryInfo: ['vegetarian'] },
          { id: 'item_2', name: 'Soup of the Day', description: 'Chef\'s special soup', price: 6.99, category: 'appetizer', dietaryInfo: [] },
        ],
      },
      {
        name: 'Main Courses',
        items: [
          { id: 'item_3', name: 'Grilled Salmon', description: 'Fresh Atlantic salmon', price: 24.99, category: 'main', dietaryInfo: ['gluten-free'], popular: true },
          { id: 'item_4', name: 'Pasta Primavera', description: 'Seasonal vegetables with pasta', price: 18.99, category: 'main', dietaryInfo: ['vegetarian'] },
          { id: 'item_5', name: 'Steak Frites', description: 'Ribeye with French fries', price: 32.99, category: 'main', dietaryInfo: [] },
        ],
      },
      {
        name: 'Desserts',
        items: [
          { id: 'item_6', name: 'Chocolate Cake', description: 'Rich chocolate layer cake', price: 9.99, category: 'dessert', dietaryInfo: ['vegetarian'] },
          { id: 'item_7', name: 'Fruit Sorbet', description: 'Seasonal fruit sorbet', price: 7.99, category: 'dessert', dietaryInfo: ['vegan', 'gluten-free'] },
        ],
      },
    ];

    return {
      restaurantId,
      sections,
      lastUpdated: new Date().toISOString(),
    };
  }

  async checkDietary(
    restaurantId: string,
    requirements: DietaryOption[]
  ): Promise<{ restaurantId: string; accommodations: Record<string, boolean> }> {
    await this.simulateLatency();

    const accommodations: Record<string, boolean> = {};
    for (const req of requirements) {
      // 70% chance each dietary option is available
      accommodations[req] = this.random() > 0.3;
    }

    return { restaurantId, accommodations };
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenTableMock
// ─────────────────────────────────────────────────────────────────────────────

export class OpenTableMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchRestaurants(params: RestaurantSearchParams): Promise<RestaurantSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const restaurants: Restaurant[] = [];

    for (let i = 0; i < limit; i++) {
      const restaurant = generateRestaurant(
        `restaurant_opentable_${i + 1}`,
        params.location,
        this.random,
        {
          cuisine: params.cuisine,
          priceRange: params.priceRange,
          dietaryRequirements: params.dietaryRequirements,
        }
      );
      // OpenTable only returns restaurants with reservations available
      restaurant.reservationAvailable = true;
      restaurants.push(restaurant);
    }

    return {
      restaurants,
      totalCount: limit + Math.floor(this.random() * 30),
      searchId: `search_${Date.now()}`,
    };
  }

  async makeReservation(params: ReservationParams): Promise<ReservationResult> {
    await this.simulateLatency();

    return {
      confirmationNumber: `OT${Date.now().toString(36).toUpperCase()}`,
      restaurantId: params.restaurantId,
      restaurantName: `Restaurant ${params.restaurantId}`,
      dateTime: params.dateTime,
      partySize: params.partySize,
      status: 'confirmed',
      cancellationPolicy: 'Free cancellation up to 2 hours before reservation',
    };
  }

  async checkAvailability(
    restaurantId: string,
    date: string,
    partySize: number
  ): Promise<{ restaurantId: string; date: string; partySize: number; slots: Array<{ time: string; available: boolean }> }> {
    await this.simulateLatency();

    const slots = [];
    for (let hour = 17; hour <= 21; hour++) {
      for (const minute of ['00', '30']) {
        slots.push({
          time: `${hour}:${minute}`,
          available: this.random() > 0.3,
        });
      }
    }

    return { restaurantId, date, partySize, slots };
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GooglePlacesMock
// ─────────────────────────────────────────────────────────────────────────────

export class GooglePlacesMock {
  private random: () => number;
  private config: MockApiConfig;

  constructor(config: MockApiConfig = {}) {
    this.config = config;
    this.random = seededRandom(config.seed || Date.now());
  }

  async searchRestaurants(params: RestaurantSearchParams): Promise<RestaurantSearchResult> {
    await this.simulateLatency();

    const limit = params.limit || 10;
    const restaurants: Restaurant[] = [];

    for (let i = 0; i < limit; i++) {
      const restaurant = generateRestaurant(
        `restaurant_google_${i + 1}`,
        params.location,
        this.random,
        {
          cuisine: params.cuisine,
          priceRange: params.priceRange,
          dietaryRequirements: params.dietaryRequirements,
        }
      );
      restaurants.push(restaurant);
    }

    return {
      restaurants,
      totalCount: limit + Math.floor(this.random() * 100),
      searchId: `search_${Date.now()}`,
    };
  }

  async getPlaceDetails(restaurantId: string): Promise<Restaurant> {
    await this.simulateLatency();

    return generateRestaurant(restaurantId, 'San Francisco', this.random);
  }

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency || 50;
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
}

export { generateRestaurant };
