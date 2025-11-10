# LLM Wrapper Extraction Document

**Source:** `src/email_parser/workflow/llm_wrapper.py`
**Lines:** 403 lines
**Purpose:** Unified LLM interface for analyzer nodes with retry logic and cost tracking

---

## Overview

The LLM wrapper provides a unified interface for calling any LLM provider (OpenAI, Claude, Google, Ollama) with built-in retry logic, cost tracking, and JSON response parsing.

**Key Responsibilities:**
- **Multi-provider support** - Switches between OpenAI, Claude, Google, Ollama
- **Retry logic** - Exponential backoff on failures (3 attempts)
- **Cost tracking** - Integrates with CostTracker for budget monitoring
- **JSON parsing** - Handles markdown code blocks and formatting issues
- **Two interfaces** - `analyze_email()` for IAB, `call_json()` for generic JSON

---

## Elements to Port (21 total)

### 1. Class: AnalyzerLLMClient (Lines 22-403)
- **Purpose:** Unified LLM client for analyzer nodes with retry logic
- **Core Functionality:**
  - Provider selection (claude/openai/google/ollama)
  - Automatic retry with exponential backoff
  - Cost tracking integration
  - JSON response parsing with cleanup

### 2. Method: `__init__` (Lines 25-72)
- **Parameters:**
  - `provider: str` - "claude", "openai", "google", or "ollama"
  - `model: Optional[str]` - Specific model name
  - `max_retries: int` - Number of retry attempts (default: 3)
  - `cost_tracker: Optional[CostTracker]` - Cost tracking instance
  - `workflow_tracker: Optional[Any]` - Dashboard analytics tracker
- **Key Logic:**
  - Parse model spec format: "provider:model" (e.g., "openai:gpt-4")
  - Default to LLM_PROVIDER env var, or "openai" fallback
  - Create appropriate client via `_create_client()`
  - Use provided model or client's default_model
- **Browser Adaptation:** Environment variables via `import.meta.env`

### 3. Method: `_create_client` (Lines 74-96)
- **Purpose:** Factory method to instantiate appropriate LLM client
- **Key Logic:**
  ```python
  if self.provider == "claude":
      return ClaudeClient(config)
  elif self.provider == "openai":
      return OpenAIClient(config)
  elif self.provider == "ollama":
      return OllamaClient(config)
  else:
      raise ValueError(f"Unknown provider: {self.provider}")
  ```
- **Note:** Add Google support: `elif self.provider == "google": return GoogleClient(config)`
- **TypeScript:** Return type should be `BaseLLMClient`

### 4. Method: `analyze_email` (Lines 98-214)
- **Purpose:** Main method for IAB email classification
- **Parameters:**
  - `prompt: str` - Complete prompt with email content
  - `max_tokens: int` - Maximum response tokens (default: None → 1000)
  - `temperature: float` - Sampling temperature (default: 0.1)
- **Returns:** `Dict[str, Any]` with `classifications` array
- **Key Logic:**
  1. Create LLMRequest with json_mode=True
  2. Retry loop (1 to max_retries)
  3. Call `self.client.generate(request)`
  4. Parse JSON response
  5. Validate has "classifications" key (add empty array if missing)
  6. Track costs via CostTracker and WorkflowTracker
  7. Exponential backoff on failure: 2^(attempt-1) seconds
  8. Return empty classifications on all failures
- **Error Handling:**
  - JSONDecodeError → log warning, retry, return empty on exhaustion
  - Other Exception → log error, retry, raise on exhaustion

### 5. Method: `call_json` (Lines 216-321)
- **Purpose:** Generic JSON call without structure enforcement
- **Parameters:**
  - `prompt: str` - Complete prompt
  - `max_tokens: Optional[int]` - Maximum response tokens (default: None)
  - `temperature: float` - Sampling temperature (default: 0.1)
- **Returns:** `Dict[str, Any]` - Parsed JSON as-is
- **Key Differences from analyze_email:**
  - No "classifications" key enforcement
  - Uses ceiling of 100000 tokens if None (auto-adjusted by client)
  - Raises exception on exhaustion (doesn't return empty dict)
  - Used for LLM-as-Judge and other non-classification tasks
- **Key Logic:**
  - Same retry loop as analyze_email
  - Same cost tracking
  - Validates response is dict (not array)
  - Different error behavior (raises vs returns empty)

### 6. Method: `_parse_json_response` (Lines 323-361)
- **Purpose:** Parse JSON from LLM response, handling formatting issues
- **Parameters:** `content: str` - Raw LLM response
- **Returns:** `Dict[str, Any]` - Parsed JSON object
- **Key Logic:**
  1. Strip whitespace
  2. Remove markdown code blocks:
     - Strip ```json prefix
     - Strip ``` prefix/suffix
  3. Try json.loads()
  4. On failure, extract first `{` to last `}`
  5. Re-parse extracted JSON
- **Common Issues Handled:**
  - Markdown: "```json\n{...}\n```"
  - Text wrapper: "Here's the analysis:\n{...}"
  - Extra whitespace

### 7. Method: `estimate_cost` (Lines 363-400)
- **Purpose:** Estimate cost of LLM call
- **Parameters:**
  - `prompt_tokens: int` - Tokens in prompt
  - `response_tokens: int` - Tokens in response
- **Returns:** `Optional[float]` - Cost in USD, or None
- **Pricing (as of 2024):**
  ```python
  pricing = {
      "claude": {
          "prompt": 3.0 / 1_000_000,   # $3/M input
          "response": 15.0 / 1_000_000  # $15/M output
      },
      "openai": {
          "prompt": 5.0 / 1_000_000,   # $5/M (GPT-4)
          "response": 15.0 / 1_000_000  # $15/M
      },
      "ollama": {
          "prompt": 0.0,  # Free
          "response": 0.0
      }
  }
  ```
- **Note:** These are approximate/average prices. Actual costs tracked via CostTracker use model-specific rates.
- **Missing:** Google pricing (to be added)

---

## Retry Logic Details

### Exponential Backoff (Lines 194, 207, 304, 314)
```python
time.sleep(2 ** (attempt - 1))
```

**Wait times:**
- Attempt 1 fails → wait 1 second (2^0)
- Attempt 2 fails → wait 2 seconds (2^1)
- Attempt 3 fails → wait 4 seconds (2^2)

### Retry Behavior Differences

**analyze_email:**
- JSONDecodeError → retry, return empty on exhaustion
- Other Exception → retry, raise on exhaustion

**call_json:**
- JSONDecodeError → retry, raise on exhaustion
- Other Exception → retry, raise on exhaustion

**Rationale:** `analyze_email` is more forgiving (returns empty) because it's used in batch processing where one failure shouldn't crash the pipeline.

---

## Cost Tracking Integration

### CostTracker Integration (Lines 151-162, 275-286)
```python
if self.cost_tracker and response.usage:
    prompt_tokens = response.usage.get("prompt_tokens", 0)
    completion_tokens = response.usage.get("completion_tokens", 0)

    if prompt_tokens > 0 or completion_tokens > 0:
        cost = self.cost_tracker.track_call(
            provider=self.provider,
            model=self.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )
```

### WorkflowTracker Integration (Lines 165-172, 288-295)
```python
if hasattr(self, 'workflow_tracker') and self.workflow_tracker:
    self.workflow_tracker.record_cost(
        provider=self.provider,
        cost=cost,
        model_name=self.model,
        input_tokens=prompt_tokens,
        output_tokens=completion_tokens
    )
```

**Note:** WorkflowTracker is for dashboard analytics (not yet implemented in browser PWA).

---

## Provider Model Spec Format

### Format: "provider:model" (Lines 50-55)
```python
if model and ':' in model:
    provider_from_model, model_name = model.split(':', 1)
    if provider is None:
        provider = provider_from_model
    model = model_name
```

**Examples:**
- "openai:gpt-4" → provider="openai", model="gpt-4"
- "claude:claude-3-opus" → provider="claude", model="claude-3-opus"
- "ollama:llama2" → provider="ollama", model="llama2"

**Benefit:** Allows switching providers without changing code, just model string.

---

## JSON Parsing Edge Cases

### 1. Markdown Code Blocks (Lines 339-344)
```python
if content.startswith("```json"):
    content = content[7:]  # Remove ```json
if content.startswith("```"):
    content = content[3:]   # Remove ```
if content.endswith("```"):
    content = content[:-3]  # Remove trailing ```
```

### 2. Text Wrapper (Lines 352-359)
```python
# Look for first { and last }
start = content.find('{')
end = content.rfind('}')

if start != -1 and end != -1:
    content = content[start:end+1]
    return json.loads(content)
```

**Common LLM behaviors:**
- Wrapping JSON in markdown: "```json\n{...}\n```"
- Adding preamble: "Here's the classification:\n{...}"
- Adding postscript: "{...}\n\nThis analysis shows..."

---

## Missing Google Support

### Current Code (Lines 86-96)
```python
if self.provider == "claude":
    return ClaudeClient(config)
elif self.provider == "openai":
    return OpenAIClient(config)
elif self.provider == "ollama":
    return OllamaClient(config)
else:
    raise ValueError(...)
```

### To Add (TypeScript)
```typescript
if (this.provider === 'google') {
  return new GoogleClient(config, this.logger)
}
```

**Also update:**
- Import statement (line 14-16): Add `GoogleClient`
- Pricing table (lines 379-392): Add Google pricing
- Documentation: Update provider list

---

## Usage Patterns

### Pattern 1: IAB Classification
```python
client = AnalyzerLLMClient(
    provider="claude",
    model="claude-3-haiku",
    cost_tracker=cost_tracker
)

response = client.analyze_email(
    prompt=iab_classification_prompt,
    max_tokens=1000,
    temperature=0.1
)

classifications = response["classifications"]  # Always present
```

### Pattern 2: LLM-as-Judge
```python
client = AnalyzerLLMClient(provider="openai")

response = client.call_json(
    prompt=quality_judge_prompt,
    max_tokens=500,
    temperature=0.0
)

score = response["quality_score"]
```

---

## Browser Adaptations

### 1. Environment Variables
- Python: `os.getenv("LLM_PROVIDER", "openai")`
- TypeScript: `import.meta.env.VITE_LLM_PROVIDER || 'openai'`

### 2. Async/Await
- Python: Synchronous `self.client.generate(request)`
- TypeScript: `await this.client.generate(request)`

### 3. Exponential Backoff
- Python: `time.sleep(2 ** (attempt - 1))`
- TypeScript: `await new Promise(resolve => setTimeout(resolve, 2 ** (attempt - 1) * 1000))`

### 4. Logging
- Python: `logging.getLogger(__name__)`
- TypeScript: Inject logger via constructor (same as individual clients)

---

## Summary

**Total Elements:** 21
- 1 class (AnalyzerLLMClient)
- 6 methods (2 main + 4 utilities)
- Retry logic with exponential backoff
- Cost tracking integration
- JSON parsing with edge case handling
- Multi-provider support (OpenAI, Claude, Ollama + Google to add)

**Key Features:**
- **Unified interface** - Single API for all providers
- **Automatic retries** - 3 attempts with exponential backoff
- **Cost tracking** - Integrates with CostTracker and WorkflowTracker
- **JSON cleanup** - Handles markdown and text wrappers
- **Two modes** - analyze_email (forgiving) vs call_json (strict)

**Migration Priority:** HIGH - Critical integration layer for all LLM calls

---

**Next Steps:**
1. Create TypeScript implementation
2. Add Google client support
3. Add Google pricing to estimate_cost
4. Adapt retry logic for browser (async)
5. Verify JSON parsing handles all edge cases
6. Test with all 4 providers (OpenAI, Claude, Google, Ollama)
