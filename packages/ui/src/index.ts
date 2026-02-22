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
export { DocumentRenderer } from './components/DocumentRenderer';
export type { DocumentRendererProps } from './components/DocumentRenderer';

// Domain components — forms
export { FormRenderer } from './components/FormRenderer';
export type { FormRendererProps } from './components/FormRenderer';

// Hooks
export { useAgentBridge } from './hooks/useAgentBridge';
export type { UseAgentBridgeResult } from './hooks/useAgentBridge';
