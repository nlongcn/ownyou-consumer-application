---
name: langgraph-workflow-development
description: Build LangGraph agent workflows for OwnYou following architectural patterns (Simple/Coordinated/Complex levels). Use when creating new mission agents, IAB classifiers, or any LangGraph workflow. Ensures proper state management, Store integration, and testing.
---

# LangGraph Workflow Development for OwnYou

Build LangGraph agent workflows following OwnYou architectural patterns.

## When to Use This Skill

- Creating new mission agents (Shopping, Restaurant, Travel, etc.)
- Building IAB classification workflows
- Extending existing LangGraph graphs
- Any task involving LangGraph state, nodes, or graphs

## Prerequisites

Before starting, verify:
- [ ] Phase 1 contracts defined (data models, Store schema)
- [ ] Mission type determined (which category: Savings/Ikigai/Health)
- [ ] Complexity level identified (1=Simple, 2=Coordinated, 3=Complex)
- [ ] Store namespace allocated for this agent

## Pattern Selection

**Level 1 - Simple (Shopping, Bill, Services, Cooking, Content)**
- Direct execution: Execute → Filter → Present → Interrupt
- Single external API call
- Immediate result presentation
- Example: Shopping Agent finding product deals

**Level 2 - Coordinated (Restaurant, Event)**
- Parallel API coordination: Plan → [Parallel APIs] → Aggregate → Rank → Present
- Multiple API calls, results aggregated
- Ranking/filtering after aggregation
- Example: Restaurant Agent querying Tripadvisor + Yelp + Google

**Level 3 - Complex (Travel)**
- Hierarchical planning: Deep Planning → [Hierarchical Coordinators] → Synthesis → Multi-round iteration
- Supervisor agent + sub-agents
- File system for artifacts
- Multiple refinement rounds
- Example: Travel Agent coordinating flights + hotels + activities

**Selection rule:** Start with Level 1. Only increase complexity if truly needed.

## Implementation Checklist

### Step 1: Define State (TypedDict)

```python
# src/mission_agents/agents/{mission_type}/state.py
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator

class {MissionType}State(TypedDict):
    """State for {MissionType} mission agent"""

    # Mission identity
    mission_goal: str
    user_id: str
    thread_id: Optional[str]

    # IAB context (ALWAYS include - triggers from IAB classifications)
    iab_classifications: Optional[List[Dict[str, Any]]]

    # Store context (read from relevant namespaces)
    user_preferences: Optional[Dict[str, Any]]
    # ... add mission-specific preference namespaces

    # Parameters (from trigger or user)
    # ... mission-specific parameters

    # Results (use operator.add for append-only lists)
    api_results: Annotated[List[Dict[str, Any]], operator.add]
    filtered_results: List[Dict[str, Any]]
    selected_result: Optional[Dict[str, Any]]

    # Execution state
    current_step: Optional[str]
    error: Optional[str]
    awaiting_user: bool
    user_action: Optional[str]
```

**Critical:**
- ALWAYS include `iab_classifications` (even if not used yet)
- ALWAYS include `user_preferences`
- Use `Annotated[List, operator.add]` for append-only lists
- Use `Optional` for nullable fields

### Step 2: Create Nodes

```python
# src/mission_agents/agents/{mission_type}/nodes.py
from src.mission_agents.agents.{mission_type}.state import {MissionType}State
from src.mission_agents.models.mission_card import MissionCard, {CardType}Data

def execute_node(state: {MissionType}State) -> Dict[str, Any]:
    """Execute primary action (API call, search, etc.)"""
    try:
        # 1. Extract parameters from state
        # 2. Call external API or perform action
        # 3. Return state updates

        return {
            "api_results": results,
            "current_step": "filter",
            "error": None
        }
    except Exception as e:
        return {
            "error": f"Execution failed: {str(e)}",
            "current_step": "error"
        }

def filter_node(state: {MissionType}State) -> Dict[str, Any]:
    """Filter results by preferences"""
    api_results = state["api_results"]
    preferences = state.get("user_preferences", {})

    # Apply filtering logic
    filtered = [r for r in api_results if meets_criteria(r, preferences)]

    return {
        "filtered_results": filtered,
        "selected_result": filtered[0] if filtered else None,
        "current_step": "present"
    }

def present_node(state: {MissionType}State) -> Dict[str, Any]:
    """Create Mission Card from results"""
    selected = state["selected_result"]

    if not selected:
        return {
            "error": "No results found",
            "current_step": "complete",
            "awaiting_user": False
        }

    # Create card data
    card_data = {CardType}Data(
        # ... populate from selected result
    )

    # Determine trigger type
    iab_classifications = state.get("iab_classifications", [])
    if iab_classifications:
        trigger_type = TriggerType.IAB_PROFILE_CHANGE
        trigger_details = {
            "taxonomy_id": iab_classifications[0]["taxonomy_id"],
            "confidence": iab_classifications[0]["confidence"]
        }
    else:
        trigger_type = TriggerType.USER_REQUEST
        trigger_details = {"source": "user_initiated"}

    # Create Mission Card
    mission_card = MissionCard(
        mission_id=f"mission_{mission_type}_{uuid.uuid4().hex[:8]}",
        user_id=state["user_id"],
        thread_id=state.get("thread_id", ""),
        card_type="{category}_{mission_type}",
        agent_type="{mission_type}_agent",
        category=CardCategory.{CATEGORY},
        complexity_level={1|2|3},
        state=MissionState.ACTIVE,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        trigger_type=trigger_type,
        trigger_details=trigger_details,
        memory_context={
            "iab_classifications": iab_classifications,
            "user_preferences": state.get("user_preferences", {})
        },
        card_data=card_data.dict()
    )

    return {
        "mission_card": mission_card.dict(),
        "awaiting_user": True,
        "current_step": "interrupt"
    }
```

**Node Checklist:**
- [ ] Error handling with try/except
- [ ] State updates return dictionaries (not full state)
- [ ] Mission Card includes trigger provenance
- [ ] Memory context included in Mission Card

### Step 3: Build Graph

```python
# src/mission_agents/agents/{mission_type}/graph.py
from langgraph.graph import StateGraph, END
from src.mission_agents.agents.{mission_type}.state import {MissionType}State
from src.mission_agents.agents.{mission_type}.nodes import (
    execute_node,
    filter_node,
    present_node
)

def create_{mission_type}_graph() -> StateGraph:
    """Create {MissionType} Agent graph"""
    graph = StateGraph({MissionType}State)

    # Add nodes
    graph.add_node("execute", execute_node)
    graph.add_node("filter", filter_node)
    graph.add_node("present", present_node)

    # Define flow
    graph.set_entry_point("execute")
    graph.add_edge("execute", "filter")
    graph.add_edge("filter", "present")
    graph.add_edge("present", END)

    return graph
```

**Graph Checklist:**
- [ ] Entry point set
- [ ] All nodes connected
- [ ] END node reachable
- [ ] No circular loops (unless intentional for Level 3)

### Step 4: Write Tests

```python
# tests/mission_agents/agents/{mission_type}/test_{mission_type}_agent.py
import pytest
from src.mission_agents.agents.{mission_type}.graph import create_{mission_type}_graph

def test_{mission_type}_with_iab_context():
    """Test agent uses IAB classifications"""
    graph = create_{mission_type}_graph()
    compiled = graph.compile()

    initial_state = {MissionType}State(
        mission_goal="Test goal",
        user_id="user_test",
        thread_id="thread_test",
        iab_classifications=[
            {"taxonomy_id": "IAB1-1", "confidence": 0.85}
        ],
        # ... other required fields
    )

    result = compiled.invoke(initial_state)

    assert result["current_step"] == "interrupt"
    assert result["awaiting_user"] is True
    assert "mission_card" in result
    assert result["mission_card"]["trigger_type"] == "iab_profile_change"

def test_{mission_type}_no_results():
    """Test graceful handling when no results found"""
    # ... test error states
```

**Test Checklist:**
- [ ] Test with IAB trigger
- [ ] Test with user-initiated trigger
- [ ] Test error conditions
- [ ] Test empty results
- [ ] Test state transitions

### Step 5: Integrate with Orchestrator

```python
# src/mission_agents/orchestrator.py

# 1. Add to agents dictionary
self.agents = {
    "shopping": create_shopping_graph(),
    "{mission_type}": create_{mission_type}_graph(),  # NEW
}

# 2. Add routing logic
def _execute_{mission_type}_mission(self, event: TriggerEvent) -> bool:
    """Execute {mission_type} mission"""
    # Extract IAB context
    iab_classifications = []
    if event.trigger_type == "iab_profile_change":
        taxonomy_id = event.data.get("taxonomy_id")
        if taxonomy_id:
            classification = self.store.get_iab_classification(
                event.user_id, taxonomy_id
            )
            if classification:
                iab_classifications.append(classification)

    # Get user preferences from Store
    user_preferences = self.store.get_{mission_type}_preferences(event.user_id)

    # Create initial state
    initial_state = {MissionType}State(
        mission_goal=event.data.get("mission_goal", ""),
        user_id=event.user_id,
        thread_id=f"thread_{event.user_id}_{event.timestamp.timestamp()}",
        iab_classifications=iab_classifications,
        user_preferences=user_preferences or {},
        # ... other fields
    )

    # Execute graph
    graph = self.agents["{mission_type}"]
    compiled = graph.compile()
    result = compiled.invoke(initial_state)

    if "mission_card" in result:
        # TODO: Save to mission cards database
        return True

    return False

# 3. Update _process_event to route to new mission type
def _process_event(self, event: TriggerEvent) -> bool:
    mission_type = event.mission_type or self._infer_mission_type(event)

    if mission_type == "{mission_type}":
        return self._execute_{mission_type}_mission(event)
    # ... existing routing
```

### Step 6: Add IAB Taxonomy Mapping

```python
# src/mission_agents/triggers/memory_change.py

IAB_TO_MISSION_TYPE = {
    "IAB1": "shopping",
    "IAB8": "{mission_type}",  # NEW: Map relevant IAB categories
    # ... other mappings
}
```

**Integration Checklist:**
- [ ] Agent added to orchestrator.agents
- [ ] Routing function implemented
- [ ] IAB taxonomy mapped
- [ ] Store preferences method exists
- [ ] Integration test passes

## Store Integration Pattern

**Reading from Store:**
```python
# In node or orchestrator
user_prefs = self.store.get_user_preferences(user_id)
mission_prefs = self.store.get_{mission_type}_preferences(user_id)
iab_classes = self.store.get_all_iab_classifications(user_id)
```

**Writing to Store:**
```python
# After mission completion or user feedback
self.store.put_{mission_type}_preferences(
    user_id,
    updated_preferences
)
```

**Store Namespace Convention:**
- User preferences: `(ownyou.{mission_type}_preferences, {user_id})`
- Mission learnings: `(ownyou.mission_learnings, {mission_type})`
- Completed missions: `(ownyou.completed_missions, {user_id})`

## Common Patterns

**Parallel API Calls (Level 2):**
```python
from langgraph.graph import StateGraph

graph = StateGraph(State)

# Parallel fan-out
graph.add_node("call_api_1", node1)
graph.add_node("call_api_2", node2)
graph.add_node("call_api_3", node3)
graph.add_node("aggregate", aggregate_node)

graph.set_entry_point("plan")
graph.add_edge("plan", "call_api_1")
graph.add_edge("plan", "call_api_2")
graph.add_edge("plan", "call_api_3")
graph.add_edge("call_api_1", "aggregate")
graph.add_edge("call_api_2", "aggregate")
graph.add_edge("call_api_3", "aggregate")
```

**Multi-Round Refinement (Level 3):**
```python
def should_refine(state: State) -> str:
    """Conditional edge for refinement"""
    if state["refinement_rounds"] < 3 and not state["user_satisfied"]:
        return "refine"
    return "complete"

graph.add_conditional_edges(
    "present",
    should_refine,
    {"refine": "planning", "complete": END}
)
```

## Debugging with LangGraph Studio

Start Studio: `langgraph dev`

In Studio you can:
- Visualize graph structure
- Inspect state at each node
- Time-travel debug past executions
- Trace evidence trails

## Validation Checklist

Before considering agent complete:

- [ ] State definition includes all required fields
- [ ] All nodes have error handling
- [ ] Mission Card includes trigger provenance
- [ ] Tests cover IAB-triggered and user-initiated paths
- [ ] Integrated with orchestrator
- [ ] IAB taxonomy mapped (if applicable)
- [ ] Store namespace documented
- [ ] Integration test passes
- [ ] Debugged in LangGraph Studio
- [ ] Code follows Phase 1 contracts (models, Store schema, API)

## Common Mistakes

**❌ Don't:**
- Create separate database (use Store)
- Mutate state directly (return updates)
- Hardcode user preferences (read from Store)
- Skip IAB context in state
- Forget error handling

**✅ Do:**
- Use Store for all persistence
- Return state updates as dictionaries
- Include IAB classifications in state
- Handle all error conditions
- Follow complexity level patterns

## Reference

- Mission Agents Architecture: `docs/plans/mission_agents_architecture.md`
- Store Schema: `reference/PROJECT_STRUCTURE.md`
- Integration Plan: `docs/plans/2025-01-04-ownyou-consumer-app-integration.md`
