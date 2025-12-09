/**
 * MissionFeed Tests
 * v13 Section 4.7
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionFeed } from '../../src/mission/MissionFeed';
import type { Mission } from '../../src/types';

const mockMissions: Mission[] = [
  {
    id: 'mission-1',
    type: 'shopping',
    title: 'Product 1',
    price: 19.99,
    createdAt: Date.now(),
  },
  {
    id: 'mission-2',
    type: 'content',
    title: 'Article 1',
    createdAt: Date.now(),
  },
  {
    id: 'mission-3',
    type: 'travel',
    title: 'Trip 1',
    createdAt: Date.now(),
  },
];

describe('MissionFeed', () => {
  it('should render all missions', () => {
    render(<MissionFeed missions={mockMissions} />);
    expect(screen.getByText('Product 1')).toBeInTheDocument();
    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('Trip 1')).toBeInTheDocument();
  });

  it('should render empty state when no missions', () => {
    render(<MissionFeed missions={[]} />);
    expect(screen.getByTestId('mission-feed-empty')).toBeInTheDocument();
  });

  it('should show custom empty message', () => {
    render(<MissionFeed missions={[]} emptyMessage="No data available" />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should show loading skeletons when isLoading', () => {
    render(<MissionFeed missions={[]} isLoading />);
    const skeletons = screen.getAllByTestId('mission-card-skeleton');
    expect(skeletons.length).toBe(8);
  });

  it('should call onMissionClick when mission is clicked', () => {
    const handleClick = vi.fn();
    render(<MissionFeed missions={mockMissions} onMissionClick={handleClick} />);

    fireEvent.click(screen.getByText('Product 1').closest('[role="article"]')!);

    expect(handleClick).toHaveBeenCalledWith('mission-1');
  });

  it('should call onFeedbackChange when heart is clicked', () => {
    const handleFeedback = vi.fn();
    render(<MissionFeed missions={mockMissions} onFeedbackChange={handleFeedback} />);

    const hearts = screen.getAllByRole('button', { name: /feedback/i });
    fireEvent.click(hearts[0]);

    expect(handleFeedback).toHaveBeenCalledWith('mission-1', 'like');
  });

  it('should have masonry layout container', () => {
    render(<MissionFeed missions={mockMissions} />);
    expect(screen.getByTestId('mission-feed')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<MissionFeed missions={mockMissions} className="custom-class" />);
    const feed = screen.getByTestId('mission-feed');
    expect(feed.className).toContain('custom-class');
  });

  it('should show default empty state message', () => {
    render(<MissionFeed missions={[]} />);
    expect(screen.getByText('No missions yet. Check back soon!')).toBeInTheDocument();
  });

  it('should show emoji in empty state', () => {
    render(<MissionFeed missions={[]} />);
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });
});
