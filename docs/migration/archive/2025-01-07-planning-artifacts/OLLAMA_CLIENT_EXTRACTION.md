# Ollama Client Extraction Document

**Source:** `src/email_parser/llm_clients/ollama_client.py`
**Lines:** 339 lines
**Purpose:** Local Ollama LLM client for testing and development

---

## Overview

The Ollama client provides integration with locally-running Ollama models. Unlike cloud providers (OpenAI, Claude, Google), Ollama runs models on localhost for testing and development.

**Key Characteristics:**
- **Local Service:** Connects to http://localhost:11434
- **Dual Approach:** HTTP API + subprocess fallback
- **Free:** Cost is always $0.00
- **Model Management:** Can pull, list, and inspect models
- **Simple Format:** Concatenates messages with role prefixes
- **Performance Tracking:** Detailed timing metrics

---

## Elements to Port (29 total)

### 1. Class: OllamaClient (Lines 16-339)
- **Extends:** `BaseLLMClient`
- **Purpose:** Client for Ollama local LLM models
- **Note:** Subprocess calls won't work in browser (Python agent only)

### 2. Method: `__init__` (Lines 19-39)
- **Parameters:** `config: Dict[str, Any]`
- **Key Logic:**
  - Base URL: `http://localhost:11434` (default)
  - Default model: Required from `OLLAMA_MODEL` env var
  - Timeout: None (large models can take time)
  - Calls `_verify_connection()` on init
- **Browser Adaptation:** Remove subprocess imports, use fetch only

### 3. Method: `get_provider` (Lines 41-43)
- **Returns:** `LLMProvider.OLLAMA`
- **Simple:** Direct return

### 4. Method: `is_available` (Lines 45-52)
- **Purpose:** Check if Ollama service is running
- **Key Logic:**
  - GET request to `/api/tags`
  - Timeout: 5 seconds
  - Returns true if HTTP 200
- **Browser Adaptation:** Use fetch API

### 5. Method: `_verify_connection` (Lines 54-65)
- **Purpose:** Verify connection on initialization
- **Key Logic:**
  - Calls `is_available()`
  - Logs warning if unavailable (non-fatal)
  - Logs success with base_url
- **Browser Adaptation:** Async with await

### 6. Method: `get_supported_models` (Lines 67-81)
- **Purpose:** List available Ollama models
- **Key Logic:**
  - GET request to `/api/tags`
  - Extract model names from response
  - Returns array of model names
- **Browser Adaptation:** Use fetch, async with await

### 7. Method: `estimate_cost` (Lines 83-85)
- **Purpose:** Estimate cost (always free)
- **Key Logic:** Always returns 0.0
- **Note:** Ollama is free for local use

### 8. Method: `_format_messages_for_ollama` (Lines 87-100)
- **Purpose:** Format messages for Ollama API
- **Key Logic:**
  - System messages: "System: {content}"
  - User messages: "User: {content}"
  - Assistant messages: "Assistant: {content}"
  - Join with double newlines
- **Note:** Much simpler than cloud providers (no complex formats)

### 9. Method: `_call_ollama_api` (Lines 102-146)
- **Purpose:** Call Ollama HTTP API
- **Parameters:** `prompt: str, model: str`
- **Key Logic:**
  - POST to `/api/generate`
  - Payload: model, prompt, stream=false, options
  - Performance logging with metrics
  - Returns JSON response with timing data
- **Error Handling:**
  - Timeout (shouldn't happen with no timeout)
  - ConnectionError (Ollama not running)
  - HTTP errors
- **Browser Adaptation:** Use fetch, remove requests library

### 10. Method: `_call_ollama_subprocess` (Lines 148-168)
- **Purpose:** Fallback to subprocess if API unavailable
- **Key Logic:**
  - Runs `ollama run {model}` command
  - Passes prompt via stdin
  - Captures stdout/stderr
- **CRITICAL:** This method **CANNOT** work in browser
- **Browser Note:** Mark as Python-agent-only feature

### 11. Method: `generate` (Lines 170-261)
- **Purpose:** Main generation method
- **Key Logic:**
  1. Validate model is specified (no fallback)
  2. Validate request using base class method
  3. Check if model is available (warning if not)
  4. Format messages with role prefixes
  5. Try API first, fallback to subprocess
  6. Extract usage metrics from response
  7. Return LLMResponse with metadata
- **Usage Metrics (Ollama-specific):**
  - `prompt_eval_count` - Tokens in prompt
  - `eval_count` - Tokens generated
  - `total_duration` - Total time in nanoseconds
  - `load_duration` - Model load time
  - `eval_duration` - Generation time
- **Browser Adaptation:** Remove subprocess fallback path

### 12. BONUS Method: `pull_model` (Lines 263-309)
- **Purpose:** Download a model from Ollama repository
- **Key Logic:**
  - Try API: POST to `/api/pull` with model name
  - Timeout: 300 seconds (models are large)
  - Fallback: subprocess `ollama pull {model}`
- **Browser Adaptation:** API only, no subprocess
- **Note:** Useful for development, not typical runtime

### 13. BONUS Method: `list_running_models` (Lines 311-323)
- **Purpose:** List currently loaded/running models
- **Key Logic:**
  - GET request to `/api/ps`
  - Returns array of model info dicts
- **Browser Adaptation:** Use fetch

### 14. BONUS Method: `show_model_info` (Lines 325-339)
- **Purpose:** Get detailed info about a specific model
- **Key Logic:**
  - POST to `/api/show` with model name
  - Returns model metadata (size, parameters, etc.)
- **Browser Adaptation:** Use fetch

---

## Ollama API Endpoints

### 1. GET `/api/tags` (Lines 48, 70)
- **Purpose:** List available models
- **Response:**
  ```json
  {
    "models": [
      {"name": "llama2:latest", ...},
      {"name": "mistral:latest", ...}
    ]
  }
  ```

### 2. POST `/api/generate` (Lines 104-146)
- **Purpose:** Generate text from prompt
- **Payload:**
  ```json
  {
    "model": "llama2",
    "prompt": "...",
    "stream": false,
    "options": {
      "temperature": 0.7,
      "top_p": 0.9,
      "top_k": 40
    }
  }
  ```
- **Response:**
  ```json
  {
    "response": "...",
    "prompt_eval_count": 123,
    "eval_count": 456,
    "total_duration": 1234567890,
    "load_duration": 123456789,
    "eval_duration": 987654321
  }
  ```

### 3. POST `/api/pull` (Lines 277-290)
- **Purpose:** Download a model
- **Payload:** `{"name": "llama2"}`
- **Note:** Can take minutes for large models

### 4. GET `/api/ps` (Lines 314-320)
- **Purpose:** List running models
- **Response:** Array of currently loaded models

### 5. POST `/api/show` (Lines 328-336)
- **Purpose:** Get model details
- **Payload:** `{"name": "llama2"}`
- **Response:** Model metadata

---

## Key Differences from Cloud Providers

| Feature | OpenAI/Claude/Google | **Ollama** |
|---------|---------------------|------------|
| **Location** | Remote API | **Local (localhost:11434)** |
| **Cost** | Per token pricing | **$0.00 (free)** |
| **Authentication** | API key required | **None (local service)** |
| **Message Format** | Complex (JSON objects) | **Simple (text with prefixes)** |
| **Subprocess Fallback** | Not applicable | **`ollama run` command** |
| **Model Management** | Not exposed | **pull/list/show available** |
| **Token Counting** | API provides | **API provides (different names)** |
| **Performance Metrics** | Basic (tokens, cost) | **Detailed (durations, eval counts)** |

---

## Browser Compatibility Challenges

### ❌ Cannot Work in Browser (Subprocess Methods)
- `_call_ollama_subprocess()` - Lines 148-168
- Subprocess fallback in `generate()` - Lines 222-225
- Subprocess fallback in `pull_model()` - Lines 293-305

### ⚠️ May Work with CORS Configuration
- All HTTP API methods (lines 48, 70, 104-146, 277-290, 314-320, 328-336)
- **Requirement:** Ollama service must enable CORS for browser access
- **Alternative:** Proxy through Python agent backend

### ✅ Can Work in Browser with Adaptation
- Model listing, generation, info retrieval
- All non-subprocess features
- **Note:** Better suited for Python agent deployment

---

## Usage Metrics (Ollama-Specific)

Unlike cloud providers that use `prompt_tokens`/`completion_tokens`, Ollama provides:

1. **`prompt_eval_count`** - Number of tokens in prompt
2. **`eval_count`** - Number of tokens generated
3. **`total_duration`** - Total time in nanoseconds
4. **`load_duration`** - Time to load model
5. **`eval_duration`** - Time spent generating

**Note:** These are actual counts from the model, not estimates.

---

## Performance Logging

Lines 127-134, 206-260:
- Tracks API call metrics (status code, response time, size)
- Uses `TimedOperation` context manager
- Logs processing time, prompt length, response length
- Includes provider-specific metadata

---

## Migration Strategy

### For Browser PWA Deployment:
1. ⚠️ **Remove all subprocess code** (won't work in browser)
2. ⚠️ **Document CORS requirements** for local Ollama service
3. ⚠️ **Note limitations** in documentation
4. ✅ **Port HTTP API methods** using fetch
5. ✅ **Keep model management features** (useful for dev)

### For Python Agent Deployment:
1. ✅ **Keep all features** including subprocess fallback
2. ✅ **Full compatibility** with existing code
3. ✅ **Best for local testing** and development

### Recommended Approach:
- **Browser PWA:** Use cloud providers (OpenAI, Claude, Google)
- **Python Agent:** Use Ollama for local testing + cloud for production
- **Hybrid:** Ollama via Python agent backend, exposed to browser via proxy

---

## Summary

**Total Elements:** 29
- 1 class (OllamaClient)
- 14 methods (11 required + 3 bonus)
- 5 API endpoints
- 8 configuration options
- Subprocess features (Python-agent-only)

**Key Features:**
- Local model support (no API costs)
- Dual approach (HTTP + subprocess)
- Model management (pull, list, show)
- Detailed performance metrics
- Simple message formatting

**Browser Compatibility:** ⚠️ **Partial**
- HTTP API: ✅ Yes (with CORS)
- Subprocess: ❌ No (Python-agent-only)
- **Recommendation:** Better suited for Python agent deployment

---

**Next Steps:**
1. Create TypeScript implementation with browser adaptations
2. Remove subprocess methods or mark as unavailable
3. Document CORS requirements
4. Add note about Python-agent-only features
5. Verify all HTTP API methods with fetch

**Migration Priority:** Medium (useful for development, not critical for browser PWA)
