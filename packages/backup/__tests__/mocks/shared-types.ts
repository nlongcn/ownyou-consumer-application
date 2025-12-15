/**
 * Mock for @ownyou/shared-types module
 */

export const NAMESPACES = {
  SEMANTIC_MEMORY: 'ownyou.semantic',
  EPISODIC_MEMORY: 'ownyou.episodic',
  ENTITIES: 'ownyou.entities',
  IAB_CLASSIFICATIONS: 'ownyou.iab.classifications',
  IAB_PROFILE: 'ownyou.iab.profile',
  IKIGAI_PROFILE: 'ownyou.ikigai.profile',
  MISSION_CARDS: 'ownyou.missions.cards',
  MISSION_COMPLETIONS: 'ownyou.missions.completions',
  EARNINGS: 'ownyou.earnings',
  PREFERENCES: 'ownyou.preferences',
  DATA_SOURCES: 'ownyou.data_sources',
  SYNC_STATE: 'ownyou.sync.state',
  DEVICE_REGISTRATION: 'ownyou.device.registration',
  BACKUP_METADATA: 'ownyou.backup.metadata',
} as const;

export type NamespaceKey = keyof typeof NAMESPACES;
export type NamespaceValue = typeof NAMESPACES[NamespaceKey];
