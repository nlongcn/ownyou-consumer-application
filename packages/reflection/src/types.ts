/**
 * Reflection Types - v13 Section 8.10
 */

import type { Memory, Episode, ProceduralRule } from '@ownyou/shared-types';

/**
 * Trigger types for reflection
 */
export type ReflectionTrigger =
  | { type: 'after_episodes'; count: number }
  | { type: 'daily_idle' }
  | { type: 'after_negative_feedback'; episodeId: string }
  | { type: 'weekly_maintenance' };

/**
 * Configuration for reflection timing
 */
export interface ReflectionConfig {
  afterEpisodes: number; // Run after N episodes (default: 5)
  dailyIdleHour: number; // Hour to run daily (default: 3 = 3 AM)
  weeklyMaintenanceDay: number; // Day of week (default: 0 = Sunday)
}

/**
 * Result of a reflection run
 */
export interface ReflectionResult {
  trigger: ReflectionTrigger;
  memoriesPruned: number;
  rulesGenerated: number;
  factsInvalidated: number;
  entitiesExtracted: number;
  durationMs: number;
}

/**
 * Agent context for memory injection
 */
export interface AgentContext {
  semanticMemories: Memory[];
  similarEpisodes: Episode[];
  proceduralRules: ProceduralRule[];
}

/**
 * Trigger state for managing reflection timing
 */
export interface TriggerState {
  episodesSinceLastReflection: number;
  lastReflectionTime: number;
  lastDailyReflection: number;
  lastWeeklyReflection: number;
}

/**
 * Community summary for a context domain
 */
export interface CommunitySummary {
  summary: string;
  sourceCount: number;
  generatedAt: number;
}

/**
 * Temporal validation result
 */
export interface TemporalValidationResult {
  memoryId: string;
  invalidated: boolean;
  reason?: string;
}
