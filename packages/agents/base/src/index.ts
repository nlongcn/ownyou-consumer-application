/**
 * @ownyou/agents-base - v13 Section 3.6
 *
 * Base agent framework for OwnYou mission agents.
 *
 * @example
 * ```typescript
 * import { BaseAgent, LimitsEnforcer, PrivacyGuard } from '@ownyou/agents-base';
 *
 * // Create limits enforcer for L2 agent
 * const enforcer = new LimitsEnforcer('L2');
 *
 * // Create privacy guard for shopping agent
 * const guard = new PrivacyGuard(shoppingPermissions);
 *
 * // Extend BaseAgent for your agent
 * class ShoppingAgent extends BaseAgent {
 *   readonly agentType = 'shopping';
 *   readonly level = 'L2';
 *
 *   protected async execute(context: AgentContext): Promise<AgentResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */

// Types
export type {
  AgentStore,
  AgentTool,
  ToolCall,
  LlmCall,
  MemoryOp,
  ResourceUsage,
  AgentContext,
  AgentResult,
  AgentConfig,
  LimitsViolation,
  PrivacyViolation,
} from './types';

// LimitsEnforcer
export { LimitsEnforcer, LimitsExceededError } from './limits-enforcer';

// PrivacyGuard
export {
  PrivacyGuard,
  PrivacyViolationError,
  PRIVACY_TIERS,
  type AccessLogEntry,
  type PrivacyTierConfig,
} from './privacy-guard';

// BaseAgent
export { BaseAgent } from './base-agent';

// Re-export shared types for convenience
export type {
  AgentType,
  AgentLevel,
  AgentLimits,
  AgentPermissions,
  MissionCard,
  MissionStatus,
  MissionAction,
  Episode,
} from '@ownyou/shared-types';

export { AGENT_LIMITS, NAMESPACES } from '@ownyou/shared-types';
