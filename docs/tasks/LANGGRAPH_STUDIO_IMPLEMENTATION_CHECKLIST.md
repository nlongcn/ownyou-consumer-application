# LangGraph Studio Integration - Implementation Checklist

**Version:** 1.0
**Last Updated:** 2025-01-18
**Estimated Time:** 2-3 hours
**Difficulty:** Medium

---

## Prerequisites

Before starting, ensure you have:
- [ ] Read `docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md`
- [ ] Working email parser installation
- [ ] All existing tests passing
- [ ] Git working tree clean (all changes committed)

---

## Phase 1: Preparation (15 min)

### Step 1.1: Create Feature Branch
```bash
git checkout -b feature/langgraph-studio-integration
```

**Verification**: `git branch` shows new branch

---

### Step 1.2: Install LangGraph CLI
```bash
pip install langgraph-cli
```

**Verification**:
```bash
langgraph --version
# Should output version number (e.g., 0.1.0 or higher)
```

---

### Step 1.3: Backup Current State
```bash
# Create backup tag
git tag pre-studio-integration

# Note current commit hash
git log -1 --oneline
```

**Verification**: Tag created successfully

---

## Phase 2: Configuration Files (10 min)

### Step 2.1: Create langgraph.json

Create file at project root:

```bash
cat > langgraph.json << 'EOF'
{
  "dependencies": [
    "."
  ],
  "graphs": {
    "email_taxonomy_workflow": "./src/email_parser/workflow/studio.py:create_graph"
  },
  "env": ".env"
}
EOF
```

**Verification**:
```bash
cat langgraph.json
# Should display JSON content
```

---

### Step 2.2: Update .gitignore

Add Studio artifacts to `.gitignore`:

```bash
cat >> .gitignore << 'EOF'

# LangGraph Studio
data/studio_checkpoints.db
data/studio_checkpoints.db-shm
data/studio_checkpoints.db-wal
EOF
```

**Verification**:
```bash
tail -5 .gitignore
# Should show new entries
```

---

### Step 2.3: Update requirements.txt

Add langgraph-cli to `requirements.txt`:

```bash
echo "langgraph-cli>=0.1.0  # Development tool for Studio visualization" >> requirements.txt
```

**Verification**:
```bash
grep langgraph-cli requirements.txt
# Should show new line
```

---

## Phase 3: Code Changes (30 min)

### Step 3.1: Update graph.py - Add Checkpointer Parameter

**File**: `src/email_parser/workflow/graph.py`

**Line 48 - Update function signature**:
```python
def build_workflow_graph(
    memory_manager: MemoryManager,
    checkpointer=None  # NEW: Optional parameter
) -> StateGraph:
```

**Line 50-70 - Update docstring**:
```python
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

    Example:
        >>> memory_manager = MemoryManager(user_id="user_123", store=store)
        >>> graph = build_workflow_graph(memory_manager)
        >>> result = graph.invoke({"user_id": "user_123", "emails": [...]})
    """
```

**Line 117-120 - Update compile call**:
```python
    # Compile graph with or without checkpointer
    if checkpointer:
        compiled_graph = workflow.compile(checkpointer=checkpointer)
    else:
        compiled_graph = workflow.compile()

    logger.info("Workflow graph compiled successfully")
    return compiled_graph
```

**Verification**:
```bash
# Check syntax
python -m py_compile src/email_parser/workflow/graph.py

# Verify function signature
grep -A 3 "def build_workflow_graph" src/email_parser/workflow/graph.py
```

---

### Step 3.2: Create studio.py - Studio Entry Point

Create `src/email_parser/workflow/studio.py`:

```python
#!/usr/bin/env python3
"""
LangGraph Studio Entry Point

Provides a graph instance with checkpointer for Studio visualization.
This file is ONLY used by Studio, never by production code.

Reference: docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md
"""

from .graph import build_workflow_graph
from ..memory.manager import MemoryManager
from ..memory.backends import SQLiteStore
from langgraph.checkpoint.sqlite import SqliteSaver
import logging

logger = logging.getLogger(__name__)


def create_graph():
    """
    Create workflow graph for LangGraph Studio.

    This is the entry point specified in langgraph.json.
    Studio uses this to load and visualize the workflow.

    Returns:
        Compiled StateGraph with local SQLite checkpointer

    Example:
        # Studio calls this automatically
        graph = create_graph()

        # Or test manually:
        result = graph.invoke({
            "user_id": "test",
            "emails": [{"id": "1", "subject": "Test", "body": "...", "date": "2025-01-15"}]
        })
    """
    logger.info("Creating workflow graph for LangGraph Studio")

    # Create memory manager with local SQLite store
    store = SQLiteStore("data/email_parser_memory.db")
    memory_manager = MemoryManager(user_id="studio_user", store=store)

    # Create local SQLite checkpointer for state persistence
    # This enables time-travel debugging in Studio
    checkpointer = SqliteSaver.from_conn_string("data/studio_checkpoints.db")

    # Build graph with checkpointer
    graph = build_workflow_graph(memory_manager, checkpointer)

    logger.info("Studio graph created successfully")
    return graph
```

**Verification**:
```bash
# Check syntax
python -m py_compile src/email_parser/workflow/studio.py

# Verify import paths
python -c "from src.email_parser.workflow.studio import create_graph; print('Import successful')"
```

---

## Phase 4: Testing (30 min)

### Step 4.1: Run Existing Tests

Verify backward compatibility:

```bash
# Unit tests
pytest tests/unit/test_workflow_graph.py -v

# Integration tests
pytest tests/integration/test_workflow_integration.py -v

# Full test suite
pytest -v
```

**Expected**: All tests pass (no failures)

**If tests fail**: Revert changes and investigate

---

### Step 4.2: Test Production Workflow

Test existing CLI workflow (no checkpointer):

```bash
# Simulate production run
python -m src.email_parser.main --help

# If you have test data:
python -c "
from src.email_parser.workflow import run_workflow
from src.email_parser.memory.manager import MemoryManager

memory_manager = MemoryManager(user_id='test')
emails = [{'id': 'test_1', 'subject': 'Test', 'body': 'Test email', 'date': '2025-01-15'}]

result = run_workflow('test', emails, memory_manager)
print(f'Success: {result.get(\"workflow_completed_at\") is not None}')
"
```

**Expected**: Workflow runs without errors

---

### Step 4.3: Test Studio Mode

Test graph with checkpointer:

```bash
python -c "
from src.email_parser.workflow.studio import create_graph

# Create graph
graph = create_graph()
print('Graph created successfully')

# Test invocation
result = graph.invoke({
    'user_id': 'studio_test',
    'emails': [{'id': 'test_1', 'subject': 'Test', 'body': 'Test email', 'date': '2025-01-15'}]
})
print(f'Graph executed successfully: {result.get(\"workflow_completed_at\") is not None}')
"
```

**Expected**: Graph creates and executes successfully

---

### Step 4.4: Launch Studio

Start LangGraph Studio:

```bash
langgraph dev
```

**Expected Output**:
```
Ready!
- API: http://127.0.0.1:2024
- Studio UI: http://127.0.0.1:2024
- Docs: http://127.0.0.1:2024/docs
```

**Manual Verification**:
1. Open browser to `http://127.0.0.1:2024`
2. Select graph: `email_taxonomy_workflow`
3. Verify graph displays visually
4. Test with sample email input
5. Inspect state at each node
6. Verify no errors in console

**Common Issues**:
- Port 2024 already in use → Kill process or use `--port` flag
- Graph not loading → Check `langgraph.json` syntax
- Import errors → Verify `PYTHONPATH` and module structure

---

## Phase 5: Dashboard Integration Test (15 min)

### Step 5.1: Test Dashboard Workflow

Verify dashboard still works:

```bash
# Start backend
cd dashboard/backend
python app.py

# In another terminal, test API
curl http://localhost:5001/api/analyze/models
```

**Expected**: Dashboard API responds normally

---

### Step 5.2: Run Full Pipeline

Test complete pipeline via dashboard:

1. Open dashboard UI: `http://localhost:3000`
2. Download emails (Step 1)
3. Summarize emails (Step 2)
4. Classify emails (Step 3)
5. View results

**Expected**: All steps complete successfully

---

## Phase 6: Documentation (30 min)

### Step 6.1: Create Quick-Start Guide

See separate task: Create `docs/STUDIO_QUICKSTART.md`

---

### Step 6.2: Create Reference Documentation

See separate task: Create `docs/reference/CHECKPOINTER_OPTIONS.md`

---

### Step 6.3: Update README.md

Add Studio section to README.md (see separate task)

---

### Step 6.4: Update CLAUDE.md

Add Studio usage to CLAUDE.md (see separate task)

---

## Phase 7: Commit and Push (10 min)

### Step 7.1: Review Changes

```bash
git status
git diff
```

**Expected Files**:
- Modified: `src/email_parser/workflow/graph.py`
- Modified: `.gitignore`
- Modified: `requirements.txt`
- New: `langgraph.json`
- New: `src/email_parser/workflow/studio.py`
- New: `docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md`
- New: `docs/tasks/LANGGRAPH_STUDIO_IMPLEMENTATION_CHECKLIST.md`
- New: `docs/STUDIO_QUICKSTART.md`
- New: `docs/reference/CHECKPOINTER_OPTIONS.md`

---

### Step 7.2: Run Pre-Commit Checks

```bash
# Code formatting
black src/email_parser/workflow/

# Linting (if configured)
flake8 src/email_parser/workflow/ || true

# Type checking (if configured)
mypy src/email_parser/workflow/ || true
```

---

### Step 7.3: Commit Changes

```bash
git add .
git commit -m "$(cat <<'EOF'
feat: Add LangGraph Studio visualization support

Changes:
- Add optional checkpointer parameter to build_workflow_graph()
- Create studio.py entry point for LangGraph Studio
- Add langgraph.json configuration
- Update documentation with Studio usage guide
- Maintain backward compatibility (all existing tests pass)
- Preserve self-sovereign architecture (local-first defaults)

Technical Details:
- Option A implementation (optional parameter, backward compatible)
- Local SQLite checkpointing for Studio debugging
- Zero impact on production deployment
- Default behavior unchanged (no checkpointing)

Documentation:
- Technical specification: docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md
- Implementation checklist: docs/tasks/LANGGRAPH_STUDIO_IMPLEMENTATION_CHECKLIST.md
- Quick-start guide: docs/STUDIO_QUICKSTART.md
- Reference docs: docs/reference/CHECKPOINTER_OPTIONS.md

Refs: #langgraph-studio-integration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Step 7.4: Push to Remote

```bash
git push origin feature/langgraph-studio-integration
```

---

## Phase 8: Create Pull Request (10 min)

### Step 8.1: Create PR on GitHub

```bash
gh pr create --title "Add LangGraph Studio visualization support" --body "$(cat <<'EOF'
## Summary
Add LangGraph Studio integration for visual debugging and workflow inspection during development.

## Changes
- ✅ Optional checkpointer parameter (backward compatible)
- ✅ Studio entry point (`studio.py`)
- ✅ Configuration file (`langgraph.json`)
- ✅ Comprehensive documentation
- ✅ All existing tests pass
- ✅ Zero impact on production

## Testing
- [x] All unit tests pass
- [x] All integration tests pass
- [x] Dashboard workflow works
- [x] Studio loads and displays graph
- [x] Time-travel debugging functional

## Documentation
- [x] Technical specification
- [x] Implementation checklist
- [x] Quick-start guide
- [x] Reference documentation
- [x] README.md updated
- [x] CLAUDE.md updated

## Self-Sovereign Compliance
- [x] Local-first defaults (no cloud dependencies)
- [x] Optional checkpointing (user choice)
- [x] SQLite local storage only
- [x] Privacy-preserving design maintained

## Rollback Plan
Simple revert available. See docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md Section 8.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Rollback Instructions

If anything goes wrong:

```bash
# Option 1: Quick revert (keep branch)
git checkout master
git checkout -b rollback-studio
git revert HEAD~1
git push origin rollback-studio

# Option 2: Delete branch
git checkout master
git branch -D feature/langgraph-studio-integration

# Option 3: Revert to tag
git checkout pre-studio-integration
git checkout -b recovery
```

---

## Success Criteria

- [ ] All existing tests pass
- [ ] Dashboard workflow functions normally
- [ ] Studio loads graph successfully
- [ ] Can execute sample emails in Studio
- [ ] Time-travel debugging works
- [ ] Documentation complete
- [ ] Code review approved
- [ ] PR merged to master

---

## Troubleshooting

### Issue: Studio won't start
**Solution**:
```bash
# Check port availability
lsof -i :2024

# Kill process if needed
kill -9 $(lsof -t -i:2024)

# Try different port
langgraph dev --port 3024
```

### Issue: Graph not found
**Solution**:
- Verify `langgraph.json` path is correct
- Check `studio.py` import paths
- Ensure `PYTHONPATH` includes project root

### Issue: Checkpointer errors
**Solution**:
```bash
# Delete checkpoint database
rm data/studio_checkpoints.db*

# Verify import
python -c "from langgraph.checkpoint.sqlite import SqliteSaver; print('OK')"
```

### Issue: Tests failing
**Solution**:
1. Check which tests fail
2. Verify `checkpointer=None` default preserved
3. Ensure no breaking changes to function signature
4. Review `graph.py` modifications

---

## Next Steps After Completion

1. **Team Review**: Share PR with team for code review
2. **Documentation**: Add Studio screenshots to docs
3. **Training**: Create video tutorial for team
4. **Monitoring**: Track Studio usage and collect feedback
5. **Iteration**: Consider enhancements (LangSmith, custom metadata, etc.)

---

**Estimated Total Time**: 2-3 hours
**Difficulty**: Medium
**Risk Level**: Low (backward compatible, well-tested)
