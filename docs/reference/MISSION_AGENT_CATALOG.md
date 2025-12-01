# OwnYou Mission Agent Catalog

**Status:** MVP Specification
**Date:** November 2025
**Related:** [Architecture v11](../architecture/OwnYou_architecture_v11.md)

This document provides detailed specifications for all 6 MVP Mission Agents, including their architecture, APIs, store interactions, triggers, and card structures.

---

## Table of Contents

1. [Shopping Agent](#1-shopping-agent)
2. [Travel Agent](#2-travel-agent)
3. [Restaurant Agent](#3-restaurant-agent)
4. [Events Agent](#4-events-agent)
5. [Content Agent](#5-content-agent)
6. [Diagnostic Agent](#6-diagnostic-agent)
7. [Common Patterns](#7-common-patterns)
8. [Cost Estimates](#8-cost-estimates)

---

## 1. Shopping Agent

### Overview

| Attribute | Value |
|-----------|-------|
| **Category** | Savings |
| **Complexity Level** | L1-2 (Simple to Coordinated) |
| **Primary Use Case** | Find best prices, track price drops, discover deals |
| **LLM Requirements** | Local (L1) / Cloud (L2) |

### Architecture

**Level 1 (Simple):** Price tracking and alerts
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Check Item  │────▶│ Compare     │────▶│ Create Card │
│ Prices      │     │ History     │     │ (if drop)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Level 2 (Coordinated):** Multi-source comparison
```
┌─────────────┐
│ Parse User  │
│ Intent      │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Search      │ │ Search      │ │ Search      │
│ Amazon      │ │ eBay        │ │ Google      │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
               ┌─────────────┐
               │ Aggregate & │
               │ Rank        │
               └──────┬──────┘
                      ▼
               ┌─────────────┐
               │ Create Card │
               └─────────────┘
```

### External APIs

| API | Purpose | Cost | Rate Limit |
|-----|---------|------|------------|
| **SerpAPI** | Google Shopping results | $50/5000 searches | 100/min |
| **Rainforest API** (Traject Data) | Amazon product data | $49/10000 req | 20/sec |
| **eBay API** | eBay listings | Free (partner) | 5000/day |

### Store Namespaces

**Read:**
```python
# User's shopping wishlist
store.get(("ownyou.shopping_list", user_id))

# Purchase history for preference inference
store.get(("ownyou.shopping_history", user_id))

# IAB classifications for category relevance
store.get(("ownyou.iab_classifications", user_id))

# Financial profile for budget awareness
store.get(("ownyou.financial_profile", user_id))
```

**Write:**
```python
# Updated shopping list with tracking
store.put(("ownyou.shopping_list", user_id), item_data)

# Price history for trend analysis
store.put(("ownyou.shopping_history", user_id, item_id), price_data)

# Mission learnings
store.put(("ownyou.mission_learnings", "shopping"), learning_data)
```

### Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **Memory Change** | New item added to shopping_list | High |
| **Schedule** | Daily price check for tracked items | Medium |
| **User-Initiated** | "Find best price for X" | High |
| **External** | Email receipt indicating purchase intent | Medium |

### Card Data Structure

```typescript
interface ShoppingCardData {
  // Item identification
  item_name: string;
  item_category: string;  // IAB category
  item_image_url?: string;

  // Price information
  current_price: number;
  original_price?: number;
  price_drop_percent?: number;
  currency: string;

  // Comparison data
  offers: ShoppingOffer[];
  best_offer: ShoppingOffer;

  // Tracking
  price_history: PricePoint[];
  tracking_since?: string;  // ISO date

  // Actions
  buy_url: string;
  add_to_cart_url?: string;
}

interface ShoppingOffer {
  retailer: string;
  retailer_logo?: string;
  price: number;
  shipping_cost?: number;
  total_price: number;
  rating?: number;
  in_stock: boolean;
  url: string;
}

interface PricePoint {
  date: string;  // ISO date
  price: number;
  retailer: string;
}
```

### Example Mission Card

```json
{
  "mission_id": "shop_001",
  "user_id": "user_123",
  "card_type": "shopping",
  "category": "savings",
  "complexity_level": 2,
  "state": "active",
  "card_data": {
    "item_name": "Sony WH-1000XM5 Headphones",
    "item_category": "Technology & Computing > Consumer Electronics",
    "current_price": 328.00,
    "original_price": 399.99,
    "price_drop_percent": 18,
    "currency": "USD",
    "offers": [
      {
        "retailer": "Amazon",
        "price": 328.00,
        "shipping_cost": 0,
        "total_price": 328.00,
        "rating": 4.7,
        "in_stock": true,
        "url": "https://amazon.com/..."
      },
      {
        "retailer": "Best Buy",
        "price": 349.99,
        "shipping_cost": 0,
        "total_price": 349.99,
        "rating": 4.6,
        "in_stock": true,
        "url": "https://bestbuy.com/..."
      }
    ],
    "best_offer": { /* Amazon offer */ },
    "buy_url": "https://amazon.com/..."
  },
  "created_at": "2025-11-25T10:30:00Z"
}
```

---

## 2. Travel Agent

### Overview

| Attribute | Value |
|-----------|-------|
| **Category** | Ikigai |
| **Complexity Level** | L3 (Complex) |
| **Primary Use Case** | Plan complete trips with flights, hotels, activities |
| **LLM Requirements** | Cloud (Claude Sonnet) |

### Architecture

**Level 3 (Complex):** Supervisor/Worker pattern

```
                    ┌─────────────────┐
                    │   Supervisor    │
                    │    Agent        │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   Flight    │    │   Hotel     │    │  Activity   │
   │   Worker    │    │   Worker    │    │   Worker    │
   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │    Itinerary    │
                    │    Builder      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Review &      │
                    │   Refine        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Create Card    │
                    └─────────────────┘
```

### External APIs

| API | Purpose | Cost | Rate Limit |
|-----|---------|------|------------|
| **Tripadvisor API** | Hotels, activities, reviews | $0.015/call | 100/min |
| **Google Hotels (via SearchAPI)** | Hotel pricing | $50/5000 | 100/min |
| **Skyscanner API** | Flight search | Free (affiliate) | 100/min |
| **Amadeus API** | Flight booking data | $0.01/call | 100/min |

### Store Namespaces

**Read:**
```python
# Travel preferences (destinations, budget, style)
store.get(("ownyou.travel_preferences", user_id))

# Calendar for date availability
store.get(("ownyou.calendar_events", user_id))

# IAB travel-related interests
store.get(("ownyou.iab_classifications", user_id))
# Filter: IAB20 (Travel) categories

# Financial profile for budget
store.get(("ownyou.financial_profile", user_id))

# Past travel history
store.get(("ownyou.completed_missions", user_id))
# Filter: travel missions
```

**Write:**
```python
# Trip plan (multi-step)
store.put(("ownyou.mission_state", user_id, mission_id), trip_state)

# Travel preferences learned
store.put(("ownyou.travel_preferences", user_id), updated_prefs)

# Mission learnings
store.put(("ownyou.mission_learnings", "travel"), learning_data)
```

### Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **Memory Change** | Calendar gap detected (7+ days free) | Medium |
| **User-Initiated** | "Plan a trip to X" | High |
| **Schedule** | Monthly travel suggestions | Low |
| **External** | Flight deal alert email | Medium |

### Card Data Structure

```typescript
interface TravelCardData {
  // Trip overview
  destination: string;
  destination_image_url: string;
  trip_dates: {
    start: string;  // ISO date
    end: string;
    duration_days: number;
  };

  // Budget
  estimated_total: number;
  budget_breakdown: {
    flights: number;
    accommodation: number;
    activities: number;
    meals_estimate: number;
  };
  currency: string;

  // Components
  flights: FlightOption[];
  hotels: HotelOption[];
  activities: ActivityOption[];

  // Itinerary
  itinerary: ItineraryDay[];

  // Actions
  book_all_url?: string;  // If package available
  refine_options: string[];  // Suggested refinements
}

interface FlightOption {
  airline: string;
  airline_logo: string;
  departure: FlightLeg;
  return: FlightLeg;
  price: number;
  booking_url: string;
}

interface FlightLeg {
  from_airport: string;
  to_airport: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  stops: number;
}

interface HotelOption {
  name: string;
  image_url: string;
  rating: number;
  review_count: number;
  price_per_night: number;
  total_price: number;
  amenities: string[];
  location_description: string;
  booking_url: string;
}

interface ActivityOption {
  name: string;
  image_url: string;
  category: string;  // "Museum", "Tour", "Adventure", etc.
  duration_hours: number;
  price: number;
  rating: number;
  booking_url?: string;
}

interface ItineraryDay {
  day_number: number;
  date: string;
  activities: {
    time: string;
    activity: string;
    location?: string;
    notes?: string;
  }[];
}
```

### Example Mission Card

```json
{
  "mission_id": "travel_001",
  "user_id": "user_123",
  "card_type": "travel",
  "category": "ikigai",
  "complexity_level": 3,
  "state": "active",
  "card_data": {
    "destination": "Barcelona, Spain",
    "destination_image_url": "https://...",
    "trip_dates": {
      "start": "2025-03-15",
      "end": "2025-03-22",
      "duration_days": 7
    },
    "estimated_total": 2450,
    "budget_breakdown": {
      "flights": 850,
      "accommodation": 980,
      "activities": 350,
      "meals_estimate": 270
    },
    "currency": "USD",
    "flights": [/* Flight options */],
    "hotels": [/* Hotel options */],
    "activities": [/* Activity options */],
    "itinerary": [
      {
        "day_number": 1,
        "date": "2025-03-15",
        "activities": [
          {"time": "10:00", "activity": "Arrival at BCN Airport"},
          {"time": "14:00", "activity": "Check into Hotel Arts Barcelona"},
          {"time": "16:00", "activity": "Walk La Rambla"},
          {"time": "20:00", "activity": "Dinner at La Boqueria area"}
        ]
      }
    ],
    "refine_options": ["More budget-friendly hotels", "Add beach activities", "Extend to 10 days"]
  }
}
```

---

## 3. Restaurant Agent

### Overview

| Attribute | Value |
|-----------|-------|
| **Category** | Ikigai |
| **Complexity Level** | L2 (Coordinated) |
| **Primary Use Case** | Find and book restaurants matching preferences |
| **LLM Requirements** | Cloud (Claude Sonnet) |

### Architecture

**Level 2 (Coordinated):** Multi-source search and ranking

```
┌─────────────┐
│ Parse User  │
│ Context     │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Search      │ │ Search      │ │ Search      │
│ Tripadvisor │ │ Yelp        │ │ OpenTable   │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
               ┌─────────────┐
               │ Aggregate & │
               │ Rank by     │
               │ Preferences │
               └──────┬──────┘
                      ▼
               ┌─────────────┐
               │ Check       │
               │ Availability│
               └──────┬──────┘
                      ▼
               ┌─────────────┐
               │ Create Card │
               └─────────────┘
```

### External APIs

| API | Purpose | Cost | Rate Limit |
|-----|---------|------|------------|
| **Tripadvisor API** | Restaurant search, reviews | $0.015/call | 100/min |
| **Yelp Fusion API** | Restaurant data | Free (up to 5000/day) | 500/day |
| **OpenTable API** | Reservations | Partner agreement | Varies |
| **Google Places API** | Backup search | $0.017/call | 100/sec |

### Store Namespaces

**Read:**
```python
# Dining preferences (cuisines, price range, dietary)
store.get(("ownyou.dining_preferences", user_id))

# Location (current or planned)
store.get(("ownyou.location_history", user_id))

# Calendar for timing context
store.get(("ownyou.calendar_events", user_id))

# Past restaurant visits
store.get(("ownyou.completed_missions", user_id))
# Filter: restaurant missions

# IAB food/dining interests
store.get(("ownyou.iab_classifications", user_id))
```

**Write:**
```python
# Dining preferences learned
store.put(("ownyou.dining_preferences", user_id), updated_prefs)

# Restaurant visit history
store.put(("ownyou.completed_missions", user_id, mission_id), visit_data)

# Mission learnings
store.put(("ownyou.mission_learnings", "restaurant"), learning_data)
```

### Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **User-Initiated** | "Find a restaurant for X" | High |
| **Schedule** | Friday evening suggestions | Medium |
| **Calendar** | Dinner meeting scheduled | High |
| **Memory Change** | New dining preference detected | Low |

### Card Data Structure

```typescript
interface RestaurantCardData {
  // Context
  occasion?: string;  // "Date night", "Business dinner", etc.
  location: {
    area: string;
    coordinates?: { lat: number; lng: number };
  };
  date_time?: string;  // ISO datetime
  party_size?: number;

  // Results
  restaurants: RestaurantOption[];
  top_pick: RestaurantOption;

  // Filters applied
  filters: {
    cuisine_types?: string[];
    price_range?: string;  // "$", "$$", "$$$", "$$$$"
    dietary?: string[];  // "vegetarian", "vegan", "gluten-free"
    features?: string[];  // "outdoor seating", "private room"
  };
}

interface RestaurantOption {
  name: string;
  image_url: string;
  cuisine_type: string;
  price_range: string;
  rating: number;
  review_count: number;

  // Location
  address: string;
  distance_miles?: number;
  neighborhood: string;

  // Details
  highlights: string[];  // "Great for dates", "Outdoor seating"
  popular_dishes?: string[];

  // Availability
  available_times?: string[];  // If checked
  reservation_url?: string;

  // Reviews
  sample_reviews?: {
    text: string;
    rating: number;
    author: string;
  }[];

  // Why recommended
  match_reasons: string[];  // "Matches your love of Italian", etc.
}
```

---

## 4. Events Agent

### Overview

| Attribute | Value |
|-----------|-------|
| **Category** | Ikigai |
| **Complexity Level** | L2 (Coordinated) |
| **Primary Use Case** | Discover concerts, comedy, theater, sports events |
| **LLM Requirements** | Cloud (Claude Sonnet) |

### Architecture

**Level 2 (Coordinated):** Event discovery and availability

```
┌─────────────┐
│ Analyze     │
│ Interests   │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Search      │ │ Search      │ │ Search      │
│ DataThistle │ │ Ticketmaster│ │ Eventbrite  │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
               ┌─────────────┐
               │ Rank by     │
               │ Relevance   │
               └──────┬──────┘
                      ▼
               ┌─────────────┐
               │ Check       │
               │ Calendar    │
               └──────┬──────┘
                      ▼
               ┌─────────────┐
               │ Create Card │
               └─────────────┘
```

### External APIs

| API | Purpose | Cost | Rate Limit |
|-----|---------|------|------------|
| **DataThistle Events API** | Event discovery | $49/month | 10000/month |
| **Ticketmaster API** | Concerts, sports | Free | 5000/day |
| **Eventbrite API** | Local events | Free | 1000/hour |
| **SeatGeek API** | Ticket pricing | Free | 1000/hour |

### Store Namespaces

**Read:**
```python
# Event preferences
store.get(("ownyou.event_preferences", user_id))

# Calendar for availability
store.get(("ownyou.calendar_events", user_id))

# Location
store.get(("ownyou.location_history", user_id))

# IAB entertainment interests
store.get(("ownyou.iab_classifications", user_id))
# Filter: IAB17 (Sports), IAB1 (Arts & Entertainment)
```

**Write:**
```python
# Event preferences learned
store.put(("ownyou.event_preferences", user_id), updated_prefs)

# Attended events
store.put(("ownyou.completed_missions", user_id, mission_id), event_data)

# Mission learnings
store.put(("ownyou.mission_learnings", "events"), learning_data)
```

### Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **Schedule** | Weekly event suggestions | Medium |
| **User-Initiated** | "Find comedy shows" | High |
| **Memory Change** | New artist/team interest detected | Medium |
| **Calendar** | Weekend free | Low |

### Card Data Structure

```typescript
interface EventCardData {
  // Discovery context
  event_type: "concert" | "comedy" | "theater" | "sports" | "festival" | "other";
  location: {
    city: string;
    radius_miles?: number;
  };
  date_range?: {
    start: string;
    end: string;
  };

  // Results
  events: EventOption[];
  featured_event?: EventOption;

  // Personalization
  why_recommended: string;  // "Based on your interest in stand-up comedy"
}

interface EventOption {
  name: string;
  event_type: string;
  image_url: string;

  // When & where
  date_time: string;
  venue: {
    name: string;
    address: string;
    city: string;
  };

  // Performers/Teams
  performers?: string[];

  // Tickets
  price_range: {
    min: number;
    max: number;
  };
  currency: string;
  availability: "available" | "limited" | "sold_out";
  ticket_url: string;

  // Details
  description?: string;
  duration_minutes?: number;
  age_restriction?: string;

  // Match
  match_score: number;  // 0-100
  match_reasons: string[];
}
```

---

## 5. Content Agent

### Overview

| Attribute | Value |
|-----------|-------|
| **Category** | Ikigai |
| **Complexity Level** | L1 (Simple) |
| **Primary Use Case** | Recommend articles, videos, podcasts, books |
| **LLM Requirements** | Local (Llama) |

### Architecture

**Level 1 (Simple):** Content discovery

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Analyze     │────▶│ Search      │────▶│ Rank &      │
│ Interests   │     │ Content     │     │ Filter      │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │ Create Card │
                                        └─────────────┘
```

### External APIs

| API | Purpose | Cost | Rate Limit |
|-----|---------|------|------------|
| **NewsAPI** | News articles | $449/month (business) | Unlimited |
| **YouTube Data API** | Video search | Free | 10000 units/day |
| **Spotify API** | Podcasts | Free | Varies |
| **Google Books API** | Book search | Free | 1000/day |

### Store Namespaces

**Read:**
```python
# Content preferences
store.get(("ownyou.content_preferences", user_id))

# Browsing history for context
store.get(("ownyou.browsing_history", user_id))

# IAB interests
store.get(("ownyou.iab_classifications", user_id))

# Past content consumed
store.get(("ownyou.completed_missions", user_id))
# Filter: content missions
```

**Write:**
```python
# Content preferences learned
store.put(("ownyou.content_preferences", user_id), updated_prefs)

# Content consumption history
store.put(("ownyou.completed_missions", user_id, mission_id), content_data)

# Mission learnings
store.put(("ownyou.mission_learnings", "content"), learning_data)
```

### Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **Schedule** | Daily content digest | Medium |
| **Memory Change** | New interest detected | Medium |
| **User-Initiated** | "Find articles about X" | High |
| **Browsing** | Topic binge detected | Low |

### Card Data Structure

```typescript
interface ContentCardData {
  // Content type
  content_type: "article" | "video" | "podcast" | "book" | "mixed";

  // Theme
  topic: string;
  why_recommended: string;

  // Items
  items: ContentItem[];

  // Reading/viewing time estimate
  total_time_minutes?: number;
}

interface ContentItem {
  type: "article" | "video" | "podcast" | "book";
  title: string;
  source: string;  // Publication/channel name
  source_logo?: string;
  thumbnail_url?: string;

  // Metadata
  author?: string;
  published_date?: string;
  duration_minutes?: number;  // For video/podcast
  read_time_minutes?: number;  // For articles

  // Quality signals
  popularity?: number;  // Views, reads, etc.
  rating?: number;

  // Access
  url: string;
  is_free: boolean;

  // Match
  relevance_score: number;
  match_reasons: string[];
}
```

---

## 6. Diagnostic Agent

### Overview

| Attribute | Value |
|-----------|-------|
| **Category** | Health |
| **Complexity Level** | L2 (Coordinated) |
| **Primary Use Case** | Health symptom analysis and recommendations |
| **LLM Requirements** | Cloud (Claude Sonnet for medical accuracy) |

### Architecture

**Level 2 (Coordinated):** Symptom analysis with multiple sources

```
┌─────────────┐
│ Collect     │
│ Symptoms    │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Medical     │ │ Cross-ref   │ │ Find Local  │
│ Knowledge   │ │ User Health │ │ Providers   │
│ Base        │ │ History     │ │             │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
               ┌─────────────┐
               │ Generate    │
               │ Analysis    │
               └──────┬──────┘
                      ▼
               ┌─────────────┐
               │ Create Card │
               │ (with       │
               │ disclaimer) │
               └─────────────┘
```

### External APIs

| API | Purpose | Cost | Rate Limit |
|-----|---------|------|------------|
| **NHS Conditions API** | Medical information | Free | Varies |
| **Infermedica API** | Symptom checker | $0.10/call | 1000/month free |
| **Google Places API** | Find doctors | $0.017/call | 100/sec |
| **WebMD (scraping)** | Backup info | Free | Careful |

### Store Namespaces

**Read:**
```python
# Health profile (allergies, conditions, medications)
store.get(("ownyou.health_profile", user_id))

# Past health queries
store.get(("ownyou.completed_missions", user_id))
# Filter: diagnostic missions

# Demographics (age, sex for relevance)
store.get(("ownyou.demographics", user_id))
```

**Write:**
```python
# Health profile updates (with user consent)
store.put(("ownyou.health_profile", user_id), updated_profile)

# Diagnostic history
store.put(("ownyou.completed_missions", user_id, mission_id), diagnostic_data)

# Mission learnings
store.put(("ownyou.mission_learnings", "diagnostic"), learning_data)
```

### Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **User-Initiated** | "I have symptoms X, Y, Z" | High |
| **Schedule** | Annual checkup reminder | Low |
| **Health Data** | Unusual metric detected | Medium |

### Card Data Structure

```typescript
interface DiagnosticCardData {
  // Input
  symptoms: string[];
  symptom_duration?: string;
  severity?: "mild" | "moderate" | "severe";

  // Analysis
  possible_conditions: ConditionAnalysis[];
  urgency_level: "self-care" | "consult" | "urgent" | "emergency";

  // Recommendations
  self_care_tips?: string[];
  when_to_seek_care: string;

  // Local resources
  nearby_providers?: HealthProvider[];

  // CRITICAL: Disclaimer
  disclaimer: string;  // Always present
}

interface ConditionAnalysis {
  condition_name: string;
  probability: "likely" | "possible" | "unlikely";
  description: string;
  common_symptoms: string[];
  matching_symptoms: string[];
  learn_more_url: string;
}

interface HealthProvider {
  type: "doctor" | "urgent_care" | "hospital" | "pharmacy";
  name: string;
  address: string;
  phone?: string;
  distance_miles: number;
  rating?: number;
  accepts_insurance?: boolean;
  hours?: string;
}
```

### Important: Medical Disclaimer

Every Diagnostic Agent card MUST include:

```
"disclaimer": "This information is for educational purposes only and is not a substitute
for professional medical advice, diagnosis, or treatment. Always seek the advice of your
physician or other qualified health provider with any questions you may have regarding
a medical condition. If you think you may have a medical emergency, call your doctor
or emergency services immediately."
```

---

## 7. Common Patterns

### 7.1 Mission Card Base Structure

All mission cards share this base structure:

```typescript
interface MissionCard {
  // Identification
  mission_id: string;
  user_id: string;
  thread_id?: string;  // For multi-round missions

  // Type & Category
  card_type: "shopping" | "travel" | "restaurant" | "events" | "content" | "diagnostic";
  agent_type: string;
  category: "savings" | "ikigai" | "health";
  complexity_level: 1 | 2 | 3;

  // State
  state: "pending" | "active" | "snoozed" | "completed" | "dismissed";

  // Trigger info
  trigger_type: "memory" | "schedule" | "user" | "external";
  trigger_details?: Record<string, any>;

  // Memory context (what Store data was used)
  memory_context: {
    namespaces_read: string[];
    key_insights: string[];
  };

  // Type-specific data
  card_data: ShoppingCardData | TravelCardData | RestaurantCardData |
             EventCardData | ContentCardData | DiagnosticCardData;

  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at?: string;

  // User interaction
  user_feedback?: {
    rating?: number;
    comment?: string;
    actions_taken?: string[];
  };
}
```

### 7.2 LangGraph Workflow Pattern

All agents follow this base pattern:

```python
from langgraph.graph import StateGraph, END
from langgraph.store.base import BaseStore

class BaseMissionAgent:
    def __init__(self, store: BaseStore, config: dict):
        self.store = store
        self.config = config

    def build_graph(self) -> StateGraph:
        """Override in subclass"""
        raise NotImplementedError

    async def run(self, user_id: str, context: dict) -> MissionCard:
        # 1. Read from Store
        memory_context = await self._read_memory(user_id)

        # 2. Build and execute graph
        graph = self.build_graph()
        result = await graph.ainvoke({
            "user_id": user_id,
            "context": context,
            "memory": memory_context
        })

        # 3. Create mission card
        card = self._create_card(result)

        # 4. Write learnings to Store
        await self._write_learnings(result)

        return card

    async def _read_memory(self, user_id: str) -> dict:
        """Read relevant Store namespaces"""
        # Implemented per agent
        pass

    async def _write_learnings(self, result: dict):
        """Write mission learnings to Store"""
        # Implemented per agent
        pass
```

### 7.3 Error Handling

```python
class MissionError(Exception):
    """Base exception for mission failures"""
    pass

class APIRateLimitError(MissionError):
    """External API rate limit exceeded"""
    pass

class InsufficientDataError(MissionError):
    """Not enough user data to generate meaningful mission"""
    pass

class BudgetExceededError(MissionError):
    """Daily LLM budget exceeded"""
    pass

# Graceful degradation
async def run_with_fallback(agent, context):
    try:
        return await agent.run(context)
    except APIRateLimitError:
        # Try backup API
        return await agent.run_with_backup_api(context)
    except InsufficientDataError:
        # Return "need more data" card
        return agent.create_data_request_card(context)
    except BudgetExceededError:
        # Queue for tomorrow
        return agent.queue_for_later(context)
```

---

## 8. Cost Estimates

### 8.1 Per-Execution Costs

| Agent | Level | LLM Tokens | LLM Cost | API Calls | API Cost | Total |
|-------|-------|------------|----------|-----------|----------|-------|
| Shopping (L1) | 1 | ~1K | $0.00 (local) | 1-3 | $0.02 | **$0.02** |
| Shopping (L2) | 2 | ~5K | $0.15 | 3-5 | $0.05 | **$0.20** |
| Travel | 3 | ~20K | $0.60 | 10-15 | $0.30 | **$0.90** |
| Restaurant | 2 | ~5K | $0.15 | 3-5 | $0.05 | **$0.20** |
| Events | 2 | ~5K | $0.15 | 3-5 | $0.02 | **$0.17** |
| Content | 1 | ~2K | $0.00 (local) | 2-4 | $0.00 | **$0.00** |
| Diagnostic | 2 | ~8K | $0.24 | 2-3 | $0.15 | **$0.39** |

### 8.2 Daily Budget Scenarios

**Conservative User (5 missions/day):**
- 2 Shopping L1: $0.04
- 1 Restaurant: $0.20
- 1 Events: $0.17
- 1 Content: $0.00
- **Total: $0.41/day (~$12/month)**

**Active User (15 missions/day):**
- 3 Shopping L2: $0.60
- 2 Restaurant: $0.40
- 2 Events: $0.34
- 3 Content: $0.00
- 2 Travel: $1.80
- 3 Diagnostic: $1.17
- **Total: $4.31/day (~$130/month)**

### 8.3 Budget Enforcement

```python
class CostTracker:
    DEFAULT_DAILY_BUDGET = 10.0  # USD

    COST_ESTIMATES = {
        "shopping_l1": 0.02,
        "shopping_l2": 0.20,
        "travel": 0.90,
        "restaurant": 0.20,
        "events": 0.17,
        "content": 0.00,
        "diagnostic": 0.39,
    }

    def can_run(self, mission_type: str) -> bool:
        estimated = self.COST_ESTIMATES.get(mission_type, 0.50)
        return (self.spent_today + estimated) <= self.daily_budget
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 2025 | Initial MVP specification |

---

**Related Documents:**
- [Architecture v11](../architecture/OwnYou_architecture_v11.md)
- [Store Schema Design](STORE_SCHEMA.md) (to be created)
- [API Contracts](../api/openapi.yaml)
