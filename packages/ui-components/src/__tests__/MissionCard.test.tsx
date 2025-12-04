/**
 * MissionCard Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionCard } from '../MissionCard';
import type { MissionCard as MissionCardType } from '@ownyou/shared-types';

// Sample mission card
const createMission = (overrides: Partial<MissionCardType> = {}): MissionCardType => ({
  id: 'mission-1',
  type: 'shopping',
  title: 'Deal Alert: 25% off Headphones',
  summary: 'Sony WH-1000XM5 is on sale',
  urgency: 'medium',
  status: 'CREATED',
  createdAt: Date.now() - 3600000, // 1 hour ago
  ikigaiDimensions: ['productivity'],
  ikigaiAlignmentBoost: 0.5,
  primaryAction: {
    label: 'View Deal',
    type: 'navigate',
    payload: { route: '/deals/1' },
  },
  secondaryActions: [
    { label: 'Dismiss', type: 'confirm', payload: { action: 'dismiss' } },
    { label: 'Snooze', type: 'confirm', payload: { action: 'snooze' } },
  ],
  agentThreadId: 'thread-1',
  evidenceRefs: [],
  ...overrides,
});

describe('MissionCard', () => {
  it('should render mission title and summary', () => {
    render(<MissionCard mission={createMission()} />);

    expect(screen.getByText('Deal Alert: 25% off Headphones')).toBeDefined();
    expect(screen.getByText('Sony WH-1000XM5 is on sale')).toBeDefined();
  });

  it('should render agent type badge', () => {
    render(<MissionCard mission={createMission()} />);

    expect(screen.getByText('shopping')).toBeDefined();
  });

  it('should render urgency badge', () => {
    render(<MissionCard mission={createMission()} />);

    expect(screen.getByText('medium')).toBeDefined();
  });

  it('should render primary action button', () => {
    render(<MissionCard mission={createMission()} />);

    const button = screen.getByTestId('primary-action');
    expect(button.textContent).toBe('View Deal');
  });

  it('should render secondary action buttons', () => {
    render(<MissionCard mission={createMission()} />);

    expect(screen.getByTestId('secondary-action-0').textContent).toBe('Dismiss');
    expect(screen.getByTestId('secondary-action-1').textContent).toBe('Snooze');
  });

  it('should call onAction when primary action clicked', () => {
    const onAction = vi.fn();
    const mission = createMission();

    render(<MissionCard mission={mission} onAction={onAction} />);

    fireEvent.click(screen.getByTestId('primary-action'));

    expect(onAction).toHaveBeenCalledWith(mission, mission.primaryAction);
  });

  it('should call onAction when secondary action clicked', () => {
    const onAction = vi.fn();
    const mission = createMission();

    render(<MissionCard mission={mission} onAction={onAction} />);

    fireEvent.click(screen.getByTestId('secondary-action-0'));

    expect(onAction).toHaveBeenCalledWith(mission, mission.secondaryActions![0]);
  });

  it('should not call onAction when disabled', () => {
    const onAction = vi.fn();

    render(<MissionCard mission={createMission()} onAction={onAction} disabled />);

    fireEvent.click(screen.getByTestId('primary-action'));

    expect(onAction).not.toHaveBeenCalled();
  });

  it('should render ikigai dimensions', () => {
    render(<MissionCard mission={createMission({ ikigaiDimensions: ['productivity', 'savings'] })} />);

    expect(screen.getByText('productivity')).toBeDefined();
    expect(screen.getByText('savings')).toBeDefined();
  });

  it('should show feedback buttons for completed missions', () => {
    render(<MissionCard mission={createMission({ status: 'COMPLETED' })} />);

    expect(screen.getByTestId('feedback-buttons')).toBeDefined();
  });

  it('should not show feedback buttons for non-completed missions', () => {
    render(<MissionCard mission={createMission({ status: 'ACTIVE' })} />);

    expect(screen.queryByTestId('feedback-buttons')).toBeNull();
  });

  it('should call onFeedback when feedback selected', () => {
    const onFeedback = vi.fn();
    const mission = createMission({ status: 'COMPLETED' });

    render(<MissionCard mission={mission} onFeedback={onFeedback} />);

    fireEvent.click(screen.getByTestId('feedback-love'));

    expect(onFeedback).toHaveBeenCalledWith(mission, 'love');
  });

  it('should show expired state', () => {
    const expiredMission = createMission({
      expiresAt: Date.now() - 3600000, // 1 hour ago
    });

    render(<MissionCard mission={expiredMission} />);

    expect(screen.getByText(/expired/i)).toBeDefined();
  });

  it('should disable primary action for expired missions', () => {
    const expiredMission = createMission({
      expiresAt: Date.now() - 3600000,
    });

    render(<MissionCard mission={expiredMission} />);

    const button = screen.getByTestId('primary-action');
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
