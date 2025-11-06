---
name: store-schema-design
description: Design and implement LangGraph Store namespaces for OwnYou following single-source-of-truth architecture. Use when adding new memory types, defining Store schemas, or integrating IAB/Mission systems with Store. Prevents database sprawl and duplication.
---

# Store Schema Design for OwnYou

Design LangGraph Store namespaces following OwnYou's single-source-of-truth architecture.

## When to Use This Skill

- Adding new memory types (user preferences, classifications, mission data)
- Integrating IAB classification workflow with Store
- Integrating Mission Agents with Store
- Any task involving persistent data or memory

## Critical Principle

**LangGraph Store is the ONLY persistent storage for OwnYou.**

❌ **DON'T:**
- Create separate databases
- Duplicate data between systems
- Store data outside Store

✅ **DO:**
- Use Store for ALL memory needs
- Define namespaces for each data type
- Follow namespace conventions

## Namespace Pattern

**Format:** `({namespace_prefix}.{memory_type}, {partition_key}, {optional_keys}...)`

```python
# Example namespaces
("ownyou.iab_classifications", "user_123")
("ownyou.user_preferences", "user_123")
("ownyou.shopping_list", "user_123")
("ownyou.mission_learnings", "shopping")
("ownyou.ikigai_interests", "user_123", "travel")
```

**Rules:**
1. Always start with `ownyou.` prefix
2. Memory type describes what's stored (e.g., `iab_classifications`)
3. First partition key is usually `user_id`
4. Additional keys for sub-partitioning (e.g., taxonomy_id, mission_type)

## Complete Store Schema

See `reference/PROJECT_STRUCTURE.md` for full schema. Common namespaces:

### IAB System Namespaces

```python
# IAB Classifications (from email/calendar/financial analysis)
("ownyou.iab_classifications", user_id)
# Stores: {taxonomy_id, taxonomy_name, confidence, evidence[], last_updated}
```

### User Profile Namespaces

```python
# Core Profile
("ownyou.user_profile", user_id)
# Stores: {name, email, created_at, demographics, household}

# Demographics
("ownyou.demographics", user_id)
# Stores: {age_range, gender, location, occupation, income_range}

# Household
("ownyou.household", user_id)
# Stores: {family_size, has_children, home_ownership, pet_ownership}
```

### Mission-Specific Preference Namespaces

```python
# Shopping
("ownyou.shopping_list", user_id)
("ownyou.shopping_preferences", user_id)
("ownyou.shopping_history", user_id)

# Travel
("ownyou.travel_preferences", user_id)
("ownyou.past_trips", user_id)

# Dining
("ownyou.dining_preferences", user_id)
("ownyou.restaurant_history", user_id)

# Events
("ownyou.event_preferences", user_id)
("ownyou.attended_events", user_id)

# Health
("ownyou.health_profile", user_id)
("ownyou.fitness_goals", user_id)
```

### Ikigai Namespaces

```python
# Core Ikigai
("ownyou.ikigai_profile", user_id)
# Stores: {life_purpose, core_interests[], values[], goals[]}

# Interest-specific
("ownyou.ikigai_interests", user_id, interest_type)
# interest_type: "travel", "hobbies", "learning", etc.
```

### Mission State Namespaces

```python
# Cross-mission learnings
("ownyou.mission_learnings", mission_type)
# Stores: {patterns[], success_factors[], common_failures[]}

# Completed missions
("ownyou.completed_missions", user_id)
# Stores: list of {mission_id, completion_date, outcome, feedback}

# Mission feedback
("ownyou.mission_feedback", user_id, mission_id)
# Stores: {structured_feedback, qualitative_text, extracted_preferences}
```

### Episodic Memory Namespaces

```python
# Data source events
("ownyou.email_events", user_id)
("ownyou.calendar_events", user_id)
("ownyou.financial_transactions", user_id)
("ownyou.location_history", user_id)
("ownyou.browsing_history", user_id)
```

## Adding a New Namespace

### Step 1: Check if Namespace Already Exists

```bash
# Review complete schema
cat reference/PROJECT_STRUCTURE.md | grep -A 50 "STORE_NAMESPACES"
```

If namespace exists, use it. Don't create duplicates.

### Step 2: Define Namespace in Config

```python
# src/mission_agents/memory/config.py

class StoreConfig(BaseModel):
    namespace_prefix: str = "ownyou"

    namespace_patterns: Dict[str, str] = Field(
        default_factory=lambda: {
            # ... existing namespaces

            # NEW: Your namespace
            "{memory_type}": "({prefix}.{memory_type}, {user_id})",

            # Or with additional partitioning
            "{memory_type}": "({prefix}.{memory_type}, {user_id}, {sub_key})",
        }
    )
```

### Step 3: Add Store Methods

```python
# src/mission_agents/memory/store.py

class MissionStore:
    # ... existing methods

    def put_{memory_type}(
        self,
        user_id: str,
        data: Dict[str, Any],
        **kwargs  # Additional partition keys if needed
    ) -> None:
        ""Store {memory_type}""
        namespace = self._get_namespace("{memory_type}", user_id=user_id, **kwargs)
        self.store.put(namespace, "data", data)

    def get_{memory_type}(
        self,
        user_id: str,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Retrieve {memory_type}"""
        namespace = self._get_namespace("{memory_type}", user_id=user_id, **kwargs)
        item = self.store.get(namespace, "data")
        return item.value if item else None

    def search_{memory_type}(
        self,
        user_id: str,
        query: Optional[str] = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Search {memory_type} with optional semantic search"""
        namespace = self._get_namespace("{memory_type}", user_id=user_id, **kwargs)

        if query and self.config.enable_semantic_search:
            items = self.store.search(
                namespace,
                query=query,
                limit=self.config.max_search_results
            )
        else:
            items = self.store.search(namespace)

        return [item.value for item in items]
```

### Step 4: Document Data Structure

```python
# Add to src/mission_agents/memory/store_schema.md

## {Memory Type} Namespace

**Namespace:** `(ownyou.{memory_type}, {user_id})`

**Purpose:** {What this stores and why}

**Data Structure:**
```json
{
  "field_1": "value or type",
  "field_2": ["array", "of", "items"],
  "nested": {
    "structure": "if needed"
  },
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

**Updated By:**
- {Which agents write to this namespace}
- {Which workflows modify this}

**Read By:**
- {Which agents read from this namespace}
- {Which API endpoints expose this}

**Lifecycle:**
- Created: {When is this first created}
- Updated: {How often is this updated}
- Deleted: {Is this ever deleted, or retained forever}
```

### Step 5: Write Tests

```python
# tests/mission_agents/memory/test_store.py

def test_put_get_{memory_type}():
    """Test storing and retrieving {memory_type}"""
    config = StoreConfig()
    store = MissionStore(config=config)

    user_id = "user_test"
    test_data = {
        "field_1": "test_value",
        "field_2": ["item1", "item2"],
        "created_at": datetime.now().isoformat()
    }

    # Store data
    store.put_{memory_type}(user_id, test_data)

    # Retrieve data
    retrieved = store.get_{memory_type}(user_id)

    assert retrieved is not None
    assert retrieved["field_1"] == "test_value"
    assert len(retrieved["field_2"]) == 2


def test_search_{memory_type}():
    """Test searching {memory_type}"""
    config = StoreConfig()
    store = MissionStore(config=config)

    user_id = "user_test"

    # Store multiple items
    store.put_{memory_type}(user_id, {"name": "item1"})
    store.put_{memory_type}(user_id, {"name": "item2"})

    # Search
    results = store.search_{memory_type}(user_id)

    assert len(results) >= 2
```

## IAB Classification Integration Pattern

When integrating IAB workflow with Store:

```python
# src/email_parser/workflow/nodes/update_memory.py

def update_memory_node(
    state: AgentState,
    store: Optional[MissionStore] = None
) -> dict:
    """Update memory with validated classifications"""

    # Existing SQLite update (backward compatibility)
    # ... existing code ...

    # NEW: Write to Store
    if store:
        user_id = state.get("user_id", "default_user")

        for classification in state.get("all_classifications", []):
            store.put_iab_classification(
                user_id=user_id,
                taxonomy_id=classification["taxonomy_id"],
                classification={
                    "taxonomy_name": classification["taxonomy_name"],
                    "confidence": classification["confidence"],
                    "evidence": classification.get("evidence", []),
                    "last_updated": datetime.now().isoformat()
                }
            )

    return {"memory_updated": True}
```

## Mission Agent Read Pattern

When reading from Store in mission agents:

```python
# In mission agent node or orchestrator

def prepare_mission(user_id: str, store: MissionStore):
    """Prepare mission with Store context"""

    # Get IAB classifications
    iab_classifications = store.get_all_iab_classifications(user_id)

    # Get user preferences
    user_prefs = store.get_user_preferences(user_id)

    # Get mission-specific preferences
    shopping_prefs = store.get_shopping_preferences(user_id)

    # Get Ikigai profile
    ikigai = store.get_ikigai_profile(user_id)

    # Combine into mission context
    return {
        "iab_classifications": iab_classifications,
        "user_preferences": user_prefs,
        "shopping_preferences": shopping_prefs,
        "ikigai_profile": ikigai
    }
```

## Feedback Write Pattern

When updating Store from user feedback:

```python
# After user provides feedback on mission card

def process_feedback(
    user_id: str,
    mission_id: str,
    feedback: Dict[str, Any],
    store: MissionStore
):
    """Process user feedback and update Store"""

    # 1. Store feedback
    store.put_mission_feedback(
        user_id=user_id,
        mission_id=mission_id,
        feedback=feedback
    )

    # 2. Extract preferences (if qualitative feedback)
    if feedback.get("qualitative_text"):
        # Use LLM to extract preferences
        extracted_prefs = llm_extract_preferences(
            feedback["qualitative_text"]
        )

        # Update relevant preference namespace
        if extracted_prefs.get("dining"):
            current_prefs = store.get_dining_preferences(user_id) or {}
            updated_prefs = {**current_prefs, **extracted_prefs["dining"]}
            store.put_dining_preferences(user_id, updated_prefs)

    # 3. Update mission learnings
    mission_type = feedback.get("mission_type")
    if mission_type:
        learnings = store.get_mission_learnings(mission_type) or {"patterns": []}
        learnings["patterns"].append({
            "feedback": feedback,
            "extracted": extracted_prefs,
            "timestamp": datetime.now().isoformat()
        })
        store.put_mission_learnings(mission_type, learnings)
```

## Production Migration: SQLite → PostgreSQL

When migrating to production, replace InMemoryStore with PostgreSQL-backed Store:

```python
# src/mission_agents/memory/store.py

from langgraph.store.postgres import PostgresStore
import os

class MissionStore:
    def __init__(self, config: StoreConfig):
        self.config = config

        # Production: Use PostgreSQL
        if os.getenv("DATABASE_URL"):
            self.store = PostgresStore.from_conn_string(
                os.getenv("DATABASE_URL")
            )
        # Development: Use InMemory
        else:
            from langgraph.store.memory import InMemoryStore
            self.store = InMemoryStore()
```

**No code changes needed!** Store interface remains the same.

## Validation Checklist

Before adding a new namespace:

- [ ] Checked if namespace already exists
- [ ] Defined namespace in StoreConfig
- [ ] Added put/get/search methods to MissionStore
- [ ] Documented data structure in store_schema.md
- [ ] Specified which agents write/read this namespace
- [ ] Written tests for put/get/search
- [ ] Updated integration tests if IAB/Mission system affected

## Common Mistakes

**❌ Don't:**
- Create separate database tables
- Duplicate data across multiple namespaces
- Use complex nested namespace keys (keep it flat)
- Store large binary data (images, PDFs) in Store
- Hardcode user_id or other partition keys

**✅ Do:**
- Use Store for all structured data
- Keep namespace hierarchy shallow (2-3 levels max)
- Store references to large files (URLs, S3 keys)
- Use clear, descriptive namespace names
- Document data structures

## Reference

- Store Implementation: `src/mission_agents/memory/store.py`
- Store Schema Docs: `src/mission_agents/memory/store_schema.md`
- Architectural Decisions: `reference/ARCHITECTURAL_DECISIONS.md`
- Integration Plan: `docs/plans/2025-01-04-ownyou-consumer-app-integration.md`
