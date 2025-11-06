# AGENT CONVERSION - COMPREHENSIVE TESTING PLAN

**Project:** IAB Taxonomy Classification - Agent Testing Strategy
**Version:** 1.0
**Last Updated:** 2025-10-07
**Status:** Active

---

## TABLE OF CONTENTS

1. [Testing Philosophy](#testing-philosophy)
2. [GitHub Integration](#github-integration)
3. [Test Structure by Phase](#test-structure-by-phase)
4. [Automated Testing (CI/CD)](#automated-testing-cicd)
5. [Manual Testing Procedures](#manual-testing-procedures)
6. [Acceptance Criteria](#acceptance-criteria)
7. [Test Data Management](#test-data-management)
8. [Progress Tracking](#progress-tracking)

---

## TESTING PHILOSOPHY

### Core Principles

1. **Test First:** Write tests before implementation (TDD)
2. **Test Often:** Run tests after every change
3. **Test Thoroughly:** Unit → Integration → E2E pyramid
4. **Document Everything:** Test failures, edge cases, learnings
5. **No Regressions:** Existing tests must always pass
6. **Track Progress:** GitHub issues, commits, PRs

### Test Pyramid

```
                    E2E (1-5 tests)
                   /               \
                  /   Integration   \
                 /    (20-30 tests)  \
                /                     \
               /        Unit          \
              /      (50-60 tests)     \
             /___________________________\
```

**Target Coverage:**
- Unit Tests: 90%+ of agents/tools code
- Integration Tests: All agent workflows
- E2E Tests: Full production scenario (200 emails)

---

## GITHUB INTEGRATION

### Branch Strategy

```
main (production - protected)
  ↓
feature/agent-conversion (integration branch)
  ↓
  ├─ feat/phase1-tools
  ├─ feat/phase2-demographics
  ├─ feat/phase3-household
  ├─ feat/phase3-interests
  ├─ feat/phase3-purchase
  ├─ feat/phase4-batch
  ├─ feat/phase5-frontend
  └─ feat/phase6-integration
```

### Commit Message Convention

**Format:**
```
<type>(<scope>): <subject>

<detailed description>

Tests: X/X passing
Coverage: XX%
Phase: N/6 - <phase name> <status>

Files:
- src/email_parser/xxx.py (modified)
- tests/unit/test_xxx.py (added)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `test`: Add/update tests
- `refactor`: Code restructuring
- `docs`: Documentation updates
- `chore`: Maintenance tasks

**Example:**
```
feat(agents): Add demographics taxonomy search tool

Implements search_demographics_taxonomy tool that wraps IABTaxonomyLoader
to provide on-demand taxonomy searching for agent use.

- Returns top 10 matches as JSON string
- Searches across tier_2, tier_3, tier_4 values
- Case-insensitive matching
- Includes grouping_tier metadata

Tests: 4/4 passing
Coverage: 95%
Phase: 1/6 - Agent Tools Foundation ⏳

Files:
- src/email_parser/agents/tools.py (added)
- tests/unit/test_agent_tools.py (added)
```

### GitHub Issues - Per Phase

**Issue Template:**
```markdown
## Phase X: [Phase Name]

### Objective
[What this phase accomplishes]

### Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Testing Checklist
- [ ] Unit tests: X/X passing
- [ ] Integration tests: X/X passing
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] PR approved and merged

### Acceptance Criteria
- [ ] All tests pass
- [ ] Coverage > 85%
- [ ] No regressions
- [ ] Code review approved

### Branch
`feat/phaseX-name`

### Estimated Time
X-X hours

### Dependencies
[Links to prerequisite issues]

### Related PRs
[Links to PRs]
```

### Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Phase: [X/6 - Phase Name]

### Summary
[Brief description of changes]

### Changes Made
- [ ] File 1 modified
- [ ] File 2 added
- [ ] File 3 refactored

### Testing

#### Unit Tests
```bash
pytest tests/unit/test_xxx.py -v
```
**Result:** X/X passing ✅

#### Integration Tests
```bash
pytest tests/integration/test_xxx.py -v
```
**Result:** X/X passing ✅

#### Coverage
```bash
pytest --cov=src/email_parser/agents --cov-report=term
```
**Result:** XX% coverage ✅

### Manual Testing
[Link to manual test output / screenshots]

### Before/After Metrics
**Before:**
- Cost: $X.XX per email
- Accuracy: XX%
- Speed: X minutes

**After:**
- Cost: $X.XX per email
- Accuracy: XX%
- Speed: X minutes

### Breaking Changes
☐ None
☐ [Describe breaking changes]

### Regression Check
- [ ] Ran existing unit tests (all passing)
- [ ] Ran existing integration tests (all passing)
- [ ] Verified memory reconciliation still works
- [ ] Verified frontend still functions

### Documentation
- [ ] Updated AGENT_CONVERSION_MASTER_PLAN.md
- [ ] Updated AGENT_TESTING_PLAN.md (this doc)
- [ ] Added/updated docstrings
- [ ] Updated README if needed

### Review Checklist
- [ ] Code follows existing patterns
- [ ] No hardcoded values
- [ ] Error handling present
- [ ] Logging appropriate
- [ ] Tests comprehensive

### Next Steps
[Link to next phase issue]

---

**Reviewer:** Please verify:
1. All tests pass locally
2. Coverage meets threshold
3. No regressions introduced
4. Documentation is clear
```

### GitHub Project Board Setup

**Columns:**
1. **📋 Backlog** - All phases queued
2. **🏗️ In Progress** - Current phase being worked on
3. **🧪 Testing** - Tests running, awaiting results
4. **👀 Review** - PR open, awaiting review
5. **✅ Done** - Merged and verified

**Automation Rules:**
- Issue opened → Backlog
- Branch created → In Progress
- PR opened → Review
- PR merged → Done
- Tests fail → back to In Progress

---

## TEST STRUCTURE BY PHASE

### PHASE 1: Agent Tools Foundation

#### Unit Tests (12 tests)

**File:** `tests/unit/test_agent_tools.py`

```python
import pytest
import json
from src.email_parser.agents.tools import (
    search_demographics_taxonomy,
    search_household_taxonomy,
    search_interests_taxonomy,
    search_purchase_taxonomy,
    validate_classification,
    get_tier_details
)

class TestDemographicsSearch:
    """Test demographics taxonomy search tool."""

    def test_search_age_keyword(self):
        """Should find age range entries (IDs 11-24)."""
        result = search_demographics_taxonomy("age")
        data = json.loads(result)

        assert len(data) > 0
        assert all(11 <= item["taxonomy_id"] <= 24 for item in data)

    def test_search_gender_keyword(self):
        """Should find gender entries including Male (ID 50)."""
        result = search_demographics_taxonomy("male")
        data = json.loads(result)

        assert len(data) > 0
        assert any(item["value"] == "Male" for item in data)
        assert any(item["taxonomy_id"] == 50 for item in data)

    def test_search_returns_max_10(self):
        """Should limit results to 10 entries."""
        result = search_demographics_taxonomy("e")  # Common letter
        data = json.loads(result)

        assert len(data) <= 10

    def test_search_case_insensitive(self):
        """Should match regardless of case."""
        result1 = search_demographics_taxonomy("MALE")
        result2 = search_demographics_taxonomy("male")

        assert result1 == result2

class TestValidationTool:
    """Test classification validation tool."""

    def test_validate_correct_pair(self):
        """Should pass for correct taxonomy_id/value pair."""
        result = validate_classification(50, "Male")
        data = json.loads(result)

        assert data["valid"] == True
        assert data["taxonomy_id"] == 50
        assert data["expected_value"] == "Male"

    def test_validate_wrong_value(self):
        """Should fail and return correct value."""
        result = validate_classification(50, "Female")
        data = json.loads(result)

        assert data["valid"] == False
        assert data["expected_value"] == "Male"
        assert data["provided_value"] == "Female"

    def test_validate_nonexistent_id(self):
        """Should fail for non-existent taxonomy ID."""
        result = validate_classification(99999, "NonExistent")
        data = json.loads(result)

        assert data["valid"] == False
        assert "not found" in data["reason"]

class TestOtherSearchTools:
    """Test household, interests, purchase search tools."""

    def test_search_household_income(self):
        """Should find household income entries."""
        result = search_household_taxonomy("income")
        data = json.loads(result)

        assert len(data) > 0
        # Income entries are in household section

    def test_search_interests_crypto(self):
        """Should find cryptocurrency interest (ID 342)."""
        result = search_interests_taxonomy("cryptocurrency")
        data = json.loads(result)

        assert len(data) > 0
        assert any(item["taxonomy_id"] == 342 for item in data)

    def test_search_purchase_electronics(self):
        """Should find electronics product categories."""
        result = search_purchase_taxonomy("electronics")
        data = json.loads(result)

        assert len(data) > 0

class TestTierDetails:
    """Test get_tier_details tool."""

    def test_get_demographics_details(self):
        """Should return full entry for demographics ID."""
        result = get_tier_details(50)  # Male
        data = json.loads(result)

        assert data["taxonomy_id"] == 50
        assert data["tier_1"] == "Demographic"
        assert data["tier_2"] == "Gender"
        assert data["tier_3"] == "Male"

    def test_get_interests_details(self):
        """Should return nested tiers for interests."""
        result = get_tier_details(342)  # Cryptocurrency
        data = json.loads(result)

        assert data["taxonomy_id"] == 342
        assert data["tier_1"] == "Interest"
        # Check nested structure exists

class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_search_empty_keyword(self):
        """Should handle empty keyword gracefully."""
        result = search_demographics_taxonomy("")
        data = json.loads(result)

        assert isinstance(data, list)
        # Should either return all or empty

    def test_search_no_matches(self):
        """Should return empty array for no matches."""
        result = search_demographics_taxonomy("xyzabc123")
        data = json.loads(result)

        assert data == []
```

**Run Command:**
```bash
pytest tests/unit/test_agent_tools.py -v --cov=src/email_parser/agents/tools
```

**Expected Output:**
```
tests/unit/test_agent_tools.py::TestDemographicsSearch::test_search_age_keyword PASSED
tests/unit/test_agent_tools.py::TestDemographicsSearch::test_search_gender_keyword PASSED
...
tests/unit/test_agent_tools.py::TestEdgeCases::test_search_no_matches PASSED

==================== 12 passed in 1.23s ====================
Coverage: 95%
```

#### Integration Tests (5 tests)

**File:** `tests/integration/test_tool_chains.py`

```python
import pytest
import json
from src.email_parser.agents.tools import (
    search_demographics_taxonomy,
    validate_classification,
    get_tier_details
)

class TestToolChains:
    """Test tool usage patterns as agents would use them."""

    def test_search_then_validate_success(self):
        """Tool chain: search → pick match → validate → success."""
        # Step 1: Search
        search_result = search_demographics_taxonomy("age 30")
        matches = json.loads(search_result)
        assert len(matches) > 0

        # Step 2: Pick first match
        first_match = matches[0]

        # Step 3: Validate
        validation = validate_classification(
            first_match["taxonomy_id"],
            first_match["value"]
        )
        validation_data = json.loads(validation)

        assert validation_data["valid"] == True

    def test_search_then_validate_failure(self):
        """Tool chain: search → pick wrong value → validate → fail."""
        # Search for gender entries
        search_result = search_demographics_taxonomy("gender")
        matches = json.loads(search_result)

        male_entry = next(m for m in matches if m["value"] == "Male")

        # Try to validate with wrong value
        validation = validate_classification(
            male_entry["taxonomy_id"],
            "Female"  # Wrong value!
        )
        validation_data = json.loads(validation)

        assert validation_data["valid"] == False
        assert validation_data["expected_value"] == "Male"

    def test_search_get_details_validate(self):
        """Full tool chain: search → get details → validate."""
        # Search
        search_result = search_demographics_taxonomy("bachelor")
        matches = json.loads(search_result)

        # Get details for first match
        details = get_tier_details(matches[0]["taxonomy_id"])
        details_data = json.loads(details)

        # Validate with details
        validation = validate_classification(
            details_data["taxonomy_id"],
            details_data["value"]
        )
        validation_data = json.loads(validation)

        assert validation_data["valid"] == True

    def test_reflection_scenario(self):
        """Simulate agent reflection: search → validate fail → search again."""
        # First attempt: wrong search
        result1 = search_demographics_taxonomy("tech")
        matches1 = json.loads(result1)

        # Pick wrong entry for age classification
        if len(matches1) > 0:
            validation1 = validate_classification(
                matches1[0]["taxonomy_id"],
                "30-34"  # Trying to use as age
            )
            validation_data1 = json.loads(validation1)

            if not validation_data1["valid"]:
                # Reflection: search again with better keyword
                result2 = search_demographics_taxonomy("age 30")
                matches2 = json.loads(result2)

                # Find correct entry
                age_30_entry = next(
                    m for m in matches2
                    if "30" in m["value"]
                )

                # Validate with correct value
                validation2 = validate_classification(
                    age_30_entry["taxonomy_id"],
                    age_30_entry["value"]
                )
                validation_data2 = json.loads(validation2)

                assert validation_data2["valid"] == True

    def test_tool_performance(self):
        """Tools should return in < 100ms."""
        import time

        start = time.time()
        search_demographics_taxonomy("age")
        duration = time.time() - start

        assert duration < 0.1  # 100ms
```

**Run Command:**
```bash
pytest tests/integration/test_tool_chains.py -v
```

**GitHub Commit After Phase 1:**
```
feat(agents): Complete agent tools foundation

Implemented 6 taxonomy search and validation tools for agent use:
- search_demographics_taxonomy
- search_household_taxonomy
- search_interests_taxonomy
- search_purchase_taxonomy
- validate_classification
- get_tier_details

All tools return JSON strings for LangChain agent compatibility.
Tools wrap existing IABTaxonomyLoader and validation logic.

Tests: 17/17 passing (12 unit + 5 integration)
Coverage: 95% (src/email_parser/agents/tools.py)
Phase: 1/6 - Agent Tools Foundation ✅

Files Added:
- src/email_parser/agents/__init__.py
- src/email_parser/agents/tools.py
- tests/unit/test_agent_tools.py
- tests/integration/test_tool_chains.py

Next: Phase 2 - Demographics Agent
```

---

### PHASE 2: Demographics Agent

#### Unit Tests (5 tests)

**File:** `tests/unit/test_demographics_agent.py`

```python
import pytest
from src.email_parser.agents.demographics_agent import (
    create_demographics_agent,
    DEMOGRAPHICS_SYSTEM_PROMPT
)

class TestAgentCreation:
    """Test demographics agent initialization."""

    def test_agent_has_tools(self):
        """Agent should have 3 tools bound."""
        agent = create_demographics_agent(llm_provider="openai")

        # Check tools are present
        assert len(agent.tools) == 3
        tool_names = [t.name for t in agent.tools]
        assert "search_demographics_taxonomy" in tool_names
        assert "validate_classification" in tool_names
        assert "get_tier_details" in tool_names

    def test_system_prompt_contains_guidelines(self):
        """System prompt should include evidence guidelines."""
        assert "age" in DEMOGRAPHICS_SYSTEM_PROMPT.lower()
        assert "gender" in DEMOGRAPHICS_SYSTEM_PROMPT.lower()
        assert "validate" in DEMOGRAPHICS_SYSTEM_PROMPT.lower()
        assert "tools" in DEMOGRAPHICS_SYSTEM_PROMPT.lower()

    def test_agent_max_iterations_set(self):
        """Agent should have max_iterations configured."""
        agent = create_demographics_agent()

        # Check max iterations is set to 5
        assert agent.max_iterations == 5

    def test_agent_cost_tracker_integration(self):
        """Agent should accept cost tracker."""
        from src.email_parser.workflow.cost_tracker import CostTracker

        cost_tracker = CostTracker()
        agent = create_demographics_agent(cost_tracker=cost_tracker)

        assert agent.cost_tracker is cost_tracker

    def test_agent_llm_provider_selection(self):
        """Agent should support multiple LLM providers."""
        agent_openai = create_demographics_agent(llm_provider="openai")
        agent_claude = create_demographics_agent(llm_provider="claude")

        assert agent_openai.llm_provider == "openai"
        assert agent_claude.llm_provider == "claude"
```

#### Integration Tests (8 tests)

**File:** `tests/integration/test_demographics_agent.py`

```python
import pytest
from src.email_parser.agents.demographics_agent import create_demographics_agent

class TestAgentWithRealTools:
    """Test agent with real tools (real LLM calls)."""

    @pytest.fixture
    def sample_age_email(self):
        return {
            "id": "test1",
            "subject": "Birthday celebration",
            "body": "I'm turning 30 next week! Can't believe it."
        }

    @pytest.fixture
    def sample_gender_email(self):
        return {
            "id": "test2",
            "subject": "Newsletter",
            "body": "Dear Mr. Smith, welcome to our service."
        }

    def test_agent_classifies_clear_age_signal(self, sample_age_email):
        """Email says 'I'm turning 30' → classify as 25-29 or 30-34."""
        agent = create_demographics_agent(llm_provider="openai")

        result = agent.invoke({
            "emails": [sample_age_email]
        })

        classifications = result["classifications"]
        age_classifications = [
            c for c in classifications
            if c.get("section") == "age_range"
        ]

        assert len(age_classifications) > 0
        age_class = age_classifications[0]
        assert age_class["taxonomy_id"] in [5, 6]  # 25-29 or 30-34
        assert age_class["confidence"] > 0.7

    def test_agent_classifies_gender_from_title(self, sample_gender_email):
        """Email says 'Mr. Smith' → classify as Male."""
        agent = create_demographics_agent()

        result = agent.invoke({
            "emails": [sample_gender_email]
        })

        gender_class = next(
            c for c in result["classifications"]
            if "gender" in c.get("section", "").lower()
        )

        assert gender_class["value"] == "Male"
        assert gender_class["taxonomy_id"] == 50

    def test_agent_rejects_invalid_evidence(self):
        """Should NOT classify age from weak signals."""
        email = {
            "id": "test3",
            "subject": "Tech newsletter",
            "body": "Latest smartphone reviews for professionals."
        }

        agent = create_demographics_agent()
        result = agent.invoke({"emails": [email]})

        # Should NOT classify age based on "professionals"
        age_classifications = [
            c for c in result["classifications"]
            if "age" in c.get("section", "")
        ]

        assert len(age_classifications) == 0

    def test_agent_reflection_on_validation_failure(self):
        """Agent should retry when validation fails."""
        # Mock scenario: Force validation failure
        # (In practice, agent would self-correct)

        email = {
            "id": "test4",
            "subject": "Account update",
            "body": "Update your profile, Mr. Johnson."
        }

        agent = create_demographics_agent()
        result = agent.invoke({
            "emails": [email],
            "return_intermediate_steps": True
        })

        steps = result.get("intermediate_steps", [])

        # Check that validation was called
        validation_steps = [
            s for s in steps
            if "validate" in s.get("action", "").lower()
        ]

        assert len(validation_steps) > 0

        # Check iterations > 1 if reflection occurred
        # (May be 1 if agent got it right first time)
        assert result.get("iterations", 1) <= 5

    def test_agent_batch_processing(self):
        """Agent should handle multiple emails in one call."""
        emails = [
            {"id": "e1", "subject": "Birthday", "body": "I'm 25 years old"},
            {"id": "e2", "subject": "Work", "body": "Ms. Davis here"},
            {"id": "e3", "subject": "Education", "body": "I have a PhD"},
        ]

        agent = create_demographics_agent()
        result = agent.invoke({"emails": emails})

        # Should have classifications from multiple emails
        assert len(result["classifications"]) > 0

    def test_agent_cost_tracking(self):
        """Agent should track LLM costs."""
        from src.email_parser.workflow.cost_tracker import CostTracker

        cost_tracker = CostTracker()
        agent = create_demographics_agent(cost_tracker=cost_tracker)

        result = agent.invoke({
            "emails": [{"id": "t1", "subject": "Test", "body": "I'm 30"}]
        })

        total_cost = cost_tracker.get_total_cost()
        assert total_cost > 0
        assert total_cost < 0.10  # Reasonable limit per email

    def test_agent_returns_valid_schema(self):
        """Agent output should match expected schema."""
        agent = create_demographics_agent()

        result = agent.invoke({
            "emails": [{"id": "t1", "subject": "Test", "body": "Mr. Smith"}]
        })

        # Check schema
        assert "classifications" in result
        for c in result["classifications"]:
            assert "taxonomy_id" in c
            assert "value" in c
            assert "confidence" in c
            assert "reasoning" in c
            assert "section" in c

    def test_agent_performance(self):
        """Agent should process 5 emails in reasonable time."""
        import time

        emails = [{"id": f"e{i}", "subject": "Test", "body": "I'm 30"}
                  for i in range(5)]

        agent = create_demographics_agent()

        start = time.time()
        result = agent.invoke({"emails": emails})
        duration = time.time() - start

        assert duration < 30  # < 30 seconds for 5 emails
```

**Run Commands:**
```bash
# Unit tests
pytest tests/unit/test_demographics_agent.py -v

# Integration tests (uses real LLM - requires API key)
pytest tests/integration/test_demographics_agent.py -v
```

#### Node Integration Tests (5 tests)

**File:** `tests/integration/test_demographics_analyzer_node.py`

```python
import pytest
from src.email_parser.workflow.nodes.analyzers import demographics_analyzer_node
from src.email_parser.workflow.state import WorkflowState

class TestNodeWithAgent:
    """Test modified analyzer node uses agent correctly."""

    def test_node_invokes_agent(self):
        """Node should call agent and return classifications."""
        state = {
            "emails": [
                {"id": "t1", "subject": "Test", "body": "I'm turning 30"}
            ],
            "current_email_index": 0,
            "demographics_results": [],
            "llm_provider": "openai"
        }

        result_state = demographics_analyzer_node(state)

        # Should have demographics results
        assert len(result_state["demographics_results"]) > 0

    def test_node_stores_agent_trace(self):
        """Node should store agent execution trace."""
        from src.email_parser.workflow.tracker import WorkflowTracker

        tracker = WorkflowTracker()

        state = {
            "emails": [{"id": "t1", "subject": "Test", "body": "Mr. Smith"}],
            "current_email_index": 0,
            "demographics_results": [],
            "tracker": tracker
        }

        result_state = demographics_analyzer_node(state)

        # Check trace was stored
        assert tracker.has_trace("demographics")

    def test_node_preserves_existing_results(self):
        """Node should append to existing results, not replace."""
        state = {
            "emails": [{"id": "t1", "subject": "Test", "body": "I'm 30"}],
            "current_email_index": 0,
            "demographics_results": [
                {"taxonomy_id": 999, "value": "Existing"}
            ]
        }

        result_state = demographics_analyzer_node(state)

        # Should have both existing and new
        assert len(result_state["demographics_results"]) > 1

    def test_node_handles_empty_email(self):
        """Node should handle emails with no demographic signals."""
        state = {
            "emails": [{"id": "t1", "subject": "Sale", "body": "20% off!"}],
            "current_email_index": 0,
            "demographics_results": []
        }

        result_state = demographics_analyzer_node(state)

        # Should not error, may return empty results
        assert "demographics_results" in result_state

    def test_node_backward_compatible_with_memory(self):
        """Node output should work with existing memory reconciliation."""
        from src.email_parser.memory.reconciliation import reconcile_classifications

        state = {
            "emails": [{"id": "t1", "subject": "Test", "body": "Mr. Smith"}],
            "current_email_index": 0,
            "demographics_results": []
        }

        result_state = demographics_analyzer_node(state)

        # Try reconciliation (should not error)
        reconciled = reconcile_classifications(
            existing=[],
            new=result_state["demographics_results"],
            section="demographics"
        )

        assert isinstance(reconciled, list)
```

**GitHub Commit After Phase 2:**
```
feat(agents): Implement demographics ReAct agent

Created demographics agent with tool use and reflection capabilities:
- Searches demographics taxonomy on-demand (vs full context in prompt)
- Validates classifications before returning
- Retries on validation failure (max 5 iterations)
- Integrates with existing cost tracking and memory systems

Modified demographics_analyzer_node to use agent:
- Replaces single-pass LLM call with agent invocation
- Stores agent execution trace for frontend display
- Preserves backward compatibility with memory reconciliation

Tests: 18/18 passing (5 unit + 8 integration + 5 node)
Coverage: 92% (demographics_agent.py)
Manual test: Verified with 5 sample emails

Cost comparison (5 emails):
- Before: $0.12 (large taxonomy context per email)
- After: $0.02 (tool-based on-demand lookup)

Accuracy comparison (manual eval):
- Before: ~60% (wrong taxonomy IDs selected)
- After: ~95% (agent self-corrects via validation)

Phase: 2/6 - Demographics Agent ✅

Files Modified:
- src/email_parser/workflow/nodes/analyzers.py (lines 150-251)

Files Added:
- src/email_parser/agents/demographics_agent.py
- tests/unit/test_demographics_agent.py
- tests/integration/test_demographics_agent.py
- tests/integration/test_demographics_analyzer_node.py

Next: Phase 3 - Household, Interests, Purchase Agents
```

---

### PHASE 3.5: Evidence Quality Validation

#### Overview

Evidence validation prevents inappropriate inferences using LLM-as-Judge pattern.

**Scope:**
- All 4 agents (demographics, household, interests, purchase)
- Validates reasoning quality (blocks age from products, gender from interests)
- Adjusts confidence based on evidence type (explicit, contextual, weak, inappropriate)

#### Integration Tests (12 tests)

**File:** `tests/integration/test_evidence_validation.py` (NEW)

```python
import pytest
from src.email_parser.agents.demographics_agent import extract_demographics_with_agent
from src.email_parser.agents.household_agent import extract_household_with_agent
from src.email_parser.agents.interests_agent import extract_interests_with_agent
from src.email_parser.workflow.llm_wrapper import AnalyzerLLMClient

class TestEvidenceJudge:
    """Test LLM-as-Judge evidence quality validation."""

    @pytest.fixture
    def llm_client(self):
        return AnalyzerLLMClient(provider="openai", model="gpt-4o-mini")

    def test_blocks_age_from_products(self, llm_client):
        """Should block age classification from product purchases."""
        email = {
            "subject": "Order confirmation",
            "body": "Your iPhone 15 has shipped. Tracking: XYZ123"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should NOT have age classification based on product
        age_classes = [c for c in result["classifications"]
                      if "age" in c.get("value", "").lower() or
                         c.get("taxonomy_id") in range(2, 11)]
        assert len(age_classes) == 0, "Age should not be inferred from product purchases"

    def test_blocks_gender_from_marital_status(self, llm_client):
        """Should block gender classification from marital status mentions."""
        email = {
            "subject": "Wedding invitation",
            "body": "Congratulations on getting married! We're so happy for you."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should NOT have gender classification based on marriage
        gender_classes = [c for c in result["classifications"]
                         if c.get("taxonomy_id") in [49, 50]]
        assert len(gender_classes) == 0, "Gender should not be inferred from marital status"

    def test_blocks_education_from_job_title(self, llm_client):
        """Should NOT infer education from job title alone."""
        email = {
            "subject": "Career update",
            "body": "Excited to start my new role as Senior Software Engineer!"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should NOT have education classification based on job title
        edu_classes = [c for c in result["classifications"]
                      if c.get("taxonomy_id") in range(18, 39)]
        assert len(edu_classes) == 0, "Education should not be inferred from job title alone"

    def test_blocks_job_related_interests(self, llm_client):
        """Should block interests from job-related emails."""
        email = {
            "subject": "Work newsletter",
            "body": "Required reading for all engineers: New technology stack overview."
        }

        result = extract_interests_with_agent([email], llm_client)

        # Should NOT classify as personal interest (it's required reading)
        # This is a judgment call - evidence judge should detect job context
        tech_interests = [c for c in result["classifications"]
                         if "technology" in c.get("value", "").lower()]

        # If classified, confidence should be very low due to job context
        if len(tech_interests) > 0:
            assert tech_interests[0]["confidence"] < 0.5

    def test_allows_explicit_age_mention(self, llm_client):
        """Should allow age classification from explicit mention."""
        email = {
            "subject": "Birthday",
            "body": "Can't believe I'm turning 32 tomorrow!"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have age classification
        age_classes = [c for c in result["classifications"]
                      if "30" in c.get("value", "") or "32" in c.get("value", "")]
        assert len(age_classes) > 0, "Explicit age mention should be classified"
        assert age_classes[0]["confidence"] >= 0.8, "Explicit evidence should have high confidence"

    def test_allows_gender_from_title(self, llm_client):
        """Should allow gender classification from Mr./Ms. title."""
        email = {
            "subject": "Account notification",
            "body": "Dear Mr. Johnson, your account has been updated."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have Male classification
        gender_classes = [c for c in result["classifications"]
                         if c.get("value") == "Male"]
        assert len(gender_classes) > 0, "Gender from title should be classified"
        assert gender_classes[0]["confidence"] >= 0.85, "Title is strong evidence"

    def test_allows_education_from_degree_mention(self, llm_client):
        """Should allow education classification from degree mention."""
        email = {
            "subject": "Alumni newsletter",
            "body": "As a holder of a Bachelor's degree in Computer Science..."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have education classification
        edu_classes = [c for c in result["classifications"]
                      if "bachelor" in c.get("value", "").lower() or
                         "undergraduate" in c.get("value", "").lower()]
        assert len(edu_classes) > 0, "Explicit degree mention should be classified"
        assert edu_classes[0]["confidence"] >= 0.8

    def test_adjusts_contextual_evidence_confidence(self, llm_client):
        """Should reduce confidence for contextual (indirect) evidence."""
        email = {
            "subject": "Apartment notice",
            "body": "Building maintenance scheduled for all units in the complex."
        }

        result = extract_household_with_agent([email], llm_client)

        # Might classify as "Apartment" but confidence should be moderate
        apartment_classes = [c for c in result["classifications"]
                            if "apartment" in c.get("value", "").lower()]

        if len(apartment_classes) > 0:
            # Contextual evidence should have reduced confidence (not > 0.7)
            assert apartment_classes[0]["confidence"] < 0.75, \
                "Contextual evidence should have reduced confidence"

    def test_evidence_judge_handles_errors_gracefully(self, llm_client):
        """Evidence judge should not crash workflow on errors."""
        email = {
            "subject": "Test",
            "body": "This is a test email with minimal content."
        }

        # Should complete without errors even if judge has issues
        result = extract_demographics_with_agent([email], llm_client)
        assert "classifications" in result, "Workflow should complete even if judge fails"

    def test_blocking_preserves_taxonomy_validation(self, llm_client):
        """Evidence validation should run AFTER taxonomy validation."""
        # Both validation layers should work together:
        # 1. Taxonomy validation blocks wrong IDs
        # 2. Evidence validation blocks inappropriate reasoning

        email = {
            "subject": "Newsletter",
            "body": "Tech news for professionals."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # All returned classifications should have valid taxonomy IDs
        for c in result["classifications"]:
            assert c.get("taxonomy_id") is not None
            assert isinstance(c.get("taxonomy_id"), int)
            assert c.get("value") is not None

    def test_multiple_classifications_validated_independently(self, llm_client):
        """Each classification should be validated separately."""
        email = {
            "subject": "Profile",
            "body": "I'm 35 years old. Dear Mr. Smith, welcome!"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have both age and gender (both valid evidence)
        age_classes = [c for c in result["classifications"]
                      if "30" in c.get("value", "") or "35" in c.get("value", "")]
        gender_classes = [c for c in result["classifications"]
                         if c.get("value") == "Male"]

        # Both should pass validation independently
        assert len(age_classes) > 0, "Valid age should be classified"
        assert len(gender_classes) > 0, "Valid gender should be classified"

    def test_evidence_validation_cost_reasonable(self, llm_client):
        """Evidence validation should not significantly increase cost."""
        from src.email_parser.workflow.cost_tracker import CostTracker

        cost_tracker = CostTracker()
        llm_client_with_tracker = AnalyzerLLMClient(
            provider="openai",
            model="gpt-4o-mini",
            cost_tracker=cost_tracker
        )

        email = {
            "subject": "Test",
            "body": "I'm turning 30. Dear Mr. Smith."
        }

        result = extract_demographics_with_agent([email], llm_client_with_tracker)

        total_cost = cost_tracker.get_total_cost()

        # Evidence validation adds judge calls but should be < $0.01 per email
        assert total_cost < 0.01, "Evidence validation cost should be minimal"
```

**Run Commands:**
```bash
# Evidence validation tests (uses OpenAI gpt-4o-mini)
export LLM_PROVIDER=openai
pytest tests/integration/test_evidence_validation.py -v

# Specific test
pytest tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_blocks_age_from_products -v
```

**Expected Output:**
```
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_blocks_age_from_products PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_blocks_gender_from_marital_status PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_blocks_education_from_job_title PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_blocks_job_related_interests PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_allows_explicit_age_mention PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_allows_gender_from_title PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_allows_education_from_degree_mention PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_adjusts_contextual_evidence_confidence PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_evidence_judge_handles_errors_gracefully PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_blocking_preserves_taxonomy_validation PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_multiple_classifications_validated_independently PASSED
tests/integration/test_evidence_validation.py::TestEvidenceJudge::test_evidence_validation_cost_reasonable PASSED

==================== 12 passed in 45.2s ====================
```

#### Manual Test Script

**File:** `tests/manual/test_evidence_validation_manual.py`

```python
"""
Manual verification of evidence validation.
Shows which classifications are blocked and why.
"""

from src.email_parser.agents.demographics_agent import extract_demographics_with_agent
from src.email_parser.workflow.llm_wrapper import AnalyzerLLMClient

def test_inappropriate_inferences():
    """Test that inappropriate inferences are blocked."""

    llm_client = AnalyzerLLMClient(provider="openai", model="gpt-4o-mini")

    test_cases = [
        {
            "name": "Age from product",
            "email": {
                "subject": "Order shipped",
                "body": "Your gaming console has been shipped."
            },
            "should_block": "age"
        },
        {
            "name": "Gender from marital status",
            "email": {
                "subject": "Congrats",
                "body": "Heard you got married! Congratulations!"
            },
            "should_block": "gender"
        },
        {
            "name": "Education from job",
            "email": {
                "subject": "Career",
                "body": "New role as Chief Technology Officer."
            },
            "should_block": "education"
        }
    ]

    print("\n" + "="*60)
    print("EVIDENCE VALIDATION - BLOCKING TEST")
    print("="*60 + "\n")

    for test in test_cases:
        result = extract_demographics_with_agent([test["email"]], llm_client)

        print(f"Test: {test['name']}")
        print(f"Email: {test['email']['body']}")
        print(f"Expected: Block {test['should_block']} classifications")
        print(f"Results: {len(result['classifications'])} classifications")

        for c in result['classifications']:
            print(f"  - {c['value']} (conf={c['confidence']:.2f})")

        print()

if __name__ == "__main__":
    test_inappropriate_inferences()
```

#### GitHub Commit After Phase 3.5

```
feat(agents): Add evidence quality validation with LLM-as-Judge

Implemented comprehensive evidence validation to prevent inappropriate
inferences and adjust confidence based on evidence quality.

Features:
- LLM-as-Judge evaluates reasoning against section-specific guidelines
- Blocks inappropriate inferences (age from products, gender from interests)
- Adjusts confidence based on evidence type (explicit/contextual/weak)
- Integrated into all 4 agents and analyzer nodes
- No schema changes - backwards compatible

Test Results:
- 12/12 integration tests passing
- Blocked inferences: age from products, gender from marital status
- Valid inferences: age from "I'm 32", gender from "Mr./Ms."
- Cost impact: <15% increase (~$0.001-0.005 per email)

Phase: 3.5/6 - Evidence Quality Validation ✅

Files Modified:
- src/email_parser/workflow/nodes/evidence_judge.py (NEW)
- src/email_parser/workflow/prompts/__init__.py (extracted guidelines)
- src/email_parser/workflow/llm_wrapper.py (added call_json method)
- src/email_parser/agents/*.py (4 agents integrated)
- src/email_parser/workflow/nodes/analyzers.py (4 nodes integrated)
- src/email_parser/memory/reconciliation.py (bug fix)
- tests/integration/test_evidence_validation.py (NEW)

Next: Phase 4 - Batch Processing (optional)
```

---

## AUTOMATED TESTING (CI/CD)

### GitHub Actions Workflow

Create `.github/workflows/agent-tests.yml`:

```yaml
name: Agent Conversion Tests

on:
  push:
    branches:
      - feature/agent-conversion
      - feat/phase*
  pull_request:
    branches:
      - feature/agent-conversion
      - main

jobs:
  lint:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install flake8 black mypy

      - name: Run linters
        run: |
          black --check src/
          flake8 src/ --max-line-length=100
          mypy src/email_parser/agents/ --ignore-missing-imports

  test-tools:
    name: Test Agent Tools
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run tool unit tests
        run: |
          pytest tests/unit/test_agent_tools.py -v \
            --cov=src/email_parser/agents/tools \
            --cov-report=xml

      - name: Run tool integration tests
        run: |
          pytest tests/integration/test_tool_chains.py -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: tools

  test-agents:
    name: Test Individual Agents
    runs-on: ubuntu-latest
    needs: test-tools
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run agent unit tests
        run: |
          pytest tests/unit/test_*_agent.py -v \
            --cov=src/email_parser/agents/ \
            --cov-report=xml

      - name: Run agent integration tests
        run: |
          pytest tests/integration/test_*_agent.py -v \
            --maxfail=5

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: agents

  regression-tests:
    name: Regression Tests
    runs-on: ubuntu-latest
    needs: test-agents
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest

      - name: Run existing unit tests
        run: |
          pytest tests/unit/test_classification_tier_selector.py -v
          pytest tests/unit/test_profile_tier_formatter.py -v
          pytest tests/unit/test_cost_tracker.py -v

      - name: Run existing integration tests
        run: |
          pytest tests/integration/test_sqlite_persistence.py -v

      - name: Verify no regressions
        run: |
          echo "All existing tests passed - no regressions ✅"

  cost-check:
    name: Cost Benchmarking
    runs-on: ubuntu-latest
    needs: test-agents
    if: github.event_name == 'pull_request'
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Run cost benchmark
        run: |
          python scripts/benchmark_agent_system.py \
            --csv test_data/sample_5_emails.csv \
            --output benchmark_results.json

      - name: Check cost threshold
        run: |
          python scripts/check_cost_threshold.py \
            --results benchmark_results.json \
            --max-cost-per-email 0.10

      - name: Comment PR with results
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('benchmark_results.json'));

            const comment = `## 💰 Cost Benchmark Results

            **Total Cost:** $${results.total_cost.toFixed(4)}
            **Per Email:** $${results.cost_per_email.toFixed(4)}
            **Emails Processed:** ${results.emails_processed}

            ${results.cost_per_email > 0.10 ? '⚠️ Cost exceeds threshold!' : '✅ Cost within threshold'}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Pre-commit Hooks

Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: run-unit-tests
        name: Run Unit Tests
        entry: pytest tests/unit/ -v --tb=short --maxfail=3
        language: system
        pass_filenames: false
        always_run: true

      - id: check-agent-tools
        name: Verify Agent Tools Work
        entry: python scripts/verify_agent_tools.py
        language: system
        pass_filenames: false
        files: src/email_parser/agents/

      - id: black
        name: Format with Black
        entry: black
        language: system
        types: [python]
        files: ^src/

      - id: flake8
        name: Lint with Flake8
        entry: flake8
        language: system
        types: [python]
        files: ^src/
        args: ['--max-line-length=100']
```

**Install:**
```bash
pip install pre-commit
pre-commit install
```

---

## MANUAL TESTING PROCEDURES

### Phase 1: Tool Verification

**Script:** `scripts/verify_agent_tools.py`

```python
"""
Manually verify all agent tools work correctly.
Run this before committing Phase 1.
"""

import json
from src.email_parser.agents.tools import (
    search_demographics_taxonomy,
    search_household_taxonomy,
    search_interests_taxonomy,
    search_purchase_taxonomy,
    validate_classification,
    get_tier_details
)

def test_search_tools():
    """Test all search tools return valid results."""
    print("\n=== Testing Search Tools ===\n")

    # Demographics
    result = search_demographics_taxonomy("age")
    data = json.loads(result)
    print(f"✅ Demographics search: Found {len(data)} age entries")

    # Household
    result = search_household_taxonomy("income")
    data = json.loads(result)
    print(f"✅ Household search: Found {len(data)} income entries")

    # Interests
    result = search_interests_taxonomy("crypto")
    data = json.loads(result)
    print(f"✅ Interests search: Found {len(data)} crypto entries")

    # Purchase
    result = search_purchase_taxonomy("electronics")
    data = json.loads(result)
    print(f"✅ Purchase search: Found {len(data)} electronics entries")

def test_validation_tool():
    """Test validation tool catches mismatches."""
    print("\n=== Testing Validation Tool ===\n")

    # Correct pair
    result = validate_classification(50, "Male")
    data = json.loads(result)
    print(f"✅ Correct pair validation: {data['valid']}")

    # Wrong pair
    result = validate_classification(50, "Female")
    data = json.loads(result)
    print(f"✅ Wrong pair detected: {not data['valid']}")
    print(f"   Expected: {data['expected_value']}")

def test_tier_details_tool():
    """Test tier details tool returns full entry."""
    print("\n=== Testing Tier Details Tool ===\n")

    result = get_tier_details(50)
    data = json.loads(result)
    print(f"✅ Tier details for ID 50:")
    print(f"   Tier 1: {data['tier_1']}")
    print(f"   Tier 2: {data['tier_2']}")
    print(f"   Tier 3: {data['tier_3']}")

if __name__ == "__main__":
    print("\n" + "="*50)
    print("AGENT TOOLS VERIFICATION")
    print("="*50)

    test_search_tools()
    test_validation_tool()
    test_tier_details_tool()

    print("\n" + "="*50)
    print("✅ ALL TOOLS VERIFIED")
    print("="*50 + "\n")
```

**Run:**
```bash
python scripts/verify_agent_tools.py
```

**Expected Output:**
```
==================================================
AGENT TOOLS VERIFICATION
==================================================

=== Testing Search Tools ===

✅ Demographics search: Found 14 age entries
✅ Household search: Found 8 income entries
✅ Interests search: Found 3 crypto entries
✅ Purchase search: Found 12 electronics entries

=== Testing Validation Tool ===

✅ Correct pair validation: True
✅ Wrong pair detected: True
   Expected: Male

=== Testing Tier Details Tool ===

✅ Tier details for ID 50:
   Tier 1: Demographic
   Tier 2: Gender
   Tier 3: Male

==================================================
✅ ALL TOOLS VERIFIED
==================================================
```

### Phase 2: Demographics Agent Manual Test

**Script:** `scripts/test_demographics_agent_manual.py`

```python
"""
Manual test script for demographics agent.
Shows agent reasoning trace in action.
"""

from src.email_parser.agents.demographics_agent import create_demographics_agent

# Test emails
test_emails = [
    {
        "id": "email1",
        "subject": "Birthday party invitation",
        "body": "Hey! I'm turning 30 next Saturday. Would love for you to join us!"
    },
    {
        "id": "email2",
        "subject": "Account update",
        "body": "Dear Mr. Johnson, your account has been updated."
    },
    {
        "id": "email3",
        "subject": "Education newsletter",
        "body": "As a PhD holder, you might be interested in this research opportunity."
    },
]

def display_agent_trace(result):
    """Display agent execution trace in readable format."""
    print("\n" + "="*60)
    print("AGENT REASONING TRACE")
    print("="*60 + "\n")

    steps = result.get("intermediate_steps", [])

    for i, step in enumerate(steps, 1):
        print(f"Step {i}:")
        print(f"  💭 Thought: {step.get('thought', 'N/A')}")
        print(f"  🔧 Action: {step.get('action', 'N/A')}")

        if 'action_input' in step:
            print(f"     Input: {step['action_input']}")

        print(f"  👀 Observation: {step.get('observation', 'N/A')}")

        if step.get('validation_failed'):
            print(f"  ⚠️  Validation Failed - Retrying...")

        print()

def display_classifications(result):
    """Display final classifications."""
    print("\n" + "="*60)
    print("FINAL CLASSIFICATIONS")
    print("="*60 + "\n")

    for c in result["classifications"]:
        print(f"📌 {c['value']}")
        print(f"   ID: {c['taxonomy_id']}")
        print(f"   Confidence: {c['confidence']:.2f}")
        print(f"   Reasoning: {c['reasoning']}")
        print()

def main():
    print("\n🤖 Creating Demographics Agent...\n")

    agent = create_demographics_agent(llm_provider="openai")

    print("📧 Processing 3 test emails...\n")

    result = agent.invoke({
        "emails": test_emails,
        "return_intermediate_steps": True
    })

    display_agent_trace(result)
    display_classifications(result)

    # Summary
    print("="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Iterations: {result.get('iterations', 1)}")
    print(f"Classifications: {len(result['classifications'])}")
    print(f"Cost: ${result.get('cost', 0):.4f}")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
```

**Run:**
```bash
python scripts/test_demographics_agent_manual.py
```

---

## ACCEPTANCE CRITERIA

### Phase-by-Phase Checklist

#### Phase 1: Agent Tools ✅ BEFORE MERGE

- [ ] All 6 tools implemented
- [ ] 12/12 unit tests passing
- [ ] 5/5 integration tests passing
- [ ] Manual verification script runs successfully
- [ ] Code coverage > 90%
- [ ] All tools return JSON strings (not dicts)
- [ ] Tools handle edge cases gracefully
- [ ] Documentation complete (docstrings)
- [ ] PR approved by reviewer
- [ ] No linting errors

#### Phase 2: Demographics Agent ✅ BEFORE MERGE

- [ ] Agent created with ReAct pattern
- [ ] 5/5 unit tests passing
- [ ] 8/8 integration tests passing
- [ ] 5/5 node integration tests passing
- [ ] Manual test shows agent trace
- [ ] Cost < $0.05 for 5 emails
- [ ] Accuracy > 85% on sample
- [ ] No regressions (existing tests pass)
- [ ] Agent handles validation failures gracefully
- [ ] Max iterations never exceeded in tests
- [ ] Code coverage > 85%
- [ ] PR approved

#### Phase 6: Final Acceptance ✅ BEFORE MERGE TO MAIN

- [ ] **All Tests Pass**
  ```bash
  pytest tests/ -v
  # Expected: 100+ tests passing
  ```

- [ ] **Accuracy Validation**
  - 90%+ accuracy on 50-email validation set
  - Manual review of sample shows correct classifications

- [ ] **Cost Benchmark**
  - < $0.05 per email (vs $0.32 before)
  - Total cost for 200 emails < $10

- [ ] **Performance Benchmark**
  - < 5 minutes for 200 emails
  - No timeouts or infinite loops

- [ ] **Regression Check**
  - All existing tests pass
  - Tier selector/formatter still works
  - Memory reconciliation works
  - Frontend displays correctly

- [ ] **Documentation Complete**
  - AGENT_CONVERSION_MASTER_PLAN.md 100% complete
  - All tasks marked ✅
  - Lessons learned documented
  - README.md updated

- [ ] **Code Quality**
  - No linting errors
  - Code coverage > 85%
  - All PRs reviewed and approved

---

## TEST DATA MANAGEMENT

### Test Data Files

Create `test_data/` directory:

```
test_data/
├── sample_5_emails.csv          # Quick smoke test
├── validation_50_emails.csv     # Manual ground truth
├── ground_truth.json            # Expected classifications
├── benchmark_200_emails.csv     # Performance test
└── edge_cases/
    ├── empty_emails.csv
    ├── ambiguous_signals.csv
    └── multilingual.csv
```

### Ground Truth Format

**File:** `test_data/ground_truth.json`

```json
{
  "email_1": {
    "expected_demographics": [
      {"taxonomy_id": 50, "value": "Male", "confidence": 0.9}
    ],
    "expected_interests": [
      {"taxonomy_id": 342, "value": "Cryptocurrency", "confidence": 0.85}
    ]
  },
  "email_2": {
    "expected_demographics": [
      {"taxonomy_id": 6, "value": "30-34", "confidence": 0.8}
    ]
  }
}
```

---

## PROGRESS TRACKING

### Update Master Plan After Each Phase

After completing a phase:

1. **Update Status:** Mark phase as ✅
2. **Add Metrics:** Cost, accuracy, time
3. **Document Learnings:** What worked, what didn't
4. **Update Estimates:** Adjust future phase estimates

**Example Update:**
```markdown
### Phase 2: Demographics Agent ✅ COMPLETE

**Completed:** 2025-10-08
**Time Spent:** 7 hours (estimated 6-8)

**Test Results:**
- Unit: 5/5 ✅
- Integration: 8/8 ✅
- Node Integration: 5/5 ✅
- Manual: ✅

**Metrics:**
- Cost: $0.018 per 5 emails (vs $0.12 before) = 85% reduction
- Accuracy: 96% (manual eval of 25 emails)
- Speed: 8 seconds for 5 emails

**Learnings:**
- Agent often gets classification right on first try (low iteration count)
- Validation tool catches ~5% of cases (worth the overhead)
- Batch processing natural language → multiple classifications works well

**Issues Encountered:**
- None major
- Minor: Had to adjust system prompt wording for clarity

**Next:** Phase 3 - Household/Interests/Purchase agents
```

### GitHub Issue Updates

After each phase completion, update the issue:

```markdown
## Phase 2: Demographics Agent ✅ COMPLETE

### Summary
Successfully converted demographics analyzer to ReAct agent with 96% accuracy.

### Test Evidence
- [Unit tests](link to test file)
- [Integration tests](link to test file)
- [Manual test output](link to output)
- [PR #XX](link to PR)

### Metrics
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Cost/email | < $0.05 | $0.0036 | ✅ |
| Accuracy | > 85% | 96% | ✅ |
| Tests | 18/18 | 18/18 | ✅ |
| Coverage | > 85% | 92% | ✅ |

### Next Steps
Moving to Phase 3: Household Agent
```

---

## CONCLUSION

This testing plan ensures:

1. **Quality:** Comprehensive test coverage at all levels
2. **Visibility:** GitHub integration tracks all progress
3. **Safety:** Regression tests prevent breaking existing functionality
4. **Confidence:** Acceptance criteria must pass before merge
5. **Documentation:** All work is tracked and reviewable

**Remember:** Update this document as we progress. Add learnings, adjust estimates, document issues.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-07
**Status:** Active - Phase 1 Starting
