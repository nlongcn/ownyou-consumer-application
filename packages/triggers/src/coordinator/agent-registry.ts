/**
 * Agent Registry - v13 Section 3.5
 *
 * Registry for available agents with namespace and intent mappings.
 */

import type { AgentType } from '@ownyou/shared-types';

/**
 * Agent registration entry
 */
export interface AgentRegistryEntry {
  /** Agent type identifier */
  type: AgentType;
  /** Namespaces that trigger this agent */
  namespaces: string[];
  /** User intents this agent handles */
  intents: string[];
  /** Agent description */
  description: string;
  /** Whether agent is enabled */
  enabled: boolean;
}

/**
 * Default agent registry with current Sprint 5 agents
 */
export const DEFAULT_AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    type: 'shopping',
    namespaces: ['ownyou.iab', 'ownyou.semantic', 'ownyou.entities'],
    intents: ['shopping', 'buy', 'purchase', 'deal', 'price', 'compare', 'discount'],
    description: 'Shopping Assistant - finds deals based on user interests',
    enabled: true,
  },
  {
    type: 'content',
    namespaces: ['ownyou.iab', 'ownyou.semantic', 'ownyou.entities'],
    intents: ['content', 'read', 'article', 'recommend', 'news', 'learn', 'watch'],
    description: 'Content Recommender - suggests articles and media',
    enabled: true,
  },
  // Future agents (disabled until implemented)
  {
    type: 'travel',
    namespaces: ['ownyou.semantic', 'ownyou.entities'],
    intents: ['travel', 'flight', 'hotel', 'vacation', 'trip', 'booking'],
    description: 'Travel Planner - helps with travel planning',
    enabled: false,
  },
  {
    type: 'restaurant',
    namespaces: ['ownyou.semantic', 'ownyou.entities'],
    intents: ['restaurant', 'food', 'dinner', 'lunch', 'reservation', 'dining'],
    description: 'Restaurant Finder - finds dining options',
    enabled: false,
  },
  // Note: Additional agent types can be registered dynamically
  // via AgentRegistry.register()
];

/**
 * AgentRegistry - Manages registered agents and their mappings
 */
export class AgentRegistry {
  private agents: Map<AgentType, AgentRegistryEntry> = new Map();
  private namespaceIndex: Map<string, AgentType[]> = new Map();
  private intentIndex: Map<string, AgentType> = new Map();

  constructor(entries: AgentRegistryEntry[] = DEFAULT_AGENT_REGISTRY) {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  /**
   * Register an agent
   */
  register(entry: AgentRegistryEntry): void {
    this.agents.set(entry.type, entry);

    if (entry.enabled) {
      // Index by namespace
      for (const ns of entry.namespaces) {
        const existing = this.namespaceIndex.get(ns) ?? [];
        if (!existing.includes(entry.type)) {
          existing.push(entry.type);
          this.namespaceIndex.set(ns, existing);
        }
      }

      // Index by intent (first agent wins for each intent)
      for (const intent of entry.intents) {
        if (!this.intentIndex.has(intent)) {
          this.intentIndex.set(intent, entry.type);
        }
      }
    }
  }

  /**
   * Unregister an agent
   */
  unregister(type: AgentType): boolean {
    const entry = this.agents.get(type);
    if (!entry) return false;

    // Remove from namespace index
    for (const ns of entry.namespaces) {
      const existing = this.namespaceIndex.get(ns) ?? [];
      const index = existing.indexOf(type);
      if (index !== -1) {
        existing.splice(index, 1);
        this.namespaceIndex.set(ns, existing);
      }
    }

    // Remove from intent index
    for (const intent of entry.intents) {
      if (this.intentIndex.get(intent) === type) {
        this.intentIndex.delete(intent);
      }
    }

    return this.agents.delete(type);
  }

  /**
   * Enable/disable an agent
   */
  setEnabled(type: AgentType, enabled: boolean): boolean {
    const entry = this.agents.get(type);
    if (!entry) return false;

    // If enabling, re-index
    if (enabled && !entry.enabled) {
      entry.enabled = true;
      for (const ns of entry.namespaces) {
        const existing = this.namespaceIndex.get(ns) ?? [];
        if (!existing.includes(type)) {
          existing.push(type);
          this.namespaceIndex.set(ns, existing);
        }
      }
      for (const intent of entry.intents) {
        if (!this.intentIndex.has(intent)) {
          this.intentIndex.set(intent, type);
        }
      }
    }

    // If disabling, remove from indices
    if (!enabled && entry.enabled) {
      entry.enabled = false;
      for (const ns of entry.namespaces) {
        const existing = this.namespaceIndex.get(ns) ?? [];
        const index = existing.indexOf(type);
        if (index !== -1) {
          existing.splice(index, 1);
          this.namespaceIndex.set(ns, existing);
        }
      }
      for (const intent of entry.intents) {
        if (this.intentIndex.get(intent) === type) {
          this.intentIndex.delete(intent);
        }
      }
    }

    return true;
  }

  /**
   * Get agents for a namespace
   */
  getAgentsForNamespace(namespace: string): AgentType[] {
    return this.namespaceIndex.get(namespace) ?? [];
  }

  /**
   * Get agent for an intent
   */
  getAgentForIntent(intent: string): AgentType | undefined {
    return this.intentIndex.get(intent);
  }

  /**
   * Get agent entry
   */
  getAgent(type: AgentType): AgentRegistryEntry | undefined {
    return this.agents.get(type);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentRegistryEntry[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get enabled agents
   */
  getEnabledAgents(): AgentRegistryEntry[] {
    return Array.from(this.agents.values()).filter(a => a.enabled);
  }

  /**
   * Get all registered intents
   */
  getRegisteredIntents(): string[] {
    return Array.from(this.intentIndex.keys());
  }

  /**
   * Get all watched namespaces
   */
  getWatchedNamespaces(): string[] {
    return Array.from(this.namespaceIndex.keys());
  }
}
