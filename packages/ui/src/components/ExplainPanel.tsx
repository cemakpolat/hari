import React from 'react';
import type { ExplainabilityContext } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// ExplainPanel
//
// Renders the "Why am I seeing this?" collaborative reasoning surface.
// Features:
//   - Data sources with freshness timestamps
//   - Assumptions list
//   - Confidence range
//   - Alternatives considered + rejection reasons
//   - Interactive What-If query box with pre-seeded quick-pick chips
//
// The panel opens as a side drawer or popover — never a full-page navigation.
// What-if queries run in an isolated context (Hypothetical overlay) without
// mutating the main view state.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  context: ExplainabilityContext;
  onClose: () => void;
  onWhatIf?: (query: string) => void;
}

export function ExplainPanel({ context, onClose, onWhatIf }: Props) {
  const [whatIfInput, setWhatIfInput] = React.useState('');
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  // Saved reference to the element that was focused when the panel opened
  const triggerRef = React.useRef<Element | null>(null);

  // Focus the close button on mount; restore focus to the triggering element on unmount.
  React.useEffect(() => {
    triggerRef.current = document.activeElement;
    closeBtnRef.current?.focus();
    return () => {
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const submitWhatIf = () => {
    const q = whatIfInput.trim();
    if (q && onWhatIf) {
      onWhatIf(q);
      setWhatIfInput('');
    }
  };

  return (
    <div
      role="region"
      aria-label="Why am I seeing this?"
      style={{
        backgroundColor: '#1e1b4b',
        color: '#e0e7ff',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#818cf8',
              marginBottom: '0.25rem',
            }}
          >
            Why am I seeing this?
          </div>
          <p style={{ margin: 0, lineHeight: '1.6', color: '#c7d2fe' }}>
            {context.summary}
          </p>
        </div>
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close explain panel"
          style={{
            background: 'none',
            border: 'none',
            color: '#818cf8',
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: 1,
            flexShrink: 0,
            marginLeft: '1rem',
          }}
        >
          ×
        </button>
      </div>

      {/* Data Sources */}
      {context.dataSources.length > 0 && (
        <Section title="Data Sources">
          {context.dataSources.map((src, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.25rem',
              }}
            >
              <span>
                <SourceIcon type={src.type} /> {src.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#818cf8' }}>
                {src.freshness
                  ? new Date(src.freshness).toLocaleTimeString()
                  : src.type}
                {src.reliability != null && (
                  <> &middot; {(src.reliability * 100).toFixed(0)}% reliable</>
                )}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Assumptions */}
      {context.assumptions.length > 0 && (
        <Section title="Assumptions">
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.8' }}>
            {context.assumptions.map((a, i) => (
              <li key={i} style={{ color: '#c7d2fe' }}>
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Confidence range */}
      {context.confidenceRange && (
        <Section title="Confidence Range">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ConfidenceBar
              low={context.confidenceRange.low}
              high={context.confidenceRange.high}
            />
            <span style={{ fontSize: '0.875rem', color: '#a5b4fc' }}>
              {(context.confidenceRange.low * 100).toFixed(0)}%&nbsp;–&nbsp;
              {(context.confidenceRange.high * 100).toFixed(0)}%
            </span>
          </div>
        </Section>
      )}

      {/* Alternatives considered */}
      {context.alternativesConsidered.length > 0 && (
        <Section title="Alternatives Considered">
          {context.alternativesConsidered.map((alt, i) => (
            <div key={i} style={{ marginBottom: '0.625rem' }}>
              <div style={{ fontWeight: 600, color: '#c7d2fe' }}>{alt.description}</div>
              <div style={{ fontSize: '0.8rem', color: '#818cf8' }}>
                Not chosen: {alt.reason}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* What-If */}
      {onWhatIf && (
        <Section title="What If?">
          {/* Quick-pick chips */}
          {context.whatIfQueries.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.625rem' }}>
              {context.whatIfQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => onWhatIf(q)}
                  aria-label={`Ask: ${q}`}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #4338ca',
                    backgroundColor: '#312e81',
                    color: '#a5b4fc',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {/* Free-text input */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              aria-label="What-if question"
              value={whatIfInput}
              onChange={(e) => setWhatIfInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitWhatIf()}
              placeholder="e.g. price increases 10%?"
              style={{
                flex: 1,
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #4338ca',
                backgroundColor: '#312e81',
                color: '#e0e7ff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              onClick={submitWhatIf}
              disabled={!whatIfInput.trim()}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: '#4f46e5',
                color: 'white',
                cursor: whatIfInput.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                opacity: whatIfInput.trim() ? 1 : 0.5,
              }}
            >
              Ask
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div
        role="heading"
        aria-level={3}
        style={{
          fontWeight: 700,
          color: '#818cf8',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function SourceIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    mcp: '🔌',
    database: '🗄',
    api: '🌐',
    cache: '⚡',
    user_provided: '👤',
  };
  return <span>{icons[type] ?? '📄'}</span>;
}

function ConfidenceBar({ low, high }: { low: number; high: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '120px',
        height: '8px',
        backgroundColor: '#312e81',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${low * 100}%`,
          width: `${(high - low) * 100}%`,
          height: '100%',
          backgroundColor: '#6366f1',
          borderRadius: '4px',
        }}
      />
    </div>
  );
}
