/**
 * Cost Dashboard Components - v13 Section 10.5.3
 *
 * UI components for LLM cost monitoring and budget management.
 */
import React, { useState } from 'react';
import { VictoryChart, VictoryLine, VictoryPie, VictoryAxis, VictoryTheme } from 'victory';
import type { LLMMetrics, Alert, ThrottleState } from '@ownyou/observability';

// ============================================================================
// BudgetMeter Component
// ============================================================================

export interface BudgetMeterProps {
  usedPercent: number;
  budgetLimitUsd: number;
  budgetUsedUsd: number;
  throttleState: ThrottleState;
}

export function BudgetMeter({
  usedPercent,
  budgetLimitUsd,
  budgetUsedUsd,
  throttleState,
}: BudgetMeterProps): React.ReactElement {
  const getMeterState = (): 'normal' | 'warning' | 'critical' => {
    if (throttleState === 'reduced' || throttleState === 'deferred' || throttleState === 'local_only') {
      return 'critical';
    }
    if (throttleState === 'warning' || usedPercent >= 80) {
      return 'warning';
    }
    return 'normal';
  };

  const meterState = getMeterState();

  return (
    <div className="budget-meter" data-testid={`meter-${meterState}`}>
      <div className="meter-header">
        <h3>Budget Usage</h3>
        <span className={`throttle-state state-${throttleState}`}>{throttleState}</span>
      </div>

      <div className="meter-display">
        <div className="meter-value">{usedPercent}%</div>
        <div className="meter-bar">
          <div
            className={`meter-fill ${meterState}`}
            style={{ width: `${Math.min(usedPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="meter-amounts">
        <span className="used">${budgetUsedUsd.toFixed(2)}</span>
        <span className="separator">/</span>
        <span className="limit">${budgetLimitUsd.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// CostChart Component
// ============================================================================

export interface DailyData {
  date: string;
  costUsd: number;
  calls: number;
}

export interface CostChartProps {
  dailyData: DailyData[];
}

export function CostChart({ dailyData }: CostChartProps): React.ReactElement {
  const chartData = dailyData.map((d, index) => ({
    x: index + 1,
    y: d.costUsd,
    label: d.date,
  }));

  return (
    <div className="cost-chart" data-testid="cost-chart">
      <h3>Daily Costs</h3>
      <VictoryChart
        theme={VictoryTheme.clean}
        width={400}
        height={200}
        domainPadding={{ x: 20, y: 10 }}
      >
        <VictoryAxis
          tickFormat={(t) => dailyData[t - 1]?.date.slice(-5) ?? ''}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(t) => `$${t.toFixed(2)}`}
        />
        <VictoryLine
          data={chartData}
          style={{
            data: { stroke: '#4f46e5', strokeWidth: 2 },
          }}
        />
      </VictoryChart>
    </div>
  );
}

// ============================================================================
// AgentPieChart Component
// ============================================================================

export interface AgentData {
  [agentType: string]: {
    tokens: number;
    costUsd: number;
    calls: number;
    avgLatencyMs: number;
  };
}

export interface AgentPieChartProps {
  agentData: AgentData;
}

export function AgentPieChart({ agentData }: AgentPieChartProps): React.ReactElement {
  const pieData = Object.entries(agentData).map(([agent, data]) => ({
    x: agent,
    y: data.costUsd,
  }));

  const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="agent-pie-chart" data-testid="agent-pie-chart">
      <h3>Cost by Agent</h3>
      <VictoryPie
        data={pieData}
        theme={VictoryTheme.clean}
        width={300}
        height={200}
        colorScale={colors}
        labelRadius={60}
        labels={({ datum }) => `${datum.x.replace('_agent', '')}`}
        style={{
          labels: { fontSize: 10, fill: '#374151' },
        }}
      />
      <div className="legend">
        {Object.entries(agentData).map(([agent, data], index) => (
          <div key={agent} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="legend-label">{agent}</span>
            <span className="legend-value">${data.costUsd.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// AlertsList Component
// ============================================================================

export interface AlertsListProps {
  alerts: Alert[];
  onAcknowledge: (index: number) => void;
}

export function AlertsList({ alerts, onAcknowledge }: AlertsListProps): React.ReactElement {
  if (alerts.length === 0) {
    return (
      <div className="alerts-list empty" data-testid="alerts-empty">
        <p>No alerts</p>
      </div>
    );
  }

  return (
    <div className="alerts-list" data-testid="alerts-list">
      <h3>Alerts</h3>
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`alert-item alert-${alert.type}`}
          data-testid={`alert-${alert.type}`}
        >
          <span className="alert-icon">{getAlertIcon(alert.type)}</span>
          <span className="alert-message">{alert.message}</span>
          <span className="alert-time">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </span>
          {!alert.acknowledged && (
            <button
              className="alert-dismiss"
              onClick={() => onAcknowledge(index)}
              aria-label="Dismiss alert"
            >
              Dismiss
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function getAlertIcon(type: Alert['type']): string {
  switch (type) {
    case 'info':
      return 'ℹ️';
    case 'warning':
      return '⚠️';
    case 'throttled':
      return '🚫';
    case 'budget_exceeded':
      return '💸';
    default:
      return '•';
  }
}

// ============================================================================
// CostDashboard Main Component
// ============================================================================

export interface CostDashboardProps {
  userId: string;
  metrics: LLMMetrics;
  className?: string;
  onBudgetChange?: (newBudget: number) => void;
  onAlertAcknowledge?: (index: number) => void;
}

export function CostDashboard({
  userId,
  metrics,
  className,
  onBudgetChange,
  onAlertAcknowledge,
}: CostDashboardProps): React.ReactElement {
  const [localAlerts, setLocalAlerts] = useState(metrics.alerts);

  const handleAcknowledge = (index: number) => {
    const newAlerts = [...localAlerts];
    newAlerts[index] = { ...newAlerts[index], acknowledged: true };
    setLocalAlerts(newAlerts);
    onAlertAcknowledge?.(index);
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      onBudgetChange?.(value);
    }
  };

  return (
    <div className={`cost-dashboard ${className ?? ''}`} data-testid="cost-dashboard">
      <h2>Cost Dashboard</h2>
      <p className="user-id">User: {userId}</p>

      <div className="dashboard-grid">
        <div className="budget-section">
          <BudgetMeter
            usedPercent={metrics.currentPeriod.budgetUsedPercent}
            budgetLimitUsd={metrics.currentPeriod.budgetLimitUsd}
            budgetUsedUsd={metrics.currentPeriod.totalCostUsd}
            throttleState={metrics.currentPeriod.throttleState}
          />

          <div className="budget-control">
            <label htmlFor="budget-limit">Budget Limit ($)</label>
            <input
              id="budget-limit"
              type="number"
              min="1"
              step="1"
              defaultValue={metrics.currentPeriod.budgetLimitUsd}
              onChange={handleBudgetChange}
            />
          </div>
        </div>

        <div className="projections-section">
          <h3>Projections</h3>
          <div className="projection-item">
            <span>Projected Monthly:</span>
            <span className="value">
              ${metrics.projections.projectedMonthlyCost.toFixed(2)}
            </span>
          </div>
          {metrics.projections.daysUntilBudgetExceeded !== null && (
            <div className="projection-item warning">
              <span>Budget Exceeded In:</span>
              <span className="value">
                {metrics.projections.daysUntilBudgetExceeded} days
              </span>
            </div>
          )}
          <div className="projection-item">
            <span>Recommendation:</span>
            <span className={`value recommendation-${metrics.projections.recommendation}`}>
              {metrics.projections.recommendation}
            </span>
          </div>
        </div>

        <div className="charts-section">
          <CostChart dailyData={metrics.byDay} />
          <AgentPieChart agentData={metrics.byAgent} />
        </div>

        <div className="alerts-section">
          <AlertsList alerts={localAlerts} onAcknowledge={handleAcknowledge} />
        </div>
      </div>
    </div>
  );
}

export default CostDashboard;
