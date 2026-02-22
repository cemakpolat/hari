import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketAgentBridge } from '../transport/websocket';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Mock WebSocket
// ─────────────────────────────────────────────────────────────────────────────

class MockWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWS.CONNECTING;
  url: string;
  protocols: string | string[] | undefined;

  private _listeners = new Map<string, Array<(e: unknown) => void>>();
  readonly sentMessages: string[] = [];

  static lastInstance: MockWS | null = null;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWS.lastInstance = this;
  }

  addEventListener(type: string, listener: (e: unknown) => void) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type)!.push(listener);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWS.CLOSED;
    this._emit('close', { wasClean: code === 1000, code: code ?? 1006, reason: reason ?? '' });
  }

  // ── Test helpers ──────────────────────────────────────────────────────────

  _emit(type: string, event: unknown = {}) {
    for (const listener of this._listeners.get(type) ?? []) {
      listener(event);
    }
  }

  _open() {
    this.readyState = MockWS.OPEN;
    this._emit('open');
  }

  _receive(data: unknown) {
    this._emit('message', { data: JSON.stringify(data) });
  }

  _closeUnexpectedly() {
    this.readyState = MockWS.CLOSED;
    this._emit('close', { wasClean: false, code: 1006, reason: 'network error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const VALID_INTENT: IntentPayload = {
  version: '1.0.0',
  intentId: crypto.randomUUID(),
  type: 'comparison',
  domain: 'travel',
  primaryGoal: 'Find a flight',
  confidence: 0.9,
  density: 'operator',
  ambiguities: [],
  data: {},
  priorityFields: [],
  actions: [],
  explain: false,
};

describe('WebSocketAgentBridge', () => {
  let bridge: WebSocketAgentBridge;

  beforeEach(() => {
    MockWS.lastInstance = null;
    vi.stubGlobal('WebSocket', MockWS);
    bridge = new WebSocketAgentBridge({ url: 'wss://test.example/hari' });
  });

  afterEach(() => {
    bridge.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // ── Connection ─────────────────────────────────────────────────────────────

  it('starts in idle state', () => {
    expect(bridge.connectionState).toBe('idle');
  });

  it('transitions idle → connecting → connected on open', async () => {
    const states: string[] = [];
    bridge.on('stateChange', (s) => states.push(s));

    const p = bridge.connect();
    expect(bridge.connectionState).toBe('connecting');

    MockWS.lastInstance!._open();
    await p;

    expect(bridge.connectionState).toBe('connected');
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('connect() is a no-op when already connected', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    const wsRef = MockWS.lastInstance;
    await bridge.connect();
    expect(MockWS.lastInstance).toBe(wsRef);
  });

  it('connect() is a no-op when already connecting', async () => {
    bridge.connect();
    expect(bridge.connectionState).toBe('connecting');

    await bridge.connect(); // should not throw or create a second WS
    expect(bridge.connectionState).toBe('connecting');

    // Clean up: open the pending connection
    MockWS.lastInstance!._open();
  });

  it('transitions to disconnected on clean close', async () => {
    const p = bridge.connect();
    MockWS.lastInstance!._open();
    await p;

    bridge.disconnect();
    expect(bridge.connectionState).toBe('disconnected');
  });

  it('stays disconnected after wasClean close event', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    ws.close(1000); // wasClean = true
    expect(bridge.connectionState).toBe('disconnected');
  });

  // ── Incoming messages ──────────────────────────────────────────────────────

  it('emits intent when server sends a valid intent message', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));

    ws._receive({ type: 'intent', payload: VALID_INTENT });

    expect(received).toHaveLength(1);
    expect(received[0].intentId).toBe(VALID_INTENT.intentId);
  });

  it('ignores intent messages with invalid payload schema', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));

    ws._receive({ type: 'intent', payload: { bad: 'data', missingFields: true } });

    expect(received).toHaveLength(0);
  });

  it('ignores non-JSON messages without throwing', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    // Simulate raw non-JSON data
    expect(() => ws._emit('message', { data: 'not json {{' })).not.toThrow();
  });

  it('ignores messages with unknown type without throwing', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    expect(() => ws._receive({ type: 'future_event', payload: {} })).not.toThrow();
  });

  // ── Outbound messages ──────────────────────────────────────────────────────

  it('sendModification sends a modification JSON message', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    bridge.sendModification({
      event: 'intent_modification',
      originalIntentId: crypto.randomUUID(),
      modifications: { nonstop: true, priceWeight: 0.8 },
      timestamp: Date.now(),
    });

    expect(ws.sentMessages).toHaveLength(1);
    const sent = JSON.parse(ws.sentMessages[0]);
    expect(sent.type).toBe('modification');
    expect(sent.payload.modifications.nonstop).toBe(true);
    expect(sent.payload.modifications.priceWeight).toBe(0.8);
  });

  it('sendModification is a no-op and does not throw when not connected', () => {
    expect(() =>
      bridge.sendModification({
        event: 'intent_modification',
        originalIntentId: crypto.randomUUID(),
        modifications: {},
        timestamp: 0,
      }),
    ).not.toThrow();
    expect(MockWS.lastInstance).toBeNull(); // no WebSocket was created
  });

  it('sendCapabilityManifest sends a capability_manifest JSON message', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    bridge.sendCapabilityManifest({
      schemaVersion: '1.0.0',
      supportedIntentTypes: ['comparison', 'diagnostic_overview'],
      supportedAmbiguityTypes: ['toggle', 'range_selector'],
      supportedDomains: ['travel', 'cloudops'],
      densityModes: ['executive', 'operator', 'expert'],
    });

    expect(ws.sentMessages).toHaveLength(1);
    const sent = JSON.parse(ws.sentMessages[0]);
    expect(sent.type).toBe('capability_manifest');
    expect(sent.payload.schemaVersion).toBe('1.0.0');
  });

  // ── What-if ────────────────────────────────────────────────────────────────

  it('queryWhatIf resolves when the server returns a matching what_if_result', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    const resultPromise = bridge.queryWhatIf({
      question: 'What if nonstop only?',
      intentSnapshot: VALID_INTENT,
    });

    // The sent message should carry a correlation id
    expect(ws.sentMessages).toHaveLength(1);
    const sentMsg = JSON.parse(ws.sentMessages[0]);
    expect(sentMsg.type).toBe('what_if_query');
    expect(typeof sentMsg.id).toBe('string');

    // Server replies with the matching result
    ws._receive({
      type: 'what_if_result',
      id: sentMsg.id,
      payload: {
        reasoning: 'Nonstop cuts ~2 h journey time',
        deltas: [{ field: 'duration', from: '8h', to: '6h', direction: 'decrease', magnitude: 'significant' }],
        caveats: ['Fewer departure choices available'],
        confidence: 0.85,
      },
    });

    const result = await resultPromise;
    expect(result.reasoning).toBe('Nonstop cuts ~2 h journey time');
    expect(result.confidence).toBe(0.85);
    expect(result.deltas).toHaveLength(1);
    expect(result.caveats).toHaveLength(1);
  });

  it('ignores what_if_result with an unknown correlation id', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    expect(() =>
      ws._receive({ type: 'what_if_result', id: 'no-such-id', payload: {} }),
    ).not.toThrow();
  });

  // ── Reconnect ──────────────────────────────────────────────────────────────

  it('enters reconnecting state after an unexpected close', async () => {
    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    ws._closeUnexpectedly();
    expect(bridge.connectionState).toBe('reconnecting');

    bridge.disconnect(); // cancel the pending reconnect timer
  });

  it('reconnects with a new WebSocket after the base reconnect delay', async () => {
    vi.useFakeTimers();

    const p = bridge.connect();
    const ws = MockWS.lastInstance!;
    ws._open();
    await p;

    ws._closeUnexpectedly();
    expect(bridge.connectionState).toBe('reconnecting');

    // Advance past base reconnect delay (1000 ms)
    await vi.advanceTimersByTimeAsync(1100);

    const ws2 = MockWS.lastInstance!;
    expect(ws2).not.toBe(ws); // a new WebSocket was created
    expect(bridge.connectionState).toBe('connecting');

    ws2._open();
    await vi.runAllTimersAsync();
    expect(bridge.connectionState).toBe('connected');
  });
});
