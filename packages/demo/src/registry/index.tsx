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
  type FlightOption,
  type MetricData,
  type SensorReading,
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
}

function DocumentWrapper({
  title, sections, author, publishedAt, summary, revision,
  density, onExplain, showConfidence = true,
}: DocumentWrapperProps) {
  return (
    <DocumentRenderer
      data={{ title, sections, author, publishedAt, summary, revision }}
      density={density}
      onExplain={onExplain}
      showConfidence={showConfidence}
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

function FormWrapper({ formId = 'form', sections = [], density, onExplain }: FormWrapperProps) {
  const handleSubmit = (values: Record<string, unknown>) => {
    console.log('Form submitted:', values);
    // In production, this would send to the agent via the bridge
  };

  return (
    <FormRenderer
      formId={formId}
      sections={sections as any}
      onSubmit={handleSubmit}
      submitButtonLabel="Deploy Service"
    />
  );
}

registry.register('deployment', 'form', {
  default: () => FormWrapper,
});

// ── Generic fallback (already handled by IntentRenderer, but here for doc purposes) ──

registry.register(GENERIC_DOMAIN, FALLBACK_INTENT, {
  default: () => () => null,
});
