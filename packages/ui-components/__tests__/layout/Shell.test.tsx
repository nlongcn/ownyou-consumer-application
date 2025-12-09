/**
 * Shell Component Tests
 * v13 Section 4.6
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Shell } from '../../src/layout/Shell';

describe('Shell', () => {
  it('should render children', () => {
    render(<Shell>Content</Shell>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should have data-testid', () => {
    render(<Shell>Content</Shell>);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });

  it('should have sky blue background', () => {
    render(<Shell>Content</Shell>);
    const shell = screen.getByTestId('shell');
    expect(shell.className).toContain('bg-ownyou-primary');
  });

  it('should render header when provided', () => {
    render(
      <Shell header={<div data-testid="header">Header</div>}>
        Content
      </Shell>
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('should render navigation when provided', () => {
    render(
      <Shell navigation={<div data-testid="nav">Nav</div>}>
        Content
      </Shell>
    );
    // Navigation is rendered in both sidebar (desktop) and bottom (mobile)
    const navElements = screen.getAllByTestId('nav');
    expect(navElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should have min-h-screen', () => {
    render(<Shell>Content</Shell>);
    const shell = screen.getByTestId('shell');
    expect(shell.className).toContain('min-h-screen');
  });

  it('should apply custom className', () => {
    render(<Shell className="custom-class">Content</Shell>);
    const shell = screen.getByTestId('shell');
    expect(shell.className).toContain('custom-class');
  });

  it('should hide sidebar when showSidebar is false', () => {
    render(
      <Shell navigation={<div data-testid="nav">Nav</div>} showSidebar={false}>
        Content
      </Shell>
    );
    // Sidebar should not have the hidden lg:block classes
    const shell = screen.getByTestId('shell');
    expect(shell.querySelector('aside')).not.toBeInTheDocument();
  });
});
