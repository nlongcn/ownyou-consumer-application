# End-to-End Architecture

**Date:** 2025-10-29 (Updated: 2025-01-04)
**Status:** Section 3 Completed
**Authors:** Nicholas Longcroft, Claude Code

---

## Executive Summary

This document outlines the end-to-end architecture for the OwnYou consumer application ecosystem, including:
- Mission Memory as single source of truth
- IAB Classification Agents (existing, to be extended)
- Mission Agents (new, to be designed)
- Mission Card data model (validated)
- Integration with SSO SDK and consumer application

**Validated:**
- ✅ Section 1: System architecture with multi-source data connectors
- ✅ Section 2: Extensible mission card data model framework

**Completed:**
- ✅ Section 3: Mission agent architecture (see `docs/plans/mission_agents_architecture.md`)

**Pending:**
- ⏸️ Section 4: Multi-source data connector extension strategy
- ⏸️ Section 5: Integration strategy (IAB + Mission + SSO + App)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Mission Card Data Model](#2-mission-card-data-model)
3. [Mission Agent Architecture Approaches](#3-mission-agent-architecture-approaches)
4. [Open Questions & Next Steps](#4-open-questions--next-steps)

---

## 1. System Architecture Overview

### 1.1 Core Principle: Mission Memory as Single Source of Truth

OwnYou's architecture centers on **Mission Memory** - a unified memory system that serves both IAB Classification Agents (for advertising) and Mission Agents (for consumer utility).

```
Raw Personal Data Sources
├── Emails (Gmail/Outlook) ✓ WORKING
├── Calendar (Google/Outlook) → TO ADD
├── Financial (Plaid/bank) → TO ADD
├── Photos → TO ADD
├── Location → TO ADD
└── Health → TO ADD
          ↓
   [Data Connectors + Preprocessing] ← EXTEND existing
          ↓
┌─────────────────────────────────────────────────────────────┐
│           MISSION MEMORY (SQLite - Single Source)           │
│                                                              │
│  Semantic Memories (STATEFUL):                              │
│   - IAB Classifications (confidence evolves with evidence)  │
│   - OwnYou Classifications (Ikigai, shopping list, prefs)   │
│   - Time decay, evidence tracking                           │
│                                                              │
│  Episodic Memories:                                         │
│   - Email processing events ✓ WORKING                       │
│   - Calendar events → TO ADD                                │
│   - Financial transactions → TO ADD                         │
│   - User actions/feedback on mission cards → TO ADD         │
│   - Mission state changes → TO ADD                          │
└──────────────┬────────────────────────────────┬─────────────┘
               │ READ/WRITE                     │ READ/WRITE
               ↓                                ↓
      ┌────────────────────┐          ┌──────────────────────┐
      │  IAB EXTRACTOR     │          │  MISSION AGENTS      │
      │                    │          │                      │
      │  ✓ WORKING:        │          │  NEW - To Design:    │
      │  - Emails          │          │  - Query memory      │
      │                    │          │  - External APIs     │
      │  → TO EXTEND:      │          │  - Create missions   │
      │  - Calendar        │          │  - Generate cards    │
      │  - Financial       │          │  - Manage state      │
      │  - Other sources   │          │                      │
      │                    │          │  → ALSO PROCESS:     │
      │  LangGraph agents  │          │  - Calendar          │
      │  Batch processing  │          │  - Financial         │
      │  Evidence judge    │          │  - Other sources     │
      │  Reconciliation    │          │                      │
      │                    │          │                      │
      │  Writes: Updates   │          │  Writes: Updates     │
      │          semantic  │          │          semantic +  │
      │          memories  │          │          episodic    │
      │                    │          │          memories    │
      │  Output:           │          │                      │
      │  IAB PROFILE       │          │  Output:             │
      │  (for ads)         │          │  MISSION CARDS       │
      └────────┬───────────┘          └──────────┬───────────┘
               │                                 │
               ↓                                 ↓
    ┌──────────────────────┐       ┌───────────────────────┐
    │ PUBLISHER SSO SDK    │       │ FIGMA CONSUMER APP    │
    │ (External - To build)│       │ (User UI - To build)  │
    │                      │       │                       │
    │ - BBS+ pseudonyms    │       │ - Mission cards UI    │
    │ - Selective          │       │ - User actions (like/ │
    │   disclosure         │       │   snooze/buy/feedback)│
    │ - Header bidding     │       │                       │
    └──────────────────────┘       └───────────┬───────────┘
                                               │
                                               │ User Feedback
                                               ↓
                                       (Updates Mission Memory)
```

**Dashboard = Dev Tool for BOTH IAB Agents AND Mission Agents**

### 1.2 Key Architectural Decisions

**Decision 1: IAB Classifications are STATEFUL**
- Confidence scores evolve with confirming/contradicting evidence
- Time decay applies
- Evidence tracking (supporting/contradicting source IDs)
- NOT stateless batch processing

**Decision 2: IAB End Game = IAB Profile (not just classifications)**
- IAB Extractor produces complete profile for advertisers
- Profile exposed via Publisher SSO SDK
- BBS+ pseudonyms for selective disclosure

**Decision 3: Mission End Game = Mission Cards → Figma App**
- Mission Agents produce actionable mission cards
- Cards displayed in Figma-designed React Native app
- User feedback loop updates Mission Memory

**Decision 4: Both Systems Share Mission Memory**
- IAB agents READ memory (existing profile) + WRITE (update classifications)
- Mission agents READ memory (semantic + episodic) + WRITE (mission state, user feedback)
- Single source of truth prevents data inconsistency

**Decision 5: Multi-Source Data Processing**
- Current: Email processing only (working)
- Priority: Email → Calendar → Financial (decentralized via Plaid)
- Both IAB and Mission agents will process all sources

### 1.3 IAB Agents vs Mission Agents: Key Differences

| Aspect | IAB Classification Agents | Mission Agents |
|--------|--------------------------|----------------|
| **Purpose** | Build advertiser profile (IAB Taxonomy) | Create actionable user missions |
| **Output Space** | Fixed (600+ discrete taxonomy IDs) | Open-ended (varies by mission type) |
| **Architecture** | LangGraph + ReAct + Evidence Judge (proven) | **To be designed (Section 3)** |
| **Data Sources** | Currently emails; extend to calendar, financial | Same multi-source extension |
| **External APIs** | None | Many (shopping, travel, events, restaurants) |
| **State** | Stateful (confidence evolves) | Stateful (missions with refinement cycles) |
| **User Interaction** | None (backend only) | Direct feedback loop (like/dislike/qualitative) |
| **Trigger Model** | Batch processing (new data arrives) | Event-driven (memory changes, user actions, time) |
| **UI** | Dashboard (dev tool) | Figma consumer app (production UI) |

---

## 2. Mission Card Data Model

### 2.1 Design Principles

1. **Extensible Framework** - Easy to add new card types without changing base schema
2. **Polymorphic card_data** - Card-specific fields defined per type
3. **Universal State Machine** - All cards use same state transitions
4. **Memory Provenance** - All cards track what triggered them
5. **Refinement Cycles** - Support user feedback → agent updates → new card version

### 2.2 Base Mission Card Schema

```python
from typing import Union, Literal, Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

# ============================================================================
# ENUMS
# ============================================================================

class CardCategory(str, Enum):
    SAVINGS = "savings"
    IKIGAI = "ikigai"
    HEALTH = "health"

class MissionState(str, Enum):
    PENDING = "pending"       # Created, not yet shown to user
    ACTIVE = "active"         # Displayed to user
    SNOOZED = "snoozed"      # User snoozed temporarily
    COMPLETED = "completed"   # Terminal: mission accomplished
    DISMISSED = "dismissed"   # Terminal: user not interested

class TriggerType(str, Enum):
    IAB_PROFILE_CHANGE = "iab_profile_change"          # IAB classification updated
    MISSION_PROFILE_CHANGE = "mission_profile_change"  # Mission memory (Ikigai, shopping list) updated
    EPISODIC_EVENT = "episodic_event"                  # Purchase made, event scheduled
    USER_REQUEST = "user_request"                      # User explicitly asked
    SCHEDULED_CHECK = "scheduled_check"                # Agent periodic check
    EXTERNAL_API = "external_api"                      # External event (price drop alert)

class UserFeedback(str, Enum):
    LIKE = "like"
    DISLIKE = "dislike"
    SNOOZE = "snooze"
    QUALITATIVE = "qualitative"  # User provided text feedback (refinement)

# ============================================================================
# STATE & ACTION TRACKING
# ============================================================================

class StateTransition(BaseModel):
    """Track state changes over mission lifecycle"""
    from_state: MissionState
    to_state: MissionState
    timestamp: datetime
    trigger: Literal["user_action", "time_expiry", "external_event", "agent_update"]
    details: Optional[str] = None

class UserAction(BaseModel):
    """Track all user interactions with card"""
    action_type: Literal["like", "dislike", "snooze", "click_link", "click_cta",
                        "qualitative_feedback", "complete_mission", "view_card"]
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None

class QualitativeFeedback(BaseModel):
    """
    User text feedback for mission refinement.

    Examples:
    - "only in size 10"
    - "black not white"
    - "I want to go to Spain not Italy"
    - "under £100"
    """
    feedback_text: str
    timestamp: datetime
    processed: bool = False  # Has agent processed this feedback?
    agent_response: Optional[str] = None

# ============================================================================
# BASE MISSION CARD
# ============================================================================

class MissionCard(BaseModel):
    """
    Base schema for all mission cards.

    Card-specific fields go in card_data (polymorphic).
    To add new card type: create new CardData class, register it.
    """

    # ======== IDENTITY ========
    mission_id: str = Field(..., description="Unique ID: mission_{agent}_{timestamp}_{uuid}")
    user_id: str

    # ======== CLASSIFICATION ========
    card_type: str = Field(..., description="e.g., 'savings_shopping', 'ikigai_travel'")
    agent_type: str = Field(..., description="Agent that created this: 'shopping_agent', 'travel_agent'")
    category: CardCategory
    complexity_level: Literal[1, 2, 3] = Field(
        ...,
        description="Mission complexity: 1=Simple, 2=Coordinated, 3=Complex"
    )

    # ======== THREAD TRACKING (for pause/resume capability) ========
    thread_id: str = Field(..., description="LangGraph thread ID for mission execution")
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Current checkpoint ID (updated as mission progresses)"
    )

    # ======== STATE MANAGEMENT ========
    state: MissionState = MissionState.PENDING
    state_history: List[StateTransition] = Field(default_factory=list)

    # ======== TEMPORAL ========
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None  # For time-sensitive missions
    snoozed_until: Optional[datetime] = None

    # ======== VERSIONING (for refinement cycles) ========
    mission_version: str = Field(
        default="1.0",
        description="Mission version: 1.0 (initial), 2.0 (after user feedback), etc."
    )
    parent_mission_id: Optional[str] = Field(
        default=None,
        description="If this is a refined version, link to original mission"
    )

    # ======== MEMORY PROVENANCE ========
    trigger_type: TriggerType
    trigger_details: Dict[str, Any] = Field(
        ...,
        description="What caused this mission?"
    )
    memory_context: Dict[str, Any] = Field(
        ...,
        description="Relevant memories used by agent (semantic + episodic)"
    )

    # ======== USER INTERACTION ========
    user_feedback: Optional[UserFeedback] = None
    user_actions: List[UserAction] = Field(default_factory=list)
    feedback_count: Dict[str, int] = Field(
        default_factory=lambda: {
            "like": 0,
            "dislike": 0,
            "snooze": 0,
            "qualitative": 0
        }
    )
    qualitative_feedback: List[QualitativeFeedback] = Field(
        default_factory=list,
        description="User refinement feedback"
    )

    # ======== AGENT REASONING ========
    reasoning: str = Field(..., description="Agent explanation shown to user")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Agent confidence")

    # ======== PRIORITY/RANKING ========
    priority_score: float = Field(default=0.5, description="For sorting cards in feed")
    relevance_score: float = Field(default=0.5, description="Memory alignment score")

    # ======== CARD-SPECIFIC DATA (POLYMORPHIC) ========
    card_data: Dict[str, Any] = Field(
        ...,
        description="Card-type-specific fields. Structure defined by card_type."
    )

    # ======== METADATA ========
    schema_version: str = Field(
        default="1.0",
        description="Data model schema version (for migrations)"
    )

# ============================================================================
# STATE MACHINE - Universal for all cards
# ============================================================================

STATE_TRANSITIONS = {
    MissionState.PENDING: [MissionState.ACTIVE, MissionState.DISMISSED],
    MissionState.ACTIVE: [MissionState.SNOOZED, MissionState.COMPLETED, MissionState.DISMISSED],
    MissionState.SNOOZED: [MissionState.ACTIVE, MissionState.DISMISSED],
    MissionState.COMPLETED: [],  # Terminal
    MissionState.DISMISSED: []   # Terminal
}

def validate_state_transition(current: MissionState, next: MissionState) -> bool:
    """Validate if state transition is allowed"""
    return next in STATE_TRANSITIONS[current]
```

### 2.3 Example Card Types

#### 2.3.1 Savings Shopping Card

```python
class SavingsShoppingCardData(BaseModel):
    """Card-specific fields for savings_shopping cards"""

    # Product
    product_name: str
    brand: str
    brand_logo_url: Optional[str] = None
    product_image_url: str
    product_url: str  # Retailer link (may be affiliate)

    # Pricing
    current_price: Decimal
    original_price: Optional[Decimal] = None
    discount_percentage: Optional[float] = None
    currency: str = "GBP"

    # Retailer
    retailer_name: str
    retailer_logo_url: Optional[str] = None

    # Product Options (for refinement cycles)
    available_options: Optional[Dict[str, List[str]]] = None  # {"color": [...], "size": [...]}
    selected_options: Optional[Dict[str, str]] = None
    user_questions: Optional[List[str]] = None
```

**Figma Card Fields Captured:**
- ✅ Brand logo (brand_logo_url)
- ✅ Product image (product_image_url)
- ✅ Product name (product_name)
- ✅ Current price, original price (current_price, original_price)
- ✅ Reasoning text (base schema: reasoning)
- ✅ Like/dislike buttons (base schema: user_feedback)

#### 2.3.2 Ikigai Travel Card

```python
class IkigaiTravelCardData(BaseModel):
    """Card-specific fields for ikigai_travel cards"""

    # Property
    property_name: str
    property_type: Literal["hotel", "villa", "apartment", "resort"]
    description: str
    hero_image_url: str
    additional_images: List[str] = Field(default_factory=list)

    # Location
    location: str  # "Amalfi Coast"
    destination: str  # "Italy"
    coordinates: Optional[Dict[str, float]] = None

    # Booking Platform
    platform_name: str  # "Booking.com"
    platform_logo_url: str
    booking_url: str

    # Pricing
    price_per_night: Decimal
    ownyou_discount: Optional[Decimal] = None
    discounted_price_per_night: Decimal
    currency: str = "GBP"

    # Stay Details
    nights: int
    check_in_date: date
    check_out_date: date
    total_cost: Decimal

    # Additional
    amenities: List[str] = Field(default_factory=list)
    rating: Optional[float] = None
    reviews_count: Optional[int] = None

    # Ikigai Alignment
    ikigai_alignment: Dict[str, Any] = Field(
        ...,
        description="Why this matches user's Ikigai"
    )
```

**Figma Card Fields Captured:**
- ✅ Hero image (hero_image_url)
- ✅ Booking platform logo (platform_logo_url)
- ✅ Property name, description (property_name, description)
- ✅ Location (location)
- ✅ Price per night, OwnYou discount (price_per_night, ownyou_discount)
- ✅ Nights, check-in/out dates (nights, check_in_date, check_out_date)
- ✅ Total cost (total_cost)
- ✅ Reserve CTA button (booking_url)
- ✅ Like/dislike buttons (base schema)

#### 2.3.3 Savings Utility Card

```python
class SupplierDetails(BaseModel):
    """Reusable supplier info"""
    name: str
    logo_url: Optional[str] = None
    standing_charge: Optional[Decimal] = None
    unit_rate_day: Optional[Decimal] = None
    unit_rate_night: Optional[Decimal] = None
    estimated_annual_cost: Decimal

class SavingsUtilityCardData(BaseModel):
    """Card-specific fields for savings_utility cards"""

    utility_type: Literal["electricity", "gas", "water", "broadband", "mobile"]
    icon: str  # Icon identifier for UI

    # Comparison
    current_supplier: SupplierDetails
    recommended_supplier: SupplierDetails

    # Savings
    annual_savings: Decimal
    monthly_savings: Decimal
    savings_percentage: float

    # Switching
    switch_url: str  # Link to switching service
    estimated_switch_time: str  # "3-4 weeks"
```

**Figma Card Fields Captured:**
- ✅ Category icon (icon)
- ✅ Current supplier comparison (current_supplier)
- ✅ Recommended supplier (recommended_supplier)
- ✅ Detailed pricing breakdown (SupplierDetails fields)
- ✅ Annual cost estimates (estimated_annual_cost)
- ✅ Savings calculation (annual_savings)
- ✅ Like/dislike buttons (base schema)

### 2.4 Mission Refinement Cycle Example

```python
# User sees shopping card for white dress
card_v1 = MissionCard(
    mission_id="mission_shopping_001",
    mission_version="1.0",
    reasoning="Your recent searches for white dresses made me think you might like this.",
    card_data={
        "product_name": "Jackie White Dress",
        "current_price": Decimal("147.50"),
        "available_options": {
            "color": ["white", "black"],
            "size": ["S", "M", "L", "XL"]
        }
    }
)

# User provides qualitative feedback: "black not white, only in size 10"
feedback = QualitativeFeedback(
    feedback_text="black not white, only in size 10",
    timestamp=datetime.now(),
    processed=False
)

# Agent processes feedback, creates refined mission
card_v2 = MissionCard(
    mission_id="mission_shopping_001_refined",
    mission_version="2.0",
    parent_mission_id="mission_shopping_001",
    reasoning="I found the Jackie dress in black, size 10 as you requested.",
    trigger_type=TriggerType.USER_REQUEST,
    trigger_details={
        "refinement_of": "mission_shopping_001",
        "feedback": "black not white, only in size 10"
    },
    card_data={
        "product_name": "Jackie Black Dress",
        "current_price": Decimal("147.50"),
        "selected_options": {"color": "black", "size": "10"}
    },
    qualitative_feedback=[
        QualitativeFeedback(
            feedback_text="black not white, only in size 10",
            timestamp=datetime.now(),
            processed=True,
            agent_response="Updated to black dress in size 10"
        )
    ]
)
```

### 2.5 How to Add New Card Types

```python
# Step 1: Define new card data schema
class IkigaiEventCardData(BaseModel):
    """New card type for events (comedy, theater, concerts)"""
    event_name: str
    event_type: Literal["comedy", "theater", "concert", "film", "festival"]
    venue_name: str
    venue_address: str
    event_date: datetime
    ticket_price: Decimal
    booking_url: str
    performer: str
    event_image_url: str
    reviews_rating: Optional[float] = None

# Step 2: Register in card type registry
CARD_TYPE_SCHEMAS = {
    "savings_shopping": SavingsShoppingCardData,
    "ikigai_travel": IkigaiTravelCardData,
    "savings_utility": SavingsUtilityCardData,
    "ikigai_event": IkigaiEventCardData,  # ← New type added
}

# Step 3: Agent can now create this card type
card = MissionCard(
    card_type="ikigai_event",
    agent_type="event_agent",
    category=CardCategory.IKIGAI,
    card_data=event_data.dict(),
    # ... rest of base fields
)
```

### 2.6 External API Research Checklist

**Before building each agent type, research relevant APIs to:**
1. Validate API supports required fields in card schema
2. Identify additional useful fields API provides
3. Understand rate limits/costs for MVP
4. Document authentication/access requirements

Example checklist:

```python
API_RESEARCH_CHECKLIST = {
    "savings_shopping": {
        "apis": ["Amazon Product API", "eBay API", "Google Shopping", "Affiliate networks"],
        "validate": [
            "Can we get product name, image, price, retailer link?",
            "Can we filter by user preferences (size, color, price range)?",
            "Are there rate limits? Costs?",
            "Can we track price changes over time?"
        ]
    },
    "ikigai_travel": {
        "apis": ["Booking.com API", "Airbnb API", "Skyscanner", "Google Hotels"],
        "validate": [
            "Can we search by destination, dates, price range?",
            "Can we get property details, images, amenities, reviews?",
            "Can we generate booking links (affiliate)?",
            "What additional info available (local attractions, weather)?"
        ]
    },
    # ... more card types
}
```

---

## 3. Mission Agent Architecture

> [!important] Implementation Details
> **The detailed Mission Agent architecture is documented in:**
> **`docs/plans/mission_agents_architecture.md`** (Mission Agents Architecture)
>
> This section provides a high-level summary. For implementation details including:
> - LangGraph workflow implementations
> - ReAct patterns and memory architecture
> - Trigger system design
> - Feedback processing
> - Plugin extensibility framework
> - Decentralization migration path
>
> **→ See the Mission Agents Architecture document**

### 3.1 Architecture Decision: Adaptive Multi-Level Framework

After research and brainstorming (completed January 2025), we selected a **refined hybrid approach** that adapts based on **mission complexity** rather than agent type.

**Key Innovation:** Missions are dynamically classified into 3 complexity levels, each using an appropriate LangGraph pattern:

| Complexity | Pattern | Example Missions | LLM Calls | Execution Time |
|------------|---------|-----------------|-----------|----------------|
| **Level 1: Simple** | Direct execution | Shopping (price check), Bill switching | 1-2 | Seconds |
| **Level 2: Coordinated** | Parallel APIs + aggregation | Restaurant search, Event discovery | 3-5 | Minutes |
| **Level 3: Complex** | Hierarchical supervision | Travel planning, Multi-day itineraries | 10-20+ | Hours to weeks |

**Why This Approach:**
- ✅ Unified framework (all missions use LangGraph)
- ✅ Performance optimized (simple missions don't pay for complex overhead)
- ✅ Extensibility (new mission types classified automatically)
- ✅ LangGraph Studio works for all missions
- ✅ Natural evolution (missions can escalate complexity as needed)

### 3.2 Core Architecture Components

**Mission Thread Lifecycle:**
```
CREATED → PLANNING → EXECUTING → INTERRUPTED → REFLECTING → COMPLETED/FAILED
                                     ↑               ↓
                                     └─── (pause) ───┘
                                    User can pause for days/weeks
```

**Memory Architecture:**
- **LangGraph Store** (Long-term, cross-thread):
  - User preferences
  - Ikigai profile
  - Mission learnings (patterns across all missions)
- **PostgreSQL Checkpointer** (Short-term, thread-specific):
  - Mission execution state
  - Interrupt points
  - Subgoal progress

**Trigger System (4 Types):**
1. **Memory Change Triggers** - Store updates (e.g., user adds "Paris" to wishlist)
2. **Schedule-based Triggers** - Cron patterns (e.g., monthly bill review)
3. **User-initiated Triggers** - Direct requests from dashboard
4. **External Event Triggers** - Webhooks (e.g., calendar event in new city)

**Feedback Processing:**
- **Structured buttons**: ✅ Complete / ❌ Failed / ⏸️ Pause / ⭐⭐⭐⭐⭐ Rating
- **Optional natural language**: "Too expensive for weeknight" → LLM extracts preferences → Updates Store

### 3.3 Integration with Mission Card Data Model

Mission Agents produce cards conforming to Section 2 schema, with added complexity field:

```python
class MissionCard(BaseModel):
    # ... existing fields from Section 2 ...

    # NEW FIELD: Complexity classification
    complexity_level: Literal[1, 2, 3] = Field(
        ...,
        description="Mission complexity: 1=Simple, 2=Coordinated, 3=Complex"
    )

    # NEW FIELD: Thread tracking
    thread_id: str = Field(
        ...,
        description="LangGraph thread ID for pause/resume capability"
    )

    # NEW FIELD: Checkpoint tracking
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Current checkpoint ID (for resumed missions)"
    )
```

### 3.4 Example: Level 3 Travel Mission

**User Trigger:** "Plan 5-day Paris trip for May 2025"

**Execution Flow:**
1. **Planning Phase** (checkpoint_1): Decompose into subgoals (flights, hotel, activities)
2. **Execution - Flight Search** (checkpoint_2): Parallel API calls → 3 options → INTERRUPT (user selects)
3. **Execution - Hotel Search** (checkpoint_3): Filters by metro access (from Store) → INTERRUPT (user selects)
4. **Execution - Activities** (checkpoint_4): Queries Ikigai ("cultural sites > nightlife") → Creates draft itinerary → INTERRUPT (user feedback: "too many museums")
5. **Iteration** (checkpoint_5): Replans with 1 day trip → User approves
6. **Reflection** (checkpoint_6): Extracts learnings → Updates Store
7. **Completed**: Mission marked complete, state archived after 30 days

**Total Duration:** 1 week (user paused between each phase)

### 3.5 Differences from IAB Agents

| Aspect | IAB Agents | Mission Agents |
|--------|-----------|----------------|
| **Purpose** | Build advertiser profile | Create actionable missions |
| **Output** | Fixed taxonomy (600+ IDs) | Open-ended mission cards |
| **Architecture** | Batch processing, single-level | ReAct threads, 3 complexity levels |
| **Memory** | Updates semantic classifications | Reads/writes semantic + episodic + thread state |
| **User Interaction** | None (backend) | Direct feedback loop with pause/resume |
| **Trigger Model** | New data arrives → process batch | 4 trigger types (memory/schedule/user/external) |
| **External APIs** | None | Many (shopping, travel, events, restaurants) |
| **State Persistence** | Stateful classifications (confidence) | Stateful threads (can pause for weeks) |

### 3.6 Implementation Reference

**For detailed implementation guidance, see:**

**Mission Agents Architecture:** `docs/plans/mission_agents_architecture.md`

Key sections:
- Section 2: Mission Thread Architecture (ReAct Model)
- Section 3: Adaptive Mission Architecture
- Section 4: Graph Patterns by Complexity (with code examples)
- Section 6: Memory Architecture Details (Store + Checkpointer schemas)
- Section 7: Trigger System Design (implementation logic)
- Section 8: Feedback Processing (LLM analysis patterns)
- Section 9: Extensibility Framework (adding new mission types)

**This document (End-to-End Architecture):**
- Section 2: Mission Card Data Model (Pydantic schemas for cards)
- Section 1: System integration (how Mission Agents connect to IAB, SSO, App)

---

## 4. Open Questions & Next Steps

### 4.1 Section 4: Multi-Source Data Connector Extension (PENDING)

**Questions:**
- How to extend IAB LangGraph workflow to process calendar/financial data?
- Same batch processing approach, or different for structured data?
- How do Mission Agents query across multiple data source types?
- Data connector priority: Email ✓ → Calendar → Financial (Plaid)

### 4.2 Section 5: Integration Strategy (PENDING)

**Topics to explore:**
- How does IAB Profile flow to Publisher SSO SDK?
- How do Mission Cards flow to Figma React Native app?
- BBS+ pseudonym generation and selective disclosure
- Dashboard integration for both IAB and Mission agent monitoring
- Solana blockchain integration (advertiser-pays-gas model)
- Embedded wallet for non-crypto users

### 4.3 Implementation Order

**Suggested MVP sequence:**
1. **Extend Mission Memory schema** - Add LangGraph Store + PostgreSQL Checkpointer (see Mission Agents Architecture Section 6)
2. **Build first Mission Agent** - Shopping agent (Level 1 Simple pattern, high user value)
3. **Implement trigger system** - Memory change triggers + user-initiated (see Mission Agents Architecture Section 7)
4. **Build React Native consumer app** - Mission cards UI from Figma (using Section 2 schemas)
5. **Add user feedback loop** - Structured buttons + optional NL (see Mission Agents Architecture Section 8)
6. **Build second Mission Agent** - Restaurant agent (Level 2 Coordinated pattern)
7. **Extend data connectors** - Add calendar support (high value for travel/events)
8. **Build third Mission Agent** - Travel agent (Level 3 Complex pattern with hierarchical supervision)
9. **Extend IAB agents to calendar/financial** - Reuse proven workflow
10. **Add schedule-based + external triggers** - Cron jobs, webhooks
11. **Build Publisher SSO SDK** - BBS+ pseudonyms, selective disclosure
12. **Integrate Solana payments** - Advertiser-pays-gas model

**Implementation resources:**
- Mission Agent workflows: `docs/plans/mission_agents_architecture.md` (Mission Agents Architecture) Sections 2-9
- Mission Card schemas: `docs/plans/end-to-end-architecture.md` (End-to-End Architecture) Section 2
- System integration: `docs/plans/end-to-end-architecture.md` (End-to-End Architecture) Section 1

---

## Appendix A: Glossary

**IAB Taxonomy:** Interactive Advertising Bureau standard classification system for consumer segments

**Mission Memory:** Unified memory system storing semantic (facts about user) and episodic (events) memories

**Semantic Memory:** Stateful classification with confidence score (e.g., "Age: 25-29, 82% confidence")

**Episodic Memory:** Event records (e.g., "Processed 50 emails on 2025-10-29")

**Mission Card:** Actionable UI card created by Mission Agent (e.g., "Buy these trainers", "Book this hotel")

**Mission Agent:** AI agent that creates missions for users (Shopping Agent, Travel Agent, etc.)

**IAB Agent:** Classification agent that extracts IAB taxonomy classifications from personal data

**ReAct Agent:** Reasoning + Acting agent pattern (LangGraph implementation)

**Evidence Judge:** LLM-as-Judge pattern validating classification quality

**LangGraph:** State graph framework for agent workflows (used in IAB agents)

**BBS+ Pseudonym:** Cryptographic pseudonym for selective disclosure (privacy-preserving identity)

---

## Appendix B: Related Documents

**Architecture & Implementation:**
- `docs/plans/mission_agents_architecture.md` - **Mission Agents Architecture** (LangGraph workflows, ReAct patterns, memory design)
- `docs/plans/end-to-end-architecture.md` - **End-to-End Architecture** (this document)
- `docs/Brainstorming/*OwnYou Consumer App Development Specification (brainstorm copy).md` - Product requirements
- `docs/Brainstorming/* OwnYou Advertising MVP vision, core journey and technical specification (brainstorm copy).md` - Advertising flow
- `CLAUDE.md` - Codebase overview and development guide

**Research & Philosophy:**
- `docs/Brainstorming/brainstorming_mission_agents/2510.09244v1 (1).pdf` - LLM Agents research paper (foundations)
- `docs/Brainstorming/brainstorming_mission_agents/Ikigai (brainstorm copy).md` - Ikigai philosophy and discovery
- `docs/Brainstorming/brainstorming_mission_agents/LangGraph Memory.md` - LangGraph Store patterns

**Security & Identity:**
- `docs/Brainstorming/BBS+ Pseudonymous ID specification v1 (brainstorm copy).md` - Cryptographic identity

**Current Implementation:**
- IAB workflow: `src/email_parser/workflow/graph.py`
- Mission Memory: `src/email_parser/memory/schemas.py`

---

**End of Document**

*This is a living document. Return to Section 3 after research to complete agent architecture design.*
