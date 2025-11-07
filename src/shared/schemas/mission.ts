/**
 * Mission Card Schemas
 *
 * Zod validation schemas for Mission Cards and related types.
 * Provides runtime type checking and validation for all mission-related data.
 */

import { z } from 'zod'
import {
  CardType,
  CardCategory,
  MissionState,
  TriggerType,
  ComplexityLevel,
  AgentType,
} from '../types/mission'

/**
 * Card Type Schema
 */
export const CardTypeSchema = z.nativeEnum(CardType)

/**
 * Card Category Schema
 */
export const CardCategorySchema = z.nativeEnum(CardCategory)

/**
 * Mission State Schema
 */
export const MissionStateSchema = z.nativeEnum(MissionState)

/**
 * Trigger Type Schema
 */
export const TriggerTypeSchema = z.nativeEnum(TriggerType)

/**
 * Complexity Level Schema
 */
export const ComplexityLevelSchema = z.nativeEnum(ComplexityLevel)

/**
 * Agent Type Schema
 */
export const AgentTypeSchema = z.nativeEnum(AgentType)

/**
 * Mission Card Schema
 *
 * Validates the complete Mission Card data structure.
 */
export const MissionCardSchema = z.object({
  mission_id: z.string().min(1, 'Mission ID is required'),
  user_id: z.string().min(1, 'User ID is required'),
  thread_id: z.string().min(1, 'Thread ID is required'),
  card_type: CardTypeSchema,
  agent_type: AgentTypeSchema,
  category: CardCategorySchema,
  complexity_level: ComplexityLevelSchema,
  state: MissionStateSchema,
  trigger_type: TriggerTypeSchema,
  trigger_details: z.record(z.any()),
  memory_context: z.record(z.any()),
  card_data: z.record(z.any()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  priority: z.number().int().min(1).max(10),
  title: z.string().optional(),
  description: z.string().optional(),
  estimated_time: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
})

/**
 * Mission Agent Input Schema
 */
export const MissionAgentInputSchema = z.object({
  trigger_type: TriggerTypeSchema,
  user_id: z.string().min(1, 'User ID is required'),
  data: z.record(z.any()),
})

/**
 * Mission Agent Output Schema
 */
export const MissionAgentOutputSchema = z.object({
  success: z.boolean(),
  card: MissionCardSchema.optional(),
  error: z.string().optional(),
  reason: z.string().optional(),
})

/**
 * Validation helpers
 */

export function validateMissionCard(data: unknown) {
  return MissionCardSchema.parse(data)
}

export function validateMissionAgentInput(data: unknown) {
  return MissionAgentInputSchema.parse(data)
}

export function validateMissionAgentOutput(data: unknown) {
  return MissionAgentOutputSchema.parse(data)
}

/**
 * Type guards
 */

export function isMissionCard(data: unknown): data is z.infer<typeof MissionCardSchema> {
  return MissionCardSchema.safeParse(data).success
}

export function isMissionAgentInput(data: unknown): data is z.infer<typeof MissionAgentInputSchema> {
  return MissionAgentInputSchema.safeParse(data).success
}

export function isMissionAgentOutput(data: unknown): data is z.infer<typeof MissionAgentOutputSchema> {
  return MissionAgentOutputSchema.safeParse(data).success
}
