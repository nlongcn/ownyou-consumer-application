# OwnYou Consumer Application - Testing Plan

**Purpose**: Comprehensive testing plan for Mission Agents architecture following Test-Driven Development (TDD) and continuous testing discipline.

**Last Updated**: 2025-01-05

---

## Testing Philosophy

### Core Principles

1. **Test at EVERY checkpoint** - Not just before commits
2. **RED-GREEN-REFACTOR** - TDD cycle mandatory for all code
3. **Test before claiming done** - Never mark implementation complete without running tests
4. **Frontend via Playwright MCP** - All dashboard/UI testing through MCP
5. **Integration > Mocks** - Prefer real integrations with test data over mocking

### Test-Driven Development (TDD) Enforcement

**EVERY feature MUST follow RED-GREEN-REFACTOR:**

```python
# Step 1: Write failing test (RED)
def test_shopping_agent_creates_card():
    agent = ShoppingAgent(config)
    card = agent.evaluate(trigger, store)
    assert card is not None  # Test FAILS - not implemented yet

# Step 2: Run test - verify it FAILS
pytest tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card -v
# EXPECTED: FAILED

# Step 3: Implement minimal code (GREEN)
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        return MissionCard(...)  # Minimal implementation

# Step 4: Run test - verify it PASSES
pytest tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card -v
# EXPECTED: PASSED

# Step 5: Refactor (REFACTOR)
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger, store):
        if not self._meets_threshold(trigger):
            return None
        return self._create_card(trigger, store)

# Step 6: Run test again - verify still PASSES
pytest tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card -v
# EXPECTED: PASSED
```

**Never skip the RED phase!** If test passes before implementation, the test is wrong.

### Testing Checkpoints

**Test at THESE specific moments:**

1. **After writing test** (RED phase - must fail)
2. **After minimal implementation** (GREEN phase - must pass)
3. **After refactoring** (must still pass)
4. **Before committing** (full suite must pass)
5. **Before creating PR** (full suite + coverage check)

### Test Pyramid Structure

```
                ┌─────────────┐
                │   E2E Tests  │  (Few - Complete user flows)
                └─────────────┘
            ┌─────────────────────┐
            │  Integration Tests   │  (Some - Component interactions)
            └─────────────────────┘
        ┌───────────────────────────────┐
        │       Unit Tests               │  (Many - Individual functions)
        └───────────────────────────────┘
```

**Coverage targets:**
- Unit tests: >80% coverage for utilities/core logic
- Integration tests: >70% coverage for business logic
- E2E tests: All critical user journeys

---

## Phase 1: Foundation & Contracts Testing

### What to Test

Phase 1 has NO implementation - only contracts. Testing focuses on:
- Pydantic model validation
- Store namespace documentation correctness
- OpenAPI spec validation
- Authentication system (only phase with implementation)

### Unit Tests

**Test File**: `tests/mission_agents/models/test_mission_card.py`

```python
import pytest
from src.mission_agents.models.mission_card import (
    MissionCard, ShoppingCardData, TravelCardData,
    CardCategory, MissionState, TriggerType
)

class TestMissionCardModels:
    """Test Phase 1 Pydantic model validation"""

    def test_shopping_card_data_validation(self):
        """Verify ShoppingCardData validates correctly"""
        data = ShoppingCardData(
            product_name="Laptop",
            product_url="https://example.com/laptop",
            image_url="https://example.com/image.jpg",
            current_price=999.99,
            original_price=1299.99,
            retailer_name="BestBuy",
            in_stock=True,
            savings_amount=300.00
        )

        assert data.product_name == "Laptop"
        assert data.savings_amount == 300.00

    def test_shopping_card_data_required_fields(self):
        """Verify required fields are enforced"""
        with pytest.raises(ValueError):
            ShoppingCardData(
                product_name="Laptop"
                # Missing required fields
            )

    def test_mission_card_creation(self):
        """Test complete MissionCard creation"""
        card_data = ShoppingCardData(
            product_name="Laptop",
            product_url="https://example.com/laptop",
            image_url="https://example.com/image.jpg",
            current_price=999.99,
            retailer_name="BestBuy"
        )

        card = MissionCard(
            mission_id="mission_123",
            user_id="user_456",
            thread_id="thread_789",
            card_type="savings_shopping",
            agent_type="shopping_agent",
            category=CardCategory.SAVINGS,
            complexity_level=1,
            state=MissionState.ACTIVE,
            trigger_type=TriggerType.IAB_PROFILE_CHANGE,
            trigger_details={"taxonomy_id": "IAB18-1", "confidence": 0.85},
            memory_context={"iab_classifications": []},
            card_data=card_data.dict()
        )

        assert card.mission_id == "mission_123"
        assert card.category == CardCategory.SAVINGS
        assert card.complexity_level == 1

    def test_trigger_provenance_required(self):
        """Verify trigger_type and trigger_details are required"""
        with pytest.raises(ValueError):
            MissionCard(
                mission_id="mission_123",
                user_id="user_456",
                card_type="savings_shopping",
                # Missing trigger_type and trigger_details
            )

class TestAllCardTypes:
    """Test ALL card type data models"""

    def test_travel_card_data(self):
        """Test TravelCardData model"""
        data = TravelCardData(
            destination="Tokyo",
            destination_image_url="https://example.com/tokyo.jpg",
            hotel_options=[{"name": "Hotel 1", "price": 200}],
            flight_options=[{"airline": "Delta", "price": 800}],
            activities=[{"name": "Temple visit"}],
            estimated_cost=2000.00,
            alignment_score=0.9
        )
        assert data.destination == "Tokyo"

    def test_restaurant_card_data(self):
        """Test RestaurantCardData model"""
        # ... test all other card types
```

### Integration Tests

**Test File**: `tests/mission_agents/memory/test_store_integration.py`

```python
class TestStoreNamespaceIntegration:
    """Test Store namespaces match documentation"""

    def test_iab_classification_namespace(self):
        """Verify IAB classification namespace structure"""
        from src.mission_agents.memory.store import MissionStore
        from src.mission_agents.memory.config import StoreConfig

        config = StoreConfig()
        store = MissionStore(config=config)

        # Store IAB classification
        user_id = "user_test"
        taxonomy_id = "IAB1-1"
        classification = {
            "taxonomy_name": "Arts & Entertainment",
            "confidence": 0.85,
            "evidence": ["email1", "email2"],
            "last_updated": "2025-01-05"
        }

        store.put_iab_classification(user_id, taxonomy_id, classification)

        # Retrieve
        result = store.get_iab_classification(user_id, taxonomy_id)

        assert result["confidence"] == 0.85
        assert len(result["evidence"]) == 2

    def test_all_documented_namespaces_work(self):
        """Verify ALL namespaces from store_schema.md work"""
        store = MissionStore(config=StoreConfig())
        user_id = "user_test"

        # Test each namespace type
        namespaces_to_test = [
            ("user_profile", {"name": "Test User"}),
            ("shopping_preferences", {"budget": 1000}),
            ("travel_preferences", {"destinations": ["Tokyo"]}),
            ("ikigai_profile", {"purpose": "Learning"}),
        ]

        for namespace_type, test_data in namespaces_to_test:
            # Should not raise exception
            store._get_namespace(namespace_type, user_id=user_id)
```

### OpenAPI Spec Validation

**Test File**: `tests/api/test_openapi_spec.py`

```python
class TestOpenAPISpec:
    """Validate OpenAPI specification"""

    def test_spec_validates(self):
        """Verify OpenAPI spec is valid"""
        import yaml
        from openapi_spec_validator import validate_spec

        with open("docs/api/openapi.yaml") as f:
            spec = yaml.safe_load(f)

        # Should not raise exception
        validate_spec(spec)

    def test_all_endpoints_documented(self):
        """Verify all required endpoints are documented"""
        import yaml

        with open("docs/api/openapi.yaml") as f:
            spec = yaml.safe_load(f)

        required_endpoints = [
            "/auth/login",
            "/missions/{user_id}",
            "/missions/{mission_id}/feedback",
            "/wallet/{user_id}/balance",
            "/profile/{user_id}",
        ]

        paths = spec.get("paths", {})
        for endpoint in required_endpoints:
            assert endpoint in paths, f"Missing endpoint: {endpoint}"
```

### Authentication System Tests

**Test File**: `tests/auth/test_wallet_auth.py`

```python
class TestWalletAuthentication:
    """Test self-sovereign authentication system"""

    def test_signature_verification(self):
        """Test wallet signature verification"""
        from src.auth.wallet_auth import verify_signature

        wallet_address = "0x123..."
        message = "Sign in to OwnYou"
        signature = "0xabc..."  # Mock signature

        # Implementation should verify signature
        result = verify_signature(wallet_address, message, signature)
        assert result is True or result is False

    def test_jwt_token_generation(self):
        """Test JWT token generation"""
        from src.auth.jwt_tokens import generate_token

        user_id = "user_123"
        wallet_address = "0x123..."

        token = generate_token(user_id, wallet_address)
        assert token is not None
        assert isinstance(token, str)

    def test_jwt_token_validation(self):
        """Test JWT token validation"""
        from src.auth.jwt_tokens import generate_token, validate_token

        user_id = "user_123"
        wallet_address = "0x123..."

        token = generate_token(user_id, wallet_address)
        payload = validate_token(token)

        assert payload["user_id"] == user_id
        assert payload["wallet_address"] == wallet_address
```

---

## Phase 2: Data Layer Testing

### What to Test

Phase 2 implements multi-source data connectors writing to Store:
- Email connector (existing, refactored)
- Calendar connector
- Financial connector
- Location connector

### Unit Tests

**Test File**: `tests/data_sources/test_email_connector.py`

```python
class TestEmailConnector:
    """Test email data source connector"""

    def test_email_connector_initialization(self):
        """Test connector initializes correctly"""
        from src.data_sources.email.connector import EmailConnector

        connector = EmailConnector(config=test_config)
        assert connector is not None

    def test_fetch_emails_writes_to_store(self):
        """Verify emails written to Store"""
        from src.data_sources.email.connector import EmailConnector
        from src.mission_agents.memory.store import MissionStore

        store = MissionStore(config=StoreConfig())
        connector = EmailConnector(config=test_config, store=store)

        emails = connector.fetch_emails(max_count=5)

        # Verify emails in Store
        stored_events = store.search_email_events(user_id="test_user")
        assert len(stored_events) >= 5

    def test_incremental_fetch(self):
        """Test incremental email fetching"""
        connector = EmailConnector(config=test_config, store=store)

        # First fetch
        emails_1 = connector.fetch_emails(max_count=10)

        # Second fetch (should get new emails only)
        emails_2 = connector.fetch_emails(max_count=10)

        # Should not have duplicates
        ids_1 = {e["id"] for e in emails_1}
        ids_2 = {e["id"] for e in emails_2}
        assert len(ids_1.intersection(ids_2)) == 0
```

### Integration Tests

**Test File**: `tests/integration/test_multi_source_integration.py`

```python
class TestMultiSourceIntegration:
    """Test multiple data sources writing to Store"""

    def test_all_sources_write_to_store(self):
        """Verify all data sources write to Store correctly"""
        from src.data_sources.email.connector import EmailConnector
        from src.data_sources.calendar.connector import CalendarConnector
        from src.mission_agents.memory.store import MissionStore

        store = MissionStore(config=StoreConfig())
        user_id = "test_user"

        # Fetch from each source
        email_connector = EmailConnector(config=config, store=store)
        email_connector.fetch_emails(max_count=5)

        calendar_connector = CalendarConnector(config=config, store=store)
        calendar_connector.fetch_events(max_count=5)

        # Verify both in Store
        email_events = store.search_email_events(user_id)
        calendar_events = store.search_calendar_events(user_id)

        assert len(email_events) >= 5
        assert len(calendar_events) >= 5

    def test_iab_classification_triggers_from_any_source(self):
        """Verify IAB classification works from any data source"""
        # Email-based classification
        email_result = iab_classifier.classify_from_emails(user_id)

        # Calendar-based classification
        calendar_result = iab_classifier.classify_from_calendar(user_id)

        # Both should produce valid classifications
        assert len(email_result["classifications"]) > 0
        assert len(calendar_result["classifications"]) > 0
```

---

## Integration Testing with Legacy Code (email_parser)

### Critical: Don't Break What's Working

**email_parser is production code. ALL new features MUST verify no regressions.**

The email_parser system is already in production with users processing emails for IAB classification. Every new feature must be tested for backward compatibility and integration.

---

### Master Integration Test Template

**Create this test file for EVERY new feature:**

```python
# tests/integration/test_new_feature_with_email_parser.py

class TestNewFeatureIntegration:
    """Verify new feature doesn't break email_parser"""

    def test_email_classification_still_works_after_new_feature(self):
        """
        CRITICAL TEST: Email parser must continue working

        This test verifies:
        1. Email download still works
        2. IAB classification still works
        3. Store writes still work
        4. Dashboard can still read data
        """
        # Setup: Run email parser (baseline)
        from src.email_parser.main import EmailParserCLI

        cli = EmailParserCLI()
        result_before = cli.process_emails(max_count=10)

        assert len(result_before["classifications"]) > 0
        assert result_before["status"] == "success"

        # Execute new feature
        new_feature = NewFeature(config)
        new_feature.execute()

        # Verify: Email parser still works
        result_after = cli.process_emails(max_count=10)

        assert len(result_after["classifications"]) > 0
        assert result_after["status"] == "success"

    def test_store_reads_work_for_both_systems(self):
        """Verify Store reads work for email_parser AND new system"""
        from src.mission_agents.memory.store import MissionStore

        store = MissionStore(config)

        # Email parser writes IAB classifications
        run_email_classification(store=store)

        # New feature reads from same Store
        classifications = store.get_all_iab_classifications("user_123")

        assert len(classifications) > 0
        assert "confidence" in classifications[0]
        assert "taxonomy_id" in classifications[0]

    def test_langgraph_studio_still_works(self):
        """Verify LangGraph Studio visualization works"""
        import subprocess
        import time
        import requests

        # Start Studio server
        studio_proc = subprocess.Popen(
            ["langgraph", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Wait for server to start
        time.sleep(5)

        # Verify Studio is accessible
        response = requests.get("http://127.0.0.1:2024")
        assert response.status_code == 200

        # Run email classification workflow
        result = run_classification_workflow()
        assert result["status"] == "success"

        # Cleanup
        studio_proc.terminate()

    def test_dashboard_queries_work(self):
        """Verify dashboard can still read profile data"""
        from dashboard.backend.db.queries import get_user_profile

        # Run email parser
        run_email_classification()

        # Dashboard queries
        profile = get_user_profile("user_123")

        assert profile is not None
        assert "demographics" in profile
        assert "interests" in profile
        assert len(profile["interests"]) > 0

    def test_batch_processing_still_optimized(self):
        """Verify batch processing performance not degraded"""
        import time
        from src.email_parser.workflow.batch_optimizer import calculate_optimal_batches

        # Measure baseline performance
        start = time.time()
        batches = calculate_optimal_batches(num_items=100)
        result_before = run_classification(batches)
        baseline_time = time.time() - start

        # Execute new feature
        new_feature.execute()

        # Measure after new feature
        start = time.time()
        batches = calculate_optimal_batches(num_items=100)
        result_after = run_classification(batches)
        after_time = time.time() - start

        # Performance should not degrade more than 10%
        assert after_time <= baseline_time * 1.1

    def test_oauth_tokens_still_valid(self):
        """Verify Gmail/Outlook OAuth still works"""
        from src.email_parser.auth import check_oauth_status

        # Check Gmail OAuth
        gmail_status = check_oauth_status("gmail", user_id="user_123")
        assert gmail_status["valid"] is True

        # Check Outlook OAuth
        outlook_status = check_oauth_status("outlook", user_id="user_123")
        assert outlook_status["valid"] is True
```

---

### Before Committing Checklist

**Run this checklist BEFORE every commit:**

```bash
#!/bin/bash
# integration_test_checklist.sh

echo "=== Pre-Commit Integration Testing ==="

# 1. Unit tests for new code
echo "1. Running unit tests..."
pytest tests/unit/test_new_feature.py -v
if [ $? -ne 0 ]; then
    echo "❌ Unit tests FAILED"
    exit 1
fi

# 2. Integration test with email_parser (CRITICAL)
echo "2. Running email_parser integration tests..."
pytest tests/integration/test_new_feature_with_email_parser.py -v
if [ $? -ne 0 ]; then
    echo "❌ Integration tests FAILED - email_parser compatibility broken"
    exit 1
fi

# 3. Master system test (CRITICAL)
echo "3. Running master system test..."
pytest tests/integration/test_complete_system.py -v
if [ $? -ne 0 ]; then
    echo "❌ Master system test FAILED"
    exit 1
fi

# 4. Email parser tests still pass
echo "4. Verifying email_parser tests..."
pytest tests/unit/test_batch_optimizer.py -v
pytest tests/unit/test_classification_workflow.py -v
if [ $? -ne 0 ]; then
    echo "❌ Email parser tests FAILED - regression detected"
    exit 1
fi

# 5. LangGraph Studio works
echo "5. Testing LangGraph Studio..."
timeout 10 langgraph dev &
STUDIO_PID=$!
sleep 5
curl -s http://127.0.0.1:2024 > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ LangGraph Studio FAILED to start"
    kill $STUDIO_PID
    exit 1
fi
kill $STUDIO_PID

# 6. Dashboard works
echo "6. Testing dashboard..."
cd dashboard/backend && python app.py &
DASHBOARD_PID=$!
sleep 5
curl -s http://localhost:5000/api/profile/user_123 > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Dashboard FAILED"
    kill $DASHBOARD_PID
    exit 1
fi
kill $DASHBOARD_PID

echo "✅ All integration tests PASSED - safe to commit"
```

---

### Test Coverage Requirements

**Minimum integration test coverage:**

- ✅ **Email parser workflow** - Completes successfully after new feature
- ✅ **IAB classifications** - Written to Store by email_parser
- ✅ **Dashboard queries** - Return valid data from SQLite
- ✅ **LangGraph Studio** - Visualization and debugging works
- ✅ **Batch processing** - Performance not degraded
- ✅ **OAuth tokens** - Gmail/Outlook authentication works
- ✅ **Store reads** - Mission agents can read email_parser writes

**Failure of ANY integration test = blocking issue**

Do NOT commit if integration tests fail. Fix the issue first.

---

### Common Integration Test Patterns

#### Pattern 1: Dual System Test

```python
def test_feature_works_with_both_systems():
    """Test new feature works with email_parser AND mission agents"""

    # Email parser system
    email_result = email_parser_workflow(user_id)
    assert len(email_result["classifications"]) > 0

    # Mission agents system
    mission_result = mission_agent_workflow(user_id)
    assert len(mission_result["missions"]) > 0

    # Verify data consistency
    assert email_result["user_id"] == mission_result["user_id"]
```

#### Pattern 2: Backward Compatibility Test

```python
def test_backward_compatibility_maintained():
    """Test old code paths still work"""

    # Old path (SQLite)
    old_profile = get_user_profile_sqlite(user_id)

    # New path (Store)
    new_profile = get_user_profile_store(user_id)

    # Both should return same data
    assert old_profile["demographics"] == new_profile["demographics"]
```

#### Pattern 3: Performance Regression Test

```python
def test_no_performance_regression():
    """Test new feature doesn't slow down existing system"""
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

    # Allow max 10% performance degradation
    assert after_time <= baseline_time * 1.1
```

---

### Integration Test Organization

**File structure:**

```
tests/
├── integration/
│   ├── test_complete_system.py           # Master test (existing)
│   ├── test_phase2_with_email_parser.py  # Phase 2 integration
│   ├── test_phase3_with_email_parser.py  # Phase 3 integration
│   ├── test_phase4_with_email_parser.py  # Phase 4 integration
│   └── test_mission_agents_with_email_parser.py  # Mission agents
```

**Each phase integration test includes:**
1. Email parser still works test
2. Store reads/writes test
3. Dashboard queries test
4. LangGraph Studio test
5. Performance benchmark test

---

### CI/CD Integration

**GitHub Actions workflow (`.github/workflows/integration.yml`):**

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Run email_parser integration tests
        run: |
          pytest tests/integration/test_*_with_email_parser.py -v

      - name: Run master system test
        run: |
          pytest tests/integration/test_complete_system.py -v

      - name: Verify no performance regression
        run: |
          pytest tests/integration/ -v --benchmark-only
```

---

### Debugging Failed Integration Tests

**When an integration test fails:**

1. **Check email_parser logs:**
   ```bash
   tail -f logs/email_parser_*.log
   ```

2. **Verify Store writes:**
   ```python
   from src.mission_agents.memory.store import MissionStore
   store = MissionStore(config)
   classifications = store.get_all_iab_classifications("user_123")
   print(f"Found {len(classifications)} classifications")
   ```

3. **Test LangGraph Studio manually:**
   ```bash
   langgraph dev
   # Navigate to http://127.0.0.1:2024
   ```

4. **Check dashboard queries:**
   ```bash
   cd dashboard/backend
   python app.py
   curl http://localhost:5000/api/profile/user_123
   ```

5. **Run email parser in isolation:**
   ```bash
   python -m src.email_parser.main --pull 10 --model openai
   ```

---

### Summary

**Integration testing is MANDATORY, not optional.**

- Create integration tests for EVERY new feature
- Run full integration suite before EVERY commit
- Verify email_parser still works
- Check dashboard queries work
- Confirm LangGraph Studio works
- Benchmark performance (no regressions)

**See:** [docs/reference/LEGACY_CODE_INTEGRATION.md](docs/reference/LEGACY_CODE_INTEGRATION.md) for comprehensive integration patterns.

---

## Phase 3: Agent Layer Testing

### What to Test

Phase 3 implements Mission Agents (Shopping, Travel, Restaurant, etc.):
- LangGraph workflow state management
- Node implementations
- Trigger handling
- Mission Card creation

### Unit Tests

**Test File**: `tests/mission_agents/agents/shopping/test_shopping_agent.py`

```python
class TestShoppingAgentNodes:
    """Test Shopping Agent individual nodes"""

    def test_execute_node(self):
        """Test execute node calls shopping API"""
        from src.mission_agents.agents.shopping.nodes import execute_node
        from src.mission_agents.agents.shopping.state import ShoppingState

        state = ShoppingState(
            mission_goal="Find laptop deals",
            user_id="user_123",
            thread_id="thread_456",
            iab_classifications=[{"taxonomy_id": "IAB18-1", "confidence": 0.85}],
            user_preferences={"budget": 1000},
            api_results=[],
            filtered_results=[],
            current_step="execute"
        )

        result = execute_node(state)

        assert "api_results" in result
        assert isinstance(result["api_results"], list)
        assert result["current_step"] == "filter"

    def test_filter_node(self):
        """Test filter node applies preferences"""
        from src.mission_agents.agents.shopping.nodes import filter_node

        state = ShoppingState(
            api_results=[
                {"product": "Laptop 1", "price": 800},
                {"product": "Laptop 2", "price": 1200},  # Over budget
            ],
            user_preferences={"budget": 1000},
            filtered_results=[],
            current_step="filter"
        )

        result = filter_node(state)

        assert len(result["filtered_results"]) == 1
        assert result["filtered_results"][0]["price"] <= 1000

    def test_present_node_creates_mission_card(self):
        """Test present node creates valid MissionCard"""
        from src.mission_agents.agents.shopping.nodes import present_node

        state = ShoppingState(
            user_id="user_123",
            thread_id="thread_456",
            iab_classifications=[{"taxonomy_id": "IAB18-1", "confidence": 0.85}],
            filtered_results=[{"product": "Laptop", "price": 800}],
            selected_result={"product": "Laptop", "price": 800},
            current_step="present"
        )

        result = present_node(state)

        assert "mission_card" in result
        card = result["mission_card"]
        assert card["trigger_type"] == "iab_profile_change"
        assert "memory_context" in card
        assert card["memory_context"]["iab_classifications"] is not None
```

### Integration Tests

**Test File**: `tests/mission_agents/agents/test_agent_orchestrator.py`

```python
class TestMissionOrchestrator:
    """Test Mission Orchestrator routing"""

    def test_iab_trigger_routes_to_correct_agent(self):
        """Test IAB classification triggers correct agent"""
        from src.mission_agents.orchestrator import MissionOrchestrator
        from src.mission_agents.triggers.memory_change import TriggerEvent

        orchestrator = MissionOrchestrator(store=store)

        # Trigger for Shopping (IAB18)
        event = TriggerEvent(
            type=TriggerType.IAB_PROFILE_CHANGE,
            user_id="user_123",
            timestamp=datetime.now(),
            data={"taxonomy_id": "IAB18-1", "confidence": 0.85}
        )

        result = orchestrator.process_trigger(event)

        assert result is True  # Mission created
        # Verify Shopping agent was called (check logs or Store)

    def test_user_request_creates_mission(self):
        """Test user-initiated mission creation"""
        event = TriggerEvent(
            type=TriggerType.USER_REQUEST,
            user_id="user_123",
            timestamp=datetime.now(),
            mission_type="shopping",
            data={"goal": "Find running shoes"}
        )

        result = orchestrator.process_trigger(event)
        assert result is True
```

### LangGraph Studio Testing

**Manual Testing with Studio:**

```bash
# Start Studio
langgraph dev

# Navigate to http://127.0.0.1:2024

# Test workflow:
1. Load test state with IAB trigger
2. Step through each node
3. Inspect state at each step
4. Verify Mission Card created with correct provenance
5. Verify memory context included
```

**What to verify in Studio:**
- ✅ All nodes execute in correct order
- ✅ State updates correctly at each node
- ✅ Errors are handled gracefully
- ✅ Checkpointer saves state correctly

---

## Phase 4: API Layer Testing

### What to Test

Phase 4 implements REST API endpoints:
- Authentication middleware
- Mission CRUD endpoints
- Wallet endpoints
- Profile endpoints

### Unit Tests

**Test File**: `tests/api/test_mission_endpoints.py`

```python
class TestMissionEndpoints:
    """Test mission API endpoints"""

    def test_get_missions_for_user(self):
        """Test GET /missions/{user_id}"""
        from src.api.routes.missions import get_missions

        response = client.get(
            "/missions/user_123",
            headers={"Authorization": f"Bearer {test_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "missions" in data
        assert isinstance(data["missions"], list)

    def test_submit_mission_feedback(self):
        """Test POST /missions/{mission_id}/feedback"""
        feedback = {
            "rating": 5,
            "feedback_type": "accepted",
            "comments": "Great recommendation!"
        }

        response = client.post(
            "/missions/mission_123/feedback",
            json=feedback,
            headers={"Authorization": f"Bearer {test_token}"}
        )

        assert response.status_code == 200

    def test_unauthorized_access_blocked(self):
        """Test endpoints require authentication"""
        response = client.get("/missions/user_123")
        # No Authorization header
        assert response.status_code == 401
```

### Integration Tests

**Test File**: `tests/api/test_api_integration.py`

```python
class TestAPIIntegration:
    """Test API integrates with Mission Agents"""

    def test_create_mission_via_api(self):
        """Test mission creation through API"""
        payload = {
            "user_id": "user_123",
            "mission_type": "shopping",
            "goal": "Find laptop deals"
        }

        response = client.post(
            "/missions/create",
            json=payload,
            headers={"Authorization": f"Bearer {test_token}"}
        )

        assert response.status_code == 201
        mission_id = response.json()["mission_id"]

        # Verify mission in Store
        missions = store.get_missions(user_id="user_123")
        assert any(m["mission_id"] == mission_id for m in missions)
```

---

## Phase 5: Frontend Testing with Playwright MCP

### Playwright MCP Setup

**Install Playwright MCP:**

```bash
# Install MCP server for Playwright
npm install -g @modelcontextprotocol/server-playwright
```

**Configure in `.claude/mcp-config.json`:**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

### Frontend Testing Strategy

**ALL frontend testing MUST use Playwright MCP tools:**

**Available MCP Tools:**
- `mcp__playwright__browser_navigate` - Navigate to URL
- `mcp__playwright__browser_snapshot` - Take screenshot
- `mcp__playwright__browser_click` - Click element
- `mcp__playwright__browser_type` - Type text
- `mcp__playwright__browser_wait_for` - Wait for element
- `mcp__playwright__browser_evaluate` - Execute JavaScript
- `mcp__playwright__browser_console_messages` - Read console logs

### Dashboard Testing Examples

**Test File**: `tests/dashboard/test_dashboard_ui.py`

```python
# For AI assistant (Claude Code) using Playwright MCP:

class TestDashboardUI:
    """Test dashboard UI using Playwright MCP"""

    async def test_login_flow(self):
        """Test wallet login flow"""
        # AI assistant uses: mcp__playwright__browser_navigate
        # Navigate to http://localhost:3000

        # AI assistant uses: mcp__playwright__browser_click
        # Click "Connect Wallet" button

        # AI assistant uses: mcp__playwright__browser_wait_for
        # Wait for wallet modal to appear

        # AI assistant uses: mcp__playwright__browser_snapshot
        # Take screenshot for verification

    async def test_mission_card_display(self):
        """Test mission cards display correctly"""
        # Navigate to dashboard
        # Verify mission cards render
        # Take screenshot
        # Verify card data matches API response

    async def test_mission_feedback_submission(self):
        """Test submitting mission feedback"""
        # Click mission card
        # Click feedback button
        # Select rating
        # Submit feedback
        # Verify feedback saved

    async def test_console_errors(self):
        """Verify no console errors on dashboard"""
        # Navigate to dashboard
        # Use mcp__playwright__browser_console_messages
        # Assert no errors in console
```

**Manual Testing with Playwright MCP:**

When I (Claude Code) test frontend:

```
1. User says: "Test the dashboard login flow"

2. I respond: "I'll use Playwright MCP to test the login flow"

3. I use tools:
   - mcp__playwright__browser_navigate to http://localhost:3000
   - mcp__playwright__browser_snapshot to capture initial state
   - mcp__playwright__browser_click on "Connect Wallet"
   - mcp__playwright__browser_wait_for wallet modal
   - mcp__playwright__browser_snapshot to verify modal appeared
   - mcp__playwright__browser_console_messages to check for errors

4. I report results: "Login flow works correctly, no console errors"
```

---

## Continuous Testing Discipline

### AI Assistant (Claude Code) Testing Workflow

**When implementing ANY feature, I MUST:**

1. **Before writing implementation:**
   - Write failing test (RED phase)
   - Run test and verify it FAILS
   - Show user the test failure

2. **After writing minimal implementation:**
   - Run test and verify it PASSES
   - Show user the test success
   - Mark implementation todo as complete ONLY after test passes

3. **After refactoring:**
   - Run test again
   - Verify it still PASSES
   - Show user the test still passes

4. **Before committing:**
   - Run full test suite
   - Run type checking (mypy)
   - Run linting (flake8)
   - Show user all checks pass

5. **Before claiming "done":**
   - Use `superpowers:verification-before-completion` skill
   - Run pytest with coverage
   - Verify coverage meets requirements (>70%)
   - Show user coverage report

### Testing TodoWrite Integration

**EVERY feature implementation MUST include test todos:**

```python
todos = [
    {"content": "Write test for shopping agent (RED)", "status": "pending"},
    {"content": "Run test - verify FAILS", "status": "pending"},
    {"content": "Implement shopping agent (GREEN)", "status": "pending"},
    {"content": "Run test - verify PASSES", "status": "pending"},
    {"content": "Refactor shopping agent code", "status": "pending"},
    {"content": "Run test - verify still PASSES", "status": "pending"},
    {"content": "Run full test suite", "status": "pending"},
    {"content": "Check coverage >70%", "status": "pending"},
]
```

### Never Skip Testing

**NEVER:**
- Mark implementation complete without running tests
- Commit without running full test suite
- Create PR without coverage check
- Claim "done" without using verification-before-completion skill

**ALWAYS:**
- Run tests at EVERY checkpoint
- Show test results to user
- Include test status in TodoWrite
- Use Playwright MCP for frontend testing

---

## Testing Commands Reference

### Python Backend Tests

```bash
# Run all tests
pytest -v

# Run specific test file
pytest tests/mission_agents/agents/test_shopping_agent.py -v

# Run specific test
pytest tests/mission_agents/agents/test_shopping_agent.py::test_execute_node -v

# Run with coverage
pytest --cov=src --cov-report=html --cov-report=term-missing

# Run only unit tests
pytest tests/unit/ -v

# Run only integration tests
pytest tests/integration/ -v

# Run type checking
mypy src/

# Run linting
flake8 src/ tests/
black --check src/ tests/
```

### Frontend Tests (via Playwright MCP)

```bash
# Start dashboard for testing
cd dashboard/frontend && npm run dev
cd dashboard/backend && python app.py

# AI assistant uses Playwright MCP tools to:
# - Navigate pages
# - Click elements
# - Verify UI behavior
# - Check console for errors
```

### LangGraph Studio

```bash
# Start Studio for visual debugging
langgraph dev

# Access at http://127.0.0.1:2024
# Manually test workflows visually
```

---

## Testing Checklist Templates

### Feature Implementation Checklist

Before claiming ANY feature complete:

- [ ] Test written (RED phase)
- [ ] Test fails before implementation
- [ ] Minimal implementation created (GREEN phase)
- [ ] Test passes after implementation
- [ ] Code refactored (REFACTOR phase)
- [ ] Test still passes after refactor
- [ ] Full test suite passes
- [ ] Type checking passes (mypy)
- [ ] Linting passes (flake8, black)
- [ ] Coverage >70% for new code
- [ ] Integration test added
- [ ] Documentation updated
- [ ] Frontend tested via Playwright MCP (if applicable)

### Phase Completion Checklist

Before declaring phase complete:

- [ ] All unit tests passing (100%)
- [ ] All integration tests passing (100%)
- [ ] Coverage >80% for utilities
- [ ] Coverage >70% for business logic
- [ ] No regressions in existing tests
- [ ] Performance benchmarks met
- [ ] Manual verification checklist completed
- [ ] LangGraph Studio testing done (for agent phases)
- [ ] Frontend testing via Playwright MCP (for UI phases)
- [ ] Documentation updated
- [ ] All todos marked complete

---

## Integration with Superpowers Skills

### Use These Skills for Testing

**During development:**
- `superpowers:test-driven-development` - Enforce TDD discipline
- `superpowers:systematic-debugging` - Debug test failures

**Before claiming done:**
- `superpowers:verification-before-completion` - Run all checks before claiming complete

**For code quality:**
- `git-workflow-discipline` - Includes testing checkpoints

---

## Success Metrics

### Phase Completion Requires

✅ 100% unit tests passing
✅ 100% integration tests passing
✅ >80% coverage for utilities
✅ >70% coverage for business logic
✅ No console errors in frontend (verified via Playwright MCP)
✅ All manual verification checklists completed
✅ LangGraph Studio validation (for agent phases)
✅ Performance benchmarks met
✅ No regressions in existing test suite

---

**Remember**: Test at EVERY checkpoint, not just before commits. Use TDD (RED-GREEN-REFACTOR) for ALL code. Use Playwright MCP for ALL frontend testing. Never claim "done" without running `superpowers:verification-before-completion`.

**Document Version**: 1.0 (OwnYou Mission Agents Architecture)
**Last Updated**: 2025-01-05
**Next Review**: Before starting Phase 1 implementation
