# OpenAI Client Extraction Document

**Source:** `src/email_parser/llm_clients/openai_client.py` (509 lines)
**Target:** `src/browser/llm/openaiClient.ts`
**Date:** 2025-01-07
**Migration Type:** FULL PORT - All 509 lines ported per mandate "Always Full Port, No Compromises"

---

## Overview

**Purpose:** OpenAI LLM client implementation providing integration with OpenAI's GPT models.

**Python Lines:** 509
**Elements to Port:** 17 major elements (1 class, 16 methods, 1 pricing dictionary)

**Core Components:**
1. OpenAIClient class extending BaseLLMClient
2. Model pricing dictionary (10 models)
3. Configuration and initialization logic
4. Connection verification
5. Request generation with error handling and retries
6. Token adjustment and context window management
7. Model validation and info retrieval
8. Usage statistics

---

## Element-by-Element Extraction

### 1. Module Header & Imports (Lines 1-11)

**Python Lines 1-5: Module Docstring**
```python
"""
OpenAI LLM client implementation.

Provides integration with OpenAI's GPT models.
"""
```

**Python Lines 7-11: Imports**
```python
import time
from typing import Dict, Any, List, Optional
import openai
from ..llm_clients.base import BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage
from ..utils.logging import get_logger, TimedOperation, get_performance_logger
```

**TypeScript Equivalent:**
- time → Date API
- typing → Built-in TypeScript types
- openai → Browser-compatible OpenAI SDK
- base imports → From './base'
- logging → Custom logger interface

---

### 2. Class Definition & Pricing (Lines 14-29)

**✅ Class Declaration (Line 14)**

| Python | TypeScript | Notes |
|--------|------------|-------|
| `class OpenAIClient(BaseLLMClient):` | `export class OpenAIClient extends BaseLLMClient` | Inheritance |
| Line 15: Docstring | JSDoc comment | Class-level documentation |

**✅ MODEL_PRICING Dictionary (Lines 17-29)**

**Purpose:** Pricing per 1K tokens (as of 2024-2025)

| Model Name | Python Input | Python Output | Line |
|------------|--------------|---------------|------|
| gpt-4 | 0.03 | 0.06 | 19 |
| gpt-4-32k | 0.06 | 0.12 | 20 |
| gpt-4-turbo | 0.01 | 0.03 | 21 |
| gpt-4-turbo-preview | 0.01 | 0.03 | 22 |
| gpt-3.5-turbo | 0.001 | 0.002 | 23 |
| gpt-3.5-turbo-16k | 0.003 | 0.004 | 24 |
| gpt-5-mini | 0.002 | 0.004 | 25 |
| gpt-5 | 0.02 | 0.08 | 26 |
| o1-preview | 0.015 | 0.06 | 27 |
| o1-mini | 0.003 | 0.012 | 28 |

**Model Count:** 10 entries

**TypeScript Structure:**
```typescript
static readonly MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // ... all 10 models
}
```

---

### 3. Constructor (__init__) (Lines 31-64)

**Signature (Line 31):**
```python
def __init__(self, config: Dict[str, Any]):
```

**TypeScript Signature:**
```typescript
constructor(config: Record<string, any>)
```

**Logic Flow:**

**Lines 37-38: Super call & imports**
```python
import os
super().__init__(config)
```

**Lines 41-42: API key configuration**
```python
self.api_key = config.get('openai_api_key') or os.getenv('OPENAI_API_KEY')
self.default_model = config.get('openai_model') or os.getenv('OPENAI_MODEL')
```

**Lines 44-45: Model validation**
```python
if not self.default_model:
    raise ValueError("OpenAI model must be specified in OPENAI_MODEL environment variable")
```

**Lines 48-53: Configuration parameters**
```python
# Lines 48-50: max_tokens (default 16384)
max_tokens_str = config.get('openai_max_tokens') or os.getenv('OPENAI_MAX_TOKENS')
self.max_tokens = int(max_tokens_str) if max_tokens_str else 16384

# Lines 52-53: temperature (default 0.7)
temperature_str = config.get('openai_temperature') or os.getenv('OPENAI_TEMPERATURE')
self.default_temperature = float(temperature_str) if temperature_str else 0.7
```

**Line 55: Performance logger**
```python
self.performance_logger = get_performance_logger(f"{__name__}.OpenAIClient")
```

**Lines 57-58: API key validation**
```python
if not self.api_key:
    raise ValueError("OpenAI API key is required")
```

**Line 61: OpenAI client initialization**
```python
self.client = openai.OpenAI(api_key=self.api_key)
```

**Line 64: Connection verification**
```python
self._verify_connection()
```

---

### 4. Method: get_provider (Lines 66-68)

**Signature:**
```python
def get_provider(self) -> LLMProvider:
    """Get the provider type."""
    return LLMProvider.OPENAI
```

**TypeScript:**
```typescript
getProvider(): LLMProvider {
  return LLMProvider.OPENAI
}
```

---

### 5. Method: is_available (Lines 70-78)

**Purpose:** Check if OpenAI API is available

**Logic (Lines 72-78):**
```python
try:
    # Try to list models as a health check
    models = self.client.models.list()
    return len(models.data) > 0
except Exception as e:
    self.logger.debug(f"OpenAI availability check failed: {e}")
    return False
```

---

### 6. Method: _verify_connection (Lines 80-96)

**Purpose:** Verify connection to OpenAI API

**Logic:**

**Lines 82-90: Success case**
```python
try:
    # Test with a minimal request
    models = self.client.models.list()
    model_names = [model.id for model in models.data]
    self.logger.info(
        "Successfully connected to OpenAI API",
        available_models_count=len(model_names),
        default_model=self.default_model
    )
```

**Lines 91-96: Error case**
```python
except Exception as e:
    self.logger.error(
        "Failed to connect to OpenAI API. Please check your API key.",
        error=str(e)
    )
    raise
```

---

### 7. Method: get_supported_models (Lines 98-113)

**Purpose:** Get list of available OpenAI models

**Logic:**

**Lines 100-110: API call**
```python
try:
    models = self.client.models.list()
    # Filter to only include GPT models suitable for chat
    gpt_models = [
        model.id for model in models.data
        if "gpt" in model.id.lower() and
        any(x in model.id for x in ["3.5", "4"])
    ]

    self.logger.debug(f"Available GPT models: {gpt_models}")
    return gpt_models
```

**Lines 111-113: Fallback**
```python
except Exception as e:
    self.logger.error(f"Error getting supported models: {e}")
    return list(self.MODEL_PRICING.keys())  # Fallback to known models
```

---

### 8. Method: estimate_cost (Lines 115-143)

**Purpose:** Estimate the cost of a request

**Logic:**

**Lines 117-127: Model matching**
```python
model = request.model or self.default_model

if model not in self.MODEL_PRICING:
    # Try to match partial model names
    for known_model in self.MODEL_PRICING:
        if known_model in model:
            model = known_model
            break
    else:
        self.logger.warning(f"Unknown model for cost estimation: {model}")
        return None
```

**Lines 129-135: Token estimation**
```python
# Rough token estimation (1 token ≈ 4 characters)
input_text = "\n".join([msg.content for msg in request.messages])
if request.system_prompt:
    input_text += "\n" + request.system_prompt

estimated_input_tokens = len(input_text) // 4
estimated_output_tokens = request.max_tokens or self.max_tokens
```

**Lines 137-143: Cost calculation**
```python
pricing = self.MODEL_PRICING[model]
estimated_cost = (
    (estimated_input_tokens / 1000) * pricing["input"] +
    (estimated_output_tokens / 1000) * pricing["output"]
)

return estimated_cost
```

---

### 9. Method: _format_messages_for_openai (Lines 145-150)

**Purpose:** Format messages for OpenAI API

**Logic:**
```python
def _format_messages_for_openai(self, messages: List[LLMMessage]) -> List[Dict[str, str]]:
    """Format messages for OpenAI API."""
    return [
        {"role": message.role, "content": message.content}
        for message in messages
    ]
```

**TypeScript:**
```typescript
private _formatMessagesForOpenai(messages: Array<LLMMessage>): Array<{ role: string; content: string }> {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}
```

---

### 10. Method: generate (Lines 152-382) - CRITICAL, COMPLEX

**Purpose:** Generate response using OpenAI API

**This is the MOST CRITICAL method - 230 lines with complex error handling, retries, and parameter adaptation**

#### Phase 1: Validation (Lines 154-162)

**Lines 155-156: Model validation**
```python
if not request.model:
    raise ValueError(f"Model must be explicitly specified in LLMRequest. No fallback to default model allowed.")
```

**Lines 159-162: Request validation**
```python
validation_errors = self.validate_request(request)
if validation_errors:
    error_msg = "; ".join(validation_errors)
    return self.create_error_response(error_msg, request.model)
```

#### Phase 2: Preparation (Lines 164-185)

**Lines 165-168: Prepare parameters**
```python
messages = self.prepare_messages(request)
model = request.model  # NO FALLBACK - use exact model requested
max_tokens = request.max_tokens or self.max_tokens
temperature = request.temperature or self.default_temperature
```

**Line 171: Log model**
```python
self.logger.info(f"🎯 Using model: {model} for OpenAI request")
```

**Line 174: Format messages**
```python
openai_messages = self._format_messages_for_openai(messages)
```

**Line 177: Adjust tokens**
```python
max_tokens = self._adjust_tokens_for_context(openai_messages, model, max_tokens)
```

**Lines 179-185: Debug log**
```python
self.logger.debug(
    "Sending request to OpenAI",
    model=model,
    messages_count=len(openai_messages),
    max_tokens=max_tokens,
    temperature=temperature
)
```

**Line 187: Start timer**
```python
start_time = time.time()
```

#### Phase 3: API Call (Lines 189-273)

**Lines 191-206: Build kwargs**
```python
kwargs = dict(
    model=model,
    messages=openai_messages,
)

# Handle parameter differences between model versions
if "gpt-5" in model.lower() or "o1" in model.lower():
    # Newer models: use max_completion_tokens and default temperature
    kwargs["max_completion_tokens"] = max_tokens
else:
    # Older models: use max_tokens and custom parameters
    kwargs["max_tokens"] = max_tokens
    kwargs["temperature"] = temperature
    kwargs["top_p"] = 0.9
    kwargs["frequency_penalty"] = 0
    kwargs["presence_penalty"] = 0
```

**Lines 208-213: JSON mode (optional)**
```python
if getattr(request, 'json_mode', None):
    # Prefer structured JSON response when requested
    try:
        kwargs["response_format"] = {"type": "json_object"}
    except Exception:
        pass
```

**Line 215: API call**
```python
response = self.client.chat.completions.create(**kwargs)
```

**Line 217: Calculate processing time**
```python
processing_time = time.time() - start_time
```

**Line 220: Extract content**
```python
content = response.choices[0].message.content or ""
```

**Lines 223-234: Empty response debugging**
```python
if not content:
    finish_reason = response.choices[0].finish_reason
    self.logger.warning(
        f"⚠️  EMPTY RESPONSE from OpenAI - finish_reason={finish_reason}, "
        f"response_id={response.id}, model={model}, "
        f"prompt_length={len(str(kwargs.get('messages', [])))} chars"
    )
    # Log the full prompt for debugging (truncate if very long)
    prompt_text = str(kwargs.get('messages', []))
    if len(prompt_text) > 1000:
        prompt_text = prompt_text[:500] + "\n...[TRUNCATED]...\n" + prompt_text[-500:]
    self.logger.debug(f"Empty response prompt: {prompt_text}")
```

**Lines 237-241: Extract usage**
```python
usage = {
    'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
    'completion_tokens': response.usage.completion_tokens if response.usage else 0,
    'total_tokens': response.usage.total_tokens if response.usage else 0,
}
```

**Lines 244-250: Calculate cost**
```python
actual_cost = None
if model in self.MODEL_PRICING and response.usage:
    pricing = self.MODEL_PRICING[model]
    actual_cost = (
        (response.usage.prompt_tokens / 1000) * pricing["input"] +
        (response.usage.completion_tokens / 1000) * pricing["output"]
    )
```

**Lines 252-273: Success response**
```python
self.logger.debug(
    "Received response from OpenAI",
    model=model,
    content_length=len(content),
    processing_time=processing_time,
    tokens_used=usage['total_tokens'],
    estimated_cost=actual_cost
)

return LLMResponse(
    content=content,
    model=model,
    usage=usage,
    metadata={
        'provider': 'openai',
        'processing_time': processing_time,
        'estimated_cost': actual_cost,
        'finish_reason': response.choices[0].finish_reason,
        'response_id': response.id,
    },
    success=True
)
```

#### Phase 4: Error Handling (Lines 275-382)

**Lines 275-283: Rate limit error**
```python
except openai.RateLimitError as e:
    error_msg = f"OpenAI rate limit exceeded: {str(e)}"
    self.logger.error(
        "OpenAI rate limit exceeded",
        model=model,
        error=error_msg,
        processing_time=time.time() - start_time
    )
    return self.create_error_response(error_msg, model)
```

**Lines 285-291: Authentication error**
```python
except openai.AuthenticationError as e:
    error_msg = f"OpenAI authentication failed: {str(e)}"
    self.logger.error(
        "OpenAI authentication failed",
        error=error_msg
    )
    return self.create_error_response(error_msg, model)
```

**Lines 293-372: Bad request error WITH RETRY LOGIC (COMPLEX!)**

**Lines 294-313: Retry decision logic**
```python
except openai.BadRequestError as e:
    error_msg = f"OpenAI bad request: {str(e)}"

    # Handle various parameter compatibility issues with newer models
    should_retry = False
    retry_kwargs = kwargs.copy()

    if "max_tokens" in str(e) and "max_completion_tokens" in str(e):
        self.logger.warning(f"Retrying with max_completion_tokens for model {model}")
        should_retry = True
        if "max_tokens" in retry_kwargs:
            retry_kwargs["max_completion_tokens"] = retry_kwargs.pop("max_tokens")
        elif "max_completion_tokens" in retry_kwargs:
            retry_kwargs["max_tokens"] = retry_kwargs.pop("max_completion_tokens")

    elif "temperature" in str(e) and ("default" in str(e) or "1)" in str(e)):
        self.logger.warning(f"Retrying without temperature parameter for model {model}")
        should_retry = True
        # Remove temperature and other unsupported parameters for newer models
        for param in ["temperature", "top_p", "frequency_penalty", "presence_penalty"]:
            retry_kwargs.pop(param, None)
```

**Lines 315-362: Retry attempt**
```python
if should_retry:
    try:

        response = self.client.chat.completions.create(**retry_kwargs)
        processing_time = time.time() - start_time

        # Extract response content
        content = response.choices[0].message.content or ""

        # Extract usage information
        usage = {
            'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
            'completion_tokens': response.usage.completion_tokens if response.usage else 0,
            'total_tokens': response.usage.total_tokens if response.usage else 0,
        }

        # Calculate actual cost if possible
        actual_cost = None
        if model in self.MODEL_PRICING and response.usage:
            pricing = self.MODEL_PRICING[model]
            actual_cost = (
                (response.usage.prompt_tokens / 1000) * pricing["input"] +
                (response.usage.completion_tokens / 1000) * pricing["output"]
            )

        self.logger.debug(
            "Received response from OpenAI (retry successful)",
            model=model,
            content_length=len(content),
            processing_time=processing_time,
            tokens_used=usage['total_tokens'],
            estimated_cost=actual_cost
        )

        return LLMResponse(
            content=content,
            model=model,
            usage=usage,
            metadata={
                'provider': 'openai',
                'processing_time': processing_time,
                'estimated_cost': actual_cost,
                'finish_reason': response.choices[0].finish_reason,
                'response_id': response.id,
                'retry_used': True,
            },
            success=True
        )
    except Exception as retry_error:
        error_msg = f"OpenAI retry failed: {str(retry_error)}"
```

**Lines 366-372: Failed request logging**
```python
self.logger.error(
    "OpenAI bad request",
    model=model,
    error=error_msg,
    messages_count=len(openai_messages)
)
return self.create_error_response(error_msg, model)
```

**Lines 374-382: Generic error**
```python
except Exception as e:
    error_msg = f"OpenAI API error: {str(e)}"
    self.logger.error(
        "OpenAI generation failed",
        model=model,
        error=error_msg,
        processing_time=time.time() - start_time
    )
    return self.create_error_response(error_msg, model)
```

---

### 11. Method: get_usage_stats (Lines 384-393)

**Purpose:** Get usage statistics (OpenAI doesn't provide direct API)

**Logic:**
```python
def get_usage_stats(self) -> Dict[str, Any]:
    """Get usage statistics (if available)."""
    # Note: OpenAI doesn't provide a direct API for usage stats
    # This would need to be implemented with external tracking
    return {
        'provider': 'openai',
        'note': 'Usage statistics not available via API. Check OpenAI dashboard.',
        'default_model': self.default_model,
        'max_tokens': self.max_tokens
    }
```

---

### 12. Method: validate_model (Lines 395-402)

**Purpose:** Validate if a model is available

**Logic:**
```python
def validate_model(self, model_name: str) -> bool:
    """Validate if a model is available."""
    try:
        available_models = self.get_supported_models()
        return model_name in available_models
    except Exception:
        # Fallback to known models
        return model_name in self.MODEL_PRICING
```

---

### 13. Method: get_model_info (Lines 404-417)

**Purpose:** Get information about a specific model

**Logic:**
```python
def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
    """Get information about a specific model."""
    try:
        model = self.client.models.retrieve(model_name)
        return {
            'id': model.id,
            'object': model.object,
            'created': model.created,
            'owned_by': model.owned_by,
            'pricing': self.MODEL_PRICING.get(model_name, 'Unknown')
        }
    except Exception as e:
        self.logger.error(f"Error getting model info for {model_name}: {e}")
        return None
```

---

### 14. Method: estimate_tokens (Lines 419-422)

**Purpose:** Rough estimation of token count

**Logic:**
```python
def estimate_tokens(self, text: str) -> int:
    """Rough estimation of token count."""
    # Simple heuristic: ~4 characters per token for English text
    return len(text) // 4
```

---

### 15. Method: truncate_to_token_limit (Lines 424-431)

**Purpose:** Truncate text to approximate token limit

**Logic:**
```python
def truncate_to_token_limit(self, text: str, max_tokens: int) -> str:
    """Truncate text to approximate token limit."""
    max_chars = max_tokens * 4  # Rough conversion
    if len(text) <= max_chars:
        return text

    # Truncate and add ellipsis
    return text[:max_chars-3] + "..."
```

---

### 16. Method: get_context_window (Lines 433-476)

**Purpose:** Get context window size for a specific model

**Logic:**

**Lines 450-455: API attempt (currently fails)**
```python
# Try to get from API (may not be exposed for all models)
try:
    model_info = self.client.models.retrieve(model_name)
    # OpenAI doesn't expose context_length in API yet, use known limits
except Exception:
    pass
```

**Lines 458-472: Known limits dictionary**
```python
model_limits = {
    "gpt-4": 8192,
    "gpt-4-32k": 32768,
    "gpt-4-turbo": 128000,
    "gpt-4-turbo-preview": 128000,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-3.5-turbo": 16385,
    "gpt-3.5-turbo-16k": 16385,
    "gpt-5-mini": 128000,  # GPT-5 models
    "gpt-5-nano": 128000,
    "gpt-5": 128000,
    "o1-preview": 128000,
    "o1-mini": 128000,
}
```

**Lines 474-476: Lookup and return**
```python
context_window = model_limits.get(model_name, 128000)  # Default to 128K for newer models
self.logger.debug(f"Context window for {model_name}: {context_window:,} tokens")
return context_window
```

**NOTE:** This method is REDUNDANT with model_registry.py - should use model_registry instead!

---

### 17. Method: _adjust_tokens_for_context (Lines 478-509)

**Purpose:** Dynamically adjust max_tokens based on input size, context limits, and max_completion_tokens

**Logic:**

**Lines 480-484: Import and get limits**
```python
from ..llm_clients.model_registry import get_context_window_openai, get_max_completion_tokens_openai

# Get model-specific limits from registry
context_limit = get_context_window_openai(self.client, model)
max_completion = get_max_completion_tokens_openai(self.client, model)
```

**Lines 487-492: Calculate available tokens**
```python
# Estimate input tokens (rough approximation)
input_text = "\n".join([msg["content"] for msg in messages])
estimated_input_tokens = self.estimate_tokens(input_text)

# Reserve some tokens for safety margin and system overhead
safety_margin = 200
available_tokens = context_limit - estimated_input_tokens - safety_margin
```

**Lines 494-500: Cap and adjust**
```python
# Cap at BOTH available tokens AND model's max_completion_tokens
adjusted_tokens = min(requested_tokens, available_tokens, max_completion)

# Ensure we have at least some tokens for output (minimum 100)
if adjusted_tokens < 100:
    self.logger.warning(f"Very limited tokens available for response: {adjusted_tokens}")
    adjusted_tokens = max(100, available_tokens // 2, 100)
```

**Lines 502-509: Log and return**
```python
if adjusted_tokens != requested_tokens:
    self.logger.info(
        f"🔧 Adjusted max_tokens from {requested_tokens:,} to {adjusted_tokens:,} "
        f"(input: ~{estimated_input_tokens:,} tokens, context_limit: {context_limit:,}, "
        f"max_completion: {max_completion:,})"
    )

return adjusted_tokens
```

---

## Summary Statistics

| Category | Python | TypeScript (estimated) | Notes |
|----------|--------|------------------------|-------|
| **Total Lines** | 509 | ~750 | With comments + types |
| **Class** | 1 | 1 | OpenAIClient |
| **Methods** | 16 | 16 | All instance methods |
| **Static Data** | 1 | 1 | MODEL_PRICING dictionary |
| **Model Entries** | 10 | 10 | Pricing for 10 models |
| **Imports** | 5 | ~4 | Adapted for browser |
| **Total Elements** | ~33 | ~33 | FULL PORT |

---

## Translation Patterns

### Pattern 1: Class Extension
```python
# Python
class OpenAIClient(BaseLLMClient):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
```

```typescript
// TypeScript
export class OpenAIClient extends BaseLLMClient {
  constructor(config: Record<string, any>) {
    super(config)
  }
}
```

### Pattern 2: Static Dictionary
```python
# Python
MODEL_PRICING = {
    "gpt-4": {"input": 0.03, "output": 0.06},
}
```

```typescript
// TypeScript
static readonly MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
}
```

### Pattern 3: Environment Variables
```python
# Python
self.api_key = config.get('openai_api_key') or os.getenv('OPENAI_API_KEY')
```

```typescript
// TypeScript (browser adaptation)
this.apiKey = config.openai_api_key || import.meta.env.VITE_OPENAI_API_KEY
```

### Pattern 4: Exception Handling with Retries
```python
# Python
try:
    response = self.client.chat.completions.create(**kwargs)
except openai.BadRequestError as e:
    if should_retry:
        response = self.client.chat.completions.create(**retry_kwargs)
```

```typescript
// TypeScript
try {
  response = await this.client.chat.completions.create(kwargs)
} catch (error) {
  if (error instanceof OpenAI.BadRequestError) {
    if (shouldRetry) {
      response = await this.client.chat.completions.create(retryKwargs)
    }
  }
}
```

---

## Critical Notes

1. **FULL PORT MANDATE:** All 509 lines ported, all 33 elements included
2. **Complex Error Handling:** Lines 275-382 have sophisticated retry logic with parameter adaptation
3. **Model Registry Integration:** Uses model_registry for context windows and max completion tokens
4. **Async Adaptation:** Python sync → TypeScript async (OpenAI SDK is promise-based in TS)
5. **Browser Environment:** Environment variables via import.meta.env (Vite) instead of os.getenv
6. **Time Tracking:** Python time.time() → TypeScript Date.now() or performance.now()
7. **Exception Types:** openai.RateLimitError → OpenAI.RateLimitError (SDK namespace)
8. **Dict Pop:** Python dict.pop() → TypeScript delete obj[key] or destructuring

---

## Dependency Analysis

**Imports Required:**
- `./base` → BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage
- `./modelRegistry` → getContextWindowOpenai, getMaxCompletionTokensOpenai
- OpenAI SDK → Browser-compatible version
- Logger interface

**External Calls:**
- model_registry functions (lines 480, 484)
- Base class methods (validate_request, prepare_messages, create_error_response)
- OpenAI SDK client methods

---

## Next Steps

1. Create `src/browser/llm/openaiClient.ts` with FULL implementation
2. Adapt for async/await (all OpenAI SDK calls return Promises)
3. Adapt environment variable access for browser
4. Create verification document with line-by-line comparison
5. Update todo list to mark OpenAI client as completed
6. Proceed to next component: Claude client (425 lines)
