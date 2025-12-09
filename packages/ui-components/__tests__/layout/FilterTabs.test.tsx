/**
 * FilterTabs Component Tests
 * v13 Section 4.6
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterTabs } from '../../src/layout/FilterTabs';

describe('FilterTabs', () => {
  it('should render all tabs', () => {
    render(<FilterTabs />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
    expect(screen.getByText('Ikigai')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('should have role=tablist', () => {
    render(<FilterTabs />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('should mark active tab as selected', () => {
    render(<FilterTabs activeTab="savings" />);
    const tab = screen.getByTestId('filter-tab-savings');
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('should mark other tabs as not selected', () => {
    render(<FilterTabs activeTab="savings" />);
    const allTab = screen.getByTestId('filter-tab-all');
    expect(allTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should call onTabChange when tab is clicked', () => {
    const handleChange = vi.fn();
    render(<FilterTabs onTabChange={handleChange} />);

    fireEvent.click(screen.getByText('Ikigai'));

    expect(handleChange).toHaveBeenCalledWith('ikigai');
  });

  it('should default to all tab active', () => {
    render(<FilterTabs />);
    const tab = screen.getByTestId('filter-tab-all');
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('should apply active styles to selected tab', () => {
    render(<FilterTabs activeTab="health" />);
    const tab = screen.getByTestId('filter-tab-health');
    expect(tab.className).toContain('bg-white');
  });

  it('should apply inactive styles to non-selected tabs', () => {
    render(<FilterTabs activeTab="all" />);
    const tab = screen.getByTestId('filter-tab-savings');
    expect(tab.className).toContain('bg-transparent');
  });

  it('should have aria-label on tablist', () => {
    render(<FilterTabs />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Filter missions');
  });

  it('should apply custom className', () => {
    render(<FilterTabs className="custom-class" />);
    const tabs = screen.getByTestId('filter-tabs');
    expect(tabs.className).toContain('custom-class');
  });
});
