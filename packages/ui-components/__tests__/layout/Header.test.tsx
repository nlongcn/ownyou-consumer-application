/**
 * Header Component Tests
 * v13 Section 4.6
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../../src/layout/Header';

describe('Header', () => {
  it('should render with data-testid', () => {
    render(<Header />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('should render default OwnYou text when no logo provided', () => {
    render(<Header />);
    expect(screen.getByText('OwnYou')).toBeInTheDocument();
  });

  it('should render custom logo when provided', () => {
    render(<Header logo={<div data-testid="custom-logo">Logo</div>} />);
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('should render token balance', () => {
    render(<Header tokenBalance={1234} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should hide token balance when showTokenBalance is false', () => {
    render(<Header tokenBalance={1234} showTokenBalance={false} />);
    expect(screen.queryByTestId('token-balance')).not.toBeInTheDocument();
  });

  it('should render filter tabs by default', () => {
    render(<Header />);
    expect(screen.getByTestId('filter-tabs')).toBeInTheDocument();
  });

  it('should hide filter tabs when showFilters is false', () => {
    render(<Header showFilters={false} />);
    expect(screen.queryByTestId('filter-tabs')).not.toBeInTheDocument();
  });

  it('should call onFilterChange when tab is clicked', () => {
    const handleFilter = vi.fn();
    render(<Header onFilterChange={handleFilter} />);

    fireEvent.click(screen.getByTestId('filter-tab-savings'));

    expect(handleFilter).toHaveBeenCalledWith('savings');
  });

  it('should show active filter', () => {
    render(<Header activeFilter="ikigai" />);
    const tab = screen.getByTestId('filter-tab-ikigai');
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('should apply custom className', () => {
    render(<Header className="custom-class" />);
    const header = screen.getByTestId('header');
    expect(header.className).toContain('custom-class');
  });

  it('should have sky blue background', () => {
    render(<Header />);
    const header = screen.getByTestId('header');
    expect(header.className).toContain('bg-ownyou-primary');
  });
});
