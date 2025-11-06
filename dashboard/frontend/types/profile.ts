/**
 * TypeScript type definitions for IAB Taxonomy Profile Schema v2.0
 *
 * Defines types for tiered classification structure with primary/alternative
 * classifications, granularity scores, and confidence deltas.
 */

export interface TieredClassification {
  taxonomy_id: number
  tier_path: string
  value: string
  confidence: number
  evidence_count: number
  last_validated: string
  days_since_validation?: number
  tier_depth: number
  granularity_score: number
  classification_type: 'primary' | 'alternative'
  confidence_delta?: number  // Only present for alternatives
  category_path?: string
  tier_1?: string
  tier_2?: string
  tier_3?: string
  tier_4?: string
  tier_5?: string
}

export interface TieredGroup {
  primary: TieredClassification
  alternatives: TieredClassification[]
  selection_method: 'highest_confidence' | 'granularity_weighted' | 'non_exclusive'
}

export interface TieredDemographics {
  [field: string]: TieredGroup
  gender?: TieredGroup
  age_range?: TieredGroup
  education?: TieredGroup
  occupation?: TieredGroup
  marital_status?: TieredGroup
  language?: TieredGroup
}

export interface TieredHousehold {
  [field: string]: TieredGroup
  income?: TieredGroup
  property_type?: TieredGroup
  ownership?: TieredGroup
  urbanization?: TieredGroup
  length_of_residence?: TieredGroup
}

export interface TieredInterest extends TieredGroup {
  granularity_score: number
  purchase_intent_flag?: string
}

export interface TieredPurchaseIntent extends TieredGroup {
  granularity_score: number
  purchase_intent_flag?: string
}

export interface TieredProfile {
  schema_version: string
  demographics: TieredDemographics
  household: TieredHousehold
  interests: TieredInterest[]
  purchase_intent: TieredPurchaseIntent[]
}

// Legacy flat classification structure (schema v1.0 backward compatibility)
export interface Classification {
  category: string
  confidence: number
  created_at: string
  evidence_count: number
  section: string
  taxonomy_id: number
  tier_path: string
  value: string
  purchase_intent_flag?: string
}

export interface ProfileSummary {
  user_id: string
  demographics: number
  household: number
  interests: number
  purchase_intent: number
  actual_purchases: number
  total_classifications: number
}

export interface ClassificationsResponse {
  user_id: string
  section: string | null
  count: number
  classifications: Classification[]
}

export interface TieredProfileResponse {
  schema_version: string
  demographics: TieredDemographics
  household: TieredHousehold
  interests: TieredInterest[]
  purchase_intent: TieredPurchaseIntent[]
}
