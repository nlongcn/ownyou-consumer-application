/**
 * OwnYou Color Palette - v13 Section 4.3.1
 *
 * Defines the complete color system for the OwnYou consumer application.
 * These values are extracted from the Figma designs (OwnYou May-25 Mockup).
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3.1
 */

/**
 * Raw color values from v13 specification
 */
export const colors = {
  /** Sky Blue - App background, navigation */
  primary: '#87CEEB',
  /** Mint Green - Savings section, success states */
  secondary: '#70DF82',
  /** Off-white - Card backgrounds */
  cardBg: '#FFFBFB',
  /** Light gray - Utility card backgrounds */
  cardBgAlt: '#F4F5F7',
  /** Primary text color */
  textPrimary: '#000000',
  /** Text on colored backgrounds */
  textSecondary: '#FFFBFB',
  /** Image placeholders */
  placeholder: '#D9D9D9',
  /** White */
  white: '#FFFFFF',
  /** Transparent */
  transparent: 'transparent',
  /** Current color */
  current: 'currentColor',
} as const;

/**
 * CSS custom property tokens for injection via ThemeProvider
 */
export const colorTokens = {
  '--color-primary': colors.primary,
  '--color-secondary': colors.secondary,
  '--color-card-bg': colors.cardBg,
  '--color-card-bg-alt': colors.cardBgAlt,
  '--color-text-primary': colors.textPrimary,
  '--color-text-secondary': colors.textSecondary,
  '--color-placeholder': colors.placeholder,
} as const;

/**
 * Tailwind-compatible color configuration
 * Use in tailwind.config.js: theme.extend.colors
 */
export const tailwindColors = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  'card-bg': 'var(--color-card-bg)',
  'card-bg-alt': 'var(--color-card-bg-alt)',
  'text-primary': 'var(--color-text-primary)',
  'text-secondary': 'var(--color-text-secondary)',
  placeholder: 'var(--color-placeholder)',
  // Include raw values for SSR/static builds
  ownyou: {
    primary: colors.primary,
    secondary: colors.secondary,
    'card-bg': colors.cardBg,
    'card-bg-alt': colors.cardBgAlt,
    placeholder: colors.placeholder,
  },
} as const;

export type ColorToken = keyof typeof colors;
export type ColorValue = (typeof colors)[ColorToken];
