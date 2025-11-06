# Development Guidelines

**Complete guidelines for developing features in the OwnYou Consumer Application.**

Last Updated: 2025-01-04

---

## Overview

This document provides comprehensive development guidelines covering code organization, testing requirements, privacy constraints, performance requirements, and code quality standards. These guidelines ensure consistent, high-quality code that integrates seamlessly into the system architecture.

**When to read this:** Before starting ANY implementation work.

---

## Before-Coding Checklist

**Complete this checklist EVERY time before implementing a feature:**

### 1. Understand Your Phase

```bash
# Check Strategic Roadmap
cat docs/plans/2025-01-04-ownyou-strategic-roadmap.md

# Questions to answer:
- Which phase am I in? (1-7)
- What is this phase's goal?
- What are the deliverables?
- What are the integration points for the next phase?
```

**Why:** Each phase has specific scope and constraints. Working outside your phase causes rework.

### 2. Check Contracts (Phase 1)

```bash
# Review data models
cat src/mission_agents/models/mission_card.py

# Review Store schema
cat src/mission_agents/memory/store_schema.md

# Review API contracts
cat docs/api/openapi.yaml

# Questions to answer:
- Are the models I need already defined?
- Which Store namespaces will I use?
- Which API endpoints will I call?
- Do I need to update contracts? (RED FLAG - review with team)
```

**Why:** Phase 1 defined all contracts upfront. If contracts are missing, either you're implementing prematurely or contracts need updating (requires full review).

### 3. Use Context7 MCP for Library Documentation (MANDATORY)

**Before writing ANY code that uses external libraries or frameworks:**

```python
# Step 1: Resolve library ID
mcp__context7__resolve-library-id(libraryName="langgraph")
# Returns: "/langchain-ai/langgraph"

# Step 2: Get current documentation
mcp__context7__get-library-docs(
    context7CompatibleLibraryID="/langchain-ai/langgraph",
    topic="store namespaces",  # specific feature you're using
    tokens=5000
)

# Step 3: Read returned docs and follow CURRENT patterns (not memory)
```

**Libraries that REQUIRE context7:**
- **LangGraph** - Store, StateGraph, checkpointers, channels
- **Pydantic** - BaseModel, validators, Field
- **FastAPI** - routing, dependencies, middleware
- **PyTest** - fixtures, markers, parametrize
- **Any external library** - when in doubt, use context7

**Questions to answer:**
- Have I resolved the library ID using context7?
- Have I fetched current docs for the specific feature I'm using?
- Am I using patterns from CURRENT docs (not my training data)?
- If debugging, have I checked for breaking changes in current docs?

**Why:** Libraries change. Using context7 ensures you're using current APIs, avoiding deprecated patterns, and catching breaking changes before they cause bugs.

**Skill:** Use `context7-documentation-lookup` skill for detailed workflow and examples.

### 4. Review Integration Points

```bash
# Check Strategic Roadmap for your phase
# Example for Phase 3 (Agent Layer):

# What depends on my code?
- Phase 4 API Layer will expose my mission agents via REST endpoints
- Phase 5 UI will display my mission cards

# What does my code depend on?
- Phase 2 Data Layer writes to Store (I read from it)
- Phase 1 authentication system (I use it for user identification)

# Questions to answer:
- What am I building ON TOP OF? (previous phases)
- What will be built ON TOP OF ME? (next phases)
- Are my dependencies complete?
- Am I exposing the right interfaces for next phase?
```

**Why:** Understanding dependencies prevents integration issues and ensures clean handoffs between phases.

### 5. Check Architectural Decisions

Review `reference/ARCHITECTURAL_DECISIONS.md` and answer:

- [ ] **Store Usage**: Am I using MissionStore for all memory operations?
- [ ] **IAB Triggers**: If building mission agent, am I triggered by Store updates?
- [ ] **Horizontal Layers**: Am I working within my phase's layer?
- [ ] **Multi-Source**: If touching IAB classification, does it support any data source?
- [ ] **Self-Sovereign Auth**: Am I using wallet-based authentication?
- [ ] **Privacy-First**: Am I redacting PII before external API calls?

**Why:** Violating architectural decisions causes system-wide rework.

### 6. Read Relevant Reference Docs

```bash
# Current system status
cat reference/CURRENT_SYSTEM.md  # What's working now?

# Project structure
cat reference/PROJECT_STRUCTURE.md  # Where does my code go?

# Development guidelines (this doc)
cat reference/DEVELOPMENT_GUIDELINES.md  # Coding standards

# Architectural decisions
cat reference/ARCHITECTURAL_DECISIONS.md  # Critical constraints
```

**Why:** Don't guess, verify. Reference docs provide detailed context for your work.

---

### 7. Check for Legacy/Working Code

**Before implementing a new feature, check if it already exists in email_parser:**

```bash
# Search for similar implementations
grep -r "classification" src/email_parser/
grep -r "batch" src/email_parser/
grep -r "workflow" src/email_parser/

# List email_parser structure
ls -la src/email_parser/
tree src/email_parser/ -L 2

# Check for specific patterns
grep -r "LangGraph" src/email_parser/
grep -r "Store" src/email_parser/workflow/
```

**Questions to answer:**
- Is this already implemented in email_parser?
- Can I reuse the existing IAB classification workflow?
- Should I integrate with existing Store writes?
- Are there production-tested patterns I should follow?
- What integration tests verify backward compatibility?

**Why:** email_parser is working production code with paying users. Don't reinvent wheels, integrate smartly.

---

#### Key Patterns to Reuse

**1. Batch Processing (`src/email_parser/workflow/batch_optimizer.py`)**

The email_parser includes a sophisticated batch optimizer that provides 20-30x performance improvement:

```python
# ✅ CORRECT: Reuse batch optimizer
from src.email_parser.workflow.batch_optimizer import (
    calculate_optimal_batches,
    create_batches
)

# Optimize any classifiable items (not just emails)
optimal_batches = calculate_optimal_batches(
    num_items=len(items),
    parallel_executions=4,
    model="openai"
)

batches = create_batches(items, optimal_batches)

# ❌ WRONG: Process sequentially
for item in items:
    classify(item)  # 20-30x slower!
```

**2. LangGraph Workflows (`src/email_parser/workflow/graph.py`)**

The email_parser workflow is production-tested and debuggable in LangGraph Studio:

```python
# ✅ CORRECT: Reuse existing workflow
from src.email_parser.workflow.graph import create_classification_graph
from src.email_parser.workflow.state import AgentState

# Use for ANY data source (not just emails)
graph = create_classification_graph(store=mission_store)
state = AgentState(
    user_id="user_123",
    classifiable_items=items,  # Can be emails, calendar events, transactions, etc.
    batch_config=optimal_batches
)
result = graph.invoke(state)

# ❌ WRONG: Rebuild classification from scratch
def my_custom_classifier():
    # Don't rebuild what works!
    pass
```

**3. Store Integration (`src/email_parser/workflow/nodes/update_memory.py`)**

The email_parser writes to BOTH SQLite (legacy) and Store (new) for backward compatibility:

```python
# ✅ CORRECT: Dual writes for backward compatibility
def update_memory_node(state, store):
    # Legacy write (KEEP until Phase 5)
    memory_manager.update_classifications(state["all_classifications"])

    # New write (ADD for mission agents)
    if store:
        for classification in state["all_classifications"]:
            store.put_iab_classification(
                user_id=state["user_id"],
                taxonomy_id=classification["taxonomy_id"],
                classification=classification
            )

# ❌ WRONG: Remove SQLite, break dashboard
def update_memory_node(state, store):
    # Only Store write - dashboard breaks!
    store.put_iab_classification(...)
```

**4. Multi-Provider LLM (`src/email_parser/llm_clients/`)**

The email_parser supports 4 LLM providers with unified interface:

```python
# ✅ CORRECT: Reuse LLM client factory
from src.email_parser.llm_clients.factory import create_llm_client

client = create_llm_client("openai")  # or "claude", "gemini", "ollama"
response = client.generate(prompt)

# ❌ WRONG: Hardcode to one provider
from openai import OpenAI
client = OpenAI()  # Doesn't support other providers
```

---

#### Integration Testing Required

**Always test new code integrates with email_parser:**

```python
# tests/integration/test_new_feature_with_email_parser.py

def test_new_feature_doesnt_break_email_classification():
    """CRITICAL: Email parser must continue working after new feature"""

    # Baseline: Run email parser
    from src.email_parser.main import EmailParserCLI

    cli = EmailParserCLI()
    result_before = cli.process_emails(max_count=10)
    assert len(result_before["classifications"]) > 0

    # Execute new feature
    new_feature = NewFeature(config)
    new_feature.execute()

    # Verify: Email parser still works
    result_after = cli.process_emails(max_count=10)
    assert len(result_after["classifications"]) > 0
    assert result_after["status"] == "success"

def test_store_reads_work_for_both_systems():
    """Verify Store reads work for email_parser AND mission agents"""
    from src.mission_agents.memory.store import MissionStore

    store = MissionStore(config)

    # Email parser writes
    run_email_classification(store=store)

    # Mission agents read
    classifications = store.get_all_iab_classifications("user_123")

    assert len(classifications) > 0
    assert "confidence" in classifications[0]
```

**Before committing, run:**

```bash
# 1. Unit tests for new code
pytest tests/unit/test_new_feature.py -v

# 2. Integration with email_parser (CRITICAL)
pytest tests/integration/test_new_feature_with_email_parser.py -v

# 3. Master system test (CRITICAL)
pytest tests/integration/test_complete_system.py -v

# 4. Verify email_parser still works
pytest tests/unit/test_batch_optimizer.py -v

# 5. LangGraph Studio visualization
langgraph dev  # Navigate to http://127.0.0.1:2024

# 6. Dashboard queries
cd dashboard && python backend/app.py &
# Navigate to http://localhost:5000/api/profile/user_123
```

**See:** [docs/reference/LEGACY_CODE_INTEGRATION.md](docs/reference/LEGACY_CODE_INTEGRATION.md) for comprehensive integration guide.

---

## Code Organization Principles

### DRY (Don't Repeat Yourself)

**Extract shared logic into reusable components:**

```python
# ✅ CORRECT: Shared base class
class BaseAgent(ABC):
    """All mission agents inherit from this"""

    @abstractmethod
    def evaluate(self, trigger: TriggerEvent, store: MissionStore) -> Optional[MissionCard]:
        pass

    def check_confidence_threshold(self, confidence: float) -> bool:
        """Shared logic for all agents"""
        return confidence >= self.config.min_confidence

class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        # Use shared logic
        if not self.check_confidence_threshold(trigger.confidence):
            return None
        # Agent-specific logic...

# ❌ WRONG: Duplicate logic in each agent
class ShoppingAgent:
    def evaluate(self, trigger, store):
        if trigger.confidence < 0.75:  # Duplicated threshold check
            return None

class TravelAgent:
    def evaluate(self, trigger, store):
        if trigger.confidence < 0.75:  # Same logic duplicated
            return None
```

**When to extract:**
- Logic used in 2+ places → Extract to shared function/class
- Configuration values → Extract to config file
- Complex algorithms → Extract to utility module

### YAGNI (You Aren't Gonna Need It)

**Only implement what's needed for the current phase:**

```python
# ✅ CORRECT: Phase 3 (Agent Layer) - Build shopping agent
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        # Implement what's needed NOW
        return self._create_shopping_card(trigger, store)

# ❌ WRONG: Building features for future phases
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        card = self._create_shopping_card(trigger, store)

        # DON'T do this in Phase 3:
        # - Persist card to database (Phase 4)
        # - Generate UI components (Phase 5)
        # - Implement feedback processing (Phase 4)
        # - Add BBS+ pseudonyms (Phase 6)

        return card
```

**Phase boundaries are explicit for a reason.** Implementing future features causes:
- Integration complexity (building on unstable foundation)
- Rework when actual phase implementation differs
- Testing difficulties (testing incomplete system)

### Clean Interfaces

**Design clear boundaries between components:**

```python
# ✅ CORRECT: Clean interface with explicit contract
class MissionStore:
    """
    Store interface - hides implementation details.

    Can swap InMemoryStore → PostgreSQL without changing callers.
    """

    def put_iab_classification(self, user_id: str, taxonomy_id: str, data: Dict) -> None:
        """Store IAB classification - implementation hidden"""
        namespace = self._get_namespace("iab_classifications", user_id=user_id)
        self.store.put(namespace, taxonomy_id, data)

    def get_iab_classification(self, user_id: str, taxonomy_id: str) -> Optional[Dict]:
        """Retrieve IAB classification - implementation hidden"""
        namespace = self._get_namespace("iab_classifications", user_id=user_id)
        item = self.store.get(namespace, taxonomy_id)
        return item.value if item else None

# Callers don't know about Store internals
classification = store.get_iab_classification(user_id, taxonomy_id)  # Clean!

# ❌ WRONG: Leaky abstraction exposing internals
namespace = ("ownyou.iab_classifications", user_id)  # Caller knows namespace structure
item = store.store.get(namespace, taxonomy_id)  # Caller accesses internal store directly
classification = item.value if item else None  # Caller handles Store types
```

**Interface principles:**
- Hide implementation details
- Accept abstract types (interfaces, not concrete classes)
- Return domain types (not framework types)
- Single responsibility (one clear purpose)

### Module Organization

```
src/
├── mission_agents/           # Mission agent system
│   ├── models/              # Data models (Phase 1)
│   ├── memory/              # Store wrapper (Phase 1)
│   ├── agents/              # Agent implementations (Phase 3)
│   │   ├── shopping/
│   │   ├── travel/
│   │   └── restaurant/
│   ├── triggers/            # Trigger system (Phase 3)
│   └── orchestrator.py      # Mission routing (Phase 3)
├── data_sources/            # Data connectors (Phase 2)
│   ├── base.py             # Abstract base
│   ├── email/
│   ├── calendar/
│   └── financial/
├── auth/                    # Authentication (Phase 1)
└── api/                     # REST endpoints (Phase 4)

tests/
├── mission_agents/          # Unit tests
│   ├── models/
│   ├── memory/
│   └── agents/
├── integration/             # Integration tests
│   ├── test_complete_system.py  # Master system test
│   └── test_iab_store_integration.py
└── dashboard/               # API tests
```

**Naming conventions:**
- Modules: `snake_case` (e.g., `shopping_agent.py`)
- Classes: `CapWords` (e.g., `ShoppingAgent`)
- Functions: `snake_case` (e.g., `evaluate_shopping_mission`)
- Constants: `UPPER_CASE` (e.g., `MIN_CONFIDENCE`)
- Private: `_leading_underscore` (e.g., `_internal_helper`)

---

## Testing Requirements

### Test-Driven Development (TDD)

**Write tests BEFORE implementation (Red-Green-Refactor cycle):**

```python
# Step 1: Write failing test (RED)
def test_shopping_agent_creates_card_for_high_confidence_iab():
    """Test shopping agent creates card when IAB confidence >= 0.75"""
    agent = ShoppingAgent(config)
    store = MissionStore(config)

    # Setup
    trigger = TriggerEvent(
        type=TriggerType.IAB_PROFILE_CHANGE,
        user_id="user_123",
        details={"taxonomy_id": "IAB18-1", "confidence": 0.85}
    )

    # Act
    card = agent.evaluate(trigger, store)

    # Assert
    assert card is not None
    assert card.card_type == "savings_shopping"
    assert card.trigger_type == TriggerType.IAB_PROFILE_CHANGE

# Step 2: Run test - it should FAIL
# $ pytest test_shopping_agent.py::test_shopping_agent_creates_card_for_high_confidence_iab
# FAILED - ShoppingAgent not implemented yet

# Step 3: Implement MINIMAL code to pass (GREEN)
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        if trigger.details["confidence"] >= 0.75:
            return MissionCard(
                card_type="savings_shopping",
                trigger_type=trigger.type,
                # ... minimal fields
            )
        return None

# Step 4: Run test - it should PASS
# $ pytest test_shopping_agent.py::test_shopping_agent_creates_card_for_high_confidence_iab
# PASSED

# Step 5: Refactor (improve code without changing behavior)
class ShoppingAgent(BaseAgent):
    MIN_CONFIDENCE = 0.75  # Extract constant

    def evaluate(self, trigger, store):
        if not self._meets_confidence_threshold(trigger):
            return None
        return self._create_shopping_card(trigger, store)

    def _meets_confidence_threshold(self, trigger):
        return trigger.details["confidence"] >= self.MIN_CONFIDENCE

# Step 6: Run test again - should still PASS
```

**Why TDD:**
- Tests prove requirements before implementation
- Red phase validates tests actually catch failures
- Minimal implementation (no gold-plating)
- Refactoring safety (tests catch regressions)

### Test Coverage Requirements

**Minimum coverage targets:**

```python
# Utilities and core logic: >80% coverage
# src/mission_agents/memory/store.py
coverage: 95%  # High - critical path

# Business logic: >70% coverage
# src/mission_agents/agents/shopping/shopping_agent.py
coverage: 78%  # Good

# UI components: >60% coverage
# dashboard/frontend/components/MissionCard.tsx
coverage: 65%  # Acceptable for UI

# Integration tests: All critical paths
# tests/integration/test_complete_system.py
coverage: End-to-end user journeys
```

**Run coverage:**

```bash
# Python
pytest --cov=src --cov-report=html --cov-report=term-missing

# View HTML report
open htmlcov/index.html

# Check specific file
pytest --cov=src/mission_agents/memory/store.py --cov-report=term-missing
```

### Test Organization

```python
# tests/mission_agents/memory/test_store.py

# Unit tests - test single component in isolation
def test_store_put_iab_classification():
    """Unit test: MissionStore.put_iab_classification"""
    store = MissionStore(config)
    store.put_iab_classification("user_123", "IAB1-1", {"confidence": 0.85})
    result = store.get_iab_classification("user_123", "IAB1-1")
    assert result["confidence"] == 0.85

# Integration tests - test component interactions
def test_iab_workflow_writes_to_store():
    """Integration test: IAB workflow → Store integration"""
    store = MissionStore(config)
    state = AgentState(user_id="user_123", all_classifications=[...])

    # Test actual workflow interaction
    update_memory_node(state, store=store)

    classifications = store.get_all_iab_classifications("user_123")
    assert len(classifications) == 2

# End-to-end tests - test complete user journeys
def test_email_to_mission_card_flow():
    """E2E test: Email download → IAB classification → Mission card creation"""
    # Download emails
    emails = email_provider.fetch_emails(max_count=10)

    # Classify
    classifications = iab_classifier.classify(emails)

    # Trigger mission
    card = mission_orchestrator.process_trigger(
        TriggerEvent(type=TriggerType.IAB_PROFILE_CHANGE, ...)
    )

    assert card is not None
```

### Test Scenarios

**Cover these scenarios for every feature:**

```python
# 1. Happy path
def test_shopping_agent_happy_path():
    """Test normal operation with valid inputs"""
    # Valid trigger, user preferences set, Store populated
    card = agent.evaluate(trigger, store)
    assert card is not None

# 2. Edge cases
def test_shopping_agent_zero_confidence():
    """Test edge case: confidence = 0.0"""
    trigger = TriggerEvent(details={"confidence": 0.0})
    card = agent.evaluate(trigger, store)
    assert card is None  # Below threshold

def test_shopping_agent_exactly_threshold():
    """Test edge case: confidence exactly at threshold"""
    trigger = TriggerEvent(details={"confidence": 0.75})
    card = agent.evaluate(trigger, store)
    assert card is not None  # Meets threshold

# 3. Error cases
def test_shopping_agent_missing_user_preferences():
    """Test error case: user preferences not in Store"""
    # Store has no preferences for user
    card = agent.evaluate(trigger, store)
    # Should use defaults, not crash
    assert card is not None

def test_shopping_agent_invalid_trigger_type():
    """Test error case: wrong trigger type"""
    trigger = TriggerEvent(type=TriggerType.SCHEDULED_CHECK)  # Wrong type
    card = agent.evaluate(trigger, store)
    assert card is None  # Gracefully handle

# 4. Security/Privacy cases
def test_shopping_agent_no_pii_in_external_calls(mocker):
    """Test privacy: no PII sent to external APIs"""
    mock_api = mocker.patch("shopping_api.search")

    agent.evaluate(trigger, store)

    # Verify API call had no PII
    call_args = mock_api.call_args[0][0]
    assert "[EMAIL]" in call_args or "user_123" not in call_args
```

---

## Privacy & Security Constraints

### PII Protection

**ALL personal data MUST be protected:**

```python
# ✅ CORRECT: Redact PII before external calls
def classify_email(email: Email, llm_client: LLMClient):
    # Redact PII
    safe_content = redact_pii(email.content)

    # Only send redacted content to external API
    classifications = llm_client.classify(safe_content)

    return classifications

# ❌ WRONG: Send raw content to external API
def classify_email(email: Email, llm_client: LLMClient):
    # Sends user names, addresses, phone numbers to external API!
    classifications = llm_client.classify(email.content)
    return classifications
```

### Consent Checks

**Check user consent before data operations:**

```python
# ✅ CORRECT: Verify consent before external API call
def search_restaurants(user_id: str, location: str):
    # Check consent
    if not consent_manager.check_consent(user_id, "location", "restaurant_search"):
        raise ConsentRequiredError("User hasn't consented to location-based searches")

    # Proceed with external API
    return restaurant_api.search(location)

# ❌ WRONG: No consent check
def search_restaurants(user_id: str, location: str):
    return restaurant_api.search(location)  # Violates privacy!
```

### Encryption Requirements

**Sensitive data encrypted at rest:**

```python
# ✅ CORRECT: Encrypt sensitive data in Store
def store_financial_data(user_id: str, transactions: List[Transaction]):
    # Encrypt before storing
    encrypted = encrypt_data(transactions, user_key)
    store.put_financial_transactions(user_id, encrypted)

# Decrypt on retrieval
def get_financial_data(user_id: str):
    encrypted = store.get_financial_transactions(user_id)
    return decrypt_data(encrypted, user_key)

# ❌ WRONG: Plain text storage
def store_financial_data(user_id: str, transactions: List[Transaction]):
    store.put_financial_transactions(user_id, transactions)  # Plain text!
```

### Logging Security

**NO sensitive data in logs:**

```python
# ✅ CORRECT: Log non-sensitive data only
logger.info(f"Processing classification for user_id={user_id}, taxonomy_id={taxonomy_id}")

# ❌ WRONG: Log PII
logger.info(f"Processing email: {email.subject} from {email.sender}")  # PII in logs!
logger.debug(f"User preferences: {preferences}")  # Sensitive data in logs!
```

### Security Testing

```python
def test_no_pii_in_logs(caplog):
    """Verify no PII appears in logs"""
    email = Email(
        sender="john.smith@email.com",
        subject="Personal information"
    )

    classify_email(email, llm_client)

    # Check logs don't contain PII
    log_text = caplog.text
    assert "john.smith@email.com" not in log_text
    assert email.subject not in log_text

def test_encryption_roundtrip():
    """Verify encryption/decryption works"""
    original_data = {"ssn": "123-45-6789", "credit_card": "1234-5678-9012-3456"}

    # Encrypt
    encrypted = encrypt_data(original_data, key)
    assert encrypted != original_data  # Data is encrypted

    # Decrypt
    decrypted = decrypt_data(encrypted, key)
    assert decrypted == original_data  # Roundtrip successful
```

---

## Performance Constraints

### Response Time Requirements

```python
# API endpoints:
# - < 200ms: Simple queries (get profile, get classifications)
# - < 1s: Mission card creation (Level 1 Simple agents)
# - < 5s: Complex queries (Level 2 Coordinated agents)
# - < 60s: Multi-round missions (Level 3 Complex agents with user interrupts)

# Batch processing:
# - IAB classification: 10-20 emails per LLM call
# - Target: 100 emails in < 10 minutes

# Database queries:
# - Store retrieval: < 50ms per operation
# - Batch retrieval: < 200ms for all classifications
```

### Performance Testing

```python
import time

def test_shopping_agent_performance():
    """Test agent completes within 1 second"""
    start = time.time()

    card = shopping_agent.evaluate(trigger, store)

    duration = time.time() - start
    assert duration < 1.0, f"Agent took {duration}s (limit: 1s)"

def test_store_batch_retrieval_performance():
    """Test batch retrieval completes within 200ms"""
    # Setup: 100 classifications in Store
    for i in range(100):
        store.put_iab_classification(user_id, f"IAB{i}", {...})

    start = time.time()

    # Retrieve all
    classifications = store.get_all_iab_classifications(user_id)

    duration = time.time() - start
    assert duration < 0.2, f"Batch retrieval took {duration}s (limit: 0.2s)"
    assert len(classifications) == 100
```

### Optimization Patterns

```python
# ✅ CORRECT: Batch operations
classifications = store.get_all_iab_classifications(user_id)  # Single query

# ❌ WRONG: Individual queries in loop
classifications = []
for taxonomy_id in taxonomy_ids:
    c = store.get_iab_classification(user_id, taxonomy_id)  # N queries!
    classifications.append(c)

# ✅ CORRECT: Lazy loading
def get_mission_cards(user_id: str, limit: int = 10):
    """Only fetch what's needed"""
    return store.get_missions(user_id, limit=limit)  # Paginated

# ❌ WRONG: Load everything upfront
def get_mission_cards(user_id: str):
    all_missions = store.get_all_missions(user_id)  # Loads 1000s of missions!
    return all_missions[:10]  # Only use 10
```

---

## Code Quality Standards

### Type Hints (Required)

```python
# ✅ CORRECT: Complete type hints
from typing import Optional, List, Dict, Any

def evaluate_shopping_mission(
    trigger: TriggerEvent,
    store: MissionStore,
    config: Optional[AgentConfig] = None
) -> Optional[MissionCard]:
    """
    Evaluate if trigger should create shopping mission.

    Args:
        trigger: Event that triggered evaluation
        store: Mission memory store
        config: Optional agent configuration

    Returns:
        MissionCard if mission should be created, None otherwise
    """
    # Implementation...

# ❌ WRONG: Missing type hints
def evaluate_shopping_mission(trigger, store, config=None):
    # No types - harder to maintain
    pass
```

**Type checking:**

```bash
# Run mypy on src/ only (tests excluded)
mypy src/

# Fix type errors before committing
```

### Documentation Standards

```python
# ✅ CORRECT: Comprehensive docstring
class ShoppingAgent(BaseAgent):
    """
    Mission agent for shopping recommendations.

    Creates shopping mission cards when:
    - IAB Fashion/Shopping classification confidence >= 0.75
    - User has shopping preferences in Store
    - Shopping list is not empty

    Attributes:
        config: Agent configuration
        api_client: External shopping API client

    Example:
        >>> agent = ShoppingAgent(config)
        >>> trigger = TriggerEvent(type=TriggerType.IAB_PROFILE_CHANGE, ...)
        >>> card = agent.evaluate(trigger, store)
    """

    def evaluate(self, trigger: TriggerEvent, store: MissionStore) -> Optional[MissionCard]:
        """
        Evaluate if trigger should create shopping mission.

        Args:
            trigger: Event that triggered evaluation (must be IAB_PROFILE_CHANGE)
            store: Mission memory store for reading user preferences

        Returns:
            MissionCard if all conditions met, None otherwise

        Raises:
            ValueError: If trigger type is invalid
            StoreError: If Store is unavailable
        """
        # Implementation...

# ❌ WRONG: No docstring
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        # What does this do? What are the requirements?
        pass
```

### Error Handling

```python
# ✅ CORRECT: Specific exceptions with context
def get_user_preferences(user_id: str, store: MissionStore) -> Dict[str, Any]:
    """Retrieve user preferences from Store"""
    try:
        preferences = store.get_user_preferences(user_id)

        if preferences is None:
            # User has no preferences yet - use defaults
            logger.info(f"No preferences found for {user_id}, using defaults")
            return DEFAULT_PREFERENCES

        return preferences

    except StoreConnectionError as e:
        # Specific exception, helpful message
        logger.error(f"Failed to connect to Store for user {user_id}: {e}")
        raise ServiceUnavailableError("Memory store is unavailable") from e

    except Exception as e:
        # Unexpected error - log and re-raise
        logger.exception(f"Unexpected error retrieving preferences for {user_id}")
        raise

# ❌ WRONG: Bare except with no context
def get_user_preferences(user_id, store):
    try:
        return store.get_user_preferences(user_id)
    except:  # What exception? Why did it fail?
        return {}  # Silently returns empty dict - hides errors!
```

### Code Formatting

**Use automated formatters:**

```bash
# Format code (before committing)
black src/ tests/

# Check formatting (in CI)
black --check src/ tests/

# Sort imports
isort src/ tests/

# Lint
flake8 src/ tests/
```

**Black configuration (pyproject.toml):**

```toml
[tool.black]
line-length = 100
target-version = ['py311']
include = '\.pyi?$'
```

### Git Commit Messages

```bash
# ✅ CORRECT: Descriptive commit message
feat: add shopping agent with IAB trigger support

- Implement ShoppingAgent.evaluate() for IAB_PROFILE_CHANGE triggers
- Add confidence threshold check (>= 0.75)
- Integrate with Store for user preferences
- Add tests for happy path, edge cases, and error scenarios
- Update documentation with agent usage examples

Closes #123

# ❌ WRONG: Vague commit message
feat: add shopping stuff

# What was added? Why? How does it work?
```

**Commit message format:**

```
<type>: <subject>

<body>

<footer>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation only
- test: Adding tests
- refactor: Code change without feature/fix
- perf: Performance improvement
- chore: Build/tooling changes
```

---

## Quality Assurance Checklist

Before considering any feature complete:

### Functional Requirements ✅
- [ ] All requirements from Strategic Roadmap implemented
- [ ] All acceptance criteria met
- [ ] Integration with existing components works
- [ ] Phase boundaries respected

### Code Quality ✅
- [ ] Type hints complete (mypy passes)
- [ ] Docstrings for all public functions/classes
- [ ] Error handling comprehensive
- [ ] No console.log or debug prints
- [ ] Code formatted (black passes)
- [ ] Linting passes (flake8)

### Testing ✅
- [ ] Unit tests written (TDD approach)
- [ ] Integration tests pass
- [ ] Coverage meets requirements (>80% utilities, >70% logic)
- [ ] Happy path, edge cases, errors covered
- [ ] Security/privacy tests pass

### Privacy & Security ✅
- [ ] No PII in logs
- [ ] Consent checks before external APIs
- [ ] Sensitive data encrypted
- [ ] Input validation and sanitization

### Performance ✅
- [ ] Response times within limits
- [ ] No N+1 query problems
- [ ] Batch operations used where applicable
- [ ] Performance tests pass

### Documentation ✅
- [ ] Code comments for complex logic
- [ ] README updated if needed
- [ ] API docs updated if endpoints added
- [ ] Examples provided for new features

---

## Related Documentation

- **Architectural Decisions**: `reference/ARCHITECTURAL_DECISIONS.md` - Critical constraints
- **Current System**: `reference/CURRENT_SYSTEM.md` - What's implemented now
- **Project Structure**: `reference/PROJECT_STRUCTURE.md` - File organization
- **Strategic Roadmap**: `docs/plans/2025-01-04-ownyou-strategic-roadmap.md` - Phase planning
- **Repository Guidelines**: `docs/development/REPOSITORY_GUIDELINES.md` - Git/PR standards

---

**Remember:** These are not suggestions - they're requirements. Following these guidelines ensures code quality, security, and successful integration into the system.
