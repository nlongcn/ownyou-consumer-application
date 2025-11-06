# IAB Taxonomy Profile System - Best Practices & Development Guidelines

**Purpose**: This document provides critical guidelines to ensure successful implementation of the IAB Taxonomy Profile System. Refer to this document at EVERY stage of development.

---

## Core Development Principles

### 1. **STOP, THINK, ASK** - Critical Decision Framework

**BEFORE implementing any significant feature or making architectural decisions:**

1. **STOP**: Pause implementation
2. **THINK**:
   - Does this align with the requirements document?
   - Does this match the current phase TODO list?
   - Am I following LangGraph/LangMem best practices?
   - Is there a simpler approach?
3. **ASK**: If unsure, ask the user before proceeding

**Red Flags That Require Stopping**:
- ❌ Creating custom taxonomy values (only use existing IAB values)
- ❌ Reprocessing all emails when only incremental updates needed
- ❌ Implementing complex logic without checking if LangGraph/LangMem has built-in support
- ❌ Deviating from the confidence scoring formulas in requirements
- ❌ Adding features not in the requirements document
- ❌ Skipping validation steps defined in TODO lists

---

## 2. **Always Reference Source Documentation**

### Primary Documentation Sources

**LangGraph Official Documentation**:
- URL: https://docs.langchain.com/oss/python/langgraph/overview
- **CHECK THIS FIRST** before implementing:
  - Graph structure and state management
  - Conditional edges
  - Checkpointing and persistence
  - Memory integration
  - Node implementation patterns

**LangMem Official Documentation**:
- URL: https://langchain-ai.github.io/langmem/
- **CHECK THIS FIRST** before implementing:
  - Memory store initialization
  - Semantic vs episodic memory patterns
  - Memory consolidation logic
  - Namespace organization
  - Memory search and retrieval

**When to Check Documentation**:
- ✅ Before starting any LangGraph/LangMem implementation
- ✅ When encountering unexpected behavior
- ✅ When considering custom solutions (check if built-in exists first)
- ✅ When implementing memory updates or queries
- ✅ When designing state schemas

**How to Use Documentation**:
1. Search for relevant feature/pattern
2. Review official examples
3. Adapt examples to our use case
4. Validate against our requirements
5. Document any deviations with reasoning

---

## 3. **Requirements Alignment Checklist**

**Before completing ANY task, verify**:

### ✅ Requirements Document Alignment
- [ ] Refer to `docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md`
- [ ] Check: Does implementation match stated objectives?
- [ ] Check: Are taxonomy values from IAB standard only (no custom values)?
- [ ] Check: Does confidence scoring follow the specified formulas?
- [ ] Check: Is the data structure compatible with the JSON schema?
- [ ] Check: Are all required taxonomy sections covered?

### ✅ Phase TODO List Alignment
- [ ] Refer to current phase TODO (e.g., `docs/PHASE_1_TODO.md`)
- [ ] Check: Does implementation complete the stated task?
- [ ] Check: Are all subtasks addressed?
- [ ] Check: Do success criteria pass?
- [ ] Update TODO.md with progress and notes

### ✅ Architecture Consistency
- [ ] Does code follow existing patterns (see `marketing_analyzer.py`, `authentic_ikigai_analyzer.py`)?
- [ ] Are Pydantic models used for data validation?
- [ ] Is logging implemented using the project logger?
- [ ] Are LLM clients used through the factory pattern?

---

## 4. **Incremental Development & Validation**

### Development Workflow

**For Every Implementation Task**:

1. **Read** the requirements document section
2. **Read** the phase TODO task details
3. **Check** LangGraph/LangMem documentation for relevant patterns
4. **Plan** the implementation approach
5. **Ask** user if uncertain about approach
6. **Implement** the feature
7. **Test** with unit tests and manual validation
8. **Update** the TODO.md file with status and notes
9. **Validate** against success criteria
10. **Move to next task** only after validation passes

**Never Skip**:
- Reading requirements before implementing
- Checking official documentation
- Writing tests for new functionality
- Updating TODO tracking documents
- Validating against success criteria

---

## 5. **Code Quality Standards**

### Follow Existing Project Patterns

**Analyzer Pattern** (see `marketing_analyzer.py`):
```python
class IABTaxonomyAnalyzer:
    def __init__(self, llm_client, logger=None, model_name=None):
        self.llm_client = llm_client
        self.logger = logger or get_logger(__name__)
        self.model_name = model_name

    def analyze_emails(self, processed_emails: List[Dict], ...) -> ResultModel:
        # 1. Validate input
        # 2. Process data
        # 3. Call LLM with structured prompts
        # 4. Parse and validate results
        # 5. Return Pydantic model
```

**Use Pydantic for All Data Structures**:
```python
from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class TaxonomySelection(BaseModel):
    taxonomy_id: int
    value: str
    confidence: float = Field(ge=0.0, le=1.0)  # Constrained to [0, 1]
    evidence_count: int
    last_validated: str
```

**Logging Pattern**:
```python
from ..utils.logging import get_logger

logger = get_logger(__name__)
logger.info("Starting taxonomy parsing...")
logger.warning("Low confidence score: %.2f", confidence)
logger.error("Failed to parse taxonomy ID: %d", taxonomy_id)
```

---

## 6. **Testing & Validation Requirements**

### Unit Tests Required For

- ✅ All taxonomy parsing functions
- ✅ All lookup table queries
- ✅ Confidence scoring calculations
- ✅ Memory update logic
- ✅ Evidence reconciliation
- ✅ JSON serialization/deserialization

### Test File Structure
```
tests/
  unit/
    test_iab_taxonomy_loader.py
    test_iab_taxonomy_analyzer.py
    test_confidence_scoring.py
    test_memory_reconciliation.py
```

### Manual Validation Required

- ✅ Verify taxonomy entries against Excel file
- ✅ Check sample confidence score calculations
- ✅ Validate JSON output schema matches requirements
- ✅ Test incremental email processing (only new emails)
- ✅ Verify memory persistence across runs

---

## 7. **LangGraph/LangMem Specific Best Practices**

### LangGraph Implementation Guidelines

**State Management**:
- Define clear state schema with TypedDict
- Keep state minimal (only what's needed for routing)
- Use checkpointing for persistence
- Document state transitions

**Conditional Edges**:
- Define clear routing logic
- Handle all possible state conditions
- Use type-safe edge conditions
- Document routing decisions

**Node Functions**:
- Keep nodes focused on single responsibility
- Return state updates, not full state replacement
- Handle errors gracefully
- Log entry/exit of each node

**Example** (from LangGraph docs):
```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class State(TypedDict):
    emails: List[Dict]
    taxonomy_selections: List[Dict]
    profile_version: int

def load_emails_node(state: State) -> State:
    # Implementation
    return {"emails": new_emails}

def analyze_demographics_node(state: State) -> State:
    # Implementation
    return {"taxonomy_selections": selections}

# Build graph
graph = StateGraph(State)
graph.add_node("load", load_emails_node)
graph.add_node("analyze", analyze_demographics_node)
graph.add_edge("load", "analyze")
```

### LangMem Implementation Guidelines

**Memory Organization**:
- Use clear namespaces: `(user_id, "iab_taxonomy_profile")`
- Separate semantic (facts) vs episodic (events) memories
- Store memory IDs for efficient updates
- Include timestamps for temporal decay

**Memory Updates**:
- Query existing memories before adding new ones
- Consolidate duplicates/conflicts
- Update confidence scores incrementally
- Preserve evidence trails

**Memory Queries**:
- Use semantic search for relevant memories
- Filter by namespace correctly
- Handle empty results gracefully
- Cache frequently accessed memories

**Example** (from LangMem docs):
```python
from langmem import create_manage_memory_tool, create_search_memory_tool
from langgraph.store.memory import InMemoryStore

store = InMemoryStore(
    index={
        "dims": 1536,
        "embed": "openai:text-embedding-3-small",
    }
)

namespace = (user_id, "iab_taxonomy_profile")

# Store memory
store.put(
    namespace,
    "memory_id",
    {
        "taxonomy_id": 5,
        "confidence": 0.75,
        "evidence": [...]
    }
)

# Search memories
results = store.search(namespace, query="age range")
```

---

## 8. **Common Pitfalls to Avoid**

### ❌ Don't Do This

1. **Creating Custom Taxonomy Values**
   - ❌ `"Interest: Blockchain Technology"` (not in IAB taxonomy)
   - ✅ Use only exact values from Excel file

2. **Reprocessing All Emails**
   - ❌ Loading all 200 emails every run
   - ✅ Filter for new emails only: `new = all - processed`

3. **Hardcoding Confidence Logic**
   - ❌ `confidence = 0.8` (arbitrary assignment)
   - ✅ Use formulas from requirements document

4. **Ignoring Memory State**
   - ❌ Analyzing emails without checking existing profile
   - ✅ Query LangMem first, then update incrementally

5. **Skipping Validation**
   - ❌ Assuming taxonomy ID exists
   - ✅ Validate against taxonomy lookup tables

6. **Over-engineering**
   - ❌ Building custom graph execution engine
   - ✅ Use LangGraph's built-in features

7. **Poor Error Handling**
   - ❌ Silent failures in LLM calls
   - ✅ Log errors, fall back gracefully, report issues

---

## 9. **Decision Documentation**

### When Making Design Decisions, Document

**In Phase TODO.md "Notes & Decisions" Section**:
```markdown
### Design Decisions
- **Decision**: Used PostgresStore instead of InMemoryStore for production
- **Reasoning**: Need persistence across server restarts
- **Reference**: LangMem docs - Storage Backends section
- **Date**: 2025-09-30

### Challenges Encountered
- **Challenge**: Excel file had inconsistent column headers
- **Solution**: Used pandas with header=None and row indexing
- **Reference**: Task 2, subtask 3
```

---

## 10. **Comprehensive Testing Requirements**

### Test at Every Phase (Critical)

**Refer to**: `docs/TESTING_STRATEGY.md` for complete testing plan

### Testing Workflow

**After Implementing Any Feature**:
1. ✅ Write unit tests for new functions
2. ✅ Write integration tests for phase interactions
3. ✅ Run full test suite (no regressions)
4. ✅ Verify manual validation checklist
5. ✅ Check code coverage (target: >80%)
6. ✅ Update testing documentation

### Test File Structure
```
tests/
  unit/
    test_phase1_taxonomy_loader.py
    test_phase2_memory_system.py
    test_phase3_workflow.py
    ...
  integration/
    test_phase1_integration.py
    test_phase2_integration.py
    ...
  e2e/
    test_complete_workflow.py
```

### Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific phase
pytest tests/unit/test_phase1_*.py -v

# Run with coverage
pytest tests/ --cov=src/email_parser --cov-report=html

# Run only integration tests
pytest tests/integration/ -v
```

### Test Coverage Requirements

- ✅ **Unit Tests**: All new functions and classes
- ✅ **Integration Tests**: Each phase with previous phases
- ✅ **Regression Tests**: Existing functionality still works
- ✅ **Manual Validation**: Real data testing
- ✅ **Performance Tests**: Benchmarks for critical paths

---

## 11. **GitHub Repository & Version Control**

### Repository Setup

**Initial Setup**:
```bash
# Check if already a git repo
git status

# If not initialized, create repo
# (This repo is already initialized per requirements)

# Create GitHub repository
gh repo create email-parser-iab-taxonomy --private --source=. --remote=origin

# Push to GitHub
git add .
git commit -m "Initial commit: IAB Taxonomy Profile System foundation"
git push -u origin master
```

### Commit Strategy

**Commit After Each Completed Task**:
```bash
# Phase 1, Task 1 example
git add requirements.txt
git commit -m "Phase 1, Task 1: Add LangGraph, LangMem dependencies

- Added langgraph, langmem, langchain-core
- Added langchain-openai, langchain-anthropic
- Added openpyxl for Excel parsing
- Added psycopg2-binary for PostgreSQL support

Ref: docs/PHASE_1_TODO.md Task 1"

git push origin master
```

**Commit Message Format**:
```
Phase X, Task Y: [Brief description]

[Detailed changes]
- Change 1
- Change 2

[Optional: Challenges/Decisions]

Ref: docs/PHASE_X_TODO.md Task Y
```

### Branch Strategy (Optional for Solo Development)

```bash
# Create feature branch for each phase
git checkout -b phase-1-foundation
# ... work on phase 1 ...
git commit -m "Phase 1 complete"
git checkout master
git merge phase-1-foundation
git push origin master
```

### Update Frequency

**Commit Frequency**:
- ✅ After completing each TODO task
- ✅ After writing tests that pass
- ✅ After fixing bugs
- ✅ At end of each work session
- ✅ Before moving to next phase

**Push Frequency**:
- ✅ After each commit (for backup)
- ✅ Minimum: End of each work session
- ✅ Before taking breaks

### GitHub Actions CI/CD

**Setup GitHub Actions** (`.github/workflows/test.yml`):
```yaml
name: Test Suite

on:
  push:
    branches: [ master, main ]
  pull_request:
    branches: [ master, main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt

    - name: Run tests
      run: |
        pytest tests/ -v --cov=src/email_parser --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

**Benefits**:
- ✅ Automatic testing on every push
- ✅ Catch regressions immediately
- ✅ Code coverage tracking
- ✅ Build status badge for README

---

## 12. **Phase Transition Checklist**

### Before Moving to Next Phase

**Code Completion**:
- [ ] All tasks in current phase TODO.md completed
- [ ] All success criteria validated
- [ ] Unit tests passing (100%)
- [ ] Integration tests passing (100%)
- [ ] No regressions in existing test suite
- [ ] Code coverage >80% for new code
- [ ] Manual validation performed

**Documentation**:
- [ ] TODO.md updated with completion status
- [ ] Design decisions documented
- [ ] Challenges and solutions noted
- [ ] TESTING_STRATEGY.md updated with test results

**Version Control**:
- [ ] All changes committed to git
- [ ] Descriptive commit messages
- [ ] Pushed to GitHub
- [ ] GitHub Actions CI passing (if configured)

**Review & Approval**:
- [ ] Code reviewed against requirements
- [ ] User approval obtained (if significant changes)
- [ ] Next phase TODO.md created

---

## Quick Reference Card

### When Starting Any Task

1. ✅ Read requirements document section
2. ✅ Read phase TODO task details
3. ✅ Check LangGraph/LangMem docs
4. ✅ Ask if uncertain
5. ✅ Implement with existing patterns
6. ✅ Write unit tests
7. ✅ Run integration tests
8. ✅ Update TODO.md
9. ✅ Commit to git
10. ✅ Validate success criteria

### When Stuck

1. 🛑 Stop coding
2. 📖 Re-read requirements
3. 🔍 Check official documentation
4. 💭 Think through the problem
5. 🙋 Ask the user
6. 📝 Document the decision

### After Completing Any Task

1. ✅ Run test suite: `pytest tests/ -v`
2. ✅ Check coverage: `pytest tests/ --cov=src/email_parser`
3. ✅ Manual validation from TODO checklist
4. ✅ Update TODO.md with status
5. ✅ Git commit with descriptive message
6. ✅ Git push to GitHub

### Documentation URLs (Always Check First)

- **LangGraph**: https://docs.langchain.com/oss/python/langgraph/overview
- **LangMem**: https://langchain-ai.github.io/langmem/
- **Requirements**: `docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md`
- **Current Phase**: `docs/PHASE_X_TODO.md`
- **Testing Strategy**: `docs/TESTING_STRATEGY.md`
- **Best Practices**: `docs/BEST_PRACTICES.md` (this document)

---

## Remember

> **Quality over Speed**: It's better to stop, think, and ask than to implement incorrectly and refactor later.

> **Documentation First**: Always check official docs before creating custom solutions.

> **Requirements Alignment**: Every line of code should serve the stated requirements.

> **Test Everything**: Write tests before marking tasks complete. No untested code.

> **Version Control**: Commit frequently with clear messages. Push to GitHub for backup.

> **Incremental Validation**: Test and validate at every step, not just at the end.

---

**Document Version**: 1.1
**Created**: 2025-09-30
**Last Updated**: 2025-09-30
**Review**: Before starting EVERY phase