/**
 * OwnYou Typography System - v13 Section 4.3.2
 *
 * Defines font families, sizes, and weights for the OwnYou consumer application.
 * Based on Figma designs using Life Savers, Alata, and SF Pro fonts.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3.2
 */

/**
 * Font family definitions
 */
export const fontFamily = {
  /** Display/Body/Label text - Life Savers */
  display: '"Life Savers", cursive, sans-serif',
  /** Prices and numeric values - Alata */
  price: '"Alata", sans-serif',
  /** Brand names - Lohit Tamil/Bengali/Noto Sans */
  brand: '"Lohit Tamil", "Lohit Bengali", "Noto Sans", sans-serif',
  /** System UI text (iOS status bar) - SF Pro */
  system: '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif',
} as const;

/**
 * Typography presets matching v13 specification
 */
export const typography = {
  /** Card titles, headings - 16px Bold */
  display: {
    fontFamily: fontFamily.display,
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1.3,
  },
  /** Card descriptions - 12px Bold */
  body: {
    fontFamily: fontFamily.display,
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.4,
  },
  /** Card labels, captions - 11px Bold */
  label: {
    fontFamily: fontFamily.display,
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: 1.3,
  },
  /** Prices, values - 11px Normal */
  price: {
    fontFamily: fontFamily.price,
    fontSize: '11px',
    fontWeight: 400,
    lineHeight: 1.3,
  },
  /** Brand names - 13px Normal */
  brand: {
    fontFamily: fontFamily.brand,
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: 1.3,
  },
  /** Status bar time - 17px Semibold */
  system: {
    fontFamily: fontFamily.system,
    fontSize: '17px',
    fontWeight: 600,
    lineHeight: 1.2,
  },
} as const;

/**
 * CSS custom property tokens for typography
 */
export const typographyTokens = {
  '--font-display': fontFamily.display,
  '--font-price': fontFamily.price,
  '--font-brand': fontFamily.brand,
  '--font-system': fontFamily.system,
} as const;

/**
 * Tailwind-compatible font family configuration
 */
export const tailwindFontFamily = {
  display: ['Life Savers', 'cursive', 'sans-serif'],
  price: ['Alata', 'sans-serif'],
  brand: ['Lohit Tamil', 'Lohit Bengali', 'Noto Sans', 'sans-serif'],
  system: ['SF Pro', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
} as const;

/**
 * Tailwind-compatible font size configuration
 */
export const tailwindFontSize = {
  'display': ['16px', { lineHeight: '1.3', fontWeight: '700' }],
  'body': ['12px', { lineHeight: '1.4', fontWeight: '700' }],
  'label': ['11px', { lineHeight: '1.3', fontWeight: '700' }],
  'price': ['11px', { lineHeight: '1.3', fontWeight: '400' }],
  'brand': ['13px', { lineHeight: '1.3', fontWeight: '400' }],
  'system': ['17px', { lineHeight: '1.2', fontWeight: '600' }],
} as const;

export type TypographyToken = keyof typeof typography;
