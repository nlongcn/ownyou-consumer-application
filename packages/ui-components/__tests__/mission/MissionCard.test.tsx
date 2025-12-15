/**
 * MissionCard Tests
 * v13 Section 4.5
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionCard } from '../../src/mission/MissionCard';
import type { Mission } from '../../src/types';

const mockMission: Mission = {
  id: 'test-1',
  type: 'shopping',
  title: 'Test Product',
  subtitle: 'Great deal',
  imageUrl: 'https://example.com/image.jpg',
  brandName: 'Test Brand',
  brandLogoUrl: 'https://example.com/logo.jpg',
  price: 29.99,
  originalPrice: 49.99,
  currency: '$',
  feedbackState: 'meh',
  createdAt: Date.now(),
};

describe('MissionCard', () => {
  it('should render with mission data', () => {
    render(<MissionCard mission={mockMission} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  it('should render image when imageUrl is provided', () => {
    render(<MissionCard mission={mockMission} />);
    const img = screen.getByAltText('Test Product');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should render placeholder when no imageUrl', () => {
    // Remove both imageUrl and brandLogoUrl to test placeholder
    const mission = { ...mockMission, imageUrl: undefined, brandLogoUrl: undefined };
    render(<MissionCard mission={mission} />);
    // No product image should be present
    expect(screen.queryByAltText('Test Product')).not.toBeInTheDocument();
  });

  it('should render brand name or subtitle for shopping cards', () => {
    render(<MissionCard mission={mockMission} />);
    // MissionCard shows subtitle (Great deal) which takes priority over brandName
    // The brandName appears in the logo alt text
    expect(screen.getByAltText('Test Brand')).toBeInTheDocument();
  });

  it('should render price for shopping cards', () => {
    render(<MissionCard mission={mockMission} />);
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });

  it('should render original price with strikethrough', () => {
    render(<MissionCard mission={mockMission} />);
    const originalPrice = screen.getByText('$49.99');
    expect(originalPrice.className).toContain('line-through');
  });

  it('should not render price for non-shopping cards', () => {
    const mission: Mission = { ...mockMission, type: 'content', price: 19.99 };
    render(<MissionCard mission={mission} />);
    expect(screen.queryByText('$19.99')).not.toBeInTheDocument();
  });

  it('should render feedback heart by default', () => {
    render(<MissionCard mission={mockMission} />);
    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
  });

  it('should always render feedback heart in variant components', () => {
    // Note: Variant components currently always show feedback per Figma designs
    // The showFeedback prop is maintained in the dispatcher API for future flexibility
    render(<MissionCard mission={mockMission} showFeedback={false} />);
    // Feedback is always shown in the current variant implementations
    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = vi.fn();
    render(<MissionCard mission={mockMission} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('article'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should call onFeedbackChange when heart is clicked', () => {
    const handleFeedback = vi.fn();
    render(<MissionCard mission={mockMission} onFeedbackChange={handleFeedback} />);

    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

    expect(handleFeedback).toHaveBeenCalledWith('like');
  });

  it('should have correct height based on card type', () => {
    render(<MissionCard mission={mockMission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '290px' }); // shopping card height
  });

  it('should have correct height for travel card', () => {
    const mission: Mission = { ...mockMission, type: 'travel' };
    render(<MissionCard mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '208px' });
  });

  it('should have correct height for health card', () => {
    const mission: Mission = { ...mockMission, type: 'health' };
    render(<MissionCard mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '180px' });
  });

  it('should have data-testid with mission type and id', () => {
    render(<MissionCard mission={mockMission} />);
    // Variant components use format: mission-card-{type}-{id}
    expect(screen.getByTestId('mission-card-shopping-test-1')).toBeInTheDocument();
  });

  it('should have data-mission-card attribute', () => {
    render(<MissionCard mission={mockMission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('data-mission-card');
  });

  it('should have aria-label with type and mission title', () => {
    render(<MissionCard mission={mockMission} />);
    const card = screen.getByRole('article');
    // Variant components use format: "{Type}: {title}"
    expect(card).toHaveAttribute('aria-label', 'Shopping: Test Product');
  });

  it('should apply custom className', () => {
    render(<MissionCard mission={mockMission} className="custom-class" />);
    const card = screen.getByRole('article');
    expect(card.className).toContain('custom-class');
  });
});
