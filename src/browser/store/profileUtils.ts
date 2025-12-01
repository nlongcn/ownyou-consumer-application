/**
 * Profile Management Utilities
 *
 * Utilities for managing user profiles in IndexedDB:
 * - Switch between different user profiles
 * - Reset/clear profile data
 * - List available profiles
 *
 * Phase 1: Minimal Testing Support
 * - No IndexedDBStore changes needed
 * - Uses existing search() + delete() methods
 */

import type { IndexedDBStore } from './IndexedDBStore'

/**
 * Clear all data for a specific user profile.
 *
 * Deletes all items in the following namespaces:
 * - [user_id, "iab_taxonomy_profile"] - IAB classifications
 *
 * @param store IndexedDBStore instance
 * @param userId User ID to clear
 * @returns Number of items deleted
 *
 * @example
 * ```typescript
 * const store = new IndexedDBStore('ownyou_store')
 * const deletedCount = await clearUserProfile(store, 'test_user_1')
 * console.log(`Deleted ${deletedCount} items`)
 * ```
 */
export async function clearUserProfile(
  store: IndexedDBStore,
  userId: string
): Promise<number> {
  let deletedCount = 0

  // Clear IAB taxonomy profile (semantic classifications)
  try {
    const items = await store.search([userId, 'iab_taxonomy_profile'], { limit: 10000 })
    console.log(`Found ${items.length} items to delete for user ${userId}`)
    for (const item of items) {
      await store.delete(item.namespace, item.key)
      deletedCount++
    }
  } catch (error) {
    console.error(`Failed to clear IAB taxonomy profile for ${userId}:`, error)
  }

  return deletedCount
}

/**
 * Get all unique user IDs from the store.
 *
 * Scans all namespaces and extracts unique user IDs.
 * Useful for profile selection dropdown.
 *
 * @param store IndexedDBStore instance
 * @returns Array of user IDs
 *
 * @example
 * ```typescript
 * const userIds = await listUserProfiles(store)
 * // ['default_user', 'test_user_1', 'alice']
 * ```
 */
export async function listUserProfiles(store: IndexedDBStore): Promise<string[]> {
  try {
    const namespaces = await store.listNamespaces()

    // Extract unique user IDs (first element of namespace array)
    const userIds = new Set<string>()
    for (const namespace of namespaces) {
      if (namespace.length > 0) {
        userIds.add(namespace[0])
      }
    }

    return Array.from(userIds).sort()
  } catch (error) {
    console.error('Failed to list user profiles:', error)
    return []
  }
}

/**
 * Get profile statistics for a user.
 *
 * Returns counts of items in IAB taxonomy profile namespace.
 *
 * @param store IndexedDBStore instance
 * @param userId User ID to get stats for
 * @returns Profile statistics
 *
 * @example
 * ```typescript
 * const stats = await getProfileStats(store, 'default_user')
 * console.log(`Classifications: ${stats.classificationsCount}`)
 * console.log(`Total: ${stats.totalCount}`)
 * ```
 */
export async function getProfileStats(
  store: IndexedDBStore,
  userId: string
): Promise<{
  classificationsCount: number
  totalCount: number
}> {
  try {
    const items = await store.search([userId, 'iab_taxonomy_profile'], { limit: 10000 })

    const classificationsCount = items.length
    const totalCount = classificationsCount

    return { classificationsCount, totalCount }
  } catch (error) {
    console.error(`Failed to get profile stats for ${userId}:`, error)
    return { classificationsCount: 0, totalCount: 0 }
  }
}

/**
 * Check if a user profile exists (has any data).
 *
 * @param store IndexedDBStore instance
 * @param userId User ID to check
 * @returns True if profile exists (has any data)
 *
 * @example
 * ```typescript
 * const exists = await profileExists(store, 'test_user_1')
 * if (!exists) {
 *   console.log('Profile is empty')
 * }
 * ```
 */
export async function profileExists(
  store: IndexedDBStore,
  userId: string
): Promise<boolean> {
  try {
    const stats = await getProfileStats(store, userId)
    return stats.totalCount > 0
  } catch (error) {
    console.error(`Failed to check if profile exists for ${userId}:`, error)
    return false
  }
}
