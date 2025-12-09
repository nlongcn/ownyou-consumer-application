/**
 * OwnYou Spacing & Layout System - v13 Section 4.3.3
 *
 * Defines border radii, card dimensions, gaps, and padding values
 * for consistent layout across the OwnYou consumer application.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3.3
 */

/**
 * Border radius values
 */
export const radius = {
  /** Standard card corners */
  card: '35px',
  /** Utility cards */
  cardSmall: '20px',
  /** Card images (small) */
  image: '12px',
  /** Card images (large) */
  imageLarge: '21px',
  /** Navigation pill */
  nav: '12.5px',
  /** Buttons and inputs */
  button: '8px',
  /** Full circle */
  full: '9999px',
  /** No radius */
  none: '0px',
} as const;

/**
 * Card dimension values
 */
export const cardDimensions = {
  /** Standard mobile card width */
  width: '180px',
  /** Desktop card width (responsive) */
  widthDesktop: '260px',
  /** Gap between cards in grid */
  gap: '13px',
  /** Feed side padding */
  feedPadding: '10px',
} as const;

/**
 * Breakpoint values for responsive design - v13 Section 4.8
 */
export const breakpoints = {
  /** Mobile (2 columns, 180px cards) */
  mobile: '640px',
  /** Tablet (2 columns, 180px cards) */
  tablet: '768px',
  /** Desktop small (3 columns, 220px cards) */
  desktop: '1024px',
  /** Desktop medium (3 columns, 260px cards) */
  desktopMd: '1280px',
  /** Desktop large (4 columns, 280px cards) */
  desktopLg: '1440px',
  /** Ultra-wide (4-5 columns, 300px cards) */
  ultraWide: '1920px',
} as const;

/**
 * Masonry grid column configuration per breakpoint
 */
export const masonryColumns = {
  default: 4,   // 1920px+
  1440: 4,
  1280: 3,
  1024: 3,
  768: 2,
  640: 2,
} as const;

/**
 * CSS custom property tokens for spacing
 */
export const spacingTokens = {
  '--radius-card': radius.card,
  '--radius-card-small': radius.cardSmall,
  '--radius-image': radius.image,
  '--radius-image-large': radius.imageLarge,
  '--radius-nav': radius.nav,
  '--radius-button': radius.button,
  '--card-width': cardDimensions.width,
  '--card-width-desktop': cardDimensions.widthDesktop,
  '--card-gap': cardDimensions.gap,
  '--feed-padding': cardDimensions.feedPadding,
} as const;

/**
 * Tailwind-compatible border radius configuration
 */
export const tailwindBorderRadius = {
  'card': radius.card,
  'card-small': radius.cardSmall,
  'image': radius.image,
  'image-lg': radius.imageLarge,
  'nav': radius.nav,
  'button': radius.button,
} as const;

/**
 * Tailwind-compatible spacing/width configuration
 */
export const tailwindSpacing = {
  'card': cardDimensions.width,
  'card-desktop': cardDimensions.widthDesktop,
  'card-gap': cardDimensions.gap,
  'feed-padding': cardDimensions.feedPadding,
} as const;

/**
 * Tailwind-compatible screens configuration
 */
export const tailwindScreens = {
  'mobile': breakpoints.mobile,
  'tablet': breakpoints.tablet,
  'desktop': breakpoints.desktop,
  'desktop-md': breakpoints.desktopMd,
  'desktop-lg': breakpoints.desktopLg,
  'ultra-wide': breakpoints.ultraWide,
} as const;

export type RadiusToken = keyof typeof radius;
export type BreakpointToken = keyof typeof breakpoints;
