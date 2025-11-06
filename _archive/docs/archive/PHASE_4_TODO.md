# Phase 4: LLM Integration - Complete Guide

**Phase Goal**: Replace analyzer stubs with actual LLM implementations for intelligent email analysis and taxonomy classification.

**Status**: Ready to Start | Estimated: ~3 days (~23.5 hours)

**Reference Documents**:
- [IAB_TAXONOMY_PROFILE_REQUIREMENTS.md](./IAB_TAXONOMY_PROFILE_REQUIREMENTS.md) - LLM integration requirements
- [PHASE_3_COMPLETE.md](./PHASE_3_COMPLETE.md) - Current workflow implementation
- [BEST_PRACTICES.md](./BEST_PRACTICES.md) - LLM prompting guidelines

**Dependencies Met**:
- ✅ Phase 1: IAB Taxonomy Loading (Complete)
- ✅ Phase 2: Memory System (Complete)
- ✅ Phase 3: LangGraph Workflow (Complete)
- ✅ LLM Clients Available (`src/email_parser/llm_clients/`)
- ✅ Test Infrastructure Ready (148 tests passing)

---

## 🚀 Quick Start (TL;DR)

**Day 1**: Get first analyzer working
```bash
# 1. Create prompts module
mkdir -p src/email_parser/workflow/prompts
# 2. Follow Task 1 below for templates
# 3. Follow Task 2 for LLM wrapper
# 4. Follow Task 3 to update demographics analyzer
# ✅ First analyzer working!
```

**Day 2**: Copy pattern to remaining analyzers (Tasks 4-6)

**Day 3**: Test, optimize, document (Tasks 10-11)

---

## Phase 4 Overview

**Objective**: Integrate LLM models into the analyzer nodes to perform intelligent email analysis and generate accurate IAB Taxonomy classifications.

**Current State**: Phase 3 implemented analyzer stubs that return placeholder taxonomy selections. These stubs are in `src/email_parser/workflow/nodes/analyzers.py`.

**Target State**: Each analyzer uses LLM calls to:
1. Analyze email content (subject + body)
2. Identify relevant IAB Taxonomy categories
3. Generate confidence scores
4. Provide reasoning for classifications
5. Return structured taxonomy selections

**LLM Providers to Support**:
- Claude (Sonnet 4) - Premium quality
- OpenAI (GPT-4) - Balanced performance
- Ollama (DeepSeek, Llama) - Local/privacy-focused

---

## Architecture

### LLM Integration Pattern

```python
def demographics_analyzer_node(state: WorkflowState) -> WorkflowState:
    """Analyze email for demographic signals using LLM."""

    # 1. Get current email
    email = get_current_email(state)

    # 2. Prepare LLM prompt with taxonomy context
    prompt = prepare_demographics_prompt(email, taxonomy_context)

    # 3. Call LLM with structured output request
    llm_response = llm_client.generate(prompt, response_format="json")

    # 4. Parse and validate response
    taxonomy_selections = parse_llm_response(llm_response)

    # 5. Update state
    state["demographics_results"].extend(taxonomy_selections)

    return state
```

### Prompt Engineering Strategy

Each analyzer will have a specialized prompt that:
- Includes relevant IAB Taxonomy categories
- Provides examples of good classifications
- Requests structured JSON output
- Asks for confidence scores and reasoning
- Handles edge cases (no signal, ambiguous content)

---

## Tasks

### ☐ Task 1: Design LLM Prompt Templates
**Status**: Pending
**Estimated Time**: 3 hours
**Priority**: High

**Subtasks**:
- [ ] Create `src/email_parser/workflow/prompts/` directory
- [ ] Design demographics prompt template
- [ ] Design household prompt template
- [ ] Design interests prompt template
- [ ] Design purchase prompt template
- [ ] Include taxonomy context in prompts
- [ ] Define JSON output schema
- [ ] Add few-shot examples
- [ ] Test prompts with sample emails

**Success Criteria**:
- Prompts produce consistent, accurate classifications
- JSON output is well-structured and parsable
- Confidence scores are reasonable (0.6-0.95 range)
- Reasoning explanations are clear and helpful
- Handles ambiguous/empty content gracefully

**Implementation**:

Create `src/email_parser/workflow/prompts/__init__.py`:

```python
"""
LLM Prompt Templates for Analyzers
"""

DEMOGRAPHICS_PROMPT_TEMPLATE = """
You are an expert at analyzing email content to identify demographic characteristics about the recipient.

## Task
Analyze the following email and identify demographic signals using the IAB Audience Taxonomy.

## Email Content
Subject: {subject}
Body: {body}

## Relevant Taxonomy Categories
{taxonomy_categories}

## Instructions
1. Carefully analyze the email for demographic signals
2. Only classify if you have reasonable confidence (≥0.6)
3. Be conservative with confidence scores
4. Provide specific reasoning based on email content
5. Return empty classifications array if no signals found

## Output Format
Return ONLY a JSON object (no markdown, no additional text):
{{
  "classifications": [
    {{
      "taxonomy_id": 5,
      "value": "25-29",
      "confidence": 0.75,
      "reasoning": "Brief explanation based on email content"
    }}
  ]
}}

## Important Guidelines
- Confidence scores: 0.6 (low), 0.7-0.8 (medium), 0.9-0.95 (high)
- Never exceed 0.95 confidence
- Only include taxonomy_id, value, confidence, reasoning
- Be specific in reasoning (reference actual email content)
- If uncertain, don't classify
"""

# Similar templates for household, interests, purchase...
```

**Prompt Structure (Original Documentation)**:
```python
DEMOGRAPHICS_PROMPT = """
You are an expert at analyzing email content to identify demographic signals about the recipient.

## Task
Analyze the following email and identify demographic characteristics using the IAB Audience Taxonomy.

## Email Content
Subject: {subject}
Body: {body}

## Relevant Taxonomy Categories
{taxonomy_categories}

## Instructions
1. Identify demographic signals (age, gender, education, etc.)
2. Select appropriate taxonomy categories
3. Assign confidence scores (0.6-0.95)
4. Provide reasoning for each classification

## Output Format (JSON)
{{
  "classifications": [
    {{
      "taxonomy_id": 5,
      "value": "25-29",
      "confidence": 0.75,
      "category_path": "Demographic | Age Range | 25-29",
      "reasoning": "Email mentions college graduation 3 years ago"
    }}
  ]
}}

## Important
- Only classify if you have reasonable confidence (>=0.6)
- Be conservative with confidence scores
- Provide specific reasoning based on email content
- Return empty list if no demographic signals found
"""
```

---

### ☐ Task 2: Implement LLM Client Wrapper
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: High

**Subtasks**:
- [ ] Create `src/email_parser/workflow/llm_wrapper.py`
- [ ] Implement unified interface for all LLM providers
- [ ] Add retry logic with exponential backoff
- [ ] Implement rate limiting
- [ ] Add response caching (optional)
- [ ] Handle timeouts gracefully
- [ ] Log all LLM calls
- [ ] Add cost tracking

**Success Criteria**:
- Single interface works with Claude, OpenAI, Ollama
- Automatic retries on failures
- Rate limiting prevents API throttling
- Comprehensive error handling
- Logging for debugging

**Wrapper Interface**:
```python
class AnalyzerLLMClient:
    """Unified LLM client for analyzer nodes."""

    def __init__(self, provider: str = "claude", model: str = None):
        """Initialize LLM client.

        Args:
            provider: "claude", "openai", or "ollama"
            model: Specific model name (optional)
        """

    def analyze_email(
        self,
        email: Dict[str, Any],
        prompt_template: str,
        taxonomy_context: str,
        max_tokens: int = 1000
    ) -> Dict[str, Any]:
        """Analyze email using LLM.

        Returns:
            Structured JSON response with classifications
        """
```

---

### ☐ Task 3: Implement Demographics Analyzer
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: High

**Subtasks**:
- [ ] Update `demographics_analyzer_node()` in analyzers.py
- [ ] Load demographics taxonomy categories
- [ ] Build prompt with taxonomy context
- [ ] Call LLM via wrapper
- [ ] Parse and validate response
- [ ] Handle errors and fallbacks
- [ ] Add comprehensive logging
- [ ] Write unit tests with mocked LLM

**Success Criteria**:
- Accurately identifies age, gender, education, etc.
- Returns valid taxonomy selections
- Handles missing data gracefully
- Unit tests pass with mocked LLM responses
- Integration with Phase 3 workflow works

---

### ☐ Task 4: Implement Household Analyzer
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: High

**Subtasks**:
- [ ] Update `household_analyzer_node()` in analyzers.py
- [ ] Load household taxonomy categories
- [ ] Build prompt with taxonomy context
- [ ] Call LLM via wrapper
- [ ] Parse and validate response
- [ ] Handle errors and fallbacks
- [ ] Add comprehensive logging
- [ ] Write unit tests with mocked LLM

**Success Criteria**:
- Identifies location, income, property type, etc.
- Extracts signals from bills and service emails
- Returns valid taxonomy selections
- Unit tests pass

---

### ☐ Task 5: Implement Interests Analyzer
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: High

**Subtasks**:
- [ ] Update `interests_analyzer_node()` in analyzers.py
- [ ] Load interests taxonomy categories
- [ ] Build prompt with taxonomy context
- [ ] Call LLM via wrapper
- [ ] Parse and validate response
- [ ] Handle errors and fallbacks
- [ ] Add comprehensive logging
- [ ] Write unit tests with mocked LLM

**Success Criteria**:
- Identifies hobbies, topics, activities
- Works well with newsletters and content emails
- Returns multiple interests when appropriate
- Unit tests pass

---

### ☐ Task 6: Implement Purchase Analyzer
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: High

**Subtasks**:
- [ ] Update `purchase_analyzer_node()` in analyzers.py
- [ ] Load purchase taxonomy categories
- [ ] Build prompt with taxonomy context
- [ ] Call LLM via wrapper
- [ ] Parse and validate response
- [ ] Distinguish purchase intent vs actual purchase
- [ ] Extract product categories
- [ ] Handle errors and fallbacks
- [ ] Add comprehensive logging
- [ ] Write unit tests with mocked LLM

**Success Criteria**:
- Accurately identifies purchases vs intent
- Extracts product categories
- Calculates recency (PIPR)
- Unit tests pass

---

### ☐ Task 7: Response Parsing and Validation
**Status**: Pending
**Estimated Time**: 1.5 hours
**Priority**: Medium

**Subtasks**:
- [ ] Create `src/email_parser/workflow/response_parser.py`
- [ ] Implement JSON parsing with error handling
- [ ] Validate taxonomy IDs against loaded taxonomy
- [ ] Validate confidence scores (0.0-1.0 range)
- [ ] Validate required fields present
- [ ] Handle malformed LLM responses
- [ ] Add response sanitization
- [ ] Write validation unit tests

**Success Criteria**:
- Parses all valid LLM responses correctly
- Rejects invalid taxonomy IDs
- Handles malformed JSON gracefully
- Returns empty list on parsing errors
- Unit tests cover edge cases

---

### ☐ Task 8: Taxonomy Context Builder
**Status**: Pending
**Estimated Time**: 1 hour
**Priority**: Medium

**Subtasks**:
- [ ] Create `src/email_parser/workflow/taxonomy_context.py`
- [ ] Implement function to load relevant taxonomy for each analyzer
- [ ] Format taxonomy as prompt context
- [ ] Optimize for token efficiency
- [ ] Cache formatted taxonomy contexts
- [ ] Handle taxonomy updates

**Success Criteria**:
- Efficiently loads relevant taxonomy sections
- Formats for LLM consumption
- Minimizes token usage
- Caches for performance

**Context Format**:
```python
def get_demographics_taxonomy_context() -> str:
    """Get demographics taxonomy formatted for LLM prompt.

    Returns:
        Formatted taxonomy categories as string
    """
    # Example output:
    return """
    Age Ranges:
    - 5: 25-29 (Young Adult)
    - 6: 30-34 (Young Adult)
    - 7: 35-39 (Mid Adult)
    ...

    Gender:
    - 10: Male
    - 11: Female
    - 12: Non-binary
    ...
    """
```

---

### ☐ Task 9: Cost Tracking and Monitoring
**Status**: Pending
**Estimated Time**: 1 hour
**Priority**: Low

**Subtasks**:
- [ ] Add token counting for prompts and responses
- [ ] Track cost per email processed
- [ ] Log total API costs per session
- [ ] Add cost summary to workflow reporting
- [ ] Implement cost alerts/limits (optional)

**Success Criteria**:
- Accurate token counting
- Cost tracking per provider
- Summary in workflow reports
- Helps optimize prompt efficiency

---

### ☐ Task 10: Unit Tests with Mocked LLM
**Status**: Pending
**Estimated Time**: 3 hours
**Priority**: High

**Subtasks**:
- [ ] Create `tests/unit/test_llm_analyzers.py`
- [ ] Mock LLM responses for each analyzer
- [ ] Test successful classification scenarios
- [ ] Test empty/no signal scenarios
- [ ] Test malformed LLM responses
- [ ] Test error handling
- [ ] Test retry logic
- [ ] Test timeout handling

**Success Criteria**:
- All analyzer nodes have unit tests
- Mocked responses cover common scenarios
- Error cases handled properly
- Tests run without actual LLM calls
- 100% test pass rate

**Mock Example**:
```python
@pytest.fixture
def mock_llm_client(mocker):
    """Mock LLM client for testing."""
    mock = mocker.patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    mock.return_value.analyze_email.return_value = {
        "classifications": [
            {
                "taxonomy_id": 5,
                "value": "25-29",
                "confidence": 0.75,
                "reasoning": "Mentions college graduation 3 years ago"
            }
        ]
    }
    return mock
```

---

### ☐ Task 11: Integration Tests with Real LLM
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: Medium

**Subtasks**:
- [ ] Create `tests/integration/test_phase4_llm_integration.py`
- [ ] Test with real LLM calls (requires API keys)
- [ ] Test sample emails for each category
- [ ] Verify classification accuracy
- [ ] Test multi-provider support
- [ ] Measure performance (latency, cost)
- [ ] Document test results

**Success Criteria**:
- Integration tests pass with real LLM
- Classifications are accurate
- Performance is acceptable (<5 sec/email)
- Works with all supported providers
- Results documented

---

### ☐ Task 12: Performance Optimization
**Status**: Pending
**Estimated Time**: 2 hours
**Priority**: Low

**Subtasks**:
- [ ] Implement parallel analyzer execution (if not done)
- [ ] Add response caching for duplicate emails
- [ ] Optimize prompt length for token efficiency
- [ ] Implement batch processing (if supported by LLM)
- [ ] Add performance metrics logging
- [ ] Profile and optimize bottlenecks

**Success Criteria**:
- Reduced latency per email
- Lower API costs
- Parallel execution working
- Performance metrics tracked

---

## Phase 4 Completion Checklist

**Code Completion**:
- [ ] All 12 tasks completed
- [ ] LLM prompt templates designed
- [ ] LLM client wrapper implemented
- [ ] All 4 analyzers implemented with LLM
- [ ] Response parsing and validation working
- [ ] Taxonomy context builder functional
- [ ] Cost tracking implemented

**Testing**:
- [ ] Unit tests with mocked LLM (100%)
- [ ] Integration tests with real LLM passing
- [ ] Accuracy validation completed
- [ ] Performance benchmarks documented
- [ ] No regressions in Phase 1-3

**Documentation**:
- [ ] Prompt templates documented
- [ ] LLM integration guide written
- [ ] API cost analysis documented
- [ ] Performance benchmarks documented
- [ ] Phase 4 completion summary created

**Version Control**:
- [ ] All changes committed to git
- [ ] Descriptive commit messages
- [ ] Ready to push to GitHub
- [ ] Previous phase tests still passing

---

## Integration Points from Phase 3

### Current Stub Implementation (to be replaced)

Location: `src/email_parser/workflow/nodes/analyzers.py`

```python
def demographics_analyzer_node(state: WorkflowState) -> WorkflowState:
    """
    Phase 3: Returns placeholder data
    Phase 4: Will use LLM for actual analysis
    """
    email = get_current_email(state)

    # REPLACE THIS with LLM call
    placeholder_selection = {
        "taxonomy_id": 5,
        "section": "demographics",
        "value": "25-29",
        "confidence": 0.75,
        # ... other fields
    }

    state["demographics_results"].append(placeholder_selection)
    return state
```

### Target Phase 4 Implementation

```python
def demographics_analyzer_node(state: WorkflowState) -> WorkflowState:
    """Analyze email for demographic signals using LLM."""
    try:
        email = get_current_email(state)

        # Get LLM client
        llm_client = AnalyzerLLMClient(
            provider=state.get("llm_provider", "claude"),
            model=state.get("llm_model")
        )

        # Get taxonomy context
        taxonomy_context = get_demographics_taxonomy_context()

        # Prepare prompt
        prompt = DEMOGRAPHICS_PROMPT.format(
            subject=email.get("subject", ""),
            body=email.get("body", "")[:2000],  # Limit length
            taxonomy_categories=taxonomy_context
        )

        # Call LLM
        response = llm_client.analyze_email(
            email=email,
            prompt_template=prompt,
            taxonomy_context=taxonomy_context
        )

        # Parse and validate
        selections = parse_and_validate_response(
            response,
            section="demographics"
        )

        # Update state
        state["demographics_results"].extend(selections)

        logger.info(f"Demographics analyzer: {len(selections)} classifications")

    except Exception as e:
        logger.error(f"Demographics analyzer failed: {e}", exc_info=True)
        add_error(state, f"Demographics analysis failed: {str(e)}")

    return state
```

---

## Phase 4 Notes & Decisions

**Date**: 2025-09-30
**Status**: Not Started

### Design Decisions
- TBD during implementation

### Challenges Anticipated
- **Prompt Engineering**: Finding the right balance of context vs token usage
- **Response Consistency**: Ensuring LLMs return consistent, parsable JSON
- **Cost Management**: API costs can add up quickly with multiple providers
- **Accuracy Validation**: Determining "correct" classifications for validation
- **Performance**: LLM calls add latency (2-5 seconds each)

### Success Metrics
- TBD after implementation

---

**Current Phase**: Phase 4 (Not Started)
**Previous Phase**: [Phase 3: LangGraph Workflow](./PHASE_3_COMPLETE.md) ✓ Complete
**Next Phase**: Phase 5: Production Deployment

---

## Estimated Timeline

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Task 1: Prompt Templates | 3 hours | High |
| Task 2: LLM Wrapper | 2 hours | High |
| Task 3: Demographics Analyzer | 2 hours | High |
| Task 4: Household Analyzer | 2 hours | High |
| Task 5: Interests Analyzer | 2 hours | High |
| Task 6: Purchase Analyzer | 2 hours | High |
| Task 7: Response Parsing | 1.5 hours | Medium |
| Task 8: Taxonomy Context | 1 hour | Medium |
| Task 9: Cost Tracking | 1 hour | Low |
| Task 10: Unit Tests | 3 hours | High |
| Task 11: Integration Tests | 2 hours | Medium |
| Task 12: Optimization | 2 hours | Low |
| **Total** | **~23.5 hours** | **~3 days** |

---

## Ready to Start

**Prerequisites Met**:
- ✅ Phase 1: Taxonomy loading complete
- ✅ Phase 2: Memory system complete
- ✅ Phase 3: Workflow orchestration complete
- ✅ LLM clients already exist in `src/email_parser/llm_clients/`
- ✅ Test infrastructure in place
- ✅ All previous tests passing (148 tests)

**Next Step**: Start with Task 1 (Design LLM Prompt Templates)