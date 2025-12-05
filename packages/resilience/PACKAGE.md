# @ownyou/resilience

Production-grade resilience patterns for OwnYou's external dependencies.

**v13 Architecture Reference:** Section 6.11 (Error Handling & Resilience)

---

## Overview

This package provides:

1. **Circuit Breaker Registry** - Protects all external API calls
2. **LLM Fallback Chain** - 7-level fallback for LLM inference
3. **Partial Data Handling** - Graceful degradation when data is incomplete
4. **Error Recovery States** - User-friendly error messaging

---

## Architecture

```
@ownyou/resilience
├── circuit-breaker/
│   ├── registry.ts      # CircuitBreakerRegistry class
│   └── config.ts        # Per-API configurations (v13 6.11.1)
├── fallback/
│   └── llm-chain.ts     # 7-level LLM fallback (v13 6.11.3)
├── partial-data/
│   └── policies.ts      # Coverage policies (v13 6.11.4)
├── error-recovery/
│   └── states.ts        # User error states (v13 6.11.5)
└── types.ts
```

---

## Usage

### Circuit Breaker Registry

```typescript
import { CircuitBreakerRegistry, API_CONFIGS } from '@ownyou/resilience';

const registry = new CircuitBreakerRegistry(API_CONFIGS);

// Execute with circuit breaker protection
const result = await registry.execute(
  'serpapi',
  () => searchAPI.query(term),
  () => getCachedResults(term)  // Fallback
);

// Check circuit status
const stats = registry.getStats('serpapi');
console.log(stats.state); // 'closed' | 'open' | 'half_open'
```

### LLM Fallback Chain

```typescript
import { llmInferenceWithFallback } from '@ownyou/resilience';

const result = await llmInferenceWithFallback(request, {
  provider: primaryLLM,
  alternativeProvider: backupLLM,
  localProvider: webLLM,
  cache: responseCache,
  userId: 'user_123',
  maxRetries: 3,
  timeoutMs: 30000,
  baseRetryDelayMs: 1000,
});

console.log(result.level); // 'original' | 'retry' | 'downgrade' | 'alternative' | 'cache' | 'local' | 'degraded'
console.log(result.attempts); // Number of attempts made
```

### Partial Data Handling

```typescript
import { handlePartialData, configurePartialDataPolicies } from '@ownyou/resilience';

// Override default policies
configurePartialDataPolicies({
  email: { minCoverage: 0.9 },  // Stricter than default
});

// Check if partial data is acceptable
const result = handlePartialData('email', 45, 100);

if (!result.proceed) {
  throw new Error(result.message);
}

if (result.warning) {
  showToast(result.message);
}

// Apply confidence penalty
score *= result.confidenceMultiplier;
```

### Error Recovery States

```typescript
import { getErrorState, mapErrorToStateCode, isRetryable } from '@ownyou/resilience';

try {
  await apiCall();
} catch (error) {
  const code = mapErrorToStateCode(error);
  const state = getErrorState(code);

  if (state?.type === 'temporary' && isRetryable(code)) {
    showToast(`${state.message} Retrying in ${state.retryInSeconds}s`);
  } else if (state?.type === 'action_required') {
    showActionPrompt(state.action);
  }
}
```

---

## API Reference

### Circuit Breaker

| Export | Type | Description |
|--------|------|-------------|
| `CircuitBreakerRegistry` | Class | Manages circuit breakers for all APIs |
| `API_CONFIGS` | Object | Default configurations for all v13 APIs |
| `ApiConfig` | Type | Configuration interface |

### LLM Fallback

| Export | Type | Description |
|--------|------|-------------|
| `llmInferenceWithFallback` | Function | Execute LLM request with 7-level fallback |
| `gracefulDegradation` | Function | Generate degraded response |
| `getDowngradedModel` | Function | Get cheaper model variant |
| `getAlternativeProvider` | Function | Get backup provider |
| `ALTERNATIVE_PROVIDERS` | Object | Provider fallback mapping |
| `FallbackChainConfig` | Type | Configuration interface |
| `FallbackResult` | Type | Result with level and attempts |

### Partial Data

| Export | Type | Description |
|--------|------|-------------|
| `handlePartialData` | Function | Evaluate partial data scenario |
| `configurePartialDataPolicies` | Function | Override default policies |
| `resetPartialDataPolicies` | Function | Reset to defaults |
| `getPolicy` | Function | Get policy for data source |
| `isStale` | Function | Check if data needs refresh |
| `adjustConfidence` | Function | Apply confidence penalty |
| `DEFAULT_PARTIAL_DATA_POLICIES` | Object | Default policy configurations |

### Error Recovery

| Export | Type | Description |
|--------|------|-------------|
| `getErrorState` | Function | Get error state by code |
| `createErrorState` | Function | Create custom error state |
| `mapErrorToStateCode` | Function | Map error to state code |
| `isRetryable` | Function | Check if error is retryable |
| `requiresAction` | Function | Check if user action needed |
| `getErrorCodesByType` | Function | Get all codes of a type |
| `ERROR_STATES` | Object | All predefined error states |

---

## v13 Compliance

| Section | Requirement | Implementation |
|---------|-------------|----------------|
| 6.11.1 | Resilience Policy Interface | `API_CONFIGS` with all v13 APIs |
| 6.11.2 | Circuit Breaker Implementation | `CircuitBreakerRegistry` |
| 6.11.3 | LLM Fallback Chain | `llmInferenceWithFallback()` with 7 levels |
| 6.11.4 | Partial Data Handling | `handlePartialData()` with policies |
| 6.11.5 | Error Recovery UI States | `ERROR_STATES` with all v13 states |

---

## Testing

```bash
npm test -- --run packages/resilience
```

**Test Coverage:** 106 tests across 4 test files
