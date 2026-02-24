import React from 'react';
import type { CompiledView, AgentAction } from '@hari/core';
import { useUIStore, useIntentStore } from '@hari/core';
import { BlastRadiusBadge } from './BlastRadiusBadge';
import { ExplainPanel } from './ExplainPanel';
import { AmbiguityControls } from './AmbiguityControls';

// ─────────────────────────────────────────────────────────────────────────────
// IntentRenderer
//
// The main orchestration component.  It consumes a CompiledView produced by
// compileIntent() and wires together:
//   - ambiguity controls (intent negotiation)
//   - the domain-specific component resolved by the registry
//   - explainability panels (lazy, per-element)
//   - action buttons with blast-radius badges and two-step confirmation
//   - a FallbackComponent when no registry entry exists
//
// Component resolution uses useMemo (not useEffect) so DomainComponent and
// compiledView.data are ALWAYS in sync within the same render. Using useEffect
// caused a race condition: when the intent switched, data updated synchronously
// but the component updated one render later, so the old component briefly
// received the new domain's data (e.g. FlightList receiving { metrics }).
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  compiledView: CompiledView;
  onActionExecute?: (actionId: string, payload?: Record<string, unknown>) => void;
  onAmbiguityChange?: (controlId: string, value: unknown) => void;
  onWhatIf?: (query: string) => void;
}

export function IntentRenderer({ compiledView, onActionExecute, onAmbiguityChange, onWhatIf }: Props) {
  const {
    densityOverride,
    openExplainPanels,
    pendingConfirmations,
    openExplainPanel,
    closeExplainPanel,
    requestConfirmation,
    resolveConfirmation,
    dismissConfirmation,
  } = useUIStore();

  // Suppress unused warning — modifyAmbiguity is called via AmbiguityControls internally
  useIntentStore((s) => s.currentIntent);

  const density = densityOverride ?? compiledView.density;

  // Resolve component synchronously so it is always in sync with compiledView.data.
  // Async resolvers (lazy-loaded components) return null here; callers should wrap
  // such resolvers with React.lazy + Suspense at the registry level instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DomainComponent = React.useMemo<React.ComponentType<any> | null>(() => {
    if (!compiledView.resolvedComponent) return null;
    const result = compiledView.resolvedComponent();
    if (result instanceof Promise) return null; // async: use React.lazy externally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as React.ComponentType<any>;
  }, [compiledView.resolvedComponent]);

  return (
    <div style={{ width: '100%' }}>
      {/* ── Compiler warnings (dev aid) ─────────────────────────────────── */}
      {compiledView.warnings.map((w, i) => (
        <div key={i} style={warnBannerStyle}>⚙ {w}</div>
      ))}

      {/* ── Low-confidence notice ──────────────────────────────────────── */}
      {compiledView.confidence < 0.65 && (
        <div style={infoBannerStyle}>
          ⚠ Low confidence ({(compiledView.confidence * 100).toFixed(0)}%) — use the
          controls below to clarify your intent.
        </div>
      )}

      {/* ── Ambiguity controls ─────────────────────────────────────────── */}
      {compiledView.ambiguities.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <AmbiguityControls
            controls={compiledView.ambiguities}
            onModify={onAmbiguityChange}
          />
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        {DomainComponent ? (
          <React.Suspense
            fallback={
              <div style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                Loading component…
              </div>
            }
          >
            <DomainComponent
              {...compiledView.data}
              density={density}
              explain={compiledView.explain}
              onExplain={(elementId: string) => openExplainPanel(elementId)}
            />
          </React.Suspense>
        ) : (
          <FallbackView data={compiledView.data} type={compiledView.type} domain={compiledView.domain} />
        )}
      </div>

      {/* ── Inline explain panels ──────────────────────────────────────── */}
      {openExplainPanels.map((elementId) => {
        const ctx = compiledView.explainability[elementId];
        if (!ctx) return null;
        return (
          <div key={elementId} style={{ marginBottom: '1rem' }}>
            <ExplainPanel
              context={ctx}
              onClose={() => closeExplainPanel(elementId)}
              onWhatIf={onWhatIf}
            />
          </div>
        );
      })}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {compiledView.actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
          {compiledView.actions.map((action) => (
            <ActionGroup
              key={action.id}
              action={action}
              density={density}
              pending={pendingConfirmations.find((c) => c.actionId === action.id)}
              onExecute={() => {
                if (action.safety?.requiresConfirmation) {
                  requestConfirmation(
                    action.id,
                    action.label,
                    action.safety.blastRadius?.downstreamEffects,
                  );
                } else {
                  onActionExecute?.(action.id, action.payload as Record<string, unknown>);
                }
              }}
              onConfirm={() =>
                resolveConfirmation(action.id, true, () =>
                  onActionExecute?.(action.id, action.payload as Record<string, unknown>),
                )
              }
              onDismiss={() => dismissConfirmation(action.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ActionGroup ──────────────────────────────────────────────────────────────

interface ActionGroupProps {
  action: AgentAction;
  density: string;
  pending?: { actionId: string; label: string; blastRadiusSummary?: string };
  onExecute: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

function ActionGroup({ action, density, pending, onExecute, onConfirm, onDismiss }: ActionGroupProps) {
  const [delayReady, setDelayReady] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);
  const delay = action.safety?.confirmationDelay ?? 0;

  // Focus management: save the trigger element when the confirmation dialog opens;
  // restore it when the dialog closes (WCAG 2.4.3 Focus Order).
  const confirmBtnRef = React.useRef<HTMLButtonElement>(null);
  const triggerRef = React.useRef<Element | null>(null);
  React.useEffect(() => {
    if (pending) {
      triggerRef.current = document.activeElement;
      confirmBtnRef.current?.focus();
    } else if (triggerRef.current) {
      (triggerRef.current as HTMLElement | null)?.focus?.();
      triggerRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pending]);

  React.useEffect(() => {
    if (!pending) {
      setDelayReady(false);
      setRemaining(0);
      return undefined;
    }
    if (delay <= 0) {
      setDelayReady(true);
      return undefined;
    }

    const secs = Math.ceil(delay / 1000);
    setRemaining(secs);

    const countInterval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

    const readyTimer = setTimeout(() => {
      setDelayReady(true);
      clearInterval(countInterval);
    }, delay);

    return () => {
      clearTimeout(readyTimer);
      clearInterval(countInterval);
    };
  }, [pending, delay]);

  return (
    <div>
      {/* Blast radius badge (hidden at executive density to reduce noise) */}
      {action.safety && density !== 'executive' && (
        <div style={{ marginBottom: '0.5rem' }}>
          <BlastRadiusBadge safety={action.safety} compact />
        </div>
      )}

      {pending ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={`confirm-label-${action.id}`}
          aria-describedby={pending.blastRadiusSummary ? `confirm-desc-${action.id}` : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.625rem 0.875rem',
            border: '1.5px solid #fca5a5',
            borderRadius: '0.5rem',
            backgroundColor: '#fef2f2',
            flexWrap: 'wrap',
          }}
        >
          <span id={`confirm-label-${action.id}`} style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: 600 }}>
            Confirm: {pending.label}?
          </span>
          {pending.blastRadiusSummary && (
            <span id={`confirm-desc-${action.id}`} style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
              — {pending.blastRadiusSummary}
            </span>
          )}
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={!delayReady}
            aria-label={delayReady ? `Confirm ${pending.label}` : `Wait ${remaining}s before confirming`}
            style={{
              ...actionButtonStyle('destructive'),
              opacity: delayReady ? 1 : 0.4,
              cursor: delayReady ? 'pointer' : 'not-allowed',
            }}
          >
            <span aria-live="polite" aria-atomic="true">
              {delayReady ? 'Yes, proceed' : remaining > 0 ? `${remaining}s…` : 'Wait…'}
            </span>
          </button>
          <button onClick={onDismiss} style={actionButtonStyle('secondary')}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={onExecute}
          disabled={action.disabled}
          style={{
            ...actionButtonStyle(action.variant),
            opacity: action.disabled ? 0.5 : 1,
            cursor: action.disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── FallbackView ─────────────────────────────────────────────────────────────

function FallbackView({ data, type, domain }: { data: unknown; type: string; domain: string }) {
  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '0.5rem',
        padding: '1rem',
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
        No component registered for <code>{domain}/{type}</code> — raw payload:
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: '0.75rem',
          color: '#475569',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const warnBannerStyle: React.CSSProperties = {
  backgroundColor: '#fefce8',
  border: '1px solid #fde047',
  borderRadius: '0.375rem',
  padding: '0.375rem 0.75rem',
  marginBottom: '0.5rem',
  fontSize: '0.75rem',
  color: '#854d0e',
  fontFamily: 'monospace',
};

const infoBannerStyle: React.CSSProperties = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  marginBottom: '0.75rem',
  fontSize: '0.875rem',
  color: '#9a3412',
};

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary:     { backgroundColor: '#4f46e5', color: 'white', border: 'none' },
  secondary:   { backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' },
  destructive: { backgroundColor: '#dc2626', color: 'white', border: 'none' },
  info:        { backgroundColor: '#0ea5e9', color: 'white', border: 'none' },
};

function actionButtonStyle(variant: string): React.CSSProperties {
  return {
    ...(VARIANT_STYLES[variant] ?? VARIANT_STYLES['primary']),
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };
}
