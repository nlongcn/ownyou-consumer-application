# Checkpointer Options - Reference Guide

**Self-Sovereign Deployment Patterns**

---

## Overview

This guide explains checkpointing options for LangGraph workflows in the email parser system. All options preserve self-sovereign architecture principles with local-first defaults.

---

## What is a Checkpointer?

A checkpointer saves workflow state at each step, enabling:
- **Resume on failure**: Continue from last checkpoint instead of restart
- **Time-travel debugging**: Inspect state at any point in execution
- **Audit trails**: Track how data transformed through workflow
- **Reproducibility**: Replay executions with same inputs

**Default**: No checkpointing (maximum privacy, minimum storage)

---

## Option 1: No Checkpointing (Production Default)

### When to Use

- ✅ Production deployment
- ✅ Privacy-critical applications
- ✅ Minimal storage footprint
- ✅ Fast execution (no persistence overhead)

### Configuration

```python
from src.email_parser.workflow import run_workflow
from src.email_parser.memory.manager import MemoryManager

memory_manager = MemoryManager(user_id="user_123")

# No checkpointer parameter = no checkpointing
result = run_workflow(
    user_id="user_123",
    emails=emails,
    memory_manager=memory_manager
)
```

### Characteristics

| Aspect | Behavior |
|--------|----------|
| **State persistence** | None |
| **Failure recovery** | Restart from beginning |
| **Storage required** | 0 bytes |
| **Privacy** | Maximum (no state saved) |
| **Performance** | Fastest (no I/O overhead) |

### Trade-offs

**Pros:**
- ✅ Maximum privacy
- ✅ Minimal storage
- ✅ Fastest performance
- ✅ No cleanup required

**Cons:**
- ❌ Can't resume on failure
- ❌ No time-travel debugging
- ❌ Can't inspect intermediate states

**Recommendation**: Use for production unless resilience required

---

## Option 2: Local SQLite Checkpointing

### When to Use

- ✅ Development and debugging
- ✅ Long-running workflows (resilience)
- ✅ Audit requirements
- ✅ Investigation of issues

### Configuration

```python
from src.email_parser.workflow.graph import build_workflow_graph
from src.email_parser.memory.manager import MemoryManager
from langgraph.checkpoint.sqlite import SqliteSaver

# Create local SQLite checkpointer
checkpointer = SqliteSaver.from_conn_string("data/workflow_checkpoints.db")

# Build graph with checkpointer
memory_manager = MemoryManager(user_id="user_123")
graph = build_workflow_graph(memory_manager, checkpointer)

# Execute workflow
result = graph.invoke({
    "user_id": "user_123",
    "emails": emails
})
```

### Characteristics

| Aspect | Behavior |
|--------|----------|
| **State persistence** | Local SQLite database |
| **Failure recovery** | Resume from last checkpoint |
| **Storage required** | ~1-10 KB per checkpoint |
| **Privacy** | Local file (user controls) |
| **Performance** | Minor overhead (disk writes) |

### File Location

```
data/
└── workflow_checkpoints.db
    ├── workflow_checkpoints.db-shm  # Shared memory file
    └── workflow_checkpoints.db-wal  # Write-ahead log
```

**Add to .gitignore:**
```gitignore
data/workflow_checkpoints.db*
```

### Trade-offs

**Pros:**
- ✅ Resume on failure
- ✅ Time-travel debugging
- ✅ Audit trail
- ✅ Local file (self-sovereign)

**Cons:**
- ❌ Disk storage required
- ❌ Minor performance overhead
- ❌ Must manage file cleanup

**Recommendation**: Use for development, optional for production resilience

---

## Option 3: In-Memory Checkpointing

### When to Use

- ✅ Testing and experimentation
- ✅ Short-lived workflows
- ✅ Maximum performance with debugging
- ✅ Ephemeral environments (Docker, Lambda)

### Configuration

```python
from langgraph.checkpoint.memory import MemorySaver

# Create in-memory checkpointer (ephemeral)
checkpointer = MemorySaver()

# Build graph with checkpointer
graph = build_workflow_graph(memory_manager, checkpointer)

# Execute workflow
result = graph.invoke({
    "user_id": "user_123",
    "emails": emails
})

# Checkpoints lost when process ends
```

### Characteristics

| Aspect | Behavior |
|--------|----------|
| **State persistence** | RAM only (process lifetime) |
| **Failure recovery** | Within session only |
| **Storage required** | RAM (released on exit) |
| **Privacy** | Maximum (no disk writes) |
| **Performance** | Fast (no I/O) |

### Trade-offs

**Pros:**
- ✅ Fast performance
- ✅ No disk storage
- ✅ Auto-cleanup (process exit)
- ✅ Good for testing

**Cons:**
- ❌ Lost on process restart
- ❌ Can't survive failures
- ❌ Limited by available RAM

**Recommendation**: Use for testing and short-lived workflows

---

## Option 4: Custom Local Storage

### When to Use

- ✅ Integration with existing storage
- ✅ Custom encryption requirements
- ✅ Specialized compliance needs

### Configuration

```python
from langgraph.checkpoint.base import BaseCheckpointSaver

class CustomLocalCheckpointer(BaseCheckpointSaver):
    """
    Custom checkpointer with encryption, custom format, etc.
    All data stays local (self-sovereign).
    """

    def __init__(self, storage_path, encryption_key=None):
        self.storage_path = storage_path
        self.encryption_key = encryption_key
        # ... custom implementation ...

# Use custom checkpointer
checkpointer = CustomLocalCheckpointer(
    storage_path="data/encrypted_checkpoints",
    encryption_key=user_encryption_key
)

graph = build_workflow_graph(memory_manager, checkpointer)
```

**Recommendation**: Advanced use cases only

---

## Cloud Options (User Choice)

### PostgreSQL Checkpointing

**When to Use**: Multi-instance deployments with shared state (user opts in)

```python
from langgraph.checkpoint.postgres import PostgresSaver

# User provides their own PostgreSQL instance
checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost:5432/checkpoints"
)

graph = build_workflow_graph(memory_manager, checkpointer)
```

**Self-Sovereign Compliance**:
- ✅ User runs their own PostgreSQL
- ✅ User controls data location
- ✅ No forced cloud dependency

**Recommendation**: Only when user explicitly chooses cloud/shared DB

---

## Comparison Matrix

| Option | Privacy | Performance | Resilience | Storage | Debugging | Production |
|--------|---------|-------------|-----------|---------|-----------|------------|
| **None** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐☆☆☆☆ | ⭐⭐⭐⭐⭐ | ⭐☆☆☆☆ | ✅ Default |
| **SQLite** | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ | ✅ Optional |
| **Memory** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐☆☆☆ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ | ❌ Testing |
| **PostgreSQL** | ⭐⭐⭐☆☆ | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ | ⭐⭐☆☆☆ | ⭐⭐⭐⭐⭐ | ✅ User choice |

---

## Self-Sovereign Deployment Patterns

### Pattern 1: Maximum Privacy (Default)

```python
# No checkpointing, no state persistence
graph = build_workflow_graph(memory_manager)  # checkpointer defaults to None
```

**Use Case**: Privacy-first production deployment

---

### Pattern 2: Local Resilience

```python
# Local SQLite checkpointing for resume capability
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
graph = build_workflow_graph(memory_manager, checkpointer)
```

**Use Case**: Production with failure recovery

---

### Pattern 3: Ephemeral Testing

```python
# In-memory checkpointing for fast testing
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
graph = build_workflow_graph(memory_manager, checkpointer)
```

**Use Case**: CI/CD testing, development

---

### Pattern 4: User-Controlled Cloud

```python
# PostgreSQL only if user explicitly configures
import os
from langgraph.checkpoint.postgres import PostgresSaver

if os.getenv("USER_POSTGRES_URL"):  # User opts in
    checkpointer = PostgresSaver.from_conn_string(os.getenv("USER_POSTGRES_URL"))
else:
    checkpointer = None  # Fall back to no checkpointing

graph = build_workflow_graph(memory_manager, checkpointer)
```

**Use Case**: Multi-instance deployments (user choice)

---

## Privacy Implications

### What Gets Checkpointed?

Checkpoints contain:
- ✅ Workflow state (user ID, current email index)
- ✅ Agent classifications and confidence scores
- ✅ Intermediate processing results
- ✅ Memory reconciliation data

Checkpoints do NOT contain:
- ❌ Raw email content (never stored)
- ❌ API keys or credentials
- ❌ User authentication tokens

### Data Retention

**SQLite Checkpointing:**
- Data persists until manually deleted
- No auto-expiration (user controls)
- Cleanup responsibility: User/administrator

**In-Memory Checkpointing:**
- Data auto-deleted on process exit
- No persistence beyond session
- No cleanup required

**Recommendation**: Add cleanup script for SQLite checkpoints

---

## Cleanup Scripts

### SQLite Checkpoint Cleanup

```python
#!/usr/bin/env python3
"""
Clean old checkpoints from SQLite database.
"""

import sqlite3
from datetime import datetime, timedelta
import os

def cleanup_old_checkpoints(db_path, days=30):
    """Remove checkpoints older than N days."""
    if not os.path.exists(db_path):
        print(f"Checkpoint database not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Calculate cutoff date
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Delete old checkpoints
    cursor.execute("""
        DELETE FROM checkpoints
        WHERE created_at < ?
    """, (cutoff,))

    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    print(f"Deleted {deleted} checkpoints older than {days} days")

if __name__ == "__main__":
    cleanup_old_checkpoints("data/workflow_checkpoints.db", days=30)
```

### Scheduled Cleanup (Cron)

```bash
# Add to crontab (runs weekly)
0 0 * * 0 python scripts/cleanup_checkpoints.py
```

---

## Best Practices

### 1. Default to No Checkpointing

```python
# Production code should not assume checkpointing
graph = build_workflow_graph(memory_manager)  # Default: None
```

**Rationale**: Privacy-first, minimal storage

---

### 2. Document Checkpoint Implications

```python
def build_workflow_graph(memory_manager, checkpointer=None):
    """
    Build workflow graph.

    Args:
        checkpointer: Optional checkpointer for state persistence.
                     Default: None (no checkpointing, maximum privacy)
                     Local options: SqliteSaver, MemorySaver
                     Cloud option: User-provided PostgresSaver

    Privacy Note:
        Checkpoints contain workflow state and classifications.
        Use local-first options (SQLite, Memory) for self-sovereign deployment.
    """
```

---

### 3. Environment-Based Configuration

```python
import os
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.memory import MemorySaver

def get_checkpointer():
    """Get checkpointer based on environment."""
    checkpoint_type = os.getenv("CHECKPOINTER_TYPE", "none")

    if checkpoint_type == "sqlite":
        return SqliteSaver.from_conn_string("data/checkpoints.db")
    elif checkpoint_type == "memory":
        return MemorySaver()
    else:
        return None  # Default: no checkpointing

# Use in workflow
checkpointer = get_checkpointer()
graph = build_workflow_graph(memory_manager, checkpointer)
```

---

### 4. Add Cleanup to CI/CD

```yaml
# .github/workflows/cleanup.yml
name: Cleanup Checkpoints

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Clean old checkpoints
        run: python scripts/cleanup_checkpoints.py
```

---

## Troubleshooting

### Checkpoint Database Locked

**Error**: `sqlite3.OperationalError: database is locked`

**Cause**: Multiple processes accessing same checkpoint file

**Solution**:
```bash
# Close all processes using checkpoint DB
lsof data/workflow_checkpoints.db | grep python | awk '{print $2}' | xargs kill

# Or delete and recreate
rm data/workflow_checkpoints.db*
```

---

### Checkpoint Size Growing

**Issue**: Checkpoint database growing large

**Solution**:
```python
# Regular cleanup
from scripts.cleanup_checkpoints import cleanup_old_checkpoints

cleanup_old_checkpoints("data/workflow_checkpoints.db", days=7)
```

---

### Migration Between Checkpointers

**Scenario**: Want to switch from SQLite to PostgreSQL

**Solution**:
```python
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver

# Export from SQLite
sqlite_cp = SqliteSaver.from_conn_string("data/checkpoints.db")
checkpoints = list(sqlite_cp.list())

# Import to PostgreSQL
postgres_cp = PostgresSaver.from_conn_string("postgresql://...")
for checkpoint in checkpoints:
    postgres_cp.put(checkpoint)
```

---

## Summary

| Scenario | Recommended Option | Rationale |
|----------|-------------------|-----------|
| Production (privacy-first) | None | Maximum privacy, minimal storage |
| Production (resilience) | SQLite | Local storage, resume capability |
| Development | SQLite or Memory | Debugging with time-travel |
| Testing/CI | Memory | Fast, auto-cleanup |
| Multi-instance | PostgreSQL | User choice, shared state |

**Self-Sovereign Principle**: Always default to no checkpointing. Let user opt into persistence based on their requirements.

---

## Additional Resources

- **Technical Specification**: `docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md`
- **Implementation Guide**: `docs/tasks/LANGGRAPH_STUDIO_IMPLEMENTATION_CHECKLIST.md`
- **Quick Start**: `docs/STUDIO_QUICKSTART.md`
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
