/**
 * Agent Inspector Components - v13 Section 10.5.1
 *
 * UI components for viewing and filtering agent traces.
 */
import React, { useState, useMemo } from 'react';
import type { AgentTrace, AgentStep } from '@ownyou/observability';
import type { TraceFilterOptions } from '../../types';

// ============================================================================
// TraceList Component
// ============================================================================

export interface TraceListProps {
  traces: AgentTrace[];
  onSelect: (traceId: string) => void;
  selectedId?: string;
}

export function TraceList({ traces, onSelect, selectedId }: TraceListProps): React.ReactElement {
  if (traces.length === 0) {
    return (
      <div className="trace-list-empty" data-testid="trace-list-empty">
        <p>No traces available</p>
      </div>
    );
  }

  return (
    <div className="trace-list" data-testid="trace-list">
      {traces.map((trace) => (
        <div
          key={trace.id}
          className={`trace-item ${selectedId === trace.id ? 'selected' : ''}`}
          onClick={() => onSelect(trace.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(trace.id)}
        >
          <span
            className={`status-indicator status-${trace.status}`}
            data-testid={`status-${trace.status}`}
          />
          <span className="agent-type">{trace.agentType}</span>
          <span className="duration">
            {trace.endedAt ? `${trace.endedAt - trace.startedAt}ms` : 'running'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// StepViewer Component
// ============================================================================

export interface StepViewerProps {
  step: AgentStep;
}

export function StepViewer({ step }: StepViewerProps): React.ReactElement {
  return (
    <div className="step-viewer" data-testid="step-viewer">
      <div className="step-header">
        <span className="step-type">{step.stepType}</span>
        {step.durationMs !== undefined && (
          <span className="step-duration">{step.durationMs}ms</span>
        )}
      </div>

      {step.llm && (
        <div className="step-llm-detail">
          <div className="model">{step.llm.model}</div>
          <div className="prompt">{step.llm.promptPreview}</div>
          <div className="response">{step.llm.responsePreview}</div>
          <div className="tokens">
            Tokens: {step.llm.tokens.input} in / {step.llm.tokens.output} out
          </div>
          <div className="cost">${step.llm.costUsd.toFixed(4)}</div>
        </div>
      )}

      {step.memory && (
        <div className="step-memory-detail">
          <div className="operation">{step.memory.operation}</div>
          <div className="namespace">{step.memory.namespace}</div>
          {step.memory.query && <div className="query">{step.memory.query}</div>}
          {step.memory.resultCount !== undefined && (
            <div className="result-count">{step.memory.resultCount} results</div>
          )}
        </div>
      )}

      {step.tool && (
        <div className="step-tool-detail">
          <div className="tool-name">{step.tool.name}</div>
          <div className="tool-args">{JSON.stringify(step.tool.args)}</div>
          <div className="tool-result">{step.tool.resultPreview}</div>
          {!step.tool.success && step.tool.error && (
            <div className="tool-error">{step.tool.error}</div>
          )}
        </div>
      )}

      {step.externalApi && (
        <div className="step-api-detail">
          <div className="service">{step.externalApi.service}</div>
          <div className="endpoint">{step.externalApi.endpoint}</div>
          <div className="status">Status: {step.externalApi.statusCode}</div>
          <div className="latency">{step.externalApi.latencyMs}ms</div>
        </div>
      )}

      {step.decision && (
        <div className="step-decision-detail">
          <div className="decision-point">{step.decision.decisionPoint}</div>
          <div className="options">{step.decision.optionsConsidered.join(', ')}</div>
          <div className="selected">Selected: {step.decision.selected}</div>
          <div className="reasoning">{step.decision.reasoning}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TraceDetail Component
// ============================================================================

export interface TraceDetailProps {
  trace: AgentTrace;
}

export function TraceDetail({ trace }: TraceDetailProps): React.ReactElement {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="trace-detail" data-testid="trace-detail">
      <div className="trace-header">
        <h3>{trace.id}</h3>
        <span className="agent-type">{trace.agentType}</span>
        <span className="status">{trace.status}</span>
      </div>

      <div className="trace-meta">
        <div>Started: {new Date(trace.startedAt).toLocaleString()}</div>
        {trace.endedAt && (
          <div>Duration: {trace.endedAt - trace.startedAt}ms</div>
        )}
      </div>

      <div className="trace-resources">
        <h4>Resources</h4>
        <div>LLM Calls: {trace.resources?.llmCalls ?? 0}</div>
        <div>Memory Reads: {trace.resources?.memoryReads ?? 0}</div>
        <div>Memory Writes: {trace.resources?.memoryWrites ?? 0}</div>
        <div>Tool Calls: {trace.resources?.toolCalls ?? 0}</div>
        <div>External APIs: {trace.resources?.externalApiCalls ?? 0}</div>
        {trace.resources?.llmCostUsd && (
          <div>Total Cost: ${trace.resources.llmCostUsd.toFixed(4)}</div>
        )}
      </div>

      <div className="trace-steps">
        <h4>{trace.steps?.length ?? 0} steps</h4>
        {trace.steps?.map((step, index) => (
          <div key={index} className="step-container">
            <div
              className="step-summary"
              onClick={() => toggleStep(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggleStep(index)}
            >
              <span className="step-index">#{index + 1}</span>
              <span className="step-type">{step.stepType}</span>
              {step.durationMs && <span className="step-duration">{step.durationMs}ms</span>}
            </div>
            {expandedSteps.includes(index) && <StepViewer step={step} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TraceFilters Component
// ============================================================================

export interface TraceFiltersProps {
  filters: TraceFilterOptions;
  onChange: (filters: TraceFilterOptions) => void;
  availableAgentTypes?: string[];
}

export function TraceFilters({
  filters,
  onChange,
  availableAgentTypes = [
    'shopping_agent',
    'restaurant_agent',
    'content_agent',
    'events_agent',
    'travel_agent',
    'diagnostic_agent',
  ],
}: TraceFiltersProps): React.ReactElement {
  return (
    <div className="trace-filters" data-testid="trace-filters">
      <div className="filter-group">
        <label htmlFor="agent-type-filter">Agent Type</label>
        <select
          id="agent-type-filter"
          value={filters.agentType ?? ''}
          onChange={(e) =>
            onChange({ ...filters, agentType: e.target.value || undefined })
          }
        >
          <option value="">All Agents</option>
          {availableAgentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="status-filter">Status</label>
        <select
          id="status-filter"
          value={filters.status ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              status: (e.target.value as 'success' | 'error' | 'cancelled') || undefined,
            })
          }
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// AgentInspector Main Component
// ============================================================================

export interface AgentInspectorProps {
  userId: string;
  traces: AgentTrace[];
  className?: string;
}

export function AgentInspector({
  userId,
  traces,
  className,
}: AgentInspectorProps): React.ReactElement {
  const [filters, setFilters] = useState<TraceFilterOptions>({});
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
      if (filters.agentType && trace.agentType !== filters.agentType) {
        return false;
      }
      if (filters.status && trace.status !== filters.status) {
        return false;
      }
      if (filters.minDurationMs && trace.endedAt) {
        const duration = trace.endedAt - trace.startedAt;
        if (duration < filters.minDurationMs) {
          return false;
        }
      }
      if (filters.minCostUsd && trace.resources) {
        if (trace.resources.llmCostUsd < filters.minCostUsd) {
          return false;
        }
      }
      return true;
    });
  }, [traces, filters]);

  const selectedTrace = useMemo(() => {
    return filteredTraces.find((t) => t.id === selectedTraceId);
  }, [filteredTraces, selectedTraceId]);

  return (
    <div className={`agent-inspector ${className ?? ''}`} data-testid="agent-inspector">
      <h2>Agent Inspector</h2>
      <p className="user-id">User: {userId}</p>

      <TraceFilters filters={filters} onChange={setFilters} />

      <div className="inspector-content">
        <div className="trace-list-panel">
          <TraceList
            traces={filteredTraces}
            onSelect={setSelectedTraceId}
            selectedId={selectedTraceId}
          />
        </div>

        {selectedTrace && (
          <div className="trace-detail-panel">
            <TraceDetail trace={selectedTrace} />
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentInspector;
