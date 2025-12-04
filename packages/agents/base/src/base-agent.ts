/**
 * BaseAgent - v13 Section 3.6
 *
 * Abstract base class for all OwnYou mission agents.
 * Integrates LimitsEnforcer and PrivacyGuard with episode recording.
 */

import type { AgentType, AgentLevel, AgentPermissions, MissionCard, Episode } from '@ownyou/shared-types';
import { NS, NAMESPACES } from '@ownyou/shared-types';
import type {
  AgentContext,
  AgentResult,
  ToolCall,
  LlmCall,
  MemoryOp,
} from './types';
import { LimitsEnforcer, LimitsExceededError } from './limits-enforcer';
import { PrivacyGuard, PrivacyViolationError } from './privacy-guard';

/**
 * BaseAgent - Abstract base class for all agents
 *
 * @example
 * ```typescript
 * class ShoppingAgent extends BaseAgent {
 *   readonly agentType = 'shopping';
 *   readonly level = 'L2';
 *
 *   protected async execute(context: AgentContext): Promise<AgentResult> {
 *     // Use this.limitsEnforcer and this.privacyGuard
 *     // Call this.recordToolCall(), this.recordLlmCall(), etc.
 *   }
 * }
 * ```
 */
export abstract class BaseAgent {
  /** Agent type (shopping, travel, etc.) */
  abstract readonly agentType: AgentType;

  /** Agent level (L1/L2/L3) */
  abstract readonly level: AgentLevel;

  /** Privacy guard for namespace access control */
  public readonly privacyGuard: PrivacyGuard;

  /** Tool calls made during execution */
  private toolCalls: ToolCall[] = [];

  /** LLM calls made during execution */
  private llmCalls: LlmCall[] = [];

  /** Memory operations performed during execution */
  private memoryOps: MemoryOp[] = [];

  /** Custom limits override */
  private readonly _customLimits?: Partial<import('@ownyou/shared-types').AgentLimits>;

  /** Lazily initialized limits enforcer */
  private _limitsEnforcer: LimitsEnforcer | null = null;

  /**
   * Limits enforcer for resource tracking (lazily initialized)
   *
   * Uses a getter to defer initialization until the subclass's `level` property
   * is available. This avoids the need for hacky null assertions in the constructor.
   */
  get limitsEnforcer(): LimitsEnforcer {
    if (!this._limitsEnforcer) {
      this._limitsEnforcer = new LimitsEnforcer(this.level, this._customLimits);
    }
    return this._limitsEnforcer;
  }

  /**
   * Create a new agent
   *
   * @param permissions - Agent permissions for namespace access
   * @param customLimits - Optional custom resource limits
   */
  constructor(
    permissions: AgentPermissions,
    customLimits?: Partial<import('@ownyou/shared-types').AgentLimits>
  ) {
    this.privacyGuard = new PrivacyGuard(permissions);
    this._customLimits = customLimits;
  }

  /**
   * Run the agent
   *
   * @param context - Execution context with store, tools, etc.
   * @returns Agent result with success status, response, and usage
   */
  async run(context: AgentContext): Promise<AgentResult> {
    // Reset limits enforcer for fresh run (uses lazy getter)
    this._limitsEnforcer = null;

    // Reset tracking for new run
    this.toolCalls = [];
    this.llmCalls = [];
    this.memoryOps = [];

    try {
      // Execute the agent's logic
      const result = await this.execute(context);

      // Record episode if mission was created (for learning feedback loop)
      let episode: Episode | undefined;
      if (result.success && result.missionCard) {
        episode = await this.recordEpisode(context, result.missionCard);
      }

      // Ensure usage is populated
      return {
        ...result,
        episode,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: this.toolCalls,
        llmCalls: this.llmCalls,
        memoryOps: this.memoryOps,
      };
    } catch (error) {
      // Handle limit and privacy violations specially
      if (error instanceof LimitsExceededError) {
        return {
          success: false,
          error: `Resource limit exceeded: ${error.violation.message}`,
          usage: this.limitsEnforcer.getUsage(),
          toolCalls: this.toolCalls,
          llmCalls: this.llmCalls,
          memoryOps: this.memoryOps,
        };
      }

      if (error instanceof PrivacyViolationError) {
        return {
          success: false,
          error: `Privacy violation: ${error.violation.message}`,
          usage: this.limitsEnforcer.getUsage(),
          toolCalls: this.toolCalls,
          llmCalls: this.llmCalls,
          memoryOps: this.memoryOps,
        };
      }

      // Wrap unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Agent execution failed: ${errorMessage}`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: this.toolCalls,
        llmCalls: this.llmCalls,
        memoryOps: this.memoryOps,
      };
    }
  }

  /**
   * Execute the agent's logic - to be implemented by subclasses
   *
   * @param context - Execution context
   * @returns Agent result
   */
  protected abstract execute(context: AgentContext): Promise<AgentResult>;

  /**
   * Record a tool call - tracks usage and enforces limits
   *
   * @param name - Tool name
   * @param input - Tool input parameters
   * @param output - Tool output result
   * @param durationMs - Execution duration in milliseconds
   */
  protected recordToolCall(
    name: string,
    input: unknown,
    output: unknown,
    durationMs: number
  ): void {
    // Enforce limits (getter handles lazy initialization)
    this.limitsEnforcer.recordToolCall();

    // Record for tracking
    this.toolCalls.push({
      name,
      input,
      output,
      durationMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Record an LLM call - tracks usage, cost, and enforces limits
   *
   * @param model - Model name
   * @param input - Input prompt/messages
   * @param output - Output response
   * @param tokens - Token usage
   * @param costUsd - Cost in USD
   * @param durationMs - Execution duration in milliseconds
   */
  protected recordLlmCall(
    model: string,
    input: unknown,
    output: string,
    tokens: { input: number; output: number },
    costUsd: number,
    durationMs: number
  ): void {
    // Enforce limits (getter handles lazy initialization)
    this.limitsEnforcer.recordLlmCall(costUsd);

    // Record for tracking
    this.llmCalls.push({
      model,
      input,
      output,
      tokens,
      costUsd,
      durationMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a memory operation - tracks usage and enforces limits/privacy
   *
   * @param type - Operation type
   * @param namespace - Namespace being accessed
   * @param key - Key being accessed (optional)
   * @param query - Search query (optional)
   */
  protected recordMemoryOp(
    type: 'read' | 'write' | 'search' | 'delete',
    namespace: string,
    key?: string,
    query?: string
  ): void {
    // Enforce privacy (getter handles lazy initialization)
    switch (type) {
      case 'read':
        this.privacyGuard.assertRead(namespace);
        this.limitsEnforcer.recordMemoryRead();
        break;
      case 'write':
        this.privacyGuard.assertWrite(namespace);
        this.limitsEnforcer.recordMemoryWrite();
        break;
      case 'search':
        this.privacyGuard.assertSearch(namespace);
        this.limitsEnforcer.recordMemoryRead(); // Searches count as reads
        break;
      case 'delete':
        this.privacyGuard.assertWrite(namespace);
        this.limitsEnforcer.recordMemoryWrite();
        break;
    }

    // Record for tracking
    this.memoryOps.push({
      type,
      namespace,
      key,
      query,
      timestamp: Date.now(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Episode Recording (v13 Section 8.4.2)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record episode after mission creation for learning feedback loop
   *
   * @param context - Agent execution context
   * @param mission - The generated mission card
   * @returns The created episode
   */
  protected async recordEpisode(
    context: AgentContext,
    mission: MissionCard
  ): Promise<Episode> {
    const episode: Episode = {
      id: crypto.randomUUID(),
      situation: this.describeTrigger(context.triggerData),
      reasoning: this.extractReasoning(),
      action: mission.summary,
      outcome: 'pending', // Updated when user provides feedback
      agentType: this.agentType,
      missionId: mission.id,
      timestamp: Date.now(),
      tags: this.extractTags(context.triggerData, mission),
    };

    // Store episode in episodic memory
    await context.store.put(
      NS.episodicMemory(context.userId),
      episode.id,
      episode
    );

    // Track the memory operation
    this.recordMemoryOp('write', NAMESPACES.EPISODIC_MEMORY, episode.id);

    return episode;
  }

  /**
   * Describe the trigger for episode situation field
   * Subclasses can override for custom formatting
   *
   * @param trigger - The trigger data
   * @returns Human-readable description
   */
  protected describeTrigger(trigger: unknown): string {
    if (!trigger) {
      return 'Agent triggered without specific trigger data';
    }
    // Truncate to avoid huge episode records
    const json = JSON.stringify(trigger);
    return json.length > 500 ? json.slice(0, 497) + '...' : json;
  }

  /**
   * Extract reasoning from agent execution
   * Subclasses can override for custom reasoning extraction
   *
   * @returns Reasoning string for episode
   */
  protected extractReasoning(): string {
    // Default: summarize LLM calls made
    if (this.llmCalls.length > 0) {
      const summaries = this.llmCalls
        .map((call) => call.output.slice(0, 100))
        .join(' → ');
      return `${this.agentType} agent reasoning: ${summaries}`;
    }
    return `${this.agentType} agent detected opportunity and generated mission`;
  }

  /**
   * Extract tags for episode
   * Subclasses can override for custom tag extraction
   *
   * @param trigger - The trigger data
   * @param mission - The generated mission
   * @returns Array of tags for the episode
   */
  protected extractTags(_trigger: unknown, mission: MissionCard): string[] {
    const tags: string[] = [this.agentType, mission.urgency];

    // Add mission type if different from agent type
    if (mission.type && mission.type !== this.agentType) {
      tags.push(mission.type);
    }

    // Add ikigai dimensions if present
    if (mission.ikigaiDimensions) {
      tags.push(...mission.ikigaiDimensions);
    }

    return tags;
  }
}
