/**
 * Context Injection - v13 Section 8.8.2
 *
 * At mission start, relevant memories are automatically injected
 * into the agent's context. This provides:
 * - Relevant semantic memories (what we know about the user)
 * - Similar past episodes (few-shot learning examples)
 * - Procedural rules (learned behaviors)
 */

import type { Memory, Episode, ProceduralRule } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { retrieveMemories } from '@ownyou/memory';
import { getProceduralRules } from './procedural-synthesis';
import type { AgentContext } from './types';

export { type AgentContext } from './types';

/**
 * Build context for an agent starting a mission
 *
 * This retrieves relevant memories, past episodes, and learned
 * behavioral rules to inject into the agent's system prompt.
 */
export async function buildAgentContext(
  userId: string,
  agentType: string,
  triggerDescription: string,
  store: MemoryStore
): Promise<AgentContext> {
  // 1. Retrieve relevant semantic memories
  const semanticMemories = await retrieveMemories({
    query: triggerDescription,
    userId,
    store,
    options: { limit: 10, context: agentType },
  });

  // 2. Get similar past episodes for few-shot learning
  const allEpisodes = await store.list<Episode>(NS.episodicMemory(userId));
  const agentEpisodes = allEpisodes.items
    .filter((e) => e.agentType === agentType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  // 3. Load procedural rules for this agent
  const proceduralRules = await getProceduralRules(userId, agentType, store);

  return {
    semanticMemories,
    similarEpisodes: agentEpisodes,
    proceduralRules,
  };
}

/**
 * Format context for injection into agent system prompt
 */
export function formatContextForPrompt(context: AgentContext): string {
  const sections: string[] = [];

  // Format semantic memories
  if (context.semanticMemories.length > 0) {
    sections.push(`## What You Know About This User

${context.semanticMemories.map((m) => `- ${m.content} (confidence: ${m.confidence})`).join('\n')}`);
  }

  // Format episodes as few-shot examples
  if (context.similarEpisodes.length > 0) {
    sections.push(`## Relevant Past Experiences

${context.similarEpisodes
  .map(
    (e) => `**${e.outcome === 'success' ? 'SUCCESS' : 'FAILURE'}**: ${e.situation}
  - Approach: ${e.reasoning}
  - Action: ${e.action}
  - Feedback: ${e.userFeedback || 'none'}`
  )
  .join('\n\n')}`);
  }

  // Format procedural rules
  if (context.proceduralRules.length > 0) {
    sections.push(`## Learned Behaviors for This User

${context.proceduralRules.map((r) => `- ${r.rule}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Create enriched system prompt with memory context
 */
export function createEnrichedSystemPrompt(basePrompt: string, context: AgentContext): string {
  const memoryContext = formatContextForPrompt(context);

  if (!memoryContext) {
    return basePrompt;
  }

  return `${basePrompt}

---

${memoryContext}`;
}

/**
 * Build context with privacy tier filtering
 *
 * Only includes memories accessible at the specified privacy level
 */
export async function buildAgentContextWithPrivacy(
  userId: string,
  agentType: string,
  triggerDescription: string,
  store: MemoryStore,
  maxPrivacyTier: 'public' | 'sensitive' | 'private'
): Promise<AgentContext> {
  const baseContext = await buildAgentContext(userId, agentType, triggerDescription, store);

  // Filter memories by privacy tier
  const privacyOrder = { public: 0, sensitive: 1, private: 2 };
  const maxLevel = privacyOrder[maxPrivacyTier];

  const filteredMemories = baseContext.semanticMemories.filter(
    (m) => privacyOrder[m.privacyTier ?? 'public'] <= maxLevel
  );

  return {
    ...baseContext,
    semanticMemories: filteredMemories,
  };
}

/**
 * Get context summary statistics
 *
 * Useful for debugging and monitoring
 */
export function getContextStats(context: AgentContext): {
  memoryCount: number;
  episodeCount: number;
  ruleCount: number;
  estimatedTokens: number;
} {
  const formatted = formatContextForPrompt(context);
  // Rough token estimate: ~4 characters per token
  const estimatedTokens = Math.ceil(formatted.length / 4);

  return {
    memoryCount: context.semanticMemories.length,
    episodeCount: context.similarEpisodes.length,
    ruleCount: context.proceduralRules.length,
    estimatedTokens,
  };
}
