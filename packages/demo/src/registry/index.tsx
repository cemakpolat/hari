import React from 'react';
import { ComponentRegistryManager, GENERIC_DOMAIN, FALLBACK_INTENT } from '@hari/core';
import {
  FlightCardExecutive,
  FlightCardOperator,
  FlightCardExpert,
  MetricCard,
  SensorCard,
  DocumentRenderer,
  FormRenderer,
  TimelineRenderer,
  WorkflowRenderer,
  KanbanRenderer,
  CalendarRenderer,
  TreeRenderer,
  type FlightOption,
  type MetricData,
  type SensorReading,
  type TimelineRendererProps,
  type WorkflowRendererProps,
  type KanbanRendererProps,
  type CalendarRendererProps,
  type TreeRendererProps,
} from '@hari/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Application registry
//
// Maps (domain, intentType) pairs to density-aware React components.
// New domains and intent types can be added here without touching the
// compiler or rendering engine.
// ─────────────────────────────────────────────────────────────────────────────

export const registry = new ComponentRegistryManager();

// ── Travel / comparison ───────────────────────────────────────────────────────

interface FlightListProps {
  flights: FlightOption[];
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function FlightListExecutive({ flights, onExplain }: FlightListProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {flights.map((f) => (
        <FlightCardExecutive
          key={f.id}
          flight={f}
          selected={selected === f.id}
          onSelect={setSelected}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

function FlightListOperator({ flights, onExplain }: FlightListProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {flights.map((f) => (
        <FlightCardOperator
          key={f.id}
          flight={f}
          selected={selected === f.id}
          onSelect={setSelected}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

function FlightListExpert({ flights, onExplain }: FlightListProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {flights.map((f) => (
        <FlightCardExpert
          key={f.id}
          flight={f}
          selected={selected === f.id}
          onSelect={setSelected}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

// Return the named component directly — NOT a new arrow function per call.
// Returning `() => (props) => <Foo {...props} />` creates a fresh anonymous
// component reference on every resolver call, causing React to unmount+remount
// the subtree instead of reconciling it.
registry.register('travel', 'comparison', {
  executive: () => FlightListExecutive,
  operator:  () => FlightListOperator,
  expert:    () => FlightListExpert,
  default:   () => FlightListOperator,
});

// ── CloudOps / diagnostic_overview ───────────────────────────────────────────

interface MetricGridProps {
  metrics: MetricData[];
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function MetricGrid({ metrics, density, onExplain }: MetricGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {metrics.map((m) => (
        <MetricCard key={m.id} metric={m} density={density} onExplain={onExplain} />
      ))}
    </div>
  );
}

// MetricGrid reads density from props — IntentRenderer passes it from compiledView.
registry.register('cloudops', 'diagnostic_overview', {
  default: () => MetricGrid,
});

// ── IoT / sensor_overview ─────────────────────────────────────────────────────
// Demonstrates extensibility: new domain + new intent type, zero changes to
// the compiler or renderer.

interface SensorGridProps {
  sensors: SensorReading[];
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function SensorGrid({ sensors, density, onExplain }: SensorGridProps) {
  // Sort: critical first, then warning, then ok, then offline
  const STATUS_ORDER = { critical: 0, warning: 1, ok: 2, offline: 3 };
  const sorted = [...sensors].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: density === 'executive'
          ? 'repeat(auto-fill, minmax(140px, 1fr))'
          : 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {sorted.map((s) => (
        <SensorCard key={s.id} sensor={s} density={density} onExplain={onExplain} />
      ))}
    </div>
  );
}

registry.register('iot', 'sensor_overview', {
  default: () => SensorGrid,
});

// ── Async resolver demo (React.lazy + Suspense) ───────────────────────────────
//
// Registers FlightListOperator via React.lazy to demonstrate code-splitting.
// In a production app, replace Promise.resolve() with a real dynamic import
// pointing to a separately-bundled chunk:
//
//   const LazyFlightListOperator = React.lazy(
//     () => import('./components/FlightListOperator'),
//   );
//
// IntentRenderer wraps DomainComponent in <React.Suspense>, so the lazy
// component's loading fallback is shown automatically while the chunk loads.

const LazyFlightListOperator = React.lazy(() =>
  // Simulates an async chunk load — replace with a real import() in production.
  Promise.resolve({ default: FlightListOperator }),
);

registry.register('travel', 'comparison_lazy', {
  default: () => LazyFlightListOperator,
});

// ── Reports / document ────────────────────────────────────────────────────────
// Living document: AI-generated rich text with sections, callouts, metrics,
// code blocks, and per-section confidence indicators.
//
// IntentRenderer spreads compiledView.data as individual props (line 98 of
// IntentRenderer.tsx: <DomainComponent {...compiledView.data} density={...} />)
// so DocumentWrapper receives DocumentData fields as top-level props — not a
// single `data` object.  Destructure them explicitly and reconstruct for
// DocumentRenderer, exactly as FlightListXxx receives `flights` directly.

interface DocumentWrapperProps {
  // DocumentData fields spread from compiledView.data by IntentRenderer
  title?: string;
  sections?: unknown[];
  author?: string;
  publishedAt?: string;
  summary?: string;
  revision?: number;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
  showConfidence?: boolean;
  showSearch?: boolean;
  showToc?: boolean;
  showPdfExport?: boolean;
}

function DocumentWrapper({
  title, sections, author, publishedAt, summary, revision,
  density, onExplain, showConfidence = true,
  showSearch = true, showToc = true, showPdfExport = true,
}: DocumentWrapperProps) {
  const handleExportMarkdown = React.useCallback((markdown: string) => {
    console.log('[DocumentWrapper] Markdown export ready:\n', markdown);
  }, []);

  return (
    <DocumentRenderer
      data={{ title, sections, author, publishedAt, summary, revision }}
      density={density}
      onExplain={onExplain}
      showConfidence={showConfidence}
      showSearch={showSearch}
      showToc={showToc}
      showPdfExport={showPdfExport}
      onExportMarkdown={handleExportMarkdown}
    />
  );
}

registry.register('reports', 'document', {
  executive: () => DocumentWrapper,
  operator:  () => DocumentWrapper,
  expert:    () => DocumentWrapper,
  default:   () => DocumentWrapper,
});

// ── Product Analytics / document ──────────────────────────────────────────────

registry.register('product-analytics', 'document', {
  default: () => DocumentWrapper,
});

// ── Deployment / form ─────────────────────────────────────────────────────────
// Forms: agent collects structured input from the user with validation,
// conditional visibility, and sensitive data handling.

interface FormWrapperProps {
  formId?: string;
  sections?: unknown[];
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function FormWrapper({ formId = 'form', sections = [] }: FormWrapperProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = React.useCallback(async (values: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      // Simulate agent roundtrip — replace with bridge.sendAction() in production
      await new Promise<void>((resolve) => setTimeout(resolve, 1200));
      console.log('[FormWrapper] Form submitted:', values);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return (
    <FormRenderer
      formId={formId}
      sections={sections as any}
      onSubmit={handleSubmit}
      submitButtonLabel="Deploy Service"
      isSubmitting={isSubmitting}
      autoSave
    />
  );
}

registry.register('deployment', 'form', {
  default: () => FormWrapper,
});

// ── Timeline intent type ──────────────────────────────────────────────────────
// Chronological event visualization.
// IntentRenderer spreads compiledView.data as props, so TimelineWrapper
// receives TimelineData fields directly (same pattern as DocumentWrapper).

interface TimelineWrapperProps extends Omit<TimelineRendererProps, 'data'> {
  // TimelineData fields spread by IntentRenderer
  title?: unknown;
  events?: unknown;
  direction?: unknown;
  showTimestamps?: unknown;
  groupBy?: unknown;
  executiveCap?: unknown;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function TimelineWrapper({
  title, events, direction, showTimestamps, groupBy, executiveCap,
  density, onExplain,
}: TimelineWrapperProps) {
  return (
    <TimelineRenderer
      data={{ title, events, direction, showTimestamps, groupBy, executiveCap }}
      density={density}
      onExplain={onExplain}
    />
  );
}

registry.register('ops', 'timeline', {
  executive: () => TimelineWrapper,
  operator:  () => TimelineWrapper,
  expert:    () => TimelineWrapper,
  default:   () => TimelineWrapper,
});

// Also register under generic domain so any intent with type 'timeline' works
registry.register(GENERIC_DOMAIN, 'timeline', {
  default: () => TimelineWrapper,
});

// ── Workflow intent type ──────────────────────────────────────────────────────
// Multi-step guided process: onboarding, configuration wizards, approval flows.

interface WorkflowWrapperProps extends Omit<WorkflowRendererProps, 'data'> {
  title?: unknown;
  steps?: unknown;
  currentStepIndex?: unknown;
  allowSkipAhead?: unknown;
  finishLabel?: unknown;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function WorkflowWrapper({
  title, steps, currentStepIndex, allowSkipAhead, finishLabel,
  density, onExplain,
}: WorkflowWrapperProps) {
  const handleComplete = (values: Record<string, unknown>) => {
    console.log('Workflow completed:', values);
  };
  return (
    <WorkflowRenderer
      data={{ title, steps, currentStepIndex, allowSkipAhead, finishLabel }}
      density={density}
      onExplain={onExplain}
      onComplete={handleComplete}
    />
  );
}

registry.register('onboarding', 'workflow', {
  executive: () => WorkflowWrapper,
  operator:  () => WorkflowWrapper,
  expert:    () => WorkflowWrapper,
  default:   () => WorkflowWrapper,
});

registry.register(GENERIC_DOMAIN, 'workflow', {
  default: () => WorkflowWrapper,
});

// ── Kanban intent type ────────────────────────────────────────────────────────
// Task board with columns and cards.

interface KanbanWrapperProps extends Omit<KanbanRendererProps, 'data'> {
  title?: unknown;
  columns?: unknown;
  showCardCount?: unknown;
  showWipLimits?: unknown;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function KanbanWrapper({
  title, columns, showCardCount, showWipLimits,
  density, onExplain,
}: KanbanWrapperProps) {
  return (
    <KanbanRenderer
      data={{ title, columns, showCardCount, showWipLimits }}
      density={density}
      onExplain={onExplain}
    />
  );
}

registry.register('project', 'kanban', {
  executive: () => KanbanWrapper,
  operator:  () => KanbanWrapper,
  expert:    () => KanbanWrapper,
  default:   () => KanbanWrapper,
});

registry.register(GENERIC_DOMAIN, 'kanban', {
  default: () => KanbanWrapper,
});

// ── Calendar intent type ──────────────────────────────────────────────────────
// Month / week / agenda view for scheduling and planning.
// IntentRenderer spreads compiledView.data as props; CalendarWrapper
// reconstructs them into the `data` object that CalendarRenderer expects.

interface CalendarWrapperProps extends Omit<CalendarRendererProps, 'data'> {
  title?: unknown;
  events?: unknown;
  view?: unknown;
  focusDate?: unknown;
  weekStartsOn?: unknown;
  executiveCap?: unknown;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function CalendarWrapper({
  title, events, view, focusDate, weekStartsOn, executiveCap,
  density, onExplain,
}: CalendarWrapperProps) {
  return (
    <CalendarRenderer
      data={{ title, events, view, focusDate, weekStartsOn, executiveCap }}
      density={density}
      onExplain={onExplain}
    />
  );
}

registry.register('engineering', 'calendar', {
  executive: () => CalendarWrapper,
  operator:  () => CalendarWrapper,
  expert:    () => CalendarWrapper,
  default:   () => CalendarWrapper,
});

// Also register under generic domain so any intent with type 'calendar' works
registry.register(GENERIC_DOMAIN, 'calendar', {
  default: () => CalendarWrapper,
});

// ── Tree / hierarchy intent type ──────────────────────────────────────────────
// Interactive expand/collapse tree for org charts, file systems, taxonomies.

interface TreeWrapperProps extends Omit<TreeRendererProps, 'data'> {
  title?: unknown;
  nodes?: unknown;
  showLines?: unknown;
  searchable?: unknown;
  defaultExpandAll?: unknown;
  executiveDepth?: unknown;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
}

function TreeWrapper({
  title, nodes, showLines, searchable, defaultExpandAll, executiveDepth,
  density, onExplain,
}: TreeWrapperProps) {
  return (
    <TreeRenderer
      data={{ title, nodes, showLines, searchable, defaultExpandAll, executiveDepth }}
      density={density}
      onExplain={onExplain}
    />
  );
}

registry.register('hr', 'tree', {
  executive: () => TreeWrapper,
  operator:  () => TreeWrapper,
  expert:    () => TreeWrapper,
  default:   () => TreeWrapper,
});

// Also register under generic domain so any intent with type 'tree' works
registry.register(GENERIC_DOMAIN, 'tree', {
  default: () => TreeWrapper,
});

// ── Generic fallback (already handled by IntentRenderer, but here for doc purposes) ──

registry.register(GENERIC_DOMAIN, FALLBACK_INTENT, {
  default: () => () => null,
});
