# Mission Agents Architecture

**Version:** 1.0
**Date:** 2025-01-04
**Status:** Design Approved
**Authors:** Architecture Brainstorming Session

---

## Executive Summary

This document defines the architecture for OwnYou's Mission Agents system - a critical component that creates personalized missions for users across Savings, Ikigai, and Health domains. Without this utility, users will not engage with the platform, and the entire OwnYou ecosystem fails.

> [!important] Companion Document
> **For Mission Card data models and system integration:**
> **`docs/plans/end-to-end-architecture.md`** (End-to-End Architecture)
>
> This document focuses on Mission Agent implementation (LangGraph workflows, triggers, memory).
> The companion document provides:
> - Mission Card Pydantic schemas (Section 2)
> - System integration architecture (Section 1)
> - Multi-source data connectors
> - IAB vs Mission Agent differences

**Key Design Decisions:**

1. **Adaptive Multi-level Architecture**: Missions use different graph patterns based on complexity (Simple → Coordinated → Complex)
2. **ReAct-based Persistent Threads**: Each mission is a long-running process that can pause for days/weeks and resume with full context
3. **Layered + Graph Memory**: LangGraph Store for cross-thread persistence + PostgreSQL Checkpointer for thread-specific state
4. **Four Trigger Types**: Memory changes, schedules, user requests, external events
5. **Hybrid Feedback System**: Structured buttons (always) + optional natural language (LLM-analyzed when provided)
6. **Ikigai-driven Personalization**: Mission types expand based on user life purpose discovery
7. **Plugin Extensibility**: Add new mission types with ~200 lines of code, no core changes
8. **Decentralization Roadmap**: Centralized MVP → TEE → Blockchain with documented migration triggers

**Success Metric:** Mission completion rate (did user achieve their goal?)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Mission Thread Architecture (ReAct Model)](#mission-thread-architecture-react-model)
3. [Adaptive Mission Architecture](#adaptive-mission-architecture)
4. [Graph Patterns by Complexity](#graph-patterns-by-complexity)
5. [Integration with Research Findings](#integration-with-research-findings)
6. [Memory Architecture Details](#memory-architecture-details)
7. [Trigger System Design](#trigger-system-design)
8. [Feedback Processing](#feedback-processing)
9. [Extensibility Framework](#extensibility-framework)
10. [Decentralization Migration Path](#decentralization-migration-path)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Success Metrics](#success-metrics)
13. [Appendices](#appendices)

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Dashboard                           │
│  (View missions, provide feedback, interact with cards)         │
└────────────────┬───────────────────────────────┬────────────────┘
                 │                               │
                 ▼                               ▼
┌────────────────────────────────┐   ┌──────────────────────────┐
│     Mission Trigger System     │   │   User Feedback System   │
│  - Memory change listeners     │   │  - Structured buttons    │
│  - Schedule-based cron         │   │  - Optional NL text      │
│  - User-initiated requests     │   │  - LLM analysis          │
│  - External event webhooks     │   └──────────┬───────────────┘
└───────────┬────────────────────┘              │
            │                                   │
            ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mission Orchestration Layer                   │
│  - LangGraph Supervisor (adaptive routing)                      │
│  - Mission complexity classification (1-3)                      │
│  - Thread lifecycle management (create/pause/resume)            │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─────────────┬─────────────┬─────────────┐
             ▼             ▼             ▼             ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Travel Agent    │ │ Shopping     │ │ Events Agent │ │ Dining Agent │
│ (Level 3)       │ │ Agent (L1)   │ │ (Level 2)    │ │ (Level 2)    │
└─────────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
             │             │             │             │
             └─────────────┴─────────────┴─────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Memory Layer                                │
│  ┌────────────────────────┐  ┌─────────────────────────────┐   │
│  │  LangGraph Store       │  │  PostgreSQL Checkpointer    │   │
│  │  (Cross-thread)        │  │  (Thread-specific state)    │   │
│  │  - User preferences    │  │  - Mission execution state  │   │
│  │  - Ikigai profile      │  │  - Interrupt points         │   │
│  │  - Mission learnings   │  │  - Subgoal progress         │   │
│  └────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   External Integrations                          │
│  - API Subagents (Booking, Search, Events, Maps)               │
│  - LLM Providers (OpenAI, Claude, Gemini)                      │
│  - Future: IPFS, Blockchain, TEE Nodes                         │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

**1. Mission Trigger System**
- Monitors LangGraph Store for memory changes
- Executes scheduled triggers (cron-based)
- Handles user-initiated requests from dashboard
- Processes external event webhooks (calendar, email, social)

**2. Mission Orchestration Layer**
- Classifies mission complexity (1-3) based on goal analysis
- Routes to appropriate graph pattern (Simple/Coordinated/Complex)
- Manages thread lifecycle (create, pause, resume, complete)
- Handles human-in-the-loop interrupts

**3. Specialized Mission Agents**
- Domain-specific agents (Travel, Shopping, Events, Dining, Health, etc.)
- Each agent implements complexity-appropriate graph pattern
- Uses ReAct loops (Reasoning + Acting) for execution
- Queries Store for context, updates Checkpointer for state

**4. Memory Layer**
- **LangGraph Store**: Long-term cross-thread memory (user preferences, Ikigai profile, mission learnings)
- **PostgreSQL Checkpointer**: Short-term thread-specific state (execution progress, interrupt points)
- Semantic search for context retrieval
- Namespace-based organization for isolation

**5. Feedback Processing**
- Structured buttons (completion status, quality rating, usefulness)
- Optional natural language text (LLM-analyzed for preference extraction)
- Updates Store with learnings
- Triggers mission adjustments for future executions

---

## Mission Thread Architecture (ReAct Model)

### Conceptual Model

Each mission is a **persistent, long-running process** represented by a unique `thread_id`. Unlike workflows (which execute linearly and terminate), mission threads:

- **Pause at natural breakpoints** (user decision required)
- **Resume with full context** (days or weeks later)
- **Adapt based on feedback** (user provides input, mission replans)
- **Persist across sessions** (state stored in Checkpointer)

### ReAct Pattern Implementation

**ReAct = Reasoning + Acting in iterative loops**

```python
# Pseudocode for mission thread execution
def mission_thread_loop(thread_id, mission_goal):
    while mission.status != "completed":
        # REASONING phase
        context = store.query(user_preferences, past_missions)
        plan = llm.reason(goal=mission_goal, context=context)

        # ACTING phase
        results = execute_actions(plan)

        # REFLECTION phase
        evaluation = llm.reflect(results=results, goal=mission_goal)

        # INTERRUPT for user input (if needed)
        if evaluation.needs_user_decision:
            interrupt(reason="User decision required", options=results)
            # Thread pauses here, dashboard shows options
            # User returns hours/days later...
            user_choice = resume_and_get_input()

        # UPDATE state and continue
        checkpointer.save(thread_id, state=current_state)

        if evaluation.confidence < threshold:
            # Replan and retry
            mission_goal = adjust_goal_based_on_feedback(evaluation)
        else:
            # Move to next subgoal or complete
            advance_to_next_phase()
```

### Thread Lifecycle States

```
┌──────────┐
│ CREATED  │ ← Mission triggered, thread initialized
└────┬─────┘
     │
     ▼
┌──────────┐
│ PLANNING │ ← Decompose goal into subgoals, fetch context
└────┬─────┘
     │
     ▼
┌──────────┐
│ EXECUTING│ ← Active ReAct loops, calling APIs, reasoning
└────┬─────┘
     │
     ├───→ ┌────────────┐
     │     │ INTERRUPTED│ ← Waiting for user input (can pause for days)
     │     └────┬───────┘
     │          │
     ▼          ▼
┌──────────┐   │
│ REFLECTING│ ←─┘ ← Evaluate results, check confidence
└────┬─────┘
     │
     ├───→ (if low confidence) ─→ REPLANNING ─→ back to EXECUTING
     │
     ▼
┌──────────┐
│ COMPLETED│ ← Goal achieved, learnings extracted to Store
└──────────┘
     │
     ▼
┌──────────┐
│ ARCHIVED │ ← State moved to Store, Checkpointer cleared after 30 days
└──────────┘
```

### Example: Travel Mission Thread

```
User triggers: "Plan a 5-day Paris trip for May 2025"

Thread ID: mission_travel_paris_20250104

PHASE 1: PLANNING (checkpoint_1)
  - Query Store: user_preferences (budget, travel style, dietary restrictions)
  - Decompose: [Book flights, Find hotel, Plan activities, Research restaurants]
  - Status: Move to EXECUTING

PHASE 2: EXECUTING - Flight Search (checkpoint_2)
  - API calls to Skyscanner, Kayak
  - Found 3 viable options ($450, $520, $680)
  - Confidence: High
  - Status: INTERRUPT (user must choose flight)
  → Dashboard shows 3 cards with flight details

[USER PAUSES - 2 days pass]

PHASE 3: EXECUTING - Flight Selection (checkpoint_3)
  - User resumes, selects $520 option
  - Confidence: High
  - Status: Move to hotel search

PHASE 4: EXECUTING - Hotel Search (checkpoint_4)
  - API calls to Booking.com, Hotels.com
  - Filter by: near metro (from Store preference), mid-range budget
  - Found 5 options, narrowed to 2 best matches
  - Confidence: Medium (both equally good)
  - Status: INTERRUPT (user chooses hotel)

[USER PAUSES - 5 hours pass]

PHASE 5: EXECUTING - Hotel Selection (checkpoint_5)
  - User selects Hotel Le Marais
  - Confidence: High
  - Status: Move to activities planning

PHASE 6: EXECUTING - Activities (checkpoint_6)
  - Query Store: Ikigai profile shows "cultural sites > nightlife"
  - Research: Louvre, Musée d'Orsay, Versailles, walking tours
  - Create draft itinerary with timing
  - Confidence: High
  - Status: INTERRUPT (user approves itinerary)

PHASE 7: REFLECTING (checkpoint_7)
  - User approves with 5-star rating
  - Extract learnings:
    * User prefers direct flights even at higher cost
    * "Near metro" is critical hotel preference
    * Cultural activities confirmed as primary interest
  - Update Store with learnings
  - Status: COMPLETED

PHASE 8: ARCHIVED
  - Checkpoint state moved to Store after 30 days
  - Thread available for future reference
```

---

## Adaptive Mission Architecture

### Complexity Classification

Missions are dynamically classified into 3 complexity levels based on:

1. **Number of subgoals** (1-2 = Simple, 3-5 = Coordinated, 6+ = Complex)
2. **Dependency structure** (independent = Simple, parallel = Coordinated, sequential with conditionals = Complex)
3. **External API requirements** (0-1 API = Simple, 2-3 APIs = Coordinated, 4+ APIs = Complex)
4. **Planning depth** (no planning = Simple, single-level planning = Coordinated, hierarchical planning = Complex)

**Classification Logic:**

```python
def classify_mission_complexity(mission_goal: str) -> int:
    """Returns 1 (Simple), 2 (Coordinated), or 3 (Complex)"""

    # LLM analyzes goal
    analysis = llm.analyze_goal(
        goal=mission_goal,
        criteria=[
            "How many distinct steps are required?",
            "Are steps independent or dependent?",
            "How many external APIs needed?",
            "Does this require planning or just execution?"
        ]
    )

    # Decision tree
    if analysis.steps <= 2 and not analysis.requires_planning:
        return 1  # Simple
    elif analysis.steps <= 5 and analysis.dependencies == "parallel":
        return 2  # Coordinated
    else:
        return 3  # Complex
```

### Level 1: Simple Missions (Direct Execution)

**Characteristics:**
- Single API call or simple lookup
- No complex reasoning required
- User sees results immediately
- Minimal state to track

**Graph Pattern:**
```
START → EXECUTE → PRESENT → INTERRUPT (user feedback) → COMPLETE
```

**Example Mission Types:**
- **Shopping**: "Find best price for iPhone 15 Pro"
- **Bill Switching**: "Compare electricity providers"
- **Quick Dining**: "Find pizza places open now"

**State Evolution:**
```python
Level_1_State = {
    "mission_goal": str,
    "api_results": list,
    "user_selection": optional[str],
    "feedback": optional[dict]
}
```

**Capabilities:**
- Single API integration
- Result filtering based on Store preferences
- Immediate presentation to user

**Decision Logic:**
- If goal requires only 1-2 API calls with no dependencies → Level 1
- If user just needs "best option now" → Level 1

**Example: Shopping Mission**
```
User: "Find best price for Sony WH-1000XM5 headphones"

EXECUTE:
  - API call to price comparison service
  - Results: [Amazon: $349, Best Buy: $379, B&H: $339]
  - Apply Store preference: "trusted retailers only"
  - Filter: Keep Amazon, Best Buy (B&H not in trusted list)

PRESENT:
  - Show 2 options to user with ratings, shipping times

INTERRUPT:
  - User selects Amazon option
  - Feedback: ⭐⭐⭐⭐⭐ "Perfect, bought it!"

COMPLETE:
  - Update Store: successful_purchases["electronics"] += 1
  - Update Store: preferred_retailers["amazon"] += 1
```

### Level 2: Coordinated Missions (Parallel Execution)

**Characteristics:**
- Multiple parallel API calls
- Results aggregated and ranked
- Moderate reasoning for synthesis
- Some planning required

**Graph Pattern:**
```
START → PLAN → [PARALLEL: API_1, API_2, API_3] → AGGREGATE → RANK → PRESENT → INTERRUPT → COMPLETE
```

**Example Mission Types:**
- **Restaurant Search**: "Find Italian restaurants for Friday night"
- **Event Discovery**: "Find jazz concerts this weekend"
- **Multi-source Shopping**: "Find best laptop under $1500"

**State Evolution:**
```python
Level_2_State = {
    "mission_goal": str,
    "search_criteria": dict,
    "parallel_results": {
        "api_1": list,
        "api_2": list,
        "api_3": list
    },
    "aggregated_results": list,
    "ranked_results": list,  # Top N after filtering
    "user_selection": optional[str],
    "feedback": optional[dict]
}
```

**Capabilities:**
- Multi-API parallel execution
- Result deduplication across sources
- Ranking by composite score (price + rating + relevance)
- Context-aware filtering (Store preferences)

**Decision Logic:**
- If goal requires 2-5 parallel API calls → Level 2
- If results need aggregation/ranking → Level 2
- If no sequential dependencies between steps → Level 2

**Example: Restaurant Search Mission**
```
User: "Find Italian restaurants for Friday night, 4 people"

PLAN:
  - Query Store: dietary_restrictions = ["vegetarian options required"]
  - Query Store: location_preference = "within 2 miles"
  - Search criteria: {cuisine: "Italian", date: "2025-01-10", party_size: 4}

PARALLEL EXECUTION:
  - API_1 (Google Maps): 8 results
  - API_2 (Yelp): 12 results
  - API_3 (OpenTable): 6 results

AGGREGATE:
  - Deduplicate: 15 unique restaurants (some appeared in multiple sources)
  - Filter by: vegetarian options available, distance <= 2 miles
  - Remaining: 7 restaurants

RANK:
  - Composite score = (rating * 0.4) + (availability * 0.3) + (price_match * 0.3)
  - Store preference: "mid-range budget" → filter out $$$$ options
  - Top 3: Trattoria Bella (4.6★, 7:30pm available), Luigi's (4.4★, 8:00pm), Osteria Roma (4.5★, 7:00pm)

PRESENT:
  - Show 3 cards with photos, menus, reservation buttons

INTERRUPT:
  - User selects Trattoria Bella
  - Books reservation via OpenTable integration
  - Feedback: ⭐⭐⭐⭐ "Great choice, but wish there were more vegetarian entrees"

COMPLETE:
  - Update Store: dining_preferences["italian"]["favorites"] += "Trattoria Bella"
  - Extract from NL feedback: dining_preferences["vegetarian_variety"] = "important"
```

### Level 3: Complex Missions (Hierarchical Planning)

**Characteristics:**
- Multi-step sequential + parallel operations
- Requires upfront planning with contingencies
- Long-running (hours to weeks)
- Uses file system for intermediate artifacts
- Hierarchical supervision (top-level + mid-level + workers)

**Graph Pattern:**
```
START → DEEP_PLANNING → [HIERARCHICAL_SUPERVISION:
    ├─ Mid-level Supervisor 1 → [Workers: API_A, API_B]
    ├─ Mid-level Supervisor 2 → [Workers: API_C, API_D, API_E]
    └─ Mid-level Supervisor 3 → [Workers: API_F, API_G]
] → SYNTHESIS → PRESENT → INTERRUPT → ITERATE/REFINE → COMPLETE
```

**Example Mission Types:**
- **Travel Planning**: "Plan 5-day Paris trip for May 2025"
- **Multi-day Itinerary**: "Create 3-day conference schedule with team"
- **Complex Shopping**: "Find and compare laptops, then accessories bundle"

**State Evolution:**
```python
Level_3_State = {
    "mission_goal": str,
    "plan": {
        "subgoals": list[dict],  # [{goal, dependencies, coordinator, status}]
        "contingencies": dict,   # Backup plans if primary fails
        "file_system_path": str  # /missions/{thread_id}/
    },
    "execution_status": {
        "coordinator_1": dict,
        "coordinator_2": dict,
        "coordinator_3": dict
    },
    "synthesis_artifacts": {
        "draft_itinerary": str,
        "final_itinerary": str,
        "supporting_docs": list
    },
    "user_feedback_history": list[dict],  # Multiple interaction rounds
    "current_iteration": int
}
```

**Capabilities:**
- Hierarchical task decomposition (DPPM pattern: Decompose, Plan in Parallel, Merge)
- File system for storing intermediate artifacts
- Multi-round user interaction (draft → feedback → refine → final)
- Reflection at each coordinator level
- Anticipatory planning (what could go wrong?)

**Decision Logic:**
- If goal requires 6+ steps with dependencies → Level 3
- If mission will span multiple days/weeks → Level 3
- If requires draft → review → refine loops → Level 3
- If needs hierarchical coordination → Level 3

**File System Structure:**
```
/missions/{thread_id}/
  ├── plan.md              # Initial decomposition
  ├── research/            # API results, web searches
  │   ├── flights.json
  │   ├── hotels.json
  │   ├── restaurants.json
  │   └── activities.json
  ├── drafts/              # In-progress artifacts
  │   ├── itinerary_v1.md
  │   ├── itinerary_v2.md  # After first user feedback
  │   └── itinerary_v3.md  # After second refinement
  └── final/               # User-approved outputs
      ├── booking_summary.pdf
      └── daily_schedule.md
```

**Example: Travel Planning Mission**
```
User: "Plan a 5-day Paris trip for May 2025, budget $3000, 2 travelers"

PHASE 1: DEEP PLANNING
  - Query Store: travel_preferences, dietary_restrictions, Ikigai["interests"]
  - Decompose into subgoals:
    1. Flight booking (Coordinator A)
    2. Accommodation search (Coordinator B)
    3. Activity planning (Coordinator C)
    4. Restaurant research (Coordinator D)
  - Identify dependencies: Flight dates → hotel dates → activity schedule
  - Create contingency plans: If budget exceeded, suggest alternatives
  - Initialize file system: /missions/travel_paris_20250104/

PHASE 2: HIERARCHICAL EXECUTION

  Coordinator A (Flights):
    - Worker 1: Query Skyscanner API
    - Worker 2: Query Kayak API
    - Worker 3: Check airline direct sites
    - Aggregate results → Save to research/flights.json
    - Top 3 options identified
    - INTERRUPT: Present to user
    - User selects Option 2 ($520 direct flight)

  Coordinator B (Accommodation):
    - Wait for flight selection (dependency)
    - Worker 1: Booking.com API (filter: near metro, mid-range)
    - Worker 2: Airbnb API (filter: entire place, good reviews)
    - Worker 3: Hotels.com API
    - Aggregate results → Save to research/hotels.json
    - Apply Store preference: "quiet room, high floor"
    - Top 2 options identified
    - INTERRUPT: Present to user
    - User selects Hotel Le Marais

  Coordinator C (Activities):
    - Query Ikigai profile: "cultural sites > nightlife"
    - Query Store: past_travel["interests"] = ["museums", "walking tours"]
    - Worker 1: Research museums (Louvre, Musée d'Orsay, Versailles)
    - Worker 2: Find walking tours (Montmartre, Latin Quarter)
    - Worker 3: Check event calendars (concerts, exhibitions in May)
    - Create draft itinerary → drafts/itinerary_v1.md
    - INTERRUPT: Present to user
    - User feedback: "Too many museums, add 1 day trip outside Paris"

  [ITERATION: Coordinator C replans]
    - Remove Versailles from museum list
    - Worker 4: Research day trips (Giverny, Fontainebleau, Loire Valley)
    - User selects Giverny
    - Update itinerary → drafts/itinerary_v2.md
    - INTERRUPT: Present refined version
    - User approves: ⭐⭐⭐⭐⭐

  Coordinator D (Restaurants):
    - Query dietary_restrictions: ["vegetarian options required"]
    - Research by arrondissement based on itinerary
    - Save recommendations → research/restaurants.json
    - Include in final itinerary

PHASE 3: SYNTHESIS
  - Combine all components into final_itinerary.md
  - Generate booking_summary.pdf with confirmations
  - Save to final/ directory
  - Present complete package to user

PHASE 4: REFLECTION & LEARNING
  - User completes trip (4 weeks later)
  - Feedback: ⭐⭐⭐⭐⭐ "Perfect trip! Hotel location was ideal, itinerary was well-paced"
  - Extract learnings:
    * travel_preferences["paris"]["hotel_area"] = "Le Marais"
    * travel_preferences["pacing"] = "prefer 1 major activity per day"
    * Ikigai["interests"]["day_trips"] = "nature/gardens (Giverny was highlight)"
  - Update Store for future travel missions

COMPLETE:
  - Archive thread state to Store
  - Clear Checkpointer after 30 days
  - Mission marked as completed
```

---

## Graph Patterns by Complexity

### Level 1: Simple Direct Execution

**LangGraph Implementation:**

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver

class SimpleState(TypedDict):
    mission_goal: str
    api_results: list
    user_selection: Optional[str]
    feedback: Optional[dict]

# Define nodes
def execute(state: SimpleState):
    """Single API call with filtering"""
    results = api_client.search(state["mission_goal"])
    preferences = store.query(("user_preferences", user_id))
    filtered = apply_preferences(results, preferences)
    return {"api_results": filtered}

def present(state: SimpleState):
    """Show results to user"""
    # This node triggers interrupt automatically
    return {"status": "awaiting_user_input"}

def complete(state: SimpleState):
    """Extract learnings and finish"""
    update_store_from_feedback(state["feedback"])
    return {"status": "completed"}

# Build graph
graph = StateGraph(SimpleState)
graph.add_node("execute", execute)
graph.add_node("present", present)
graph.add_node("complete", complete)

graph.set_entry_point("execute")
graph.add_edge("execute", "present")
graph.add_edge("present", "complete")
graph.add_edge("complete", END)

# Compile with checkpointer
checkpointer = PostgresSaver(conn)
simple_mission_graph = graph.compile(checkpointer=checkpointer, interrupt_before=["complete"])
```

### Level 2: Coordinated Parallel Execution

**LangGraph Implementation:**

```python
class CoordinatedState(TypedDict):
    mission_goal: str
    search_criteria: dict
    parallel_results: dict
    aggregated_results: list
    ranked_results: list
    user_selection: Optional[str]

# Planning node
def plan(state: CoordinatedState):
    """Extract search criteria from goal"""
    criteria = llm.extract_criteria(state["mission_goal"])
    preferences = store.query(("user_preferences", user_id))
    return {"search_criteria": {**criteria, **preferences}}

# Parallel API workers
def search_api_1(state: CoordinatedState):
    results = api_1_client.search(state["search_criteria"])
    return {"parallel_results": {"api_1": results}}

def search_api_2(state: CoordinatedState):
    results = api_2_client.search(state["search_criteria"])
    return {"parallel_results": {"api_2": results}}

def search_api_3(state: CoordinatedState):
    results = api_3_client.search(state["search_criteria"])
    return {"parallel_results": {"api_3": results}}

# Aggregation node
def aggregate(state: CoordinatedState):
    """Deduplicate and merge results from all APIs"""
    all_results = []
    for api_results in state["parallel_results"].values():
        all_results.extend(api_results)

    deduplicated = deduplicate_by_key(all_results, key="id")
    return {"aggregated_results": deduplicated}

# Ranking node
def rank(state: CoordinatedState):
    """Score and sort results"""
    preferences = store.query(("user_preferences", user_id))
    scored = []
    for result in state["aggregated_results"]:
        score = calculate_composite_score(result, preferences)
        scored.append({**result, "score": score})

    ranked = sorted(scored, key=lambda x: x["score"], reverse=True)
    return {"ranked_results": ranked[:5]}  # Top 5

# Build graph
graph = StateGraph(CoordinatedState)
graph.add_node("plan", plan)
graph.add_node("search_api_1", search_api_1)
graph.add_node("search_api_2", search_api_2)
graph.add_node("search_api_3", search_api_3)
graph.add_node("aggregate", aggregate)
graph.add_node("rank", rank)
graph.add_node("present", present)
graph.add_node("complete", complete)

graph.set_entry_point("plan")
graph.add_edge("plan", "search_api_1")
graph.add_edge("plan", "search_api_2")
graph.add_edge("plan", "search_api_3")
graph.add_edge("search_api_1", "aggregate")
graph.add_edge("search_api_2", "aggregate")
graph.add_edge("search_api_3", "aggregate")
graph.add_edge("aggregate", "rank")
graph.add_edge("rank", "present")
graph.add_edge("present", "complete")

coordinated_graph = graph.compile(checkpointer=checkpointer, interrupt_before=["complete"])
```

### Level 3: Complex Hierarchical Supervision

**LangGraph Implementation:**

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver

class ComplexState(TypedDict):
    mission_goal: str
    plan: dict
    execution_status: dict
    synthesis_artifacts: dict
    user_feedback_history: list
    current_iteration: int
    file_system_path: str

# Deep planning node
def deep_planning(state: ComplexState):
    """DPPM: Decompose, Plan in Parallel, Merge"""
    # Query Store for all relevant context
    user_prefs = store.query(("user_preferences", user_id))
    ikigai = store.query(("ikigai_profile", user_id))
    past_missions = store.query(("completed_missions", user_id))

    # LLM decomposes goal
    decomposition = llm.decompose_goal(
        goal=state["mission_goal"],
        context={"preferences": user_prefs, "ikigai": ikigai, "history": past_missions}
    )

    # Create file system
    fs_path = f"/missions/{thread_id}/"
    os.makedirs(f"{fs_path}/research", exist_ok=True)
    os.makedirs(f"{fs_path}/drafts", exist_ok=True)
    os.makedirs(f"{fs_path}/final", exist_ok=True)

    # Write plan to file
    with open(f"{fs_path}/plan.md", "w") as f:
        f.write(decomposition["plan_markdown"])

    return {
        "plan": decomposition,
        "file_system_path": fs_path,
        "execution_status": {coord: "pending" for coord in decomposition["coordinators"]}
    }

# Create subgraph for each coordinator
def create_coordinator_subgraph(coordinator_config):
    """Each coordinator is a subgraph with worker nodes"""

    class CoordinatorState(TypedDict):
        coordinator_goal: str
        worker_results: dict
        coordinator_output: dict

    subgraph = StateGraph(CoordinatorState)

    # Add worker nodes dynamically
    for worker in coordinator_config["workers"]:
        subgraph.add_node(worker["name"], worker["function"])

    # Add reflection node
    def reflect_coordinator(state: CoordinatorState):
        """Evaluate coordinator results before returning to supervisor"""
        confidence = llm.evaluate_results(
            goal=state["coordinator_goal"],
            results=state["worker_results"]
        )
        if confidence < 0.7:
            # Log warning but continue (supervisor will handle)
            return {"coordinator_output": {**state["worker_results"], "confidence": confidence, "needs_review": True}}
        return {"coordinator_output": {**state["worker_results"], "confidence": confidence}}

    subgraph.add_node("reflect", reflect_coordinator)

    # Wire up dependencies
    for worker in coordinator_config["workers"]:
        subgraph.add_edge(worker["name"], "reflect")

    return subgraph.compile()

# Top-level supervisor
def supervisor_route(state: ComplexState):
    """Decides which coordinator to execute next based on dependencies"""
    plan = state["plan"]
    status = state["execution_status"]

    # Check dependencies
    for coordinator_id, coordinator in plan["coordinators"].items():
        if status[coordinator_id] == "completed":
            continue

        # Check if dependencies are met
        deps_met = all(status[dep] == "completed" for dep in coordinator["dependencies"])
        if deps_met:
            return coordinator_id

    # All coordinators complete → move to synthesis
    return "synthesis"

# Synthesis node
def synthesis(state: ComplexState):
    """Combine all coordinator outputs into final artifact"""
    fs_path = state["file_system_path"]

    # Load all research
    research_files = os.listdir(f"{fs_path}/research/")
    research_data = {}
    for file in research_files:
        with open(f"{fs_path}/research/{file}", "r") as f:
            research_data[file] = json.load(f)

    # LLM synthesizes into draft
    draft = llm.synthesize(
        goal=state["mission_goal"],
        research=research_data,
        user_preferences=store.query(("user_preferences", user_id))
    )

    # Save draft
    iteration = state["current_iteration"]
    with open(f"{fs_path}/drafts/artifact_v{iteration}.md", "w") as f:
        f.write(draft)

    return {
        "synthesis_artifacts": {"draft": draft, "version": iteration},
        "status": "awaiting_user_feedback"
    }

# Iteration node (handles user feedback and replanning)
def iterate(state: ComplexState):
    """Process user feedback and decide if refinement needed"""
    feedback = state["user_feedback_history"][-1]  # Most recent

    if feedback["approved"]:
        # Generate final artifacts
        fs_path = state["file_system_path"]
        final_artifact = generate_final_output(state["synthesis_artifacts"]["draft"])
        with open(f"{fs_path}/final/output.md", "w") as f:
            f.write(final_artifact)
        return {"status": "ready_to_complete"}

    else:
        # Extract refinement instructions
        refinement_plan = llm.extract_refinement_plan(feedback["comments"])

        # Determine which coordinators need to rerun
        coordinators_to_rerun = identify_affected_coordinators(refinement_plan)

        # Reset execution status for those coordinators
        new_status = state["execution_status"].copy()
        for coord in coordinators_to_rerun:
            new_status[coord] = "pending"

        return {
            "execution_status": new_status,
            "current_iteration": state["current_iteration"] + 1,
            "plan": update_plan_with_refinements(state["plan"], refinement_plan)
        }

# Build top-level graph
graph = StateGraph(ComplexState)
graph.add_node("deep_planning", deep_planning)

# Add coordinator subgraphs (dynamically based on mission)
# Example: Travel mission has Flight, Hotel, Activity, Restaurant coordinators
graph.add_node("coordinator_flights", create_coordinator_subgraph(flight_coordinator_config))
graph.add_node("coordinator_hotels", create_coordinator_subgraph(hotel_coordinator_config))
graph.add_node("coordinator_activities", create_coordinator_subgraph(activity_coordinator_config))

graph.add_node("synthesis", synthesis)
graph.add_node("present_draft", present_draft_to_user)
graph.add_node("iterate", iterate)
graph.add_node("complete", complete)

# Supervisor routing
graph.set_entry_point("deep_planning")
graph.add_conditional_edges(
    "deep_planning",
    supervisor_route,
    {
        "coordinator_flights": "coordinator_flights",
        "coordinator_hotels": "coordinator_hotels",
        "coordinator_activities": "coordinator_activities",
        "synthesis": "synthesis"
    }
)

# After each coordinator, return to supervisor
graph.add_conditional_edges("coordinator_flights", supervisor_route)
graph.add_conditional_edges("coordinator_hotels", supervisor_route)
graph.add_conditional_edges("coordinator_activities", supervisor_route)

# Synthesis → Present → Iterate loop
graph.add_edge("synthesis", "present_draft")
graph.add_conditional_edges(
    "iterate",
    lambda state: "complete" if state["status"] == "ready_to_complete" else "coordinator_flights",
    {
        "complete": "complete",
        "coordinator_flights": supervisor_route  # Re-enter supervisor routing
    }
)
graph.add_edge("complete", END)

complex_graph = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["present_draft", "complete"]
)
```

**Key Differences Across Levels:**

| Feature | Level 1 | Level 2 | Level 3 |
|---------|---------|---------|---------|
| Graph nodes | 3-4 | 6-8 | 10-20+ |
| Subgraphs | None | None | Multiple coordinator subgraphs |
| Interrupts | 1 | 1-2 | 3-5+ (multi-round feedback) |
| File system | No | No | Yes (`/missions/{thread_id}/`) |
| Reflection depth | None | Single aggregation | Multi-level (coordinator + supervisor) |
| LLM calls | 1-2 | 3-5 | 10-20+ |
| Execution time | Seconds | Minutes | Hours to weeks |

---

## Integration with Research Findings

### 5.1 Alignment with "Fundamentals of Building Autonomous LLM Agents" Paper

Our adaptive architecture directly implements key recommendations from the research paper (see Appendix A):

**Multi-Agent Specialization (Paper: Specialized Experts)**
- ✅ **Planning Agent**: Mission Supervisor handles decomposition (DPPM pattern)
- ✅ **Reflection Agent**: Evidence evaluation in mission execution loops
- ✅ **Memory Management**: LangGraph Store for cross-thread persistence + Checkpointer for thread state
- ✅ **HCI Agent**: `interrupt()` for human-in-the-loop at phase boundaries
- ✅ **Action Agent**: API integration subagents (Booking, Search, Events)

**Task Decomposition Strategy (Paper: DPPM)**
Level 3 Complex Missions use **Interleaved Sequential** pattern:
- Decompose goal into subgoals with dependencies
- Plan execution order based on dependency graph
- Execute in parallel where possible
- Merge results in synthesis phase

Example: Travel mission plans entire trip, executes flight search, reflects on results, replans hotel search based on flight times.

**Reflection Mechanisms (Paper: Self-Evaluation + Error Detection)**
Implemented in ReAct pattern at multiple levels:
- **Self-evaluation**: Each phase ends with confidence assessment
- **Error detection**: Evidence validation before committing to memory
- **Anticipatory reflection**: "What could go wrong?" checks before API calls
- **Correction**: Failed phases trigger replanning, not abandonment

**Memory Architecture (Paper: Long-term Embodied + Short-term Context)**
- **Long-term Embodied Memory**: LangGraph Store with semantic search (user preferences, past missions, learned patterns)
- **Short-term Context**: Checkpointer maintains thread state across interrupts (can pause for weeks)
- **RAG Integration**: Mission agents query Store for relevant context before planning

### 5.2 Ikigai Discovery Integration

The Ikigai research (see Appendix B) provides a framework for discovering user life purpose. We integrate this into mission personalization:

**Initial Profiling (One-time Setup)**

When user first onboards, Ikigai Discovery Agent prompts:
- Who do you most want to help? (people group)
- What problems/desires do they have?
- What solutions excite you most?
- What are you naturally good at?
- What do you look forward to?
- What gets you into flow state?
- What do you enjoy learning about?

Responses stored in Store: `("ikigai_profile", user_id)`

**Continuous Refinement (Memory Updates)**

Mission agents apply Ikigai principles:
- **Giving over Receiving**: Prioritize missions that involve helping others (charity events, volunteering)
- **Connection to External World**: Surface missions involving hobbies, work, social activities
- **Fluidity and Growth**: Track changing interests (user who loved solo travel now searches family trips → adjust mission types)
- **Action-Oriented**: Focus on executable missions, not theoretical goals

**Mission Type Expansion Based on Ikigai**

```python
# Example: User's Ikigai evolves
if user_ikigai["enjoys_learning_about"] = ["sustainable fashion"]:
    # Expand mission types to include:
    new_mission_types = [
        "Find sustainable clothing brands",
        "Discover local eco-friendly stores",
        "Research ethical supply chains"
    ]
    register_mission_types(new_mission_types)
```

**Example Ikigai-Driven Mission:**

```
User Profile (from Ikigai discovery):
  - Enjoys helping: "elderly neighbors"
  - Good at: "organizing events"
  - Gets into flow: "planning activities"

Mission Agent Creates:
  Mission Type: Complex (Level 3)
  Mission Goal: "Organize senior community lunch"

  Subgoals:
    1. Find wheelchair-accessible venue
    2. Research senior-friendly menu
    3. Coordinate volunteer helpers
    4. Book transportation

  This mission aligns with user's Ikigai → Higher priority in trigger system
```

### 5.3 LangGraph Best Practices Integration

From the LangGraph documentation research (see Appendix C):

**Supervisor vs Hierarchical Choice:**
- **Simple/Coordinated (Levels 1-2)**: Flat supervisor with worker subgraphs
- **Complex (Level 3)**: Hierarchical with mid-level coordinators
  - Top Supervisor: Overall mission orchestration
  - Mid-level: Flight Coordinator, Accommodation Coordinator, Activity Coordinator
  - Workers: API integration subagents

**Memory Namespace Strategy:**

```python
# Cross-thread user data (shared across all missions)
("user_preferences", user_id)
("ikigai_profile", user_id)
("completed_missions", user_id)

# Mission-specific (but searchable across threads)
("mission_learnings", mission_type)  # e.g., "flight_bookings", "restaurant_search"
("api_failures", api_provider)       # Track reliability patterns
```

**Interrupt Strategy:**
- **Checkpoint-based**: Every phase boundary = potential interrupt point
- **Resume capability**: User can return days later, full context restored from Checkpointer
- **State inspection**: Dashboard shows "waiting for user" vs "executing" vs "completed"

**Deep Agent File System** (Level 3 only):

```
/missions/{thread_id}/
  ├── plan.md              # Mission decomposition
  ├── research/            # API results, web searches
  │   ├── flights.json
  │   └── hotels.json
  ├── drafts/              # In-progress artifacts
  │   └── itinerary_v2.md
  └── final/               # User-approved outputs
      └── booking_summary.pdf
```

---

## Memory Architecture Details

### 6.1 LangGraph Store (Long-term Cross-thread Memory)

**Purpose:** Persist learnings across all missions for any user

**Storage Backend:** PostgreSQL with vector embeddings for semantic search

**Namespace Schema:**

```python
# User preferences (updated continuously from mission feedback)
{
  "namespace": ("user_preferences", user_id),
  "data": {
    "dietary_restrictions": ["vegetarian", "gluten-free"],
    "travel_preferences": {
      "airline": "prefers aisle seats",
      "hotel": "quiet room, high floor",
      "activities": "cultural sites > nightlife"
    },
    "budget_constraints": {
      "flights": "economy, will pay extra for direct",
      "hotels": "mid-range, not hostels"
    },
    "location_preferences": {
      "dining": "within 2 miles",
      "hotels": "near public transport"
    }
  },
  "embedding": [0.23, 0.87, ...]  # For semantic search
}

# Ikigai profile (updated slowly, high-level life purpose)
{
  "namespace": ("ikigai_profile", user_id),
  "data": {
    "people_to_help": ["elderly neighbors", "local environmental groups"],
    "core_interests": ["sustainable living", "community organizing"],
    "flow_activities": ["event planning", "gardening"],
    "skills": ["coordination", "research", "public speaking"],
    "learning_interests": ["permaculture", "local politics"]
  },
  "embedding": [0.45, 0.62, ...]
}

# Mission learnings (cross-mission patterns, shared knowledge)
{
  "namespace": ("mission_learnings", "flight_bookings"),
  "data": {
    "successful_apis": ["Skyscanner", "Kayak"],
    "common_pitfalls": "Always check baggage fees separately",
    "user_feedback_patterns": "User prefers seeing alternative dates",
    "optimal_timing": "Book 6-8 weeks in advance for best prices"
  },
  "embedding": [0.91, 0.14, ...]
}

# Completed missions (history for context)
{
  "namespace": ("completed_missions", user_id),
  "data": {
    "mission_id": "travel_paris_20250104",
    "mission_type": "travel",
    "goal": "Plan 5-day Paris trip",
    "completion_date": "2025-01-10",
    "success_rating": 5.0,
    "key_learnings": ["User values direct flights", "Le Marais is preferred area"],
    "artifacts_path": "/missions/travel_paris_20250104/final/"
  },
  "embedding": [0.73, 0.29, ...]
}
```

**Update Triggers:**

```python
# After mission completion
def on_mission_complete(mission_state):
    # Extract learnings
    learnings = llm.extract_learnings(
        mission_state=mission_state,
        user_feedback=mission_state["feedback"]
    )

    # Update user preferences
    current_prefs = store.get(("user_preferences", user_id))
    updated_prefs = merge_learnings(current_prefs, learnings)
    store.put(("user_preferences", user_id), updated_prefs)

    # Update mission learnings (general patterns)
    mission_type = mission_state["mission_type"]
    current_learnings = store.get(("mission_learnings", mission_type))
    updated_learnings = aggregate_patterns(current_learnings, learnings)
    store.put(("mission_learnings", mission_type), updated_learnings)

    # Archive completed mission
    store.put(
        ("completed_missions", user_id),
        {
            "mission_id": mission_state["thread_id"],
            "completion_date": datetime.now(),
            **extract_summary(mission_state)
        }
    )

# On user feedback (even for in-progress missions)
def on_user_feedback(thread_id, feedback):
    if feedback.get("nl_text"):
        # LLM extracts preference updates
        preference_updates = llm.extract_preferences(feedback["nl_text"])

        # Apply updates
        current_prefs = store.get(("user_preferences", user_id))
        for key, value in preference_updates.items():
            update_nested_dict(current_prefs, key, value)

        store.put(("user_preferences", user_id), current_prefs)
```

**Semantic Search for Context Retrieval:**

```python
# When mission agent starts planning
def retrieve_context_for_mission(mission_goal: str, user_id: str):
    # Generate embedding for mission goal
    goal_embedding = embedding_model.encode(mission_goal)

    # Search Store for relevant context
    results = store.search(
        query_embedding=goal_embedding,
        namespaces=[
            ("user_preferences", user_id),
            ("ikigai_profile", user_id),
            ("mission_learnings", "*"),  # Search all mission types
            ("completed_missions", user_id)
        ],
        limit=10,
        similarity_threshold=0.7
    )

    return results
```

### 6.2 PostgreSQL Checkpointer (Short-term Thread State)

**Purpose:** Maintain mission execution state for pause/resume capability

**Storage Backend:** PostgreSQL with JSONB columns for state

**Schema:**

```sql
CREATE TABLE checkpoints (
    thread_id VARCHAR(255) PRIMARY KEY,
    checkpoint_id VARCHAR(255) NOT NULL,
    parent_checkpoint_id VARCHAR(255),
    state JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_thread_id ON checkpoints(thread_id);
CREATE INDEX idx_checkpoint_id ON checkpoints(checkpoint_id);
```

**State Structure:**

```python
{
  "thread_id": "mission_travel_paris_20250104",
  "checkpoint_id": "phase_3_after_flight_search",
  "parent_checkpoint_id": "phase_2_planning_complete",
  "state": {
    "mission_goal": "Plan 5-day Paris trip for May 2025",
    "mission_type": "travel",
    "complexity_level": 3,
    "current_phase": "research",
    "phase_history": ["planning", "decomposition", "research"],
    "subgoals": [
      {
        "goal": "Book flights",
        "status": "in_progress",
        "coordinator": "flights",
        "results": {
          "api_1_results": [...],
          "api_2_results": [...],
          "top_options": [...]
        },
        "confidence": 0.85
      },
      {
        "goal": "Find hotel",
        "status": "pending",
        "coordinator": "hotels",
        "dependencies": ["flights"]
      },
      {
        "goal": "Plan activities",
        "status": "pending",
        "coordinator": "activities",
        "dependencies": ["hotels"]
      }
    ],
    "context": {
      "budget": 3000,
      "dates": "2025-05-15 to 2025-05-20",
      "travelers": 2
    },
    "file_system_path": "/missions/mission_travel_paris_20250104/",
    "awaiting_user_input": true,
    "interrupt_reason": "Need user to select from 3 flight options",
    "interrupt_options": [...]
  },
  "metadata": {
    "user_id": "user_12345",
    "started_at": "2025-01-04T10:30:00Z",
    "last_updated": "2025-01-04T11:15:00Z",
    "total_llm_calls": 12,
    "total_cost": 0.45
  }
}
```

**Retention Policy:**

```python
# Cleanup job (runs daily)
def cleanup_checkpoints():
    # Active missions: Keep indefinitely while status = "in_progress"
    # (No cleanup)

    # Completed missions: Archive state to Store after 30 days
    completed_threads = db.query("""
        SELECT thread_id, state
        FROM checkpoints
        WHERE state->>'status' = 'completed'
        AND updated_at < NOW() - INTERVAL '30 days'
    """)

    for thread in completed_threads:
        # Archive to Store
        store.put(
            ("archived_missions", thread["state"]["metadata"]["user_id"]),
            {
                "thread_id": thread["thread_id"],
                "final_state": thread["state"],
                "archived_at": datetime.now()
            }
        )

        # Delete from Checkpointer
        db.execute("DELETE FROM checkpoints WHERE thread_id = %s", thread["thread_id"])

    # Failed missions: Keep for 7 days, then archive learnings to Store
    failed_threads = db.query("""
        SELECT thread_id, state
        FROM checkpoints
        WHERE state->>'status' = 'failed'
        AND updated_at < NOW() - INTERVAL '7 days'
    """)

    for thread in failed_threads:
        # Extract failure learnings
        failure_learnings = extract_failure_patterns(thread["state"])

        # Store in mission learnings
        mission_type = thread["state"]["mission_type"]
        current_learnings = store.get(("mission_learnings", mission_type))
        current_learnings["failures"] = current_learnings.get("failures", []) + [failure_learnings]
        store.put(("mission_learnings", mission_type), current_learnings)

        # Delete from Checkpointer
        db.execute("DELETE FROM checkpoints WHERE thread_id = %s", thread["thread_id"])
```

---

## Trigger System Design

### 7.1 Four Trigger Types

**1. Memory Change Triggers**

Watches LangGraph Store for significant updates that should spawn new missions.

**Implementation:**

```python
# Store update listener
@store.on_update
def handle_store_update(namespace, old_data, new_data):
    """Triggered whenever Store namespace is updated"""

    # Check if update is significant enough to trigger mission
    if namespace[0] == "user_preferences":
        user_id = namespace[1]

        # Example: Travel preferences changed
        if old_data.get("travel_preferences") != new_data.get("travel_preferences"):
            # User added "Paris" to wishlist
            if "Paris" in new_data["travel_preferences"].get("wishlist", []):
                trigger_mission(
                    mission_type="travel",
                    user_id=user_id,
                    goal="Plan Paris trip based on user wishlist",
                    trigger_source="memory_change",
                    priority="medium"
                )

    # Example: Ikigai profile updated (new interest discovered)
    if namespace[0] == "ikigai_profile":
        user_id = namespace[1]

        new_interests = set(new_data.get("learning_interests", []))
        old_interests = set(old_data.get("learning_interests", []))
        added_interests = new_interests - old_interests

        if added_interests:
            # User discovered new passion → suggest missions
            for interest in added_interests:
                suggest_mission_types_for_interest(user_id, interest)
```

**Example Scenarios:**
- User adds "Paris" to travel wishlist → Travel Agent triggers "Plan Paris Trip"
- User updates dietary restrictions to include "vegan" → Dining Agent updates future restaurant searches
- User completes mission with preference feedback → Next mission of same type uses updated preferences

**2. Schedule-based Triggers**

Cron-style scheduling for recurring missions.

**Implementation:**

```python
# Mission schedule registry
mission_schedules = {
    "bill_review": {
        "cron": "0 0 1 * *",  # Monthly on 1st at midnight
        "mission_type": "bill_switching",
        "goal_template": "Review bills and find better deals for {month}",
        "enabled_for_users": "all"
    },
    "seasonal_wardrobe": {
        "cron": "0 0 1 */3 *",  # Quarterly
        "mission_type": "shopping",
        "goal_template": "Seasonal wardrobe refresh for {season}",
        "enabled_for_users": "opted_in"
    },
    "birthday_planning": {
        "cron": "0 0 * * *",  # Daily check
        "mission_type": "events",
        "goal_template": "Plan birthday celebration for {contact_name}",
        "trigger_condition": "30_days_before_birthday",
        "enabled_for_users": "all"
    }
}

# Scheduler (runs as background job)
def schedule_mission_trigger():
    """Runs daily, checks all schedules"""
    for schedule_id, config in mission_schedules.items():
        if should_trigger(config["cron"]):
            # Get all users with this schedule enabled
            users = get_users_for_schedule(config["enabled_for_users"])

            for user_id in users:
                # Check trigger condition if exists
                if config.get("trigger_condition"):
                    if not check_condition(user_id, config["trigger_condition"]):
                        continue

                # Generate goal from template
                goal = render_goal_template(config["goal_template"], user_id)

                # Trigger mission
                trigger_mission(
                    mission_type=config["mission_type"],
                    user_id=user_id,
                    goal=goal,
                    trigger_source=f"schedule:{schedule_id}",
                    priority="medium"
                )
```

**Example Scenarios:**
- 1st of every month → Bill Review Agent triggers "Review electricity, internet, phone bills"
- 30 days before mom's birthday → Event Agent triggers "Plan birthday celebration"
- Start of each season → Shopping Agent triggers "Seasonal wardrobe refresh"

**3. User-initiated Triggers**

Direct user requests via dashboard.

**Implementation:**

```python
# API endpoint for user-initiated missions
@app.post("/api/missions/create")
def create_user_mission(request: MissionRequest):
    """User clicks 'Create Mission' in dashboard"""

    # Classify complexity
    complexity = classify_mission_complexity(request.goal)

    # Determine mission type (or let user specify)
    if request.mission_type:
        mission_type = request.mission_type
    else:
        # LLM classifies based on goal
        mission_type = llm.classify_mission_type(request.goal)

    # Trigger immediately (high priority)
    thread_id = trigger_mission(
        mission_type=mission_type,
        user_id=request.user_id,
        goal=request.goal,
        trigger_source="user_initiated",
        priority="urgent",  # User-initiated = highest priority
        complexity_override=complexity
    )

    return {
        "thread_id": thread_id,
        "status": "created",
        "estimated_completion": estimate_completion_time(complexity)
    }
```

**Example Scenarios:**
- User types "Find me a good Italian restaurant for Friday night" → Dining Agent triggers immediately
- User clicks "Plan my next vacation" → Travel Agent starts discovery conversation
- User says "Help me switch to a cheaper phone plan" → Bill Switching Agent triggers

**4. External Event Triggers**

Webhooks and integrations from external services.

**Implementation:**

```python
# Webhook handlers for external events
external_event_handlers = {
    "calendar": handle_calendar_event,
    "email": handle_email_event,
    "social": handle_social_event,
    "api_alerts": handle_api_alert
}

@app.post("/webhooks/{event_source}")
def handle_external_webhook(event_source: str, payload: dict):
    """Generic webhook handler for external events"""

    if event_source not in external_event_handlers:
        return {"error": "Unknown event source"}

    handler = external_event_handlers[event_source]
    handler(payload)

    return {"status": "processed"}

# Example: Calendar integration
def handle_calendar_event(payload):
    """Triggered when user adds event to calendar"""

    # Parse event
    event = payload["event"]

    # Check if event is in new city
    if event["location"]["city"] != user_home_city:
        # Trigger travel mission
        trigger_mission(
            mission_type="travel",
            user_id=payload["user_id"],
            goal=f"Plan trip to {event['location']['city']} for {event['title']}",
            trigger_source="external:calendar",
            priority="high",
            context={
                "event_date": event["start_date"],
                "event_duration": event["duration"],
                "location": event["location"]
            }
        )

# Example: Email integration (price drop alerts)
def handle_email_event(payload):
    """Triggered when specific email patterns detected"""

    # Parse email
    email = payload["email"]

    # Check for price drop alerts
    if "price drop" in email["subject"].lower():
        # Extract product info
        product = extract_product_from_email(email["body"])

        # Trigger shopping mission
        trigger_mission(
            mission_type="shopping",
            user_id=payload["user_id"],
            goal=f"Review price drop for {product['name']} and decide if should purchase",
            trigger_source="external:email",
            priority="high",
            context={"product": product, "price_drop": True}
        )

# Example: Social media integration
def handle_social_event(payload):
    """Triggered when friend tags city or event"""

    social_event = payload["event"]

    # Friend posted about visiting Paris
    if social_event["type"] == "location_tag":
        trigger_mission(
            mission_type="travel",
            user_id=payload["user_id"],
            goal=f"Research {social_event['location']} as potential travel destination",
            trigger_source="external:social",
            priority="low",  # Just a suggestion, not urgent
            context={
                "friend_name": social_event["friend"],
                "location": social_event["location"]
            }
        )
```

**Example Scenarios:**
- Calendar: Meeting scheduled in new city → Travel Agent triggers "Plan trip to San Francisco"
- Email: Flight price drop alert → Booking Agent triggers "Review and book flight"
- Social: Friend tagged Paris → Travel Agent triggers "Research Paris as destination"

### 7.2 Trigger Priority & Conflict Resolution

**Priority Levels:**

```python
TRIGGER_PRIORITIES = {
    "urgent": 1,      # User-initiated (immediate execution)
    "high": 2,        # External events with deadlines (execute within 24h)
    "medium": 3,      # Memory change triggers (execute within 3 days)
    "low": 4          # Schedule-based (execute on schedule)
}
```

**Conflict Resolution:**

```python
def resolve_mission_conflicts(pending_missions: list[Mission]) -> list[Mission]:
    """
    When multiple missions triggered simultaneously, resolve conflicts.
    Returns prioritized execution list.
    """

    # Sort by priority
    sorted_missions = sorted(
        pending_missions,
        key=lambda m: (
            TRIGGER_PRIORITIES[m.priority],  # Primary: Priority level
            m.deadline if m.deadline else datetime.max,  # Secondary: Deadline
            -calculate_user_value_score(m),  # Tertiary: Expected user value
            m.created_at  # Quaternary: FIFO
        )
    )

    # Check concurrency limits
    max_concurrent = get_user_setting("max_concurrent_missions", default=3)
    active_missions = get_active_missions(user_id)

    if len(active_missions) >= max_concurrent:
        # Queue new missions
        for mission in sorted_missions:
            add_to_queue(mission)
        return []

    else:
        # Execute top N
        available_slots = max_concurrent - len(active_missions)
        to_execute = sorted_missions[:available_slots]
        to_queue = sorted_missions[available_slots:]

        for mission in to_queue:
            add_to_queue(mission)

        return to_execute

def calculate_user_value_score(mission: Mission) -> float:
    """
    Estimate expected user value for mission prioritization.
    Uses historical completion rates and user preferences.
    """

    # Get historical data
    mission_learnings = store.get(("mission_learnings", mission.mission_type))
    user_prefs = store.get(("user_preferences", mission.user_id))
    ikigai = store.get(("ikigai_profile", mission.user_id))

    # Base score from completion rate
    completion_rate = mission_learnings.get("completion_rate", 0.5)
    score = completion_rate

    # Bonus if aligns with Ikigai
    if mission.mission_type in ikigai.get("preferred_mission_types", []):
        score += 0.2

    # Bonus if high past satisfaction
    avg_rating = mission_learnings.get("average_rating", 3.0)
    score += (avg_rating - 3.0) * 0.1  # +0.2 for 5-star, -0.1 for 2-star

    return score
```

**Queue Management:**

```python
# Mission queue (per user)
class MissionQueue:
    def __init__(self, user_id):
        self.user_id = user_id
        self.queue = []

    def add(self, mission: Mission):
        """Add mission to queue with priority"""
        self.queue.append(mission)
        self.queue.sort(key=lambda m: TRIGGER_PRIORITIES[m.priority])

    def pop_next(self) -> Mission:
        """Get next mission to execute"""
        if not self.queue:
            return None
        return self.queue.pop(0)

    def cancel(self, thread_id: str):
        """User cancels queued mission"""
        self.queue = [m for m in self.queue if m.thread_id != thread_id]

# Background worker checks queue
def mission_queue_worker():
    """Runs every 5 minutes, starts queued missions if slots available"""
    for user_id in get_all_users():
        active_count = len(get_active_missions(user_id))
        max_concurrent = get_user_setting(user_id, "max_concurrent_missions", default=3)

        if active_count < max_concurrent:
            queue = MissionQueue(user_id)
            next_mission = queue.pop_next()

            if next_mission:
                start_mission(next_mission)
```

---

## Feedback Processing

### 8.1 Hybrid Structured + Natural Language Feedback

**User Interface (Dashboard):**

```tsx
// Mission feedback component
interface MissionFeedbackProps {
  missionId: string;
  threadId: string;
}

function MissionFeedback({ missionId, threadId }: MissionFeedbackProps) {
  const [feedback, setFeedback] = useState({
    completion: null,
    quality: null,
    usefulness: null,
    nlText: ""
  });

  return (
    <div className="mission-feedback">
      {/* Structured: Completion Status */}
      <div className="feedback-section">
        <label>Mission Status:</label>
        <ButtonGroup>
          <Button onClick={() => setFeedback({...feedback, completion: "complete"})}>
            ✅ Mission Complete
          </Button>
          <Button onClick={() => setFeedback({...feedback, completion: "failed"})}>
            ❌ Mission Failed
          </Button>
          <Button onClick={() => setFeedback({...feedback, completion: "paused"})}>
            ⏸️ Pause for Now
          </Button>
        </ButtonGroup>
      </div>

      {/* Structured: Quality Rating */}
      <div className="feedback-section">
        <label>How satisfied are you with the results?</label>
        <StarRating
          value={feedback.quality}
          onChange={(rating) => setFeedback({...feedback, quality: rating})}
        />
      </div>

      {/* Structured: Usefulness */}
      <div className="feedback-section">
        <label>How useful was this mission?</label>
        <ButtonGroup>
          <Button onClick={() => setFeedback({...feedback, usefulness: "extremely_useful"})}>
            💯 Extremely Useful
          </Button>
          <Button onClick={() => setFeedback({...feedback, usefulness: "helpful"})}>
            👍 Helpful
          </Button>
          <Button onClick={() => setFeedback({...feedback, usefulness: "neutral"})}>
            😐 Neutral
          </Button>
          <Button onClick={() => setFeedback({...feedback, usefulness: "not_useful"})}>
            👎 Not Useful
          </Button>
        </ButtonGroup>
      </div>

      {/* Optional: Natural Language */}
      <div className="feedback-section">
        <label>Tell us more (optional):</label>
        <textarea
          placeholder="Any additional feedback or preferences we should know?"
          value={feedback.nlText}
          onChange={(e) => setFeedback({...feedback, nlText: e.target.value})}
        />
      </div>

      <Button onClick={() => submitFeedback(threadId, feedback)}>
        Submit Feedback
      </Button>
    </div>
  );
}
```

**Backend Processing Logic:**

```python
def process_mission_feedback(thread_id: str, feedback: dict):
    """
    Process both structured and natural language feedback.
    Update mission state, Store learnings, and trigger follow-ups.
    """

    # 1. ALWAYS process structured feedback immediately
    update_mission_state(thread_id, {
        "completion_status": feedback["completion"],
        "quality_rating": feedback["quality"],
        "usefulness_rating": feedback["usefulness"],
        "feedback_received_at": datetime.now()
    })

    # Extract structured learnings
    mission_state = get_mission_state(thread_id)
    mission_type = mission_state["mission_type"]
    user_id = mission_state["user_id"]

    # Update Store: Mission learnings (aggregate across all users)
    mission_learnings = store.get(("mission_learnings", mission_type))
    mission_learnings["total_completions"] += 1
    mission_learnings["completion_rate"] = calculate_completion_rate(mission_learnings)
    mission_learnings["average_rating"] = calculate_avg_rating(mission_learnings, feedback["quality"])
    store.put(("mission_learnings", mission_type), mission_learnings)

    # Update Store: User's completed missions
    store.put(
        ("completed_missions", user_id),
        {
            "thread_id": thread_id,
            "mission_type": mission_type,
            "completed_at": datetime.now(),
            "quality_rating": feedback["quality"],
            "usefulness_rating": feedback["usefulness"]
        }
    )

    # 2. Process natural language ONLY if provided
    if feedback.get("nlText") and len(feedback["nlText"].strip()) > 0:
        # LLM analyzes sentiment and extracts preferences
        llm_analysis = llm.analyze_feedback(
            feedback_text=feedback["nlText"],
            mission_context={
                "goal": mission_state["mission_goal"],
                "type": mission_state["mission_type"],
                "results": mission_state.get("final_results")
            },
            prompt="""
            Analyze this user feedback and extract:
            1. Sentiment (positive/neutral/negative)
            2. Specific preferences mentioned
            3. Suggestions for improvement
            4. Any complaints or issues

            Format response as JSON:
            {
              "sentiment": "positive|neutral|negative",
              "preferences": {"category": "preference_text"},
              "suggestions": ["suggestion1", "suggestion2"],
              "complaints": ["complaint1"] or null
            }
            """
        )

        # Example analysis result:
        # {
        #   "sentiment": "positive",
        #   "preferences": {
        #     "dining.budget": "too expensive for a weeknight",
        #     "dining.vegetarian_variety": "important"
        #   },
        #   "suggestions": ["show more vegetarian options"],
        #   "complaints": null
        # }

        # 3. Update user preferences in Store
        user_prefs = store.get(("user_preferences", user_id))

        for category, preference in llm_analysis["preferences"].items():
            # Parse nested keys (e.g., "dining.budget" → user_prefs["dining"]["budget"])
            keys = category.split(".")
            current = user_prefs
            for key in keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]

            # Set preference
            current[keys[-1]] = preference

        store.put(("user_preferences", user_id), user_prefs)

        # 4. Flag for human review if contains complaint
        if llm_analysis.get("complaints"):
            alert_support_team(
                user_id=user_id,
                thread_id=thread_id,
                complaints=llm_analysis["complaints"],
                original_feedback=feedback["nlText"]
            )

    # 5. Resume mission thread if paused
    if feedback["completion"] == "paused":
        # Do nothing, thread remains in interrupted state
        pass

    elif feedback["completion"] == "complete":
        # Finalize mission
        finalize_mission(thread_id)

    elif feedback["completion"] == "failed":
        # Log failure, extract learnings
        log_mission_failure(thread_id, feedback)

def apply_learnings_to_next_mission(mission_type: str, user_id: str):
    """
    When next mission of same type starts, apply learnings.
    """

    # Get updated preferences
    user_prefs = store.get(("user_preferences", user_id))
    mission_learnings = store.get(("mission_learnings", mission_type))

    # Example: Next dining mission on Tuesday
    if mission_type == "dining":
        # Check if it's a weeknight
        if datetime.now().weekday() < 5:  # Monday-Friday
            # Apply weeknight budget constraint (from previous feedback)
            budget_constraint = user_prefs.get("dining", {}).get("weeknight_budget")
            if budget_constraint:
                # Filter restaurants by budget in mission planning
                return {"budget_filter": budget_constraint}

    return {}
```

**Example Feedback Loop:**

```
User completes "Find Italian Restaurant" mission:

Structured Feedback:
  - Completion: ✅ Mission Complete
  - Quality: ⭐⭐⭐ (3 stars)
  - Usefulness: 👍 Helpful

Natural Language Feedback:
  "Great recommendation but too expensive for a weeknight. Would prefer more vegetarian options on the menu."

Processing:
  1. Structured → Update mission_learnings["dining"]["completion_rate"]
  2. NL → LLM extracts:
     - preferences["dining"]["weeknight_budget"] = "lower than $50/person"
     - preferences["dining"]["vegetarian_variety"] = "important"
  3. Store updated with new preferences
  4. Mission marked complete

Next Dining Mission (Tuesday):
  Mission Agent queries Store → sees weeknight budget constraint
  → Filters restaurants: price <= $50/person AND vegetarian_friendly = true
  → Presents 3 options matching criteria
  → User: ⭐⭐⭐⭐⭐ "Perfect, exactly what I wanted!"
```

---

## Extensibility Framework

### 9.1 Plugin Architecture for New Mission Types

**Design Goal:** Add new mission types with ~200 lines of code, no changes to core orchestration logic.

**Plugin Structure:**

```
src/missions/plugins/
├── __init__.py
├── base_mission.py          # Abstract base class
├── shopping/
│   ├── __init__.py
│   ├── shopping_mission.py  # Implements BaseMission
│   ├── config.yaml          # Mission configuration
│   └── subagents/
│       ├── price_comparison.py
│       └── product_search.py
├── travel/
│   ├── __init__.py
│   ├── travel_mission.py
│   ├── config.yaml
│   └── subagents/
│       ├── flight_search.py
│       ├── hotel_search.py
│       └── activity_planner.py
└── fitness_coach/           # NEW MISSION TYPE (example)
    ├── __init__.py
    ├── fitness_mission.py
    ├── config.yaml
    └── subagents/
        ├── workout_planner.py
        └── nutrition_advisor.py
```

**Step-by-Step: Adding "Fitness Coach" Mission Type**

**Step 1: Define Mission Schema** (`fitness_mission.py`):

```python
from src.missions.plugins.base_mission import BaseMission, MissionState
from langgraph.graph import StateGraph
from typing import TypedDict, List

class FitnessState(MissionState):
    """Extends base MissionState with fitness-specific fields"""
    health_goals: List[str]
    current_fitness_level: str
    available_equipment: List[str]
    time_constraints: dict
    workout_plan: dict
    nutrition_plan: dict

class FitnessCoachMission(BaseMission):
    """
    Fitness Coach mission creates personalized workout and nutrition plans.
    Complexity: Level 2 (Coordinated)
    """

    mission_type = "fitness_coach"
    complexity_level = 2  # Coordinated (parallel workout + nutrition planning)

    required_context = [
        "user_health_goals",
        "current_fitness_level",
        "available_equipment",
        "time_constraints"
    ]

    def __init__(self):
        super().__init__()
        self.graph = self.build_graph()

    def build_graph(self) -> StateGraph:
        """Build Level 2 coordinated graph"""
        graph = StateGraph(FitnessState)

        # Nodes
        graph.add_node("assess", self.assess_current_state)
        graph.add_node("workout_plan", self.create_workout_plan)
        graph.add_node("nutrition_plan", self.create_nutrition_plan)
        graph.add_node("synthesize", self.synthesize_plans)
        graph.add_node("present", self.present_to_user)

        # Edges
        graph.set_entry_point("assess")
        graph.add_edge("assess", "workout_plan")
        graph.add_edge("assess", "nutrition_plan")  # Parallel execution
        graph.add_edge("workout_plan", "synthesize")
        graph.add_edge("nutrition_plan", "synthesize")
        graph.add_edge("synthesize", "present")

        return graph

    def assess_current_state(self, state: FitnessState) -> dict:
        """Query Store for user health data and preferences"""
        user_id = state["user_id"]

        # Get health goals from Store (or prompt user if not set)
        health_goals = store.get(("user_health_goals", user_id)) or self.prompt_user_for_goals()

        # Get current fitness level
        fitness_level = store.get(("user_fitness_level", user_id)) or "beginner"

        return {
            "health_goals": health_goals,
            "current_fitness_level": fitness_level,
            "available_equipment": store.get(("user_equipment", user_id)) or [],
            "time_constraints": store.get(("user_time_constraints", user_id)) or {"days_per_week": 3, "minutes_per_session": 45}
        }

    def create_workout_plan(self, state: FitnessState) -> dict:
        """Use workout planner subagent to create plan"""
        from .subagents.workout_planner import WorkoutPlanner

        planner = WorkoutPlanner()
        workout_plan = planner.generate_plan(
            goals=state["health_goals"],
            fitness_level=state["current_fitness_level"],
            equipment=state["available_equipment"],
            time_constraints=state["time_constraints"]
        )

        return {"workout_plan": workout_plan}

    def create_nutrition_plan(self, state: FitnessState) -> dict:
        """Use nutrition advisor subagent to create plan"""
        from .subagents.nutrition_advisor import NutritionAdvisor

        advisor = NutritionAdvisor()
        nutrition_plan = advisor.generate_plan(
            goals=state["health_goals"],
            dietary_restrictions=store.get(("user_preferences", state["user_id"])).get("dietary_restrictions", [])
        )

        return {"nutrition_plan": nutrition_plan}

    def synthesize_plans(self, state: FitnessState) -> dict:
        """Combine workout and nutrition into unified plan"""
        combined_plan = {
            "workout": state["workout_plan"],
            "nutrition": state["nutrition_plan"],
            "weekly_schedule": self.create_weekly_schedule(state)
        }

        return {"final_plan": combined_plan}

    def present_to_user(self, state: FitnessState) -> dict:
        """Format plan for dashboard presentation"""
        # This triggers interrupt() automatically
        return {
            "presentation": {
                "title": "Your Personalized Fitness Plan",
                "workout_summary": state["workout_plan"]["summary"],
                "nutrition_summary": state["nutrition_plan"]["summary"],
                "weekly_schedule": state["final_plan"]["weekly_schedule"],
                "call_to_action": "Ready to start? Click to begin tracking your progress."
            },
            "status": "awaiting_user_approval"
        }
```

**Step 2: Register Trigger Patterns** (`config.yaml`):

```yaml
mission_type: fitness_coach
enabled: true
complexity: 2

triggers:
  memory_change:
    - namespace: "user_health_goals"
      condition: "any_update"
    - namespace: "user_fitness_level"
      condition: "significant_change"

  schedule:
    - cron: "0 0 * * 1"  # Weekly on Monday
      goal_template: "Weekly fitness check-in and plan adjustment"

  user_initiated:
    - keywords: ["fitness", "workout", "exercise", "nutrition", "health"]

apis:
  - workout_database
  - nutrition_api
  - fitness_tracker_integration

default_priority: medium

required_store_namespaces:
  - user_health_goals
  - user_fitness_level
  - user_equipment
  - user_time_constraints
```

**Step 3: Implement Subagents** (`subagents/workout_planner.py`):

```python
class WorkoutPlanner:
    """Subagent for generating workout plans"""

    def generate_plan(self, goals, fitness_level, equipment, time_constraints):
        """
        Query workout database API and use LLM to personalize.
        """

        # API call to workout database
        exercises = workout_api.search(
            goals=goals,
            equipment=equipment,
            difficulty=fitness_level
        )

        # LLM personalizes based on constraints
        plan = llm.create_workout_plan(
            available_exercises=exercises,
            time_per_session=time_constraints["minutes_per_session"],
            days_per_week=time_constraints["days_per_week"],
            goals=goals,
            prompt="""
            Create a personalized workout plan using the available exercises.
            Ensure progressive overload and variety.
            Format as weekly schedule with sets/reps.
            """
        )

        return plan
```

**Step 4: Register in Mission Registry** (automatic via config.yaml):

```python
# src/missions/registry.py
import os
import yaml
from importlib import import_module

class MissionRegistry:
    """Auto-discovers and registers mission plugins"""

    def __init__(self):
        self.missions = {}
        self.load_all_plugins()

    def load_all_plugins(self):
        """Scan plugins/ directory and load all missions"""
        plugins_dir = "src/missions/plugins/"

        for mission_dir in os.listdir(plugins_dir):
            config_path = f"{plugins_dir}/{mission_dir}/config.yaml"

            if os.path.exists(config_path):
                # Load config
                with open(config_path, "r") as f:
                    config = yaml.safe_load(f)

                if config.get("enabled", True):
                    # Import mission class
                    module = import_module(f"src.missions.plugins.{mission_dir}.{mission_dir}_mission")
                    mission_class = getattr(module, f"{mission_dir.title().replace('_', '')}Mission")

                    # Register
                    self.missions[config["mission_type"]] = {
                        "class": mission_class,
                        "config": config
                    }

                    # Register triggers
                    self.register_triggers(config)

    def register_triggers(self, config):
        """Register all triggers for this mission type"""
        for trigger_type, triggers in config.get("triggers", {}).items():
            if trigger_type == "memory_change":
                for trigger in triggers:
                    register_memory_change_trigger(
                        namespace=trigger["namespace"],
                        condition=trigger["condition"],
                        mission_type=config["mission_type"]
                    )

            elif trigger_type == "schedule":
                for trigger in triggers:
                    register_schedule_trigger(
                        cron=trigger["cron"],
                        mission_type=config["mission_type"],
                        goal_template=trigger["goal_template"]
                    )

            elif trigger_type == "user_initiated":
                for trigger in triggers:
                    register_keyword_triggers(
                        keywords=trigger["keywords"],
                        mission_type=config["mission_type"]
                    )

    def get_mission(self, mission_type: str):
        """Instantiate mission class"""
        if mission_type not in self.missions:
            raise ValueError(f"Unknown mission type: {mission_type}")

        return self.missions[mission_type]["class"]()

# Global registry (loaded at startup)
registry = MissionRegistry()
```

**Result:** "Fitness Coach" mission type added with ~200 lines of code. No changes to core orchestration logic required.

**Testing New Mission Type:**

```python
# Test fitness mission
def test_fitness_mission():
    # Trigger via API
    response = client.post("/api/missions/create", json={
        "user_id": "user_12345",
        "mission_type": "fitness_coach",
        "goal": "Help me build strength and lose 10 lbs"
    })

    thread_id = response.json()["thread_id"]

    # Check mission state
    state = get_mission_state(thread_id)
    assert state["mission_type"] == "fitness_coach"
    assert state["complexity_level"] == 2

    # Simulate user providing health goals
    update_store(("user_health_goals", "user_12345"), ["build strength", "lose weight"])

    # Resume mission
    resume_mission(thread_id)

    # Mission should execute workout + nutrition planning in parallel
    # Then present combined plan
```

---

## Decentralization Migration Path

### 10.1 MVP: Fully Centralized (Acceptable for Proof of Concept)

**Architecture:**

```
┌─────────────────┐
│  User Browser   │
│  (React/Next.js)│
└────────┬────────┘
         │ HTTPS (TLS)
         ▼
┌─────────────────────────────┐
│  OwnYou Backend             │
│  (Node.js + Express)        │
│  - Mission API              │
│  - Trigger System           │
│  - Feedback Processing      │
└────────┬────────────────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PostgreSQL   │ │ LangGraph    │ │ LLM APIs     │
│ (Checkpointer│ │ Cloud        │ │ (OpenAI,     │
│  + Store)    │ │              │ │  Claude,     │
└──────────────┘ └──────────────┘ │  Gemini)     │
                                   └──────────────┘
```

**Privacy Considerations (MVP):**
- ✅ All user data encrypted at rest (AES-256)
- ✅ TLS for data in transit
- ✅ User can export all data (JSON format)
- ✅ User can delete all data (GDPR Article 17: Right to Erasure)
- ✅ Clear privacy policy: "We store your data to provide mission services. We do not sell or share your data with third parties."
- ⚠️ **Limitation**: Backend has access to raw user data (not self-sovereign)

**Acceptable for MVP because:**
- Faster time to market (no TEE integration complexity)
- Lower operational costs (no distributed infrastructure)
- Easier debugging and iteration
- Clear migration path documented (see below)

### 10.2 Phase 1: Hybrid (Client-side Processing for Simple Missions)

**Timeline:** 6-12 months after MVP launch

**Trigger:** When 20%+ of users request offline capability or privacy concerns surface

**Architecture:**

```
┌────────────────────────────────┐
│  User Browser                  │
│  - WebAssembly Runtime         │
│  - IndexedDB (encrypted)       │
│  - Simple Missions (Level 1)   │ ← Run locally
└────────┬───────────────────────┘
         │
         │ HTTPS (only for Level 2-3)
         ▼
┌─────────────────────────────┐
│  OwnYou Backend             │
│  - Coordinated Missions (2) │
│  - Complex Missions (3)     │
└─────────────────────────────┘
```

**What Runs Locally:**
- Level 1 Simple Missions (Shopping, Bill Switching)
- API calls still go through backend (CORS proxy)
- Results processed in browser
- Local LLM via WebAssembly (e.g., LLaMA.cpp)

**What Stays Server-side:**
- Level 2-3 missions (require orchestration, file system)
- Store and Checkpointer (centralized memory)

**Migration Steps:**
1. Compile mission logic to WebAssembly
2. Implement local Store (IndexedDB with encryption)
3. Add sync mechanism (local ↔ server when online)
4. Progressive enhancement (fallback to server if browser incompatible)

### 10.3 Phase 2: Confidential Computing (TEE Integration)

**Timeline:** 12-24 months after MVP launch

**Trigger:** When TEE node costs drop below $50/month per user OR 30%+ users willing to pay premium for privacy

**Architecture:**

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │ HTTPS
         ▼
┌──────────────────────────────────┐
│  TEE Node (AMD SEV / Intel SGX)  │
│  - Encrypted Memory (attestable) │
│  - Mission Orchestration         │
│  - LLM Inference (inside TEE)    │
│  - Store + Checkpointer          │
└──────────────────────────────────┘
         │
         │ Encrypted channel
         ▼
┌──────────────────┐
│  External APIs   │
│  (Flights, Hotels│
│   Restaurants)   │
└──────────────────┘
```

**Key Benefits:**
- Backend cannot access raw user data (memory encrypted)
- Attestation proves code hasn't been tampered with
- User controls TEE node (can run on own hardware or rent)

**Implementation:**
- Use [Confidential Containers](https://github.com/confidential-containers) for Kubernetes
- Run LangGraph workflows inside TEE
- Encrypt Store/Checkpointer data with user-controlled keys

**Migration Steps:**
1. Package backend as confidential container
2. Implement remote attestation
3. Deploy TEE nodes (AWS Nitro Enclaves, Azure Confidential Computing)
4. Migrate users progressively (opt-in for early adopters)

### 10.4 Phase 3: Fully Decentralized (Blockchain-backed)

**Timeline:** 24+ months after MVP launch

**Trigger:** When blockchain gas fees drop below $0.01/transaction OR regulatory requirements demand self-sovereign architecture

**Architecture:**

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│  Personal TEE Node           │
│  (User-controlled hardware)  │
│  - Mission Orchestration     │
│  - Local LLM                 │
│  - IPFS Client               │
└──────┬───────────────────────┘
       │
       ├─────────────┬──────────────┐
       ▼             ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ IPFS       │ │ Blockchain │ │ External   │
│ (encrypted │ │ (state     │ │ APIs       │
│  artifacts)│ │  commits)  │ │            │
└────────────┘ └────────────┘ └────────────┘
```

**Key Components:**

**1. Personal TEE Node:**
- User runs own node (Raspberry Pi, NUC, cloud VM)
- All mission data stays on user's hardware
- LLM inference runs locally (or via decentralized inference network)

**2. IPFS (Distributed Storage):**
- Mission artifacts (itineraries, plans) encrypted and stored on IPFS
- User has IPFS CID (content identifier) for retrieval
- No central server has raw files

**3. Blockchain (State Commitments Only):**
- Store mission state hashes (not raw data)
- Used for:
  - Advertising interactions (BBS+ pseudonyms, see Appendix D)
  - Mission completion proofs (for gamification/rewards)
  - Decentralized identity (DID)

**Privacy Guarantees:**
- ✅ User controls all data (self-sovereign)
- ✅ No central server can access mission contents
- ✅ Blockchain only sees hashes (zero-knowledge proofs)
- ✅ Advertising tracking via BBS+ pseudonyms (unlinkable)

**Implementation:**
- Use [LangGraph Platform](https://langchain-ai.github.io/langgraph/cloud/) with custom checkpointer
- Implement IPFS checkpointer (state stored as encrypted IPFS files)
- Smart contracts for mission state commitments
- Decentralized inference via [Fetch.ai](https://fetch.ai/) or [Ocean Protocol](https://oceanprotocol.com/)

**Migration Steps:**
1. Develop personal node software (Docker image)
2. Implement IPFS checkpointer
3. Deploy smart contracts for state commitments
4. Create migration tool (export from centralized → import to personal node)
5. Sunset centralized backend after 80%+ user migration

### 10.5 Migration Decision Matrix

| Metric | Centralized (MVP) | Hybrid (Phase 1) | TEE (Phase 2) | Decentralized (Phase 3) |
|--------|-------------------|------------------|---------------|-------------------------|
| **Privacy** | Low (server sees all) | Medium (simple missions private) | High (encrypted memory) | Highest (self-sovereign) |
| **Cost per user** | $2-5/month | $3-7/month | $20-50/month | $10-30/month (user pays) |
| **Latency** | <500ms | <500ms (local), <1s (server) | <1s | <2s (IPFS + blockchain) |
| **Dev complexity** | Low | Medium | High | Very High |
| **User setup** | None (just signup) | None | Minimal (rent TEE node) | High (run own node) |
| **Market readiness** | Now | 6-12 months | 12-24 months | 24+ months |

**Recommended Migration Triggers:**

1. **Move to Phase 1 (Hybrid)** when:
   - 20%+ users request offline capability
   - Privacy concerns surface in user feedback
   - Competitors launch local-first features

2. **Move to Phase 2 (TEE)** when:
   - TEE node costs drop below $50/month per user
   - 30%+ users willing to pay premium ($10+/month) for privacy
   - Enterprise customers require confidential computing

3. **Move to Phase 3 (Decentralized)** when:
   - Blockchain gas fees drop below $0.01/transaction
   - Regulatory requirements demand self-sovereign architecture
   - 50%+ users want full control over their nodes

**Documented in Codebase:**

```markdown
# docs/decentralization_roadmap.md

## Current Phase: Centralized MVP

All user data stored on OwnYou backend. This is acceptable for proof of concept.

## Future Phases:

See `docs/plans/mission_agents_architecture.md` Section 10 for detailed migration plan.

## Migration Triggers:

Track these metrics in dashboard:
- User requests for offline capability
- Privacy concern tickets
- TEE node costs (monthly check)
- Blockchain gas fees (weekly check)
- User willingness to pay for privacy (quarterly survey)

When trigger thresholds met → Initiate migration to next phase.
```

---

## Implementation Roadmap

### 11.1 MVP Scope (3-4 months)

**Goal:** Demonstrate mission agents working end-to-end with 3 mission types.

**Deliverables:**

1. **Core Infrastructure** (4 weeks)
   - LangGraph integration (Store + PostgreSQL Checkpointer)
   - Mission orchestration layer (complexity classification, thread lifecycle)
   - Trigger system (memory change + user-initiated only for MVP)
   - Feedback processing (structured + NL)

2. **Mission Types** (4 weeks)
   - Level 1: Shopping (simple price comparison)
   - Level 2: Dining (restaurant search with parallel APIs)
   - Level 3: Travel (full planning with hierarchical coordination)

3. **Dashboard Integration** (3 weeks)
   - Mission cards UI
   - Feedback interface (structured buttons + optional text)
   - Mission status tracking (in-progress, interrupted, completed)
   - Basic analytics (completion rate, avg rating)

4. **Testing & Iteration** (2 weeks)
   - End-to-end testing with 10 beta users
   - Fix critical bugs
   - Iterate on feedback processing based on beta results

**Out of Scope for MVP:**
- Schedule-based triggers (add in post-MVP)
- External event triggers (add in post-MVP)
- Ikigai discovery (add in post-MVP, focus on basic preferences)
- Decentralization (fully centralized MVP acceptable)

### 11.2 Post-MVP Enhancements (6-12 months)

**Phase 1: Expand Mission Types** (2 months)
- Add 5 new mission types: Events, Bill Switching, Fitness Coach, Home Services, Gift Planning
- Plugin architecture for easy addition
- Community contributions (open-source mission plugins)

**Phase 2: Advanced Triggers** (2 months)
- Schedule-based triggers (cron)
- External event triggers (calendar, email, social)
- Trigger priority & conflict resolution
- Mission queue management

**Phase 3: Ikigai Integration** (2 months)
- Ikigai discovery questionnaire
- Continuous refinement from mission feedback
- Mission type expansion based on Ikigai
- Personalized mission recommendations

**Phase 4: Performance Optimization** (2 months)
- Reduce LLM API costs (caching, prompt optimization)
- Improve latency (parallel execution, streaming)
- Scale testing (1000+ concurrent users)
- Monitoring & alerting

### 11.3 Decentralization Roadmap (12-24 months)

See Section 10 for detailed migration plan.

---

## Success Metrics

### 12.1 Primary Metric: Mission Completion Rate

**Definition:** Percentage of missions that reach "completed" status with positive feedback.

**Target:** 70%+ completion rate across all mission types.

**Measurement:**

```python
def calculate_completion_rate(mission_type: str = None, timeframe_days: int = 30):
    """
    Calculate mission completion rate.

    Args:
        mission_type: Filter by mission type (None = all types)
        timeframe_days: Calculate over last N days
    """

    missions = db.query(f"""
        SELECT
            mission_type,
            COUNT(*) as total,
            SUM(CASE WHEN state->>'status' = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN state->>'status' = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN state->>'status' = 'abandoned' THEN 1 ELSE 0 END) as abandoned
        FROM checkpoints
        WHERE updated_at > NOW() - INTERVAL '{timeframe_days} days'
        {f"AND state->>'mission_type' = '{mission_type}'" if mission_type else ""}
        GROUP BY mission_type
    """)

    results = {}
    for row in missions:
        completion_rate = (row["completed"] / row["total"]) * 100 if row["total"] > 0 else 0
        results[row["mission_type"]] = {
            "completion_rate": completion_rate,
            "total_missions": row["total"],
            "completed": row["completed"],
            "failed": row["failed"],
            "abandoned": row["abandoned"]
        }

    return results
```

**Breakdown by Complexity:**
- Level 1 (Simple): Target 85%+ (straightforward, should have high success)
- Level 2 (Coordinated): Target 70%+ (moderate complexity)
- Level 3 (Complex): Target 60%+ (multi-step, user might abandon)

### 12.2 Secondary Metrics

**1. User Utility Rating (5-star scale)**

**Target:** 4.0+ average across all missions

```python
def calculate_avg_utility_rating(mission_type: str = None):
    """Average quality rating from user feedback"""
    ratings = db.query(f"""
        SELECT AVG((state->'feedback'->>'quality')::int) as avg_rating
        FROM checkpoints
        WHERE state->'feedback'->>'quality' IS NOT NULL
        {f"AND state->>'mission_type' = '{mission_type}'" if mission_type else ""}
    """)
    return ratings[0]["avg_rating"]
```

**2. Mission Type Diversity**

**Target:** Users engage with 3+ different mission types per month

```python
def calculate_mission_diversity(user_id: str, timeframe_days: int = 30):
    """Count unique mission types user engaged with"""
    diversity = db.query(f"""
        SELECT COUNT(DISTINCT state->>'mission_type') as unique_types
        FROM checkpoints
        WHERE state->>'user_id' = '{user_id}'
        AND updated_at > NOW() - INTERVAL '{timeframe_days} days'
    """)
    return diversity[0]["unique_types"]
```

**3. Feedback Provision Rate**

**Target:** 60%+ of completed missions receive feedback

```python
def calculate_feedback_rate():
    """Percentage of completed missions with feedback"""
    feedback_stats = db.query("""
        SELECT
            COUNT(*) as total_completed,
            SUM(CASE WHEN state->'feedback' IS NOT NULL THEN 1 ELSE 0 END) as with_feedback
        FROM checkpoints
        WHERE state->>'status' = 'completed'
    """)

    total = feedback_stats[0]["total_completed"]
    with_feedback = feedback_stats[0]["with_feedback"]

    return (with_feedback / total) * 100 if total > 0 else 0
```

**4. Time to Completion**

**Target:**
- Level 1: <5 minutes
- Level 2: <30 minutes
- Level 3: <7 days (from trigger to final user approval)

```python
def calculate_avg_completion_time(complexity_level: int):
    """Average time from mission start to completion"""
    times = db.query(f"""
        SELECT AVG(
            EXTRACT(EPOCH FROM (updated_at - created_at))
        ) as avg_seconds
        FROM checkpoints
        WHERE state->>'status' = 'completed'
        AND state->>'complexity_level' = '{complexity_level}'
    """)

    avg_seconds = times[0]["avg_seconds"]
    return {
        "seconds": avg_seconds,
        "minutes": avg_seconds / 60,
        "hours": avg_seconds / 3600,
        "days": avg_seconds / 86400
    }
```

### 12.3 Operational Metrics

**1. LLM API Costs per Mission**

**Target:** <$0.50 per mission on average

```python
def calculate_cost_per_mission():
    """Track LLM API costs"""
    costs = db.query("""
        SELECT
            state->>'mission_type' as mission_type,
            AVG((metadata->>'total_cost')::float) as avg_cost_per_mission
        FROM checkpoints
        WHERE metadata->>'total_cost' IS NOT NULL
        GROUP BY state->>'mission_type'
    """)
    return costs
```

**2. Error Rate**

**Target:** <5% of missions fail due to errors (vs user abandonment)

```python
def calculate_error_rate():
    """Percentage of missions that failed due to system errors"""
    errors = db.query("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN state->>'failure_reason' = 'system_error' THEN 1 ELSE 0 END) as system_errors
        FROM checkpoints
        WHERE state->>'status' = 'failed'
    """)

    return (errors[0]["system_errors"] / errors[0]["total"]) * 100 if errors[0]["total"] > 0 else 0
```

---

## Appendices

### Appendix A: Research Paper Summary

**Title:** "Fundamentals of Building Autonomous LLM Agents"
**Source:** `/docs/Brainstorming/brainstorming_mission_agents/2510.09244v1 (1).pdf`

**Key Takeaways Applied to Mission Agents:**

1. **Multi-Agent Specialization:**
   - Separate agents for Planning, Reflection, Memory, Action, HCI
   - Our architecture uses specialized mission agents (Travel, Shopping, etc.) with coordinator subagents

2. **Task Decomposition (DPPM):**
   - Decompose → Plan in Parallel → Merge
   - Implemented in Level 3 Complex Missions (hierarchical supervision)

3. **Reflection Mechanisms:**
   - Self-evaluation: Confidence scoring at each phase
   - Error detection: Evidence validation before Store updates
   - Anticipatory reflection: "What could go wrong?" checks

4. **Memory Architecture:**
   - Long-term: LangGraph Store (RAG with semantic search)
   - Short-term: PostgreSQL Checkpointer (thread state)
   - Embodied learning: Mission learnings extracted to Store

5. **Human-in-the-Loop:**
   - interrupt() function at phase boundaries
   - User can pause for days/weeks, resume with full context
   - Multiple interaction rounds (draft → feedback → refine)

### Appendix B: Ikigai Framework

**Source:** `/docs/Brainstorming/brainstorming_mission_agents/Ikigai (brainstorm copy).md`

**Core Principles:**
- Focus on daily life joys (not grand life purpose)
- Connection to external world (interaction with others)
- Giving over receiving (helping others = fulfillment)
- Fluidity and growth (interests change over time)
- Action-oriented (actively pursuing what brings joy)

**Applied to Mission Agents:**

1. **Ikigai Discovery Questions** (initial user onboarding):
   - Who do you most want to help?
   - What problems/desires do they have?
   - What solutions excite you most?
   - What are you naturally good at?
   - What do you look forward to?
   - What gets you into flow state?
   - What do you enjoy learning about?

2. **Mission Personalization:**
   - Prioritize missions aligned with user's Ikigai
   - Expand mission types based on learning interests
   - Track changing interests (fluidity principle)

3. **Example:**
   - User Ikigai: "Helping elderly neighbors" + "Event planning"
   - Mission Agent suggests: "Organize senior community lunch"
   - This mission has higher priority than generic missions

### Appendix C: LangGraph Best Practices

**Source:** LangGraph documentation research (via Explore subagent)

**Key Patterns Applied:**

1. **Supervisor vs Hierarchical:**
   - Simple/Coordinated: Flat supervisor
   - Complex: Hierarchical (top → mid-level → workers)

2. **Memory Namespaces:**
   - User-specific: `("user_preferences", user_id)`
   - Cross-user: `("mission_learnings", mission_type)`
   - Tuple-based organization for isolation

3. **Interrupt Strategy:**
   - `interrupt_before=["node_name"]` for user input points
   - Checkpoint every phase boundary
   - Resume via `thread_id` + `checkpoint_id`

4. **Deep Agent File System:**
   - Level 3 missions use file system for artifacts
   - `/missions/{thread_id}/` structure
   - Persistent across interrupts

### Appendix D: BBS+ Pseudonyms for Advertising

**Source:** `/docs/Brainstorming/brainstorming_mission_agents/* OwnYou Advertising MVP vision, core journey and technical specification (brainstorm copy).md`

**How Mission Agents Connect to Advertising:**

1. **Separate Workflows:**
   - Mission Agents: User-facing utility (trips, dining, shopping)
   - IAB Taxonomy: Backend profiling for advertising (separate from missions)

2. **BBS+ Signatures:**
   - User generates unlinkable pseudonyms for ad interactions
   - Advertisers cannot track user across sessions
   - User consents to each advertising interaction

3. **Mission Agents DO NOT:**
   - Send data to advertisers
   - Use mission contents for ad targeting
   - Share Store data outside user's control

4. **Future Integration:**
   - When user consents to advertising, IAB profile (from email parser) is used
   - Mission Agents could suggest "Earn rewards by viewing ads" as optional missions
   - But this is separate MVP from Mission Agents

### Appendix E: Related Documents

**Companion Architecture Document:**
- **`docs/plans/end-to-end-architecture.md`** - End-to-End Architecture
  - Section 1: System integration (Mission Memory, IAB vs Mission Agents)
  - Section 2: **Mission Card Pydantic schemas** (implementation-ready data models)
  - Section 3: Mission Agent architecture summary (references this document)

**Product Requirements:**
- `docs/Brainstorming/brainstorming_mission_agents/*OwnYou Consumer App Requirements (brainstorm copy).md` - Product vision and requirements

**Research & Philosophy:**
- `docs/Brainstorming/brainstorming_mission_agents/2510.09244v1 (1).pdf` - LLM Agents research paper
- `docs/Brainstorming/brainstorming_mission_agents/Ikigai (brainstorm copy).md` - Ikigai philosophy
- `docs/Brainstorming/brainstorming_mission_agents/LangGraph Memory.md` - LangGraph Store patterns

**Other Specifications:**
- `docs/Brainstorming/brainstorming_mission_agents/* OwnYou Advertising MVP vision, core journey and technical specification (brainstorm copy).md` - Advertising workflow
- `CLAUDE.md` - Codebase overview and development guide

**Current Implementation:**
- `src/email_parser/workflow/graph.py` - IAB classification workflow (reference for LangGraph patterns)
- `src/email_parser/memory/schemas.py` - Current memory schemas (to be extended)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-04 | Initial design approved after brainstorming session |

---

## Next Steps

1. **Review & Approve:** Stakeholders review this design document
2. **Implementation Planning:** Create detailed sprint plan for MVP (see Section 11.1)
3. **Prototype:** Build proof-of-concept for 1 mission type (Travel recommended for complexity)
4. **Beta Testing:** 10 users test MVP for 2 weeks
5. **Iterate:** Adjust based on beta feedback
6. **Launch:** Release MVP with 3 mission types

**Questions or Feedback:** Contact architecture team or open issue in project repository.
