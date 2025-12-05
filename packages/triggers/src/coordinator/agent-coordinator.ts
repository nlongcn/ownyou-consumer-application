/**
 * AgentCoordinator - v13 Section 3.5
 *
 * Routes triggers to appropriate agents based on trigger type.
 */

import type { AgentType, MissionCard } from '@ownyou/shared-types';
import type { AgentContext, AgentResult, BaseAgent } from '@ownyou/agents-base';
import type { Trigger, TriggerResult, UserTrigger } from '../types';
import { AgentRegistry, type AgentRegistryEntry } from './agent-registry';
import { classifyIntent } from './intent-classifier';

/**
 * Agent factory function type
 */
export type AgentFactory = (type: AgentType) => BaseAgent | null;

/**
 * Coordinator configuration
 */
export interface AgentCoordinatorConfig {
  /** Agent factory to create agent instances */
  agentFactory: AgentFactory;
  /** Custom registry (optional) */
  registry?: AgentRegistry;
  /** Schedule to agent mapping (optional, uses defaults if not provided) */
  scheduleAgents?: Record<string, AgentType[]>;
  /** Event source to agent mapping (optional, uses defaults if not provided) */
  eventAgents?: Record<string, AgentType[]>;
}

/**
 * Default schedule to agent mapping
 */
const DEFAULT_SCHEDULE_AGENTS: Record<string, AgentType[]> = {
  daily_digest: ['shopping', 'content'],
  weekly_review: ['shopping'],
  monthly_planning: ['shopping'],
};

/**
 * Default event source to agent mapping
 */
const DEFAULT_EVENT_AGENTS: Record<string, AgentType[]> = {
  calendar: ['shopping', 'content'],
  location: [],
  webhook: [],
};

/**
 * AgentCoordinator - Routes triggers to appropriate agents
 *
 * Determines which agent(s) should handle each trigger based on:
 * - Namespace (for data triggers)
 * - Schedule ID (for scheduled triggers)
 * - Event source (for event triggers)
 * - User intent (for user triggers)
 *
 * @example
 * ```typescript
 * const coordinator = new AgentCoordinator({
 *   agentFactory: (type) => {
 *     switch (type) {
 *       case 'shopping': return new ShoppingAgent();
 *       case 'content': return new ContentAgent();
 *       default: return null;
 *     }
 *   },
 * });
 *
 * const results = await coordinator.routeTrigger(trigger, context);
 * ```
 */
export class AgentCoordinator {
  private registry: AgentRegistry;
  private agentFactory: AgentFactory;
  private scheduleAgents: Record<string, AgentType[]>;
  private eventAgents: Record<string, AgentType[]>;

  constructor(config: AgentCoordinatorConfig) {
    this.registry = config.registry ?? new AgentRegistry();
    this.agentFactory = config.agentFactory;
    this.scheduleAgents = config.scheduleAgents ?? DEFAULT_SCHEDULE_AGENTS;
    this.eventAgents = config.eventAgents ?? DEFAULT_EVENT_AGENTS;
  }

  /**
   * Route a trigger to appropriate agent(s)
   */
  async routeTrigger(
    trigger: Trigger,
    context: Omit<AgentContext, 'triggerData'>
  ): Promise<TriggerResult[]> {
    const startTime = Date.now();
    const results: TriggerResult[] = [];

    // Determine which agents to run
    const agentTypes = this.selectAgents(trigger);

    if (agentTypes.length === 0) {
      return [{
        trigger,
        agentType: 'shopping',
        skipped: true,
        skipReason: 'No agent found for trigger',
        processingTimeMs: Date.now() - startTime,
      }];
    }

    for (const agentType of agentTypes) {
      const agentStart = Date.now();
      const agent = this.agentFactory(agentType);

      if (!agent) {
        results.push({
          trigger,
          agentType,
          skipped: true,
          skipReason: `Agent not available: ${agentType}`,
          processingTimeMs: Date.now() - agentStart,
        });
        continue;
      }

      try {
        const agentContext: AgentContext = {
          ...context,
          triggerData: trigger,
        };

        const result = await agent.run(agentContext);

        results.push({
          trigger,
          agentType,
          mission: result.missionCard,
          skipped: !result.success,
          skipReason: result.error,
          processingTimeMs: Date.now() - agentStart,
        });
      } catch (error) {
        results.push({
          trigger,
          agentType,
          skipped: true,
          skipReason: error instanceof Error ? error.message : String(error),
          processingTimeMs: Date.now() - agentStart,
        });
      }
    }

    return results;
  }

  /**
   * Route a user request (natural language)
   */
  async routeUserRequest(
    request: string,
    context: Omit<AgentContext, 'triggerData'>
  ): Promise<TriggerResult> {
    const startTime = Date.now();

    // Classify intent
    const { intent, entities, confidence } = classifyIntent(request);

    const trigger: UserTrigger = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mode: 'user',
      request,
      intent,
      entities,
      confidence,
      createdAt: Date.now(),
    };

    // Get agent for intent
    const agentType = this.registry.getAgentForIntent(intent);

    if (!agentType) {
      return {
        trigger,
        agentType: 'shopping', // Default
        skipped: true,
        skipReason: `No agent found for intent: ${intent}`,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Route through normal trigger flow
    const results = await this.routeTrigger(trigger, context);
    return results[0] ?? {
      trigger,
      agentType,
      skipped: true,
      skipReason: 'No result from agent',
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Select agents based on trigger type
   */
  private selectAgents(trigger: Trigger): AgentType[] {
    switch (trigger.mode) {
      case 'data':
        return this.registry.getAgentsForNamespace(trigger.namespace);

      case 'scheduled':
        return this.getAgentsForSchedule(trigger.scheduleId);

      case 'event':
        return this.getAgentsForEvent(trigger.eventSource);

      case 'user':
        const agent = trigger.intent
          ? this.registry.getAgentForIntent(trigger.intent)
          : undefined;
        return agent ? [agent] : [];

      default:
        return [];
    }
  }

  /**
   * Get agents for a schedule ID
   */
  private getAgentsForSchedule(scheduleId: string): AgentType[] {
    return this.scheduleAgents[scheduleId] ?? [];
  }

  /**
   * Get agents for an event source
   */
  private getAgentsForEvent(eventSource: string): AgentType[] {
    return this.eventAgents[eventSource] ?? [];
  }

  /**
   * Get the agent registry
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Register a new agent
   */
  registerAgent(entry: AgentRegistryEntry): void {
    this.registry.register(entry);
  }

  /**
   * Enable/disable an agent
   */
  setAgentEnabled(type: AgentType, enabled: boolean): boolean {
    return this.registry.setEnabled(type, enabled);
  }

  /**
   * Set agents for a schedule ID
   */
  setScheduleAgents(scheduleId: string, agents: AgentType[]): void {
    this.scheduleAgents[scheduleId] = agents;
  }

  /**
   * Set agents for an event source
   */
  setEventAgents(eventSource: string, agents: AgentType[]): void {
    this.eventAgents[eventSource] = agents;
  }

  /**
   * Validate schedule-agent mappings
   *
   * Checks that all provided schedule IDs have agent mappings.
   * Logs warnings for any unmapped schedules.
   *
   * @param scheduleIds - List of schedule IDs to validate
   * @returns Validation result with unmapped schedules
   *
   * @example
   * ```typescript
   * const result = coordinator.validateScheduleMappings(['daily_digest', 'custom_schedule']);
   * if (!result.valid) {
   *   console.warn('Unmapped schedules:', result.unmappedSchedules);
   * }
   * ```
   */
  validateScheduleMappings(scheduleIds: string[]): {
    valid: boolean;
    unmappedSchedules: string[];
    emptyMappings: string[];
  } {
    const unmappedSchedules: string[] = [];
    const emptyMappings: string[] = [];

    for (const scheduleId of scheduleIds) {
      const agents = this.scheduleAgents[scheduleId];
      if (agents === undefined) {
        unmappedSchedules.push(scheduleId);
        console.warn(
          `[AgentCoordinator] Schedule '${scheduleId}' has no agent mapping. ` +
          `Use setScheduleAgents('${scheduleId}', [...]) to configure.`
        );
      } else if (agents.length === 0) {
        emptyMappings.push(scheduleId);
        console.warn(
          `[AgentCoordinator] Schedule '${scheduleId}' maps to empty agent list. ` +
          `No agents will be triggered.`
        );
      }
    }

    return {
      valid: unmappedSchedules.length === 0 && emptyMappings.length === 0,
      unmappedSchedules,
      emptyMappings,
    };
  }

  /**
   * Validate event-agent mappings
   *
   * Checks that all provided event sources have agent mappings.
   * Logs warnings for any unmapped event sources.
   *
   * @param eventSources - List of event sources to validate
   * @returns Validation result with unmapped event sources
   */
  validateEventMappings(eventSources: string[]): {
    valid: boolean;
    unmappedEvents: string[];
    emptyMappings: string[];
  } {
    const unmappedEvents: string[] = [];
    const emptyMappings: string[] = [];

    for (const eventSource of eventSources) {
      const agents = this.eventAgents[eventSource];
      if (agents === undefined) {
        unmappedEvents.push(eventSource);
        console.warn(
          `[AgentCoordinator] Event source '${eventSource}' has no agent mapping. ` +
          `Use setEventAgents('${eventSource}', [...]) to configure.`
        );
      } else if (agents.length === 0) {
        emptyMappings.push(eventSource);
        // Note: Empty is valid for some event sources (e.g., 'location' not yet implemented)
        // Only log at debug level
      }
    }

    return {
      valid: unmappedEvents.length === 0,
      unmappedEvents,
      emptyMappings,
    };
  }

  /**
   * Get all configured schedule mappings
   */
  getScheduleMappings(): Record<string, AgentType[]> {
    return { ...this.scheduleAgents };
  }

  /**
   * Get all configured event mappings
   */
  getEventMappings(): Record<string, AgentType[]> {
    return { ...this.eventAgents };
  }

  /**
   * Check if a schedule has agent mappings
   */
  hasScheduleMapping(scheduleId: string): boolean {
    const agents = this.scheduleAgents[scheduleId];
    return agents !== undefined && agents.length > 0;
  }

  /**
   * Check if an event source has agent mappings
   */
  hasEventMapping(eventSource: string): boolean {
    const agents = this.eventAgents[eventSource];
    return agents !== undefined && agents.length > 0;
  }
}
