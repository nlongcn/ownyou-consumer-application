/**
 * IAB Taxonomy Zod Schemas
 *
 * Runtime validation schemas for IAB classification data.
 * Provides type-safe validation and parsing for all IAB-related data.
 */

import { z } from 'zod'
import { IABCategory, DataSource } from '../types/iab'

/**
 * Zod enum for IAB categories
 */
export const IABCategorySchema = z.nativeEnum(IABCategory)

/**
 * Zod enum for data sources
 */
export const DataSourceSchema = z.nativeEnum(DataSource)

/**
 * Confidence level (0.0 to 1.0)
 */
export const ConfidenceLevelSchema = z.number().min(0).max(1)

/**
 * IAB Classification Schema
 */
export const IABClassificationSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  category: IABCategorySchema,
  confidence: ConfidenceLevelSchema,
  source: DataSourceSchema,
  sourceItemId: z.string().min(1),
  textPreview: z.string().max(200).optional(),
  timestamp: z.string().datetime(),
  reasoning: z.string().optional(),
  subcategory: z.string().optional(),
})

/**
 * IAB Classifier Input Schema
 */
export const IABClassifierInputSchema = z.object({
  userId: z.string().min(1),
  source: DataSourceSchema,
  sourceItemId: z.string().min(1),
  text: z.string().min(1),
  metadata: z.record(z.any()).optional(),
})

/**
 * IAB Classifier Output Schema
 */
export const IABClassifierOutputSchema = z.object({
  classification: IABClassificationSchema,
  success: z.boolean(),
  error: z.string().optional(),
})

/**
 * Helper function to validate IAB classification
 */
export function validateIABClassification(data: unknown): IABClassificationSchema {
  return IABClassificationSchema.parse(data)
}

/**
 * Helper function to validate IAB classifier input
 */
export function validateIABClassifierInput(data: unknown): IABClassifierInputSchema {
  return IABClassifierInputSchema.parse(data)
}

/**
 * Type exports (inferred from Zod schemas)
 */
export type IABClassificationSchema = z.infer<typeof IABClassificationSchema>
export type IABClassifierInputSchema = z.infer<typeof IABClassifierInputSchema>
export type IABClassifierOutputSchema = z.infer<typeof IABClassifierOutputSchema>
