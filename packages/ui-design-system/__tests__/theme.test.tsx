/**
 * ThemeProvider Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../src/theme';

// Test component to verify hook usage
function ThemeConsumer() {
  const { tokens } = useTheme();
  return (
    <div data-testid="consumer">
      <span data-testid="primary-color">{tokens['--color-primary']}</span>
      <span data-testid="card-radius">{tokens['--radius-card']}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('should render children', () => {
    render(
      <ThemeProvider>
        <div>Child content</div>
      </ThemeProvider>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should wrap children in theme root element', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );
    const themeRoot = document.querySelector('.ownyou-theme-root');
    expect(themeRoot).toBeInTheDocument();
  });

  it('should inject CSS custom properties as style', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );
    const themeRoot = document.querySelector('.ownyou-theme-root') as HTMLElement;
    expect(themeRoot.style.getPropertyValue('--color-primary')).toBe('#87CEEB');
  });

  it('should provide tokens via context', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('primary-color').textContent).toBe('#87CEEB');
    expect(screen.getByTestId('card-radius').textContent).toBe('35px');
  });

  it('should allow token overrides', () => {
    render(
      <ThemeProvider overrides={{ '--color-primary': '#FF0000' }}>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('primary-color').textContent).toBe('#FF0000');
  });

  it('should apply override to style', () => {
    render(
      <ThemeProvider overrides={{ '--color-primary': '#FF0000' }}>
        <div>Content</div>
      </ThemeProvider>
    );
    const themeRoot = document.querySelector('.ownyou-theme-root') as HTMLElement;
    expect(themeRoot.style.getPropertyValue('--color-primary')).toBe('#FF0000');
  });
});

describe('useTheme', () => {
  it('should throw error when used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<ThemeConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  it('should return tokens object', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // Verify multiple token types are available
    expect(screen.getByTestId('primary-color').textContent).toBeDefined();
    expect(screen.getByTestId('card-radius').textContent).toBeDefined();
  });
});

// Need to import vi for mocking
import { vi } from 'vitest';
