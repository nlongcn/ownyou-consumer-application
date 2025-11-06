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
