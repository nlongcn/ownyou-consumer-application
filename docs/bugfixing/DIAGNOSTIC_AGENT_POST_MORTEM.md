# Post-Mortem: Diagnostic Agent Architectural Non-Conformance

**Date:** 2025-12-08
**Sprint:** Sprint 8 - Data Sources (Financial, Calendar) + Diagnostic Agent
**Severity:** High (Architectural violation requiring complete rewrite)

---

## Executive Summary

The Diagnostic Agent was implemented as a standalone class instead of extending the `BaseAgent` pattern used by all other mission agents. This violated v13 architecture Section 3.6 and required a complete rewrite of the agent implementation.

**Root cause:** Failure to reference existing agent implementations during development, combined with treating the diagnostic domain as "different" from other agents.

---

## What Happened

### Expected Architecture (v13 Section 3.6)

All mission agents must:
1. Extend `BaseAgent` from `@ownyou/agents-base`
2. Declare `agentType` and `level` as readonly properties
3. Implement `execute(context: AgentContext): Promise<AgentResult>`
4. Return `MissionCard` objects via `AgentResult`
5. Use `recordToolCall()` and `recordMemoryOp()` for tracking
6. Override `describeTrigger()` and `extractTags()` for episode recording

### What Was Built Instead

The original Diagnostic Agent was built as:
1. Standalone class (no BaseAgent extension)
2. Custom method `runDiagnostic(context: AnalysisContext)` instead of `execute()`
3. Custom `DiagnosticAgentConfig` incompatible with BaseAgent
4. Custom return type `DiagnosticResult` instead of `AgentResult`
5. No `MissionCard` generation (returned `DiagnosticReport` directly)
6. No tool call or memory operation recording
7. No episode recording support

### Discovery

The issue was discovered during code review when comparing the Diagnostic Agent to Restaurant/Travel agents:

```typescript
// Restaurant Agent (CORRECT)
class RestaurantAgent extends BaseAgent {
  readonly agentType = 'restaurant';
  readonly level = 'L2';
  protected async execute(context: AgentContext): Promise<AgentResult>
}

// Diagnostic Agent (WRONG - before fix)
class DiagnosticAgent {
  private config: DiagnosticAgentConfig;
  async runDiagnostic(context: AnalysisContext): Promise<DiagnosticResult>
}
```

---

## Root Cause Analysis

### 1. No Reference to Existing Implementations

**Problem:** The Diagnostic Agent was built without reading the Restaurant, Travel, or Events agent implementations first.

**Why it happened:** The sprint spec described the *domain logic* (profile analysis, pattern detection, insights) but I focused on that domain logic without verifying the *structural requirements*.

**What should have happened:** Before writing any agent code, I should have:
```bash
# Read BaseAgent interface
cat packages/agents/base/src/base-agent.ts

# Read a reference implementation
cat packages/agents/restaurant/src/agent.ts
```

### 2. Treating Diagnostic as "Different"

**Problem:** I implicitly treated the Diagnostic Agent as a "meta" or "system" agent that was somehow different from user-facing mission agents.

**Why it happened:** The diagnostic domain (profile analysis, patterns, insights) felt more analytical/background than action-oriented agents like Restaurant or Travel. This led to unconsciously designing a different structure.

**Reality:** All agents, regardless of domain, must conform to BaseAgent pattern. The uniformity is the point - it enables:
- Consistent episode recording
- Unified mission card handling
- Standardized tool/memory tracking
- Pluggable agent orchestration

### 3. Missing Architectural Validation Step

**Problem:** No step in my process validated architectural conformance before marking implementation complete.

**Why it happened:** I had tests passing (63 tests!) but they tested the *wrong interface*. Tests validated that `runDiagnostic()` worked correctly, not that the class structure matched the architectural pattern.

**What should have happened:** Tests should have included structural validation:
```typescript
// This test would have caught the error
it('should extend BaseAgent', () => {
  expect(agent).toBeInstanceOf(BaseAgent);
});

it('should implement AgentResult interface', async () => {
  const result = await agent.run(context);
  expect(result).toHaveProperty('success');
  expect(result).toHaveProperty('missionCard');
});
```

### 4. Rule-Based vs LLM Initial Approach

**Problem:** The initial implementation used rule-based insight generation instead of LLM.

**Why it happened:** I incorrectly assumed that "simpler is better" without considering that:
- All mission agents use LLM for their domain logic
- The architecture specifically designates agents as LLM inference points
- Rule-based systems don't scale and become maintenance burdens

**This was corrected** in a previous session, but demonstrates the same pattern: not referencing how other agents actually work.

---

## Impact

| Aspect | Impact |
|--------|--------|
| **Code rewrite** | Complete rewrite of `agent.ts` (524 lines) |
| **Test rewrite** | Complete rewrite of `agent.test.ts` (463 lines) |
| **Time lost** | ~2 hours of development time |
| **Risk** | If merged without review, would create architectural debt and non-uniform agent behavior |

---

## Corrective Actions Taken

### Immediate Fixes

1. **Rewrote `agent.ts`** to extend `BaseAgent`:
   - `class DiagnosticAgent extends BaseAgent`
   - `execute()` method replacing `runDiagnostic()`
   - Proper `recordToolCall()` and `recordMemoryOp()` usage
   - `MissionCard` generation
   - Episode recording overrides

2. **Updated `types.ts`**:
   - Added `DiagnosticTriggerData` matching v13 pattern
   - Added `DIAGNOSTIC_PERMISSIONS` with proper namespace access
   - Added configurable urgency thresholds

3. **Rewrote `agent.test.ts`**:
   - Tests use `AgentContext` and mock `AgentStore`
   - Tests call `agent.run(context)` not custom methods
   - Tests verify mission card generation and tool call recording

### Verification

```
✓ src/__tests__/patterns.test.ts   (14 tests)
✓ src/__tests__/insights.test.ts   (15 tests)
✓ src/__tests__/completeness.test.ts (13 tests)
✓ src/__tests__/agent.test.ts      (21 tests)

Test Files  4 passed (4)
Tests       63 passed (63)
```

---

## Preventive Measures

### For Future Agent Development

1. **Mandatory Reference Reading**

   Before implementing ANY new agent:
   ```bash
   # Read base interface
   cat packages/agents/base/src/base-agent.ts

   # Read reference implementation
   cat packages/agents/restaurant/src/agent.ts
   ```

2. **Structural Tests First**

   Write these tests BEFORE implementing:
   ```typescript
   it('should extend BaseAgent', () => {
     expect(agent).toBeInstanceOf(BaseAgent);
   });

   it('should have correct agentType', () => {
     expect(agent.agentType).toBe('expected-type');
   });

   it('should return AgentResult with missionCard', async () => {
     const result = await agent.run(context);
     expect(result.missionCard).toBeDefined();
   });
   ```

3. **v13-compliance-check Skill**

   Use the `v13-compliance-check` skill BEFORE marking any agent implementation complete. This skill exists precisely to catch these violations.

4. **Code Review Checklist**

   Add to code review:
   - [ ] Agent extends BaseAgent?
   - [ ] Uses execute() not custom run methods?
   - [ ] Returns AgentResult with MissionCard?
   - [ ] Uses recordToolCall/recordMemoryOp?
   - [ ] Has describeTrigger/extractTags overrides?

---

## Lessons Learned

### 1. Uniformity > Uniqueness

Every agent feeling "different" is a red flag. The whole point of the BaseAgent pattern is uniformity. If an agent seems to need a different structure, that's a signal to re-examine assumptions, not to build something different.

### 2. Tests Can Pass While Architecture Fails

63 passing tests meant nothing because they tested the wrong interface. Tests must include structural/architectural assertions, not just behavioral ones.

### 3. Domain Complexity ≠ Structural Complexity

The Diagnostic Agent has complex domain logic (profile analysis, pattern detection, LLM insights). This complexity should live in the `execute()` method and helper functions, not in a different class structure.

### 4. Reference Implementations Exist for a Reason

Restaurant, Travel, and Events agents were built first specifically to establish the pattern. Not reading them before building Diagnostic was the fundamental error.

---

## Conclusion

The architectural failure stemmed from treating implementation as a domain logic exercise rather than a pattern conformance exercise. The domain logic (completeness analysis, pattern detection, insight generation) was correct - it was placed in the wrong structure.

**Key takeaway:** Before building any new component, answer: "What existing thing is this like, and how does that thing work?"

---

**Fix verified:** All 63 tests passing
**Agent structure:** Conforms to BaseAgent pattern
**v13 compliance:** Verified
