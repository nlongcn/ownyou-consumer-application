/**
 * Sync Scope Configuration - v13 Section 8.14
 *
 * Defines which namespaces sync across devices and how.
 *
 * @see docs/architecture/extracts/sync-8.14.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 8.14
 */

import type { SyncScopeConfig, SelectiveRule } from '../types.js';

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
  'ownyou.semantic': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.procedural': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.entities': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.relationships': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.summaries': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.iab': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.ikigai': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.ikigai_evidence': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.missions': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.mission_feedback': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.earnings': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.pseudonyms': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.disclosures': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.tracking_consents': { shouldSync: true, syncStrategy: 'full' },

  // Sprint 7: Agent-specific namespaces - Full sync
  'ownyou.dining_reservations': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.restaurant_favorites': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.event_tickets': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.event_favorites': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.travel_itineraries': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.travel_preferences': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.calendar': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.financial_profile': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.interests': { shouldSync: true, syncStrategy: 'full' },

  // Sprint 8: Data source namespaces - Selective sync
  'ownyou.financial_transactions': {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: [{ condition: 'age_days_less_than', value: 90 }],
  },
  'ownyou.calendar_events': {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: [{ condition: 'age_days_less_than', value: 90 }],
  },
  'ownyou.calendar_profile': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.calendar_contacts': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.diagnostic_reports': { shouldSync: true, syncStrategy: 'full' },

  // Reflection state - Full sync for consistency
  'ownyou.reflection': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.llm_budget': { shouldSync: true, syncStrategy: 'full' },

  // ⚠️ Selective sync - Episodic memory
  'ownyou.episodic': {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: EPISODIC_SYNC_RULES,
  },

  // ❌ Device-local only - Never sync
  'ownyou.embedding.queue': { shouldSync: false },
  'ownyou.sync.metadata': { shouldSync: false },
  'ownyou.sync.queue': { shouldSync: false },
  'ownyou.temp': { shouldSync: false },
  'ownyou.llm_cache': { shouldSync: false },

  // Sprint 9: Debug namespaces - Device-local only
  'ownyou.debug.traces': { shouldSync: false },
  'ownyou.debug.sync': { shouldSync: false },
  'ownyou.debug.llm': { shouldSync: false },
  'ownyou.debug.errors': { shouldSync: false },
  'ownyou.debug.audit': { shouldSync: false },
  'ownyou.traces': { shouldSync: false },
  'ownyou.llm_usage': { shouldSync: false },
  'ownyou.sync_logs': { shouldSync: false },
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
