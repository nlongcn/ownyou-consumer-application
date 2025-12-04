/**
 * Reflection Node - v13 Section 8.10
 *
 * Background process that synthesizes patterns and maintains memory quality.
 *
 * Runs 6 phases:
 * 1. CONSOLIDATION - merge similar memories
 * 2. DECAY & PRUNE - remove low-value memories
 * 3. SUMMARIZATION - generate community summaries
 * 4. PROCEDURAL SYNTHESIS - extract rules from episode patterns
 * 5. TEMPORAL VALIDATION - mark outdated facts as invalid
 * 6. ENTITY EXTRACTION - extract entities from new memories
 */

import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';
import { pruneMemories } from '@ownyou/memory';
import { synthesizeProceduralRules } from './procedural-synthesis';
import { validateTemporalFacts } from './temporal-validation';
import { extractEntitiesFromNewMemories } from './entity-extraction';
import type { ReflectionTrigger, ReflectionConfig, ReflectionResult, CommunitySummary } from './types';

export const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  afterEpisodes: 5,
  dailyIdleHour: 3,
  weeklyMaintenanceDay: 0, // Sunday
};

/**
 * Run the Reflection Node
 *
 * Executes all 6 phases of reflection based on the trigger type.
 */
export async function runReflection(
  userId: string,
  trigger: ReflectionTrigger,
  store: MemoryStore,
  llm: LLMClient
): Promise<ReflectionResult> {
  const startTime = Date.now();

  // 1. CONSOLIDATION - merge similar memories
  // (Deferred to background - computationally expensive)
  // This is handled by saveObservation during write time

  // 2. DECAY & PRUNE - remove low-value memories
  const pruneResult = await pruneMemories(userId, store);

  // 3. SUMMARIZATION - generate community summaries
  // (Run weekly only to save LLM costs)
  if (trigger.type === 'weekly_maintenance') {
    await generateCommunitySummaries(userId, store, llm);
  }

  // 4. PROCEDURAL SYNTHESIS - extract rules from episode patterns
  const rulesGenerated = await synthesizeProceduralRules(userId, store, llm);

  // 5. TEMPORAL VALIDATION - mark outdated facts as invalid
  const factsInvalidated = await validateTemporalFacts(userId, store);

  // 6. ENTITY EXTRACTION - extract entities from new memories
  const entitiesExtracted = await extractEntitiesFromNewMemories(userId, store, llm);

  return {
    trigger,
    memoriesPruned: pruneResult.pruned,
    rulesGenerated,
    factsInvalidated,
    entitiesExtracted,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Generate community summaries - v13 Section 8.9.4
 *
 * Creates high-level summaries for each context domain.
 * These can be used for quick context without loading all memories.
 */
async function generateCommunitySummaries(
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<void> {
  const contexts = ['travel', 'shopping', 'dining', 'events', 'content'];

  for (const context of contexts) {
    const memories = await store.search({
      namespace: NS.semanticMemory(userId),
      query: context,
      modes: ['bm25'],
      filter: { context, archived: false },
      limit: 50,
    });

    if (memories.length < 5) continue;

    const response = await llm.complete(userId, {
      operation: 'reflection_node',
      messages: [
        {
          role: 'system',
          content:
            'Analyze these observations about the user and generate a 2-3 sentence summary capturing key patterns.',
        },
        {
          role: 'user',
          content: `${context} observations:\n${memories.map((m) => `- ${m.item.content}`).join('\n')}`,
        },
      ],
      maxTokens: 200,
      temperature: 0.1,
    });

    const summary: CommunitySummary = {
      summary: response.content,
      sourceCount: memories.length,
      generatedAt: Date.now(),
    };

    await store.put(['ownyou.summaries', userId], context, summary);
  }
}

/**
 * Get community summary for a context
 */
export async function getCommunitySummary(
  userId: string,
  context: string,
  store: MemoryStore
): Promise<CommunitySummary | null> {
  return store.get<CommunitySummary>(['ownyou.summaries', userId], context);
}

/**
 * Check if reflection should run based on current state
 */
export function shouldTriggerReflection(
  episodesSinceLastReflection: number,
  config: ReflectionConfig = DEFAULT_REFLECTION_CONFIG
): { shouldRun: boolean; trigger?: ReflectionTrigger } {
  // After N episodes
  if (episodesSinceLastReflection >= config.afterEpisodes) {
    return {
      shouldRun: true,
      trigger: { type: 'after_episodes', count: episodesSinceLastReflection },
    };
  }

  // Check for daily idle trigger
  const now = new Date();
  if (now.getHours() === config.dailyIdleHour) {
    return {
      shouldRun: true,
      trigger: { type: 'daily_idle' },
    };
  }

  // Check for weekly maintenance trigger
  if (now.getDay() === config.weeklyMaintenanceDay && now.getHours() === config.dailyIdleHour) {
    return {
      shouldRun: true,
      trigger: { type: 'weekly_maintenance' },
    };
  }

  return { shouldRun: false };
}

/**
 * Create a trigger for negative feedback
 */
export function createNegativeFeedbackTrigger(episodeId: string): ReflectionTrigger {
  return { type: 'after_negative_feedback', episodeId };
}
