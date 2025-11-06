---
name: testing-discipline
description: Enforce Test-Driven Development (TDD) and continuous testing discipline for OwnYou. Use when implementing ANY feature, before marking todos complete, or when user asks "have you tested this". Prevents untested code from being committed. Integrates with Playwright MCP for frontend testing.
---

# Testing Discipline

**MANDATORY testing workflow for ALL OwnYou development.**

## When to Use This Skill

- **Implementing ANY feature** (backend or frontend)
- **Before marking implementation todo as complete**
- **When user asks "have you tested this?"**
- **Before committing code**
- **Before creating PR**
- **When user says "start Phase X"** (testing is part of every phase)

## Why This Skill Exists

**Problem:** Code gets marked complete without testing:
- Tests written after implementation (not before)
- "Test passes" but never ran RED phase
- Frontend changes without Playwright MCP testing
- Todos marked complete without running tests
- PRs created without coverage checks

**Solution:** This skill enforces discipline through:
1. RED-GREEN-REFACTOR mandatory cycle
2. Test-first TodoWrite integration
3. Playwright MCP for all frontend testing
4. Verification before marking complete

## The RED-GREEN-REFACTOR Cycle

### Step 1: Write Failing Test (RED)

**BEFORE writing ANY implementation code:**

```python
# Step 1: Write test that describes desired behavior
def test_shopping_agent_creates_card_from_iab_trigger():
    """Test shopping agent creates card when IAB confidence >= 0.75"""
    agent = ShoppingAgent(config)
    store = MissionStore(config)

    trigger = TriggerEvent(
        type=TriggerType.IAB_PROFILE_CHANGE,
        user_id="user_123",
        data={"taxonomy_id": "IAB18-1", "confidence": 0.85"}
    )

    card = agent.evaluate(trigger, store)

    # These assertions should FAIL (not implemented yet)
    assert card is not None
    assert card.card_type == "savings_shopping"
    assert card.trigger_type == TriggerType.IAB_PROFILE_CHANGE
```

**Run test - it MUST FAIL:**

```bash
pytest tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card_from_iab_trigger -v
```

**Expected output:**
```
FAILED tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card_from_iab_trigger
  AttributeError: 'ShoppingAgent' object has no attribute 'evaluate'
```

**Decision Tree:**

```
Did the test FAIL?
├─ NO → STOP. Test is wrong. Fix test before proceeding.
└─ YES → Proceed to GREEN phase.
```

**Why RED matters:** If test passes before implementation, you're testing the wrong thing.

### Step 2: Implement Minimal Code (GREEN)

**Write MINIMAL code to make test pass:**

```python
class ShoppingAgent(BaseAgent):
    def evaluate(self, trigger: TriggerEvent, store: MissionStore) -> Optional[MissionCard]:
        """Minimal implementation to pass test"""
        if trigger.data["confidence"] >= 0.75:
            return MissionCard(
                mission_id=f"mission_{uuid.uuid4().hex[:8]}",
                user_id=trigger.user_id,
                thread_id="",
                card_type="savings_shopping",
                agent_type="shopping_agent",
                category=CardCategory.SAVINGS,
                complexity_level=1,
                state=MissionState.ACTIVE,
                trigger_type=trigger.type,
                trigger_details=trigger.data,
                memory_context={"iab_classifications": []},
                card_data={}
            )
        return None
```

**Run test - it MUST PASS:**

```bash
pytest tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card_from_iab_trigger -v
```

**Expected output:**
```
PASSED tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card_from_iab_trigger
```

**Decision Tree:**

```
Did the test PASS?
├─ NO → Debug and fix implementation until it passes.
└─ YES → Proceed to REFACTOR phase.
```

### Step 3: Refactor (REFACTOR)

**Improve code quality WITHOUT changing behavior:**

```python
class ShoppingAgent(BaseAgent):
    MIN_CONFIDENCE = 0.75

    def evaluate(self, trigger: TriggerEvent, store: MissionStore) -> Optional[MissionCard]:
        """Evaluate if trigger should create shopping mission"""
        if not self._meets_confidence_threshold(trigger):
            return None

        return self._create_shopping_card(trigger, store)

    def _meets_confidence_threshold(self, trigger: TriggerEvent) -> bool:
        """Check if trigger confidence meets minimum threshold"""
        return trigger.data.get("confidence", 0) >= self.MIN_CONFIDENCE

    def _create_shopping_card(self, trigger: TriggerEvent, store: MissionStore) -> MissionCard:
        """Create shopping mission card from trigger"""
        return MissionCard(
            mission_id=self._generate_mission_id(),
            user_id=trigger.user_id,
            thread_id=self._generate_thread_id(trigger),
            card_type="savings_shopping",
            agent_type="shopping_agent",
            category=CardCategory.SAVINGS,
            complexity_level=1,
            state=MissionState.ACTIVE,
            trigger_type=trigger.type,
            trigger_details=trigger.data,
            memory_context=self._build_memory_context(trigger, store),
            card_data=self._build_card_data(trigger, store)
        )
```

**Run test AGAIN - it MUST STILL PASS:**

```bash
pytest tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card_from_iab_trigger -v
```

**Expected output:**
```
PASSED tests/mission_agents/agents/test_shopping_agent.py::test_shopping_agent_creates_card_from_iab_trigger
```

**Decision Tree:**

```
Did the test still PASS after refactoring?
├─ NO → Refactoring broke behavior. Revert and try again.
└─ YES → RED-GREEN-REFACTOR cycle complete!
```

## Frontend Testing with Playwright MCP

**For ALL frontend changes, use Playwright MCP tools:**

### Available MCP Tools

```
mcp__playwright__browser_navigate    - Navigate to URL
mcp__playwright__browser_snapshot    - Take screenshot
mcp__playwright__browser_click       - Click element
mcp__playwright__browser_type        - Type text
mcp__playwright__browser_wait_for    - Wait for element
mcp__playwright__browser_evaluate    - Execute JavaScript
mcp__playwright__browser_console_messages - Read console logs
mcp__playwright__browser_press_key   - Press keyboard key
```

### Frontend Testing Example

**When testing dashboard mission card display:**

```
1. Navigate to dashboard
   Tool: mcp__playwright__browser_navigate
   URL: http://localhost:3000

2. Take initial screenshot
   Tool: mcp__playwright__browser_snapshot

3. Wait for mission cards to load
   Tool: mcp__playwright__browser_wait_for
   Selector: .mission-card

4. Click first mission card
   Tool: mcp__playwright__browser_click
   Selector: .mission-card:first-child

5. Verify card details displayed
   Tool: mcp__playwright__browser_snapshot

6. Check for console errors
   Tool: mcp__playwright__browser_console_messages
   Assert: No errors present
```

### Frontend Test TodoWrite

```python
todos = [
    {"content": "Start frontend dev server", "status": "pending"},
    {"content": "Navigate to dashboard (Playwright MCP)", "status": "pending"},
    {"content": "Verify mission cards render", "status": "pending"},
    {"content": "Test card click interaction", "status": "pending"},
    {"content": "Check console for errors", "status": "pending"},
    {"content": "Take screenshots for verification", "status": "pending"},
]
```

## TodoWrite Integration

**EVERY implementation MUST include test todos:**

### Backend Feature Example

```python
todos = [
    # RED phase
    {"content": "Write test for shopping agent (RED)", "status": "in_progress"},
    {"content": "Run test - verify FAILS", "status": "pending"},

    # GREEN phase
    {"content": "Implement shopping agent (GREEN)", "status": "pending"},
    {"content": "Run test - verify PASSES", "status": "pending"},

    # REFACTOR phase
    {"content": "Refactor shopping agent code", "status": "pending"},
    {"content": "Run test - verify still PASSES", "status": "pending"},

    # Final verification
    {"content": "Run full test suite", "status": "pending"},
    {"content": "Check coverage >70%", "status": "pending"},
    {"content": "Run type checking (mypy)", "status": "pending"},
    {"content": "Run linting (flake8)", "status": "pending"},
]
```

### Frontend Feature Example

```python
todos = [
    {"content": "Write component test", "status": "pending"},
    {"content": "Implement mission card component", "status": "pending"},
    {"content": "Test rendering with Playwright MCP", "status": "pending"},
    {"content": "Test interactions with Playwright MCP", "status": "pending"},
    {"content": "Verify no console errors", "status": "pending"},
    {"content": "Take screenshots for review", "status": "pending"},
]
```

## Testing Checkpoints

**Test at THESE specific moments:**

1. **After writing test** → Verify test FAILS (RED)
2. **After minimal implementation** → Verify test PASSES (GREEN)
3. **After refactoring** → Verify test still PASSES (REFACTOR)
4. **Before marking todo complete** → Run test for that feature
5. **Before committing** → Run full test suite
6. **Before creating PR** → Run coverage check

## Never Mark Complete Without Testing

**NEVER:**

```python
# ❌ WRONG
todos = [
    {"content": "Implement shopping agent", "status": "completed"},  # Did you run the test???
]
```

**ALWAYS:**

```python
# ✅ CORRECT
todos = [
    {"content": "Write test for shopping agent (RED)", "status": "completed"},
    {"content": "Run test - FAILED as expected", "status": "completed"},
    {"content": "Implement shopping agent (GREEN)", "status": "completed"},
    {"content": "Run test - PASSED", "status": "completed"},
    {"content": "Refactor code", "status": "completed"},
    {"content": "Run test - still PASSED", "status": "completed"},
]
```

## Commands to Run

### Backend Tests

```bash
# Run specific test
pytest tests/path/to/test_file.py::test_name -v

# Run test file
pytest tests/path/to/test_file.py -v

# Run with coverage
pytest --cov=src --cov-report=term-missing

# Type checking
mypy src/

# Linting
flake8 src/ tests/
black --check src/ tests/
```

### Frontend Tests (Playwright MCP)

**Start servers first:**

```bash
# Terminal 1: Frontend
cd dashboard/frontend && npm run dev

# Terminal 2: Backend
cd dashboard/backend && python app.py
```

**Then use Playwright MCP tools to test**

## Integration with Superpowers

**Use these skills during testing:**

- `superpowers:test-driven-development` - Full TDD guidance
- `superpowers:verification-before-completion` - Before claiming done
- `superpowers:systematic-debugging` - When tests fail

## AI Assistant Workflow

**When I (Claude Code) implement a feature:**

1. **Before writing code:**
   ```
   User: "Implement shopping agent"
   Me: "I'll use TDD. First, I'll write a failing test."

   [I write test]
   [I run test - shows FAILED output]
   [I show user the failure]
   ```

2. **After minimal implementation:**
   ```
   Me: "Minimal implementation done. Running test..."

   [I run test - shows PASSED output]
   [I show user the success]
   [I mark "Run test - PASSED" as complete in TodoWrite]
   ```

3. **After refactoring:**
   ```
   Me: "Refactored code. Verifying test still passes..."

   [I run test - shows PASSED output]
   [I show user test still passes]
   ```

4. **Before marking implementation complete:**
   ```
   Me: "Running full test suite before marking complete..."

   [I run pytest --cov=src]
   [I show user coverage report]
   [ONLY NOW do I mark "Implement shopping agent" as complete]
   ```

## Decision Trees

### Can I Mark Implementation Complete?

```
Have I run the test for this feature?
├─ NO → STOP. Run test first.
└─ YES → Did the test PASS?
           ├─ NO → STOP. Fix until test passes.
           └─ YES → Mark complete.
```

### Can I Commit Code?

```
Have I run the full test suite?
├─ NO → STOP. Run pytest first.
└─ YES → Did all tests PASS?
           ├─ NO → STOP. Fix failures first.
           └─ YES → Have I checked coverage?
                      ├─ NO → STOP. Run coverage check.
                      └─ YES → Is coverage >70%?
                                 ├─ NO → STOP. Add tests.
                                 └─ YES → OK to commit.
```

### Can I Create PR?

```
Did I run verification-before-completion skill?
├─ NO → STOP. Use the skill first.
└─ YES → Did all checks pass?
           ├─ NO → STOP. Fix issues.
           └─ YES → OK to create PR.
```

## Common Mistakes

**❌ Don't:**
- Skip RED phase (test passes immediately)
- Mark implementation complete without running test
- Commit without running full test suite
- Test frontend without Playwright MCP
- Create PR without coverage check
- Claim "done" without verification

**✅ Do:**
- Always start with failing test (RED)
- Run test at every checkpoint
- Use Playwright MCP for ALL frontend testing
- Show user test results
- Use TodoWrite to track test status
- Run full suite before committing

## Validation Checklist

Before marking ANY feature complete:

- [ ] Test written (RED phase)
- [ ] Test failed before implementation
- [ ] Minimal implementation created (GREEN)
- [ ] Test passed after implementation
- [ ] Code refactored (REFACTOR)
- [ ] Test still passes after refactor
- [ ] Full test suite passes
- [ ] Coverage >70% for new code
- [ ] Type checking passes (mypy)
- [ ] Linting passes (flake8)
- [ ] Frontend tested via Playwright MCP (if applicable)
- [ ] Console has no errors (if frontend)

## Reference

- **Testing Plan**: `docs/development/TESTING_PLAN.md`
- **Development Guidelines**: `docs/reference/DEVELOPMENT_GUIDELINES.md`
- **Superpowers Skills**:
  - `superpowers:test-driven-development`
  - `superpowers:verification-before-completion`
  - `superpowers:systematic-debugging`
