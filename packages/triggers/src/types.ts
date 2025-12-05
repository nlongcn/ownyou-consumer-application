/**
 * Trigger Types - v13 Section 3.1-3.2
 *
 * Type definitions for the 4-mode trigger system.
 */

import type { AgentType, MissionCard } from '@ownyou/shared-types';

/**
 * Trigger mode types
 */
export type TriggerMode = 'data' | 'scheduled' | 'event' | 'user';

/**
 * Base trigger interface
 */
export interface BaseTrigger {
  /** Unique trigger ID */
  id: string;
  /** Trigger mode */
  mode: TriggerMode;
  /** When the trigger was created */
  createdAt: number;
}

/**
 * Data-driven trigger - fires on Store changes
 */
export interface DataTrigger extends BaseTrigger {
  mode: 'data';
  /** Namespace where change occurred */
  namespace: string;
  /** Key that changed */
  key: string;
  /** Type of change */
  changeType: 'create' | 'update' | 'delete';
  /** New value (undefined for delete) */
  value: unknown;
  /** Previous value (if update) */
  previousValue?: unknown;
}

/**
 * Scheduled trigger - fires at configured times
 */
export interface ScheduledTrigger extends BaseTrigger {
  mode: 'scheduled';
  /** Schedule ID that triggered */
  scheduleId: string;
  /** When it was scheduled to run */
  scheduledAt: number;
  /** Schedule expression (cron or interval) */
  scheduleExpr?: string;
}

/**
 * Event-driven trigger - fires on external events
 */
export interface EventTrigger extends BaseTrigger {
  mode: 'event';
  /** Event source (calendar, location, webhook) */
  eventSource: string;
  /** Event type */
  eventType: string;
  /** Event data */
  eventData: unknown;
}

/**
 * User-driven trigger - fires on user requests
 */
export interface UserTrigger extends BaseTrigger {
  mode: 'user';
  /** User's natural language request */
  request: string;
  /** Classified intent */
  intent?: string;
  /** Extracted entities */
  entities?: Record<string, string>;
  /** Confidence of intent classification */
  confidence?: number;
}

/**
 * Union of all trigger types
 */
export type Trigger = DataTrigger | ScheduledTrigger | EventTrigger | UserTrigger;

/**
 * Result from trigger processing
 */
export interface TriggerResult {
  /** The trigger that was processed */
  trigger: Trigger;
  /** Agent type that handled it */
  agentType: AgentType;
  /** Generated mission card (if any) */
  mission?: MissionCard;
  /** Whether the trigger was skipped */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
  /** Processing time in ms */
  processingTimeMs?: number;
}

/**
 * Store change callback type
 */
export type ChangeCallback = (trigger: DataTrigger) => void | Promise<void> | Promise<TriggerResult[]>;

/**
 * Schedule trigger callback type
 */
export type ScheduleCallback = (trigger: ScheduledTrigger) => void | Promise<void> | Promise<TriggerResult[]>;

/**
 * Event trigger callback type
 */
export type EventCallback = (trigger: EventTrigger) => void | Promise<void> | Promise<TriggerResult[]>;

/**
 * Intent classification result
 */
export interface IntentClassification {
  /** Classified intent */
  intent: string;
  /** Extracted entities */
  entities: Record<string, string>;
  /** Classification confidence (0-1) */
  confidence: number;
}
