/**
 * IAB Taxonomy Types
 *
 * Type definitions for IAB (Interactive Advertising Bureau) Taxonomy
 * classification system. Used for advertising targeting and user profiling.
 *
 * Based on IAB Tech Lab Content Taxonomy 3.0
 * @see https://iabtechlab.com/standards/content-taxonomy/
 */

/**
 * IAB Taxonomy Categories (Top-Level)
 *
 * Simplified categories for MVP. Full taxonomy has 700+ categories.
 */
export enum IABCategory {
  // Commerce
  SHOPPING = 'Shopping',
  AUTOMOTIVE = 'Automotive',
  REAL_ESTATE = 'Real Estate',

  // Financial
  FINANCE = 'Finance & Banking',
  PERSONAL_FINANCE = 'Personal Finance',

  // Travel & Hospitality
  TRAVEL = 'Travel',
  FOOD_DINING = 'Food & Dining',

  // Health & Wellness
  HEALTH_FITNESS = 'Health & Fitness',
  MEDICAL_HEALTH = 'Medical Health',

  // Entertainment & Media
  ENTERTAINMENT = 'Entertainment',
  MUSIC_AUDIO = 'Music & Audio',
  MOVIES = 'Movies',
  TELEVISION = 'Television',

  // Technology
  TECHNOLOGY = 'Technology & Computing',
  COMPUTING = 'Computing',

  // Business
  BUSINESS = 'Business & Industrial',
  CAREERS = 'Careers',

  // Lifestyle
  STYLE_FASHION = 'Style & Fashion',
  HOME_GARDEN = 'Home & Garden',
  HOBBIES_INTERESTS = 'Hobbies & Interests',

  // Family & Relationships
  FAMILY_PARENTING = 'Family & Parenting',
  RELATIONSHIPS = 'Relationships',

  // Education
  EDUCATION = 'Education',

  // News & Politics
  NEWS = 'News',
  POLITICS = 'Politics',

  // Sports
  SPORTS = 'Sports',

  // Uncategorized
  OTHER = 'Uncategorized',
}

/**
 * Data source types
 */
export enum DataSource {
  EMAIL = 'email',
  TRANSACTION = 'transaction',
  CALENDAR = 'calendar',
  CONTACT = 'contact',
  DOCUMENT = 'document',
  BROWSER_HISTORY = 'browser_history',
  SOCIAL_MEDIA = 'social_media',
}

/**
 * Classification confidence level
 */
export type ConfidenceLevel = number // 0.0 to 1.0

/**
 * IAB Classification Result
 *
 * Single classification output from IAB Classifier agent.
 */
export interface IABClassification {
  /** Unique identifier for this classification */
  id: string

  /** User ID this classification belongs to */
  userId: string

  /** IAB category assigned */
  category: IABCategory

  /** Confidence score (0.0 to 1.0) */
  confidence: ConfidenceLevel

  /** Source data type */
  source: DataSource

  /** Original source item ID (e.g., email_id, transaction_id) */
  sourceItemId: string

  /** Text preview (first 200 chars, for reference) */
  textPreview?: string

  /** ISO 8601 timestamp when classified */
  timestamp: string

  /** Evidence/reasoning for classification (optional) */
  reasoning?: string

  /** Subcategory (optional, for detailed taxonomy) */
  subcategory?: string
}

/**
 * IAB Classifier Input
 *
 * Input state for IAB classification workflow.
 */
export interface IABClassifierInput {
  /** User ID to classify for */
  userId: string

  /** Source data type */
  source: DataSource

  /** Source item ID */
  sourceItemId: string

  /** Text content to classify */
  text: string

  /** Optional metadata */
  metadata?: Record<string, any>
}

/**
 * IAB Classifier Output
 *
 * Output state from IAB classification workflow.
 */
export interface IABClassifierOutput {
  /** Classification result */
  classification: IABClassification

  /** Whether classification was successful */
  success: boolean

  /** Error message if classification failed */
  error?: string
}

/**
 * Store namespace for IAB classifications
 *
 * Structure: ["user_{userId}", "iab_classifications"]
 * Key: "{source}_{sourceItemId}" (e.g., "email_12345")
 */
export const IAB_NAMESPACE = 'iab_classifications'

/**
 * Helper function to create IAB Store namespace for a user
 */
export function getIABNamespace(userId: string): string[] {
  return [userId, IAB_NAMESPACE]
}

/**
 * Helper function to create IAB Store key
 */
export function getIABKey(source: DataSource, sourceItemId: string): string {
  return `${source}_${sourceItemId}`
}
