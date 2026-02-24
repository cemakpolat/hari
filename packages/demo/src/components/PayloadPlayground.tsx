import React, { useState, useMemo, useCallback } from 'react';
import {
  IntentPayloadSchema,
  compileIntent,
  type IntentPayloadInput,
} from '@hari/core';
import { IntentRenderer, IntentErrorBoundary } from '@hari/ui';
import { registry } from '../registry';

// ─────────────────────────────────────────────────────────────────────────────
// PayloadPlayground — FUTURE_TASKS §10b
//
// Interactive developer tool: paste a raw JSON intent payload, get
// live schema validation feedback and rendered output side-by-side.
//
// Useful for:
//  - Agent authors verifying their payload shapes before integration
//  - UI devs exploring renderer behaviour across edge cases
//  - Debugging malformed intents during development
// ─────────────────────────────────────────────────────────────────────────────

// ── Starter templates ─────────────────────────────────────────────────────────

const STARTER_TEMPLATES: Record<string, string> = {
  chat: JSON.stringify({
    version: '1.0.0',
    intentId: 'playground-chat-1',
    type: 'chat',
    domain: 'support',
    primaryGoal: 'Try the Chat renderer',
    confidence: 0.9,
    density: 'operator',
    data: {
      title: 'Playground Chat',
      messages: [
        { id: 'm1', role: 'system', content: 'Session started.', timestamp: Date.now() - 120000 },
        { id: 'm2', role: 'agent', content: 'Hello! How can I help?', timestamp: Date.now() - 90000 },
        { id: 'm3', role: 'user', content: 'I want to test the playground.', timestamp: Date.now() - 60000 },
        { id: 'm4', role: 'agent', content: 'Great! Edit this JSON and watch the preview update live.', timestamp: Date.now() - 30000 },
      ],
    },
  }, null, 2),

  document: JSON.stringify({
    version: '1.0.0',
    intentId: 'playground-doc-1',
    type: 'document',
    domain: 'reports',
    primaryGoal: 'Display a rich document',
    confidence: 0.95,
    density: 'operator',
    data: {
      title: 'Playground Document',
      sections: [
        {
          id: 's1',
          title: 'Introduction',
          confidence: 0.9,
          collapsible: true,
          blocks: [
            { id: 'b1', type: 'paragraph', text: 'Edit this JSON to experiment with the document renderer. Try adding different **block types**.' },
            { id: 'b2', type: 'callout', level: 'info', title: 'Tip', body: 'You can add any block type: heading, paragraph, list, code, table, callout, badge, divider.' },
          ],
        },
        {
          id: 's2',
          title: 'Sample Table',
          blocks: [
            {
              id: 'b3', type: 'table',
              headers: [
                { key: 'name', label: 'Name' },
                { key: 'status', label: 'Status' },
                { key: 'score', label: 'Score', align: 'right' },
              ],
              rows: [
                { name: 'Alpha', status: 'Active', score: 92 },
                { name: 'Beta', status: 'Paused', score: 78 },
                { name: 'Gamma', status: 'Active', score: 85 },
                { name: 'Delta', status: 'Inactive', score: 61 },
                { name: 'Epsilon', status: 'Active', score: 97 },
              ],
              caption: 'Click column headers to sort. Use the filter box to search.',
            },
          ],
        },
      ],
    },
  }, null, 2),

  calendar: JSON.stringify({
    version: '1.0.0',
    intentId: 'playground-cal-1',
    type: 'calendar',
    domain: 'engineering',
    primaryGoal: 'Show a team calendar',
    confidence: 0.9,
    density: 'operator',
    data: {
      title: 'Team Calendar',
      view: 'week',
      focusDate: new Date().toISOString().split('T')[0],
      events: [
        { id: 'e1', title: 'Standup', start: `${new Date().toISOString().split('T')[0]}T09:00:00`, end: `${new Date().toISOString().split('T')[0]}T09:30:00`, color: '#6366f1' },
        { id: 'e2', title: 'Sprint Review', start: `${new Date().toISOString().split('T')[0]}T14:00:00`, end: `${new Date().toISOString().split('T')[0]}T15:00:00`, color: '#22c55e' },
      ],
    },
  }, null, 2),

  kanban: JSON.stringify({
    version: '1.0.0',
    intentId: 'playground-kanban-1',
    type: 'kanban',
    domain: 'project',
    primaryGoal: 'Show a Kanban board',
    confidence: 0.9,
    density: 'operator',
    data: {
      title: 'Sprint Board',
      columns: [
        { id: 'backlog', title: 'Backlog', cards: [{ id: 'c1', title: 'Design review', priority: 'medium' }] },
        { id: 'doing', title: 'In Progress', wipLimit: 3, cards: [{ id: 'c2', title: 'Auth integration', priority: 'high', assignee: 'alice' }] },
        { id: 'done', title: 'Done', cards: [{ id: 'c3', title: 'API docs', priority: 'low' }] },
      ],
    },
  }, null, 2),
};

// ── Validation helpers ────────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  errors: string[];
  payload: IntentPayloadInput | null;
}

function validateJson(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${(e as Error).message}`], payload: null };
  }

  const result = IntentPayloadSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true, errors: [], payload: result.data as IntentPayloadInput };
  }

  // Collect Zod error paths + messages
  const errors = result.error.issues.map((iss) => {
    const path = iss.path.length ? `${iss.path.join('.')} — ` : '';
    return `${path}${iss.message}`;
  });
  return { ok: false, errors, payload: null };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PayloadPlayground() {
  const [json, setJson] = useState(STARTER_TEMPLATES.chat);
  const [activeTemplate, setActiveTemplate] = useState<string>('chat');
  const [density, setDensity] = useState<'executive' | 'operator' | 'expert'>('operator');

  const validation = useMemo(() => validateJson(json), [json]);

  const compiled = useMemo(() => {
    if (!validation.payload) return null;
    try {
      return compileIntent(validation.payload, registry);
    } catch {
      return null;
    }
  }, [validation.payload]);

  const handleFormat = useCallback(() => {
    try {
      setJson(JSON.stringify(JSON.parse(json), null, 2));
    } catch { /* ignore */ }
  }, [json]);

  const handleTemplateSelect = (key: string) => {
    setActiveTemplate(key);
    setJson(STARTER_TEMPLATES[key]);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', padding: '1.5rem 2rem', background: '#f8fafc', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
          Payload Playground
        </h1>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.3rem 0 0' }}>
          Paste any HARI intent payload as JSON — get live schema validation and rendered output.
        </p>
      </div>

      {/* Template picker */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.25rem' }}>
          Starter:
        </span>
        {Object.keys(STARTER_TEMPLATES).map((key) => (
          <button
            key={key}
            onClick={() => handleTemplateSelect(key)}
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              border: '1px solid',
              borderColor: activeTemplate === key ? '#6366f1' : '#e2e8f0',
              borderRadius: '99px',
              background: activeTemplate === key ? '#ede9fe' : 'white',
              color: activeTemplate === key ? '#4f46e5' : '#475569',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {key}
          </button>
        ))}
        <div style={{ flexGrow: 1 }} />
        <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          Density:
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as 'executive' | 'operator' | 'expert')}
            style={{ fontSize: '0.72rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', padding: '0.2rem 0.4rem' }}
          >
            <option value="executive">Executive</option>
            <option value="operator">Operator</option>
            <option value="expert">Expert</option>
          </select>
        </label>
      </div>

      {/* Two-column layout: editor | preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>

        {/* ── Editor column ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              JSON Payload
            </span>
            <button
              onClick={handleFormat}
              title="Prettify JSON"
              style={{
                fontSize: '0.7rem', padding: '0.15rem 0.5rem',
                border: '1px solid #e2e8f0', borderRadius: '0.25rem',
                background: 'white', color: '#6b7280', cursor: 'pointer',
              }}
            >
              Format
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            aria-label="Intent payload JSON editor"
            style={{
              width: '100%',
              height: '480px',
              fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Consolas, monospace',
              fontSize: '0.72rem',
              lineHeight: 1.6,
              padding: '0.75rem',
              border: `1.5px solid ${validation.ok ? '#22c55e' : validation.errors.length ? '#ef4444' : '#e2e8f0'}`,
              borderRadius: '0.5rem',
              resize: 'vertical',
              outline: 'none',
              background: '#0f172a',
              color: '#e2e8f0',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />

          {/* Validation status */}
          <div style={{ minHeight: '1.5rem' }}>
            {validation.ok ? (
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>✓</span> Valid payload — {compiled ? `compiled as ${compiled.type}` : 'compiler error'}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>
                {validation.errors.map((e, i) => (
                  <div key={i} style={{ marginBottom: '0.15rem' }}>✗ {e}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Preview column ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Rendered Output
          </span>

          <div style={{
            minHeight: '480px',
            border: '1.5px solid #e2e8f0',
            borderRadius: '0.5rem',
            background: 'white',
            padding: '1rem',
            overflowY: 'auto',
          }}>
            {!compiled ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: '#94a3b8', padding: '2rem' }}>
                <div style={{ fontSize: '2rem' }}>🧩</div>
                <div style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                  {validation.ok
                    ? 'Could not compile this payload — check the intent type is registered.'
                    : 'Fix the JSON errors on the left to see a live preview.'}
                </div>
              </div>
            ) : (
              <IntentErrorBoundary
                fallbackData={compiled.data}
                domain={compiled.domain}
                intentType={compiled.type}
              >
                <IntentRenderer
                  compiledView={{ ...compiled, density }}
                  onActionExecute={(action) => console.log('[Playground] action:', action)}
                  onAmbiguityChange={(id, opt) => console.log('[Playground] ambiguity:', id, opt)}
                />
              </IntentErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* Schema reference hint */}
      <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
        Required top-level fields: <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>version</code>,{' '}
        <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>intentId</code>,{' '}
        <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>type</code>,{' '}
        <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>domain</code>,{' '}
        <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>primaryGoal</code>,{' '}
        <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>confidence</code>,{' '}
        <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: '2px' }}>data</code>.
        Registered intent types: <em>comparison, diagnostic_overview, sensor_overview, document, form, timeline, workflow, kanban, calendar, tree, chat</em>.
      </div>
    </div>
  );
}
