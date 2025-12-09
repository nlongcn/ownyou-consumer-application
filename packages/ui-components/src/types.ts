/**
 * UI Components Type Definitions
 * v13 Section 4.5.1 - Mission Card Types
 */

/**
 * Mission card type variants from Figma designs
 */
export type MissionCardType =
  | 'shopping'         // home_card_savings_shopping - Product recommendations
  | 'savings'          // home_card_savings_utility - Energy/utility savings
  | 'consumables'      // home_card_savings_consumables - Shopping list
  | 'content'          // home_card_ikigai_content - Podcast/article
  | 'travel'           // home_card_ikigai_travel - Holiday suggestions
  | 'entertainment'    // home_card_ikigai_entertainment - Comedy/theater
  | 'food'             // home_card_ikigai_food_recipe - Dinner ideas
  | 'people'           // home_card_ikigai_people - Relationship suggestions
  | 'health';          // home_health_card_small - Health/longevity

/**
 * Card dimensions specification from Figma
 */
export interface MissionCardDimensions {
  type: MissionCardType;
  height: number;  // px
  hasImage: boolean;
  hasBrandLogo: boolean;
  hasPrice: boolean;
}

/**
 * Card dimensions lookup table
 */
export const CARD_DIMENSIONS: Record<MissionCardType, MissionCardDimensions> = {
  shopping: { type: 'shopping', height: 290, hasImage: true, hasBrandLogo: true, hasPrice: true },
  savings: { type: 'savings', height: 284, hasImage: true, hasBrandLogo: true, hasPrice: false },
  consumables: { type: 'consumables', height: 284, hasImage: true, hasBrandLogo: false, hasPrice: false },
  content: { type: 'content', height: 284, hasImage: true, hasBrandLogo: true, hasPrice: false },
  travel: { type: 'travel', height: 208, hasImage: true, hasBrandLogo: false, hasPrice: false },
  entertainment: { type: 'entertainment', height: 207, hasImage: true, hasBrandLogo: false, hasPrice: false },
  food: { type: 'food', height: 287, hasImage: true, hasBrandLogo: false, hasPrice: false },
  people: { type: 'people', height: 210, hasImage: true, hasBrandLogo: false, hasPrice: false },
  health: { type: 'health', height: 180, hasImage: true, hasBrandLogo: false, hasPrice: false },
};

/**
 * Heart feedback state - v13 Section 4.5.3
 */
export type HeartState = 'meh' | 'like' | 'love';

/**
 * Mission data for card rendering
 */
export interface Mission {
  id: string;
  type: MissionCardType;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  brandName?: string;
  brandLogoUrl?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  actionUrl?: string;
  feedbackState?: HeartState;
  createdAt: number;
}

/**
 * Breakpoint configuration for masonry layout
 */
export const BREAKPOINT_COLUMNS = {
  default: 4,   // 1920px+
  1440: 4,
  1280: 3,
  1024: 3,
  768: 2,
  640: 2,
} as const;

/**
 * Navigation item type
 */
export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  active?: boolean;
}

/**
 * Filter tab configuration
 */
export type FilterTab = 'all' | 'savings' | 'ikigai' | 'health';

export const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'savings', label: 'Savings' },
  { id: 'ikigai', label: 'Ikigai' },
  { id: 'health', label: 'Health' },
];

/**
 * Ikigai dimension for profile visualization
 */
export interface IkigaiDimension {
  name: 'passion' | 'mission' | 'profession' | 'vocation';
  label: string;
  score: number;  // 0-100
  color: string;
}
