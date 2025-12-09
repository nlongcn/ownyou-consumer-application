/**
 * ThemeProvider - CSS Custom Property Injection
 *
 * Injects OwnYou design tokens as CSS custom properties at the root level.
 * This enables consistent theming across the application and supports
 * future theme switching (light/dark mode).
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3
 */

import React, { createContext, useContext, useMemo } from 'react';
import { colorTokens } from '../tokens/colors';
import { typographyTokens } from '../tokens/typography';
import { spacingTokens } from '../tokens/spacing';

/**
 * All CSS custom properties combined
 */
const allTokens = {
  ...colorTokens,
  ...typographyTokens,
  ...spacingTokens,
} as const;

type TokenMap = typeof allTokens;

interface ThemeContextValue {
  tokens: TokenMap;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Override specific tokens (for theming)
   */
  overrides?: Partial<TokenMap>;
}

/**
 * ThemeProvider injects design tokens as CSS custom properties
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children, overrides }: ThemeProviderProps): React.ReactElement {
  const tokens = useMemo(() => ({
    ...allTokens,
    ...overrides,
  }), [overrides]);

  const style = useMemo(() => {
    const cssVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(tokens)) {
      cssVars[key] = value;
    }
    return cssVars as React.CSSProperties;
  }, [tokens]);

  const contextValue = useMemo(() => ({ tokens }), [tokens]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <div style={style} className="ownyou-theme-root">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme tokens
 *
 * @example
 * ```tsx
 * function Component() {
 *   const { tokens } = useTheme();
 *   return <div style={{ color: tokens['--color-primary'] }} />;
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Get token value by name
 */
export function getToken<K extends keyof TokenMap>(name: K): TokenMap[K] {
  return allTokens[name];
}
