/**
 * PrivacyGuard - v13 Section 3.6.2 + 3.6.5
 *
 * Controls namespace access based on agent permissions.
 * Enforces privacy tier restrictions for agent memory operations.
 */

import type { AgentPermissions, Memory, PrivacyTier } from '@ownyou/shared-types';
import type { PrivacyViolation } from './types';

/**
 * Privacy tier configuration - v13 Section 8.11
 */
export interface PrivacyTierConfig {
  /** Cross-agent access policy */
  crossAccess: 'full' | 'justification' | 'none';
  /** Domains this tier applies to */
  domains: string[];
  /** Description of the tier */
  description: string;
}

/**
 * Privacy tier definitions - v13 Section 8.11
 */
export const PRIVACY_TIERS: Record<PrivacyTier, PrivacyTierConfig> = {
  public: {
    crossAccess: 'full',
    domains: ['travel', 'shopping', 'dining', 'events', 'content'],
    description: 'General preferences shared across all agents',
  },
  sensitive: {
    crossAccess: 'justification',
    domains: ['health', 'finance', 'relationships'],
    description: 'Personal information requiring justification for cross-agent access',
  },
  private: {
    crossAccess: 'none',
    domains: ['medical', 'legal', 'security'],
    description: 'Highly personal information isolated by default',
  },
} as const;

/**
 * Access log entry for auditing
 */
export interface AccessLogEntry {
  /** Operation type */
  operation: 'read' | 'write' | 'search';

  /** Namespace accessed */
  namespace: string;

  /** Whether access was allowed */
  allowed: boolean;

  /** Timestamp of access attempt */
  timestamp: number;
}

/**
 * Error thrown when an agent violates privacy restrictions
 */
export class PrivacyViolationError extends Error {
  constructor(
    public readonly violation: PrivacyViolation
  ) {
    super(violation.message);
    this.name = 'PrivacyViolationError';
  }
}

/**
 * PrivacyGuard - Enforces namespace access control for agents
 *
 * @example
 * ```typescript
 * const guard = new PrivacyGuard(shoppingPermissions);
 *
 * // Check if access is allowed
 * if (guard.canRead('ownyou.semantic')) {
 *   // Read from semantic memory
 * }
 *
 * // Assert access (throws if denied)
 * guard.assertWrite('ownyou.missions');
 *
 * // Get access log for auditing
 * const log = guard.getAccessLog();
 * ```
 */
export class PrivacyGuard {
  private readonly readNamespaces: Set<string>;
  private readonly writeNamespaces: Set<string>;
  private readonly searchNamespaces: Set<string>;
  private readonly accessLog: AccessLogEntry[] = [];

  /**
   * Create a new PrivacyGuard
   *
   * @param permissions - Agent permissions defining namespace access
   */
  constructor(private readonly permissions: AgentPermissions) {
    this.readNamespaces = new Set(permissions.memoryAccess.read);
    this.writeNamespaces = new Set(permissions.memoryAccess.write);
    this.searchNamespaces = new Set(permissions.memoryAccess.search);
  }

  /**
   * Get a copy of the permissions this guard is enforcing
   */
  getPermissions(): AgentPermissions {
    return {
      ...this.permissions,
      memoryAccess: {
        read: [...this.permissions.memoryAccess.read],
        write: [...this.permissions.memoryAccess.write],
        search: [...this.permissions.memoryAccess.search],
      },
      externalApis: [...this.permissions.externalApis],
      toolDefinitions: [...this.permissions.toolDefinitions],
    };
  }

  /**
   * Check if read access is allowed for a namespace
   */
  canRead(namespace: string): boolean {
    return this.readNamespaces.has(namespace);
  }

  /**
   * Check if write access is allowed for a namespace
   */
  canWrite(namespace: string): boolean {
    return this.writeNamespaces.has(namespace);
  }

  /**
   * Check if search access is allowed for a namespace
   */
  canSearch(namespace: string): boolean {
    return this.searchNamespaces.has(namespace);
  }

  /**
   * Assert read access - throws if denied
   */
  assertRead(namespace: string): void {
    const allowed = this.canRead(namespace);
    this.recordAccess('read', namespace, allowed);

    if (!allowed) {
      throw new PrivacyViolationError({
        operation: 'read',
        namespace,
        message: `Read access denied for ${this.permissions.agentType} agent to namespace: ${namespace}`,
      });
    }
  }

  /**
   * Assert write access - throws if denied
   */
  assertWrite(namespace: string): void {
    const allowed = this.canWrite(namespace);
    this.recordAccess('write', namespace, allowed);

    if (!allowed) {
      throw new PrivacyViolationError({
        operation: 'write',
        namespace,
        message: `Write access denied for ${this.permissions.agentType} agent to namespace: ${namespace}`,
      });
    }
  }

  /**
   * Assert search access - throws if denied
   */
  assertSearch(namespace: string): void {
    const allowed = this.canSearch(namespace);
    this.recordAccess('search', namespace, allowed);

    if (!allowed) {
      throw new PrivacyViolationError({
        operation: 'search',
        namespace,
        message: `Search access denied for ${this.permissions.agentType} agent to namespace: ${namespace}`,
      });
    }
  }

  /**
   * Get the access log for auditing
   */
  getAccessLog(): AccessLogEntry[] {
    return [...this.accessLog];
  }

  /**
   * Clear the access log
   */
  clearAccessLog(): void {
    this.accessLog.length = 0;
  }

  /**
   * Record an access attempt
   */
  private recordAccess(
    operation: 'read' | 'write' | 'search',
    namespace: string,
    allowed: boolean
  ): void {
    this.accessLog.push({
      operation,
      namespace,
      allowed,
      timestamp: Date.now(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Privacy-Tier Enforcement (v13 Section 3.6.5)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if agent can access memory with given privacy tier
   *
   * v13 Section 8.11 - Privacy Tiers
   *
   * @param memory - Memory to check access for
   * @param justification - Optional justification for sensitive tier access
   * @returns Result indicating if access is allowed and reason if denied
   */
  canAccessMemoryWithTier(
    memory: Memory,
    justification?: string
  ): { allowed: boolean; reason?: string } {
    const tier = PRIVACY_TIERS[memory.privacyTier];

    if (!tier) {
      this.recordTierAccess(memory.id, memory.privacyTier, false, 'Unknown privacy tier');
      return { allowed: false, reason: 'Unknown privacy tier' };
    }

    switch (tier.crossAccess) {
      case 'full':
        this.recordTierAccess(memory.id, memory.privacyTier, true);
        return { allowed: true };

      case 'justification':
        if (justification && justification.length > 0) {
          this.recordTierAccess(memory.id, memory.privacyTier, true, justification);
          return { allowed: true };
        }
        this.recordTierAccess(memory.id, memory.privacyTier, false, 'Justification required for sensitive tier');
        return {
          allowed: false,
          reason: 'Justification required for sensitive tier access',
        };

      case 'none':
        this.recordTierAccess(memory.id, memory.privacyTier, false, 'Private tier - no cross-agent access');
        return {
          allowed: false,
          reason: 'Private tier memory cannot be accessed by other agents',
        };

      default:
        this.recordTierAccess(memory.id, memory.privacyTier, false, 'Invalid access policy');
        return { allowed: false, reason: 'Invalid access policy' };
    }
  }

  /**
   * Assert memory tier access - throws if denied
   *
   * @param memory - Memory to check access for
   * @param justification - Optional justification for sensitive tier access
   */
  assertMemoryTierAccess(memory: Memory, justification?: string): void {
    const result = this.canAccessMemoryWithTier(memory, justification);
    if (!result.allowed) {
      throw new PrivacyViolationError({
        operation: 'read',
        namespace: `memory:${memory.id}`,
        message: `Privacy tier violation for ${this.permissions.agentType} agent: ${result.reason}`,
      });
    }
  }

  /**
   * Record a tier access attempt to the audit trail
   */
  private recordTierAccess(
    memoryId: string,
    tier: PrivacyTier,
    allowed: boolean,
    note?: string
  ): void {
    this.accessLog.push({
      operation: 'read',
      namespace: `tier:${tier}:${memoryId}`,
      allowed,
      timestamp: Date.now(),
    });
    // Note is available in the log entry via the namespace encoding
    if (note) {
      // Could be extended to store notes separately if needed
    }
  }

  /**
   * Determine privacy tier for a memory based on context
   *
   * Static utility method for inferring tier during memory creation.
   *
   * @param context - Context domain (e.g., 'health', 'shopping')
   * @returns Inferred privacy tier
   */
  static inferPrivacyTier(context: string): PrivacyTier {
    const lowerContext = context.toLowerCase();

    for (const [tier, config] of Object.entries(PRIVACY_TIERS)) {
      if (config.domains.includes(lowerContext)) {
        return tier as PrivacyTier;
      }
    }

    // Default to public for unknown contexts
    return 'public';
  }

  /**
   * Get privacy tier configuration
   *
   * @param tier - Privacy tier to get config for
   * @returns Tier configuration
   */
  static getTierConfig(tier: PrivacyTier): PrivacyTierConfig {
    return PRIVACY_TIERS[tier];
  }
}
