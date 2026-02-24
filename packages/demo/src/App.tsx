import React from 'react';
import {
  compileIntent,
  useIntentStore,
  useUIStore,
  IntentPayloadSchema,
  checkSchemaVersion,
  buildCapabilityManifest,
  MockAgentBridge,
  WebSocketAgentBridge,
  SSEAgentBridge,
  MCPAgentBridge,
  telemetry,
  createCollaborator,
} from '@hari/core';
import type { IntentPayloadInput, AgentBridge } from '@hari/core';
import {
  IntentRenderer,
  DensitySelector,
  IntentErrorBoundary,
  HypotheticalOverlay,
  HypotheticalCompare,
  useAgentBridge,
} from '@hari/ui';
import { registry } from './registry';
import { travelIntent } from './scenarios/travel';
import { cloudopsIntent } from './scenarios/cloudops';
import { iotIntent } from './scenarios/iot';
import { documentIntent } from './scenarios/document';
import { formDeploymentIntent } from './scenarios/form-deployment';
import { documentProductAnalysisIntent } from './scenarios/document-product-analysis';
import { calendarOnCallIntent } from './scenarios/calendar-oncall';
import { treeOrgChartIntent } from './scenarios/tree-org-chart';
import { timelineDeploymentsIntent } from './scenarios/timeline-deployments';
import { workflowOnboardingIntent } from './scenarios/workflow-onboarding';
import { kanbanSprintIntent } from './scenarios/kanban-sprint';
import { chatSupportIntent } from './scenarios/chat-support';
import { PayloadPlayground } from './components/PayloadPlayground';
import { IntentPayloadBuilder } from './components/IntentPayloadBuilder';
import {
  makeIotMutator,
  makeCloudopsMutator,
  makeTravelMutator,
} from './scenarios/live-mutations';

// Enable telemetry — all events are echoed to the Negotiation Log via subscribe().
telemetry.enable();

// ─────────────────────────────────────────────────────────────────────────────
// Demo Application — HARI v0.3
//
// Twelve complete scenarios demonstrating the full HARI architecture:
//   1. Travel             — flight comparison, price/comfort negotiation
//   2. CloudOps           — incident dashboard, blast-radius confirm
//   3. IoT                — sensor grid, new domain (extensibility demo)
//   4. SRE Post-Mortem    — living document with AI confidence
//   5. Deployment Config  — form with validation, conditional fields
//   6. Product Analysis   — rich document with tables, charts, quotes
//   7. On-Call Schedule   — calendar with month/week/agenda views
//   8. Org Chart          — interactive tree with expand/collapse + search
//   9. Deploy History     — timeline with grouping, status badges, incidents
//  10. Service Onboarding — multi-step workflow wizard (5 steps, form + review)
//  11. Sprint Board       — kanban with WIP limits, priorities, and metadata
//  12. Support Chat       — chat/conversation with streaming, attachments, explainability
//
// Transport: MockAgentBridge simulates real agent roundtrips —
//   - loadScenario() → emits 'intent' → useAgentBridge → setIntent
//   - sendModification() → bridge applies patch (400 ms) → re-emits intent
//   - queryWhatIf() → bridge runs domain-aware simulation → HypotheticalOverlay
// ─────────────────────────────────────────────────────────────────────────────

const SCENARIOS: Record<string, { label: string; intent: IntentPayloadInput; emoji: string }> = {
  travel:   { label: 'Travel',   emoji: '✈', intent: travelIntent   },
  cloudops: { label: 'CloudOps', emoji: '🖥', intent: cloudopsIntent },
  iot:      { label: 'IoT',      emoji: '📡', intent: iotIntent      },
  document: { label: 'SRE Post-Mortem', emoji: '📄', intent: documentIntent },
  form:     { label: 'Deploy Config',   emoji: '⚙', intent: formDeploymentIntent },
  analysis: { label: 'Product Analysis', emoji: '📊', intent: documentProductAnalysisIntent },
  calendar:  { label: 'On-Call Schedule', emoji: '📅', intent: calendarOnCallIntent },
  tree:      { label: 'Org Chart',        emoji: '🌳', intent: treeOrgChartIntent },
  timeline:  { label: 'Deploy History',   emoji: '⏱', intent: timelineDeploymentsIntent },
  workflow:  { label: 'Onboarding',       emoji: '🧭', intent: workflowOnboardingIntent },
  kanban:    { label: 'Sprint Board',     emoji: '📌', intent: kanbanSprintIntent },
  chat:      { label: 'Support Chat',     emoji: '💬', intent: chatSupportIntent },
};

// Registered domains/intent-types for capability manifest
const REGISTERED_DOMAINS = ['travel', 'cloudops', 'iot', 'reports', 'deployment', 'product-analytics', 'engineering', 'hr', 'support'];
const REGISTERED_INTENT_TYPES = ['comparison', 'diagnostic_overview', 'sensor_overview', 'document', 'form', 'timeline', 'workflow', 'kanban', 'calendar', 'tree', 'chat'];

const capabilityManifest = buildCapabilityManifest(
  REGISTERED_DOMAINS,
  REGISTERED_INTENT_TYPES,
);

/** Per-scenario live-update mutator factories. Scenarios without a live mode are undefined. */
const LIVE_MUTATORS: Record<string, (() => (intent: import('@hari/core').IntentPayload) => import('@hari/core').IntentPayload) | undefined> = {
  iot:      makeIotMutator,
  cloudops: makeCloudopsMutator,
  travel:   makeTravelMutator,
};

/** How often the live mutator fires (ms). */
const LIVE_UPDATE_INTERVAL_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Transport Configuration
// ─────────────────────────────────────────────────────────────────────────────

export type TransportType = 'mock' | 'websocket' | 'sse' | 'mcp';

const TRANSPORT_DEFAULTS: Record<TransportType, string> = {
  mock: 'N/A',
  websocket: 'ws://localhost:3001',
  sse: 'http://localhost:3002',
  mcp: 'ws://localhost:3003',
};

/**
 * Create agent bridge based on transport type and configuration
 */
function createBridge(transportType: TransportType, config?: Record<string, string>): AgentBridge {
  switch (transportType) {
    case 'websocket': {
      const url = config?.websocketUrl || TRANSPORT_DEFAULTS.websocket;
      return new WebSocketAgentBridge({ url });
    }
    case 'sse': {
      const baseUrl = config?.sseUrl || TRANSPORT_DEFAULTS.sse;
      return new SSEAgentBridge({ baseUrl });
    }
    case 'mcp': {
      const url = config?.mcpUrl || TRANSPORT_DEFAULTS.mcp;
      return new MCPAgentBridge({ url });
    }
    case 'mock':
    default:
      return new MockAgentBridge({ connectLatencyMs: 150, roundtripLatencyMs: 400 });
  }
}

/**
 * Get default transport from environment or user preference
 */
function getDefaultTransport(): TransportType {
  const env = (import.meta.env.VITE_TRANSPORT as string) || 'mock';
  if (['mock', 'websocket', 'sse', 'mcp'].includes(env)) {
    return env as TransportType;
  }
  return 'mock';
}

export function App() {
  const [activeView, setActiveView] = React.useState<'demo' | 'playground' | 'builder'>('demo');
  const [activeScenario, setActiveScenario] = React.useState<string>('travel');
  const [log, setLog] = React.useState<string[]>([]);
  const [hypotheticalQuery, setHypotheticalQuery] = React.useState<string | null>(null);
  const [versionWarning, setVersionWarning] = React.useState<string | null>(null);
  const [isLive, setIsLive] = React.useState(false);
  const [transportType, setTransportType] = React.useState<TransportType>(getDefaultTransport());
  const [snapshotLabel, setSnapshotLabel] = React.useState('');
  const [showSnapshotPanel, setShowSnapshotPanel] = React.useState(false);
  const [showCollaboratorsPanel, setShowCollaboratorsPanel] = React.useState(false);
  const [testCollaboratorName, setTestCollaboratorName] = React.useState('');


  const {
    currentIntent,
    commitModifications,
    modifyParameter,
    hypotheticalIntent,
    branchHypothetical,
    intentHistory,
    redoStack,
    undo,
    redo,
    snapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    exportSnapshots,
    collaborators,
    addCollaborator,
    removeCollaborator,
    updateCollaboratorFocus,
    getCollaborators,
  } = useIntentStore();
  const { densityOverride, setHypotheticalMode } = useUIStore();

  const addLog = React.useCallback((msg: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 50))
  , []);

  // Forward telemetry events to the negotiation log.
  React.useEffect(() => {
    return telemetry.subscribe((event) => {
      addLog(`[telemetry] ${event.type}`);
    });
  }, [addLog]);

  // ── Transport bridge (stable identity across renders) ─────────────────────
  const bridge = React.useMemo(
    () => createBridge(transportType),
    [transportType],
  );

  const { connectionState, sendModification } = useAgentBridge(bridge, capabilityManifest);

  // Log connection state changes
  const prevStateRef = React.useRef(connectionState);
  React.useEffect(() => {
    if (connectionState !== prevStateRef.current) {
      addLog(`[bridge] ${prevStateRef.current} → ${connectionState}`);
      prevStateRef.current = connectionState;
    }
  }, [connectionState, addLog]);

  // ── Live updates ───────────────────────────────────────────────────────────
  // Stop live updates whenever the active scenario changes; the toggle button
  // resets so the user must opt back in for the new scenario.
  React.useEffect(() => {
    bridge.stopLiveUpdates();
    setIsLive(false);
  }, [activeScenario, bridge]);

  const handleLiveToggle = React.useCallback(() => {
    if (isLive) {
      bridge.stopLiveUpdates();
      setIsLive(false);
      addLog('[simulate] Live updates stopped');
    } else {
      const factory = LIVE_MUTATORS[activeScenario];
      if (!factory) return;
      bridge.startLiveUpdates(LIVE_UPDATE_INTERVAL_MS, factory());
      setIsLive(true);
      addLog(`[simulate] Live updates started (${LIVE_UPDATE_INTERVAL_MS} ms interval)`);
    }
  }, [isLive, activeScenario, bridge, addLog]);

  // ── Scenario loading ───────────────────────────────────────────────────────
  React.useEffect(() => {
    const scenario = SCENARIOS[activeScenario];
    const raw = scenario.intent;

    const compat = checkSchemaVersion(raw.version ?? '1.0.0');
    if (compat.status === 'incompatible') {
      setVersionWarning(compat.reason);
      addLog(`[error] ${compat.reason}`);
    } else if (compat.status === 'degraded') {
      setVersionWarning(compat.reason);
      addLog(`[warn] ${compat.reason}`);
    } else {
      setVersionWarning(null);
    }

    const parsed = IntentPayloadSchema.parse(raw);

    // Route through the bridge — it emits 'intent' → useAgentBridge → setIntent
    bridge.loadScenario(parsed);
    addLog(
      `[agent] Scenario loaded: ${parsed.intentId.slice(0, 8)}… ` +
      `domain=${parsed.domain} type=${parsed.type} ` +
      `confidence=${(parsed.confidence * 100).toFixed(0)}%`,
    );

    setHypotheticalQuery(null);
    setHypotheticalMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  // ── Compiled view ──────────────────────────────────────────────────────────
  const compiled = React.useMemo(() => {
    if (!currentIntent) return null;
    return compileIntent(currentIntent, registry, { userDensityOverride: densityOverride });
  }, [currentIntent, densityOverride]);

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleAmbiguityChange = React.useCallback((controlId: string, value: unknown) => {
    addLog(`[user] Control "${controlId}" → ${JSON.stringify(value)}`);
    // Stage the change so commitModifications() produces a non-empty patch
    modifyParameter(controlId, value);
    const patch = commitModifications();
    if (patch) {
      sendModification(patch); // goes through transport → bridge applies → re-emits intent
      addLog(`[bridge] Patch dispatched (${Object.keys(patch.modifications).join(', ')}) → awaiting roundtrip…`);
    }
  }, [addLog, modifyParameter, commitModifications, sendModification]);

  const handleActionExecute = React.useCallback((actionId: string) => {
    addLog(`[user] Action executed: "${actionId}"`);
    addLog(`[agent] Acknowledged — propagating to downstream systems…`);
  }, [addLog]);

  const handleWhatIf = React.useCallback((query: string) => {
    addLog(`[user] What-if: "${query}"`);
    setHypotheticalQuery(query);
    setHypotheticalMode(true, query);
    addLog(`[bridge] queryWhatIf dispatched — running in isolated context…`);
  }, [addLog, setHypotheticalMode]);

  const dismissHypothetical = React.useCallback(() => {
    setHypotheticalQuery(null);
    setHypotheticalMode(false);
    addLog('[user] Dismissed hypothetical overlay');
  }, [addLog, setHypotheticalMode]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        backgroundColor: '#0f172a', color: 'white',
        padding: '0.875rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>HARI</div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Human–Agent Runtime Interface · v0.1</div>
        </div>

        {/* View toggle: Demo vs Playground */}
        <div style={{ display: 'flex', gap: '0.375rem', borderRight: '1px solid #334155', paddingRight: '0.75rem', marginRight: '0.25rem' }}>
          {(['demo', 'playground', 'builder'] as const).map((view) => (
            <button key={view} onClick={() => setActiveView(view)} style={{
              padding: '0.375rem 0.875rem', borderRadius: '0.375rem', border: 'none',
              backgroundColor: activeView === view ? '#312e81' : '#1e293b',
              color: activeView === view ? '#c7d2fe' : '#94a3b8',
              fontWeight: activeView === view ? 700 : 400,
              cursor: 'pointer', fontSize: '0.8rem', textTransform: 'capitalize',
            }}>
              {view === 'playground' ? '🧩 Playground' : view === 'builder' ? '🔧 Builder' : '▶ Demo'}
            </button>
          ))}
        </div>

        {/* Transport selector — only shown in demo view */}
        {activeView === 'demo' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', borderRight: '1px solid #334155', paddingRight: '0.75rem', marginRight: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Transport:</label>
            <select value={transportType} onChange={(e) => setTransportType(e.target.value as TransportType)} style={{
              padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #475569',
              backgroundColor: '#1e293b', color: '#e2e8f0',
              fontSize: '0.75rem', fontWeight: 500,
              cursor: 'pointer',
            }}>
              <option value="mock">Mock (Local)</option>
              <option value="websocket">WebSocket</option>
              <option value="sse">Server-Sent Events</option>
              <option value="mcp">MCP</option>
            </select>
          </div>
        )}

        {/* Scenario tabs — only shown in demo view */}
        {activeView === 'demo' && (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {Object.entries(SCENARIOS).map(([key, { label, emoji }]) => (
              <button key={key} onClick={() => setActiveScenario(key)} style={{
                padding: '0.375rem 0.875rem', borderRadius: '0.375rem', border: 'none',
                backgroundColor: activeScenario === key ? '#4f46e5' : '#1e293b',
                color: activeScenario === key ? 'white' : '#94a3b8',
                fontWeight: activeScenario === key ? 700 : 400,
                cursor: 'pointer', fontSize: '0.8rem',
              }}>
                {emoji} {label}
              </button>
            ))}
          </div>
        )}

        {/* Right side: live sim + connection badge + density selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {LIVE_MUTATORS[activeScenario] && (
            <button
              onClick={handleLiveToggle}
              title={isLive ? 'Stop live simulation' : 'Start live data simulation — bridge pushes updated intents every 2 s'}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: `1px solid ${isLive ? '#22c55e' : '#334155'}`,
                backgroundColor: isLive ? '#052e16' : '#1e293b',
                color: isLive ? '#86efac' : '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                backgroundColor: isLive ? '#22c55e' : '#475569',
                display: 'inline-block',
                animation: isLive ? 'pulse 1.4s ease-in-out infinite' : 'none',
              }} />
              {isLive ? 'Stop Sim' : 'Simulate'}
            </button>
          )}
          <ConnectionBadge state={connectionState} />
          {compiled && currentIntent && !hypotheticalIntent && (
            <button
              onClick={() => { branchHypothetical(); addLog('[hypothetical] Branch created from currentIntent'); }}
              title="Create an isolated what-if branch from the current intent"
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #a78bfa',
                backgroundColor: '#1e293b',
                color: '#c4b5fd',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.72rem',
              }}
            >
              ⎇ Branch
            </button>
          )}
          {compiled && <DensitySelector agentRecommended={compiled.density} />}
        </div>
      </header>

      {/* ── Schema version warning ────────────────────────────────────── */}
      {versionWarning && (
        <div style={{
          backgroundColor: '#fef9c3', borderBottom: '1px solid #fde047',
          padding: '0.5rem 2rem', fontSize: '0.8rem', color: '#854d0e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠ Schema version: {versionWarning}</span>
          <button onClick={() => setVersionWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854d0e', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Playground view ─────────────────────────────────────────── */}
      {activeView === 'playground' && (
        <main style={{ flex: 1 }}>
          <PayloadPlayground />
        </main>
      )}

      {/* ── Builder view ─────────────────────────────────────────────── */}
      {activeView === 'builder' && (
        <main style={{ flex: 1 }}>
          <IntentPayloadBuilder />
        </main>
      )}

      {/* ── Main grid (demo view) ─────────────────────────────────────── */}
      {activeView === 'demo' && <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '1.25rem',
        padding: '1.25rem 2rem',
        alignItems: 'start',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>

        {/* ── Left column: intent + hypothetical ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Intent header */}
          {compiled && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {compiled.domain} / {compiled.type}
                  </div>
                  <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.0625rem', fontWeight: 700, color: '#1e293b' }}>
                    {compiled.primaryGoal}
                  </h2>
                </div>
                <ConfidencePill confidence={compiled.confidence} />
              </div>
            </div>
          )}

          {/* Main content — error-bounded */}
          <IntentErrorBoundary
            fallbackData={compiled?.data}
            domain={compiled?.domain}
            intentType={compiled?.type}
          >
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              {compiled ? (
                <IntentRenderer
                  compiledView={compiled}
                  onActionExecute={handleActionExecute}
                  onAmbiguityChange={handleAmbiguityChange}
                  onWhatIf={handleWhatIf}
                />
              ) : (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                  {connectionState === 'connecting' ? 'Connecting to agent…' : 'Loading intent…'}
                </div>
              )}
            </div>
          </IntentErrorBoundary>

          {/* Hypothetical overlay — uses bridge.queryWhatIf() when connected */}
          {hypotheticalQuery && !hypotheticalIntent && (
            <HypotheticalOverlay
              query={hypotheticalQuery}
              onDismiss={dismissHypothetical}
              bridge={connectionState === 'connected' ? bridge : undefined}
              intentSnapshot={currentIntent ?? undefined}
            />
          )}

          {/* Hypothetical branch compare — side-by-side actual vs branched state */}
          {hypotheticalIntent && (
            <HypotheticalCompare
              registry={registry}
              onCommit={() => addLog('[hypothetical] Branch committed → became currentIntent')}
              onRollback={() => addLog('[hypothetical] Branch rolled back → discarded')}
            />
          )}
        </div>

        {/* ── Right column: architecture panels ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Schema + capability */}
          {compiled && (
            <Panel title="Schema & Capabilities">
              <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.7' }}>
                <div><strong>Version:</strong> {currentIntent?.version}</div>
                <div><strong>Domain:</strong> {compiled.domain}</div>
                <div><strong>Density:</strong> {compiled.density}{densityOverride ? ' (user)' : ' (agent)'}</div>
                <div><strong>Component:</strong> {compiled.resolvedComponent ? '✓ resolved' : '⚠ fallback'}</div>
                <div><strong>Ambiguities:</strong> {compiled.ambiguities.length}</div>
                <div><strong>Actions:</strong> {compiled.actions.length}</div>
                <div><strong>Explain panels:</strong> {Object.keys(compiled.explainability).length}</div>
              </div>
            </Panel>
          )}

          {/* Intent payload */}
          <Panel title="Active Intent Payload">
            <pre style={{ margin: 0, fontSize: '0.62rem', color: '#475569', overflowX: 'auto', overflowY: 'auto', maxHeight: '220px', whiteSpace: 'pre-wrap' }}>
              {currentIntent
                ? JSON.stringify({ ...currentIntent, data: '[omitted]', explainability: '[omitted]' }, null, 2)
                : 'null'}
            </pre>
          </Panel>

          {/* Negotiation log */}
          <Panel title="Negotiation Log">
            <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {log.length === 0 ? (
                <span style={{ color: '#94a3b8' }}>No events yet</span>
              ) : (
                log.map((entry, i) => (
                  <div key={i} style={{
                    color: entry.startsWith('[error]')   ? '#dc2626'
                         : entry.startsWith('[warn]')    ? '#a16207'
                         : entry.includes('[bridge]')    ? '#0369a1'
                         : entry.includes('[agent]')     ? '#7c3aed'
                         : entry.includes('[user]')      ? '#0f766e'
                         : '#475569',
                  }}>
                    {entry}
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* Snapshots (version control) */}
          <Panel title="Snapshots (v0.5.1)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Name this snapshot…"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && snapshotLabel.trim()) {
                      createSnapshot(snapshotLabel);
                      setSnapshotLabel('');
                      addLog(`[snapshot] Created: "${snapshotLabel}"`);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.375rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.73rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={() => {
                    if (snapshotLabel.trim()) {
                      createSnapshot(snapshotLabel);
                      addLog(`[snapshot] Created: "${snapshotLabel}"`);
                      setSnapshotLabel('');
                    }
                  }}
                  style={{
                    padding: '0.375rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #9f7aea',
                    backgroundColor: '#f5f3ff',
                    color: '#6b21a8',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    const json = exportSnapshots();
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `snapshots-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    addLog('[snapshot] Exported JSON');
                  }}
                  style={{
                    padding: '0.375rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #9f7aea',
                    backgroundColor: '#f5f3ff',
                    color: '#6b21a8',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Export
                </button>
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {Object.values(snapshots).length === 0 ? (
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>No snapshots yet</span>
                ) : (
                  Object.values(snapshots)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((snapshot) => (
                      <div
                        key={snapshot.snapshotId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.375rem 0.5rem',
                          backgroundColor: '#f8f5ff',
                          borderRadius: '0.375rem',
                          border: '1px solid #e9d5ff',
                          fontSize: '0.68rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#6b21a8' }}>{snapshot.label}</div>
                          <div style={{ color: '#a78bfa', fontSize: '0.65rem' }}>
                            {new Date(snapshot.createdAt).toLocaleTimeString()} ({snapshot.changedKeys.length} changes)
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            onClick={() => {
                              restoreSnapshot(snapshot.snapshotId);
                              addLog(`[snapshot] Restored: "${snapshot.label}"`);
                            }}
                            style={{
                              padding: '0.25rem 0.375rem',
                              fontSize: '0.65rem',
                              borderRadius: '0.25rem',
                              border: '1px solid #c4b5fd',
                              backgroundColor: 'transparent',
                              color: '#7c3aed',
                              cursor: 'pointer',
                            }}
                          >
                            ↩ Restore
                          </button>
                          <button
                            onClick={() => {
                              deleteSnapshot(snapshot.snapshotId);
                              addLog(`[snapshot] Deleted: "${snapshot.label}"`);
                            }}
                            style={{
                              padding: '0.25rem 0.375rem',
                              fontSize: '0.65rem',
                              borderRadius: '0.25rem',
                              border: '1px solid #fca5a5',
                              backgroundColor: 'transparent',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                          >
                            ✕ Delete
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </Panel>

          {/* Collaborators (real-time presence) */}
          <Panel title="Collaborators (v0.5.2)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Add test collaborator…"
                  value={testCollaboratorName}
                  onChange={(e) => setTestCollaboratorName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && testCollaboratorName.trim()) {
                      const collab = createCollaborator(testCollaboratorName);
                      addCollaborator(collab);
                      addLog(`[presence] Added: "${testCollaboratorName}"`);
                      setTestCollaboratorName('');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.375rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.73rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={() => {
                    if (testCollaboratorName.trim()) {
                      const collab = createCollaborator(testCollaboratorName);
                      addCollaborator(collab);
                      addLog(`[presence] Added: "${testCollaboratorName}"`);
                      setTestCollaboratorName('');
                    }
                  }}
                  style={{
                    padding: '0.375rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #a78bfa',
                    backgroundColor: '#f5f3ff',
                    color: '#6b21a8',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {getCollaborators().length === 0 ? (
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>No collaborators</span>
                ) : (
                  getCollaborators().map((collab) => (
                    <div
                      key={collab.collaboratorId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.375rem 0.5rem',
                        backgroundColor: '#f8f5ff',
                        borderRadius: '0.375rem',
                        border: `2px solid ${collab.color}`,
                        fontSize: '0.68rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            backgroundColor: collab.color,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#6b21a8' }}>{collab.displayName}</div>
                          <div style={{ color: '#a78bfa', fontSize: '0.65rem' }}>
                            {collab.focusedDataKey ? `on ${collab.focusedDataKey}` : 'no focus'} · {collab.currentAction || 'viewing'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          removeCollaborator(collab.collaboratorId);
                          addLog(`[presence] Removed: "${collab.displayName}"`);
                        }}
                        style={{
                          padding: '0.25rem 0.375rem',
                          fontSize: '0.65rem',
                          borderRadius: '0.25rem',
                          border: '1px solid #fca5a5',
                          backgroundColor: 'transparent',
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          {/* Architecture notes */}
          <Panel title="Architecture Notes">
            <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.73rem', color: '#64748b', lineHeight: '1.8' }}>
              <li>MockAgentBridge → full transport roundtrip</li>
              <li>loadScenario → 'intent' event → useAgentBridge → setIntent</li>
              <li>sendModification → 400 ms → re-emit updated intent</li>
              <li>queryWhatIf → HypotheticalOverlay (bridge or fallback)</li>
              <li>useMemo resolution — component + data always in sync</li>
              <li>Two stores: Intent (committed) + UI (ephemeral)</li>
              <li>12 scenarios: Travel, CloudOps, IoT, Doc, Form, Analysis, Calendar, OrgChart, Timeline, Workflow, Kanban, Chat</li>
              <li>FormWrapper: autoSave (localStorage) + isSubmitting state</li>
              <li>DocumentWrapper: search, TOC, PDF export, markdown export</li>
              <li>TimelineWrapper / WorkflowWrapper / KanbanWrapper registered</li>
              <li>CalendarWrapper: month/week/agenda, density-aware views</li>
              <li>TreeWrapper: expand/collapse, search, breadcrumb, status dots</li>
              <li>ChatWrapper: streaming support, attachments, role-aware bubbles</li>
              <li>IoT / Form / Document = new domains, zero compiler changes</li>
              <li>Telemetry: opt-in singleton, events in Negotiation Log</li>
              <li>MCPAgentBridge: JSON-RPC 2.0 over WebSocket (Phase 4)</li>
            </ul>
          </Panel>
        </div>
      </main>}

    </div>
  );
}

// ─── Global styles ────────────────────────────────────────────────────────────

// Inject pulse keyframe once into the document head for the live-sim indicator.
if (typeof document !== 'undefined') {
  const id = 'hari-pulse-style';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`;
    document.head.appendChild(style);
  }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = (confidence * 100).toFixed(0);
  const c = confidence >= 0.8 ? { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }
          : confidence >= 0.6 ? { bg: '#fefce8', text: '#a16207', border: '#fde68a' }
          : { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
  return (
    <div style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {pct}% confidence
    </div>
  );
}

function ConnectionBadge({ state }: { state: string }) {
  const cfg: Record<string, { dot: string; label: string; text: string }> = {
    connected:    { dot: '#22c55e', label: 'Connected',    text: '#86efac' },
    connecting:   { dot: '#f59e0b', label: 'Connecting…',  text: '#fcd34d' },
    reconnecting: { dot: '#f59e0b', label: 'Reconnecting', text: '#fcd34d' },
    disconnected: { dot: '#94a3b8', label: 'Disconnected', text: '#94a3b8' },
    idle:         { dot: '#94a3b8', label: 'Idle',         text: '#94a3b8' },
    error:        { dot: '#ef4444', label: 'Error',        text: '#fca5a5' },
  };
  const { dot, label, text } = cfg[state] ?? cfg.idle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', color: text }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dot, display: 'inline-block' }} />
      {label}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div style={{ padding: '0.75rem 1rem' }}>{children}</div>
    </div>
  );
}
