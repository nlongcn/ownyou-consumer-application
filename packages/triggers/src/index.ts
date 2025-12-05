/**
 * @ownyou/triggers - v13 Section 3.1-3.5
 *
 * OwnYou 4-mode trigger system:
 * - Data-driven: Store changes trigger agents
 * - Scheduled: Cron-style and interval scheduling
 * - Event-driven: Calendar, location, webhooks
 * - User-driven: Natural language intent routing
 *
 * @example
 * ```typescript
 * import {
 *   TriggerEngine,
 *   AgentCoordinator,
 *   StoreWatcher,
 *   CronScheduler,
 * } from '@ownyou/triggers';
 *
 * const engine = new TriggerEngine({
 *   store: memoryStore,
 *   userId: 'user_123',
 *   watchNamespaces: ['ownyou.iab'],
 *   schedules: { daily_digest: '0 9 * * *' },
 *   agentFactory: (type) => createAgent(type),
 * });
 *
 * engine.start();
 * const result = await engine.handleUserRequest("Find me deals on headphones");
 * ```
 */

// Types
export type {
  TriggerMode,
  BaseTrigger,
  DataTrigger,
  ScheduledTrigger,
  EventTrigger,
  UserTrigger,
  Trigger,
  TriggerResult,
  ChangeCallback,
  ScheduleCallback,
  EventCallback,
  IntentClassification,
} from './types';

// Engine
export {
  TriggerEngine,
  type TriggerEngineConfig,
  type TriggerEngineStats,
} from './engine';

// Data-driven
export {
  StoreWatcher,
  type StoreWatcherConfig,
  type SubscribableStore,
} from './data-driven';

// Scheduled
export {
  CronScheduler,
  type Schedule,
} from './scheduled';

// Coordinator
export {
  AgentCoordinator,
  AgentRegistry,
  DEFAULT_AGENT_REGISTRY,
  classifyIntent,
  getIntentFromKeywords,
  matchesIntent,
  type AgentCoordinatorConfig,
  type AgentFactory,
  type AgentRegistryEntry,
} from './coordinator';
