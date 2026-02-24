import React, { useState, useCallback, useMemo } from 'react';
import {
  IntentPayloadSchema,
  compileIntent,
  type IntentPayloadInput,
} from '@hari/core';
import { IntentRenderer, IntentErrorBoundary } from '@hari/ui';
import { registry } from '../registry';
import { v4 as uuid } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// IntentPayloadBuilder  —  FUTURE_TASKS §Developer Experience
//
// A structured form-based UI for constructing valid intent payloads without
// writing raw JSON. Complements the PayloadPlayground (raw JSON editor).
//
// Features:
//  - Field-by-field builder for all required IntentPayload properties
//  - Inline field-level validation with Zod error messages
//  - Live preview of the rendered intent (same as Playground)
//  - JSON export of the built payload
//  - New UUID generation with one click
//  - Domain and type suggestions based on registered components
// ─────────────────────────────────────────────────────────────────────────────

// ── Known options ─────────────────────────────────────────────────────────────

const KNOWN_DOMAINS = [
  'travel', 'cloudops', 'iot', 'reports', 'deployment',
  'product-analytics', 'engineering', 'hr', 'support', 'project',
];

const KNOWN_TYPES = [
  'comparison', 'diagnostic_overview', 'sensor_overview', 'document',
  'form', 'timeline', 'workflow', 'kanban', 'calendar', 'tree', 'chat',
];

const DENSITY_OPTIONS = ['executive', 'operator', 'expert'] as const;
type DensityOption = typeof DENSITY_OPTIONS[number];

// ── Default skeleton payload ──────────────────────────────────────────────────

function freshPayload(): BuilderState {
  return {
    intentId: uuid(),
    version: '1.0.0',
    type: 'document',
    domain: 'reports',
    primaryGoal: 'Describe the purpose of this intent',
    confidence: 0.9,
    density: 'operator',
    dataJson: JSON.stringify(
      {
        title: 'My Document',
        sections: [
          {
            id: 's1',
            title: 'Introduction',
            confidence: 0.9,
            collapsible: false,
            defaultCollapsed: false,
            blocks: [
              { type: 'paragraph', content: 'Edit the data field to match your intent type.' },
            ],
          },
        ],
      },
      null,
      2,
    ),
  };
}

// ── Builder state ─────────────────────────────────────────────────────────────

interface BuilderState {
  intentId: string;
  version: string;
  type: string;
  domain: string;
  primaryGoal: string;
  confidence: number;
  density: DensityOption;
  /** data field as raw JSON string */
  dataJson: string;
}

interface FieldError {
  [key: string]: string | undefined;
}

// ── Validation ────────────────────────────────────────────────────────────────

function buildPayload(state: BuilderState): { ok: true; payload: IntentPayloadInput } | { ok: false; errors: FieldError; zodErrors: string[] } {
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(state.dataJson);
  } catch (e) {
    return {
      ok: false,
      errors: { dataJson: `Invalid JSON: ${(e as Error).message}` },
      zodErrors: [],
    };
  }

  const raw: IntentPayloadInput = {
    version: state.version,
    intentId: state.intentId,
    type: state.type,
    domain: state.domain,
    primaryGoal: state.primaryGoal,
    confidence: state.confidence,
    density: state.density,
    data: parsedData as Record<string, unknown>,
    ambiguities: [],
    priorityFields: [],
    actions: [],
    explain: false,
  };

  const result = IntentPayloadSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, payload: result.data as IntentPayloadInput };
  }

  const fieldErrors: FieldError = {};
  const zodErrors: string[] = [];
  result.error.issues.forEach((iss) => {
    const path = iss.path.join('.');
    if (path) fieldErrors[path] = iss.message;
    zodErrors.push(`${path || 'root'}: ${iss.message}`);
  });

  return { ok: false, errors: fieldErrors, zodErrors };
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.625rem',
  borderRadius: '0.375rem',
  border: '1px solid #e2e8f0',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  backgroundColor: 'white',
  boxSizing: 'border-box',
};

const errorInputStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: '#fca5a5',
  backgroundColor: '#fef2f2',
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: '0.68rem', color: '#dc2626', marginTop: '0.2rem' }}>{msg}</div>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IntentPayloadBuilder() {
  const [state, setState] = useState<BuilderState>(freshPayload);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [zodErrors, setZodErrors] = useState<string[]>([]);
  const [exportVisible, setExportVisible] = useState(false);

  // Generate default data structure based on intent type
  const getDefaultDataForType = useCallback((type: string): string => {
    switch (type) {
      case 'form':
        return JSON.stringify(
          {
            formId: 'my-form',
            sections: [
              {
                id: 'basic',
                title: 'Basic Information',
                fields: [
                  {
                    id: 'name',
                    type: 'text',
                    label: 'Full Name',
                    required: true,
                    placeholder: 'Enter your name',
                  },
                ],
              },
            ],
          },
          null,
          2,
        );
      case 'chat':
        return JSON.stringify(
          {
            title: 'Conversation',
            messages: [
              {
                id: 'msg1',
                role: 'assistant',
                content: 'How can I help you today?',
                timestamp: new Date().toISOString(),
              },
            ],
          },
          null,
          2,
        );
      case 'timeline':
        return JSON.stringify(
          {
            title: 'Event Timeline',
            events: [
              {
                id: 'e1',
                timestamp: new Date().toISOString(),
                title: 'Event Title',
                description: 'Event description',
                status: 'completed',
              },
            ],
          },
          null,
          2,
        );
      case 'workflow':
        return JSON.stringify(
          {
            title: 'Workflow',
            steps: [
              {
                id: 'step1',
                title: 'Step 1',
                type: 'info',
                content: 'Initial step',
              },
            ],
            currentStepIndex: 0,
          },
          null,
          2,
        );
      case 'kanban':
        return JSON.stringify(
          {
            title: 'Board',
            columns: [
              {
                id: 'col1',
                title: 'To Do',
                cards: [],
              },
            ],
          },
          null,
          2,
        );
      case 'calendar':
        return JSON.stringify(
          {
            title: 'Calendar',
            events: [],
          },
          null,
          2,
        );
      case 'tree':
        return JSON.stringify(
          {
            title: 'Hierarchy',
            root: {
              id: 'root',
              label: 'Root',
              children: [],
            },
          },
          null,
          2,
        );
      case 'document':
      default:
        return JSON.stringify(
          {
            title: 'My Document',
            sections: [
              {
                id: 's1',
                title: 'Introduction',
                confidence: 0.9,
                collapsible: false,
                defaultCollapsed: false,
                blocks: [
                  { type: 'paragraph', content: 'Edit the data field to match your intent type.' },
                ],
              },
            ],
          },
          null,
          2,
        );
    }
  }, []);

  const set = useCallback(
    <K extends keyof BuilderState>(key: K) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const raw = e.target.value;
        setState((prev) => {
          const updates: Partial<BuilderState> = {
            [key]: key === 'confidence' ? Math.min(1, Math.max(0, parseFloat(raw) || 0)) : raw,
          };
          // When type changes, auto-update data to match the new type
          if (key === 'type') {
            updates.dataJson = getDefaultDataForType(raw);
          }
          return { ...prev, ...updates };
        });
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      },
    [getDefaultDataForType],
  );

  const buildResult = useMemo(() => buildPayload(state), [state]);

  const compiledView = useMemo(() => {
    if (!buildResult.ok) return null;
    try {
      return compileIntent(IntentPayloadSchema.parse(buildResult.payload), registry, {});
    } catch {
      return null;
    }
  }, [buildResult]);

  // Live-validate and update field errors
  React.useEffect(() => {
    if (!buildResult.ok) {
      setFieldErrors(buildResult.errors);
      setZodErrors(buildResult.zodErrors);
    } else {
      setFieldErrors({});
      setZodErrors([]);
    }
  }, [buildResult]);

  const handleReset = () => {
    setState(freshPayload());
    setFieldErrors({});
    setZodErrors([]);
    setExportVisible(false);
  };

  const exportJson = useMemo(() => {
    if (!buildResult.ok) return null;
    return JSON.stringify(buildResult.payload, null, 2);
  }, [buildResult]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '1.5rem 2rem' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
              Intent Payload Builder
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Build a valid intent payload field-by-field with live schema validation and preview.
              Use the{' '}
              <em>Payload Playground</em> tab for raw JSON editing.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleReset}
              style={{ padding: '0.4rem 0.875rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.78rem', color: '#475569' }}
            >
              Reset
            </button>
            <button
              onClick={() => setExportVisible((v) => !v)}
              disabled={!buildResult.ok}
              style={{
                padding: '0.4rem 0.875rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: buildResult.ok ? '#4f46e5' : '#c7d2fe',
                color: 'white',
                cursor: buildResult.ok ? 'pointer' : 'not-allowed',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {exportVisible ? 'Hide JSON' : 'Export JSON'}
            </button>
          </div>
        </div>

        {/* Export panel */}
        {exportVisible && exportJson && (
          <div style={{ marginTop: '1rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', padding: '1rem' }}>
            <pre style={{ margin: 0, fontSize: '0.72rem', color: '#e2e8f0', overflow: 'auto', maxHeight: '250px', whiteSpace: 'pre-wrap' }}>
              {exportJson}
            </pre>
          </div>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left: builder form ─────────────────────────────────────────── */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Section: Identity */}
          <SectionHeader title="Identity" />

          {/* intentId */}
          <div>
            <FieldLabel label="Intent ID" required />
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <input
                value={state.intentId}
                onChange={set('intentId')}
                style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
                placeholder="UUID"
                spellCheck={false}
              />
              <button
                onClick={() => setState((prev) => ({ ...prev, intentId: uuid() }))}
                title="Generate new UUID"
                style={{ padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
              >
                ↺ New
              </button>
            </div>
            <FieldError msg={fieldErrors['intentId']} />
          </div>

          {/* version */}
          <div>
            <FieldLabel label="Schema Version" required />
            <input
              value={state.version}
              onChange={set('version')}
              style={fieldErrors['version'] ? errorInputStyle : inputStyle}
              placeholder="1.0.0"
            />
            <FieldError msg={fieldErrors['version']} />
          </div>

          {/* Section: Classification */}
          <SectionHeader title="Classification" />

          {/* type */}
          <div>
            <FieldLabel label="Intent Type" required />
            <input
              list="intent-type-list"
              value={state.type}
              onChange={set('type')}
              style={fieldErrors['type'] ? errorInputStyle : inputStyle}
              placeholder="e.g. document, form, comparison"
            />
            <datalist id="intent-type-list">
              {KNOWN_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
            <FieldError msg={fieldErrors['type']} />
          </div>

          {/* domain */}
          <div>
            <FieldLabel label="Domain" required />
            <input
              list="domain-list"
              value={state.domain}
              onChange={set('domain')}
              style={fieldErrors['domain'] ? errorInputStyle : inputStyle}
              placeholder="e.g. travel, cloudops, reports"
            />
            <datalist id="domain-list">
              {KNOWN_DOMAINS.map((d) => <option key={d} value={d} />)}
            </datalist>
            <FieldError msg={fieldErrors['domain']} />
          </div>

          {/* Section: Metadata */}
          <SectionHeader title="Metadata" />

          {/* primaryGoal */}
          <div>
            <FieldLabel label="Primary Goal" required />
            <input
              value={state.primaryGoal}
              onChange={set('primaryGoal')}
              style={fieldErrors['primaryGoal'] ? errorInputStyle : inputStyle}
              placeholder="Describe what the user is trying to accomplish"
            />
            <FieldError msg={fieldErrors['primaryGoal']} />
          </div>

          {/* confidence */}
          <div>
            <FieldLabel label={`Confidence — ${(state.confidence * 100).toFixed(0)}%`} required />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.confidence}
              onChange={set('confidence')}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>
              <span>0% (no confidence)</span>
              <span>100% (certain)</span>
            </div>
            <FieldError msg={fieldErrors['confidence']} />
          </div>

          {/* density */}
          <div>
            <FieldLabel label="Density" required />
            <select
              value={state.density}
              onChange={set('density')}
              style={inputStyle}
            >
              {DENSITY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Section: Data */}
          <SectionHeader title="Data Payload (JSON)" />

          <div>
            <FieldLabel label="data" required />
            <textarea
              value={state.dataJson}
              onChange={set('dataJson')}
              rows={12}
              style={{
                ...(fieldErrors['dataJson'] ? errorInputStyle : inputStyle),
                fontFamily: 'monospace',
                resize: 'vertical',
                whiteSpace: 'pre',
              }}
              spellCheck={false}
            />
            <FieldError msg={fieldErrors['dataJson']} />
          </div>

          {/* Validation status */}
          <div
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: '0.375rem',
              backgroundColor: buildResult.ok ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${buildResult.ok ? '#86efac' : '#fca5a5'}`,
              fontSize: '0.75rem',
              color: buildResult.ok ? '#15803d' : '#dc2626',
            }}
          >
            {buildResult.ok ? (
              <span>✓ Valid payload — preview rendered on the right</span>
            ) : (
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                  ✕ {zodErrors.length} validation error{zodErrors.length !== 1 ? 's' : ''}
                </div>
                <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                  {zodErrors.slice(0, 5).map((e, i) => (
                    <li key={i} style={{ lineHeight: '1.6' }}>{e}</li>
                  ))}
                  {zodErrors.length > 5 && <li>…and {zodErrors.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: live preview ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Header */}
          {compiledView && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {compiledView.domain} / {compiledView.type}
              </div>
              <h2 style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                {compiledView.primaryGoal}
              </h2>
            </div>
          )}

          {/* Rendered output */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0', minHeight: '300px' }}>
            {compiledView ? (
              <IntentErrorBoundary
                fallbackData={compiledView.data}
                domain={compiledView.domain}
                intentType={compiledView.type}
              >
                <IntentRenderer compiledView={compiledView} />
              </IntentErrorBoundary>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem 1rem', fontSize: '0.875rem' }}>
                Fix validation errors to see the preview
              </div>
            )}
          </div>

          {/* Schema reference */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Builder Tips
            </div>
            <ul style={{ margin: 0, padding: '0.75rem 1rem 0.75rem 1.75rem', fontSize: '0.75rem', color: '#475569', lineHeight: '1.8' }}>
              <li>Set <strong>type</strong> to one of the known types above for a registered renderer</li>
              <li>The <strong>data</strong> field schema depends on the intent type</li>
              <li><strong>document</strong> data: <code>{'{ title, sections: [{ id, title, blocks }] }'}</code></li>
              <li><strong>form</strong> data: <code>{'{ title, sections: [{ id, title, fields }] }'}</code></li>
              <li><strong>chat</strong> data: <code>{'{ title, messages: [{ id, role, content, timestamp }] }'}</code></li>
              <li>Use the <strong>Export JSON</strong> button to copy the validated payload</li>
              <li>Switch to the <strong>Playground</strong> tab for raw JSON editing mode</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section header sub-component ──────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      paddingBottom: '0.375rem',
      borderBottom: '1px solid #f1f5f9',
    }}>
      {title}
    </div>
  );
}
