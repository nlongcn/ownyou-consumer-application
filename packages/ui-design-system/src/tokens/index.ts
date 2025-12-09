/**
 * OwnYou Design Tokens - v13 Section 4.3
 *
 * Central export for all design tokens used across the OwnYou application.
 * These tokens ensure visual consistency between PWA and Tauri desktop builds.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3
 */

export {
  colors,
  colorTokens,
  tailwindColors,
  type ColorToken,
  type ColorValue,
} from './colors';

export {
  fontFamily,
  typography,
  typographyTokens,
  tailwindFontFamily,
  tailwindFontSize,
  type TypographyToken,
} from './typography';

export {
  radius,
  cardDimensions,
  breakpoints,
  masonryColumns,
  spacingTokens,
  tailwindBorderRadius,
  tailwindSpacing,
  tailwindScreens,
  type RadiusToken,
  type BreakpointToken,
} from './spacing';

import { colorTokens } from './colors';
import { typographyTokens } from './typography';
import { spacingTokens } from './spacing';

/**
 * Combined CSS custom properties for ThemeProvider injection
 */
export const allTokens = {
  ...colorTokens,
  ...typographyTokens,
  ...spacingTokens,
} as const;

/**
 * Get all tokens as a CSSProperties-compatible object
 */
export function getTokenStyles(): React.CSSProperties {
  return allTokens as unknown as React.CSSProperties;
}
