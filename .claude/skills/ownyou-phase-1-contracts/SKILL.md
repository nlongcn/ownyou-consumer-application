---
name: ownyou-phase-1-contracts
description: Define foundation contracts for OwnYou Phase 1 - complete data models (all card types), Store schema (all namespaces), API contracts (OpenAPI), and authentication. Use during Phase 1 to establish interfaces that enable parallel Phase 2-7 development without rework.
---

# OwnYou Phase 1: Foundation & Contracts

Define ALL contracts upfront to enable parallel development without rework.

## Phase 1 Goal

**Define complete interfaces so Phases 2-7 can work in parallel without blocking or rework.**

**Timeline:** 2 weeks
**Team:** 2-3 developers
**Deliverables:** Data models, Store schema, API contracts, Authentication system

## Why Phase 1 Matters

**Without Phase 1:** Each phase blocks on previous phases, changes ripple through codebase, 20 weeks sequential

**With Phase 1:** After Phase 1, teams work in parallel on Phases 2-7, changes isolated by contracts, 11 weeks total

**Cost of getting it wrong:** Rework in all phases, integration failures, 6+ month delays

## Phase 1 Checklist

### Deliverable 1: Complete Data Models (All Card Types)

**File:** `src/models/complete_schema.py`

**Goal:** Define Pydantic models for EVERY card type, even if not implementing until Phase 3.

**Card Categories:**
- **Savings:** Shopping, Utility (Bills), Services (Insurance, Banking)
- **Ikigai:** Travel, Event (Comedy, Theater, Sports), Restaurant, Recipe, Content, Hobby, Friend
- **Health:** Diagnostic, Fitness

**Checklist:**

- [ ] Read requirements: `docs/Brainstorming/brainstorming_mission_agents/*OwnYou Consumer App Requirements`
- [ ] Review Figma designs for each card type
- [ ] Define base MissionCard model (if not exists)
- [ ] Define CardData models for ALL card types:

**Savings Card Data Models:**
```python
class ShoppingCardData(BaseModel):
    product_name: str
    product_url: str
    image_url: str
    current_price: float
    original_price: Optional[float] = None
    retailer_name: str
    in_stock: bool = True
    savings_amount: Optional[float] = None

class UtilityCardData(BaseModel):
    utility_type: str  # "energy", "water", "internet", "phone"
    current_provider: str
    current_cost: float
    recommended_provider: str
    recommended_cost: float
    savings_annual: float
    switch_incentive: Optional[float] = None

class ServicesCardData(BaseModel):
    service_type: str  # "insurance", "banking", "investment"
    current_provider: str
    current_terms: Dict[str, Any]
    recommended_provider: str
    recommended_terms: Dict[str, Any]
    savings_annual: float
```

**Ikigai Card Data Models:**
```python
class TravelCardData(BaseModel):
    destination: str
    destination_image_url: str
    trip_dates: Optional[tuple[date, date]] = None
    hotel_options: List[Dict[str, Any]]
    flight_options: List[Dict[str, Any]]
    activities: List[Dict[str, Any]]
    estimated_cost: float
    alignment_score: float  # How well matches Ikigai profile

class EventCardData(BaseModel):
    event_type: str  # "comedy", "theater", "sports", "concert"
    event_name: str
    event_image_url: str
    venue: str
    event_date: datetime
    ticket_options: List[Dict[str, Any]]
    artist_performer: str

class RestaurantCardData(BaseModel):
    restaurant_name: str
    restaurant_image_url: str
    cuisine_type: str
    price_range: str  # "$", "$$", "$$$", "$$$$"
    rating: float
    review_count: int
    distance_miles: float
    reservation_url: str
    menu_highlights: List[str]

class RecipeCardData(BaseModel):
    recipe_name: str
    recipe_image_url: str
    cuisine_type: str
    difficulty: str  # "easy", "medium", "hard"
    prep_time_minutes: int
    cook_time_minutes: int
    servings: int
    ingredients: List[str]
    instructions_url: str

class ContentCardData(BaseModel):
    content_type: str  # "article", "video", "book", "podcast"
    title: str
    thumbnail_url: str
    author_creator: str
    description: str
    content_url: str
    estimated_time_minutes: int
    topics: List[str]
```

**Health Card Data Models:**
```python
class HealthCardData(BaseModel):
    health_type: str  # "diagnostic", "fitness", "nutrition"
    title: str
    description: str
    action_items: List[str]
    resources: List[Dict[str, Any]]
    priority: str  # "high", "medium", "low"
```

**Validation:**
- [ ] All card types from requirements represented
- [ ] All Figma designs have corresponding model
- [ ] Models use correct types (str, int, float, datetime, etc.)
- [ ] Optional fields marked with Optional[]
- [ ] Lists typed with List[specific_type]
- [ ] All models inherit from BaseModel
- [ ] Docstrings explain purpose

### Deliverable 2: Complete Store Schema Documentation

**File:** `src/mission_agents/memory/store_schema.md`

**Goal:** Document EVERY namespace that will be used in Phases 2-7.

**Namespace Categories:**
1. IAB System (Phase 0/1)
2. User Profile (Phase 1/2)
3. Mission-Specific Preferences (Phase 2/3)
4. Ikigai (Phase 2/3)
5. Mission State (Phase 3/4)
6. Episodic Memories (Phase 2)

**Checklist:**

- [ ] Review complete Store schema in `reference/ARCHITECTURAL_DECISIONS.md`
- [ ] Document each namespace with:
  - Namespace pattern
  - Purpose
  - Data structure (JSON schema)
  - Which agents write to it
  - Which agents read from it
  - Lifecycle (created, updated, deleted)
- [ ] Add all namespaces to StoreConfig:

```python
# src/mission_agents/memory/config.py

STORE_NAMESPACES = {
    # IAB System
    "iab_classifications": "(ownyou.iab_classifications, {user_id})",

    # User Profile
    "user_profile": "(ownyou.user_profile, {user_id})",
    "demographics": "(ownyou.demographics, {user_id})",
    "household": "(ownyou.household, {user_id})",

    # Ikigai
    "ikigai_profile": "(ownyou.ikigai_profile, {user_id})",
    "ikigai_interests": "(ownyou.ikigai_interests, {user_id}, {interest_type})",

    # Shopping & Financial
    "shopping_list": "(ownyou.shopping_list, {user_id})",
    "shopping_preferences": "(ownyou.shopping_preferences, {user_id})",
    "shopping_history": "(ownyou.shopping_history, {user_id})",
    "financial_profile": "(ownyou.financial_profile, {user_id})",
    "utility_bills": "(ownyou.utility_bills, {user_id})",
    "subscriptions": "(ownyou.subscriptions, {user_id})",

    # Travel & Dining
    "travel_preferences": "(ownyou.travel_preferences, {user_id})",
    "past_trips": "(ownyou.past_trips, {user_id})",
    "dining_preferences": "(ownyou.dining_preferences, {user_id})",
    "restaurant_history": "(ownyou.restaurant_history, {user_id})",

    # Events & Content
    "event_preferences": "(ownyou.event_preferences, {user_id})",
    "attended_events": "(ownyou.attended_events, {user_id})",
    "content_preferences": "(ownyou.content_preferences, {user_id})",

    # Health
    "health_profile": "(ownyou.health_profile, {user_id})",
    "fitness_goals": "(ownyou.fitness_goals, {user_id})",

    # Mission State
    "mission_learnings": "(ownyou.mission_learnings, {mission_type})",
    "completed_missions": "(ownyou.completed_missions, {user_id})",
    "mission_feedback": "(ownyou.mission_feedback, {user_id}, {mission_id})",

    # Episodic Memories
    "email_events": "(ownyou.email_events, {user_id})",
    "calendar_events": "(ownyou.calendar_events, {user_id})",
    "financial_transactions": "(ownyou.financial_transactions, {user_id})",
    "location_history": "(ownyou.location_history, {user_id})",
    "browsing_history": "(ownyou.browsing_history, {user_id})",
    "photo_events": "(ownyou.photo_events, {user_id})",
    "social_events": "(ownyou.social_events, {user_id})",
    "health_events": "(ownyou.health_events, {user_id})",
}
```

**Validation:**
- [ ] All data sources (8 types) have episodic namespace
- [ ] All mission types have preference namespace
- [ ] All card types can map to Store namespaces
- [ ] No duplicate namespaces
- [ ] Namespace hierarchy max 3 levels
- [ ] Documentation includes JSON schemas for each

### Deliverable 3: Complete API Contracts (OpenAPI Spec)

**File:** `docs/api/openapi.yaml`

**Goal:** Define EVERY REST endpoint that will exist in Phases 4-7.

**Endpoint Categories:**
1. Authentication
2. Missions (CRUD, feedback, state management)
3. Wallet (balance, transactions, rewards)
4. Notifications (list, mark read, preferences)
5. Connections (data sources management)
6. Settings (app, disclosure, privacy)
7. Profile (user, IAB, Ikigai)

**Checklist:**

- [ ] Review requirements for all API operations
- [ ] Define OpenAPI 3.0 spec with all endpoints:

```yaml
openapi: 3.0.0
info:
  title: OwnYou Consumer Application API
  version: 1.0.0
  description: Complete API for OwnYou privacy-first personal AI

servers:
  - url: http://localhost:5000/api
    description: Development server
  - url: https://api.ownyou.app/api
    description: Production server

paths:
  # Authentication
  /auth/login:
    post:
      summary: Login with wallet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                wallet_address:
                  type: string
                signature:
                  type: string
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  refresh_token:
                    type: string
                  user_id:
                    type: string

  /auth/refresh:
    post:
      summary: Refresh access token
      # ... full spec

  # Missions
  /missions/create:
    post:
      summary: Create user-initiated mission
      # ... full spec

  /missions/{user_id}:
    get:
      summary: Get all missions for user
      parameters:
        - name: user_id
          in: path
          required: true
          schema:
            type: string
        - name: category
          in: query
          schema:
            type: string
            enum: [savings, ikigai, health]
        - name: state
          in: query
          schema:
            type: string
            enum: [pending, active, snoozed, completed, dismissed]
      responses:
        '200':
          description: List of mission cards
          content:
            application/json:
              schema:
                type: object
                properties:
                  missions:
                    type: array
                    items:
                      $ref: '#/components/schemas/MissionCard'

  /missions/{mission_id}/feedback:
    post:
      summary: Submit user feedback on mission
      # ... full spec

  # Wallet endpoints
  /wallet/{user_id}/balance:
  /wallet/{user_id}/transactions:
  /wallet/{user_id}/rewards:

  # Notification endpoints
  /notifications/{user_id}:
  /notifications/{user_id}/mark-read:
  /notifications/{user_id}/preferences:

  # Connection endpoints
  /connections/{user_id}:
  /connections/{user_id}/{source}/connect:
  /connections/{user_id}/{source}/disconnect:
  /connections/{user_id}/{source}/status:

  # Settings endpoints
  /settings/{user_id}:
  /settings/{user_id}/disclosure:
  /settings/{user_id}/privacy:

  # Profile endpoints
  /profile/{user_id}:
  /profile/{user_id}/ikigai:
  /profile/{user_id}/iab-classifications:

components:
  schemas:
    MissionCard:
      type: object
      properties:
        mission_id:
          type: string
        user_id:
          type: string
        thread_id:
          type: string
        card_type:
          type: string
        # ... all fields from Phase 1 models

    UserFeedback:
      type: object
      # ... from requirements

    # All other schemas from Phase 1 models
```

**Validation:**
- [ ] All endpoints from requirements documented
- [ ] All request/response schemas defined
- [ ] Authentication specified for protected endpoints
- [ ] Error responses documented (400, 401, 404, 500)
- [ ] Pagination specified for list endpoints
- [ ] Filtering/sorting parameters documented
- [ ] OpenAPI spec validates (use Swagger Editor)

### Deliverable 4: Self-Sovereign Authentication System

**Files:**
- `src/auth/wallet_auth.py`
- `src/auth/session.py`
- `src/auth/jwt_tokens.py`

**Goal:** Build authentication system that ALL components use.

**Use Skill:** `decentralized-consumer-app-authentication`

**Checklist:**

- [ ] Design wallet-based authentication flow
- [ ] Implement signature verification
- [ ] Implement JWT token generation/validation
- [ ] Implement session management
- [ ] Implement middleware for API protection
- [ ] Document authentication flow
- [ ] Write tests for auth system
- [ ] Integrate with OpenAPI spec (security schemes)

**Integration Points:**
- API Layer (Phase 4): ALL endpoints use this auth
- Mobile App (Phase 5): Uses this auth for login
- Dashboard (current): Migrate to use this auth

## Phase 1 Validation

Before declaring Phase 1 complete, verify:

**Contracts Complete:**
- [ ] All card type models defined (10+ types)
- [ ] All Store namespaces documented (30+ namespaces)
- [ ] All API endpoints specified (50+ endpoints)
- [ ] Authentication system working and tested

**Reviews Complete:**
- [ ] Stakeholder review of data models (catch missing fields)
- [ ] Developer review of Store schema (catch conflicts)
- [ ] API review with frontend team (catch missing endpoints)
- [ ] Security review of authentication

**Documentation Complete:**
- [ ] All models documented with docstrings
- [ ] Store schema has JSON schemas
- [ ] OpenAPI spec validates
- [ ] Authentication flow documented

**Tests Passing:**
- [ ] Model validation tests
- [ ] Store namespace tests
- [ ] API contract tests (using spec)
- [ ] Authentication tests

**Integration Tests:**
- [ ] Models serialize/deserialize correctly
- [ ] Store methods work with all namespaces
- [ ] API spec can generate client SDK
- [ ] Auth works with API endpoints

## Phase 1 → Phase 2 Handoff

**Phase 2 can start when:**
- ✅ All Phase 1 contracts defined and validated
- ✅ Teams can work against stable interfaces
- ✅ Changes to contracts go through review process

**What Phase 2 needs from Phase 1:**
- Data models to validate against
- Store namespaces to write to
- API contracts to implement
- Auth system to integrate

**Integration Points:**
- Phase 2 writes to Store using Phase 1 namespaces
- Phase 2 creates data matching Phase 1 models
- Phase 3 reads from Store using Phase 1 namespaces
- Phase 4 implements Phase 1 API contracts
- Phase 5 consumes Phase 1 API via generated SDK

## Common Phase 1 Mistakes

**❌ Don't:**
- Define only the models you're implementing now (define ALL)
- Skip namespaces for future phases (document ALL)
- Leave API endpoints vague (specify ALL)
- Build phase-specific auth (build ONE auth for all)
- Rush through reviews (cost of changes exponential after Phase 1)

**✅ Do:**
- Define complete models even for Phase 7 features
- Document every namespace any agent will ever use
- Specify every API endpoint the app will need
- Build authentication ALL components will use
- Get thorough reviews before declaring complete

## Reference

- Strategic Roadmap: `docs/plans/2025-01-04-ownyou-strategic-roadmap.md` (Phase 1 section)
- Requirements: `docs/Brainstorming/brainstorming_mission_agents/*OwnYou Consumer App Requirements.md`
- Architecture: `docs/plans/mission_agents_architecture.md`
- Store Schema Skill: Use `store-schema-design` skill for namespace work
- Auth Skill: Use `decentralized-consumer-app-authentication` for auth implementation
