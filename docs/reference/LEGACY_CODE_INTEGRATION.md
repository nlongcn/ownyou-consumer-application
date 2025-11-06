# Legacy Code Integration Guide

**email_parser: Working Production Code - Respect It**

This guide provides comprehensive patterns for integrating new OwnYou features with the existing email_parser system.

**Version:** 1.0.0
**Last Updated:** 2025-01-06
**Status:** email_parser is PRODUCTION code with users

---

## Table of Contents

1. [Overview](#overview)
2. [email_parser Status](#email_parser-status)
3. [When to Use vs. When to Change](#when-to-use-vs-when-to-change)
4. [Integration Patterns](#integration-patterns)
5. [Testing Requirements](#testing-requirements)
6. [Common Pitfalls](#common-pitfalls)
7. [Production Constraints](#production-constraints)
8. [Migration Strategy](#migration-strategy)

---

## Overview

### What is email_parser?

email_parser is the **existing, working IAB classification system** that:
- Downloads emails from Gmail/Outlook via OAuth
- Classifies emails using IAB Taxonomy (LangChain + LLM)
- Writes classifications to both SQLite and LangGraph Store
- Powers the existing dashboard
- Supports LangGraph Studio for debugging
- Has been tested with 1000s of real emails

### Why This Guide?

**Problem:** Almost shipped Store schema incompatible with email_parser because we didn't check existing patterns first.

**Solution:** Make legacy code awareness mandatory - check existing systems BEFORE implementing new features.

**Result:** Future features integrate with email_parser by default, not break it by accident.

---

## email_parser Status

### ✅ Production-Ready Features

| Feature | Status | Users | Performance |
|---------|--------|-------|-------------|
| **IAB Classification** | ✅ Production | Active | 1000s of emails classified |
| **Batch Processing** | ✅ Optimized | Active | 20-30x faster than sequential |
| **Multi-Provider LLM** | ✅ Production | Active | OpenAI, Claude, Gemini, Ollama |
| **LangGraph Studio** | ✅ Working | Developers | Debuggable workflows |
| **OAuth Integration** | ✅ Production | Active | Gmail + Outlook |
| **Dashboard** | ✅ Production | Active | Profile display |

### Architecture Highlights

**File Structure:**
```
src/email_parser/
├── main.py                      # CLI entry point
├── auth/                        # OAuth for Gmail/Outlook
├── llm_clients/                 # Multi-provider LLM support
├── memory/                      # SQLite + Store writes
│   ├── manager.py              # MemoryManager (legacy)
│   ├── schemas.py              # Data structures
│   └── backends/
│       └── sqlite_store.py     # Custom SQLiteStore
├── models/                      # IAB Taxonomy
│   └── iab_taxonomy.py
├── workflow/                    # LangGraph classification
│   ├── graph.py                # Main workflow
│   ├── state.py                # AgentState
│   ├── batch_optimizer.py      # 20-30x optimization
│   └── nodes/
│       ├── classify.py         # LLM classification
│       ├── judge_evidence.py   # Evidence validation
│       └── update_memory.py    # Dual SQLite+Store writes
└── tests/                       # Comprehensive tests
```

**Key Components:**

1. **`create_classification_graph()`** - Production-tested LangGraph workflow
2. **`calculate_optimal_batches()`** - 20-30x performance optimization
3. **`MemoryManager`** - SQLite writes (backward compatibility)
4. **`update_memory_node()`** - Dual writes to SQLite + Store

---

## When to Use vs. When to Change

### ✅ Use Existing Patterns For

| Pattern | Why Use It | Example |
|---------|------------|---------|
| **IAB Classification Workflow** | Already production-tested | Classify calendar events, transactions |
| **Batch Processing** | 20-30x performance gain | Process any classifiable items in batches |
| **LangGraph Workflows** | Debuggable in Studio | Build mission agent workflows |
| **Store Integration** | Backward compatible | Read/write to shared Store |
| **Multi-Provider LLM** | Supports 4 providers | Switch between OpenAI/Claude/Gemini/Ollama |

**Example: Reusing IAB Classification for Calendar Events**

```python
# ✅ CORRECT: Reuse existing workflow
from src.email_parser.workflow.graph import create_classification_graph
from src.email_parser.workflow.state import AgentState

# Calendar events as ClassifiableItems
calendar_items = [
    ClassifiableItem(
        id=event.id,
        content=f"{event.title} {event.description}",
        timestamp=event.start_time,
        metadata={"source": "calendar"}
    )
    for event in calendar_events
]

# Use email_parser workflow
graph = create_classification_graph(store=mission_store)
state = AgentState(
    user_id="user_123",
    classifiable_items=calendar_items,
    batch_config={"batch_size": 30, "parallel_executions": 4}
)
result = graph.invoke(state)

# Get classifications
all_classifications = result["all_classifications"]

# ❌ WRONG: Rebuild classification from scratch
def classify_calendar_events(events):
    # Don't rebuild what already works!
    pass
```

---

### ⚠️ Change Carefully When

| Scenario | Requirements | Approval |
|----------|--------------|----------|
| **Fixing Production Bugs** | Full testing, no regressions | Code review required |
| **Adding Multi-Source Support** | Phase 2 requirement | Part of roadmap |
| **Performance Optimization** | Benchmark before/after | Prove improvement |
| **Security Patching** | Audit changes | Security review |

**Example: Adding Calendar Source to email_parser**

```python
# ⚠️ Carefully extend existing system
# File: src/email_parser/workflow/nodes/fetch_items.py

def fetch_classifiable_items_node(state):
    """Fetch items from ALL data sources (Phase 2)"""

    user_id = state["user_id"]
    items = []

    # Existing: Email source
    if state.get("fetch_emails", True):
        email_items = fetch_emails(user_id)
        items.extend(email_items)

    # NEW: Calendar source (Phase 2)
    if state.get("fetch_calendar", False):
        calendar_items = fetch_calendar_events(user_id)
        items.extend(calendar_items)

    # NEW: Transaction source (Phase 2)
    if state.get("fetch_transactions", False):
        transaction_items = fetch_transactions(user_id)
        items.extend(transaction_items)

    state["classifiable_items"] = items
    return state

# CRITICAL: Test that existing email classification still works
def test_email_classification_not_broken_by_calendar_support():
    # Baseline: Email-only (existing behavior)
    result_emails_only = graph.invoke(AgentState(
        user_id="user_123",
        fetch_emails=True,
        fetch_calendar=False
    ))
    assert len(result_emails_only["all_classifications"]) > 0

    # New: Calendar + emails
    result_multi_source = graph.invoke(AgentState(
        user_id="user_123",
        fetch_emails=True,
        fetch_calendar=True
    ))
    assert len(result_multi_source["all_classifications"]) > 0
```

---

### ❌ Never Change

| What | Why | Alternative |
|------|-----|-------------|
| **Batch Optimizer** | Already optimized, working | Extend, don't replace |
| **OAuth Flows** | Production users depend on it | Add new flows, keep existing |
| **LangGraph Studio Integration** | Debugging tool for developers | Enhance, don't break |
| **SQLite Writes** | Dashboard depends on them until Phase 5 | Dual write (SQLite + Store) |

---

## Integration Patterns

### Pattern 1: Reuse IAB Classification Workflow

**Scenario:** You need to classify ANY data source (not just emails)

**Solution:** Use existing workflow, it's data-source agnostic

```python
from src.email_parser.workflow.graph import create_classification_graph
from src.email_parser.workflow.state import AgentState
from src.email_parser.models.data_structures import ClassifiableItem

def classify_any_data_source(user_id: str, items: list, store):
    """
    Classify ANY data source using email_parser workflow.

    Works for: emails, calendar, transactions, photos, browsing history, etc.
    """
    # Convert your data to ClassifiableItem protocol
    classifiable_items = [
        ClassifiableItem(
            id=item.id,
            content=extract_text(item),
            timestamp=item.timestamp,
            metadata={"source": item.source_type}
        )
        for item in items
    ]

    # Create workflow
    graph = create_classification_graph(store=store)

    # Invoke with your items
    state = AgentState(
        user_id=user_id,
        classifiable_items=classifiable_items,
        batch_config={"batch_size": 30, "parallel_executions": 4}
    )

    result = graph.invoke(state)

    return result["all_classifications"]
```

---

### Pattern 2: Read from Store (email_parser Writes)

**Scenario:** Mission agents need IAB classifications

**Solution:** Just read from Store, email_parser already writes there

```python
from src.mission_agents.memory.store import MissionStore

def get_user_iab_profile(user_id: str):
    """
    Get IAB profile that email_parser has already built.

    No need to re-classify, just read from Store.
    """
    store = MissionStore(config)

    # Get all classifications
    all_classifications = store.get_all_iab_classifications(user_id)

    # Filter high-confidence classifications
    high_confidence = [
        c for c in all_classifications
        if c["confidence"] >= 0.7
    ]

    return {
        "user_id": user_id,
        "total_classifications": len(all_classifications),
        "high_confidence_count": len(high_confidence),
        "top_interests": high_confidence[:10]
    }
```

---

### Pattern 3: Dual Writes (Backward Compatibility)

**Scenario:** New feature needs to write classifications

**Solution:** Write to BOTH SQLite (legacy) and Store (new)

```python
from src.email_parser.memory.manager import MemoryManager
from src.mission_agents.memory.store import MissionStore
from typing import Optional

def update_classifications(
    user_id: str,
    classifications: list,
    store: Optional[MissionStore] = None
):
    """
    Write classifications with backward compatibility.

    REQUIRED until Phase 5 (dashboard migration to Store).
    """
    # Legacy write (KEEP until Phase 5)
    memory_manager = MemoryManager(user_id)
    memory_manager.update_classifications(classifications)

    # New write (ADD for mission agents)
    if store:
        for c in classifications:
            store.put_iab_classification(
                user_id=user_id,
                taxonomy_id=c["taxonomy_id"],
                classification={
                    "taxonomy_name": c["taxonomy_name"],
                    "confidence": c["confidence"],
                    "evidence": c.get("evidence", []),
                    "last_updated": c["last_updated"]
                }
            )

# ❌ WRONG: Only Store write (breaks dashboard)
def update_classifications_wrong(user_id, classifications, store):
    # Dashboard queries SQLite and breaks!
    for c in classifications:
        store.put_iab_classification(user_id, c["taxonomy_id"], c)
```

---

### Pattern 4: Batch Processing

**Scenario:** Need to classify many items efficiently

**Solution:** Use email_parser batch optimizer

```python
from src.email_parser.workflow.batch_optimizer import (
    calculate_optimal_batches,
    create_batches
)

def process_large_dataset(items: list, model: str = "openai"):
    """
    Process large datasets with batch optimization.

    20-30x faster than sequential processing.
    """
    # Calculate optimal batch configuration
    optimal_config = calculate_optimal_batches(
        num_items=len(items),
        parallel_executions=4,  # Adjust based on API rate limits
        model=model
    )

    # Create batches
    batches = create_batches(items, optimal_config)

    print(f"Processing {len(items)} items in {len(batches)} batches")
    print(f"Batch size: {optimal_config['batch_size']}")
    print(f"Parallel: {optimal_config['parallel_executions']}")

    # Process batches
    all_results = []
    for batch in batches:
        result = process_batch(batch)
        all_results.extend(result)

    return all_results

# ❌ WRONG: Sequential processing (20-30x slower)
def process_large_dataset_wrong(items):
    results = []
    for item in items:
        result = classify_single_item(item)  # Super slow!
        results.append(result)
    return results
```

---

### Pattern 5: Multi-Provider LLM

**Scenario:** Want to support multiple LLM providers

**Solution:** Use email_parser LLM client factory

```python
from src.email_parser.llm_clients.factory import create_llm_client

def classify_with_any_provider(
    content: str,
    provider: str = "openai"  # or "claude", "gemini", "ollama"
):
    """
    Use any LLM provider via unified interface.

    Supports: OpenAI, Claude, Gemini, Ollama
    """
    # Create client for specified provider
    client = create_llm_client(provider)

    # Use unified interface
    response = client.generate(
        prompt=f"Classify this text into IAB categories: {content}",
        temperature=0.1,
        max_tokens=1000
    )

    return response

# ❌ WRONG: Hardcode to one provider
from openai import OpenAI

def classify_with_openai_only(content):
    client = OpenAI()  # Doesn't support other providers
    # Locked into OpenAI forever
```

---

## Testing Requirements

### Minimum Integration Tests

**EVERY new feature must include these tests:**

#### 1. Email Parser Still Works Test

```python
def test_email_parser_still_works_after_new_feature():
    """CRITICAL: Email parser must continue working"""

    # Baseline
    from src.email_parser.main import EmailParserCLI
    cli = EmailParserCLI()
    result_before = cli.process_emails(max_count=10)
    assert len(result_before["classifications"]) > 0

    # Execute new feature
    new_feature = NewFeature(config)
    new_feature.execute()

    # Verify email parser still works
    result_after = cli.process_emails(max_count=10)
    assert len(result_after["classifications"]) > 0
    assert result_after["status"] == "success"
```

#### 2. Store Reads Work Test

```python
def test_store_reads_work_for_both_systems():
    """Verify Store reads work for email_parser AND mission agents"""

    store = MissionStore(config)

    # Email parser writes
    run_email_classification(store=store)

    # Mission agents read
    classifications = store.get_all_iab_classifications("user_123")

    assert len(classifications) > 0
    assert "confidence" in classifications[0]
```

#### 3. Dashboard Queries Test

```python
def test_dashboard_queries_still_work():
    """Dashboard must be able to read profile data"""

    from dashboard.backend.db.queries import get_user_profile

    # Run email parser
    run_email_classification()

    # Dashboard query
    profile = get_user_profile("user_123")

    assert profile is not None
    assert "demographics" in profile
    assert len(profile["interests"]) > 0
```

#### 4. LangGraph Studio Test

```python
def test_langgraph_studio_still_works():
    """LangGraph Studio visualization must work"""

    import subprocess
    import time

    # Start Studio
    proc = subprocess.Popen(["langgraph", "dev"])
    time.sleep(5)

    # Verify accessible
    response = requests.get("http://127.0.0.1:2024")
    assert response.status_code == 200

    # Run workflow
    result = run_classification_workflow()
    assert result["status"] == "success"

    proc.terminate()
```

#### 5. Performance Benchmark Test

```python
def test_no_performance_regression():
    """New feature must not slow down email_parser"""

    import time

    # Baseline
    start = time.time()
    baseline_result = run_email_classification(count=100)
    baseline_time = time.time() - start

    # After new feature
    new_feature.initialize()
    start = time.time()
    after_result = run_email_classification(count=100)
    after_time = time.time() - start

    # Allow max 10% degradation
    assert after_time <= baseline_time * 1.1
```

---

### Pre-Commit Checklist

**Run before EVERY commit:**

```bash
# 1. Unit tests
pytest tests/unit/test_new_feature.py -v

# 2. Integration tests (CRITICAL)
pytest tests/integration/test_new_feature_with_email_parser.py -v

# 3. Master system test (CRITICAL)
pytest tests/integration/test_complete_system.py -v

# 4. Email parser regression
pytest tests/unit/test_batch_optimizer.py -v

# 5. LangGraph Studio
langgraph dev  # Verify manually

# 6. Dashboard
cd dashboard && npm run dev  # Verify manually
```

---

## Common Pitfalls

### Pitfall 1: Rebuilding IAB Classification

**❌ WRONG:**
```python
def classify_calendar_events(events):
    """Custom classification logic"""
    for event in events:
        # Reinventing the wheel...
        categories = my_custom_classifier(event.text)
```

**✅ CORRECT:**
```python
from src.email_parser.workflow.graph import create_classification_graph

graph = create_classification_graph(store=store)
result = graph.invoke(state)
```

---

### Pitfall 2: Only Writing to Store

**❌ WRONG:**
```python
# Breaks dashboard!
store.put_iab_classification(user_id, taxonomy_id, classification)
```

**✅ CORRECT:**
```python
# Dual writes until Phase 5
memory_manager.update_classifications(classifications)  # SQLite
store.put_iab_classification(...)  # Store
```

---

### Pitfall 3: Sequential Processing

**❌ WRONG:**
```python
# 20-30x slower!
for email in emails:
    classify(email)
```

**✅ CORRECT:**
```python
from src.email_parser.workflow.batch_optimizer import calculate_optimal_batches
batches = calculate_optimal_batches(len(emails))
```

---

### Pitfall 4: Querying SQLite Directly

**❌ WRONG:**
```python
# Breaks when we migrate to PostgreSQL
conn = sqlite3.connect("iab_profiles.db")
```

**✅ CORRECT:**
```python
store = MissionStore(config)
classifications = store.get_all_iab_classifications(user_id)
```

---

## Production Constraints

### Users in Production

email_parser has active users:
- ✅ Dashboard displays IAB profiles
- ✅ LangGraph Studio for debugging
- ✅ OAuth tokens for Gmail/Outlook
- ✅ Batch processing tuned for performance

### Before Changing email_parser Code

1. **Create feature branch**
2. **Run full test suite** (unit + integration)
3. **Test LangGraph Studio** manually
4. **Test dashboard** manually
5. **Get code review** from someone who knows email_parser
6. **Deploy to staging** with real data
7. **Verify no regressions** in production features

---

## Migration Strategy

### Phase 1-5: Dual System (Current)

- email_parser writes to BOTH SQLite and Store
- Dashboard reads from SQLite
- Mission Agents read from Store
- ZERO downtime

### Phase 5: Dashboard Migration

- Migrate dashboard queries to Store
- Test thoroughly
- Deploy
- Monitor for issues

### Phase 6+: Remove SQLite

- After dashboard fully migrated
- Remove MemoryManager SQLite writes
- Keep Store-only writes
- Archive SQLite database

---

## Summary Checklist

Before implementing ANY new feature:

- [ ] Searched email_parser for existing patterns
- [ ] Identified reusable workflows (classification, batch, Store)
- [ ] Planned dual writes (SQLite + Store) until Phase 5
- [ ] Created integration tests (email_parser must still work)
- [ ] Verified dashboard queries won't break
- [ ] Confirmed LangGraph Studio still works
- [ ] Benchmarked performance (no regressions)
- [ ] Got code review from email_parser expert

**Remember:** email_parser is production code. Respect it. Integrate with it. Don't break it.

---

**Related Documentation:**
- [CURRENT_SYSTEM.md](CURRENT_SYSTEM.md) - What's working now
- [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md) - Coding standards
- [TESTING_PLAN.md](../development/TESTING_PLAN.md) - Testing requirements
- [ARCHITECTURAL_DECISIONS.md](ARCHITECTURAL_DECISIONS.md) - Critical constraints

**Last Updated:** 2025-01-06
**Maintainer:** OwnYou Development Team
