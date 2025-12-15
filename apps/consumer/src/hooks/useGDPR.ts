/**
 * useGDPR Hook - GDPR data export and deletion
 * Sprint 11b Bugfix 11: Add GDPR export/delete functionality
 *
 * Provides functions to:
 * - Export all user data as a JSON file
 * - Delete all user data from all namespaces
 */

import { useCallback, useState } from 'react';
import { NS, type NamespaceTuple } from '@ownyou/shared-types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

/** Export data structure */
export interface GDPRExport {
  exportDate: string;
  walletAddress: string;
  version: string;
  data: Record<string, unknown[]>;
}

/** Sensitive fields to strip from export (security - prevent token leakage) */
const SENSITIVE_FIELDS = [
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'token',
  'secret',
  'password',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
] as const;

/**
 * Strip sensitive fields from an object to prevent credential leakage in exports
 */
function sanitizeForExport(item: unknown): unknown {
  if (item === null || item === undefined) return item;
  if (typeof item !== 'object') return item;
  if (Array.isArray(item)) return item.map(sanitizeForExport);

  const obj = item as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields entirely
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    // Recursively sanitize nested objects
    sanitized[key] = sanitizeForExport(value);
  }

  return sanitized;
}

/** All namespace functions that take userId */
const USER_NAMESPACES = [
  'semanticMemory',
  'episodicMemory',
  'entities',
  'relationships',
  'iabClassifications',
  'ikigaiProfile',
  'ikigaiEvidence',
  'missionCards',
  'missionFeedback',
  'pseudonyms',
  'earnings',
  'agentTraces',
  'diningReservations',
  'restaurantFavorites',
  'eventTickets',
  'eventFavorites',
  'travelItineraries',
  'travelPreferences',
  'calendar',
  'financialProfile',
  'interests',
  'reflectionState',
  'communitySummaries',
  'financialTransactions',
  'calendarEvents',
  'calendarProfile',
  'calendarContacts',
  'diagnosticReports',
  'syncState',
  'syncPeers',
  'deviceRegistry',
  'backupManifest',
  'backupHistory',
  'recoveryKeyHash',
  'uiPreferences',
  'uiFilterState',
] as const;

/**
 * useGDPR - GDPR compliance hook for data export and deletion
 */
export function useGDPR() {
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated, disconnect } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const userId = wallet?.address ?? '';

  /**
   * Export all user data as a downloadable JSON file
   */
  const exportAllData = useCallback(async (): Promise<GDPRExport> => {
    if (!store || !isReady || !userId) {
      throw new Error('Store not ready or not authenticated');
    }

    setIsExporting(true);
    const exportData: Record<string, unknown[]> = {};

    try {
      // Iterate through all namespaces and collect data
      for (const nsKey of USER_NAMESPACES) {
        try {
          // Get the namespace function from NS
          const nsFn = NS[nsKey as keyof typeof NS];
          if (typeof nsFn !== 'function') continue;

          // Special case for procedural memory and llmUsage which need extra params
          // These are handled separately below
          const skipKeys = ['proceduralMemory', 'llmUsage'];
          if (skipKeys.includes(nsKey)) {
            continue;
          }

          const namespace = (nsFn as (userId: string) => readonly string[])(userId) as NamespaceTuple;

          // List all items in this namespace
          const result = await store.list(namespace, { limit: 1000, offset: 0 });
          if (result.items && result.items.length > 0) {
            // Sanitize to remove sensitive data like OAuth tokens
            exportData[nsKey] = result.items.map(sanitizeForExport) as unknown[];
          }
        } catch (err) {
          // Namespace might not exist or be empty - that's ok
          console.debug(`[GDPR] No data for namespace ${nsKey}:`, err);
        }
      }

      // Handle procedural memory for common agent types
      const agentTypes = ['email', 'calendar', 'financial', 'restaurant', 'events', 'travel'];
      for (const agentType of agentTypes) {
        try {
          const namespace = NS.proceduralMemory(userId, agentType);
          const result = await store.list(namespace, { limit: 1000, offset: 0 });
          if (result.items && result.items.length > 0) {
            exportData[`proceduralMemory_${agentType}`] = result.items.map(sanitizeForExport) as unknown[];
          }
        } catch (err) {
          // Skip if empty
        }
      }

      // Handle llmUsage for daily and monthly
      for (const period of ['daily', 'monthly'] as const) {
        try {
          const namespace = NS.llmUsage(userId, period);
          const result = await store.list(namespace, { limit: 1000, offset: 0 });
          if (result.items && result.items.length > 0) {
            exportData[`llmUsage_${period}`] = result.items.map(sanitizeForExport) as unknown[];
          }
        } catch (err) {
          // Skip if empty
        }
      }

      const gdprExport: GDPRExport = {
        exportDate: new Date().toISOString(),
        walletAddress: userId,
        version: '1.0.0',
        data: exportData,
      };

      return gdprExport;
    } finally {
      setIsExporting(false);
    }
  }, [store, isReady, userId]);

  /**
   * Download exported data as a JSON file
   */
  const downloadExport = useCallback(async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ownyou-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return data;
  }, [exportAllData]);

  /**
   * Delete all user data from all namespaces
   */
  const deleteAllData = useCallback(async (): Promise<{ deleted: number; namespaces: string[] }> => {
    if (!store || !isReady || !userId) {
      throw new Error('Store not ready or not authenticated');
    }

    setIsDeleting(true);
    let totalDeleted = 0;
    const deletedNamespaces: string[] = [];

    try {
      // Delete from all namespaces
      for (const nsKey of USER_NAMESPACES) {
        try {
          const nsFn = NS[nsKey as keyof typeof NS];
          if (typeof nsFn !== 'function') continue;

          // Skip procedural memory and llmUsage - handle separately
          const skipKeysDelete = ['proceduralMemory', 'llmUsage'];
          if (skipKeysDelete.includes(nsKey)) {
            continue;
          }

          const namespace = (nsFn as (userId: string) => readonly string[])(userId) as NamespaceTuple;

          // List all items first
          const result = await store.list(namespace, { limit: 1000, offset: 0 });
          if (result.items && result.items.length > 0) {
            // Delete each item
            for (const item of result.items) {
              const key = (item as Record<string, unknown>).id ?? (item as Record<string, unknown>).key;
              if (key) {
                await store.delete(namespace as NamespaceTuple, String(key));
                totalDeleted++;
              }
            }
            deletedNamespaces.push(nsKey);
          }
        } catch (err) {
          console.debug(`[GDPR] No data to delete for namespace ${nsKey}:`, err);
        }
      }

      // Handle procedural memory for common agent types
      const agentTypes = ['email', 'calendar', 'financial', 'restaurant', 'events', 'travel'];
      for (const agentType of agentTypes) {
        try {
          const namespace = NS.proceduralMemory(userId, agentType);
          const result = await store.list(namespace, { limit: 1000, offset: 0 });
          if (result.items && result.items.length > 0) {
            for (const item of result.items) {
              const key = (item as Record<string, unknown>).id ?? (item as Record<string, unknown>).key;
              if (key) {
                await store.delete(namespace, String(key));
                totalDeleted++;
              }
            }
            deletedNamespaces.push(`proceduralMemory_${agentType}`);
          }
        } catch (err) {
          // Skip if empty
        }
      }

      // Handle llmUsage for daily and monthly
      for (const period of ['daily', 'monthly'] as const) {
        try {
          const namespace = NS.llmUsage(userId, period);
          const result = await store.list(namespace, { limit: 1000, offset: 0 });
          if (result.items && result.items.length > 0) {
            for (const item of result.items) {
              const key = (item as Record<string, unknown>).id ?? (item as Record<string, unknown>).key;
              if (key) {
                await store.delete(namespace, String(key));
                totalDeleted++;
              }
            }
            deletedNamespaces.push(`llmUsage_${period}`);
          }
        } catch (err) {
          // Skip if empty
        }
      }

      return { deleted: totalDeleted, namespaces: deletedNamespaces };
    } finally {
      setIsDeleting(false);
    }
  }, [store, isReady, userId]);

  /**
   * Delete all data and log out
   */
  const deleteAllDataAndLogout = useCallback(async () => {
    const result = await deleteAllData();
    // Log out after deletion
    disconnect?.();
    return result;
  }, [deleteAllData, disconnect]);

  return {
    /** Export all user data as a JSON object */
    exportAllData,
    /** Download exported data as a JSON file */
    downloadExport,
    /** Delete all user data from all namespaces */
    deleteAllData,
    /** Delete all data and log out */
    deleteAllDataAndLogout,
    /** Whether an export is in progress */
    isExporting,
    /** Whether a deletion is in progress */
    isDeleting,
    /** Whether the hook is ready to use */
    isReady: isReady && isAuthenticated && !!userId,
  };
}
