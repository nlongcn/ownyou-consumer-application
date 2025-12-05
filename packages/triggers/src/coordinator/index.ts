/**
 * Coordinator exports
 */

export {
  AgentCoordinator,
  type AgentCoordinatorConfig,
  type AgentFactory,
} from './agent-coordinator';

export {
  AgentRegistry,
  DEFAULT_AGENT_REGISTRY,
  type AgentRegistryEntry,
} from './agent-registry';

export {
  classifyIntent,
  getIntentFromKeywords,
  matchesIntent,
} from './intent-classifier';
