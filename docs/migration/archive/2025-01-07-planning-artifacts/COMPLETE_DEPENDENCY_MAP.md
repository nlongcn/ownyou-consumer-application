# Complete Python→TypeScript Migration Dependency Map

**Project:** OwnYou IAB Classifier - Full Python to TypeScript/JavaScript PWA Port

**Date:** 2025-01-07

**Status:** IN PROGRESS - Systematic Full Port (No Compromises)

---

## Migration Scope Summary

| Category | Files | Lines | Status |
|----------|-------|-------|--------|
| **COMPLETED** | 5 | **1,568** | ✅ |
| **IN PROGRESS** | 0 | 0 | 🔄 |
| **PENDING** | 17+ | **~6,916** | ⏳ |
| **TOTAL** | 22+ | **~8,484** | 18% Complete |

---

## Completed Migrations ✅ (1,568 lines)

### 1. IAB Taxonomy Loader
- **Python**: `src/email_parser/utils/iab_taxonomy_loader.py`
- **TypeScript**: `src/browser/taxonomy/IABTaxonomyLoader.ts`
- **Lines**: ~400 (estimated)
- **Tests**: 28/28 passing ✅
- **Verification**: Complete with all 1,558 taxonomy entries loaded

### 2. Workflow State Schema
- **Python**: `src/email_parser/workflow/state.py` (lines 15-404)
- **TypeScript**: `src/browser/agents/iab-classifier/state.ts`
- **Lines**: 575 (TS includes comments)
- **Elements**: 31 (24 fields + 7 functions)
- **Verification**: 31/31 elements verified ✅
- **Status**: Complete with batch optimizer integration

### 3. Taxonomy Helper Functions
- **Python**: `src/email_parser/workflow/nodes/analyzers.py` (lines 30-162)
- **TypeScript**: `src/browser/agents/iab-classifier/helpers.ts`
- **Lines**: 224
- **Functions**: 3 (lookupTaxonomyEntry, getTaxonomyValue, validateTaxonomyClassification)
- **Verification**: 47/47 elements verified ✅
- **Status**: Complete with 16 edge cases verified

### 4. Batch Optimizer
- **Python**: `src/email_parser/workflow/batch_optimizer.py` (lines 1-227)
- **TypeScript**: `src/browser/agents/iab-classifier/batchOptimizer.ts`
- **Lines**: 226
- **Functions**: 5 (estimateEmailTokens, calculateBatchSize, getBatchFromState, hasMoreBatches, advanceToNextBatch)
- **Verification**: All logic verified ✅
- **Status**: Complete and integrated with state.ts

### 5. Prompts Module
- **Python**: `src/email_parser/workflow/prompts/__init__.py` (lines 1-558)
- **TypeScript**: `src/browser/agents/iab-classifier/prompts.ts`
- **Lines**: 558
- **Constants**: 13 (4 evidence guidelines + 8 agent prompts + 1 judge prompt)
- **Verification**: Character-for-character exact copy ✅
- **Status**: Complete

---

## Pending Migrations ⏳ (6,916+ lines)

### Phase 1: LLM Infrastructure (3,027 lines)

#### 6. Cost Tracker
- **Python**: `src/email_parser/workflow/cost_tracker.py`
- **TypeScript**: `src/browser/agents/iab-classifier/costTracker.ts`
- **Lines**: 230
- **Purpose**: Track API costs per provider/model
- **Dependencies**: None (foundational)
- **Priority**: HIGH (required by llm_wrapper)

#### 7. LLM Client Base
- **Python**: `src/email_parser/llm_clients/base.py`
- **TypeScript**: `src/browser/llm/base.ts`
- **Lines**: 352
- **Classes**: BaseLLMClient, LLMRequest, LLMMessage, LLMResponse
- **Dependencies**: None (foundational)
- **Priority**: HIGH (required by all clients)

#### 8. Model Registry
- **Python**: `src/email_parser/llm_clients/model_registry.py`
- **TypeScript**: `src/browser/llm/modelRegistry.ts`
- **Lines**: 430
- **Purpose**: Model capabilities, pricing, context windows
- **Dependencies**: None (data only)
- **Priority**: HIGH (required by clients)

#### 9. OpenAI Client
- **Python**: `src/email_parser/llm_clients/openai_client.py`
- **TypeScript**: `src/browser/llm/openaiClient.ts`
- **Lines**: 509
- **Dependencies**: base.py, model_registry.py
- **Priority**: HIGH (primary LLM provider)

#### 10. Claude Client
- **Python**: `src/email_parser/llm_clients/claude_client.py`
- **TypeScript**: `src/browser/llm/claudeClient.ts`
- **Lines**: 425
- **Dependencies**: base.py, model_registry.py
- **Priority**: MEDIUM (secondary provider)

#### 11. Ollama Client
- **Python**: `src/email_parser/llm_clients/ollama_client.py`
- **TypeScript**: `src/browser/llm/ollamaClient.ts`
- **Lines**: 338
- **Dependencies**: base.py, model_registry.py
- **Priority**: LOW (local testing only)

#### 12. Google Client
- **Python**: `src/email_parser/llm_clients/google_client.py`
- **TypeScript**: `src/browser/llm/googleClient.ts`
- **Lines**: 307
- **Dependencies**: base.py, model_registry.py
- **Priority**: LOW (optional provider)

#### 13. LLM Wrapper
- **Python**: `src/email_parser/workflow/llm_wrapper.py`
- **TypeScript**: `src/browser/agents/iab-classifier/llmWrapper.ts`
- **Lines**: 402
- **Classes**: AnalyzerLLMClient
- **Methods**: analyze_email(), call_json()
- **Dependencies**: ALL above LLM clients + cost_tracker
- **Priority**: HIGH (required by evidence judge & agents)

**Phase 1 Total:** 3,027 lines

---

### Phase 2: Evidence Validation (365 lines)

#### 14. Evidence Judge
- **Python**: `src/email_parser/workflow/nodes/evidence_judge.py`
- **TypeScript**: `src/browser/agents/iab-classifier/evidenceJudge.ts`
- **Lines**: 365
- **Functions**: 3
  - `evaluate_evidence_quality()` - LLM-as-Judge validation
  - `adjust_confidence_with_evidence_quality()` - Confidence adjustment
  - `should_block_classification()` - Quality gate (< 0.3 blocked)
- **Dependencies**: llm_wrapper.py, prompts (JUDGE_SYSTEM_PROMPT)
- **Priority**: HIGH (required by analyzer nodes)

**Phase 2 Total:** 365 lines

---

### Phase 3: ReAct Agent Framework (2,224 lines)

#### 15. Agent Tools
- **Python**: `src/email_parser/agents/tools.py`
- **TypeScript**: `src/browser/agents/tools.ts`
- **Lines**: 367
- **Purpose**: ReAct agent tool definitions (taxonomy lookup, search, validation)
- **Dependencies**: taxonomy loader, helpers
- **Priority**: HIGH (required by base_agent)

#### 16. Base Agent
- **Python**: `src/email_parser/agents/base_agent.py`
- **TypeScript**: `src/browser/agents/baseAgent.ts`
- **Lines**: 657
- **Classes**: BaseReActAgent
- **Purpose**: ReAct agent framework with reflection, tool calling, iteration limits
- **Dependencies**: llm_wrapper, tools.py
- **Priority**: HIGH (required by all specific agents)

#### 17. Demographics Agent
- **Python**: `src/email_parser/agents/demographics_agent.py`
- **TypeScript**: `src/browser/agents/demographicsAgent.ts`
- **Lines**: 309
- **Function**: `extract_demographics_with_agent()`
- **Dependencies**: base_agent.py, prompts (DEMOGRAPHICS_*)
- **Priority**: HIGH

#### 18. Household Agent
- **Python**: `src/email_parser/agents/household_agent.py`
- **TypeScript**: `src/browser/agents/householdAgent.ts`
- **Lines**: 304
- **Function**: `extract_household_with_agent()`
- **Dependencies**: base_agent.py, prompts (HOUSEHOLD_*)
- **Priority**: HIGH

#### 19. Interests Agent
- **Python**: `src/email_parser/agents/interests_agent.py`
- **TypeScript**: `src/browser/agents/interestsAgent.ts`
- **Lines**: 307
- **Function**: `extract_interests_with_agent()`
- **Dependencies**: base_agent.py, prompts (INTERESTS_*)
- **Priority**: HIGH

#### 20. Purchase Agent
- **Python**: `src/email_parser/agents/purchase_agent.py`
- **TypeScript**: `src/browser/agents/purchaseAgent.ts`
- **Lines**: 308
- **Function**: `extract_purchase_intent_with_agent()`
- **Dependencies**: base_agent.py, prompts (PURCHASE_*)
- **Priority**: HIGH

**Phase 3 Total:** 2,224 lines (367 + 657 + 309 + 304 + 307 + 308)

---

### Phase 4: Analyzer Nodes (1,000 lines)

#### 21. Demographics Analyzer Node
- **Python**: `src/email_parser/workflow/nodes/analyzers.py` (lines 165-342)
- **TypeScript**: `src/browser/agents/iab-classifier/nodes/demographicsAnalyzer.ts`
- **Lines**: ~250
- **Pattern**: 6-step process (get batch → init LLM → run agent → evidence judge → taxonomy validation → build selections)
- **Dependencies**: batch_optimizer, llm_wrapper, demographics_agent, evidence_judge, helpers
- **Priority**: CRITICAL

#### 22. Household Analyzer Node
- **Python**: `src/email_parser/workflow/nodes/analyzers.py` (lines 345-522)
- **TypeScript**: `src/browser/agents/iab-classifier/nodes/householdAnalyzer.ts`
- **Lines**: ~250
- **Dependencies**: Same as demographics
- **Priority**: CRITICAL

#### 23. Interests Analyzer Node
- **Python**: `src/email_parser/workflow/nodes/analyzers.py` (lines 525-702)
- **TypeScript**: `src/browser/agents/iab-classifier/nodes/interestsAnalyzer.ts`
- **Lines**: ~250
- **Dependencies**: Same as demographics
- **Priority**: CRITICAL

#### 24. Purchase Analyzer Node
- **Python**: `src/email_parser/workflow/nodes/analyzers.py` (lines 705-882)
- **TypeScript**: `src/browser/agents/iab-classifier/nodes/purchaseAnalyzer.ts`
- **Lines**: ~250
- **Dependencies**: Same as demographics
- **Priority**: CRITICAL

**Phase 4 Total:** ~1,000 lines

---

### Phase 5: Graph & Orchestration (300+ lines)

#### 25. Workflow Graph
- **Python**: `src/email_parser/workflow/graph.py`
- **TypeScript**: `src/browser/agents/iab-classifier/graph.ts`
- **Lines**: ~300
- **Purpose**: LangGraph StateGraph workflow orchestration
- **Nodes**: load_emails, retrieve_profile, analyze_all, reconcile, update_memory, advance_email
- **Dependencies**: ALL analyzer nodes, state.ts
- **Priority**: FINAL (integrates everything)

#### 26. Additional Nodes (if needed)
- load_emails
- retrieve_profile
- reconcile
- update_memory
- **Lines**: TBD (may be in graph.py)

**Phase 5 Total:** ~300 lines

---

### Phase 6: Testing (TBD lines)

#### 27. TypeScript Tests
- **Python**: `tests/email_parser/` (various test files)
- **TypeScript**: `tests/browser/agents/iab-classifier/`
- **Lines**: TBD
- **Coverage**: All functions, edge cases, integration tests
- **Priority**: CONTINUOUS (test each component as ported)

---

## Dependency Tree Visualization

```
┌─ IAB Taxonomy Loader ✅ (foundational)
│
├─ WorkflowState ✅
│  └─ Batch Optimizer ✅
│
├─ Helper Functions ✅
│  └─ Taxonomy Loader ✅
│
├─ Prompts Module ✅ (data only)
│
├─ Cost Tracker ⏳
│
├─ LLM Clients Infrastructure ⏳
│  ├─ Base Client ⏳ (foundational)
│  ├─ Model Registry ⏳ (data)
│  ├─ OpenAI Client ⏳
│  ├─ Claude Client ⏳
│  ├─ Ollama Client ⏳
│  └─ Google Client ⏳
│
├─ LLM Wrapper ⏳
│  ├─ LLM Clients ⏳
│  └─ Cost Tracker ⏳
│
├─ Evidence Judge ⏳
│  ├─ LLM Wrapper ⏳
│  └─ Prompts ✅
│
├─ ReAct Agent Framework ⏳
│  ├─ Agent Tools ⏳
│  │  ├─ Taxonomy Loader ✅
│  │  └─ Helpers ✅
│  │
│  ├─ Base Agent ⏳
│  │  ├─ LLM Wrapper ⏳
│  │  └─ Agent Tools ⏳
│  │
│  └─ Specific Agents (4) ⏳
│     ├─ Base Agent ⏳
│     └─ Prompts ✅
│
├─ Analyzer Nodes (4) ⏳
│  ├─ Batch Optimizer ✅
│  ├─ LLM Wrapper ⏳
│  ├─ Specific Agents (4) ⏳
│  ├─ Evidence Judge ⏳
│  └─ Helpers ✅
│
└─ Workflow Graph ⏳
   ├─ Analyzer Nodes (4) ⏳
   └─ WorkflowState ✅
```

---

## Critical Path Analysis

**To enable a single analyzer node to work:**

1. ✅ Taxonomy Loader (foundational) - COMPLETE
2. ✅ WorkflowState + Batch Optimizer - COMPLETE
3. ✅ Helper Functions - COMPLETE
4. ✅ Prompts Module - COMPLETE
5. ⏳ Cost Tracker (230 lines) - NEXT
6. ⏳ LLM Base Classes (352 lines)
7. ⏳ Model Registry (430 lines)
8. ⏳ OpenAI Client (509 lines)
9. ⏳ LLM Wrapper (402 lines)
10. ⏳ Evidence Judge (365 lines)
11. ⏳ Agent Tools (367 lines)
12. ⏳ Base Agent (657 lines)
13. ⏳ Demographics Agent (309 lines)
14. ⏳ Demographics Analyzer Node (250 lines)

**Minimum Critical Path:** ~4,400 lines remaining to get ONE analyzer working

**Full System:** ~6,916 lines to get ALL 4 analyzers + graph working

---

## Porting Order (Optimized for Dependencies)

### Batch 1: LLM Infrastructure Foundation (230 + 352 + 430 = 1,012 lines)
1. Cost Tracker (230)
2. LLM Base Classes (352)
3. Model Registry (430)

### Batch 2: LLM Clients (509 + 425 = 934 lines minimum)
4. OpenAI Client (509) - PRIMARY
5. Claude Client (425) - SECONDARY
   - Ollama (338) and Google (307) can be deferred

### Batch 3: LLM Integration (402 + 365 = 767 lines)
6. LLM Wrapper (402)
7. Evidence Judge (365)

### Batch 4: Agent Framework (367 + 657 = 1,024 lines)
8. Agent Tools (367)
9. Base Agent (657)

### Batch 5: Specific Agents (309 + 304 + 307 + 308 = 1,228 lines)
10. Demographics Agent (309)
11. Household Agent (304)
12. Interests Agent (307)
13. Purchase Agent (308)

### Batch 6: Analyzer Nodes (~1,000 lines)
14. Demographics Analyzer Node (~250)
15. Household Analyzer Node (~250)
16. Interests Analyzer Node (~250)
17. Purchase Analyzer Node (~250)

### Batch 7: Graph Orchestration (~300 lines)
18. Workflow Graph (~300)

---

## Current Progress

**Completed:** 1,568 lines (18% of estimated total)

**Next:** Cost Tracker (230 lines) → Start of LLM infrastructure batch

**Estimated Completion:**
- At current pace (~500 lines/session with full verification)
- **Remaining:** ~6,916 lines
- **Sessions needed:** ~14 sessions
- **Timeline:** ~2-3 weeks of systematic porting

---

## Verification Standards

Every ported module must have:
- ✅ Python source read completely
- ✅ Structure extraction documented
- ✅ Line-by-line comparison tables
- ✅ TypeScript with Python line references
- ✅ Verification document (COMPONENT_VERIFICATION.md)
- ✅ 100% element match (divergences = 0 or explicitly justified)
- ✅ Tests ported and passing

**NO COMPROMISES. NO SHORTCUTS. FULL AND PRECISE PORT.**

---

**Last Updated:** 2025-01-07

**Status:** Systematically porting - Phase 1 (LLM Infrastructure) next
