# LangGraph Store Schema Documentation

**OwnYou Consumer Application - Complete Store Namespace Specification**

**Purpose:** This document defines ALL Store namespaces for the OwnYou system. Following the single-source-of-truth architectural principle, LangGraph Store is the ONLY persistent storage for all user data, classifications, preferences, and mission state.

**Version:** 1.0.0
**Date:** 2025-01-06
**Phase:** Phase 1 (Foundation & Contracts)

---

## Table of Contents

1. [Namespace Conventions](#namespace-conventions)
2. [IAB System Namespaces](#iab-system-namespaces)
3. [User Profile Namespaces](#user-profile-namespaces)
4. [Ikigai Namespaces](#ikigai-namespaces)
5. [Shopping & Financial Namespaces](#shopping--financial-namespaces)
6. [Travel & Dining Namespaces](#travel--dining-namespaces)
7. [Events & Content Namespaces](#events--content-namespaces)
8. [Health Namespaces](#health-namespaces)
9. [Mission State Namespaces](#mission-state-namespaces)
10. [Episodic Memory Namespaces](#episodic-memory-namespaces)
11. [Integration Guidelines](#integration-guidelines)

---

## Namespace Conventions

**Format:** `(partition_key1, memory_type, partition_key2, ...)`

**Rules:**
- Primary partition key is FIRST (usually `user_id`)
- Memory type is SECOND (e.g., `iab_classifications`)
- Additional keys for sub-partitioning (e.g., `taxonomy_id`, `mission_id`)
- Compatible with email_parser's 2-tuple pattern: `(user_id, collection_name)`
- Keep hierarchy shallow (2-3 levels max)
- Use snake_case for namespace names
- NO PERIODS in namespace labels (LangGraph Store restriction)

**Example:**
```python
("user_123", "iab_classifications")
("user_123", "ikigai_interests", "travel")
("user_123", "mission_feedback", "mission_789")
```

---

## IAB System Namespaces

### 1. IAB Classifications

**Namespace:** `({user_id}, iab_classifications)`

**Purpose:** Stores all IAB Taxonomy classifications for a user, derived from analysis of emails, calendar events, financial transactions, and other data sources.

**Data Structure:**
```json
{
  "taxonomy_id": 123,
  "taxonomy_name": "Travel/Adventure Travel",
  "tier": 2,
  "section": "Interests",
  "confidence": 0.87,
  "evidence": [
    {
      "source": "email",
      "content": "booking confirmation for Iceland hiking tour",
      "timestamp": "2024-01-15T10:30:00Z",
      "evidence_type": "purchase_confirmation"
    },
    {
      "source": "calendar",
      "content": "Mount Kilimanjaro expedition planning",
      "timestamp": "2024-02-20T14:00:00Z",
      "evidence_type": "calendar_event"
    }
  ],
  "evidence_count": 2,
  "first_detected": "2024-01-15T10:30:00Z",
  "last_updated": "2024-02-20T14:00:00Z",
  "data_sources": ["email", "calendar"]
}
```

**Updated By:**
- IAB Classification Workflow (email parser)
- Calendar connector → IAB classifier
- Financial connector → IAB classifier
- All data source connectors (Phase 2)

**Read By:**
- Mission Orchestrator (triggers missions based on classifications)
- Profile API endpoints
- Dashboard analytics
- SSO integration (Phase 6 - selective disclosure)

**Lifecycle:**
- Created: When first classification detected
- Updated: On new evidence from any data source
- Deleted: Never (retained for pattern analysis)

---

### 2. IAB Evidence

**Namespace:** `({user_id}, iab_evidence, {taxonomy_id})`

**Purpose:** Detailed evidence supporting each IAB classification, partitioned by taxonomy for efficient querying.

**Data Structure:**
```json
{
  "evidence_id": "evidence_abc123",
  "taxonomy_id": 123,
  "source": "email",
  "content": "Booking confirmation for Iceland hiking tour...",
  "timestamp": "2024-01-15T10:30:00Z",
  "evidence_type": "purchase_confirmation",
  "confidence_contribution": 0.15,
  "metadata": {
    "sender": "adventures@example.com",
    "subject": "Your Iceland Adventure Confirmation"
  }
}
```

**Updated By:**
- IAB Classification Workflow
- Evidence Judge agent

**Read By:**
- Dashboard evidence viewer
- Mission agents (for context)
- Feedback analysis system

**Lifecycle:**
- Created: With classification
- Updated: Rarely (immutable evidence)
- Deleted: On user request (GDPR compliance)

---

## User Profile Namespaces

### 3. User Profile

**Namespace:** `({user_id}, user_profile)`

**Purpose:** Core user profile information, created at signup.

**Data Structure:**
```json
{
  "user_id": "user_123",
  "wallet_address": "0x1234...5678",
  "display_name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-01-01T00:00:00Z",
  "last_login": "2024-03-15T10:30:00Z",
  "onboarding_completed": true,
  "settings": {
    "notifications_enabled": true,
    "disclosure_level": "minimal",
    "preferred_mission_frequency": "daily"
  }
}
```

**Updated By:**
- Authentication system
- Settings API
- Onboarding flow

**Read By:**
- All mission agents
- Profile API
- Dashboard

**Lifecycle:**
- Created: At user signup
- Updated: On settings changes, login
- Deleted: On account deletion request

---

### 4. Demographics

**Namespace:** `({user_id}, demographics)`

**Purpose:** Demographic information inferred from IAB classifications and user-provided data.

**Data Structure:**
```json
{
  "age_range": "25-34",
  "gender": "prefer_not_to_say",
  "location": {
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "timezone": "America/Los_Angeles"
  },
  "occupation": "Software Engineer",
  "income_range": "$100k-$150k",
  "education_level": "Bachelor's Degree",
  "language": "en",
  "inferred_from_iab": true,
  "user_verified": false,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- IAB analysis (inferred)
- User settings (verified)
- Onboarding flow

**Read By:**
- Mission agents (for personalization)
- Recommendations engine
- SSO selective disclosure (Phase 6)

**Lifecycle:**
- Created: During onboarding or IAB analysis
- Updated: On new IAB data or user verification
- Deleted: With user profile

---

### 5. Household

**Namespace:** `({user_id}, household)`

**Purpose:** Household composition and characteristics.

**Data Structure:**
```json
{
  "family_size": 4,
  "has_children": true,
  "children_ages": [8, 12],
  "marital_status": "married",
  "home_ownership": "own",
  "home_type": "single_family",
  "pets": [
    {"type": "dog", "breed": "Labrador"},
    {"type": "cat", "breed": "Mixed"}
  ],
  "vehicles": 2,
  "inferred_from_iab": true,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- IAB analysis
- User settings

**Read By:**
- Shopping missions (family-sized products)
- Travel missions (family-friendly destinations)
- Financial missions (family insurance)

**Lifecycle:**
- Created: During IAB analysis
- Updated: On new evidence
- Deleted: With user profile

---

## Ikigai Namespaces

### 6. Ikigai Profile

**Namespace:** `({user_id}, ikigai_profile)`

**Purpose:** User's life purpose, core interests, values, and goals (Ikigai framework).

**Data Structure:**
```json
{
  "life_purpose": "Help others through meaningful technology",
  "core_interests": [
    "technology",
    "outdoor_adventures",
    "continuous_learning",
    "family_time"
  ],
  "values": [
    "authenticity",
    "growth",
    "connection",
    "adventure"
  ],
  "short_term_goals": [
    "Learn Spanish",
    "Run a half marathon",
    "Visit Iceland"
  ],
  "long_term_goals": [
    "Start a nonprofit",
    "Write a book",
    "Achieve financial independence"
  ],
  "created_at": "2024-01-15T00:00:00Z",
  "last_updated": "2024-03-01T00:00:00Z",
  "confidence": 0.82
}
```

**Updated By:**
- Onboarding flow (initial)
- Mission feedback analysis (refined)
- Periodic Ikigai check-ins

**Read By:**
- ALL Ikigai mission agents
- Mission orchestrator (for prioritization)
- Dashboard Ikigai view

**Lifecycle:**
- Created: During onboarding
- Updated: Continuously from feedback
- Deleted: With user profile

---

### 7. Ikigai Interests

**Namespace:** `({user_id}, ikigai_interests, {interest_type})`

**Purpose:** Detailed breakdown of specific interest areas within Ikigai.

**Interest Types:** `travel`, `hobbies`, `learning`, `social`, `creative`, `wellness`

**Data Structure:**
```json
{
  "interest_type": "travel",
  "preferences": {
    "destinations": ["Iceland", "New Zealand", "Patagonia"],
    "travel_style": "adventure",
    "budget_level": "mid_range",
    "trip_duration_preference": "1-2 weeks",
    "companions": ["partner", "friends"]
  },
  "recent_activities": [
    {
      "activity": "Booked Iceland hiking tour",
      "date": "2024-01-15T00:00:00Z",
      "source": "email_classification"
    }
  ],
  "alignment_score": 0.95,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Mission feedback
- IAB classifications
- User interactions

**Read By:**
- Travel mission agent
- Event mission agent
- Content mission agent

**Lifecycle:**
- Created: When interest detected
- Updated: On new activities/feedback
- Deleted: If interest becomes inactive (>1 year)

---

## Shopping & Financial Namespaces

### 8. Shopping List

**Namespace:** `({user_id}, shopping_list)`

**Purpose:** Items user is actively looking to purchase.

**Data Structure:**
```json
{
  "items": [
    {
      "item_id": "item_abc123",
      "product_name": "Trail running shoes",
      "product_category": "Athletic Footwear",
      "price_range": {"min": 100, "max": 200},
      "urgency": "medium",
      "preferences": {
        "brand": ["Salomon", "Hoka"],
        "size": "10.5",
        "color": "any"
      },
      "added_at": "2024-03-01T00:00:00Z",
      "source": "email_receipt_analysis"
    }
  ],
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- IAB purchase intent classifications
- Shopping mission agent
- User explicit additions

**Read By:**
- Shopping mission agent (creates deal cards)
- Price tracking system

**Lifecycle:**
- Created: When purchase intent detected
- Updated: On new items or price changes
- Deleted: After purchase or user removal

---

### 9. Shopping Preferences

**Namespace:** `({user_id}, shopping_preferences)`

**Purpose:** User's shopping habits, brand preferences, and buying patterns.

**Data Structure:**
```json
{
  "preferred_retailers": [
    {"name": "Amazon", "frequency": "high"},
    {"name": "REI", "frequency": "medium"}
  ],
  "preferred_brands": {
    "electronics": ["Apple", "Sony"],
    "clothing": ["Patagonia", "North Face"],
    "outdoor_gear": ["REI Co-op", "Black Diamond"]
  },
  "price_sensitivity": "mid_range",
  "deal_threshold": 0.15,
  "shopping_frequency": {
    "electronics": "6_months",
    "clothing": "monthly",
    "groceries": "weekly"
  },
  "payment_methods": ["credit_card", "paypal"],
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Shopping mission feedback
- IAB purchase classifications
- Financial transaction analysis

**Read By:**
- Shopping mission agent
- Deal recommendation engine

**Lifecycle:**
- Created: During IAB analysis
- Updated: Continuously from purchases
- Deleted: With user profile

---

### 10. Shopping History

**Namespace:** `({user_id}, shopping_history)`

**Purpose:** Past purchases for pattern analysis.

**Data Structure:**
```json
{
  "purchases": [
    {
      "purchase_id": "purchase_abc123",
      "product_name": "Salomon Speedcross Trail Shoes",
      "retailer": "REI",
      "price": 139.99,
      "category": "Athletic Footwear",
      "purchase_date": "2024-02-15T00:00:00Z",
      "source": "email_receipt",
      "deal_applied": true,
      "savings": 30.00
    }
  ],
  "total_purchases": 247,
  "total_spent": 12450.75,
  "total_saved": 1823.40,
  "last_purchase": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Email receipt analysis
- Financial transaction matching
- Mission completion tracking

**Read By:**
- Shopping mission agent (pattern analysis)
- Analytics dashboard

**Lifecycle:**
- Created: On first purchase detection
- Updated: On each new purchase
- Deleted: Never (retained for analysis)

---

### 11. Financial Profile

**Namespace:** `({user_id}, financial_profile)`

**Purpose:** User's financial situation, spending patterns, and savings goals.

**Data Structure:**
```json
{
  "income_range": "$100k-$150k",
  "spending_categories": {
    "housing": 2500,
    "transportation": 800,
    "food": 1200,
    "entertainment": 500,
    "shopping": 800,
    "utilities": 300,
    "insurance": 400
  },
  "savings_goals": [
    {
      "goal": "Emergency fund",
      "target_amount": 15000,
      "current_amount": 8000,
      "target_date": "2024-12-31"
    }
  ],
  "debt": {
    "mortgage": 350000,
    "car_loan": 15000,
    "student_loans": 0
  },
  "investment_profile": "moderate",
  "credit_score_range": "750-800",
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Financial transaction analysis
- IAB financial classifications
- User settings

**Read By:**
- Financial services mission agent
- Savings mission agents
- Investment recommendation engine

**Lifecycle:**
- Created: During financial analysis
- Updated: Monthly
- Deleted: With user profile

---

### 12. Utility Bills

**Namespace:** `({user_id}, utility_bills)`

**Purpose:** Current utility providers and costs for optimization missions.

**Data Structure:**
```json
{
  "utilities": [
    {
      "type": "electricity",
      "provider": "PG&E",
      "monthly_cost": 150,
      "contract_end_date": "2024-12-31",
      "usage_kwh": 800,
      "last_bill_date": "2024-02-28"
    },
    {
      "type": "internet",
      "provider": "Comcast",
      "monthly_cost": 89,
      "speed_mbps": 300,
      "contract_end_date": null
    }
  ],
  "total_monthly_utilities": 539,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Email bill receipt analysis
- Financial transaction matching
- User manual input

**Read By:**
- Utility optimization mission agent
- Financial savings calculations

**Lifecycle:**
- Created: When bills detected
- Updated: Monthly on new bills
- Deleted: After switching providers (archived)

---

### 13. Subscriptions

**Namespace:** `({user_id}, subscriptions)`

**Purpose:** Recurring subscription services for optimization.

**Data Structure:**
```json
{
  "subscriptions": [
    {
      "service": "Netflix",
      "category": "streaming",
      "monthly_cost": 15.99,
      "billing_date": 5,
      "start_date": "2022-01-05",
      "auto_renewal": true,
      "usage": "high"
    },
    {
      "service": "Planet Fitness",
      "category": "fitness",
      "monthly_cost": 24.99,
      "billing_date": 15,
      "usage": "low",
      "optimization_candidate": true
    }
  ],
  "total_monthly_subscriptions": 187.94,
  "subscription_count": 12,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Financial transaction analysis
- Email receipt matching
- Subscription mission feedback

**Read By:**
- Subscription optimization agent
- Financial savings dashboard

**Lifecycle:**
- Created: When subscription detected
- Updated: On billing cycles
- Deleted: After cancellation (archived)

---

## Travel & Dining Namespaces

### 14. Travel Preferences

**Namespace:** `({user_id}, travel_preferences)`

**Purpose:** Travel style, destination preferences, and constraints.

**Data Structure:**
```json
{
  "travel_style": "adventure",
  "preferred_destinations": ["Iceland", "New Zealand", "Patagonia"],
  "climate_preference": "cool",
  "activity_level": "high",
  "accommodation_type": "boutique_hotel",
  "budget_per_trip": {"min": 3000, "max": 8000},
  "trip_duration_preference": "7-14 days",
  "travel_companions": ["partner", "friends"],
  "season_preference": "summer",
  "flight_class": "economy_plus",
  "loyalty_programs": [
    {"airline": "United", "status": "Silver"},
    {"hotel": "Marriott", "status": "Gold"}
  ],
  "constraints": {
    "available_pto_days": 15,
    "blackout_dates": ["2024-12-15 to 2025-01-05"]
  },
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Travel mission feedback
- Ikigai profile updates
- Booking confirmation analysis

**Read By:**
- Travel mission agent
- Event mission agent (destination events)

**Lifecycle:**
- Created: From Ikigai or first travel IAB classification
- Updated: After each trip or feedback
- Deleted: With user profile

---

### 15. Past Trips

**Namespace:** `({user_id}, past_trips)`

**Purpose:** Historical trips for pattern analysis and recommendations.

**Data Structure:**
```json
{
  "trips": [
    {
      "trip_id": "trip_abc123",
      "destination": "Iceland",
      "dates": {
        "start": "2024-06-10",
        "end": "2024-06-17"
      },
      "trip_type": "adventure",
      "highlights": ["Golden Circle", "Glacier hiking", "Northern Lights"],
      "hotel": "Hotel Reykjavik",
      "activities_booked": 5,
      "total_cost": 5200,
      "rating": 5,
      "would_return": true,
      "notes": "Amazing experience, want more hiking trips"
    }
  ],
  "total_trips": 12,
  "favorite_destinations": ["Iceland", "Costa Rica"],
  "last_trip_date": "2024-06-17"
}
```

**Updated By:**
- Travel booking confirmations
- Mission completion tracking
- User feedback

**Read By:**
- Travel mission agent (pattern analysis)
- Recommendation engine

**Lifecycle:**
- Created: On trip booking/completion
- Updated: After trip with feedback
- Deleted: Never (retained for patterns)

---

### 16. Dining Preferences

**Namespace:** `({user_id}, dining_preferences)`

**Purpose:** Restaurant preferences, dietary restrictions, and dining habits.

**Data Structure:**
```json
{
  "cuisine_preferences": [
    {"cuisine": "Italian", "rating": 5},
    {"cuisine": "Japanese", "rating": 5},
    {"cuisine": "Mexican", "rating": 4},
    {"cuisine": "Thai", "rating": 4}
  ],
  "dietary_restrictions": ["vegetarian_friendly"],
  "allergens": ["tree_nuts"],
  "price_range": "$$-$$$",
  "dining_frequency": {
    "weekday": 2,
    "weekend": 3
  },
  "preferred_meal_times": {
    "dinner": "19:00-20:00"
  },
  "atmosphere_preference": ["casual", "romantic"],
  "reservation_lead_time": "3-7 days",
  "group_size": 2,
  "neighborhoods": ["Mission", "North Beach", "Marina"],
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Restaurant mission feedback
- Email reservation confirmations
- IAB dining classifications

**Read By:**
- Restaurant mission agent
- Event mission agent (dining + show combos)

**Lifecycle:**
- Created: From IAB or first restaurant feedback
- Updated: After dining experiences
- Deleted: With user profile

---

### 17. Restaurant History

**Namespace:** `({user_id}, restaurant_history)`

**Purpose:** Past restaurant visits for pattern analysis.

**Data Structure:**
```json
{
  "visits": [
    {
      "visit_id": "visit_abc123",
      "restaurant_name": "Flour + Water",
      "cuisine": "Italian",
      "visit_date": "2024-02-14",
      "price_range": "$$$",
      "rating": 5,
      "dishes_ordered": ["Handmade Pasta", "Tiramisu"],
      "occasion": "anniversary",
      "would_return": true
    }
  ],
  "favorite_restaurants": [
    {"name": "Flour + Water", "visits": 5},
    {"name": "State Bird Provisions", "visits": 3}
  ],
  "total_visits": 87,
  "last_visit": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Email reservation confirmations
- Financial transaction matching
- Mission feedback

**Read By:**
- Restaurant mission agent
- Recommendation engine

**Lifecycle:**
- Created: On first restaurant visit
- Updated: After each visit
- Deleted: Never (retained for patterns)

---

## Events & Content Namespaces

### 18. Event Preferences

**Namespace:** `({user_id}, event_preferences)`

**Purpose:** Preferences for live events (comedy, theater, sports, concerts).

**Data Structure:**
```json
{
  "event_types": [
    {"type": "comedy", "interest_level": 5},
    {"type": "theater", "interest_level": 4},
    {"type": "sports", "interest_level": 3, "teams": ["SF Giants", "Warriors"]},
    {"type": "concerts", "interest_level": 5, "genres": ["indie_rock", "electronic"]}
  ],
  "preferred_venues": ["The Fillmore", "Outside Lands", "Oracle Park"],
  "price_range": {"min": 30, "max": 150},
  "advance_notice": "2-4 weeks",
  "preferred_days": ["Friday", "Saturday"],
  "group_size": 2,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Event mission feedback
- Email ticket confirmations
- Ikigai interests

**Read By:**
- Event mission agent
- Content mission agent (related content)

**Lifecycle:**
- Created: From Ikigai or IAB events
- Updated: After event attendance
- Deleted: With user profile

---

### 19. Attended Events

**Namespace:** `({user_id}, attended_events)`

**Purpose:** Historical event attendance for recommendations.

**Data Structure:**
```json
{
  "events": [
    {
      "event_id": "event_abc123",
      "event_name": "Bill Burr Live",
      "event_type": "comedy",
      "venue": "Masonic Theater",
      "date": "2024-02-20T20:00:00Z",
      "ticket_price": 75,
      "rating": 5,
      "attended_with": ["partner"],
      "would_attend_similar": true
    }
  ],
  "total_events_attended": 23,
  "favorite_performers": ["Bill Burr", "John Mulaney"],
  "last_event": "2024-02-20"
}
```

**Updated By:**
- Email ticket confirmations
- Mission completion tracking
- User feedback

**Read By:**
- Event mission agent
- Recommendation engine

**Lifecycle:**
- Created: On ticket purchase
- Updated: After event with feedback
- Deleted: Never (retained for patterns)

---

### 20. Content Preferences

**Namespace:** `({user_id}, content_preferences)`

**Purpose:** Preferences for articles, videos, books, podcasts.

**Data Structure:**
```json
{
  "content_types": {
    "articles": {
      "interest_level": 5,
      "topics": ["technology", "psychology", "adventure_travel", "personal_finance"],
      "preferred_length": "10-15 min",
      "sources": ["Medium", "The Atlantic", "Wired"]
    },
    "videos": {
      "interest_level": 4,
      "topics": ["documentaries", "tech_reviews", "outdoor_adventures"],
      "preferred_length": "20-40 min",
      "platforms": ["YouTube", "Nebula"]
    },
    "books": {
      "interest_level": 5,
      "genres": ["non_fiction", "biography", "science"],
      "format": "audiobook",
      "reading_pace": "1-2 per month"
    },
    "podcasts": {
      "interest_level": 5,
      "categories": ["technology", "true_crime", "comedy"],
      "episode_length": "30-60 min",
      "frequency": "daily"
    }
  },
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Content mission feedback
- Browsing history analysis
- Ikigai interests

**Read By:**
- Content mission agent
- Recommendation engine

**Lifecycle:**
- Created: From Ikigai or browsing analysis
- Updated: Continuously from engagement
- Deleted: With user profile

---

## Health Namespaces

### 21. Health Profile

**Namespace:** `({user_id}, health_profile)`

**Purpose:** Health metrics and medical history.

**Data Structure:**
```json
{
  "age": 32,
  "height_cm": 180,
  "weight_kg": 75,
  "blood_type": "O+",
  "chronic_conditions": [],
  "medications": [],
  "allergies": ["tree_nuts"],
  "last_checkup": "2024-01-15",
  "health_goals": ["maintain_weight", "improve_cardiovascular_fitness"],
  "activity_level": "moderate",
  "sleep_average_hours": 7.5,
  "stress_level": "moderate",
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Health data connectors (Apple Health, Fitbit)
- User manual input
- Health mission feedback

**Read By:**
- Health mission agent
- Fitness mission agent
- Nutrition mission agent

**Lifecycle:**
- Created: During onboarding or health data connection
- Updated: Continuously from health devices
- Deleted: With user profile

---

### 22. Fitness Goals

**Namespace:** `({user_id}, fitness_goals)`

**Purpose:** Fitness objectives and tracking.

**Data Structure:**
```json
{
  "goals": [
    {
      "goal_id": "goal_abc123",
      "goal_type": "run_distance",
      "target": "half_marathon",
      "target_distance_km": 21.1,
      "target_date": "2024-09-15",
      "current_progress": {
        "longest_run_km": 15,
        "weekly_avg_km": 25,
        "last_activity": "2024-03-01"
      },
      "status": "on_track"
    }
  ],
  "workout_preferences": {
    "types": ["running", "cycling", "hiking"],
    "frequency": "4-5 times per week",
    "duration": "45-60 min",
    "time_of_day": "morning"
  },
  "equipment_owned": ["running_shoes", "bicycle", "fitness_tracker"],
  "gym_membership": false,
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Fitness tracker integration
- Health mission feedback
- User goal updates

**Read By:**
- Fitness mission agent
- Health mission agent
- Equipment shopping agent

**Lifecycle:**
- Created: When fitness goals set
- Updated: Continuously from tracking devices
- Deleted: When goals completed (archived)

---

## Mission State Namespaces

### 23. Mission Learnings

**Namespace:** `({mission_type}, mission_learnings)`

**Purpose:** Cross-user patterns and success factors for each mission type (privacy-preserving aggregation).

**Mission Types:** `shopping`, `utility`, `services`, `travel`, `event`, `restaurant`, `recipe`, `content`, `health`

**Data Structure:**
```json
{
  "mission_type": "shopping",
  "total_missions_created": 1547,
  "completion_rate": 0.34,
  "success_patterns": [
    {
      "pattern": "Deals >20% off have 60% higher completion rate",
      "confidence": 0.87,
      "sample_size": 523
    },
    {
      "pattern": "Products from preferred retailers complete 2x faster",
      "confidence": 0.92,
      "sample_size": 891
    }
  ],
  "common_failures": [
    {
      "reason": "Product out of stock",
      "frequency": 0.18
    },
    {
      "reason": "Price increased after card creation",
      "frequency": 0.12
    }
  ],
  "optimal_triggers": {
    "price_drop_threshold": 0.15,
    "inventory_check": "required",
    "brand_match_weight": 0.7
  },
  "last_updated": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Mission orchestrator (aggregated feedback)
- Analytics pipeline

**Read By:**
- Mission agents (for optimization)
- Mission orchestrator (for trigger thresholds)

**Lifecycle:**
- Created: When mission type first deployed
- Updated: Daily from aggregated feedback
- Deleted: Never (retained for system improvement)

---

### 24. Completed Missions

**Namespace:** `({user_id}, completed_missions)`

**Purpose:** Historical record of completed missions for pattern analysis.

**Data Structure:**
```json
{
  "missions": [
    {
      "mission_id": "mission_abc123",
      "card_type": "shopping",
      "created_at": "2024-02-15T10:00:00Z",
      "completed_at": "2024-02-16T14:30:00Z",
      "time_to_completion_hours": 28.5,
      "outcome": "purchased",
      "outcome_details": {
        "product": "Salomon Speedcross Trail Shoes",
        "retailer": "REI",
        "price": 139.99,
        "deal_savings": 30.00
      },
      "feedback_provided": true
    }
  ],
  "completion_stats": {
    "total_completed": 87,
    "by_category": {
      "savings": 45,
      "ikigai": 32,
      "health": 10
    },
    "total_savings": 1823.40,
    "avg_completion_time_hours": 72
  },
  "last_completed": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Mission completion workflow
- Feedback processing

**Read By:**
- Analytics dashboard
- Mission orchestrator (personalization)
- Wallet reward calculator

**Lifecycle:**
- Created: On first mission completion
- Updated: On each completion
- Deleted: Never (retained for patterns)

---

### 25. Mission Feedback

**Namespace:** `({user_id}, mission_feedback, {mission_id})`

**Purpose:** Detailed feedback on individual missions for preference extraction.

**Data Structure:**
```json
{
  "mission_id": "mission_abc123",
  "card_type": "shopping",
  "feedback_timestamp": "2024-02-16T14:30:00Z",
  "structured_feedback": {
    "relevance": 5,
    "timing": 4,
    "deal_quality": 5,
    "would_recommend": true
  },
  "qualitative_feedback": "Perfect timing! I was just looking for trail shoes. Love that it matched my preferred brands.",
  "extracted_preferences": {
    "brand_preference_confirmed": ["Salomon"],
    "price_sensitivity": 0.15,
    "timing_preference": "immediate",
    "preferred_retailers": ["REI"]
  },
  "outcome": "purchased",
  "llm_analysis": {
    "model": "gpt-4",
    "sentiment": "very_positive",
    "key_insights": [
      "Timing was crucial factor",
      "Brand matching highly valued",
      "Deal threshold appropriate"
    ]
  }
}
```

**Updated By:**
- Mission feedback API
- LLM feedback analysis pipeline

**Read By:**
- Mission agents (preference refinement)
- Mission orchestrator (trigger optimization)
- Analytics

**Lifecycle:**
- Created: When feedback submitted
- Updated: After LLM analysis
- Deleted: Never (retained for ML training)

---

## Episodic Memory Namespaces

### 26. Email Events

**Namespace:** `({user_id}, email_events)`

**Purpose:** Episodic memories from email analysis.

**Data Structure:**
```json
{
  "events": [
    {
      "event_id": "email_event_abc123",
      "email_id": "msg_xyz789",
      "sender": "adventures@example.com",
      "subject": "Your Iceland Adventure Confirmation",
      "timestamp": "2024-01-15T10:30:00Z",
      "event_type": "travel_booking",
      "entities": {
        "destination": "Iceland",
        "dates": ["2024-06-10", "2024-06-17"],
        "cost": 5200,
        "booking_reference": "ICE-12345"
      },
      "iab_triggered": [123, 456],
      "missions_created": ["mission_abc123"]
    }
  ],
  "total_events": 1547,
  "last_processed": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Email parser workflow
- IAB classification system

**Read By:**
- Mission orchestrator (trigger detection)
- Analytics

**Lifecycle:**
- Created: On email processing
- Updated: Rarely (immutable)
- Deleted: On user request (GDPR)

---

### 27. Calendar Events

**Namespace:** `({user_id}, calendar_events)`

**Purpose:** Episodic memories from calendar analysis.

**Data Structure:**
```json
{
  "events": [
    {
      "event_id": "cal_event_abc123",
      "title": "Mount Kilimanjaro expedition planning",
      "start_time": "2024-02-20T14:00:00Z",
      "end_time": "2024-02-20T15:00:00Z",
      "location": "Coffee shop",
      "attendees": 3,
      "event_type": "planning_meeting",
      "entities": {
        "activity": "expedition",
        "destination": "Mount Kilimanjaro"
      },
      "iab_triggered": [123],
      "missions_created": []
    }
  ],
  "total_events": 892,
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Calendar connector (Phase 2)
- IAB classification

**Read By:**
- Mission orchestrator
- Travel mission agent

**Lifecycle:**
- Created: On calendar sync
- Updated: On event changes
- Deleted: After event date (retained 1 year)

---

### 28. Financial Transactions

**Namespace:** `({user_id}, financial_transactions)`

**Purpose:** Episodic memories from financial analysis.

**Data Structure:**
```json
{
  "transactions": [
    {
      "transaction_id": "txn_abc123",
      "date": "2024-02-15T00:00:00Z",
      "merchant": "REI",
      "amount": 139.99,
      "category": "sporting_goods",
      "payment_method": "credit_card_1234",
      "description": "Salomon Speedcross Trail Shoes",
      "iab_triggered": [789],
      "missions_created": []
    }
  ],
  "total_transactions": 2341,
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Financial connector (Phase 2)
- Transaction classifier

**Read By:**
- Shopping history builder
- Financial profile updater
- IAB classification system

**Lifecycle:**
- Created: On financial sync
- Updated: Rarely (immutable)
- Deleted: Retained per financial regulations (7 years)

---

### 29. Location History

**Namespace:** `({user_id}, location_history)`

**Purpose:** Episodic location data for pattern analysis.

**Data Structure:**
```json
{
  "locations": [
    {
      "location_id": "loc_abc123",
      "timestamp": "2024-03-01T12:00:00Z",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "place_name": "Golden Gate Park",
      "place_type": "park",
      "duration_minutes": 90,
      "activity_type": "hiking"
    }
  ],
  "frequent_locations": [
    {"name": "Work", "visit_count": 250},
    {"name": "Home", "visit_count": 365},
    {"name": "Gym", "visit_count": 120}
  ],
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Location connector (Phase 2)
- Location classifier

**Read By:**
- Travel mission agent (trip planning)
- Event mission agent (nearby events)
- Restaurant mission agent (location-based)

**Lifecycle:**
- Created: On location sync
- Updated: Continuously
- Deleted: Retained 1 year

---

### 30. Browsing History

**Namespace:** `({user_id}, browsing_history)`

**Purpose:** Episodic web browsing for interest detection.

**Data Structure:**
```json
{
  "pages": [
    {
      "page_id": "page_abc123",
      "url": "https://example.com/iceland-hiking-tours",
      "title": "Best Iceland Hiking Tours 2024",
      "timestamp": "2024-03-01T15:30:00Z",
      "duration_seconds": 180,
      "category": "travel",
      "entities": {
        "destination": "Iceland",
        "activity": "hiking"
      },
      "iab_triggered": [123]
    }
  ],
  "total_pages": 8941,
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Browser extension connector (Phase 2)
- Content classifier

**Read By:**
- Content mission agent
- IAB classification (interest detection)

**Lifecycle:**
- Created: On browser sync
- Updated: Continuously
- Deleted: Retained 90 days (privacy)

---

### 31. Photo Events

**Namespace:** `({user_id}, photo_events)`

**Purpose:** Episodic memories from photo metadata (no image storage).

**Data Structure:**
```json
{
  "photos": [
    {
      "photo_id": "photo_abc123",
      "timestamp": "2024-06-12T14:30:00Z",
      "location": {
        "latitude": 64.1466,
        "longitude": -21.9426,
        "place_name": "Reykjavik, Iceland"
      },
      "metadata": {
        "camera": "iPhone 13",
        "tags": ["landscape", "travel", "nature"]
      },
      "detected_activities": ["hiking", "sightseeing"],
      "iab_triggered": [123]
    }
  ],
  "total_photos": 4521,
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Photo connector (Phase 2)
- Photo metadata analyzer

**Read By:**
- Travel mission agent (trip memories)
- Content mission agent (photo book suggestions)

**Lifecycle:**
- Created: On photo sync
- Updated: On metadata changes
- Deleted: Retained per user preference

---

### 32. Social Events

**Namespace:** `({user_id}, social_events)`

**Purpose:** Episodic social media activity (with permission).

**Data Structure:**
```json
{
  "events": [
    {
      "event_id": "social_abc123",
      "platform": "instagram",
      "event_type": "post",
      "timestamp": "2024-03-01T10:00:00Z",
      "content_summary": "Post about hiking trip",
      "tags": ["hiking", "outdoors", "adventure"],
      "engagement": {
        "likes": 45,
        "comments": 8
      },
      "iab_triggered": [123]
    }
  ],
  "total_events": 234,
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Social media connector (Phase 2)

**Read By:**
- Content mission agent
- Event mission agent (friends' interests)

**Lifecycle:**
- Created: On social sync
- Updated: On engagement changes
- Deleted: Retained 90 days

---

### 33. Health Events

**Namespace:** `({user_id}, health_events)`

**Purpose:** Episodic health data from fitness trackers.

**Data Structure:**
```json
{
  "events": [
    {
      "event_id": "health_abc123",
      "timestamp": "2024-03-01T07:00:00Z",
      "event_type": "workout",
      "activity": "running",
      "duration_minutes": 45,
      "distance_km": 8.5,
      "calories": 520,
      "heart_rate_avg": 145,
      "pace_min_per_km": "5:18"
    }
  ],
  "total_events": 523,
  "last_synced": "2024-03-01T00:00:00Z"
}
```

**Updated By:**
- Health device connector (Phase 2)

**Read By:**
- Fitness mission agent
- Health mission agent

**Lifecycle:**
- Created: On health sync
- Updated: Continuously
- Deleted: Retained per user preference

---

## Integration Guidelines

### Writing to Store

**Pattern for Mission Agents:**
```python
from src.mission_agents.memory import MissionStore, StoreConfig

config = StoreConfig()
store = MissionStore(config=config)

# Write IAB classification
store.put_iab_classification(
    user_id="user_123",
    taxonomy_id=123,
    classification={
        "taxonomy_name": "Travel/Adventure Travel",
        "confidence": 0.87,
        "evidence": [...],
        "last_updated": datetime.now().isoformat()
    }
)

# Write user preference
store.put_shopping_preferences(
    user_id="user_123",
    preferences={
        "preferred_retailers": [...],
        "price_sensitivity": "mid_range"
    }
)
```

### Reading from Store

**Pattern for Mission Agents:**
```python
# Get single item
iab_classifications = store.get_all_iab_classifications(user_id="user_123")

# Search with semantic search
travel_prefs = store.search_travel_preferences(
    user_id="user_123",
    query="adventure destinations"
)
```

### Store → API Integration

**Pattern for API Endpoints:**
```python
# dashboard/backend/api/profile.py

from src.mission_agents.memory import MissionStore, StoreConfig

@profile_bp.route('/iab-classifications', methods=['GET'])
@login_required
def get_iab_classifications():
    user_id = get_current_user()

    store = MissionStore(StoreConfig())
    classifications = store.get_all_iab_classifications(user_id)

    return jsonify(classifications), 200
```

### Migration: SQLite → Store

**Pattern for Email Parser:**
```python
# src/email_parser/workflow/nodes/update_memory.py

def update_memory_node(state, store=None):
    # Backward compatibility: Update SQLite
    update_sqlite_memory(state)

    # Forward compatibility: Write to Store
    if store:
        for classification in state["all_classifications"]:
            store.put_iab_classification(
                user_id=state.get("user_id", "default_user"),
                taxonomy_id=classification["taxonomy_id"],
                classification=classification
            )
```

---

## Namespace Summary

**Total Namespaces Defined:** 33

| Category | Namespace Count | Primary Purpose |
|----------|----------------|-----------------|
| IAB System | 2 | Classifications and evidence |
| User Profile | 3 | Core profile and demographics |
| Ikigai | 2 | Life purpose and interests |
| Shopping & Financial | 6 | Shopping, bills, subscriptions |
| Travel & Dining | 4 | Travel and restaurant preferences |
| Events & Content | 3 | Events and content preferences |
| Health | 2 | Health profile and fitness |
| Mission State | 3 | Mission feedback and learnings |
| Episodic Memory | 8 | Data source events |

---

## Schema Versioning and Migration Strategy

### Schema Version Format

All Store items MUST include a `schema_version` field to enable safe schema evolution:

```json
{
  "schema_version": "1.0",
  "mission_id": "...",
  "..."
}
```

**Version Format:** `{major}.{minor}`
- **Major version**: Breaking changes (incompatible with previous schema)
- **Minor version**: Additive changes (backward compatible)

### Schema Version Registry

| Namespace | Current Version | Last Breaking Change |
|-----------|----------------|---------------------|
| `iab_classifications` | 1.0 | 2025-01-06 (initial) |
| `user_profiles` | 1.0 | 2025-01-06 (initial) |
| `mission_cards` | 1.0 | 2025-01-06 (initial) |
| `data_sources` | 1.0 | 2025-01-06 (initial) |
| `wallet_transactions` | 1.0 | 2025-01-06 (initial) |
| `notifications` | 1.0 | 2025-01-06 (initial) |

### Migration Strategy

#### Read-Time Migration

Items are migrated lazily on read to avoid downtime and batch operations:

```python
# src/mission_agents/memory/migrations.py

def migrate_namespace(namespace: str, item: dict) -> dict:
    """
    Migrate Store item to latest schema version.

    Args:
        namespace: Store namespace (e.g., "mission_cards")
        item: Raw item from Store

    Returns:
        Migrated item with latest schema_version
    """
    current_version = item.get("schema_version", "0.0")
    target_version = SCHEMA_VERSIONS[namespace]

    if current_version == target_version:
        return item  # Already latest

    # Apply migrations in sequence
    migrations = get_migrations(namespace, current_version, target_version)
    for migration in migrations:
        item = migration(item)

    item["schema_version"] = target_version
    return item


# Example migration function
def migrate_mission_card_1_0_to_1_1(item: dict) -> dict:
    """Migrate MissionCard from v1.0 to v1.1 (add retry_count field)."""
    item["retry_count"] = 0  # New field with default
    return item
```

#### Migration Registry

```python
# Migration registry maps (namespace, from_version, to_version) → migration_func
MIGRATIONS = {
    ("mission_cards", "1.0", "1.1"): migrate_mission_card_1_0_to_1_1,
    ("mission_cards", "1.1", "2.0"): migrate_mission_card_1_1_to_2_0,
    # Add more migrations as schema evolves
}

def get_migrations(namespace: str, from_version: str, to_version: str) -> List[Callable]:
    """Get ordered list of migrations to apply."""
    # Walk migration graph from from_version to to_version
    # Example: 1.0 → 1.1 → 1.2 → 2.0
    pass
```

#### Store Read Helper

```python
# src/mission_agents/memory/store.py

def get_item_migrated(store, namespace: tuple, key: str) -> dict:
    """
    Get item from Store with automatic migration.

    Usage:
        item = get_item_migrated(store, ("mission_cards", user_id), mission_id)
    """
    item = store.get(namespace, key)
    if item is None:
        return None

    # Migrate if needed
    namespace_name = namespace[0] if isinstance(namespace, tuple) else namespace
    migrated = migrate_namespace(namespace_name, item.value)

    # Write back if schema changed
    if migrated["schema_version"] != item.value.get("schema_version"):
        store.put(namespace, key, migrated)
        logger.info(f"Migrated {namespace}/{key} to {migrated['schema_version']}")

    return migrated
```

### Breaking Changes Policy

**When making breaking changes:**

1. **Plan migration path** - Define how old data maps to new schema
2. **Increment major version** - e.g., 1.2 → 2.0
3. **Add migration function** - Implement in `migrations.py`
4. **Test migration** - Verify on sample data
5. **Monitor migration metrics** - Track migration success rate
6. **Support N-1 versions** - Maintain migrations for previous major version

**Example Breaking Change:**

```python
# Breaking: Rename field "savings_amount" → "discount_amount" in ShoppingCardData

def migrate_shopping_card_1_0_to_2_0(item: dict) -> dict:
    """Breaking change: Rename savings_amount → discount_amount."""
    card_data = item.get("card_data", {})
    if "savings_amount" in card_data:
        card_data["discount_amount"] = card_data.pop("savings_amount")
    return item

MIGRATIONS[("mission_cards", "1.0", "2.0")] = migrate_shopping_card_1_0_to_2_0
```

### Backward Compatibility

**Additive changes (minor version bumps) are backward compatible:**

```python
# Safe: Add new optional field
{
  "schema_version": "1.1",  # Was 1.0
  "mission_id": "...",
  "new_field": "..."  # New optional field, old code can ignore
}
```

**Breaking changes require migration:**

```python
# Breaking: Remove required field (requires migration)
{
  "schema_version": "2.0",  # Was 1.0
  "mission_id": "...",
  # "old_field" removed - old code will break
}
```

### Migration Monitoring

**Metrics to track:**

- Migration success rate (% successful migrations)
- Migration latency (time to migrate item)
- Schema version distribution (how many items on old schemas)
- Migration errors (failed migrations requiring manual intervention)

**Logging:**

```python
logger.info(f"Migrated {namespace}/{key}: v{old_version} → v{new_version}")
logger.error(f"Migration failed for {namespace}/{key}: {error}")
```

**Alerting:**

- Alert if migration error rate > 1%
- Alert if >10% of items on schema version older than N-2

### Testing Migrations

```python
# tests/mission_agents/memory/test_migrations.py

def test_shopping_card_migration_1_0_to_2_0():
    """Test shopping card schema migration."""
    old_item = {
        "schema_version": "1.0",
        "mission_id": "mission_123",
        "card_data": {
            "savings_amount": 25.50
        }
    }

    migrated = migrate_shopping_card_1_0_to_2_0(old_item)

    assert migrated["schema_version"] == "2.0"
    assert "discount_amount" in migrated["card_data"]
    assert migrated["card_data"]["discount_amount"] == 25.50
    assert "savings_amount" not in migrated["card_data"]
```

### Future Considerations

**Phase 2-3:** Implement complete migration framework
**Phase 4:** Add migration API endpoints for manual triggering
**Phase 5:** Build migration dashboard for monitoring

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2025-01-06 | Added schema versioning and migration strategy |
| 1.0.0 | 2025-01-06 | Initial comprehensive documentation (Phase 1) |

---

## Related Documentation

- **Architecture:** `docs/reference/ARCHITECTURAL_DECISIONS.md`
- **Implementation:** `src/mission_agents/memory/store.py`
- **Configuration:** `src/mission_agents/memory/config.py`
- **Integration Plan:** `docs/plans/2025-01-04-ownyou-consumer-app-integration.md`
- **Strategic Roadmap:** `docs/plans/2025-01-04-ownyou-strategic-roadmap.md`
