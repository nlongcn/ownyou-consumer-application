/**
 * @ownyou/reflection - Reflection Node Package
 *
 * v13 Section 8.10: Background process for memory synthesis and maintenance.
 *
 * This package provides:
 * - Reflection Node orchestrator (6-phase process)
 * - Procedural rule synthesis from episode patterns
 * - Automatic context injection for agents
 * - Temporal validation for fact freshness
 * - Entity extraction from memories
 * - Trigger management for reflection scheduling
 *
 * @example
 * ```typescript
 * import {
 *   runReflection,
 *   buildAgentContext,
 *   createEnrichedSystemPrompt,
 *   ReflectionTriggerManager,
 * } from '@ownyou/reflection';
 *
 * // Run reflection manually
 * const result = await runReflection(userId, { type: 'after_episodes', count: 5 }, store, llm);
 *
 * // Build context for an agent
 * const context = await buildAgentContext(userId, 'shopping', 'Find deals on electronics', store);
 * const enrichedPrompt = createEnrichedSystemPrompt(basePrompt, context);
 *
 * // Use trigger manager for automatic scheduling
 * const manager = new ReflectionTriggerManager(userId, store, llm);
 * await manager.loadState();
 * await manager.onEpisodeSaved(); // May trigger reflection
 * ```
 */

// Types
export type {
  ReflectionTrigger,
  ReflectionConfig,
  ReflectionResult,
  AgentContext,
  TriggerState,
  CommunitySummary,
  TemporalValidationResult,
} from './types';

// Reflection Node
export {
  runReflection,
  getCommunitySummary,
  shouldTriggerReflection,
  createNegativeFeedbackTrigger,
  DEFAULT_REFLECTION_CONFIG,
} from './reflection-node';

// Procedural Synthesis
export {
  synthesizeProceduralRules,
  getProceduralRules,
  recordRuleOverride,
  retireOverriddenRules,
} from './procedural-synthesis';

// Context Injection
export {
  buildAgentContext,
  buildAgentContextWithPrivacy,
  formatContextForPrompt,
  createEnrichedSystemPrompt,
  getContextStats,
} from './context-injection';

// Temporal Validation
export {
  validateTemporalFacts,
  getMemoriesNeedingVerification,
} from './temporal-validation';

// Entity Extraction
export {
  extractEntitiesFromNewMemories,
  getEntities,
  getRelationships,
  findEntitiesByName,
  type EntityType,
  type ExtractedEntity,
  type EntityRelationship,
} from './entity-extraction';

// Trigger Manager
export { ReflectionTriggerManager } from './triggers';
