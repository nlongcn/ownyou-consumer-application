# OwnYou Consumer Application - Strategic Development Roadmap

**Goal:** Build complete consumer application with minimal rework, clear separation of concerns, and seamless phase integration

**Strategy:** Horizontal layer approach - build each layer completely across all features, with clean interfaces between layers

**Date:** 2025-01-04

---

## Architectural Principles

### 1. **Separation of Concerns**
Each phase focuses on ONE horizontal layer:
- **Data Layer**: All sources → Unified Store
- **Agent Layer**: All agents → Mission Cards
- **API Layer**: All endpoints → REST contracts
- **UI Layer**: All components → User experience

### 2. **Clean Interfaces**
Define contracts FIRST, implement LATER:
- Data models (Pydantic)
- API contracts (OpenAPI spec)
- Store schema (all namespaces)
- Card types (all categories)

### 3. **Build Once, Use Everywhere**
No redundant work:
- Single authentication system (all components use it)
- Single Store (all agents read/write it)
- Single API layer (all UIs consume it)

### 4. **Independent Phases**
Each phase:
- Delivers complete value independently
- Sets up clean integration points for next phase
- Can be tested thoroughly before moving on
- Doesn't require rework when adding new phases

---

## Phase Overview

```
PHASE 1: Foundation & Contracts (2 weeks)
├─ Define all data models, API contracts, Store schema
├─ Authentication architecture
├─ Multi-source connector architecture
└─ OUTPUT: Complete contracts + working auth

PHASE 2: Data Layer (3 weeks)
├─ All data source connectors (email, calendar, financial, photos, health, social, browsing)
├─ IAB classification for all sources
├─ Store writers for all sources
└─ OUTPUT: Complete data ingestion pipeline

PHASE 3: Agent Layer (4 weeks)
├─ All mission agents (Shopping, Restaurant, Travel, Events, Bill, Health, etc.)
├─ All triggers (memory, schedule, user, external)
├─ Mission orchestrator with complete routing
└─ OUTPUT: All mission types generating cards

PHASE 4: API Layer (2 weeks)
├─ All REST endpoints (missions, feedback, wallet, notifications, connections, settings)
├─ Mission cards persistence (database)
├─ Feedback processing with LLM analysis
└─ OUTPUT: Complete API for frontend consumption

PHASE 5: UI Layer (4 weeks)
├─ React Native app with all screens
├─ All card components (Savings, Ikigai, Health)
├─ Navigation, Wallet, Notifications, Connections, Settings
└─ OUTPUT: Complete user experience

PHASE 6: SSO Integration (2 weeks)
├─ BBS+ pseudonymous IDs
├─ Publisher SSO SDK integration
├─ Selective disclosure
└─ OUTPUT: Advertising revenue integration

PHASE 7: Production & Polish (3 weeks)
├─ Real API integrations (replace all mocks)
├─ PostgreSQL migration (Store + persistence)
├─ Performance optimization
├─ Security audit
├─ Testing & QA
└─ OUTPUT: Production-ready system

TOTAL: ~20 weeks (~5 months)
```

---

## Phase 1: Foundation & Contracts (2 weeks)

### Goal
Define ALL contracts upfront so all phases work against stable interfaces. No rework later.

### Deliverables

#### 1.1 Data Models (Complete)
**File:** `src/models/complete_schema.py`

Define Pydantic models for:
- ✅ Base MissionCard (done)
- ✅ ShoppingCardData (done)
- 🆕 UtilityCardData (bill optimization)
- 🆕 ServicesCardData (financial services, insurance)
- 🆕 TravelCardData (hotels, flights, activities)
- 🆕 EventCardData (comedy, theater, sports)
- 🆕 RestaurantCardData (dining recommendations)
- 🆕 RecipeCardData (cooking suggestions)
- 🆕 ContentCardData (articles, videos, books)
- 🆕 HealthCardData (diagnostics, fitness)
- 🆕 UserProfile (complete user data model)
- 🆕 WalletTransaction
- 🆕 Notification
- 🆕 DataSourceConnection

**Why First:** Every other phase depends on these models. Define once, use everywhere.

#### 1.2 Store Schema (Complete)
**File:** `src/mission_agents/memory/store_schema.md`

Define ALL Store namespaces:

```python
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
    "shopping_history": "(ownyou.shopping_history, {user_id})",
    "financial_profile": "(ownyou.financial_profile, {user_id})",
    "utility_bills": "(ownyou.utility_bills, {user_id})",
    "subscriptions": "(ownyou.subscriptions, {user_id})",

    # Preferences
    "travel_preferences": "(ownyou.travel_preferences, {user_id})",
    "dining_preferences": "(ownyou.dining_preferences, {user_id})",
    "event_preferences": "(ownyou.event_preferences, {user_id})",
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
}
```

**Why First:** Prevents Store schema changes between phases. All agents write to known locations.

#### 1.3 API Contracts (Complete)
**File:** `docs/api/openapi.yaml`

Define OpenAPI spec for ALL endpoints:

```yaml
paths:
  # Authentication
  /api/auth/login:
  /api/auth/refresh:
  /api/auth/logout:

  # Missions
  /api/missions/create:
  /api/missions/{user_id}:
  /api/missions/{mission_id}:
  /api/missions/{mission_id}/feedback:
  /api/missions/{mission_id}/snooze:
  /api/missions/{mission_id}/dismiss:

  # Wallet
  /api/wallet/{user_id}/balance:
  /api/wallet/{user_id}/transactions:
  /api/wallet/{user_id}/rewards:

  # Notifications
  /api/notifications/{user_id}:
  /api/notifications/{user_id}/mark-read:
  /api/notifications/{user_id}/preferences:

  # Connections
  /api/connections/{user_id}:
  /api/connections/{user_id}/{source}/connect:
  /api/connections/{user_id}/{source}/disconnect:
  /api/connections/{user_id}/{source}/status:

  # Settings
  /api/settings/{user_id}:
  /api/settings/{user_id}/disclosure:
  /api/settings/{user_id}/privacy:

  # Profile
  /api/profile/{user_id}:
  /api/profile/{user_id}/ikigai:
```

**Why First:** Frontend and backend teams can work in parallel with stable contracts.

#### 1.4 Authentication System
**File:** `src/auth/`

Implement self-sovereign authentication:
- Wallet-based login
- Session management
- JWT token generation
- Multi-user support

**Use Skill:** `decentralized-consumer-app-authentication`

**Why First:** Every component needs auth. Build once, integrate everywhere.

#### 1.5 Multi-Source Connector Architecture
**File:** `src/data_sources/base.py`

Define abstract base for ALL data sources:

```python
class DataSourceConnector(ABC):
    """Base class for all data source connectors"""

    @abstractmethod
    def authenticate(self, credentials: Dict) -> AuthToken:
        """OAuth or API key authentication"""
        pass

    @abstractmethod
    def fetch_data(self, since: datetime) -> List[DataItem]:
        """Fetch new data since timestamp"""
        pass

    @abstractmethod
    def preprocess(self, raw_data: List[DataItem]) -> List[ProcessedItem]:
        """Normalize data for IAB classification"""
        pass

    @abstractmethod
    def get_connection_status(self) -> ConnectionStatus:
        """Check if connection is healthy"""
        pass
```

**Why First:** Phase 2 implements this interface for each source. No rework needed.

### Integration Points for Next Phase

**Phase 1 → Phase 2:**
- ✅ Data models defined (Phase 2 uses them)
- ✅ Store schema defined (Phase 2 writes to it)
- ✅ Connector interface defined (Phase 2 implements it)
- ✅ Auth working (Phase 2 authenticates connections)

---

## Phase 2: Data Layer (3 weeks)

### Goal
Implement ALL data source connectors and IAB classification for all sources. Complete horizontal slice of data ingestion.

### Deliverables

#### 2.1 Email Connector (Existing - Enhance)
**Files:** `src/data_sources/email/`

- ✅ Gmail connector (done)
- ✅ Outlook connector (done)
- 🆕 Write to Store (not just SQLite)
- 🆕 Use Phase 1 auth system
- 🆕 Connection status monitoring

#### 2.2 Calendar Connector
**Files:** `src/data_sources/calendar/`

Implement:
- Google Calendar API
- Outlook Calendar API
- Event extraction
- IAB classification (Events → IAB17 Sports, IAB20 Travel, etc.)
- Write to Store: `calendar_events` namespace

#### 2.3 Financial Connector (PLAID)
**Files:** `src/data_sources/financial/`

Implement:
- PLAID integration (decentralized via Chainlink - see requirements)
- Transaction extraction
- IAB classification (Transactions → purchase intent, financial profile)
- Write to Store: `financial_transactions`, `financial_profile` namespaces

**Critical:** Follow Requirements Section 5.1 PLAID integration guide

#### 2.4 Photos Connector
**Files:** `src/data_sources/photos/`

Implement:
- Apple Photos API / Google Photos API
- Image analysis (vision models)
- IAB classification (Photos → interests, activities)
- Write to Store: `ikigai_interests` namespace

#### 2.5 Location Connector
**Files:** `src/data_sources/location/`

Implement:
- iOS Location Services / Android Location API
- Location history extraction
- IAB classification (Locations → travel patterns, dining habits)
- Write to Store: `location_history`, `travel_preferences` namespaces

#### 2.6 Health Connector
**Files:** `src/data_sources/health/`

Implement:
- Apple Health / Google Fit integration
- Health metrics extraction
- IAB classification (Health → IAB7 Health & Fitness)
- Write to Store: `health_profile`, `fitness_goals` namespaces

#### 2.7 Social Media Connector
**Files:** `src/data_sources/social/`

Implement:
- Facebook/Instagram/Twitter APIs
- Post/interaction extraction
- IAB classification (Social → interests, events, shopping)
- Write to Store: `ikigai_interests`, `event_preferences` namespaces

#### 2.8 Browsing History Connector
**Files:** `src/data_sources/browsing/`

Implement:
- Chrome Extension / Browser API
- URL history extraction
- IAB classification (Browsing → interests, shopping intent)
- Write to Store: `browsing_history`, `shopping_list` namespaces

#### 2.9 Unified IAB Classification Pipeline
**Files:** `src/data_sources/iab_classifier.py`

Enhance existing IAB workflow to:
- Accept ANY data source (email, calendar, financial, etc.)
- Batch process across sources
- Write classifications to Store
- Update confidence scores with multi-source evidence

### Integration Points for Next Phase

**Phase 2 → Phase 3:**
- ✅ All data sources writing to Store (Phase 3 reads from it)
- ✅ IAB classifications complete (Phase 3 uses them as triggers)
- ✅ Multi-source evidence (Phase 3 has rich context)
- ✅ Store fully populated (Phase 3 agents query it)

---

## Phase 3: Agent Layer (4 weeks)

### Goal
Implement ALL mission agents as independent modules. Complete horizontal slice of mission generation.

### Deliverables

#### 3.1 Shopping Agent (Existing - Enhance)
**Files:** `src/mission_agents/agents/shopping/`

- ✅ Level 1 simple pattern (done)
- 🆕 Use multi-source context (calendar for gift shopping, financial for budget)
- 🆕 Real API integration (SerpAPI, Amazon)

#### 3.2 Bill Agent (Level 1 Simple)
**Files:** `src/mission_agents/agents/bill/`

Implement:
- Utility bill analysis
- Switching recommendations
- API: Energy comparison APIs
- Triggers: Financial transactions, calendar (renewal dates)
- Card type: UtilityCardData

#### 3.3 Services Agent (Level 1 Simple)
**Files:** `src/mission_agents/agents/services/`

Implement:
- Financial services optimization (insurance, banking)
- Comparison and recommendations
- API: Financial comparison APIs
- Triggers: Financial profile changes
- Card type: ServicesCardData

#### 3.4 Restaurant Agent (Level 2 Coordinated)
**Files:** `src/mission_agents/agents/restaurant/`

Implement:
- Multi-API coordination (Tripadvisor, Google, Yelp)
- Dining recommendations
- Reservation booking
- Triggers: Calendar events, location, dining preferences
- Card type: RestaurantCardData

#### 3.5 Travel Agent (Level 3 Complex)
**Files:** `src/mission_agents/agents/travel/`

Implement:
- Hierarchical planning (supervisor → flights/hotels/activities coordinators)
- Multi-round refinement
- API: Tripadvisor, Google Hotels, flight APIs
- Triggers: Calendar gaps, ikigai profile, travel preferences
- Card type: TravelCardData

#### 3.6 Event Agent (Level 2 Coordinated)
**Files:** `src/mission_agents/agents/event/`

Implement:
- Event discovery (comedy, theater, sports, concerts)
- Ticket availability checking
- API: Data Thistle, Ticketmaster
- Triggers: Ikigai interests, calendar, location
- Card type: EventCardData

#### 3.7 Cooking Agent (Level 1 Simple)
**Files:** `src/mission_agents/agents/cooking/`

Implement:
- Recipe recommendations
- Ingredient shopping lists
- API: TheMealDB
- Triggers: Dining preferences, recent restaurant visits
- Card type: RecipeCardData

#### 3.8 Content Agent (Level 1 Simple)
**Files:** `src/mission_agents/agents/content/`

Implement:
- Article/video/book recommendations
- Content discovery
- API: News APIs, YouTube, Goodreads
- Triggers: Ikigai interests, browsing history
- Card type: ContentCardData

#### 3.9 Health Agent (Level 2 Coordinated)
**Files:** `src/mission_agents/agents/health/`

Implement:
- Diagnostic suggestions
- Fitness recommendations
- API: Health APIs (symptom checkers, fitness)
- Triggers: Health profile changes, fitness goals
- Card type: HealthCardData

#### 3.10 Complete Trigger System
**Files:** `src/mission_agents/triggers/`

Implement:
- ✅ Memory Change Trigger (done)
- ✅ User-Initiated Trigger (done)
- 🆕 Schedule Trigger (cron-based)
- 🆕 External Event Trigger (webhooks for calendar, email, social)

#### 3.11 Mission Orchestrator Enhancement
**Files:** `src/mission_agents/orchestrator.py`

Update to:
- Route all mission types (not just shopping)
- Priority handling across all triggers
- Complexity-based routing (Level 1/2/3)
- Multi-agent coordination

### Integration Points for Next Phase

**Phase 3 → Phase 4:**
- ✅ All agents generating mission cards (Phase 4 persists them)
- ✅ Card data matches Phase 1 models (Phase 4 validates them)
- ✅ Orchestrator routing complete (Phase 4 exposes via API)
- ✅ Mission lifecycle working (Phase 4 manages state)

---

## Phase 4: API Layer (2 weeks)

### Goal
Implement ALL REST endpoints as thin layer over Phase 3 agents. Complete horizontal slice of backend API.

### Deliverables

#### 4.1 Mission Cards Database
**Files:** `src/database/mission_cards.py`

Create persistence layer:
```sql
CREATE TABLE mission_cards (
    mission_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    card_type VARCHAR(50),
    agent_type VARCHAR(50),
    category VARCHAR(20),
    complexity_level INT,
    state VARCHAR(20),
    trigger_type VARCHAR(50),
    trigger_details JSONB,
    memory_context JSONB,
    card_data JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_state (state),
    INDEX idx_category (category)
);
```

#### 4.2 Mission CRUD Endpoints
**Files:** `dashboard/backend/routes/missions.py`

Implement (using Phase 1 OpenAPI contracts):
- POST `/api/missions/create` (user-initiated)
- GET `/api/missions/{user_id}` (all missions)
- GET `/api/missions/{user_id}?category=savings` (filtered)
- GET `/api/missions/{mission_id}` (single mission)
- DELETE `/api/missions/{mission_id}` (dismiss)

#### 4.3 Feedback Processing
**Files:** `dashboard/backend/routes/feedback.py`

Implement:
- POST `/api/missions/{mission_id}/feedback`
- LLM analysis of qualitative feedback
- Preference extraction → Store updates
- Mission refinement triggering

#### 4.4 Wallet Endpoints
**Files:** `dashboard/backend/routes/wallet.py`

Implement:
- GET `/api/wallet/{user_id}/balance`
- GET `/api/wallet/{user_id}/transactions`
- GET `/api/wallet/{user_id}/rewards`
- POST `/api/wallet/{user_id}/withdraw`

#### 4.5 Notifications Endpoints
**Files:** `dashboard/backend/routes/notifications.py`

Implement:
- GET `/api/notifications/{user_id}`
- POST `/api/notifications/{user_id}/mark-read`
- PUT `/api/notifications/{user_id}/preferences`

#### 4.6 Connections Endpoints
**Files:** `dashboard/backend/routes/connections.py`

Implement:
- GET `/api/connections/{user_id}` (all sources)
- POST `/api/connections/{user_id}/{source}/connect` (OAuth flow)
- DELETE `/api/connections/{user_id}/{source}/disconnect`
- GET `/api/connections/{user_id}/{source}/status`

#### 4.7 Settings Endpoints
**Files:** `dashboard/backend/routes/settings.py`

Implement:
- GET/PUT `/api/settings/{user_id}`
- GET/PUT `/api/settings/{user_id}/disclosure`
- GET/PUT `/api/settings/{user_id}/privacy`

#### 4.8 Profile Endpoints
**Files:** `dashboard/backend/routes/profile.py`

Implement:
- GET/PUT `/api/profile/{user_id}`
- GET/PUT `/api/profile/{user_id}/ikigai`
- GET `/api/profile/{user_id}/iab-classifications`

### Integration Points for Next Phase

**Phase 4 → Phase 5:**
- ✅ All API endpoints working (Phase 5 consumes them)
- ✅ Matches Phase 1 OpenAPI spec (Phase 5 SDK auto-generated)
- ✅ Authentication integrated (Phase 5 uses tokens)
- ✅ Real-time updates via WebSocket (Phase 5 subscribes)

---

## Phase 5: UI Layer (4 weeks)

### Goal
Implement complete React Native app using Phase 4 API. Complete horizontal slice of user experience.

### Deliverables

#### 5.1 React Native Setup
**Files:** `mobile_app/`

Setup:
- React Native project structure
- Navigation library (React Navigation)
- State management (Redux or Zustand)
- API client (generated from Phase 1 OpenAPI spec)
- Authentication integration

#### 5.2 Main Navigation
**Files:** `mobile_app/src/navigation/`

Implement:
- Tab navigation (All / Savings / Ikigai / Health)
- Floating menu (Missions / Wallet / Notifications / Connections / Settings)
- Deep linking support

#### 5.3 Mission Cards Components
**Files:** `mobile_app/src/components/cards/`

Implement card components for:
- SavingsShoppingCard
- SavingsUtilityCard
- SavingsServicesCard
- IkigaiTravelCard
- IkigaiEventCard (comedy, theater)
- IkigaiRestaurantCard
- IkigaiRecipeCard
- IkigaiContentCard
- HealthCard

Match Figma designs exactly.

#### 5.4 Mission Cards Feed
**Files:** `mobile_app/src/screens/MissionsFeed.tsx`

Implement:
- Infinite scroll card feed
- Filter by category (All/Savings/Ikigai/Health)
- Pull-to-refresh
- Quick feedback (swipe gestures for like/dislike/snooze)
- Card state visualization (pending/active/snoozed/completed)

#### 5.5 Mission Detail Screen
**Files:** `mobile_app/src/screens/MissionDetail.tsx`

Implement:
- Full card details
- All card-specific fields
- Action buttons (purchase, book, dismiss)
- Feedback form (structured + qualitative text)
- Thread history (refinement cycles)

#### 5.6 Wallet Screen
**Files:** `mobile_app/src/screens/Wallet.tsx`

Implement:
- Token balance display
- Rewards summary (by period)
- Transaction history
- Withdrawal functionality

#### 5.7 Notifications Screen
**Files:** `mobile_app/src/screens/Notifications.tsx`

Implement:
- Notification stream
- Mission updates
- Tracking alerts
- Mark as read
- Notification preferences

#### 5.8 Connections Screen
**Files:** `mobile_app/src/screens/Connections.tsx`

Implement:
- Data sources list (email, calendar, financial, etc.)
- Connection status indicators
- OAuth flow for each source
- Disconnect functionality

#### 5.9 Settings Screen
**Files:** `mobile_app/src/screens/Settings.tsx`

Implement:
- App settings
- Disclosure preferences
- Privacy controls
- Notification preferences
- Account management

#### 5.10 Profile Screen
**Files:** `mobile_app/src/screens/Profile.tsx`

Implement:
- User profile display
- Ikigai exploration
- IAB classifications view
- Profile editing

### Integration Points for Next Phase

**Phase 5 → Phase 6:**
- ✅ Complete UI working (Phase 6 adds SSO)
- ✅ Wallet integrated (Phase 6 adds token flows)
- ✅ User identity established (Phase 6 adds BBS+ pseudonyms)

---

## Phase 6: SSO Integration (2 weeks)

### Goal
Add BBS+ pseudonymous IDs and Publisher SSO SDK for advertising revenue.

### Deliverables

#### 6.1 BBS+ Credential Management
**Files:** `src/sso/bbs_credentials.py`

Implement:
- BBS+ signature generation
- Pseudonymous ID creation
- Selective disclosure proofs
- Credential storage (encrypted)

**Reference:** `docs/Brainstorming/brainstorming_mission_agents/*OwnYou Consumer App Requirements` Section on BBS+ Pseudonyms

#### 6.2 Publisher SSO SDK
**Files:** `src/sso/publisher_sdk.py`

Implement:
- IAB profile exposure
- Selective disclosure (user-controlled)
- Header bidding integration
- Tracking consent management

#### 6.3 Wallet Token Flows
**Files:** `src/wallet/token_flows.py`

Implement:
- Token rewards from tracking
- Token distribution logic
- Blockchain integration
- Transaction recording

#### 6.4 Tracking Notifications
**Files:** `mobile_app/src/screens/Tracking.tsx`

Implement:
- Active tracking display
- Earnings visualization
- Stop tracking option
- Advertiser disclosure

### Integration Points for Next Phase

**Phase 6 → Phase 7:**
- ✅ SSO working (Phase 7 stress tests)
- ✅ Revenue flowing (Phase 7 optimizes)
- ✅ Privacy maintained (Phase 7 audits)

---

## Phase 7: Production & Polish (3 weeks)

### Goal
Replace all mocks, migrate to production infrastructure, optimize, test, and deploy.

### Deliverables

#### 7.1 Real API Integrations
Replace all mocks:
- Shopping APIs (SerpAPI, Amazon Rainforest API)
- Travel APIs (Tripadvisor, Google Hotels)
- Event APIs (Data Thistle)
- Restaurant APIs (Tripadvisor, Yelp)
- Recipe APIs (TheMealDB)
- Financial APIs (PLAID production)
- All other external APIs

#### 7.2 PostgreSQL Migration
**Files:** `src/mission_agents/memory/store.py`

Migrate from InMemoryStore to PostgreSQL-backed Store:
```python
from langgraph.store.postgres import PostgresStore

store = PostgresStore.from_conn_string(os.getenv("DATABASE_URL"))
```

Setup:
- PostgreSQL database
- Store schema
- Checkpointer tables
- Indexes for performance

#### 7.3 Performance Optimization
- API response caching
- Store query optimization
- Agent execution parallelization
- Database indexing
- Frontend bundle optimization

#### 7.4 Security Audit
- Authentication security review
- API endpoint authorization
- Store access controls
- Encryption at rest/in transit
- OWASP top 10 validation
- Privacy compliance (GDPR)

#### 7.5 Testing & QA
- Complete test coverage (unit + integration + E2E)
- Load testing (1000+ concurrent users)
- Security testing (penetration testing)
- Accessibility testing (WCAG 2.1)
- Cross-device testing (iOS/Android, various screen sizes)
- Beta testing with real users

#### 7.6 Monitoring & Observability
- Logging infrastructure (centralized logs)
- Error tracking (Sentry)
- Performance monitoring (APM)
- User analytics (privacy-preserving)
- Alert system (PagerDuty)

#### 7.7 Deployment
- CI/CD pipeline
- Staging environment
- Production environment
- Database backups
- Disaster recovery plan
- App Store submission (iOS + Android)

---

## Critical Path Analysis

### Dependencies
```
Phase 1 → Phase 2, 3, 4, 5 (all depend on contracts)
Phase 2 → Phase 3 (agents need data)
Phase 3 → Phase 4 (API needs mission cards)
Phase 4 → Phase 5 (UI needs API)
Phase 5 → Phase 6 (SSO integrates with UI)
Phase 6 → Phase 7 (production needs complete system)
```

### Parallel Work Opportunities
- **Phase 1 complete:** All phases can start in parallel
  - Data team → Phase 2
  - Agent team → Phase 3
  - API team → Phase 4
  - UI team → Phase 5
  - SSO team → Phase 6

- **Why this works:** Clean interfaces from Phase 1 prevent blocking

### Minimum Viable Product (MVP) Checkpoints

**MVP 1: Data Foundation (Phase 1 + 2)**
- Authentication working
- All data sources connected
- IAB classifications complete
- Store fully populated

**MVP 2: Mission Generation (+ Phase 3)**
- All mission agents working
- Cards being generated
- Complete mission lifecycle

**MVP 3: API Complete (+ Phase 4)**
- REST API working
- Mission cards persisted
- Feedback processing active

**MVP 4: User Experience (+ Phase 5)**
- Mobile app working
- All screens implemented
- End-to-end user flow

**MVP 5: Revenue Integration (+ Phase 6)**
- SSO working
- Token rewards flowing
- Advertising integrated

**Production: (+ Phase 7)**
- All mocks replaced
- Performance optimized
- Security audited
- Deployed to stores

---

## Risk Mitigation

### Technical Risks

**Risk:** Phase 1 contracts change during development
**Mitigation:** Comprehensive review with all stakeholders before starting Phase 2

**Risk:** Store schema insufficient for agent needs
**Mitigation:** Design with extensibility (JSONB fields for flexibility)

**Risk:** External API rate limits
**Mitigation:** Implement caching, batch requests, fallback APIs

**Risk:** Performance issues with Store at scale
**Mitigation:** PostgreSQL indexing, query optimization, caching layer

### Integration Risks

**Risk:** Phases don't integrate cleanly
**Mitigation:** Integration tests at each phase boundary, contracts validated early

**Risk:** UI doesn't match API capabilities
**Mitigation:** Frontend mock API from OpenAPI spec in Phase 1

**Risk:** Authentication doesn't work across all components
**Mitigation:** Build and test auth first (Phase 1), integrate everywhere

### Schedule Risks

**Risk:** Phase takes longer than estimated
**Mitigation:** Each phase delivers independently, later phases can continue in parallel

**Risk:** Parallel work creates merge conflicts
**Mitigation:** Clean separation of concerns, minimal shared code

---

## Success Criteria

### Phase Completion Criteria

**Phase 1:** ✅ All contracts defined, auth working, tests passing
**Phase 2:** ✅ All data sources writing to Store, IAB classifications working
**Phase 3:** ✅ All agents generating cards, orchestrator routing working
**Phase 4:** ✅ All API endpoints working, mission cards persisted
**Phase 5:** ✅ Mobile app working, all screens functional
**Phase 6:** ✅ SSO integrated, tokens flowing
**Phase 7:** ✅ Production deployed, users onboarded

### Overall Success Criteria

✅ **Technical:**
- All data sources ingesting data
- All mission agents generating cards
- All API endpoints working
- Mobile app deployed to stores
- SSO integrated with advertisers

✅ **User Experience:**
- Users can connect all data sources
- Users receive personalized mission cards
- Users can complete missions
- Users earn token rewards
- <5 second app launch time

✅ **Business:**
- Revenue from advertising flowing
- User retention >30% (monthly active)
- Mission completion rate >40%
- Privacy maintained (zero data breaches)

---

## Timeline Summary

| Phase | Duration | Team Size | Parallel Work |
|-------|----------|-----------|---------------|
| Phase 1: Foundation | 2 weeks | 2-3 | No (blocking) |
| Phase 2: Data Layer | 3 weeks | 3-4 | Yes (after Phase 1) |
| Phase 3: Agent Layer | 4 weeks | 3-4 | Yes (after Phase 1) |
| Phase 4: API Layer | 2 weeks | 2-3 | Yes (after Phase 1) |
| Phase 5: UI Layer | 4 weeks | 3-4 | Yes (after Phase 1) |
| Phase 6: SSO | 2 weeks | 2 | Yes (after Phase 5) |
| Phase 7: Production | 3 weeks | 4-5 | No (needs all) |

**Sequential:** ~20 weeks (~5 months)
**Parallel (optimal):** ~11 weeks (~2.75 months) with 10-15 person team

---

## Next Steps

1. **Review and Approve Roadmap** - Ensure all stakeholders agree on approach
2. **Create Phase 1 Detailed Plan** - Break down Phase 1 into tasks (using writing-plans skill)
3. **Assemble Teams** - Assign teams to each phase
4. **Start Phase 1** - Begin with contracts and authentication
5. **Prepare for Parallel Work** - Set up repositories, CI/CD for each phase

---

**Document Status:** Strategic Roadmap v1.0
**Date:** 2025-01-04
**Next Review:** After Phase 1 completion
