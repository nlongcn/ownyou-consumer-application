/**
 * Retention Types - v13 Section 10
 *
 * Type definitions for retention policies and cleanup.
 */

/**
 * Retention policy for a namespace
 */
export interface RetentionPolicy {
  namespace: string;
  retentionDays: number;
}
