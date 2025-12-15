/**
 * Agent Inspector Tests - v13 Section 10.5.1
 *
 * Tests for the Agent Inspector UI component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AgentInspector, TraceList, TraceDetail, TraceFilters, StepViewer } from '../components/AgentInspector';
import type { AgentTrace, AgentStep } from '@ownyou/observability';

// Mock traces for testing
const mockTraces: AgentTrace[] = [
  {
    id: 'trace_1',
    userId: 'user_123',
    agentType: 'shopping_agent',
    missionId: 'mission_1',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    status: 'success',
    level: 'info',
    spans: [],
    events: [],
    steps: [
      {
        stepIndex: 0,
        stepType: 'llm_call',
        timestamp: Date.now() - 4000,
        durationMs: 500,
        llm: {
          model: 'gpt-4o-mini',
          promptPreview: 'Analyze shopping...',
          responsePreview: 'Based on the analysis...',
          tokens: { input: 100, output: 50 },
          costUsd: 0.001,
        },
      },
      {
        stepIndex: 1,
        stepType: 'memory_read',
        timestamp: Date.now() - 3500,
        durationMs: 10,
        memory: {
          operation: 'search',
          namespace: 'ownyou.semantic',
          query: 'shopping preferences',
          resultCount: 5,
        },
      },
    ],
    costs: [],
    toolCalls: [],
    memoryOps: [],
    resources: {
      llmCalls: 1,
      llmTokens: { input: 100, output: 50 },
      llmCostUsd: 0.001,
      toolCalls: 0,
      memoryReads: 1,
      memoryWrites: 0,
      externalApiCalls: 0,
    },
  },
  {
    id: 'trace_2',
    userId: 'user_123',
    agentType: 'restaurant_agent',
    missionId: 'mission_2',
    startTime: Date.now() - 10000,
    endTime: Date.now() - 8000,
    status: 'error',
    level: 'error',
    spans: [],
    events: [],
    steps: [],
    costs: [],
    toolCalls: [],
    memoryOps: [],
    resources: {
      llmCalls: 0,
      llmTokens: { input: 0, output: 0 },
      llmCostUsd: 0,
      toolCalls: 0,
      memoryReads: 0,
      memoryWrites: 0,
      externalApiCalls: 0,
    },
  },
];

describe('AgentInspector (v13 Section 10.5.1)', () => {
  describe('TraceList', () => {
    it('should render list of traces', () => {
      render(<TraceList traces={mockTraces} onSelect={() => {}} />);

      expect(screen.getByText(/shopping_agent/i)).toBeDefined();
      expect(screen.getByText(/restaurant_agent/i)).toBeDefined();
    });

    it('should show trace status indicators', () => {
      render(<TraceList traces={mockTraces} onSelect={() => {}} />);

      expect(screen.getByTestId('status-success')).toBeDefined();
      expect(screen.getByTestId('status-error')).toBeDefined();
    });

    it('should call onSelect when trace clicked', () => {
      const onSelect = vi.fn();
      render(<TraceList traces={mockTraces} onSelect={onSelect} />);

      fireEvent.click(screen.getByText(/shopping_agent/i));

      expect(onSelect).toHaveBeenCalledWith('trace_1');
    });

    it('should display empty state when no traces', () => {
      render(<TraceList traces={[]} onSelect={() => {}} />);

      expect(screen.getByText(/no traces/i)).toBeDefined();
    });
  });

  describe('TraceDetail', () => {
    it('should render trace metadata', () => {
      render(<TraceDetail trace={mockTraces[0]} />);

      expect(screen.getByText(/trace_1/i)).toBeDefined();
      expect(screen.getByText(/shopping_agent/i)).toBeDefined();
    });

    it('should display steps count', () => {
      render(<TraceDetail trace={mockTraces[0]} />);

      expect(screen.getByText(/2 steps/i)).toBeDefined();
    });

    it('should show resource summary', () => {
      render(<TraceDetail trace={mockTraces[0]} />);

      expect(screen.getByText(/llm calls: 1/i)).toBeDefined();
      expect(screen.getByText(/memory reads: 1/i)).toBeDefined();
    });

    it('should list all steps', () => {
      render(<TraceDetail trace={mockTraces[0]} />);

      expect(screen.getByText(/llm_call/i)).toBeDefined();
      expect(screen.getByText(/memory_read/i)).toBeDefined();
    });
  });

  describe('StepViewer', () => {
    const llmStep: AgentStep = mockTraces[0].steps[0];
    const memoryStep: AgentStep = mockTraces[0].steps[1];

    it('should render LLM step details', () => {
      render(<StepViewer step={llmStep} />);

      expect(screen.getByText(/gpt-4o-mini/i)).toBeDefined();
      expect(screen.getByText(/Analyze shopping/i)).toBeDefined();
    });

    it('should render memory step details', () => {
      render(<StepViewer step={memoryStep} />);

      expect(screen.getByText(/ownyou.semantic/i)).toBeDefined();
      expect(screen.getByText(/shopping preferences/i)).toBeDefined();
    });

    it('should show step duration', () => {
      render(<StepViewer step={llmStep} />);

      expect(screen.getByText(/500ms/i)).toBeDefined();
    });

    it('should show cost for LLM steps', () => {
      render(<StepViewer step={llmStep} />);

      expect(screen.getByText(/\$0.001/i)).toBeDefined();
    });
  });

  describe('TraceFilters', () => {
    it('should render filter controls', () => {
      render(<TraceFilters filters={{}} onChange={() => {}} />);

      expect(screen.getByLabelText(/agent type/i)).toBeDefined();
      expect(screen.getByLabelText(/status/i)).toBeDefined();
    });

    it('should call onChange when filter changed', () => {
      const onChange = vi.fn();
      render(<TraceFilters filters={{}} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText(/status/i), {
        target: { value: 'error' },
      });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
    });

    it('should show active filters', () => {
      render(
        <TraceFilters
          filters={{ agentType: 'shopping_agent', status: 'success' }}
          onChange={() => {}}
        />
      );

      expect(screen.getByDisplayValue(/shopping_agent/i)).toBeDefined();
    });
  });

  describe('AgentInspector (main component)', () => {
    it('should render with userId prop', () => {
      render(<AgentInspector userId="user_123" traces={mockTraces} />);

      expect(screen.getByText(/agent inspector/i)).toBeDefined();
    });

    it('should show trace list by default', () => {
      render(<AgentInspector userId="user_123" traces={mockTraces} />);

      // Use getAllByText since agent names appear in both filter dropdown and trace list
      expect(screen.getAllByText(/shopping_agent/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/restaurant_agent/i).length).toBeGreaterThan(0);
    });

    it('should expand trace detail on selection', () => {
      render(<AgentInspector userId="user_123" traces={mockTraces} />);

      // Click on the trace item (within the trace list, not dropdown)
      const traceList = screen.getByTestId('trace-list');
      const shoppingAgentItem = traceList.querySelector('.agent-type');
      if (shoppingAgentItem) {
        fireEvent.click(shoppingAgentItem.closest('.trace-item')!);
      }

      expect(screen.getByText(/2 steps/i)).toBeDefined();
    });

    it('should filter traces by agent type', () => {
      render(<AgentInspector userId="user_123" traces={mockTraces} />);

      fireEvent.change(screen.getByLabelText(/agent type/i), {
        target: { value: 'shopping_agent' },
      });

      // After filtering, shopping_agent still appears in dropdown + trace list
      expect(screen.getAllByText(/shopping_agent/i).length).toBeGreaterThan(0);
      // restaurant_agent should only be in dropdown, not in trace list
      const traceList = screen.getByTestId('trace-list');
      expect(traceList.textContent).not.toContain('restaurant_agent');
    });
  });
});
