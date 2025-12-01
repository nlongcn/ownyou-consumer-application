# LLM Cost Management (v13 Section 6.10)

*Extracted from OwnYou_architecture_v13.md for AI assistant context loading*

OwnYou targets **<$10/user/month** average LLM spend.

## Budget Policy Interface

```typescript
interface LLMBudgetPolicy {
  monthly_budget_usd: 10;

  operations: {
    ikigai_inference: {
      max_input_tokens: 4000;
      max_output_tokens: 2000;
      max_runs_per_day: 2;
      model_tier: "standard";  // gpt-4o-mini, claude-3-haiku
    };

    mission_agent: {
      max_input_tokens: 3000;
      max_output_tokens: 1500;
      max_tool_calls_per_mission: 10;
      max_missions_per_day: 20;
      model_tier: "standard";
    };

    iab_classification: {
      max_input_tokens: 2000;
      max_output_tokens: 500;
      batch_size: 20;  // Emails per batch
      model_tier: "fast";  // gpt-4o-mini only
    };

    reflection_node: {
      max_input_tokens: 8000;
      max_output_tokens: 2000;
      max_runs_per_day: 1;
      model_tier: "standard";
    };

    embedding_generation: {
      max_tokens_per_batch: 8000;
      max_batches_per_day: 10;
      model: "text-embedding-3-small";
    };
  };

  throttling: {
    at_50_percent: "log_warning";
    at_80_percent: "reduce_model_tier";    // Switch to cheaper models
    at_95_percent: "defer_non_urgent";     // Only user-initiated operations
    at_100_percent: "local_only";          // WebLLM or cached responses
  };
}
```

## Model Tier Definitions

| Tier | Models | Cost/1K input | Cost/1K output | Use Cases |
|------|--------|---------------|----------------|-----------|
| **fast** | gpt-4o-mini | $0.00015 | $0.0006 | IAB classification, simple queries |
| **standard** | gpt-4o-mini, claude-3-haiku | $0.00025 | $0.00125 | Missions, Ikigai, Reflection |
| **quality** | gpt-4o, claude-3.5-sonnet | $0.0025 | $0.01 | Complex reasoning (user-initiated only) |
| **local** | WebLLM (Llama-3-8B) | $0 | $0 | Fallback, offline, budget exceeded |

```typescript
const MODEL_TIERS = {
  fast: {
    models: ["gpt-4o-mini"],
    avg_cost_per_1k: 0.000375,
  },
  standard: {
    models: ["gpt-4o-mini", "claude-3-haiku-20240307"],
    avg_cost_per_1k: 0.00075,
  },
  quality: {
    models: ["gpt-4o", "claude-3-5-sonnet-20241022"],
    avg_cost_per_1k: 0.00625,
  },
  local: {
    models: ["webllm/Llama-3-8B-Instruct-q4f32_1"],
    avg_cost_per_1k: 0,
  },
};
```

## Budget Enforcement Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM REQUEST FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request → Check Budget → Select Model → Execute → Track Cost   │
│              │                │                                  │
│              ▼                ▼                                  │
│        ┌─────────┐    ┌──────────────┐                          │
│        │ >100%?  │───▶│ Local/Cached │                          │
│        └────┬────┘    └──────────────┘                          │
│             │ No                                                 │
│             ▼                                                    │
│        ┌─────────┐    ┌──────────────┐                          │
│        │ >95%?   │───▶│ Defer if     │                          │
│        └────┬────┘    │ non-urgent   │                          │
│             │ No      └──────────────┘                          │
│             ▼                                                    │
│        ┌─────────┐    ┌──────────────┐                          │
│        │ >80%?   │───▶│ Downgrade    │                          │
│        └────┬────┘    │ model tier   │                          │
│             │ No      └──────────────┘                          │
│             ▼                                                    │
│        Execute with requested model                              │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
const enforceBudget = async (userId: string, request: LLMRequest): Promise<LLMRequest> => {
  const usage = await store.get(LLM_USAGE_NAMESPACE.monthly(userId), "current");
  const budgetUsedPercent = (usage.usage.total_cost_usd / 10) * 100;

  // >100%: Local only
  if (budgetUsedPercent >= 100) {
    return { ...request, model: "webllm/Llama-3-8B-Instruct-q4f32_1", throttled: true };
  }

  // >95%: Defer non-urgent
  if (budgetUsedPercent >= 95 && !request.urgent) {
    throw new DeferredRequestError("Budget nearly exhausted. Request deferred.");
  }

  // >80%: Downgrade model
  if (budgetUsedPercent >= 80) {
    const downgradedTier = downgradeModelTier(request.modelTier);
    const downgradedModel = selectModel(downgradedTier);
    return { ...request, model: downgradedModel, throttled: true };
  }

  return request;
};
```

## Cost Tracking Namespace

```typescript
const LLM_USAGE_NAMESPACE = {
  daily: (userId: string) => ["ownyou.llm_usage.daily", userId],
  monthly: (userId: string) => ["ownyou.llm_usage.monthly", userId],
};
```
