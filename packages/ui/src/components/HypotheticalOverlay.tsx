import React from 'react';
import type { AgentBridge, WhatIfResult as BridgeWhatIfResult } from '@hari/core';
import type { IntentPayload } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// HypotheticalOverlay
//
// Renders a "Hypothetical" side panel when the user submits a what-if query.
// The panel:
//   - Slides in from the right without replacing the main view
//   - Is clearly labelled HYPOTHETICAL to avoid confusion with real data
//   - Shows simulated agent response (in production: real agent call)
//   - Can be dismissed without affecting main view state
//
// Architecture note: the overlay runs in complete isolation from the main
// Intent Store — it has its own local state and does NOT mutate the committed
// intent.  This matches the HARI spec: "run in this isolated container without
// mutating the main dashboard state."
// ─────────────────────────────────────────────────────────────────────────────

interface HypotheticalResult {
  summary: string;
  deltas: Array<{ field: string; was: string; becomes: string; impact: 'positive' | 'negative' | 'neutral' }>;
  caveats: string[];
  confidence?: number;
}

interface Props {
  query: string;
  onDismiss: () => void;
  /**
   * If provided, the overlay calls bridge.queryWhatIf() for a live agent response.
   * Falls back to the built-in simulation when omitted.
   */
  bridge?: AgentBridge;
  /** Required when bridge is provided — the intent at the time of the query */
  intentSnapshot?: IntentPayload;
  /** Override the simulation entirely with a custom async function */
  onSimulate?: (query: string) => Promise<HypotheticalResult>;
}

// Simulate agent reasoning for demo purposes
async function defaultSimulate(query: string): Promise<HypotheticalResult> {
  await new Promise((r) => setTimeout(r, 800)); // simulate network latency

  const q = query.toLowerCase();
  if (q.includes('price') && q.includes('10%')) {
    return {
      summary: 'If prices increase by 10%, the cheapest option shifts from BA177 to AA101 via Iceland.',
      deltas: [
        { field: 'BA177 price',  was: '$548', becomes: '$603', impact: 'negative' },
        { field: 'VS003 price',  was: '$612', becomes: '$673', impact: 'negative' },
        { field: 'AA101 price',  was: '$489', becomes: '$538', impact: 'negative' },
        { field: 'Cheapest option', was: 'BA177', becomes: 'AA101', impact: 'neutral' },
      ],
      caveats: [
        'AA101 has a 1-stop layover adding ~2 h journey time',
        'Higher carbon footprint (401 vs 312 kg CO₂)',
        'Price increase assumed uniform across all carriers',
      ],
    };
  }

  if (q.includes('green') || q.includes('carbon')) {
    return {
      summary: 'Optimising for lowest carbon selects VS003, saving 103 kg CO₂ vs AA101.',
      deltas: [
        { field: 'Selected flight', was: 'BA177 (price-optimal)', becomes: 'VS003 (carbon-optimal)', impact: 'positive' },
        { field: 'CO₂ per passenger', was: '312 kg', becomes: '298 kg', impact: 'positive' },
        { field: 'Price delta', was: '$0', becomes: '+$64', impact: 'negative' },
      ],
      caveats: [
        'ICAO emission factors used; actual emissions vary by load factor',
        'VS003 premium is ~12% more than BA177',
      ],
    };
  }

  if (q.includes('later') || q.includes('day')) {
    return {
      summary: 'Flying 2 days later adds one premium option (BA179) and reduces AA101 price by $41.',
      deltas: [
        { field: 'New option',   was: '—',    becomes: 'BA179 $521', impact: 'positive' },
        { field: 'AA101 price',  was: '$489', becomes: '$448',       impact: 'positive' },
        { field: 'Availability', was: 'High', becomes: 'Medium',     impact: 'negative' },
      ],
      caveats: ['Date shift assumes same flexibility constraints', 'Hotel pricing not re-checked'],
    };
  }

  if (q.includes('restart') || q.includes('scal') || q.includes('10 min')) {
    return {
      summary: 'If no action is taken for 10 minutes, replication lag is projected to reach ~18 s based on current growth rate.',
      deltas: [
        { field: 'Replication lag', was: '4.2 s', becomes: '~18 s (projected)', impact: 'negative' },
        { field: 'Read query SLA', was: 'Met', becomes: 'Breached (>5 s threshold)', impact: 'negative' },
        { field: 'Active connections', was: '287', becomes: '~340 (estimated)', impact: 'negative' },
      ],
      caveats: [
        'Projection assumes linear lag growth at current rate',
        'A spontaneous query completion could reverse lag without action',
      ],
    };
  }

  return {
    summary: `Simulated analysis for: "${query}". In production, the agent would query live data and respond here.`,
    deltas: [],
    caveats: ['This is a simulated response. Connect a real agent to see live what-if analysis.'],
  };
}

function bridgeResultToLocal(r: BridgeWhatIfResult): HypotheticalResult {
  return {
    summary: r.reasoning,
    deltas: r.deltas.map((d) => ({
      field: d.field,
      was: String(d.was),
      becomes: String(d.becomes),
      impact: d.impact,
    })),
    caveats: r.caveats,
    confidence: r.confidence,
  };
}

export function HypotheticalOverlay({ query, onDismiss, bridge, intentSnapshot, onSimulate }: Props) {
  const [result, setResult] = React.useState<HypotheticalResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const dismissRef = React.useRef<HTMLButtonElement>(null);
  // Saved reference to the element that was focused when the overlay opened
  const triggerRef = React.useRef<Element | null>(null);

  // Move focus to the dismiss button when the overlay mounts (WCAG 2.4.3 Focus Order).
  // On unmount, return focus to whichever element triggered the overlay.
  React.useEffect(() => {
    triggerRef.current = document.activeElement;
    dismissRef.current?.focus();
    return () => {
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  React.useEffect(() => {
    setLoading(true);
    setResult(null);

    let cancelled = false;

    const run = async () => {
      let r: HypotheticalResult;
      if (bridge && intentSnapshot) {
        const raw = await bridge.queryWhatIf({ question: query, intentSnapshot });
        r = bridgeResultToLocal(raw);
      } else if (onSimulate) {
        r = await onSimulate(query);
      } else {
        r = await defaultSimulate(query);
      }
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    };

    run().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, bridge, intentSnapshot, onSimulate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hypothetical analysis"
      aria-live="polite"
      style={{
        backgroundColor: '#f5f3ff',
        border: '1.5px solid #a78bfa',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: '#7c3aed',
              color: 'white',
              padding: '0.1rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            ⎇ Hypothetical
          </div>
          <div style={{ fontSize: '0.875rem', color: '#4c1d95', fontWeight: 600 }}>
            "{query}"
          </div>
        </div>
        <button
          ref={dismissRef}
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#7c3aed',
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: 1,
          }}
          aria-label="Dismiss hypothetical"
        >
          ×
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: '#7c3aed', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Spinner />
          Agent is reasoning…
        </div>
      ) : result ? (
        <>
          {/* Summary + confidence */}
          <div style={{ marginBottom: '0.875rem' }}>
            <p style={{ margin: '0 0 0.375rem', color: '#4c1d95', lineHeight: '1.6', fontSize: '0.875rem' }}>
              {result.summary}
            </p>
            {result.confidence !== undefined && (
              <span style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600 }}>
                Agent confidence: {(result.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Deltas table */}
          {result.deltas.length > 0 && (
            <div style={{ marginBottom: '0.875rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                Changes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {result.deltas.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.375rem 0.625rem',
                      backgroundColor: 'white',
                      borderRadius: '0.375rem',
                      border: '1px solid #ddd6fe',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: '#4c1d95', fontWeight: 600 }}>{d.field}</span>
                    <span style={{ color: '#6b7280', textDecoration: 'line-through' }}>{d.was}</span>
                    <span style={{ color: IMPACT_COLOR[d.impact], fontWeight: 700 }}>
                      {IMPACT_ICON[d.impact]} {d.becomes}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caveats */}
          {result.caveats.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
                Caveats
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.125rem', color: '#6d28d9', fontSize: '0.8rem', lineHeight: '1.7' }}>
                {result.caveats.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </>
      ) : null}

      {/* Isolation notice */}
      <div
        style={{
          marginTop: '0.875rem',
          paddingTop: '0.625rem',
          borderTop: '1px dashed #c4b5fd',
          fontSize: '0.7rem',
          color: '#7c3aed',
          fontStyle: 'italic',
        }}
      >
        This analysis runs in isolation — it does not modify your current view or committed intent.
      </div>
    </div>
  );
}

const IMPACT_COLOR = { positive: '#15803d', negative: '#dc2626', neutral: '#64748b' };
const IMPACT_ICON  = { positive: '↑', negative: '↓', neutral: '→' };

function Spinner() {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [dot, setDot] = React.useState(0);
  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const t = setInterval(() => setDot((d) => (d + 1) % 4), 300);
    return () => clearInterval(t);
  }, [prefersReducedMotion]);

  return (
    <span aria-hidden="true" style={{ fontFamily: 'monospace' }}>
      {prefersReducedMotion ? '…' : '⠋⠙⠹⠸'[dot]}
    </span>
  );
}
