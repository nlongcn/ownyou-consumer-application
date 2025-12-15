/**
 * Sync Scope Configuration - v13 Section 8.14
 *
 * Defines which namespaces sync across devices and how.
 *
 * @see docs/architecture/extracts/sync-8.14.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 8.14
 */

import type { SyncScopeConfig, SelectiveRule } from '../types.js';
import { NAMESPACES } from '@ownyou/shared-types';

/**
 * Episodic memory sync rules
 *
 * Episodes sync if they are:
 * - Recent (less than 30 days old)
 * - Had negative outcome (learning opportunities)
 * - Have user feedback
 * - Led to procedural rules
 */
export const EPISODIC_SYNC_RULES: SelectiveRule[] = [
  { condition: 'age_days_less_than', value: 30 },
  { condition: 'outcome_equals', value: 'negative' },
  { condition: 'has_user_feedback', value: true },
  { condition: 'led_to_procedural_rule', value: true },
];

/**
 * Sync scope configuration by namespace
 */
export const SYNC_SCOPE_BY_NAMESPACE: Record<string, SyncScopeConfig> = {
  // ✅ Full sync - User data that must be consistent across devices
  [NAMESPACES.SEMANTIC_MEMORY]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.PROCEDURAL_MEMORY]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.ENTITIES]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.RELATIONSHIPS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.COMMUNITY_SUMMARIES]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.IAB_CLASSIFICATIONS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.IKIGAI_PROFILE]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.IKIGAI_EVIDENCE]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.MISSION_CARDS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.MISSION_FEEDBACK]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.EARNINGS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.PSEUDONYMS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.DISCLOSURE_HISTORY]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.TRACKING_CONSENTS]: { shouldSync: true, syncStrategy: 'full' },

  // Sprint 7: Agent-specific namespaces - Full sync
  [NAMESPACES.DINING_RESERVATIONS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.RESTAURANT_FAVORITES]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.EVENT_TICKETS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.EVENT_FAVORITES]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.TRAVEL_ITINERARIES]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.TRAVEL_PREFERENCES]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.CALENDAR]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.FINANCIAL_PROFILE]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.INTERESTS]: { shouldSync: true, syncStrategy: 'full' },

  // Sprint 8: Data source namespaces - Selective sync
  [NAMESPACES.FINANCIAL_TRANSACTIONS]: {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: [{ condition: 'age_days_less_than', value: 90 }],
  },
  [NAMESPACES.CALENDAR_EVENTS]: {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: [{ condition: 'age_days_less_than', value: 90 }],
  },
  [NAMESPACES.CALENDAR_PROFILE]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.CALENDAR_CONTACTS]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.DIAGNOSTIC_REPORTS]: { shouldSync: true, syncStrategy: 'full' },

  // Reflection state - Full sync for consistency
  [NAMESPACES.REFLECTION_STATE]: { shouldSync: true, syncStrategy: 'full' },
  [NAMESPACES.LLM_BUDGET]: { shouldSync: true, syncStrategy: 'full' },

  // ⚠️ Selective sync - Episodic memory
  [NAMESPACES.EPISODIC_MEMORY]: {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: EPISODIC_SYNC_RULES,
  },

  // ❌ Device-local only - Never sync
  'ownyou.embedding.queue': { shouldSync: false },
  'ownyou.sync.metadata': { shouldSync: false },
  'ownyou.sync.queue': { shouldSync: false },
  'ownyou.temp': { shouldSync: false },
  [NAMESPACES.LLM_CACHE]: { shouldSync: false },

  // Sprint 9: Debug namespaces - Device-local only
  'ownyou.debug.traces': { shouldSync: false },
  'ownyou.debug.sync': { shouldSync: false },
  'ownyou.debug.llm': { shouldSync: false },
  'ownyou.debug.errors': { shouldSync: false },
  'ownyou.debug.audit': { shouldSync: false },
  [NAMESPACES.AGENT_TRACES]: { shouldSync: false },
  [NAMESPACES.LLM_USAGE]: { shouldSync: false },
  [NAMESPACES.SYNC_LOGS]: { shouldSync: false },
};

/**
 * Check if a namespace should sync
 *
 * @param namespace - The namespace to check
 * @returns Whether the namespace should sync (defaults to true)
 */
export function shouldSyncNamespace(namespace: string): boolean {
  const config = SYNC_SCOPE_BY_NAMESPACE[namespace];
  return config?.shouldSync ?? true; // Default: sync
}

/**
 * Get the sync scope configuration for a namespace
 *
 * @param namespace - The namespace to look up
 * @returns The sync scope configuration
 */
export function getSyncScopeConfig(namespace: string): SyncScopeConfig {
  return (
    SYNC_SCOPE_BY_NAMESPACE[namespace] ?? {
      shouldSync: true,
      syncStrategy: 'full',
    }
  );
}

/**
 * Check if an item should sync based on selective rules
 *
 * @param item - The item to check
 * @param rules - The selective sync rules
 * @returns Whether the item should sync
 */
export function shouldSyncItem(
  item: Record<string, unknown>,
  rules: SelectiveRule[]
): boolean {
  // If no rules, sync everything
  if (!rules || rules.length === 0) {
    return true;
  }

  // Item syncs if ANY rule matches (OR logic)
  return rules.some((rule) => evaluateRule(item, rule));
}

/**
 * Evaluate a single selective sync rule
 */
function evaluateRule(item: Record<string, unknown>, rule: SelectiveRule): boolean {
  switch (rule.condition) {
    case 'age_days_less_than': {
      const timestamp = item['timestamp'] as number | undefined;
      if (!timestamp) return false;
      const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
      return ageDays < (rule.value as number);
    }

    case 'outcome_equals':
      return item['outcome'] === rule.value;

    case 'has_user_feedback':
      return Boolean(item['user_feedback']) === rule.value;

    case 'led_to_procedural_rule':
      return Boolean(item['led_to_procedural_rule']) === rule.value;

    default:
      return false;
  }
}

/**
 * Get all syncable namespaces
 */
export function getSyncableNamespaces(): string[] {
  return Object.entries(SYNC_SCOPE_BY_NAMESPACE)
    .filter(([_, config]) => config.shouldSync)
    .map(([namespace]) => namespace);
}

/**
 * Get all device-local namespaces
 */
export function getDeviceLocalNamespaces(): string[] {
  return Object.entries(SYNC_SCOPE_BY_NAMESPACE)
    .filter(([_, config]) => !config.shouldSync)
    .map(([namespace]) => namespace);
}
