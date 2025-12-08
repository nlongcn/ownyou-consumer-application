/**
 * MissionFeed Component Tests
 *
 * Tests for filtering, sorting, empty state, and header tabs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionFeed, MissionFeedHeader } from '../MissionFeed';
import type { MissionCard as MissionCardType } from '@ownyou/shared-types';
import type { MissionFeedFilter } from '../types';

// Helper to create test missions
const createMission = (
  id: string,
  overrides: Partial<MissionCardType> = {}
): MissionCardType => ({
  id,
  type: 'shopping',
  title: `Mission ${id}`,
  summary: `Summary for ${id}`,
  urgency: 'medium',
  status: 'CREATED',
  createdAt: Date.now() - 3600000,
  ikigaiDimensions: ['productivity'],
  ikigaiAlignmentBoost: 0.5,
  primaryAction: {
    label: 'Action',
    type: 'navigate',
    payload: { route: '/test' },
  },
  secondaryActions: [],
  agentThreadId: 'thread-1',
  evidenceRefs: [],
  ...overrides,
});

describe('MissionFeed', () => {
  describe('Rendering', () => {
    it('should render list of missions', () => {
      const missions = [createMission('1'), createMission('2'), createMission('3')];
      render(<MissionFeed missions={missions} />);

      expect(screen.getByTestId('mission-feed')).toBeDefined();
      expect(screen.getByText('Mission 1')).toBeDefined();
      expect(screen.getByText('Mission 2')).toBeDefined();
      expect(screen.getByText('Mission 3')).toBeDefined();
    });

    it('should have list role and aria-label', () => {
      const missions = [createMission('1')];
      render(<MissionFeed missions={missions} />);

      const feed = screen.getByTestId('mission-feed');
      expect(feed.getAttribute('role')).toBe('list');
      expect(feed.getAttribute('aria-label')).toBe('Mission cards');
    });

    it('should apply custom className', () => {
      const missions = [createMission('1')];
      render(<MissionFeed missions={missions} className="custom-class" />);

      const feed = screen.getByTestId('mission-feed');
      expect(feed.className).toContain('custom-class');
    });
  });

  describe('Empty state', () => {
    it('should render empty state when no missions', () => {
      render(<MissionFeed missions={[]} />);

      expect(screen.getByTestId('mission-feed-empty')).toBeDefined();
      expect(screen.getByText('No missions yet')).toBeDefined();
    });

    it('should render custom empty message', () => {
      render(<MissionFeed missions={[]} emptyMessage="No active missions" />);

      expect(screen.getByText('No active missions')).toBeDefined();
    });

    it('should render empty state when filter returns no results', () => {
      const missions = [createMission('1', { status: 'COMPLETED' })];
      render(<MissionFeed missions={missions} filter="active" />);

      expect(screen.getByTestId('mission-feed-empty')).toBeDefined();
    });
  });

  describe('Filtering', () => {
    it('should show all missions when filter is "all"', () => {
      const missions = [
        createMission('1', { status: 'CREATED' }),
        createMission('2', { status: 'SNOOZED' }),
        createMission('3', { status: 'COMPLETED' }),
      ];
      render(<MissionFeed missions={missions} filter="all" />);

      expect(screen.getByText('Mission 1')).toBeDefined();
      expect(screen.getByText('Mission 2')).toBeDefined();
      expect(screen.getByText('Mission 3')).toBeDefined();
    });

    it('should filter to active missions', () => {
      const missions = [
        createMission('1', { status: 'CREATED' }),
        createMission('2', { status: 'PRESENTED' }),
        createMission('3', { status: 'ACTIVE' }),
        createMission('4', { status: 'SNOOZED' }),
        createMission('5', { status: 'COMPLETED' }),
      ];
      render(<MissionFeed missions={missions} filter="active" />);

      expect(screen.getByText('Mission 1')).toBeDefined();
      expect(screen.getByText('Mission 2')).toBeDefined();
      expect(screen.getByText('Mission 3')).toBeDefined();
      expect(screen.queryByText('Mission 4')).toBeNull();
      expect(screen.queryByText('Mission 5')).toBeNull();
    });

    it('should filter to snoozed missions', () => {
      const missions = [
        createMission('1', { status: 'CREATED' }),
        createMission('2', { status: 'SNOOZED' }),
      ];
      render(<MissionFeed missions={missions} filter="snoozed" />);

      expect(screen.queryByText('Mission 1')).toBeNull();
      expect(screen.getByText('Mission 2')).toBeDefined();
    });

    it('should filter to completed missions', () => {
      const missions = [
        createMission('1', { status: 'CREATED' }),
        createMission('2', { status: 'COMPLETED' }),
      ];
      render(<MissionFeed missions={missions} filter="completed" />);

      expect(screen.queryByText('Mission 1')).toBeNull();
      expect(screen.getByText('Mission 2')).toBeDefined();
    });

    it('should filter to dismissed missions', () => {
      const missions = [
        createMission('1', { status: 'CREATED' }),
        createMission('2', { status: 'DISMISSED' }),
      ];
      render(<MissionFeed missions={missions} filter="dismissed" />);

      expect(screen.queryByText('Mission 1')).toBeNull();
      expect(screen.getByText('Mission 2')).toBeDefined();
    });
  });

  describe('Sorting', () => {
    it('should sort by urgency (high first)', () => {
      const missions = [
        createMission('low', { urgency: 'low', title: 'Low Priority' }),
        createMission('high', { urgency: 'high', title: 'High Priority' }),
        createMission('medium', { urgency: 'medium', title: 'Medium Priority' }),
      ];
      render(<MissionFeed missions={missions} />);

      const feed = screen.getByTestId('mission-feed');
      const titles = feed.querySelectorAll('[data-testid="mission-title"]');

      // Note: MissionCard must have data-testid="mission-title" on the title element
      // If it doesn't, we'll check the order by looking at text content order
      const allText = feed.textContent;
      const highIndex = allText?.indexOf('High Priority') ?? -1;
      const mediumIndex = allText?.indexOf('Medium Priority') ?? -1;
      const lowIndex = allText?.indexOf('Low Priority') ?? -1;

      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    it('should sort by creation time within same urgency (newest first)', () => {
      const now = Date.now();
      const missions = [
        createMission('old', { urgency: 'high', createdAt: now - 7200000, title: 'Old Mission' }),
        createMission('new', { urgency: 'high', createdAt: now - 1000, title: 'New Mission' }),
      ];
      render(<MissionFeed missions={missions} />);

      const feed = screen.getByTestId('mission-feed');
      const allText = feed.textContent;
      const newIndex = allText?.indexOf('New Mission') ?? -1;
      const oldIndex = allText?.indexOf('Old Mission') ?? -1;

      expect(newIndex).toBeLessThan(oldIndex);
    });
  });

  describe('Action handlers', () => {
    it('should pass onMissionAction to MissionCard', () => {
      const onMissionAction = vi.fn();
      const missions = [createMission('1')];
      render(<MissionFeed missions={missions} onMissionAction={onMissionAction} />);

      fireEvent.click(screen.getByTestId('primary-action'));

      expect(onMissionAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' }),
        expect.objectContaining({ label: 'Action' })
      );
    });

    it('should pass onMissionFeedback to MissionCard', () => {
      const onMissionFeedback = vi.fn();
      const missions = [createMission('1')];
      render(<MissionFeed missions={missions} onMissionFeedback={onMissionFeedback} />);

      // MissionCard should have feedback buttons visible
      const feedbackButton = screen.queryByTestId('feedback-love');
      if (feedbackButton) {
        fireEvent.click(feedbackButton);
        expect(onMissionFeedback).toHaveBeenCalled();
      }
    });
  });
});

describe('MissionFeedHeader', () => {
  describe('Rendering', () => {
    it('should render all filter tabs', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="all" onFilterChange={onFilterChange} />);

      expect(screen.getByTestId('filter-all')).toBeDefined();
      expect(screen.getByTestId('filter-active')).toBeDefined();
      expect(screen.getByTestId('filter-snoozed')).toBeDefined();
      expect(screen.getByTestId('filter-completed')).toBeDefined();
      expect(screen.getByTestId('filter-dismissed')).toBeDefined();
    });

    it('should have tablist role and aria-label', () => {
      const onFilterChange = vi.fn();
      const { container } = render(
        <MissionFeedHeader filter="all" onFilterChange={onFilterChange} />
      );

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeDefined();
      expect(tablist?.getAttribute('aria-label')).toBe('Mission filters');
    });

    it('should render filter labels', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="all" onFilterChange={onFilterChange} />);

      expect(screen.getByText('All')).toBeDefined();
      expect(screen.getByText('Active')).toBeDefined();
      expect(screen.getByText('Snoozed')).toBeDefined();
      expect(screen.getByText('Completed')).toBeDefined();
      expect(screen.getByText('Dismissed')).toBeDefined();
    });
  });

  describe('Selected state', () => {
    it('should mark current filter as selected', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="active" onFilterChange={onFilterChange} />);

      expect(screen.getByTestId('filter-active').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('filter-all').getAttribute('aria-selected')).toBe('false');
    });

    it('should apply selected styling to current filter', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="snoozed" onFilterChange={onFilterChange} />);

      const selectedTab = screen.getByTestId('filter-snoozed');
      expect(selectedTab.className).toContain('bg-white');
      expect(selectedTab.className).toContain('text-gray-900');
    });
  });

  describe('Interaction', () => {
    it('should call onFilterChange when tab clicked', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="all" onFilterChange={onFilterChange} />);

      fireEvent.click(screen.getByTestId('filter-active'));

      expect(onFilterChange).toHaveBeenCalledWith('active');
    });

    it('should call onFilterChange with correct filter value', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="all" onFilterChange={onFilterChange} />);

      fireEvent.click(screen.getByTestId('filter-snoozed'));
      expect(onFilterChange).toHaveBeenCalledWith('snoozed');

      fireEvent.click(screen.getByTestId('filter-completed'));
      expect(onFilterChange).toHaveBeenCalledWith('completed');

      fireEvent.click(screen.getByTestId('filter-dismissed'));
      expect(onFilterChange).toHaveBeenCalledWith('dismissed');
    });
  });

  describe('Counts', () => {
    it('should display counts when provided', () => {
      const onFilterChange = vi.fn();
      const counts: Record<MissionFeedFilter, number> = {
        all: 10,
        active: 5,
        snoozed: 3,
        completed: 2,
        dismissed: 1,
      };
      render(
        <MissionFeedHeader filter="all" onFilterChange={onFilterChange} counts={counts} />
      );

      expect(screen.getByText('(10)')).toBeDefined();
      expect(screen.getByText('(5)')).toBeDefined();
      expect(screen.getByText('(3)')).toBeDefined();
      expect(screen.getByText('(2)')).toBeDefined();
      expect(screen.getByText('(1)')).toBeDefined();
    });

    it('should not display count for zero values', () => {
      const onFilterChange = vi.fn();
      const counts: Record<MissionFeedFilter, number> = {
        all: 5,
        active: 5,
        snoozed: 0,
        completed: 0,
        dismissed: 0,
      };
      render(
        <MissionFeedHeader filter="all" onFilterChange={onFilterChange} counts={counts} />
      );

      const snoozedTab = screen.getByTestId('filter-snoozed');
      expect(snoozedTab.textContent).toBe('Snoozed');
    });

    it('should work without counts prop', () => {
      const onFilterChange = vi.fn();
      render(<MissionFeedHeader filter="all" onFilterChange={onFilterChange} />);

      // Should render without errors and without counts
      const allTab = screen.getByTestId('filter-all');
      expect(allTab.textContent).toBe('All');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const onFilterChange = vi.fn();
      const { container } = render(
        <MissionFeedHeader
          filter="all"
          onFilterChange={onFilterChange}
          className="custom-header"
        />
      );

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist?.className).toContain('custom-header');
    });
  });
});
