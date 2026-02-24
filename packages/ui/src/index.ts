// Core UI components
export { IntentRenderer } from './components/IntentRenderer';
export { BlastRadiusBadge } from './components/BlastRadiusBadge';
export { ExplainPanel } from './components/ExplainPanel';
export { AmbiguityControls } from './components/AmbiguityControls';
export { IntentErrorBoundary } from './components/IntentErrorBoundary';
export { HypotheticalOverlay } from './components/HypotheticalOverlay';
export { DensitySelector } from './components/primitives/DensitySelector';

// Domain components — travel
export {
  FlightCardExecutive,
  FlightCardOperator,
  FlightCardExpert,
} from './components/domain/travel/FlightCard';
export type { FlightOption } from './components/domain/travel/FlightCard';

// Domain components — cloudops
export { MetricCard } from './components/domain/cloudops/MetricCard';
export type { MetricData } from './components/domain/cloudops/MetricCard';

// Domain components — iot
export { SensorCard } from './components/domain/iot/SensorCard';
export type { SensorReading } from './components/domain/iot/SensorCard';

// Domain components — documents
export { DocumentRenderer, syntaxTokenize } from './components/DocumentRenderer';
export type { DocumentRendererProps } from './components/DocumentRenderer';

// Domain components — forms
export { FormRenderer } from './components/FormRenderer';
export type { FormRendererProps } from './components/FormRenderer';

// Domain components — timeline
export { TimelineRenderer } from './components/TimelineRenderer';
export type { TimelineRendererProps } from './components/TimelineRenderer';

// Domain components — workflow
export { WorkflowRenderer } from './components/WorkflowRenderer';
export type { WorkflowRendererProps } from './components/WorkflowRenderer';

// Domain components — kanban
export { KanbanRenderer } from './components/KanbanRenderer';
export type { KanbanRendererProps } from './components/KanbanRenderer';

// Domain components — calendar
export { CalendarRenderer } from './components/CalendarRenderer';
export type { CalendarRendererProps } from './components/CalendarRenderer';

// Domain components — tree / hierarchy
export { TreeRenderer } from './components/TreeRenderer';
export type { TreeRendererProps } from './components/TreeRenderer';

// Domain components — chat / conversation
export { ChatRenderer } from './components/ChatRenderer';
export type { ChatRendererProps } from './components/ChatRenderer';

// Hooks
export { useAgentBridge } from './hooks/useAgentBridge';
export type { UseAgentBridgeResult } from './hooks/useAgentBridge';
