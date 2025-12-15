/**
 * Cost Dashboard Tests - v13 Section 10.5.3
 *
 * Tests for the Cost Dashboard UI component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  CostDashboard,
  BudgetMeter,
  CostChart,
  AgentPieChart,
  AlertsList,
} from '../components/CostDashboard';
import type { LLMMetrics, Alert } from '@ownyou/observability';

// Mock metrics for testing
const mockMetrics: LLMMetrics = {
  currentPeriod: {
    periodType: 'monthly',
    periodStart: Date.now() - 15 * 24 * 60 * 60 * 1000,
    totalCostUsd: 4.5,
    budgetLimitUsd: 10,
    budgetRemainingUsd: 5.5,
    budgetUsedPercent: 45,
    throttleState: 'normal',
  },
  byAgent: {
    shopping_agent: { tokens: 10000, costUsd: 2.0, calls: 50, avgLatencyMs: 500 },
    restaurant_agent: { tokens: 5000, costUsd: 1.5, calls: 30, avgLatencyMs: 450 },
    travel_agent: { tokens: 3000, costUsd: 1.0, calls: 20, avgLatencyMs: 600 },
  },
  byOperation: {
    mission_generation: { tokens: 8000, costUsd: 2.5, calls: 40 },
    classification: { tokens: 5000, costUsd: 1.5, calls: 35 },
    analysis: { tokens: 5000, costUsd: 0.5, calls: 25 },
  },
  byModel: {
    'gpt-4o-mini': { tokens: 15000, costUsd: 3.5, calls: 80 },
    'gpt-4o': { tokens: 3000, costUsd: 1.0, calls: 20 },
  },
  byDay: [
    { date: '2024-01-10', costUsd: 0.5, calls: 15 },
    { date: '2024-01-11', costUsd: 0.8, calls: 20 },
    { date: '2024-01-12', costUsd: 0.6, calls: 18 },
    { date: '2024-01-13', costUsd: 0.7, calls: 22 },
    { date: '2024-01-14', costUsd: 0.9, calls: 25 },
  ],
  projections: {
    projectedMonthlyCost: 9.0,
    daysUntilBudgetExceeded: null,
    recommendation: 'on_track',
  },
  alerts: [
    {
      timestamp: Date.now() - 60000,
      type: 'info',
      message: 'Usage is on track for the month',
      acknowledged: false,
    },
  ],
};

const mockWarningMetrics: LLMMetrics = {
  ...mockMetrics,
  currentPeriod: {
    ...mockMetrics.currentPeriod,
    totalCostUsd: 8.5,
    budgetRemainingUsd: 1.5,
    budgetUsedPercent: 85,
    throttleState: 'warning',
  },
  projections: {
    projectedMonthlyCost: 15.0,
    daysUntilBudgetExceeded: 5,
    recommendation: 'reduce_usage',
  },
  alerts: [
    {
      timestamp: Date.now() - 60000,
      type: 'warning',
      message: 'Budget 85% used. Consider reducing usage.',
      acknowledged: false,
    },
  ],
};

describe('CostDashboard (v13 Section 10.5.3)', () => {
  describe('BudgetMeter', () => {
    it('should render budget usage percentage', () => {
      render(
        <BudgetMeter
          usedPercent={45}
          budgetLimitUsd={10}
          budgetUsedUsd={4.5}
          throttleState="normal"
        />
      );

      expect(screen.getByText(/45%/)).toBeDefined();
    });

    it('should display budget values', () => {
      render(
        <BudgetMeter
          usedPercent={45}
          budgetLimitUsd={10}
          budgetUsedUsd={4.5}
          throttleState="normal"
        />
      );

      expect(screen.getByText(/\$4.50/)).toBeDefined();
      expect(screen.getByText(/\$10.00/)).toBeDefined();
    });

    it('should show warning state', () => {
      render(
        <BudgetMeter
          usedPercent={85}
          budgetLimitUsd={10}
          budgetUsedUsd={8.5}
          throttleState="warning"
        />
      );

      expect(screen.getByTestId('meter-warning')).toBeDefined();
    });

    it('should show critical state', () => {
      render(
        <BudgetMeter
          usedPercent={95}
          budgetLimitUsd={10}
          budgetUsedUsd={9.5}
          throttleState="reduced"
        />
      );

      expect(screen.getByTestId('meter-critical')).toBeDefined();
    });

    it('should show normal state', () => {
      render(
        <BudgetMeter
          usedPercent={45}
          budgetLimitUsd={10}
          budgetUsedUsd={4.5}
          throttleState="normal"
        />
      );

      expect(screen.getByTestId('meter-normal')).toBeDefined();
    });
  });

  describe('CostChart', () => {
    it('should render daily cost chart', () => {
      render(<CostChart dailyData={mockMetrics.byDay} />);

      expect(screen.getByTestId('cost-chart')).toBeDefined();
    });

    it('should display chart title', () => {
      render(<CostChart dailyData={mockMetrics.byDay} />);

      expect(screen.getByText(/daily costs/i)).toBeDefined();
    });

    it('should show data points', () => {
      render(<CostChart dailyData={mockMetrics.byDay} />);

      // Should render Victory chart with data
      expect(screen.getByTestId('cost-chart')).toBeDefined();
    });
  });

  describe('AgentPieChart', () => {
    it('should render cost by agent pie chart', () => {
      render(<AgentPieChart agentData={mockMetrics.byAgent} />);

      expect(screen.getByTestId('agent-pie-chart')).toBeDefined();
    });

    it('should display chart title', () => {
      render(<AgentPieChart agentData={mockMetrics.byAgent} />);

      expect(screen.getByText(/cost by agent/i)).toBeDefined();
    });

    it('should show agent names in legend', () => {
      render(<AgentPieChart agentData={mockMetrics.byAgent} />);

      expect(screen.getByText(/shopping_agent/i)).toBeDefined();
      expect(screen.getByText(/restaurant_agent/i)).toBeDefined();
    });
  });

  describe('AlertsList', () => {
    it('should render alerts', () => {
      render(<AlertsList alerts={mockMetrics.alerts} onAcknowledge={() => {}} />);

      expect(screen.getByText(/usage is on track/i)).toBeDefined();
    });

    it('should show alert type icon', () => {
      render(<AlertsList alerts={mockWarningMetrics.alerts} onAcknowledge={() => {}} />);

      expect(screen.getByTestId('alert-warning')).toBeDefined();
    });

    it('should call onAcknowledge when dismiss clicked', () => {
      const onAcknowledge = vi.fn();
      render(<AlertsList alerts={mockMetrics.alerts} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

      expect(onAcknowledge).toHaveBeenCalledWith(0);
    });

    it('should show empty state when no alerts', () => {
      render(<AlertsList alerts={[]} onAcknowledge={() => {}} />);

      expect(screen.getByText(/no alerts/i)).toBeDefined();
    });
  });

  describe('CostDashboard (main component)', () => {
    it('should render with userId prop', () => {
      render(<CostDashboard userId="user_123" metrics={mockMetrics} />);

      expect(screen.getByText(/cost dashboard/i)).toBeDefined();
    });

    it('should display budget meter', () => {
      render(<CostDashboard userId="user_123" metrics={mockMetrics} />);

      expect(screen.getByText(/45%/)).toBeDefined();
    });

    it('should display projections', () => {
      render(<CostDashboard userId="user_123" metrics={mockMetrics} />);

      // Text is split across elements, so check for parts separately
      expect(screen.getByText(/projected monthly/i)).toBeDefined();
      expect(screen.getByText('$9.00')).toBeDefined();
    });

    it('should display recommendation', () => {
      render(<CostDashboard userId="user_123" metrics={mockWarningMetrics} />);

      expect(screen.getByText(/reduce_usage/i)).toBeDefined();
    });

    it('should show days until budget exceeded warning', () => {
      render(<CostDashboard userId="user_123" metrics={mockWarningMetrics} />);

      expect(screen.getByText(/5 days/i)).toBeDefined();
    });

    it('should allow budget limit adjustment', () => {
      const onBudgetChange = vi.fn();
      render(
        <CostDashboard
          userId="user_123"
          metrics={mockMetrics}
          onBudgetChange={onBudgetChange}
        />
      );

      fireEvent.change(screen.getByLabelText(/budget limit/i), {
        target: { value: '15' },
      });

      expect(onBudgetChange).toHaveBeenCalledWith(15);
    });
  });
});
