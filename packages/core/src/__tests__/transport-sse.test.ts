import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEAgentBridge } from '../transport/sse';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Mock EventSource
// ─────────────────────────────────────────────────────────────────────────────

class MockES {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockES.CONNECTING;
  url: string;

  private _listeners = new Map<string, Array<(e: unknown) => void>>();
  static lastInstance: MockES | null = null;

  constructor(url: string) {
    this.url = url;
    MockES.lastInstance = this;
  }

  addEventListener(type: string, listener: (e: unknown) => void) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type)!.push(listener);
  }

  close() {
    this.readyState = MockES.CLOSED;
  }

  // ── Test helpers ──────────────────────────────────────────────────────────

  _open() {
    this.readyState = MockES.OPEN;
    for (const l of this._listeners.get('open') ?? []) l({});
  }

  /** Emit a named SSE event with a JSON-serialisable data payload */
  _emit(type: string, data: unknown) {
    for (const l of this._listeners.get(type) ?? []) {
      l({ data: JSON.stringify(data) });
    }
  }

  /** Simulate an error that closes the connection */
  _errorClose() {
    this.readyState = MockES.CLOSED;
    for (const l of this._listeners.get('error') ?? []) l({});
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

describe('SSEAgentBridge', () => {
  let bridge: SSEAgentBridge;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    MockES.lastInstance = null;
    vi.stubGlobal('EventSource', MockES);
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    bridge = new SSEAgentBridge({
      streamUrl: 'https://test.example/hari/stream',
      sendUrl: 'https://test.example/hari/send',
    });
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

  it('transitions to connected when the EventSource opens', async () => {
    const states: string[] = [];
    bridge.on('stateChange', (s) => states.push(s));

    const p = bridge.connect();
    expect(bridge.connectionState).toBe('connecting');

    MockES.lastInstance!._open();
    await p;

    expect(bridge.connectionState).toBe('connected');
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('connect() is a no-op when already connected', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    const esRef = MockES.lastInstance;
    await bridge.connect();
    expect(MockES.lastInstance).toBe(esRef);
  });

  it('rejects the connect() promise when the EventSource closes immediately', async () => {
    const p = bridge.connect();
    MockES.lastInstance!._errorClose();
    await expect(p).rejects.toThrow('SSE connection failed');
  });

  // ── Incoming events ────────────────────────────────────────────────────────

  it('emits intent when the server sends an intent event', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));

    es._emit('intent', VALID_INTENT);

    expect(received).toHaveLength(1);
    expect(received[0].intentId).toBe(VALID_INTENT.intentId);
    expect(received[0].domain).toBe('travel');
  });

  it('does not emit intent when the event payload fails schema validation', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    const received: IntentPayload[] = [];
    bridge.on('intent', (i) => received.push(i));

    es._emit('intent', { not: 'a valid intent payload' });
    expect(received).toHaveLength(0);
  });

  it('does not throw on malformed JSON in an event', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    // Simulate raw non-JSON event data
    for (const l of (es as unknown as { _listeners: Map<string, Array<(e: unknown) => void>> })['_listeners'].get('intent') ?? []) {
      expect(() => l({ data: '{ bad json' })).not.toThrow();
    }
  });

  // ── Outbound messages ──────────────────────────────────────────────────────

  it('sendModification POSTs a modification message to sendUrl', async () => {
    const p = bridge.connect();
    MockES.lastInstance!._open();
    await p;

    bridge.sendModification({
      event: 'intent_modification',
      originalIntentId: crypto.randomUUID(),
      modifications: { nonstop: true, priceWeight: 0.9 },
      timestamp: Date.now(),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example/hari/send',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.type).toBe('modification');
    expect(body.payload.modifications.nonstop).toBe(true);
  });

  it('sendModification includes custom headers when configured', async () => {
    bridge = new SSEAgentBridge({
      streamUrl: 'https://test.example/hari/stream',
      sendUrl: 'https://test.example/hari/send',
      headers: { Authorization: 'Bearer test-token' },
    });

    const p = bridge.connect();
    MockES.lastInstance!._open();
    await p;

    bridge.sendModification({
      event: 'intent_modification',
      originalIntentId: crypto.randomUUID(),
      modifications: {},
      timestamp: 0,
    });

    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders['Authorization']).toBe('Bearer test-token');
  });

  it('sendCapabilityManifest POSTs a capability_manifest message', async () => {
    const p = bridge.connect();
    MockES.lastInstance!._open();
    await p;

    bridge.sendCapabilityManifest({
      schemaVersion: '1.0.0',
      supportedIntentTypes: ['comparison'],
      supportedAmbiguityTypes: ['toggle'],
      supportedDomains: ['travel'],
      densityModes: ['operator'],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.type).toBe('capability_manifest');
    expect(body.payload.schemaVersion).toBe('1.0.0');
  });

  // ── What-if ────────────────────────────────────────────────────────────────

  it('queryWhatIf resolves when the what_if_result event arrives with a matching id', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    const resultPromise = bridge.queryWhatIf({
      question: 'What if nonstop only?',
      intentSnapshot: VALID_INTENT,
    });

    // The what_if_query was POSTed — grab the correlation id
    const postBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(postBody.type).toBe('what_if_query');
    expect(typeof postBody.id).toBe('string');

    // Server pushes back the result via SSE
    es._emit('what_if_result', {
      id: postBody.id,
      payload: {
        reasoning: 'Nonstop reduces journey time by ~2 h',
        deltas: [{ field: 'duration', from: '8h', to: '6h', direction: 'decrease', magnitude: 'significant' }],
        caveats: ['Fewer carrier options'],
        confidence: 0.88,
      },
    });

    const result = await resultPromise;
    expect(result.reasoning).toBe('Nonstop reduces journey time by ~2 h');
    expect(result.confidence).toBe(0.88);
  });

  it('ignores what_if_result events with an unknown id', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    expect(() =>
      es._emit('what_if_result', { id: 'no-such-id', payload: {} }),
    ).not.toThrow();
  });

  // ── Disconnect / reconnect ─────────────────────────────────────────────────

  it('disconnect closes the EventSource and transitions to disconnected', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    bridge.disconnect();

    expect(bridge.connectionState).toBe('disconnected');
    expect(es.readyState).toBe(MockES.CLOSED);
  });

  it('enters reconnecting state after an unexpected SSE error', async () => {
    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    es._errorClose();
    expect(bridge.connectionState).toBe('reconnecting');

    bridge.disconnect(); // cancel the pending reconnect timer
  });

  it('reconnects with a new EventSource after the base reconnect delay', async () => {
    vi.useFakeTimers();

    const p = bridge.connect();
    const es = MockES.lastInstance!;
    es._open();
    await p;

    es._errorClose();
    expect(bridge.connectionState).toBe('reconnecting');

    // Advance past base reconnect delay (1000 ms)
    await vi.advanceTimersByTimeAsync(1100);

    const es2 = MockES.lastInstance!;
    expect(es2).not.toBe(es); // new EventSource created
    expect(bridge.connectionState).toBe('connecting');

    es2._open();
    await vi.runAllTimersAsync();
    expect(bridge.connectionState).toBe('connected');
  });
});
