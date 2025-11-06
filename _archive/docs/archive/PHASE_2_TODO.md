# Phase 2: Memory System Design - TODO List

**Phase Goal**: Implement LangMem-based persistent memory system for storing taxonomy classifications, confidence scores, and evidence trails across daily runs.

**Reference Documents**:
- [IAB_TAXONOMY_PROFILE_REQUIREMENTS.md](./IAB_TAXONOMY_PROFILE_REQUIREMENTS.md) - Memory structure section
- [BEST_PRACTICES.md](./BEST_PRACTICES.md) - LangMem documentation reference
- LangMem Official Docs: https://langchain-ai.github.io/langmem/

---

## Tasks

### ☐ Task 1: Design Memory Schema & Namespace Structure
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Design namespace pattern: `(user_id, "iab_taxonomy_profile")`
- [ ] Define semantic memory structure for taxonomy classifications
- [ ] Define episodic memory structure for email evidence trails
- [ ] Design processed email tracking structure
- [ ] Document memory schema with examples

**Success Criteria**:
- Clear namespace hierarchy designed
- Semantic memory schema includes: taxonomy_id, confidence, evidence_count, dates
- Episodic memory schema includes: email_id, date, taxonomy_selections, reasoning
- Schema documented in code comments

**Memory Structure** (from requirements):
```python
# Semantic Memory (Facts about user)
{
  "memory_id": "demo_age_range_25_29",
  "taxonomy_id": 5,
  "category_path": "Demographic | Age Range | 25-29",
  "value": "25-29",
  "confidence": 0.75,
  "evidence_count": 8,
  "supporting_evidence": ["email_id_1", ...],
  "contradicting_evidence": [],
  "last_validated": "2025-09-30",
  "first_observed": "2025-09-15",
  "days_since_validation": 0
}

# Episodic Memory (Evidence trail)
{
  "episode_id": "email_19989c11387876ec",
  "email_id": "19989c11387876ec",
  "date": "2025-09-27",
  "taxonomy_selections": [5, 156, 342],
  "confidence_contributions": {5: 0.8, 156: 0.6, 342: 0.9},
  "reasoning": "Newsletter topics suggest..."
}
```

---

### ☐ Task 2: Initialize Memory Store (Development)
**Status**: Pending
**Estimated Time**: 30 minutes

**Subtasks**:
- [ ] Create `src/email_parser/memory/store.py`
- [ ] Initialize InMemoryStore for development/testing
- [ ] Configure embedding dimensions (1536 for OpenAI text-embedding-3-small)
- [ ] Implement store initialization function
- [ ] Add configuration for storage backend selection (InMemory vs Postgres)

**Success Criteria**:
- InMemoryStore initializes successfully
- Embedding configuration correct (dims=1536)
- Can switch between InMemory and Postgres via config
- Store instance can be created and accessed

**Code Pattern** (from LangMem docs):
```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore(
    index={
        "dims": 1536,
        "embed": "openai:text-embedding-3-small"
    }
)
```

---

### ☐ Task 3: Implement Memory Manager Class
**Status**: Pending
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `MemoryManager` class in `src/email_parser/memory/manager.py`
- [ ] Implement `store_semantic_memory(memory_id, data)` method
- [ ] Implement `get_semantic_memory(memory_id)` method
- [ ] Implement `store_episodic_memory(episode_id, data)` method
- [ ] Implement `get_episodic_memory(episode_id)` method
- [ ] Implement `search_memories(query, namespace)` method
- [ ] Implement `get_processed_email_ids()` method
- [ ] Implement `mark_email_as_processed(email_id)` method

**Success Criteria**:
- MemoryManager can store and retrieve semantic memories
- MemoryManager can store and retrieve episodic memories
- Search functionality works with embedding-based similarity
- Processed email tracking operational
- All methods have proper error handling

**Key Methods**:
```python
class MemoryManager:
    def __init__(self, user_id: str, store: InMemoryStore):
        self.user_id = user_id
        self.store = store
        self.namespace = (user_id, "iab_taxonomy_profile")

    def store_semantic_memory(self, memory_id: str, data: dict):
        """Store a semantic memory (fact about user)."""

    def get_semantic_memory(self, memory_id: str) -> Optional[dict]:
        """Retrieve a semantic memory by ID."""

    def store_episodic_memory(self, episode_id: str, data: dict):
        """Store an episodic memory (event/evidence)."""
```

---

### ☐ Task 4: Implement Confidence Scoring Engine
**Status**: Pending
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `src/email_parser/memory/confidence.py`
- [ ] Implement `update_confidence(current, new_evidence, evidence_type)` function
- [ ] Implement Bayesian-style update for confirming evidence
- [ ] Implement reduction formula for contradicting evidence
- [ ] Implement `apply_temporal_decay(confidence, days_since_last)` function
- [ ] Implement confidence recalibration logic (< 0.5 mark for review)
- [ ] Add unit tests for all confidence formulas

**Success Criteria**:
- Confirming evidence increases confidence correctly
- Contradicting evidence decreases confidence correctly
- Temporal decay applies 1% per week correctly
- All formulas match requirements document exactly
- Unit tests validate edge cases (0.0, 1.0 bounds)

**Formulas** (from requirements):
```python
# Confirming Evidence
new_confidence = current + (1 - current) * new_evidence_strength * 0.3

# Contradicting Evidence
new_confidence = current * (1 - contradiction_strength * 0.5)

# Temporal Decay
decay_rate = 0.01 * (days_since_last_validation / 7)
new_confidence = current * (1 - decay_rate)
```

---

### ☐ Task 5: Implement Evidence Reconciliation Logic
**Status**: Pending
**Estimated Time**: 1.5 hours

**Subtasks**:
- [ ] Create `src/email_parser/memory/reconciliation.py`
- [ ] Implement `reconcile_evidence(existing, new, evidence_type)` function
- [ ] Classify evidence type: confirming / contradicting / neutral
- [ ] Update evidence lists (supporting_evidence, contradicting_evidence)
- [ ] Update evidence_count
- [ ] Apply confidence update based on evidence type
- [ ] Update last_validated timestamp

**Success Criteria**:
- Evidence reconciliation correctly identifies confirming vs contradicting
- Evidence lists updated correctly
- Confidence scores updated according to formulas
- Timestamps updated appropriately
- Handles edge cases (first evidence, no existing memory)

**Reconciliation Logic**:
1. Load existing semantic memory for taxonomy_id
2. Compare new evidence with existing value
3. Classify: confirming / contradicting / neutral
4. Update confidence score using appropriate formula
5. Append email_id to supporting or contradicting evidence list
6. Update evidence_count and last_validated date
7. Store updated semantic memory

---

### ☐ Task 6: Implement Memory Query Utilities
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Implement `get_all_taxonomy_memories(user_id)` - retrieve all classifications
- [ ] Implement `get_memories_by_section(user_id, section)` - filter by demographics/interests/etc
- [ ] Implement `get_high_confidence_memories(user_id, threshold=0.8)`
- [ ] Implement `get_stale_memories(user_id, days_threshold=30)` - needs validation
- [ ] Implement `get_evidence_for_taxonomy(user_id, taxonomy_id)` - get all supporting emails

**Success Criteria**:
- All query functions return correct filtered results
- Performance acceptable for 100+ memories
- Handles empty results gracefully
- Returns properly structured data (Pydantic models)

---

### ☐ Task 7: Unit Tests for Memory System
**Status**: Pending
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `tests/unit/test_memory_store.py`
- [ ] Test InMemoryStore initialization
- [ ] Test namespace creation
- [ ] Create `tests/unit/test_memory_manager.py`
- [ ] Test storing/retrieving semantic memories
- [ ] Test storing/retrieving episodic memories
- [ ] Test processed email tracking
- [ ] Create `tests/unit/test_confidence_scoring.py`
- [ ] Test confirming evidence updates
- [ ] Test contradicting evidence updates
- [ ] Test temporal decay calculation
- [ ] Test confidence bounds (0.0, 1.0)
- [ ] Create `tests/unit/test_reconciliation.py`
- [ ] Test evidence classification
- [ ] Test memory consolidation

**Success Criteria**:
- All unit tests pass
- Code coverage >80% for memory modules
- Edge cases validated (empty data, boundary values)
- Performance tests for memory queries

**Test Structure**:
```python
# tests/unit/test_memory_manager.py
def test_store_semantic_memory():
    """Test storing a semantic memory."""
    manager = MemoryManager(user_id="test_user", store=test_store)
    memory_data = {
        "taxonomy_id": 5,
        "confidence": 0.75,
        "evidence_count": 3
    }
    manager.store_semantic_memory("age_range_25_29", memory_data)

    result = manager.get_semantic_memory("age_range_25_29")
    assert result['taxonomy_id'] == 5
    assert result['confidence'] == 0.75
```

---

### ☐ Task 8: Integration Test with Phase 1
**Status**: Pending
**Estimated Time**: 30 minutes

**Subtasks**:
- [ ] Create `tests/integration/test_phase2_integration.py`
- [ ] Test MemoryManager with IABTaxonomyLoader
- [ ] Verify storing taxonomy classifications
- [ ] Verify retrieving and updating existing classifications
- [ ] Test confidence evolution over multiple updates
- [ ] Verify no conflicts with existing codebase

**Success Criteria**:
- Memory system integrates cleanly with taxonomy loader
- Can store TaxonomySelection Pydantic models
- Can update confidence scores based on new evidence
- No regressions in Phase 1 functionality

---

## Phase 2 Completion Checklist

**Code Completion**:
- [X] All 8 tasks completed ✓
- [X] Memory store initialization working ✓
- [X] MemoryManager class fully implemented ✓
- [X] Confidence scoring engine operational ✓
- [X] Evidence reconciliation logic complete ✓
- [X] Memory query utilities functional ✓

**Testing**:
- [X] All unit tests passing (100%) ✓ 81/81 tests
- [X] Integration tests passing (100%) ✓ 9/9 tests
- [X] Code coverage >80% for memory modules ✓
- [X] Manual validation complete ✓

**Documentation**:
- [X] Memory schema documented in code ✓
- [X] Confidence formulas validated against requirements ✓
- [X] TODO.md updated with status and notes ✓
- [X] Design decisions documented ✓

**Version Control**:
- [X] All changes committed to git ✓
- [X] Descriptive commit messages ✓
- [X] Pushed to GitHub ✓
- [X] Phase 1 tests still passing (no regressions) ✓

---

## Phase 2 Notes & Decisions

**Date**: 2025-09-30
**Status**: ✅ **COMPLETE**

### Design Decisions

1. **Namespace Structure**: Simple `(user_id, collection_name)` pattern
   - Rejected adding taxonomy_id, timestamps, data_source to namespace
   - Store metadata in memory data itself for flexibility
   - Use memory_id prefixes for type encoding: "semantic_demographics_5_25-29"

2. **Memory ID Index System**: Implemented separate index collection
   - Solves InMemoryStore limitation (no built-in list() method)
   - Tracks all semantic/episodic memory IDs automatically
   - Enables efficient querying without embeddings

3. **Tier Breakdown**: Added tier_1 through tier_5 fields to SemanticMemory
   - Requested by user for easy filtering
   - Avoids parsing category_path string

4. **Timestamps**: Three separate timestamps for different purposes
   - first_observed: When classification first appeared
   - last_validated: When evidence last confirmed
   - last_updated: When any field changed

5. **Confidence Formulas**: Implemented exactly per requirements
   - Confirming: new = current + (1-current) * strength * 0.3
   - Contradicting: new = current * (1 - strength * 0.5)
   - Temporal decay: 1% per week

### Challenges Encountered

1. **InMemoryStore Missing list() Method**
   - Challenge: Could not retrieve all memories without embeddings
   - Solution: Implemented memory ID index in separate namespace
   - Auto-tracks all memory IDs on store/delete operations

2. **Embeddings Requiring OpenAI API Key**
   - Challenge: InMemoryStore with embeddings required API key
   - Solution: Made embeddings optional (enable_embeddings=False default)

### Performance Metrics

- **Total Code Added**: ~2,000 lines (memory system + tests)
- **Test Coverage**: 90 tests passing (81 unit + 9 integration)
- **Files Created**:
  - src/email_parser/memory/schemas.py (435 lines)
  - src/email_parser/memory/store.py (111 lines)
  - src/email_parser/memory/manager.py (657 lines)
  - src/email_parser/memory/confidence.py (357 lines)
  - src/email_parser/memory/reconciliation.py (474 lines)
  - tests/unit/test_confidence_scoring.py (467 lines)
  - tests/unit/test_reconciliation.py (499 lines)
  - tests/unit/test_memory_queries.py (369 lines)
  - tests/integration/test_phase2_integration.py (493 lines)

- **Test Execution Time**: <2 seconds for all 90 tests
- **No Regressions**: Phase 1 tests still passing

---

**Next Phase**: [Phase 3: LangGraph Workflow Design](./PHASE_3_TODO.md)
**Previous Phase**: [Phase 1: Foundation & Data Infrastructure](./PHASE_1_TODO.md) ✓ Complete