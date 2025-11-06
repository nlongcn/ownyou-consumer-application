# LangGraph Studio Integration - Technical Specification

**Version:** 1.0
**Status:** Specification
**Last Updated:** 2025-01-18

---

## Executive Summary

This specification describes the integration of LangGraph Studio into the email parser system to enable visual debugging, workflow inspection, and agent behavior analysis during development.

**Key Objectives:**
- ✅ Enable real-time workflow visualization
- ✅ Maintain backward compatibility with existing code
- ✅ Preserve self-sovereign architecture principles
- ✅ Zero impact on production deployment

---

## 1. Overview

### 1.1 What is LangGraph Studio?

LangGraph Studio is a specialized IDE for LangGraph applications that provides:
- **Visual graph display** showing all workflow nodes and edges
- **Real-time execution monitoring** with step-by-step state inspection
- **Time-travel debugging** to inspect state at any point in execution
- **Agent trajectory visualization** showing email routing and classification decisions

### 1.2 Why Add Studio?

**Development Benefits:**
- Debug complex agent interactions visually
- Inspect state at each workflow node
- Understand batch processing decisions
- Track confidence score evolution
- Identify reconciliation issues quickly

**Current Pain Points Solved:**
- ❌ Manual log file inspection → ✅ Visual state inspection
- ❌ Unclear agent routing decisions → ✅ Clear visualization
- ❌ Hard to debug batch processing → ✅ See batch boundaries
- ❌ Confidence calculation opaque → ✅ Track evidence updates

### 1.3 Architecture Alignment

This integration aligns with our system's modular architecture:
- **No changes to core workflow logic**
- **Optional development-time tool**
- **Pluggable backend (same pattern as MEMORY_BACKEND)**
- **Self-sovereign principles maintained**

---

## 2. Self-Sovereign Compatibility Analysis

### 2.1 Architectural Principles

Our system follows these principles:
1. **Local-first**: No mandatory cloud services
2. **User control**: Users choose where data lives
3. **Privacy-by-design**: Minimal data persistence
4. **Pluggable backends**: SQLite, InMemory, user choice

### 2.2 How Studio Maintains Self-Sovereignty

| Aspect | Self-Sovereign Requirement | Studio Implementation | ✅/❌ |
|--------|---------------------------|----------------------|-------|
| **Data storage** | Local control | SQLite checkpointer in local file | ✅ |
| **Default behavior** | No cloud dependencies | Default: no checkpointing | ✅ |
| **User choice** | Opt-in for features | Checkpointer parameter optional | ✅ |
| **Production deployment** | No forced dependencies | langgraph-cli only dev dependency | ✅ |

### 2.3 Checkpointer Options (Local-First)

```python
# Option 1: No checkpointing (production default)
graph = build_workflow_graph(memory_manager)
# No state persistence, maximum privacy

# Option 2: Local SQLite checkpointing (resilience)
from langgraph.checkpoint.sqlite import SqliteSaver
checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
graph = build_workflow_graph(memory_manager, checkpointer)
# Local file storage, user owns data

# Option 3: In-memory checkpointing (ephemeral)
from langgraph.checkpoint.memory import MemorySaver
checkpointer = MemorySaver()
graph = build_workflow_graph(memory_manager, checkpointer)
# No persistence, perfect for development
```

**Key Principle**: User chooses checkpointing strategy. System never forces cloud storage.

---

## 3. Implementation Approach

### 3.1 Option A: Optional Checkpointer Parameter (SELECTED)

**Rationale**: Simplest, most maintainable, backward compatible.

```python
def build_workflow_graph(
    memory_manager: MemoryManager,
    checkpointer=None  # NEW: Optional parameter
) -> StateGraph:
    """
    Build IAB Taxonomy Profile workflow graph.

    Self-Sovereign Architecture:
        This system follows local-first, privacy-preserving design.
        By default, no checkpointing is used to minimize data persistence.

        For local resilience (optional):
            from langgraph.checkpoint.sqlite import SqliteSaver
            checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
            graph = build_workflow_graph(memory_manager, checkpointer)

    Args:
        memory_manager: User's memory manager (local SQLite or in-memory)
        checkpointer: Optional local checkpointer for state persistence
                     Default: None (no checkpointing, privacy-first)

    Returns:
        Compiled StateGraph
    """
    # Build graph (existing logic unchanged)
    workflow = StateGraph(WorkflowState)

    # ... all existing node additions and edge definitions ...

    # Compile with or without checkpointer
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    else:
        return workflow.compile()
```

### 3.2 Advantages

✅ **Zero breaking changes** - All existing calls work unchanged
✅ **Single source of truth** - One function for all use cases
✅ **Self-documenting** - Parameter name makes purpose clear
✅ **Easy testing** - Can test both modes from same function
✅ **Future-proof** - Easy to add more options later

### 3.3 Downstream Impact

| Component | Change Required | Risk Level |
|-----------|----------------|------------|
| `executor.py` | None | ✅ Zero |
| `main.py` | None | ✅ Zero |
| Dashboard API | None | ✅ Zero |
| Unit tests | None | ✅ Zero |
| Integration tests | None | ✅ Zero |
| Studio entry point | New file | ✅ Isolated |

**Call Chain (Unchanged):**
```
Dashboard → subprocess → main.py → executor.py → build_workflow_graph(memory_manager)
                                                          ↓
                                                  checkpointer defaults to None
                                                          ↓
                                                  workflow.compile()  # existing behavior
```

---

## 4. File Changes

### 4.1 New Files

#### `langgraph.json` (Project Root)
```json
{
  "dependencies": [
    "."
  ],
  "graphs": {
    "email_taxonomy_workflow": "./src/email_parser/workflow/studio.py:create_graph"
  },
  "env": ".env"
}
```

**Purpose**: LangGraph CLI configuration
**Risk**: Zero (only read by Studio CLI, not production code)

#### `src/email_parser/workflow/studio.py`
```python
#!/usr/bin/env python3
"""
LangGraph Studio Entry Point

Provides a graph instance with checkpointer for Studio visualization.
This file is ONLY used by Studio, never by production code.
"""

from .graph import build_workflow_graph
from ..memory.manager import MemoryManager
from ..memory.backends import SQLiteStore
from langgraph.checkpoint.sqlite import SqliteSaver


def create_graph():
    """
    Create workflow graph for LangGraph Studio.

    This is the entry point specified in langgraph.json.
    Studio uses this to load and visualize the workflow.

    Returns:
        Compiled StateGraph with local SQLite checkpointer
    """
    # Create memory manager with local SQLite store
    store = SQLiteStore("data/email_parser_memory.db")
    memory_manager = MemoryManager(user_id="studio_user", store=store)

    # Create local SQLite checkpointer for state persistence
    # This enables time-travel debugging in Studio
    checkpointer = SqliteSaver.from_conn_string("data/studio_checkpoints.db")

    # Build graph with checkpointer
    return build_workflow_graph(memory_manager, checkpointer)
```

**Purpose**: Studio-specific graph factory
**Risk**: Zero (isolated from production code paths)

### 4.2 Modified Files

#### `src/email_parser/workflow/graph.py`
```python
# Line 48 - Updated function signature
def build_workflow_graph(
    memory_manager: MemoryManager,
    checkpointer=None  # NEW: Optional parameter
) -> StateGraph:
    """
    Build IAB Taxonomy Profile workflow graph.

    [Updated docstring with self-sovereign guidance]
    """
    # ... existing graph construction (unchanged) ...

    # Line 117 - Updated compile call
    if checkpointer:
        compiled_graph = workflow.compile(checkpointer=checkpointer)
    else:
        compiled_graph = workflow.compile()

    logger.info("Workflow graph compiled successfully")
    return compiled_graph
```

**Changes**:
- Added optional `checkpointer` parameter (default: None)
- Conditional compilation with checkpointer
- Updated docstring

**Risk**: Minimal (backward compatible, well-tested pattern)

#### `requirements.txt`
```diff
+ langgraph-cli>=0.1.0  # Development tool for Studio visualization
```

**Purpose**: Install Studio CLI for development
**Risk**: Zero (dev dependency, not imported by production code)

### 4.3 Change Summary

| File | Type | Lines Changed | Risk |
|------|------|--------------|------|
| `langgraph.json` | New | +7 | None |
| `studio.py` | New | +30 | None |
| `graph.py` | Modified | +15 | Minimal |
| `requirements.txt` | Modified | +1 | None |
| **Total** | 4 files | 53 lines | **Low** |

---

## 5. Configuration

### 5.1 LangGraph CLI Installation

```bash
pip install langgraph-cli
```

### 5.2 langgraph.json Configuration

The `langgraph.json` file tells Studio where to find your graph:

```json
{
  "dependencies": [
    "."
  ],
  "graphs": {
    "email_taxonomy_workflow": "./src/email_parser/workflow/studio.py:create_graph"
  },
  "env": ".env"
}
```

**Fields:**
- `dependencies`: Python packages to install (`["."]` = current directory)
- `graphs`: Map of graph names to entry point functions
  - Format: `"path/to/file.py:function_name"`
  - `create_graph` must return a compiled `StateGraph`
- `env`: Environment file to load (`.env` contains API keys)

### 5.3 Directory Structure

```
email_parser/
├── langgraph.json              # Studio configuration (NEW)
├── .env                        # Environment variables (existing)
├── src/email_parser/workflow/
│   ├── graph.py                # Updated with checkpointer param
│   ├── studio.py               # Studio entry point (NEW)
│   └── ...
└── data/
    ├── email_parser_memory.db  # Production memory (existing)
    └── studio_checkpoints.db   # Studio checkpoints (NEW, auto-created)
```

---

## 6. Usage Guide

### 6.1 Starting LangGraph Studio

```bash
# From project root
langgraph dev

# Output:
# Ready!
# - API: http://127.0.0.1:2024
# - Studio UI: http://127.0.0.1:2024
# - Docs: http://127.0.0.1:2024/docs
```

### 6.2 Accessing Studio UI

Open browser to `http://127.0.0.1:2024`

**Features:**
- **Graph View**: Visual representation of all nodes and edges
- **Chat Mode**: Interactive testing with email inputs
- **State Inspector**: Drill down into state at each node
- **Time Travel**: Rewind and replay executions

### 6.3 Testing Workflow

1. **Select Graph**: `email_taxonomy_workflow`
2. **Provide Input**:
   ```json
   {
     "user_id": "test_user",
     "emails": [
       {
         "id": "test_1",
         "subject": "Crypto Investment Newsletter",
         "body": "Latest cryptocurrency trends...",
         "date": "2025-01-15"
       }
     ]
   }
   ```
3. **Execute**: Click "Run"
4. **Inspect**:
   - See which nodes execute
   - View state transformations
   - Inspect agent classifications
   - Check confidence scores

### 6.4 Development Workflow

```bash
# Terminal 1: Run Studio
langgraph dev

# Terminal 2: Make code changes
vim src/email_parser/workflow/nodes/analyze_all.py

# Studio auto-reloads on file changes
# Test immediately in browser
```

---

## 7. Testing Strategy

### 7.1 Verification Plan

#### Test 1: Backward Compatibility
```python
# Existing code must work unchanged
from src.email_parser.workflow import run_workflow
from src.email_parser.memory.manager import MemoryManager

memory_manager = MemoryManager(user_id="test")
result = run_workflow(
    user_id="test",
    emails=[...],
    memory_manager=memory_manager
)
# ✅ Should work exactly as before
```

#### Test 2: Studio Mode
```python
# Studio mode with checkpointer
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("test_checkpoints.db")
graph = build_workflow_graph(memory_manager, checkpointer)
result = graph.invoke({...})
# ✅ Should work with state persistence
```

#### Test 3: Existing Tests
```bash
pytest tests/unit/test_workflow_graph.py
pytest tests/integration/test_workflow_integration.py
# ✅ All tests should pass unchanged
```

### 7.2 Acceptance Criteria

- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] Dashboard workflow runs successfully
- [ ] CLI workflow runs successfully
- [ ] Studio loads graph without errors
- [ ] Studio can execute sample emails
- [ ] Time-travel debugging works
- [ ] No performance regression

---

## 8. Rollback Plan

### 8.1 Quick Rollback (< 2 minutes)

```bash
# Revert code changes
git checkout src/email_parser/workflow/graph.py
rm src/email_parser/workflow/studio.py
rm langgraph.json

# Uninstall Studio CLI
pip uninstall langgraph-cli

# Remove checkpoints database
rm data/studio_checkpoints.db
```

### 8.2 Git Rollback

```bash
# Revert to pre-integration commit
git revert <commit-hash>
git push
```

### 8.3 Rollback Validation

```bash
# Verify production workflow
python -m src.email_parser.main --pull 10 --model openai

# Run tests
pytest

# Start dashboard
cd dashboard && ./start_dashboard.sh
```

---

## 9. Future Enhancements

### 9.1 LangSmith Integration (Optional)

For production monitoring (user choice):

```python
import os

# Only if user sets LANGCHAIN_API_KEY
if os.getenv("LANGCHAIN_API_KEY"):
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    # Cloud monitoring available (opt-in)
```

**Note**: LangSmith is optional. Self-sovereign deployment doesn't require it.

### 9.2 Custom Visualization Metadata

Add node metadata for better Studio visualization:

```python
workflow.add_node(
    "reconcile",
    reconcile,
    metadata={
        "description": "Reconcile new evidence with existing profile",
        "category": "processing"
    }
)
```

### 9.3 Streaming Support

Enable streaming for real-time updates:

```python
for event in graph.stream(initial_state):
    print(f"Node: {event['node']}, State: {event['state']}")
```

---

## 10. Security Considerations

### 10.1 Data Exposure

**Risk**: Studio checkpoints contain email summaries and classifications
**Mitigation**:
- Checkpoints stored locally in `data/` (not tracked by git)
- Use `.gitignore` to exclude `data/studio_checkpoints.db`
- Provide clear documentation about data in checkpoints

### 10.2 API Keys

**Risk**: `.env` file contains API keys, loaded by Studio
**Mitigation**:
- `.env` already in `.gitignore`
- Studio runs locally, keys never leave machine
- Same security posture as current CLI

### 10.3 Network Exposure

**Risk**: Studio serves on `http://127.0.0.1:2024`
**Mitigation**:
- Bound to localhost only (not exposed to network)
- No remote access without explicit port forwarding
- For production, disable Studio entirely

---

## 11. Documentation Updates Required

After implementation:

- [ ] Update `README.md` with Studio section
- [ ] Update `CLAUDE.md` with Studio usage under "Common Development Tasks"
- [ ] Create `docs/STUDIO_QUICKSTART.md` for 5-minute getting started
- [ ] Create `docs/reference/CHECKPOINTER_OPTIONS.md` for deployment patterns
- [ ] Add Studio screenshots to documentation

---

## 12. Success Metrics

### 12.1 Functionality

- ✅ Graph visualizes in Studio
- ✅ Can execute test emails
- ✅ State inspection works at each node
- ✅ Time-travel debugging functional
- ✅ Existing code unaffected

### 12.2 Developer Experience

- ⏱️ < 5 minutes to set up Studio
- ⏱️ < 1 second for file change reload
- ⏱️ < 10 seconds to inspect state at any node
- 📈 50%+ reduction in debugging time for agent issues

### 12.3 Architectural Integrity

- ✅ No mandatory cloud dependencies
- ✅ Local-first checkpointing default
- ✅ Zero impact on production deployment
- ✅ Self-sovereign principles maintained

---

## Appendix A: Implementation Checklist

See `docs/tasks/LANGGRAPH_STUDIO_IMPLEMENTATION_CHECKLIST.md`

## Appendix B: Reference Documentation

See `docs/reference/CHECKPOINTER_OPTIONS.md`

---

**Document Status**: Ready for implementation
**Next Steps**: Review and approve, then proceed to implementation phase
