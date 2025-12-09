/**
 * Design Tokens Tests - v13 Section 4.3
 *
 * Verifies that all design tokens match the v13 specification.
 */

import { describe, it, expect } from 'vitest';
import {
  colors,
  colorTokens,
  tailwindColors,
  fontFamily,
  typography,
  typographyTokens,
  tailwindFontFamily,
  radius,
  cardDimensions,
  breakpoints,
  masonryColumns,
  spacingTokens,
  allTokens,
} from '../src/tokens';

describe('Color Tokens - v13 Section 4.3.1', () => {
  it('should define primary color as Sky Blue (#87CEEB)', () => {
    expect(colors.primary).toBe('#87CEEB');
  });

  it('should define secondary color as Mint Green (#70DF82)', () => {
    expect(colors.secondary).toBe('#70DF82');
  });

  it('should define card background as off-white (#FFFBFB)', () => {
    expect(colors.cardBg).toBe('#FFFBFB');
  });

  it('should define placeholder color (#D9D9D9)', () => {
    expect(colors.placeholder).toBe('#D9D9D9');
  });

  it('should export CSS custom property tokens', () => {
    expect(colorTokens['--color-primary']).toBe('#87CEEB');
    expect(colorTokens['--color-secondary']).toBe('#70DF82');
    expect(colorTokens['--color-card-bg']).toBe('#FFFBFB');
  });

  it('should export Tailwind-compatible colors using CSS variables', () => {
    expect(tailwindColors.primary).toBe('var(--color-primary)');
    expect(tailwindColors.secondary).toBe('var(--color-secondary)');
  });

  it('should include raw color values in ownyou namespace for SSR', () => {
    expect(tailwindColors.ownyou.primary).toBe('#87CEEB');
    expect(tailwindColors.ownyou.secondary).toBe('#70DF82');
  });
});

describe('Typography Tokens - v13 Section 4.3.2', () => {
  it('should define Life Savers as display font', () => {
    expect(fontFamily.display).toContain('Life Savers');
  });

  it('should define Alata as price font', () => {
    expect(fontFamily.price).toContain('Alata');
  });

  it('should define SF Pro as system font', () => {
    expect(fontFamily.system).toContain('SF Pro');
  });

  it('should define display typography as 16px Bold', () => {
    expect(typography.display.fontSize).toBe('16px');
    expect(typography.display.fontWeight).toBe(700);
  });

  it('should define body typography as 12px Bold', () => {
    expect(typography.body.fontSize).toBe('12px');
    expect(typography.body.fontWeight).toBe(700);
  });

  it('should define label typography as 11px Bold', () => {
    expect(typography.label.fontSize).toBe('11px');
    expect(typography.label.fontWeight).toBe(700);
  });

  it('should define price typography as 11px Normal', () => {
    expect(typography.price.fontSize).toBe('11px');
    expect(typography.price.fontWeight).toBe(400);
  });

  it('should export CSS custom property tokens for fonts', () => {
    expect(typographyTokens['--font-display']).toContain('Life Savers');
    expect(typographyTokens['--font-price']).toContain('Alata');
  });

  it('should export Tailwind-compatible font families', () => {
    expect(tailwindFontFamily.display).toContain('Life Savers');
    expect(Array.isArray(tailwindFontFamily.display)).toBe(true);
  });
});

describe('Spacing Tokens - v13 Section 4.3.3', () => {
  it('should define card radius as 35px', () => {
    expect(radius.card).toBe('35px');
  });

  it('should define small card radius as 20px', () => {
    expect(radius.cardSmall).toBe('20px');
  });

  it('should define image radius as 12px', () => {
    expect(radius.image).toBe('12px');
  });

  it('should define nav radius as 12.5px', () => {
    expect(radius.nav).toBe('12.5px');
  });

  it('should define card width as 180px', () => {
    expect(cardDimensions.width).toBe('180px');
  });

  it('should define desktop card width as 260px', () => {
    expect(cardDimensions.widthDesktop).toBe('260px');
  });

  it('should define card gap as 13px', () => {
    expect(cardDimensions.gap).toBe('13px');
  });

  it('should export CSS custom property tokens for spacing', () => {
    expect(spacingTokens['--radius-card']).toBe('35px');
    expect(spacingTokens['--card-width']).toBe('180px');
  });
});

describe('Breakpoints - v13 Section 4.8', () => {
  it('should define mobile breakpoint at 640px', () => {
    expect(breakpoints.mobile).toBe('640px');
  });

  it('should define tablet breakpoint at 768px', () => {
    expect(breakpoints.tablet).toBe('768px');
  });

  it('should define desktop breakpoint at 1024px', () => {
    expect(breakpoints.desktop).toBe('1024px');
  });

  it('should define ultra-wide breakpoint at 1920px', () => {
    expect(breakpoints.ultraWide).toBe('1920px');
  });
});

describe('Masonry Grid Columns', () => {
  it('should define 2 columns for mobile (768px)', () => {
    expect(masonryColumns[768]).toBe(2);
  });

  it('should define 3 columns for desktop (1024px)', () => {
    expect(masonryColumns[1024]).toBe(3);
  });

  it('should define 4 columns for default (1920px+)', () => {
    expect(masonryColumns.default).toBe(4);
  });
});

describe('All Tokens Combined', () => {
  it('should include all color tokens', () => {
    expect(allTokens['--color-primary']).toBeDefined();
    expect(allTokens['--color-secondary']).toBeDefined();
  });

  it('should include all typography tokens', () => {
    expect(allTokens['--font-display']).toBeDefined();
    expect(allTokens['--font-price']).toBeDefined();
  });

  it('should include all spacing tokens', () => {
    expect(allTokens['--radius-card']).toBeDefined();
    expect(allTokens['--card-width']).toBeDefined();
  });
});
