# IAB Classifier Implementation Specification

**Document Version**: 1.0
**Date**: 2025-11-12
**Source**: Python implementation at `src/email_parser/`
**Status**: Production (Python), Reference for TypeScript Migration

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [LangGraph State Machine](#2-langgraph-state-machine)
3. [Batch Processing System](#3-batch-processing-system)
4. [LLM Infrastructure](#4-llm-infrastructure)
5. [IAB Analyzer Agents](#5-iab-analyzer-agents)
6. [Evidence Judge System](#6-evidence-judge-system)
7. [Taxonomy Reconciliation](#7-taxonomy-reconciliation)
8. [Memory & Store Integration](#8-memory--store-integration)
9. [Concurrency Patterns](#9-concurrency-patterns)
10. [Configuration & Error Handling](#10-configuration--error-handling)
11. [Performance Characteristics](#11-performance-characteristics)
12. [Data Structures & Types](#12-data-structures--types)
13. [Algorithms & Formulas](#13-algorithms--formulas)
14. [Critical Implementation Details](#14-critical-implementation-details)

---

## 1. Architecture Overview

### 1.1 System Purpose

The IAB Classifier analyzes user emails to extract privacy-safe demographic, household, interest, and purchase intent signals conforming to IAB Taxonomy 1.1 (1,558 entries).

### 1.2 Entry Point

**File**: `src/email_parser/main.py` (lines 380-542)

**Command**:
```bash
python -m src.email_parser.main --iab-profile --provider gmail --max-emails 50
```

**Execution Flow**:
```
main()
  ↓
EmailParser.__init__() (initialize OAuth, LLM clients)
  ↓
EmailParser.generate_iab_profile() (prepare email data)
  ↓
run_workflow() (execute LangGraph state machine)
  ↓
Return IABConsumerProfile (JSON)
```

### 1.3 Core Design Decisions

**Decision 1: Batch Processing Over Single-Email**
- **Rationale**: 20-30x performance improvement, 4x cost reduction
- **Implementation**: Dynamic batch sizing (5-50 emails per LLM call)
- **Trade-off**: +33% cost vs selective routing, but never misses signals

**Decision 2: Run ALL 4 Analyzers (No Conditional Routing)**
- **Rationale**: Regex-based routing was brittle, missed signals
- **Implementation**: `analyze_all_node()` runs all sequentially
- **Trade-off**: Slight cost increase for global reliability

**Decision 3: LLM-as-Judge for Evidence Quality**
- **Rationale**: Validate reasoning appropriateness per IAB guidelines
- **Implementation**: Parallel evidence evaluation with ThreadPoolExecutor
- **Trade-off**: Additional LLM calls, but ensures high-quality classifications

**Decision 4: Bayesian Confidence Tracking**
- **Rationale**: Accumulate confirming evidence, handle contradictions
- **Implementation**: `reconcile_evidence()` with prior/posterior updates
- **Trade-off**: Complex logic, but mathematically sound confidence

---

## 2. LangGraph State Machine

### 2.1 Graph Structure

**File**: `src/email_parser/workflow/graph.py` (lines 48-147)

**Node Flow**:
```
START
  ↓
load_emails (filter unprocessed, mark as processing)
  ↓ [conditional: has_emails?]
retrieve_profile (apply temporal decay to existing classifications)
  ↓
analyze_all (sequential execution)
  ├─ demographics_analyzer_node
  ├─ household_analyzer_node
  ├─ interests_analyzer_node
  └─ purchase_analyzer_node
  ↓
reconcile (Bayesian confidence update, merge results)
  ↓
update_memory (write to LangGraph Store)
  ↓ [conditional: continue?]
advance_email (increment batch_start, loop back)
  ↓
END
```

**Conditional Edges**:

1. **After `load_emails`**: `_check_has_emails_conditional()`
   - "has_emails" → proceed to `retrieve_profile`
   - "no_emails" → END

2. **After `update_memory`**: `_check_continuation_conditional()`
   - "continue" → `advance_email` (process next batch)
   - "end" → END (all emails processed)

### 2.2 State Schema

**File**: `src/email_parser/workflow/state.py` (lines 15-195)

**TypedDict Definition**:
```python
class WorkflowState(TypedDict):
    # User Context
    user_id: str  # REQUIRED

    # Email Data
    emails: List[Dict]  # Full email dataset
    processed_email_ids: List[str]  # Already classified
    total_emails: int

    # Batch Processing (CRITICAL for performance)
    current_batch_start: int  # Index into emails list
    batch_size: int  # Calculated dynamically by batch_optimizer
    model_context_window: int  # From model_registry.py

    # Analysis Results (per analyzer)
    demographics_results: List[Dict]
    household_results: List[Dict]
    interests_results: List[Dict]
    purchase_results: List[Dict]

    # Workflow Tracking
    current_node: str
    errors: List[str]
    warnings: List[str]

    # Output
    updated_profile: Dict  # IABConsumerProfile

    # Optional
    cost_tracker: CostTracker
    workflow_tracker: Any  # For LangGraph Studio
```

**Critical Fields**:
- `current_batch_start`: Enables incremental processing without re-analyzing
- `batch_size`: Set by `calculate_batch_size()` based on model context window
- `model_context_window`: Fetched dynamically from model registry (128K, 200K, or 1M)

### 2.3 Batch Loop Logic

**Function**: `advance_email_node()` (workflow/nodes/batch_control.py)

```python
def advance_email_node(state: WorkflowState) -> WorkflowState:
    state["current_batch_start"] += state["batch_size"]

    # Recalculate batch_size for next iteration (handles edge case)
    if state["current_batch_start"] < len(state["emails"]):
        state["batch_size"] = calculate_batch_size(
            emails=state["emails"],
            context_window=state["model_context_window"],
            start_index=state["current_batch_start"]
        )

    return state
```

**Loop Termination**: When `current_batch_start >= len(emails)`

---

## 3. Batch Processing System

### 3.1 Batch Optimizer

**File**: `src/email_parser/workflow/batch_optimizer.py` (lines 50-136)

**Core Function**:
```python
def calculate_batch_size(
    emails: List[Dict],
    context_window: int,  # e.g., 128000 for GPT-4o-mini
    start_index: int = 0,
    target_utilization: float = 0.70,  # Reserve 30% for prompt/response
    min_batch_size: int = 5,
    max_batch_size: int = 50
) -> int
```

**Algorithm**:

1. **Reserve Context for Fixed Elements**:
   ```python
   system_prompt_tokens = 2000  # Agent instructions
   taxonomy_context_tokens = 3000  # IAB taxonomy definitions
   response_buffer_tokens = 2000  # LLM output (JSON classifications)

   reserved_tokens = system_prompt_tokens + taxonomy_context_tokens + response_buffer_tokens
   # Total reserved: ~7K tokens (30% of 128K = 38.4K)
   ```

2. **Calculate Available Token Budget**:
   ```python
   available_tokens = int(context_window * target_utilization) - reserved_tokens
   # Example: 128K × 0.70 - 7K = 89.6K - 7K = 82.6K tokens
   ```

3. **Fill Batch Greedily**:
   ```python
   cumulative_tokens = 0
   batch_size = 0

   for i in range(start_index, len(emails)):
       email_tokens = estimate_email_tokens(emails[i])

       if cumulative_tokens + email_tokens > available_tokens:
           break  # Stop before exceeding limit

       cumulative_tokens += email_tokens
       batch_size += 1
   ```

4. **Enforce Bounds**:
   ```python
   return max(min_batch_size, min(batch_size, max_batch_size))
   ```

**Example Calculation**:
- Model: GPT-4o-mini (128K context)
- Reserved: 7K tokens
- Available: 82.6K tokens
- Average email: 1.5K tokens
- **Batch size**: ~55 emails (capped at `max_batch_size=50`)

### 3.2 Token Estimation

**Function**: `estimate_email_tokens()` (lines 17-32)

```python
def estimate_email_tokens(email: Dict) -> int:
    subject = email.get("subject", "")
    sender = email.get("from", "")
    body = email.get("summary") or email.get("body", "")

    total_chars = len(subject) + len(sender) + len(body)

    # Account for formatting overhead
    # "Email N:\nSubject: ...\nFrom: ...\nBody: ...\n\n"
    format_overhead = 100

    # Approximation: 4 characters ≈ 1 token
    return (total_chars + format_overhead) // 4
```

**Accuracy**: ~90% (validated against tiktoken for GPT models)

### 3.3 Performance Impact

**Scenario: 100 Emails**

| Approach | LLM Calls | Time | Cost (gpt-4o-mini) |
|----------|-----------|------|--------------------|
| Single-Email | 400 calls (100 × 4 analyzers) | 20 min | $2.00 |
| Batch (15/batch) | 28 calls (7 batches × 4 analyzers) | 2 min | $0.50 |

**Speedup**: **10x faster** (20 min → 2 min)
**Cost Reduction**: **4x cheaper** ($2.00 → $0.50)

---

## 4. LLM Infrastructure

### 4.1 Multi-Provider Architecture

**Supported Providers**:

1. **OpenAI** (`llm_clients/openai_client.py`)
   - Models: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
   - Context: 128K tokens
   - Max Output: 16,384 tokens
   - Pricing: $0.15 input / $0.60 output (per 1M tokens, gpt-4o-mini)

2. **Anthropic Claude** (`llm_clients/claude_client.py`)
   - Models: `claude-sonnet-4`, `claude-3-5-sonnet-20241022`
   - Context: 200K tokens (1M with beta header)
   - Max Output: 8,192 tokens
   - Pricing: $3.00 input / $15.00 output (per 1M tokens)

3. **Google Gemini** (`llm_clients/google_client.py`)
   - Models: `gemini-2.0-flash-exp`, `gemini-1.5-pro`
   - Context: 1M tokens
   - Max Output: 8,192 tokens
   - Pricing: Variable (Flash is cheapest)

4. **Ollama** (`llm_clients/ollama_client.py`)
   - Models: Local models (e.g., `llama2`, `mistral`)
   - Context: Model-dependent
   - Max Output: Model-dependent
   - Pricing: $0 (local inference)

### 4.2 Model Registry (Dynamic Context Windows)

**File**: `src/email_parser/llm_clients/model_registry.py` (lines 24-420)

**Purpose**: Fetch actual context window limits from provider APIs (not hardcoded)

**Key Functions**:

1. **OpenAI**:
   ```python
   def get_context_window_openai(client, model_name: str) -> int:
       # Use OpenAI API to fetch model info
       model_info = client.models.retrieve(model_name)
       return model_info.context_window  # e.g., 128000
   ```

2. **Claude**:
   ```python
   def get_context_window_claude(client, model_name: str) -> int:
       # Anthropic doesn't expose via API, use documented limits
       CLAUDE_CONTEXT_WINDOWS = {
           "claude-sonnet-4": 200000,
           "claude-3-5-sonnet": 200000
       }
       return CLAUDE_CONTEXT_WINDOWS.get(model_name, 200000)
   ```

3. **Google** (DYNAMIC):
   ```python
   def get_context_window_google(client, model_name: str) -> int:
       # Google API exposes input_token_limit
       model_info = client.models.get(model=f"models/{model_name}")
       return model_info.input_token_limit  # 1,000,000 for Gemini
   ```

**Cache Strategy**:
- Results cached for 24 hours (TTL)
- Reduces API calls
- Fallback to documented limits if API fails

**Prefix Matching**:
```python
# Handle versioned model names
if model_name.startswith("gpt-4o-2024-"):
    return get_context_window_openai(client, "gpt-4o")
```

### 4.3 AnalyzerLLMClient (Unified Wrapper)

**File**: `src/email_parser/workflow/llm_wrapper.py` (lines 22-403)

**Class Definition**:
```python
class AnalyzerLLMClient:
    def __init__(
        self,
        provider: str = None,  # "openai", "claude", "google", "ollama"
        model: str = None,
        temperature: float = 1.0,
        max_retries: int = 3,
        cost_tracker: CostTracker = None,
        workflow_tracker: Any = None
    ):
        self.provider = provider or os.getenv("LLM_PROVIDER", "openai")
        self.model = model or os.getenv("TAXONOMY_MODEL", "gpt-4o-mini")
        self.temperature = temperature
        self.max_retries = max_retries
        self.cost_tracker = cost_tracker

        # Initialize provider-specific client
        if self.provider == "openai":
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        elif self.provider == "claude":
            self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        elif self.provider == "google":
            self.client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        elif self.provider == "ollama":
            self.client = Ollama(host=os.getenv("OLLAMA_HOST", "http://localhost:11434"))
```

**Key Methods**:

1. **`analyze_email()`** (line 98):
   ```python
   def analyze_email(
       self,
       system_prompt: str,
       user_prompt: str,
       max_tokens: int = None
   ) -> Dict:
       """
       Call LLM with retry logic, parse JSON response.

       Returns:
           {
               "classifications": [
                   {
                       "taxonomy_id": 50,
                       "value": "Male",
                       "confidence": 0.85,
                       "reasoning": "...",
                       "email_numbers": [1, 5]
                   }
               ]
           }
       """
       for attempt in range(1, self.max_retries + 1):
           try:
               response = self._call_provider(system_prompt, user_prompt, max_tokens)
               parsed = self._parse_json_response(response)

               # Track cost
               if self.cost_tracker:
                   self.cost_tracker.track_call(
                       provider=self.provider,
                       model=self.model,
                       prompt_tokens=response.usage.prompt_tokens,
                       completion_tokens=response.usage.completion_tokens
                   )

               return parsed

           except Exception as e:
               if attempt < self.max_retries:
                   time.sleep(2 ** (attempt - 1))  # Exponential backoff: 1s, 2s, 4s
                   continue
               else:
                   raise
   ```

2. **`call_json()`** (line 216):
   ```python
   def call_json(
       self,
       system_prompt: str,
       user_prompt: str,
       max_tokens: int = 4096
   ) -> Dict:
       """
       Generic JSON call (for evidence judge, reconciliation, etc.).
       No structure enforcement.
       """
       # Same retry logic as analyze_email()
       # Returns raw parsed JSON
   ```

**JSON Parsing** (line 323):
```python
def _parse_json_response(self, response_text: str) -> Dict:
    # Strip markdown code blocks
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]

    # Extract JSON object
    start = response_text.find("{")
    end = response_text.rfind("}") + 1

    if start == -1 or end == 0:
        raise ValueError("No JSON found in response")

    json_str = response_text[start:end]
    return json.loads(json_str)
```

### 4.4 Cost Tracking

**File**: `src/email_parser/workflow/cost_tracker.py` (lines 33-231)

**Class Definition**:
```python
class CostTracker:
    def __init__(self):
        self.calls = []  # List of call records
        self.total_cost = 0.0

    def track_call(
        self,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> float:
        """
        Calculate cost and append to history.

        Returns:
            Cost of this call (USD)
        """
        pricing = self._get_pricing(provider, model)

        input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * pricing["output"]
        call_cost = input_cost + output_cost

        self.calls.append({
            "provider": provider,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost": call_cost
        })

        self.total_cost += call_cost
        return call_cost

    def get_summary(self, emails_processed: int = None) -> str:
        """
        Generate human-readable summary.

        Example output:
            Total Cost: $0.15
            Total LLM Calls: 28
            Average Cost per Call: $0.0054
            Average Cost per Email: $0.0015
        """
```

**Pricing Table** (as of 2025-10-01, per 1M tokens):
```python
PRICING = {
    "openai": {
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4-turbo": {"input": 10.00, "output": 30.00}
    },
    "claude": {
        "claude-sonnet-4": {"input": 3.00, "output": 15.00},
        "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
        "claude-3-opus": {"input": 15.00, "output": 75.00}
    },
    "google": {
        "gemini-2.0-flash-exp": {"input": 0.00, "output": 0.00},  # Free tier
        "gemini-1.5-pro": {"input": 1.25, "output": 5.00}
    },
    "ollama": {
        "default": {"input": 0.0, "output": 0.0}  # Local, no cost
    }
}
```

---

## 5. IAB Analyzer Agents

### 5.1 Architecture Pattern (Shared Across All 4)

**File**: `src/email_parser/workflow/nodes/analyzers.py` (lines 165-940)

**Design Decision** (line 890):
```python
def analyze_all_node(state: WorkflowState) -> WorkflowState:
    """
    Run ALL 4 analyzers sequentially (no conditional routing).

    WHY: Conditional routing with regex was brittle, missed signals.
    TRADE-OFF: +33% cost for never missing classifications.
    """
    state = demographics_analyzer_node(state)
    state = household_analyzer_node(state)
    state = interests_analyzer_node(state)
    state = purchase_analyzer_node(state)
    return state
```

**Common Execution Pattern** (for each analyzer):
```
1. Build taxonomy context (relevant subset of 1,558 entries)
2. Format email batch as numbered list
3. Call ReAct agent with taxonomy search tools
4. Parse LLM JSON response
5. Validate taxonomy_id ↔ value mapping
6. Run evidence judge in parallel (batch)
7. Adjust confidence based on evidence quality
8. Filter classifications with quality_score < 0.15
9. Append to state["<section>_results"]
```

### 5.2 Demographics Analyzer

**File**: `src/email_parser/agents/demographics_agent.py` (lines 24-277)

**Function**: `extract_demographics_with_agent()`

**Classifications**:
- **Age Range** (taxonomy_id=5): "18-24", "25-29", "30-34", ...
- **Gender** (taxonomy_id=50): "Male", "Female", "Non-Binary"
- **Income** (taxonomy_id=60): "$0-$24,999", "$25,000-$49,999", ...
- **Education** (taxonomy_id=70): "High School", "Some College", "Bachelor's", ...

**Prompt Structure** (line 99):
```python
system_prompt = DEMOGRAPHICS_AGENT_SYSTEM_PROMPT + taxonomy_context
# Example taxonomy_context:
#   "Demographics Taxonomy:\n"
#   "- ID 5 (Age Range): 18-24, 25-29, 30-34, ...\n"
#   "- ID 50 (Gender): Male, Female, Non-Binary\n"
#   "- ID 60 (Income): $0-$24,999, $25,000-$49,999, ...\n"

user_prompt = DEMOGRAPHICS_AGENT_USER_PROMPT.format(
    email_batch=email_text,
    batch_size=len(emails)
)
# Example email_batch:
#   "Email 1:\n"
#   "Subject: Exclusive offer for our male subscribers\n"
#   "From: newsletter@example.com\n"
#   "Body: Dear Mr. Johnson, ...\n\n"
#   "Email 2:\n"
#   "Subject: AARP membership renewal\n"
#   "..."
```

**LLM Output Format**:
```json
{
  "classifications": [
    {
      "taxonomy_id": 50,
      "value": "Male",
      "confidence": 0.85,
      "email_numbers": [1, 5, 12],
      "reasoning": "Email 1 uses 'Mr.' title. Email 5 is from a men's fashion retailer. Email 12 discusses prostate health."
    },
    {
      "taxonomy_id": 5,
      "value": "55-64",
      "confidence": 0.70,
      "email_numbers": [2, 8],
      "reasoning": "Email 2 is AARP membership (age 50+). Email 8 discusses retirement planning."
    }
  ]
}
```

**Tools Used** (`agents/tools.py`):
1. `search_demographics_taxonomy(query: str)` - Search by keyword
2. `validate_classification(taxonomy_id: int, value: str)` - Verify ID ↔ value match
3. `get_tier_details(taxonomy_id: int)` - Get full hierarchy

**ReAct Loop** (simplified):
```python
for iteration in range(1, 4):  # Max 3 iterations
    response = llm_client.analyze_email(system_prompt, user_prompt)

    for classification in response["classifications"]:
        # Validate taxonomy_id ↔ value
        is_valid = validate_classification(
            taxonomy_id=classification["taxonomy_id"],
            value=classification["value"]
        )

        if not is_valid:
            # Add error to prompt, retry
            user_prompt += f"\nERROR: Taxonomy ID {taxonomy_id} does not have value '{value}'. Please correct."
            continue  # Next iteration

    # All valid, break
    break
```

### 5.3 Household Analyzer

**File**: `src/email_parser/agents/household_agent.py`

**Classifications**:
- **Property Type** (taxonomy_id=100): "Urban Apartment", "Suburban House", "Rural Property"
- **Household Income** (taxonomy_id=110): "Budget-Conscious", "Mid-Range", "High-Income"
- **Household Size** (taxonomy_id=131): "1 person", "2 people", "3-4 people", "5+ people"
- **Home Location** (taxonomy_id=300): Country, Region/State, City, Metro Area, Zip Code

**Special Handling: Location Sub-Fields**

Location has a hierarchical structure with 5 tiers:
```
Tier 1: Country (e.g., "United States")
  Tier 2: Region/State (e.g., "California")
    Tier 3: City (e.g., "San Francisco")
      Tier 4: Metro Area (e.g., "SF Bay Area")
        Tier 5: Zip Code (e.g., "94102")
```

**Parser Logic** (src/email_parser/main.py, line 674):
```python
# Parse tier_path to extract location components
tier_path = classification["category_path"]

if "*Country Extension" in tier_path:
    location_fields['country'] = classification['value']
elif "*Region / State Extension" in tier_path:
    location_fields['region_state'] = classification['value']
elif "*City Extension" in tier_path:
    location_fields['city'] = classification['value']
elif "*Metro Extension" in tier_path:
    location_fields['metro'] = classification['value']
elif "*Zip Code Extension" in tier_path:
    location_fields['zip_code'] = classification['value']
```

### 5.4 Interests Analyzer

**File**: `src/email_parser/agents/interests_agent.py`

**Classifications**:
- **Hobbies** (taxonomy_id=342): "Cryptocurrency", "Photography", "Gaming", "Gardening"
- **Topics** (taxonomy_id=156): "Technology", "Politics", "Sports", "Entertainment"
- **Activities** (taxonomy_id=250): "Fitness", "Cooking", "Travel", "DIY"

**Multi-Value Nature**:
- Users can have MANY interests (not mutually exclusive)
- Each interest stored separately in Store
- Evidence accumulates independently per interest

**Example Output**:
```json
{
  "classifications": [
    {
      "taxonomy_id": 342,
      "value": "Cryptocurrency",
      "confidence": 0.90,
      "email_numbers": [1, 3, 7, 12],
      "reasoning": "Subscribed to Coinbase newsletter (Email 1), discussions of Bitcoin in Emails 3 and 7, wallet security tips in Email 12."
    },
    {
      "taxonomy_id": 156,
      "value": "Technology",
      "confidence": 0.85,
      "email_numbers": [2, 5, 9],
      "reasoning": "TechCrunch newsletter (Email 2), Apple product announcements (Email 5), coding tutorials (Email 9)."
    }
  ]
}
```

### 5.5 Purchase Intent Analyzer

**File**: `src/email_parser/agents/purchase_agent.py`

**Classifications**:
- **Intent Level**: "PIPR_HIGH", "PIPR_MEDIUM", "PIPR_LOW"
- **Product Categories** (taxonomy_id=520): "Electronics", "Clothing", "Home Goods", "Food & Beverage"
- **Actual Purchases** (taxonomy_id=510): "Confirmed", "Pending", "Abandoned Cart"

**Purchase Intent Flag** (special field):
```python
classification = {
    "taxonomy_id": 520,
    "value": "Electronics",
    "confidence": 0.88,
    "purchase_intent_flag": "PIPR_HIGH",  # ← Special field
    "email_numbers": [1, 4, 8],
    "reasoning": "Viewing laptops on Amazon (Email 1), added to cart (Email 4), reminder about cart (Email 8)."
}
```

**Intent Levels**:
- **PIPR_HIGH**: Active shopping (viewing products, adding to cart, price comparisons)
- **PIPR_MEDIUM**: Browsing (newsletters, sale alerts, product reviews)
- **PIPR_LOW**: Passive interest (general newsletters, unrelated products)

---

## 6. Evidence Judge System

### 6.1 Purpose & Design

**File**: `src/email_parser/workflow/nodes/evidence_judge.py` (lines 28-181)

**Purpose**: Validate that reasoning provides APPROPRIATE evidence per IAB Content Taxonomy Guidelines

**Problem Being Solved**:
- LLMs sometimes cite irrelevant evidence (e.g., product purchases → age inference)
- Classifications need confidence adjustment based on evidence quality
- Need to filter out weak/inappropriate signals

**Quality Scale**:
```python
QUALITY_EXPLICIT = 1.0      # Direct statement ("I'm 35 years old", "Mr. Johnson")
QUALITY_CONTEXTUAL = 0.7    # Strong inference (graduation year → age range)
QUALITY_WEAK = 0.4          # Indirect signal (interest in retirement → age 50+)
QUALITY_INAPPROPRIATE = 0.0 # Wrong type (product purchase → gender)
```

### 6.2 Core Function

**Function**: `evaluate_evidence_quality()` (line 28)

```python
def evaluate_evidence_quality(
    classification: Dict,
    emails: List[Dict],
    llm_client: AnalyzerLLMClient,
    section: str  # "demographics", "household", "interests", "purchase_intent"
) -> Dict:
    """
    Evaluate if reasoning provides appropriate evidence.

    Returns:
        {
            "is_valid": bool,
            "quality_score": float,  # 0.0-1.0
            "evidence_type": str,  # "explicit", "contextual", "weak", "inappropriate"
            "issue": str  # Explanation if invalid
        }
    """
```

**Algorithm**:

1. **Check for Hallucinations**:
   ```python
   email_numbers = classification.get("email_numbers", [])
   max_email_number = len(emails)

   if any(num > max_email_number for num in email_numbers):
       return {
           "is_valid": False,
           "quality_score": 0.0,
           "evidence_type": "inappropriate",
           "issue": f"Cites emails beyond batch (max={max_email_number})"
       }
   ```

2. **Build Judge Prompt**:
   ```python
   # Get section-specific guidelines
   guidelines = {
       "demographics": DEMOGRAPHICS_EVIDENCE_GUIDELINES,
       "household": HOUSEHOLD_EVIDENCE_GUIDELINES,
       "interests": INTERESTS_EVIDENCE_GUIDELINES,
       "purchase_intent": PURCHASE_EVIDENCE_GUIDELINES
   }[section]

   # Extract cited emails
   cited_emails = [emails[i-1] for i in email_numbers]
   email_context = "\n\n".join([
       f"Email {i+1}:\n"
       f"Subject: {email['subject']}\n"
       f"Body: {email['summary'][:500]}..."
       for i, email in enumerate(cited_emails)
   ])

   user_prompt = f"""
   ## Section Evidence Guidelines:
   {guidelines}

   ## Classification to Evaluate:
   - Taxonomy ID: {classification['taxonomy_id']}
   - Value: {classification['value']}
   - Reasoning: {classification['reasoning']}

   ## Email Context:
   {email_context[:2000]}  # Limit to 2K chars

   ## Task:
   Return ONLY JSON:
   {{
     "is_valid": true/false,
     "quality_score": 0.0-1.0,
     "evidence_type": "explicit|contextual|weak|inappropriate",
     "issue": "explanation if invalid"
   }}
   """
   ```

3. **Call LLM Judge**:
   ```python
   response = llm_client.call_json(
       system_prompt=EVIDENCE_JUDGE_SYSTEM_PROMPT,
       user_prompt=user_prompt,
       max_tokens=1024
   )
   ```

4. **Return Evaluation**:
   ```python
   return {
       "is_valid": response["is_valid"],
       "quality_score": response["quality_score"],
       "evidence_type": response["evidence_type"],
       "issue": response.get("issue", "")
   }
   ```

### 6.3 Batch Processing (Parallel Evaluation)

**Function**: `evaluate_evidence_quality_batch()` (line 184)

```python
def evaluate_evidence_quality_batch(
    classifications: List[Dict],
    emails: List[Dict],
    llm_client: AnalyzerLLMClient,
    section: str,
    max_workers: int = 5
) -> List[Dict]:
    """
    Evaluate multiple classifications in parallel.

    Performance: 5x speedup over sequential.
    """
    if len(classifications) == 1:
        # No threading overhead for single classification
        return [evaluate_evidence_quality(classifications[0], emails, llm_client, section)]

    # Parallel execution
    results = [None] * len(classifications)

    def evaluate_single(index, classification):
        result = evaluate_evidence_quality(classification, emails, llm_client, section)
        return (index, result)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(evaluate_single, i, classification): i
            for i, classification in enumerate(classifications)
        }

        for future in as_completed(futures):
            index, result = future.result()
            results[index] = result

    return results
```

**Performance**:
- 20 classifications × 3 seconds/call = 60 seconds (sequential)
- 20 classifications ÷ 5 workers = 4 rounds × 3 seconds = 12 seconds (parallel)
- **Speedup**: 5x

### 6.4 Confidence Adjustment

**Function**: `adjust_confidence_with_evidence_quality()` (line 268)

```python
def adjust_confidence_with_evidence_quality(
    original_confidence: float,
    quality_score: float,
    evidence_type: str
) -> float:
    """
    Adjust confidence based on evidence quality.

    Standard formula: adjusted = original × quality_score

    Exceptions for less harsh penalties:
    - Contextual evidence (0.6-0.8): min(0.85, quality_score + 0.15)
    - Weak evidence (0.3-0.5): min(0.65, quality_score + 0.25)
    """
    if evidence_type == "contextual" and 0.6 <= quality_score <= 0.8:
        adjusted = original_confidence * min(0.85, quality_score + 0.15)
    elif evidence_type == "weak" and 0.3 <= quality_score <= 0.5:
        adjusted = original_confidence * min(0.65, quality_score + 0.25)
    else:
        adjusted = original_confidence * quality_score

    return max(0.0, min(1.0, adjusted))
```

**Example**:
```python
# Case 1: Explicit evidence
original_confidence = 0.90
quality_score = 1.0
evidence_type = "explicit"
adjusted = 0.90 × 1.0 = 0.90  # No change

# Case 2: Contextual evidence
original_confidence = 0.85
quality_score = 0.75
evidence_type = "contextual"
adjusted = 0.85 × min(0.85, 0.75 + 0.15) = 0.85 × 0.85 = 0.72

# Case 3: Inappropriate evidence
original_confidence = 0.90
quality_score = 0.0
evidence_type = "inappropriate"
adjusted = 0.90 × 0.0 = 0.0  # Blocked
```

### 6.5 Blocking Threshold

**Function**: `should_block_classification()` (line 333)

```python
def should_block_classification(quality_score: float, threshold: float = 0.15) -> bool:
    """
    Block classification if quality_score is below threshold.

    Default threshold: 0.15 (blocks only very low quality)
    """
    return quality_score < threshold
```

**Integration with Analyzers**:
```python
# After evidence judge evaluation
for i, classification in enumerate(classifications):
    evaluation = evaluations[i]

    if should_block_classification(evaluation["quality_score"]):
        # Remove from results
        continue

    # Adjust confidence
    classification["confidence"] = adjust_confidence_with_evidence_quality(
        original_confidence=classification["confidence"],
        quality_score=evaluation["quality_score"],
        evidence_type=evaluation["evidence_type"]
    )

    # Append to results
    results.append(classification)
```

---

## 7. Taxonomy Reconciliation

### 7.1 Bayesian Confidence Update

**File**: `src/email_parser/memory/reconciliation.py` (lines 81-288)

**Purpose**: Combine new evidence with existing classifications using Bayesian inference

**Function**: `reconcile_evidence()`

```python
def reconcile_evidence(
    memory_manager: MemoryManager,
    taxonomy_id: int,
    section: str,
    value: str,
    confidence: float,
    reasoning: str,
    email_ids: List[str]
) -> Dict:
    """
    Update or create semantic memory with Bayesian confidence.

    Evidence Types:
    - Confirming: New value matches existing value → increase confidence
    - Contradicting: New value differs from existing → decrease confidence or replace

    Returns:
        Updated memory dict
    """
```

**Algorithm**:

1. **Check for Existing Memory**:
   ```python
   memory_id = f"{section}::{taxonomy_id}::{value}"
   existing = memory_manager.get_semantic_memory(memory_id)
   ```

2. **Classify Evidence Type**:
   ```python
   def classify_evidence_type(existing_value: str, new_value: str) -> str:
       # Normalize values (lowercase, strip)
       existing_norm = existing_value.lower().strip()
       new_norm = new_value.lower().strip()

       if existing_norm == new_norm:
           return "confirming"
       else:
           return "contradicting"
   ```

3. **Update Confidence**:

   **Confirming Evidence** (from `memory/confidence.py`):
   ```python
   def update_confidence_confirming(prior: float, likelihood: float) -> float:
       """
       Bayesian update for confirming evidence.

       Formula:
           P(H|E) = (P(H) × P(E|H)) / ((P(H) × P(E|H)) + (P(¬H) × P(E|¬H)))

       Where:
           P(H) = prior (current confidence)
           P(E|H) = likelihood (new evidence strength)
           P(¬H) = 1 - prior
           P(E|¬H) = 1 - likelihood
       """
       numerator = prior * likelihood
       denominator = (prior * likelihood) + ((1 - prior) * (1 - likelihood))
       return numerator / denominator
   ```

   **Contradicting Evidence**:
   ```python
   def update_confidence_contradicting(prior: float, likelihood: float) -> float:
       """
       Bayesian update for contradicting evidence.

       Formula:
           P(H|E) = (P(H) × P(¬E|H)) / ((P(H) × P(¬E|H)) + (P(¬H) × P(E|¬H)))
       """
       numerator = prior * (1 - likelihood)
       denominator = (prior * (1 - likelihood)) + ((1 - prior) * likelihood)
       return numerator / denominator
   ```

4. **Update Memory**:
   ```python
   if evidence_type == "confirming":
       updated_confidence = update_confidence_confirming(
           prior=existing["confidence"],
           likelihood=confidence
       )

       memory_manager.update_semantic_memory(memory_id, {
           "confidence": updated_confidence,
           "evidence_count": existing["evidence_count"] + 1,
           "supporting_evidence": existing["supporting_evidence"] + email_ids,
           "last_updated": datetime.utcnow().isoformat()
       })

   elif evidence_type == "contradicting":
       # Option 1: Update existing memory with lower confidence
       updated_confidence = update_confidence_contradicting(
           prior=existing["confidence"],
           likelihood=confidence
       )

       # Option 2: If new evidence is stronger, replace memory
       if confidence > existing["confidence"]:
           memory_manager.delete_semantic_memory(memory_id)
           memory_manager.store_semantic_memory(
               memory_id=f"{section}::{taxonomy_id}::{value}",
               memory_dict={
                   "taxonomy_id": taxonomy_id,
                   "value": value,
                   "confidence": confidence,
                   "reasoning": reasoning,
                   "evidence_count": 1,
                   "supporting_evidence": email_ids,
                   ...
               }
           )
   ```

### 7.2 Example: Confidence Evolution

**Scenario**: User age classification

```python
# Initial evidence (Email 1: "I'm 28 years old")
reconcile_evidence(
    manager,
    taxonomy_id=5,
    section="demographics",
    value="25-29",
    confidence=0.95,
    reasoning="Direct statement in Email 1",
    email_ids=["email_1"]
)
# Memory created: confidence=0.95

# Confirming evidence (Email 5: "Graduated college in 2018")
reconcile_evidence(
    manager,
    taxonomy_id=5,
    section="demographics",
    value="25-29",
    confidence=0.80,
    reasoning="Graduated 2018 → age ~28 in 2024",
    email_ids=["email_5"]
)
# Bayesian update: 0.95 (prior) × 0.80 (likelihood) = 0.98 (posterior)

# Contradicting evidence (Email 12: "AARP membership")
reconcile_evidence(
    manager,
    taxonomy_id=5,
    section="demographics",
    value="50-54",
    confidence=0.70,
    reasoning="AARP requires age 50+",
    email_ids=["email_12"]
)
# Contradicting update: 0.98 (prior) × (1 - 0.70) = 0.29
# Or: Replace with new value if 0.70 > 0.29
```

### 7.3 Conflict Resolution

**Function**: `resolve_contradiction()` (line 401)

```python
def resolve_contradiction(
    memory_manager: MemoryManager,
    memory_id: str,
    resolution: str,  # "keep", "delete", "update"
    new_value: str = None,
    new_confidence: float = None
):
    """
    Manual resolution of contradicting evidence.

    Actions:
    - keep: Mark as manually reviewed (update last_validated)
    - delete: Remove from Store
    - update: Replace with new value/confidence
    """
    if resolution == "keep":
        memory_manager.update_semantic_memory(memory_id, {
            "last_validated": datetime.utcnow().isoformat(),
            "days_since_validation": 0
        })

    elif resolution == "delete":
        memory_manager.delete_semantic_memory(memory_id)

    elif resolution == "update":
        memory_manager.delete_semantic_memory(memory_id)

        # Extract section, taxonomy_id from memory_id
        section, taxonomy_id, _ = memory_id.split("::")

        new_memory_id = f"{section}::{taxonomy_id}::{new_value}"
        memory_manager.store_semantic_memory(new_memory_id, {
            "taxonomy_id": int(taxonomy_id),
            "section": section,
            "value": new_value,
            "confidence": new_confidence,
            ...
        })
```

---

## 8. Memory & Store Integration

### 8.1 LangGraph Store

**Storage Backend**: SQLite (local file)

**File Path**: `data/langgraph_store.db`

**Advantages**:
- Backward compatible with LangGraph Cloud
- Can switch to PostgreSQL in production
- No additional infrastructure required
- Works with LangGraph Studio for debugging

### 8.2 Namespace Organization

**Format**:
```
<user_id>::semantic_memory::<section>::<taxonomy_id>::<value>
```

**Examples**:
```
user_123::semantic_memory::demographics::5::25-29
user_123::semantic_memory::demographics::50::Male
user_123::semantic_memory::household::100::Urban Apartment
user_123::semantic_memory::interests::342::Cryptocurrency
user_123::semantic_memory::purchase_intent::520::Electronics
```

**Advantages**:
- Hierarchical organization (easy to query by section)
- Unique keys prevent duplicates
- Supports multiple users in same Store

### 8.3 Memory Manager

**File**: `src/email_parser/memory/manager.py`

**Class Definition**:
```python
class MemoryManager:
    def __init__(self, store: BaseStore, user_id: str):
        self.store = store
        self.user_id = user_id
```

**Key Methods**:

1. **Store Memory**:
   ```python
   def store_semantic_memory(
       self,
       memory_id: str,  # "section::taxonomy_id::value"
       memory_dict: Dict
   ) -> None:
       """
       Write semantic memory to Store.

       Full namespace: <user_id>::semantic_memory::<memory_id>
       """
       namespace = (self.user_id, "semantic_memory")
       self.store.put(namespace, memory_id, memory_dict)
   ```

2. **Get Memory**:
   ```python
   def get_semantic_memory(self, memory_id: str) -> Dict | None:
       """
       Retrieve memory by ID.

       Returns None if not found.
       """
       namespace = (self.user_id, "semantic_memory")
       item = self.store.get(namespace, memory_id)
       return item.value if item else None
   ```

3. **Update Memory**:
   ```python
   def update_semantic_memory(
       self,
       memory_id: str,
       updates: Dict
   ) -> bool:
       """
       Update existing memory (partial update).

       Returns False if memory doesn't exist.
       """
       existing = self.get_semantic_memory(memory_id)
       if not existing:
           return False

       updated = {**existing, **updates}
       self.store_semantic_memory(memory_id, updated)
       return True
   ```

4. **Get by Section**:
   ```python
   def get_memories_by_section(self, section: str) -> List[Dict]:
       """
       Get all memories for a section.

       Example: section="demographics" returns all demographics classifications
       """
       namespace = (self.user_id, "semantic_memory")
       all_items = self.store.search(namespace, query=f"*{section}*")
       return [item.value for item in all_items]
   ```

5. **Get All Memories**:
   ```python
   def get_all_semantic_memories(self) -> List[Dict]:
       """
       Get all semantic memories for user.
       """
       namespace = (self.user_id, "semantic_memory")
       all_items = self.store.search(namespace)
       return [item.value for item in all_items]
   ```

### 8.4 Semantic Memory Schema

**File**: `src/email_parser/memory/schemas.py`

```python
{
    # Taxonomy Info
    "taxonomy_id": int,
    "section": str,  # "demographics", "household", "interests", "purchase_intent"
    "value": str,  # Final classification value

    # Confidence
    "confidence": float,  # 0.0-1.0

    # Evidence Tracking
    "evidence_count": int,
    "supporting_evidence": List[str],  # Email IDs confirming this value
    "contradicting_evidence": List[str],  # Email IDs contradicting this value

    # Temporal Tracking
    "first_observed": str,  # ISO 8601 timestamp
    "last_validated": str,  # ISO 8601 timestamp
    "last_updated": str,  # ISO 8601 timestamp
    "days_since_validation": int,

    # Source Info
    "data_source": str,  # "email", "transaction", "web", etc.
    "source_ids": List[str],  # Email IDs or other source identifiers

    # Taxonomy Hierarchy
    "category_path": str,  # "Demographic | Age Range | 25-29"
    "tier_1": str,  # "Demographic"
    "tier_2": str,  # "Age Range"
    "tier_3": str,  # "25-29"
    "tier_4": str,  # (optional)
    "tier_5": str,  # (optional)
    "grouping_tier_key": str,  # "tier_2" or "tier_3"
    "grouping_value": str,  # "Age" or "Gender"

    # Reasoning
    "reasoning": str  # LLM explanation
}
```

---

## 9. Concurrency Patterns

### 9.1 Email Summarization (Legacy/Deprecated)

**File**: `src/email_parser/main.py` (line 194)

**Context**: Before batch processing, emails were summarized individually using ThreadPoolExecutor

**Implementation**:
```python
max_workers = min(
    int(os.getenv('EMAIL_PROCESSING_CONCURRENCY', 5)),
    len(emails)
)

def process_single_email(args):
    index, email = args
    # Summarize email using LLM
    summary = summarize_email(email, llm_client)
    return (index, summary)

with ThreadPoolExecutor(max_workers=max_workers) as executor:
    futures = {
        executor.submit(process_single_email, (i, email)): i
        for i, email in enumerate(emails)
    }

    summaries = [None] * len(emails)
    for future in as_completed(futures):
        index, summary = future.result()
        summaries[index] = summary
```

**Configuration**:
- Default: `max_workers=5`
- Environment variable: `EMAIL_PROCESSING_CONCURRENCY`

**Status**: Deprecated in favor of batch processing (summaries now included in batch prompt)

### 9.2 Evidence Judge Parallelization (Current)

**File**: `src/email_parser/workflow/nodes/evidence_judge.py` (line 184)

**Context**: Evidence evaluation is parallelized for all 4 analyzers

**Implementation**:
```python
def evaluate_evidence_quality_batch(
    classifications: List[Dict],
    emails: List[Dict],
    llm_client: AnalyzerLLMClient,
    section: str,
    max_workers: int = 5
) -> List[Dict]:
    """
    Evaluate multiple classifications in parallel.

    Fixed: max_workers=5 (not configurable)
    """
    if len(classifications) == 1:
        return [evaluate_evidence_quality(classifications[0], emails, llm_client, section)]

    results = [None] * len(classifications)

    def evaluate_single(index, classification):
        result = evaluate_evidence_quality(classification, emails, llm_client, section)
        return (index, result)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(evaluate_single, i, classification): i
            for i, classification in enumerate(classifications)
        }

        for future in as_completed(futures):
            index, result = future.result()
            results[index] = result

    return results
```

**Performance Impact**:
- 20 classifications evaluated
- Sequential: 20 × 3 seconds = 60 seconds
- Parallel (5 workers): 4 rounds × 3 seconds = 12 seconds
- **Speedup**: 5x

**Usage**: All 4 analyzers use this function after LLM classification

---

## 10. Configuration & Error Handling

### 10.1 Configuration File

**File**: `src/email_parser/utils/config.py`

**Environment Variables**:

**LLM Configuration**:
```bash
LLM_PROVIDER=openai  # or "claude", "google", "ollama"
TAXONOMY_MODEL=openai:gpt-4o-mini  # For classification
EMAIL_MODEL=google:gemini-2.0-flash-exp  # For summarization (deprecated)

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIzaSy...
OLLAMA_HOST=http://localhost:11434

LLM_SEED=42  # Deterministic sampling (if supported by provider)
```

**Email Providers**:
```bash
# Gmail OAuth
GMAIL_CREDENTIALS_FILE=credentials.json
GMAIL_TOKEN_FILE=token.json

# Microsoft OAuth
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=...
MICROSOFT_REDIRECT_URI=http://localhost:8000/oauth/microsoft/callback
```

**Performance**:
```bash
EMAIL_PROCESSING_CONCURRENCY=5  # ThreadPoolExecutor max_workers
```

**Privacy**:
```bash
REDACT_REPORTS=1  # Redact PII in logs/reports
```

### 10.2 Retry Logic

**All LLM calls** use exponential backoff:

```python
def call_with_retry(func, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            response = func()
            return response
        except Exception as e:
            if attempt < max_retries:
                sleep_time = 2 ** (attempt - 1)  # 1s, 2s, 4s
                time.sleep(sleep_time)
                continue
            else:
                # Max retries exceeded
                raise
```

**Applied to**:
- `analyze_email()` (analyzer LLM calls)
- `call_json()` (evidence judge, reconciliation)
- OAuth token refresh

### 10.3 Error Handling

**State-Level Tracking**:

```python
def add_error(state: WorkflowState, error_message: str):
    if "errors" not in state:
        state["errors"] = []
    state["errors"].append({
        "timestamp": datetime.utcnow().isoformat(),
        "message": error_message
    })

def add_warning(state: WorkflowState, warning_message: str):
    if "warnings" not in state:
        state["warnings"] = []
    state["warnings"].append({
        "timestamp": datetime.utcnow().isoformat(),
        "message": warning_message
    })
```

**Workflow Continuation**:
```python
try:
    state = demographics_analyzer_node(state)
except Exception as e:
    add_error(state, f"Demographics analysis failed: {str(e)}")
    # Continue to next analyzer (don't fail entire workflow)

try:
    state = household_analyzer_node(state)
except Exception as e:
    add_error(state, f"Household analysis failed: {str(e)}")
    # Continue
```

**Graceful Degradation**: If 1 analyzer fails, other 3 still run

---

## 11. Performance Characteristics

### 11.1 Batch Processing Impact

**Scenario: 100 Emails**

| Metric | Single-Email | Batch Processing |
|--------|--------------|------------------|
| LLM Calls | 400 (100 × 4 analyzers) | 28 (7 batches × 4 analyzers) |
| Time | 20 minutes | 2 minutes |
| Cost (gpt-4o-mini) | $2.00 | $0.50 |
| Speedup | — | **10x faster** |
| Cost Reduction | — | **4x cheaper** |

**Breakdown**:
- Batch size: ~15 emails (for gpt-4o-mini with 128K context)
- Batches: 100 ÷ 15 = 7 batches
- Total calls: 7 batches × 4 analyzers = 28 LLM calls

### 11.2 Evidence Judge Parallelization

**Scenario: 20 Classifications**

| Metric | Sequential | Parallel (5 workers) |
|--------|------------|----------------------|
| Time per call | 3 seconds | 3 seconds |
| Total time | 60 seconds | 12 seconds |
| Speedup | — | **5x faster** |

**Calculation**:
- Sequential: 20 × 3s = 60s
- Parallel: 20 ÷ 5 workers = 4 rounds × 3s = 12s

### 11.3 Model Context Windows & Batch Sizes

| Provider | Model | Context | Max Output | Avg Batch Size |
|----------|-------|---------|------------|----------------|
| OpenAI | gpt-4o-mini | 128K | 16K | ~15 emails |
| OpenAI | gpt-4o | 128K | 16K | ~15 emails |
| Anthropic | claude-sonnet-4 | 200K | 8K | ~20 emails |
| Google | gemini-2.0-flash | 1M | 8K | ~50 emails |
| Ollama | llama2 (13B) | 4K | 2K | ~2 emails |

**Note**: Batch size calculated using `target_utilization=0.70` and average email size of 1.5K tokens

### 11.4 Cost Analysis

**Cost per Email** (using gpt-4o-mini):

| Stage | Tokens | Cost per Call | Calls per Email | Cost per Email |
|-------|--------|---------------|-----------------|----------------|
| Demographics | 15K in + 2K out | $0.0034 | 0.067 (1/15) | $0.0002 |
| Household | 15K in + 2K out | $0.0034 | 0.067 | $0.0002 |
| Interests | 15K in + 2K out | $0.0034 | 0.067 | $0.0002 |
| Purchase | 15K in + 2K out | $0.0034 | 0.067 | $0.0002 |
| Evidence Judge | 2K in + 0.5K out | $0.0006 | 4 × 0.05 | $0.0001 |
| **Total** | — | — | — | **$0.0009** |

**Scaling**:
- 1,000 emails: $0.90
- 10,000 emails: $9.00
- 100,000 emails: $90.00

---

## 12. Data Structures & Types

### 12.1 Email Dictionary

```python
{
    "id": str,          # Unique email identifier (e.g., Gmail message ID)
    "subject": str,     # Email subject line
    "from": str,        # Sender email address
    "summary": str,     # Email body content (used by agents)
    "body": str,        # Backward compatibility (same as summary)
    "date": str         # ISO 8601 timestamp (e.g., "2024-01-15T10:30:00Z")
}
```

**Note**: `summary` field is preferred over `body` for consistency with summarization workflow

### 12.2 Classification Dictionary

```python
{
    # Taxonomy Info
    "taxonomy_id": int,
    "section": str,  # "demographics", "household", "interests", "purchase_intent"
    "value": str,  # Final classification value

    # Confidence
    "confidence": float,  # 0.0-1.0

    # Taxonomy Hierarchy
    "category_path": str,  # "Demographic | Age Range | 25-29"
    "tier_1": str,
    "tier_2": str,
    "tier_3": str,
    "tier_4": str,  # Optional
    "tier_5": str,  # Optional
    "grouping_tier_key": str,  # "tier_2" or "tier_3"
    "grouping_value": str,  # e.g., "Age", "Gender"

    # Evidence
    "reasoning": str,  # LLM explanation
    "email_numbers": List[int],  # Which emails in batch (1-indexed)
    "email_ids": List[str]  # Mapped from email_numbers
}
```

### 12.3 IABConsumerProfile

**File**: `src/email_parser/models/iab_taxonomy.py`

```python
{
    # Metadata
    "user_id": str,
    "profile_version": int,  # Incremented on each update
    "generated_at": str,  # ISO 8601 timestamp

    # Generator Info
    "generator": {
        "system": "email_parser_iab_taxonomy",
        "llm_model": str,  # e.g., "openai:gpt-4o-mini"
        "workflow_version": "1.0"
    },

    # Data Coverage
    "data_coverage": {
        "total_emails_analyzed": int,
        "emails_this_run": int,
        "date_range": str  # e.g., "2024-01-01 to 2024-12-31"
    },

    # Classifications by Section
    "demographics": {
        "age_range": {
            "value": "25-29",
            "confidence": 0.95,
            "evidence_count": 5,
            "reasoning": "...",
            "last_updated": "2024-01-15T10:30:00Z"
        },
        "gender": {
            "value": "Male",
            "confidence": 0.88,
            ...
        },
        ...
    },

    "household": {
        "property_type": {...},
        "income": {...},
        "location": {
            "country": {...},
            "region_state": {...},
            "city": {...},
            ...
        }
    },

    "interests": [
        {
            "value": "Cryptocurrency",
            "confidence": 0.90,
            "evidence_count": 12,
            ...
        },
        {
            "value": "Technology",
            "confidence": 0.85,
            ...
        }
    ],

    "purchase_intent": [
        {
            "product_category": "Electronics",
            "intent_level": "PIPR_HIGH",
            "confidence": 0.88,
            ...
        }
    ],

    # Stats
    "memory_stats": {
        "total_classifications": int,
        "demographics_count": int,
        "household_count": int,
        "interests_count": int,
        "purchase_count": int
    },

    "section_confidence": {
        "demographics": float,  # Average confidence
        "household": float,
        "interests": float,
        "purchase_intent": float
    }
}
```

---

## 13. Algorithms & Formulas

### 13.1 Token Estimation

```python
def estimate_email_tokens(email: Dict) -> int:
    """
    Approximation: 4 characters ≈ 1 token
    """
    subject = email.get("subject", "")
    sender = email.get("from", "")
    body = email.get("summary") or email.get("body", "")

    total_chars = len(subject) + len(sender) + len(body)
    format_overhead = 100  # "Email N:\nSubject: ...\n"

    return (total_chars + format_overhead) // 4
```

### 13.2 Batch Size Calculation

```python
def calculate_batch_size(
    emails: List[Dict],
    context_window: int,
    start_index: int = 0,
    target_utilization: float = 0.70,
    min_batch_size: int = 5,
    max_batch_size: int = 50
) -> int:
    """
    Greedy algorithm to fill batch within token budget.
    """
    # Reserve tokens for fixed elements
    reserved_tokens = context_window * 0.30
    available_tokens = (context_window * target_utilization) - reserved_tokens

    # Fill batch
    cumulative_tokens = 0
    batch_size = 0

    for i in range(start_index, len(emails)):
        email_tokens = estimate_email_tokens(emails[i])

        if cumulative_tokens + email_tokens > available_tokens:
            break

        cumulative_tokens += email_tokens
        batch_size += 1

    # Enforce bounds
    return max(min_batch_size, min(batch_size, max_batch_size))
```

### 13.3 Bayesian Confidence Update

**Confirming Evidence**:
```python
def update_confidence_confirming(prior: float, likelihood: float) -> float:
    """
    P(H|E) = (P(H) × P(E|H)) / ((P(H) × P(E|H)) + (P(¬H) × P(E|¬H)))

    Where:
        P(H) = prior (current confidence)
        P(E|H) = likelihood (new evidence strength)
        P(¬H) = 1 - prior
        P(E|¬H) = 1 - likelihood
    """
    numerator = prior * likelihood
    denominator = (prior * likelihood) + ((1 - prior) * (1 - likelihood))
    return numerator / denominator
```

**Contradicting Evidence**:
```python
def update_confidence_contradicting(prior: float, likelihood: float) -> float:
    """
    P(H|E) = (P(H) × (1 - P(E|H))) / ((P(H) × (1 - P(E|H))) + (P(¬H) × P(E|¬H)))
    """
    numerator = prior * (1 - likelihood)
    denominator = (prior * (1 - likelihood)) + ((1 - prior) * likelihood)
    return numerator / denominator
```

**Example**:
```python
# Initial: confidence=0.75
# Confirming: new_confidence=0.85
prior = 0.75
likelihood = 0.85
posterior = (0.75 * 0.85) / ((0.75 * 0.85) + (0.25 * 0.15))
# posterior = 0.6375 / (0.6375 + 0.0375) = 0.944

# Contradicting: new_confidence=0.70
posterior = (0.75 * 0.30) / ((0.75 * 0.30) + (0.25 * 0.70))
# posterior = 0.225 / (0.225 + 0.175) = 0.5625
```

---

## 14. Critical Implementation Details

### 14.1 File Paths & Line Numbers

| Component | File | Key Lines |
|-----------|------|-----------|
| **Entry Point** | `main.py` | 380-542 (IAB profile generation) |
| **Graph Builder** | `workflow/graph.py` | 48-147 (build_workflow_graph) |
| **State Schema** | `workflow/state.py` | 15-195 (WorkflowState TypedDict) |
| **Batch Optimizer** | `workflow/batch_optimizer.py` | 50-136 (calculate_batch_size) |
| **All Analyzers** | `workflow/nodes/analyzers.py` | 165-940 (all 4 nodes) |
| **Evidence Judge** | `workflow/nodes/evidence_judge.py` | 28-181 (evaluate_evidence_quality) |
| **Demographics Agent** | `agents/demographics_agent.py` | 24-277 (extract_demographics_with_agent) |
| **Household Agent** | `agents/household_agent.py` | Similar structure |
| **Interests Agent** | `agents/interests_agent.py` | Similar structure |
| **Purchase Agent** | `agents/purchase_agent.py` | Similar structure |
| **LLM Wrapper** | `workflow/llm_wrapper.py` | 22-403 (AnalyzerLLMClient) |
| **Cost Tracker** | `workflow/cost_tracker.py` | 33-231 (CostTracker) |
| **Model Registry** | `llm_clients/model_registry.py` | 24-420 (get_context_window_*) |
| **Reconciliation** | `memory/reconciliation.py` | 81-288 (reconcile_evidence) |
| **Store Manager** | `memory/manager.py` | (all methods) |
| **Confidence Updates** | `memory/confidence.py` | (Bayesian formulas) |

### 14.2 Critical Parameters

**Batch Processing**:
- `target_utilization`: 0.70 (70% of context for emails)
- `min_batch_size`: 5
- `max_batch_size`: 50

**Evidence Judge**:
- `max_workers`: 5 (ThreadPoolExecutor)
- `quality_threshold`: 0.15 (block if below)

**Retry Logic**:
- `max_retries`: 3
- Backoff: 1s, 2s, 4s (exponential)

**Concurrency**:
- `EMAIL_PROCESSING_CONCURRENCY`: 5 (deprecated)
- Evidence judge: Fixed at 5 workers

### 14.3 Production Deployment Considerations

**Scalability**:
- Batch processing enables 10x speedup
- LangGraph Store can switch SQLite → PostgreSQL
- Horizontal scaling via multiple workers (batch per worker)

**Cost Management**:
- Cost tracker provides per-email metrics
- Model selection impacts cost (gpt-4o-mini cheapest)
- Evidence judge adds ~10% overhead

**Error Handling**:
- Workflow continues if individual analyzers fail
- Retry logic handles transient API failures
- State tracking enables debugging

**Privacy**:
- `REDACT_REPORTS=1` for production
- No raw email content in logs
- Store uses namespace isolation per user

---

## Summary

This specification provides **complete technical detail** for the Python IAB Classifier implementation. It documents:

- **Architecture**: LangGraph state machine with 7 nodes
- **Performance**: 10x speedup via batch processing (5-50 emails per LLM call)
- **LLM Infrastructure**: Multi-provider support (OpenAI, Claude, Google, Ollama)
- **Quality Assurance**: LLM-as-Judge for evidence validation
- **Confidence Tracking**: Bayesian updates for confirming/contradicting evidence
- **Memory**: LangGraph Store with SQLite backend
- **Cost**: $0.0009 per email (gpt-4o-mini)

**Use Case**: Reference for TypeScript migration to browser-based PWA deployment.

---

**Last Updated**: 2025-11-12
**Maintainer**: OwnYou Development Team
**Status**: Production (Python), Migration Reference (TypeScript)
