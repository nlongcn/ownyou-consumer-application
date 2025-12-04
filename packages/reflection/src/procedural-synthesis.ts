/**
 * Procedural Synthesis - v13 Section 8.10.1
 *
 * Extracts behavioral rules from episode patterns.
 * These rules are injected into agent system prompts.
 */

import type { Episode, ProceduralRule, AgentType } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';

const AGENT_TYPES: AgentType[] = ['travel', 'shopping', 'restaurant', 'events', 'content'];
const MIN_EPISODES_FOR_PATTERNS = 3;
const MIN_RULE_CONFIDENCE = 0.7;

/**
 * Synthesize procedural rules from episode patterns
 *
 * Analyzes recent episodes for each agent type and extracts
 * behavioral rules with high confidence.
 */
/**
 * Stored rules structure with metadata
 */
interface StoredRules {
  rules: ProceduralRule[];
  synthesizedAt: number;
  lastOverride?: number;
  lastRetirement?: number;
}

export async function synthesizeProceduralRules(
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<number> {
  let totalRules = 0;

  for (const agentType of AGENT_TYPES) {
    const rulesGenerated = await synthesizeRulesForAgent(userId, agentType, store, llm);
    totalRules += rulesGenerated;
  }

  return totalRules;
}

/**
 * Synthesize rules for a specific agent type
 */
async function synthesizeRulesForAgent(
  userId: string,
  agentType: AgentType,
  store: MemoryStore,
  llm: LLMClient
): Promise<number> {
  // Get recent episodes for this agent
  const episodes = await store.list<Episode>(NS.episodicMemory(userId));

  const agentEpisodes = episodes.items
    .filter((e) => e.agentType === agentType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  // Need minimum episodes to find patterns
  if (agentEpisodes.length < MIN_EPISODES_FOR_PATTERNS) {
    return 0;
  }

  // Ask LLM to identify patterns
  const response = await llm.complete(userId, {
    operation: 'reflection_node',
    messages: [
      {
        role: 'system',
        content: `You analyze past interactions to identify behavioral rules.

For each rule:
1. State the rule clearly (e.g., "Always suggest X before Y")
2. Explain which episodes support this pattern
3. Rate confidence (0.0-1.0) based on pattern consistency

Output JSON array:
[
  {
    "rule": "string - the behavioral rule",
    "evidence": ["episode_id1", "episode_id2"],
    "confidence": 0.0-1.0
  }
]

Only include rules with confidence >= ${MIN_RULE_CONFIDENCE}.
Return [] if no patterns found.`,
      },
      {
        role: 'user',
        content: `Analyze these ${agentEpisodes.length} past ${agentType} interactions:

${agentEpisodes
  .map(
    (e, i) => `
Episode ${i + 1} (${e.id}):
- Situation: ${e.situation}
- Action: ${e.action}
- Outcome: ${e.outcome}
- Feedback: ${e.userFeedback || 'none'}
`
  )
  .join('\n---\n')}`,
      },
    ],
    maxTokens: 1000,
    temperature: 0.1,
  });

  // Parse rules
  let rules: Array<{ rule: string; evidence: string[]; confidence: number }> = [];
  try {
    rules = JSON.parse(response.content);
  } catch {
    return 0;
  }

  // Filter by confidence threshold
  rules = rules.filter((r) => r.confidence >= MIN_RULE_CONFIDENCE);

  if (rules.length === 0) {
    return 0;
  }

  // Convert to ProceduralRule format
  const proceduralRules: ProceduralRule[] = rules.map((r) => ({
    id: crypto.randomUUID(),
    agentType,
    rule: r.rule,
    derivedFrom: r.evidence,
    confidence: r.confidence,
    createdAt: Date.now(),
    applicationCount: 0,
    overrideCount: 0,
  }));

  // Store synthesized rules
  await store.put(NS.proceduralMemory(userId, agentType), 'rules', {
    rules: proceduralRules,
    synthesizedAt: Date.now(),
  });

  return proceduralRules.length;
}

/**
 * Get procedural rules for an agent (for context injection)
 */
export async function getProceduralRules(
  userId: string,
  agentType: string,
  store: MemoryStore
): Promise<ProceduralRule[]> {
  const stored = await store.get<StoredRules>(
    NS.proceduralMemory(userId, agentType),
    'rules'
  );

  if (!stored) return [];

  // Filter by confidence and sort by confidence descending
  return stored.rules.filter((r) => r.confidence >= 0.5).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Record when a rule was overridden by the user
 *
 * This helps identify rules that may need to be retired
 */
export async function recordRuleOverride(
  userId: string,
  agentType: string,
  ruleId: string,
  store: MemoryStore
): Promise<void> {
  const stored = await store.get<StoredRules>(
    NS.proceduralMemory(userId, agentType),
    'rules'
  );

  if (!stored) return;

  const updatedRules = stored.rules.map((r) => {
    if (r.id === ruleId) {
      return {
        ...r,
        overrideCount: r.overrideCount + 1,
        // Reduce confidence on override
        confidence: Math.max(0.1, r.confidence - 0.1),
      };
    }
    return r;
  });

  await store.put(NS.proceduralMemory(userId, agentType), 'rules', {
    rules: updatedRules,
    synthesizedAt: stored.synthesizedAt,
    lastOverride: Date.now(),
  });
}

/**
 * Retire rules that have been overridden too many times
 */
export async function retireOverriddenRules(
  userId: string,
  agentType: string,
  store: MemoryStore,
  maxOverrides: number = 3
): Promise<number> {
  const stored = await store.get<StoredRules>(
    NS.proceduralMemory(userId, agentType),
    'rules'
  );

  if (!stored) return 0;

  const activeRules = stored.rules.filter((r) => r.overrideCount < maxOverrides);
  const retiredCount = stored.rules.length - activeRules.length;

  if (retiredCount > 0) {
    await store.put(NS.proceduralMemory(userId, agentType), 'rules', {
      rules: activeRules,
      synthesizedAt: stored.synthesizedAt,
      lastRetirement: Date.now(),
    });
  }

  return retiredCount;
}
