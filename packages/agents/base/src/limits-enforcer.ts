/**
 * LimitsEnforcer - v13 Section 3.6.3
 *
 * Enforces L1/L2/L3 resource limits for agent execution.
 * Prevents agents from exceeding their allocated resources.
 */

import type { AgentLevel, AgentLimits } from '@ownyou/shared-types';
import { AGENT_LIMITS } from '@ownyou/shared-types';
import type { ResourceUsage, LimitsViolation } from './types';

/**
 * Error thrown when an agent exceeds its resource limits
 */
export class LimitsExceededError extends Error {
  constructor(
    public readonly violation: LimitsViolation
  ) {
    super(violation.message);
    this.name = 'LimitsExceededError';
  }
}

/**
 * LimitsEnforcer - Tracks and enforces agent resource limits
 *
 * @example
 * ```typescript
 * const enforcer = new LimitsEnforcer('L2');
 *
 * // Record operations - throws if limit exceeded
 * enforcer.recordToolCall();
 * enforcer.recordLlmCall(0.001);
 * enforcer.recordMemoryRead();
 *
 * // Check timeout periodically
 * enforcer.checkTimeout();
 *
 * // Get current usage
 * const usage = enforcer.getUsage();
 * ```
 */
export class LimitsEnforcer {
  private readonly limits: AgentLimits;
  private readonly startTime: number;

  // Counters
  private toolCalls = 0;
  private llmCalls = 0;
  private memoryReads = 0;
  private memoryWrites = 0;
  private totalCostUsd = 0;

  /**
   * Create a new LimitsEnforcer
   *
   * @param level - Agent level (L1/L2/L3)
   * @param customLimits - Optional overrides for specific limits
   */
  constructor(
    private readonly level: AgentLevel,
    customLimits?: Partial<AgentLimits>
  ) {
    this.limits = {
      ...AGENT_LIMITS[level],
      ...customLimits,
    };
    this.startTime = Date.now();
  }

  /**
   * Get the effective limits for this enforcer
   */
  getLimits(): AgentLimits {
    return { ...this.limits };
  }

  /**
   * Get current resource usage
   */
  getUsage(): ResourceUsage {
    return {
      toolCalls: this.toolCalls,
      llmCalls: this.llmCalls,
      memoryReads: this.memoryReads,
      memoryWrites: this.memoryWrites,
      elapsedSeconds: (Date.now() - this.startTime) / 1000,
      totalCostUsd: this.totalCostUsd,
    };
  }

  /**
   * Check if a tool call can be made without exceeding limits
   */
  canRecordToolCall(): boolean {
    return this.toolCalls < this.limits.maxToolCalls;
  }

  /**
   * Check if an LLM call can be made without exceeding limits
   */
  canRecordLlmCall(): boolean {
    return this.llmCalls < this.limits.maxLlmCalls;
  }

  /**
   * Check if a memory read can be made without exceeding limits
   */
  canRecordMemoryRead(): boolean {
    return this.memoryReads < this.limits.maxMemoryReads;
  }

  /**
   * Check if a memory write can be made without exceeding limits
   */
  canRecordMemoryWrite(): boolean {
    return this.memoryWrites < this.limits.maxMemoryWrites;
  }

  /**
   * Record a tool call - throws if limit exceeded
   */
  recordToolCall(): void {
    if (this.toolCalls >= this.limits.maxToolCalls) {
      throw new LimitsExceededError({
        limit: 'maxToolCalls',
        current: this.toolCalls,
        max: this.limits.maxToolCalls,
        message: `Tool call limit exceeded: ${this.toolCalls}/${this.limits.maxToolCalls} for ${this.level} agent`,
      });
    }
    this.toolCalls++;
  }

  /**
   * Record an LLM call - throws if limit exceeded
   *
   * @param costUsd - Optional cost of the call in USD
   */
  recordLlmCall(costUsd = 0): void {
    if (this.llmCalls >= this.limits.maxLlmCalls) {
      throw new LimitsExceededError({
        limit: 'maxLlmCalls',
        current: this.llmCalls,
        max: this.limits.maxLlmCalls,
        message: `LLM call limit exceeded: ${this.llmCalls}/${this.limits.maxLlmCalls} for ${this.level} agent`,
      });
    }
    this.llmCalls++;
    this.totalCostUsd += costUsd;
  }

  /**
   * Record a memory read - throws if limit exceeded
   */
  recordMemoryRead(): void {
    if (this.memoryReads >= this.limits.maxMemoryReads) {
      throw new LimitsExceededError({
        limit: 'maxMemoryReads',
        current: this.memoryReads,
        max: this.limits.maxMemoryReads,
        message: `Memory read limit exceeded: ${this.memoryReads}/${this.limits.maxMemoryReads} for ${this.level} agent`,
      });
    }
    this.memoryReads++;
  }

  /**
   * Record a memory write - throws if limit exceeded
   */
  recordMemoryWrite(): void {
    if (this.memoryWrites >= this.limits.maxMemoryWrites) {
      throw new LimitsExceededError({
        limit: 'maxMemoryWrites',
        current: this.memoryWrites,
        max: this.limits.maxMemoryWrites,
        message: `Memory write limit exceeded: ${this.memoryWrites}/${this.limits.maxMemoryWrites} for ${this.level} agent`,
      });
    }
    this.memoryWrites++;
  }

  /**
   * Check if execution has exceeded timeout - throws if exceeded
   */
  checkTimeout(): void {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    if (elapsedSeconds >= this.limits.timeoutSeconds) {
      throw new LimitsExceededError({
        limit: 'timeoutSeconds',
        current: Math.round(elapsedSeconds),
        max: this.limits.timeoutSeconds,
        message: `Timeout exceeded: ${Math.round(elapsedSeconds)}s/${this.limits.timeoutSeconds}s for ${this.level} agent`,
      });
    }
  }

  /**
   * Get violation details for a specific limit
   *
   * @param limit - The limit to check
   * @returns Violation details or null if not exceeded
   */
  getViolation(limit: keyof AgentLimits): LimitsViolation | null {
    const current = this.getCurrentValue(limit);
    const max = this.limits[limit];

    if (current < max) {
      return null;
    }

    return {
      limit,
      current,
      max,
      message: this.getViolationMessage(limit, current, max),
    };
  }

  /**
   * Reset all counters (for reuse in tests or retry scenarios)
   */
  reset(): void {
    this.toolCalls = 0;
    this.llmCalls = 0;
    this.memoryReads = 0;
    this.memoryWrites = 0;
    this.totalCostUsd = 0;
    // Note: startTime is not reset - timeout continues from creation
  }

  private getCurrentValue(limit: keyof AgentLimits): number {
    switch (limit) {
      case 'maxToolCalls':
        return this.toolCalls;
      case 'maxLlmCalls':
        return this.llmCalls;
      case 'maxMemoryReads':
        return this.memoryReads;
      case 'maxMemoryWrites':
        return this.memoryWrites;
      case 'timeoutSeconds':
        return Math.round((Date.now() - this.startTime) / 1000);
    }
  }

  private getViolationMessage(
    limit: keyof AgentLimits,
    current: number,
    max: number
  ): string {
    const limitNames: Record<keyof AgentLimits, string> = {
      maxToolCalls: 'Tool call limit',
      maxLlmCalls: 'LLM call limit',
      maxMemoryReads: 'Memory read limit',
      maxMemoryWrites: 'Memory write limit',
      timeoutSeconds: 'Timeout limit',
    };

    return `${limitNames[limit]} exceeded: ${current}/${max} for ${this.level} agent`;
  }
}
