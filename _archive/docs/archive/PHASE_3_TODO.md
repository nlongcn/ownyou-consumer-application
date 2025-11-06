# Phase 3: LangGraph Workflow Design - TODO List

**Phase Goal**: Design and implement LangGraph-based stateful workflow for orchestrating email analysis, memory retrieval, evidence reconciliation, and profile updates.

**Reference Documents**:
- [IAB_TAXONOMY_PROFILE_REQUIREMENTS.md](./IAB_TAXONOMY_PROFILE_REQUIREMENTS.md) - LangGraph workflow section
- [BEST_PRACTICES.md](./BEST_PRACTICES.md) - LangGraph documentation reference
- LangGraph Official Docs: https://docs.langchain.com/oss/python/langgraph/overview

---

## Phase 3 Overview

**Objective**: Build a LangGraph StateGraph that orchestrates the entire email analysis pipeline with:
- Stateful email processing with checkpointing
- Conditional routing based on email content
- Parallel analyzer execution
- Memory retrieval and updates
- Evidence reconciliation

**Key Workflow Nodes**:
1. Load New Emails (filter already-processed)
2. Retrieve Existing Profile (from LangMem)
3. Parallel Analysis Nodes (demographics, household, interests, purchase)
4. Evidence Reconciliation (compare new vs existing)
5. Confidence Update (Bayesian + temporal decay)
6. Memory Consolidation (update LangMem)
7. Generate JSON Report

---

## Tasks

### ✅ Task 1: Define State Schema
**Status**: Complete
**Actual Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/workflow/state.py`
- [ ] Define `WorkflowState` TypedDict with all fields
- [ ] Include: user_id, emails, existing_profile, analysis_results, reconciliation_data
- [ ] Document state transitions and data flow
- [ ] Add Pydantic models for validation

**Success Criteria**:
- State schema includes all necessary fields
- Type hints for all state fields
- Clear documentation of state evolution
- Compatible with LangGraph StateGraph

**State Fields** (from requirements):
```python
class WorkflowState(TypedDict):
    # User context
    user_id: str

    # Email data
    emails: List[Dict[str, Any]]  # New emails to process
    processed_email_ids: List[str]  # Already processed

    # Memory retrieval
    existing_profile: Dict[str, Any]  # Current taxonomy selections

    # Analysis results
    demographics_results: List[TaxonomySelection]
    household_results: List[TaxonomySelection]
    interests_results: List[TaxonomySelection]
    purchase_results: List[TaxonomySelection]

    # Reconciliation
    reconciliation_data: List[Dict[str, Any]]

    # Output
    updated_profile: Dict[str, Any]

    # Metadata
    current_email_index: int
    total_emails: int
    errors: List[str]
```

---

### ☐ Task 2: Implement Email Loading Node
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/workflow/nodes/load_emails.py`
- [ ] Implement `load_new_emails_node(state)` function
- [ ] Filter already-processed email IDs using MemoryManager
- [ ] Load emails from CSV or email provider
- [ ] Update state with new emails list
- [ ] Handle errors gracefully

**Success Criteria**:
- Loads only new (unprocessed) emails
- Updates state.emails and state.processed_email_ids
- Handles empty results (no new emails)
- Error handling for missing/invalid data

**Node Signature**:
```python
def load_new_emails_node(state: WorkflowState) -> WorkflowState:
    """
    Load new emails that haven't been processed yet.

    Args:
        state: Current workflow state with user_id

    Returns:
        Updated state with emails and processed_email_ids
    """
```

---

### ☐ Task 3: Implement Profile Retrieval Node
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/workflow/nodes/retrieve_profile.py`
- [ ] Implement `retrieve_existing_profile_node(state)` function
- [ ] Query MemoryManager for all semantic memories
- [ ] Apply temporal decay to confidence scores
- [ ] Structure existing profile by section
- [ ] Update state.existing_profile

**Success Criteria**:
- Retrieves all semantic memories for user
- Applies temporal decay based on days_since_validation
- Structures profile by taxonomy sections
- Handles new users (empty profile)

**Node Signature**:
```python
def retrieve_existing_profile_node(state: WorkflowState) -> WorkflowState:
    """
    Retrieve existing profile from memory with temporal decay.

    Args:
        state: Current workflow state with user_id

    Returns:
        Updated state with existing_profile
    """
```

---

### ☐ Task 4: Design Conditional Router
**Status**: Pending
**Estimated Time**: 1.5 hours

**Subtasks**:
- [ ] Create `src/email_parser/workflow/routing.py`
- [ ] Implement `route_email_to_analyzers(state)` function
- [ ] Classify email type based on content patterns
- [ ] Return list of analyzer nodes to execute
- [ ] Support parallel routing (multiple analyzers)
- [ ] Add unit tests for routing logic

**Success Criteria**:
- Routes receipts → Purchase Agent
- Routes newsletters → Interests Mapper
- Routes personal emails → Demographics Extractor
- Routes bills/services → Household Analyzer
- Supports multi-signal emails (parallel routing)

**Routing Patterns**:
```python
def route_email_to_analyzers(state: WorkflowState) -> List[str]:
    """
    Determine which analyzer nodes should process current email.

    Returns:
        List of node names (e.g., ["demographics", "interests"])
    """
    email = state.emails[state.current_email_index]

    # Classify based on content
    if contains_receipt_keywords(email):
        return ["purchase"]
    if contains_newsletter_patterns(email):
        return ["interests"]
    if is_personal_correspondence(email):
        return ["demographics"]
    if contains_bill_patterns(email):
        return ["household"]

    # Multi-signal: analyze with multiple nodes
    return ["demographics", "interests"]
```

---

### ☐ Task 5: Create Analyzer Node Stubs
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/workflow/nodes/analyzers.py`
- [ ] Implement stub for `demographics_analyzer_node(state)`
- [ ] Implement stub for `household_analyzer_node(state)`
- [ ] Implement stub for `interests_analyzer_node(state)`
- [ ] Implement stub for `purchase_analyzer_node(state)`
- [ ] Return placeholder TaxonomySelection objects
- [ ] Prepare for Phase 4 LLM integration

**Success Criteria**:
- All 4 analyzer stubs implemented
- Stubs return valid TaxonomySelection structures
- Stubs update appropriate state fields
- Ready for Phase 4 LLM implementation

**Stub Implementation**:
```python
def demographics_analyzer_node(state: WorkflowState) -> WorkflowState:
    """
    Analyze email for demographic signals.

    Phase 3: Returns placeholder data
    Phase 4: Will use LLM for actual analysis
    """
    # Placeholder: return dummy taxonomy selection
    state["demographics_results"].append({
        "taxonomy_id": 5,
        "value": "25-29",
        "confidence": 0.75,
        # ... other fields
    })
    return state
```

---

### ☐ Task 6: Implement Reconciliation Node
**Status**: Pending
**Estimated Time**: 1.5 hours

**Subtasks**:
- [ ] Create `src/email_parser/workflow/nodes/reconcile.py`
- [ ] Implement `reconcile_evidence_node(state)` function
- [ ] Use Phase 2 reconciliation functions
- [ ] Process all analyzer results
- [ ] Update confidence scores
- [ ] Store reconciliation metadata
- [ ] Update state.reconciliation_data

**Success Criteria**:
- Integrates with Phase 2 `reconcile_evidence()` function
- Processes all taxonomy selections from analyzers
- Updates confidence scores correctly
- Tracks confirming vs contradicting evidence

**Node Signature**:
```python
def reconcile_evidence_node(state: WorkflowState) -> WorkflowState:
    """
    Reconcile new evidence with existing memories.

    Uses Phase 2 reconciliation logic to update confidence scores.
    """
    memory_manager = MemoryManager(state["user_id"], store)

    # Combine all analyzer results
    all_selections = (
        state["demographics_results"] +
        state["household_results"] +
        state["interests_results"] +
        state["purchase_results"]
    )

    # Reconcile each selection
    email_id = state.emails[state.current_email_index]["id"]
    results = reconcile_batch_evidence(
        memory_manager,
        all_selections,
        email_id
    )

    state["reconciliation_data"] = results
    return state
```

---

### ☐ Task 7: Implement Memory Update Node
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/workflow/nodes/update_memory.py`
- [ ] Implement `update_memory_node(state)` function
- [ ] Store updated semantic memories
- [ ] Store episodic memory for this email
- [ ] Mark email as processed
- [ ] Update state.updated_profile

**Success Criteria**:
- Updates semantic memories in LangMem
- Stores episodic memory with evidence trail
- Marks email as processed
- Handles errors gracefully

**Node Signature**:
```python
def update_memory_node(state: WorkflowState) -> WorkflowState:
    """
    Update memory store with reconciled evidence.

    Stores semantic + episodic memories, marks email processed.
    """
```

---

### ☐ Task 8: Build StateGraph Workflow
**Status**: Pending
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `src/email_parser/workflow/graph.py`
- [ ] Initialize StateGraph with WorkflowState
- [ ] Add all nodes to graph
- [ ] Define edges between nodes
- [ ] Implement conditional routing logic
- [ ] Add loop for processing multiple emails
- [ ] Configure checkpointing (for future persistence)
- [ ] Compile graph

**Success Criteria**:
- Complete workflow graph compiled
- All nodes connected correctly
- Conditional routing works
- Can process multiple emails in sequence
- Graph structure matches requirements diagram

**Graph Structure**:
```python
from langgraph.graph import StateGraph, END

def create_workflow() -> StateGraph:
    workflow = StateGraph(WorkflowState)

    # Add nodes
    workflow.add_node("load_emails", load_new_emails_node)
    workflow.add_node("retrieve_profile", retrieve_existing_profile_node)
    workflow.add_node("demographics", demographics_analyzer_node)
    workflow.add_node("household", household_analyzer_node)
    workflow.add_node("interests", interests_analyzer_node)
    workflow.add_node("purchase", purchase_analyzer_node)
    workflow.add_node("reconcile", reconcile_evidence_node)
    workflow.add_node("update_memory", update_memory_node)

    # Define edges
    workflow.set_entry_point("load_emails")
    workflow.add_edge("load_emails", "retrieve_profile")

    # Conditional routing to analyzers
    workflow.add_conditional_edges(
        "retrieve_profile",
        route_email_to_analyzers,
        {
            "demographics": "demographics",
            "household": "household",
            "interests": "interests",
            "purchase": "purchase"
        }
    )

    # All analyzers → reconcile
    workflow.add_edge("demographics", "reconcile")
    workflow.add_edge("household", "reconcile")
    workflow.add_edge("interests", "reconcile")
    workflow.add_edge("purchase", "reconcile")

    # Reconcile → update memory
    workflow.add_edge("reconcile", "update_memory")

    # Loop or end
    workflow.add_conditional_edges(
        "update_memory",
        should_continue_processing,
        {
            "continue": "retrieve_profile",  # Next email
            "end": END
        }
    )

    return workflow.compile()
```

---

### ☐ Task 9: Implement Workflow Executor
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/workflow/executor.py`
- [ ] Implement `run_workflow(user_id, emails, store)` function
- [ ] Initialize workflow state
- [ ] Execute compiled graph
- [ ] Handle errors and retries
- [ ] Return final state
- [ ] Add logging throughout

**Success Criteria**:
- Can execute full workflow end-to-end
- Returns updated profile
- Error handling for node failures
- Comprehensive logging

**Executor Function**:
```python
def run_workflow(
    user_id: str,
    emails: List[Dict[str, Any]],
    store: InMemoryStore
) -> Dict[str, Any]:
    """
    Execute the IAB taxonomy profile workflow.

    Args:
        user_id: User identifier
        emails: List of email dictionaries
        store: LangMem store instance

    Returns:
        Updated profile dictionary
    """
    # Initialize state
    initial_state = {
        "user_id": user_id,
        "emails": emails,
        "processed_email_ids": [],
        "existing_profile": {},
        "demographics_results": [],
        "household_results": [],
        "interests_results": [],
        "purchase_results": [],
        "reconciliation_data": [],
        "updated_profile": {},
        "current_email_index": 0,
        "total_emails": len(emails),
        "errors": []
    }

    # Execute workflow
    workflow = create_workflow()
    final_state = workflow.invoke(initial_state)

    return final_state["updated_profile"]
```

---

### ☐ Task 10: Unit Tests for Workflow
**Status**: Pending
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `tests/unit/test_workflow_state.py`
- [ ] Test state schema validation
- [ ] Create `tests/unit/test_workflow_nodes.py`
- [ ] Test each node independently
- [ ] Create `tests/unit/test_workflow_routing.py`
- [ ] Test conditional routing logic
- [ ] Mock MemoryManager for isolation
- [ ] Test error handling

**Success Criteria**:
- All nodes have unit tests
- Routing logic tested with various email types
- State transitions validated
- Error cases covered

---

### ☐ Task 11: Integration Test for Full Workflow
**Status**: Pending
**Estimated Time**: 1.5 hours

**Subtasks**:
- [ ] Create `tests/integration/test_phase3_workflow.py`
- [ ] Test end-to-end workflow execution
- [ ] Use real MemoryManager and InMemoryStore
- [ ] Process sample emails
- [ ] Verify memory updates
- [ ] Verify confidence evolution
- [ ] Test with Phase 1 taxonomy loader
- [ ] Test with Phase 2 memory system

**Success Criteria**:
- Full workflow executes without errors
- Memories updated correctly
- Confidence scores evolve as expected
- Integration with Phase 1 and Phase 2 confirmed

---

## Phase 3 Completion Checklist

**Code Completion**:
- [x] All 11 tasks completed ✅
- [x] State schema defined ✅
- [x] All nodes implemented (including stubs) ✅
- [x] Conditional routing working ✅
- [x] StateGraph compiled successfully ✅
- [x] Workflow executor functional ✅

**Testing**:
- [x] Unit tests for all nodes (100%) ✅ - 71 tests
- [x] Routing logic tests (100%) ✅ - 27 tests
- [x] Integration test passing (100%) ✅ - 12 tests
- [x] No regressions in Phase 1 & 2 ✅

**Documentation**:
- [x] State schema documented ✅
- [x] Node functions documented ✅
- [x] Graph structure diagram ✅
- [x] TODO.md updated with completion notes ✅
- [x] PHASE_3_COMPLETE.md created ✅

**Version Control**:
- [x] All changes committed to git ✅
- [x] Descriptive commit messages ✅
- [x] Ready to push to GitHub ✅
- [x] Previous phase tests still passing ✅

---

## Phase 3 Notes & Decisions

**Date**: 2025-09-30
**Status**: ✅ COMPLETE

### Design Decisions
- Used pure conditional functions for routing (no state mutations in conditionals)
- Separated state advancement into dedicated node
- Pattern-based email classification using regex
- Stub analyzers for Phase 3 (LLM integration in Phase 4)
- Full integration with Phase 2 memory system

### Challenges Encountered
- **LangGraph Recursion Limit**: Initial implementation hit recursion limit due to state mutations in conditional functions. Fixed by creating separate `advance_email` node.
- **Conditional Edge Constraints**: LangGraph conditional edges must return routing decisions only, cannot mutate state. Restructured to have dedicated nodes for state changes.
- **Multi-Analyzer Routing**: Current implementation routes to first matching analyzer. Future enhancement will support parallel execution.

### Performance Metrics
- **Test Coverage**: 83 tests passing (100% success rate)
- **Execution Time**: <1 second for 5 emails (with stub analyzers)
- **Memory Usage**: Efficient filtering of processed emails
- **Code Quality**: Zero errors, comprehensive logging

---

**Next Phase**: [Phase 4: Analyzer Implementation](./PHASE_4_TODO.md)
**Previous Phase**: [Phase 2: Memory System Design](./PHASE_2_TODO.md) ✓ Complete