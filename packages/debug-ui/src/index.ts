/**
 * @ownyou/debug-ui - v13 Section 10.5
 *
 * Debug UI components for OwnYou.
 *
 * @example
 * ```tsx
 * import { AgentInspector, CostDashboard, SyncMonitor, DataExport } from '@ownyou/debug-ui';
 *
 * function DebugPanel() {
 *   return (
 *     <div>
 *       <AgentInspector userId="user_123" traces={traces} />
 *       <CostDashboard userId="user_123" metrics={metrics} />
 *       <SyncMonitor userId="user_123" deviceId="device_1" />
 *       <DataExport userId="user_123" />
 *     </div>
 *   );
 * }
 * ```
 */

// Agent Inspector Components
export {
  AgentInspector,
  TraceList,
  TraceDetail,
  TraceFilters,
  StepViewer,
  type AgentInspectorProps,
  type TraceListProps,
  type TraceDetailProps,
  type TraceFiltersProps,
  type StepViewerProps,
} from './components/AgentInspector';

// Cost Dashboard Components
export {
  CostDashboard,
  BudgetMeter,
  CostChart,
  AgentPieChart,
  AlertsList,
  type CostDashboardProps,
  type BudgetMeterProps,
  type CostChartProps,
  type AgentPieChartProps,
  type AlertsListProps,
} from './components/CostDashboard';

// Sync Monitor Components (Placeholder for Sprint 10)
export {
  SyncMonitor,
  ConnectionStatus,
  PendingQueue,
  ConflictResolver,
  type SyncMonitorProps,
  type ConnectionStatusProps,
  type PendingQueueProps,
  type ConflictResolverProps,
} from './components/SyncMonitor';

// Data Export Components (GDPR)
export {
  DataExport,
  ExportOptions,
  DeleteDataModal,
  type DataExportProps,
  type ExportOptionsProps,
  type DeleteDataModalProps,
} from './components/DataExport';

// Shared Types
export type {
  TraceFilterOptions,
  ExportCategory,
  ConnectionStatusType,
  Conflict,
} from './types';
