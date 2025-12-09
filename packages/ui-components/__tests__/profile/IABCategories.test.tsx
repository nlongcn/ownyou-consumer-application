/**
 * IABCategories Component Tests
 * v13 Section 4.4
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IABCategories } from '../../src/profile/IABCategories';
import type { IABCategory } from '../../src/profile/IABCategories';

const mockCategories: IABCategory[] = [
  { id: 'tech', name: 'Technology', score: 85, icon: '💻', subcategories: [{ name: 'Gadgets', score: 90 }] },
  { id: 'sports', name: 'Sports', score: 70, icon: '⚽' },
  { id: 'food', name: 'Food & Drink', score: 55, icon: '🍔' },
  { id: 'travel', name: 'Travel', score: 40, icon: '✈️' },
  { id: 'music', name: 'Music', score: 30, icon: '🎵' },
  { id: 'fashion', name: 'Fashion', score: 20, icon: '👗' },
  { id: 'finance', name: 'Finance', score: 15, icon: '💰' },
];

describe('IABCategories', () => {
  it('should render with data-testid', () => {
    render(<IABCategories categories={mockCategories} />);
    expect(screen.getByTestId('iab-categories')).toBeInTheDocument();
  });

  it('should render title', () => {
    render(<IABCategories categories={mockCategories} />);
    expect(screen.getByText('Your Interests')).toBeInTheDocument();
  });

  it('should render categories up to maxVisible', () => {
    render(<IABCategories categories={mockCategories} maxVisible={3} />);
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Sports')).toBeInTheDocument();
    expect(screen.getByText('Food & Drink')).toBeInTheDocument();
    expect(screen.queryByText('Travel')).not.toBeInTheDocument();
  });

  it('should render category icons', () => {
    render(<IABCategories categories={mockCategories} maxVisible={2} />);
    expect(screen.getByText('💻')).toBeInTheDocument();
    expect(screen.getByText('⚽')).toBeInTheDocument();
  });

  it('should render category scores', () => {
    render(<IABCategories categories={mockCategories} maxVisible={2} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('should render progress bars', () => {
    render(<IABCategories categories={mockCategories} maxVisible={2} />);
    const techCategory = screen.getByTestId('iab-category-tech');
    const progressBar = techCategory.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '85%' });
  });

  it('should render subcategories', () => {
    render(<IABCategories categories={mockCategories} maxVisible={2} />);
    expect(screen.getByText('Gadgets')).toBeInTheDocument();
  });

  it('should show expand button when more categories exist', () => {
    render(<IABCategories categories={mockCategories} maxVisible={3} />);
    expect(screen.getByText('Show 4 More')).toBeInTheDocument();
  });

  it('should hide expand button when no more categories', () => {
    render(<IABCategories categories={mockCategories.slice(0, 2)} maxVisible={3} />);
    expect(screen.queryByText(/Show.*More/)).not.toBeInTheDocument();
  });

  it('should expand when expand button is clicked', () => {
    render(<IABCategories categories={mockCategories} maxVisible={3} />);

    fireEvent.click(screen.getByText('Show 4 More'));

    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Show Less')).toBeInTheDocument();
  });

  it('should collapse when collapse button is clicked', () => {
    render(<IABCategories categories={mockCategories} maxVisible={3} />);

    // Expand
    fireEvent.click(screen.getByText('Show 4 More'));
    // Collapse
    fireEvent.click(screen.getByText('Show Less'));

    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    expect(screen.getByText('Show 4 More')).toBeInTheDocument();
  });

  it('should hide expand button when expandable is false', () => {
    render(<IABCategories categories={mockCategories} maxVisible={3} expandable={false} />);
    expect(screen.queryByText(/Show.*More/)).not.toBeInTheDocument();
  });

  it('should call onCategoryClick when category is clicked', () => {
    const handleClick = vi.fn();
    render(<IABCategories categories={mockCategories} onCategoryClick={handleClick} maxVisible={2} />);

    fireEvent.click(screen.getByTestId('iab-category-tech'));

    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tech', name: 'Technology' })
    );
  });

  it('should apply correct color for high scores (80+)', () => {
    render(<IABCategories categories={mockCategories} maxVisible={1} />);
    const category = screen.getByTestId('iab-category-tech');
    expect(category.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('should apply correct color for low scores (<20)', () => {
    render(<IABCategories categories={mockCategories} />);
    // Expand to see low score category
    fireEvent.click(screen.getByText(/Show.*More/));
    const category = screen.getByTestId('iab-category-finance');
    expect(category.querySelector('.bg-gray-300')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<IABCategories categories={mockCategories} className="custom-class" />);
    const container = screen.getByTestId('iab-categories');
    expect(container.className).toContain('custom-class');
  });
});
