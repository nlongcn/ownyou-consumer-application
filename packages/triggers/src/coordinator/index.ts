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
  IntentClassifier,
  classifyIntent,
  getIntentFromKeywords,
  matchesIntent,
  getDefaultClassifier,
  DEFAULT_INTENT_PATTERNS,
  DEFAULT_ENTITY_PATTERNS,
  type IntentClassifierConfig,
} from './intent-classifier';
