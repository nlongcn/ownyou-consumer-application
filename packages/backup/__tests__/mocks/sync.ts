/**
 * Mock for @ownyou/sync module
 */

export function getSyncableNamespaces(): string[] {
  return ['ownyou.test', 'ownyou.profiles', 'ownyou.settings', 'ownyou.large', 'ownyou.special', 'ownyou.data', 'ownyou.wallet', 'ownyou.credentials', 'ownyou.namespace1', 'ownyou.namespace2', 'ownyou.namespace3', 'ownyou.types'];
}

export const SYNCABLE_NAMESPACES = getSyncableNamespaces();
