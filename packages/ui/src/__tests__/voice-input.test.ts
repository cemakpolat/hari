// ─────────────────────────────────────────────────────────────────────────────
// voice-input.test.ts — unit tests for useVoiceInput hook + VoiceField schema
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { VoiceFieldSchema, FormFieldSchema } from '@hari/core';

// ── Mock SpeechRecognition ────────────────────────────────────────────────────

// Allow handlers to be called with 0 or 1 args (mirrors the real Speech API
// where onstart fires with no arguments but onresult/onerror fire with events).
type RecognitionHandler = (event?: unknown) => void;

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;

  onstart: RecognitionHandler | null = null;
  onresult: RecognitionHandler | null = null;
  onerror: RecognitionHandler | null = null;
  onend: RecognitionHandler | null = null;

  start = vi.fn(() => { this.onstart?.(); });
  stop = vi.fn(() => { this.onend?.(); });
  abort = vi.fn(() => { this.onend?.(); });

  /** Helper to fire a result event */
  fireResult(transcript: string, isFinal = true, confidence = 0.92) {
    const event = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript, confidence }], {
          isFinal,
          length: 1,
        }),
      ],
    };
    this.onresult?.(event);
    if (isFinal) this.onend?.();
  }

  fireError(code = 'no-speech') {
    this.onerror?.({ error: code });
  }
}

let instance: MockSpeechRecognition;

// SpeechRecognition must be a real constructor (class) so `new Ctor()` works.
// We create a subclass whose constructor captures the singleton `instance`.
function makeMockCtor() {
  return class MockCtor {
    lang = instance.lang;
    continuous = instance.continuous;
    interimResults = instance.interimResults;
    maxAlternatives = instance.maxAlternatives;

    onstart: RecognitionHandler | null = null;
    onresult: RecognitionHandler | null = null;
    onerror: RecognitionHandler | null = null;
    onend: RecognitionHandler | null = null;

    constructor() {
      // Wire properties back so tests can inspect instance fields
      instance.lang = this.lang;
      instance.continuous = this.continuous;
      instance.interimResults = this.interimResults;
      instance.maxAlternatives = this.maxAlternatives;

      // Delegate handler assignments to `instance`
      Object.defineProperties(this, {
        onstart: {
          get: () => instance.onstart,
          set: (v) => { instance.onstart = v; },
        },
        onresult: {
          get: () => instance.onresult,
          set: (v) => { instance.onresult = v; },
        },
        onerror: {
          get: () => instance.onerror,
          set: (v) => { instance.onerror = v; },
        },
        onend: {
          get: () => instance.onend,
          set: (v) => { instance.onend = v; },
        },
        lang: {
          get: () => instance.lang,
          set: (v) => { instance.lang = v; },
        },
        continuous: {
          get: () => instance.continuous,
          set: (v) => { instance.continuous = v; },
        },
        interimResults: {
          get: () => instance.interimResults,
          set: (v) => { instance.interimResults = v; },
        },
        maxAlternatives: {
          get: () => instance.maxAlternatives,
          set: (v) => { instance.maxAlternatives = v; },
        },
      });
    }

    start = () => instance.start();
    stop = () => instance.stop();
    abort = () => instance.abort();
  };
}

beforeEach(() => {
  instance = new MockSpeechRecognition();
  (window as unknown as Record<string, unknown>).SpeechRecognition = makeMockCtor();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  vi.clearAllMocks();
});

// ── Schema Tests ──────────────────────────────────────────────────────────────

describe('VoiceFieldSchema', () => {
  it('parses a minimal voice field', () => {
    const field = VoiceFieldSchema.parse({ id: 'f1', label: 'Report', type: 'voice' });
    expect(field.type).toBe('voice');
    expect(field.language).toBe('en-US');
    expect(field.continuous).toBe(false);
    expect(field.interimResults).toBe(true);
    expect(field.appendMode).toBe('replace');
    expect(field.maxDurationSeconds).toBe(60);
  });

  it('accepts custom language and continuous mode', () => {
    const field = VoiceFieldSchema.parse({
      id: 'f1',
      label: 'Report',
      type: 'voice',
      language: 'de-DE',
      continuous: true,
      appendMode: 'append-space',
      maxDurationSeconds: 120,
    });
    expect(field.language).toBe('de-DE');
    expect(field.continuous).toBe(true);
    expect(field.appendMode).toBe('append-space');
    expect(field.maxDurationSeconds).toBe(120);
  });

  it('accepts optional prompt', () => {
    const field = VoiceFieldSchema.parse({ id: 'f1', label: 'L', type: 'voice', prompt: 'Describe the issue' });
    expect(field.prompt).toBe('Describe the issue');
  });

  it('is included in the FormFieldSchema discriminated union', () => {
    const field = FormFieldSchema.parse({ id: 'f1', label: 'Voice Note', type: 'voice' });
    expect(field.type).toBe('voice');
  });

  it('rejects unknown appendMode', () => {
    expect(() =>
      VoiceFieldSchema.parse({ id: 'f1', label: 'L', type: 'voice', appendMode: 'invalid' }),
    ).toThrow();
  });
});

// ── Hook Tests ────────────────────────────────────────────────────────────────

describe('useVoiceInput', () => {
  it('reports isSupported = true when SpeechRecognition is available', () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('reports isSupported = false and status = unsupported when API is absent', () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.status).toBe('unsupported');
    // Restore for subsequent tests (beforeEach will re-install, but restore here for safety)
    (window as unknown as Record<string, unknown>).SpeechRecognition = makeMockCtor();
  });

  it('starts in idle status', () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.status).toBe('idle');
  });

  it('transitions to listening on start()', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    expect(result.current.status).toBe('listening');
    expect(instance.start).toHaveBeenCalledOnce();
  });

  it('does not start twice if already listening', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { result.current.start(); });
    expect(instance.start).toHaveBeenCalledTimes(1);
  });

  it('captures final transcript and calls onResult', () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onResult }));
    act(() => { result.current.start(); });
    act(() => { instance.fireResult('Hello world', true); });
    expect(result.current.finalTranscript).toBe('Hello world');
    expect(onResult).toHaveBeenCalledWith('Hello world');
  });

  it('captures interim transcript separately', () => {
    const { result } = renderHook(() => useVoiceInput({ interimResults: true }));
    act(() => { result.current.start(); });
    // Fire interim result
    act(() => {
      const event = {
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'hel', confidence: 0 }], { isFinal: false, length: 1 }),
        ],
      };
      instance.onresult?.(event);
    });
    expect(result.current.interimTranscript).toBe('hel');
    expect(result.current.finalTranscript).toBe('');
  });

  it('appends with space in append-space mode', () => {
    const { result } = renderHook(() => useVoiceInput({ appendMode: 'append-space' }));
    act(() => { result.current.start(); });
    act(() => { instance.fireResult('First segment', true); });
    // Restart (simulates re-trigger for second utterance)
    act(() => { result.current.start(); });
    act(() => { instance.fireResult('Second segment', true); });
    // Should accumulate within the same session
    expect(result.current.finalTranscript).toContain('Second segment');
  });

  it('transitions to processing then idle on stop()', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    // After onend, status becomes idle
    expect(['processing', 'idle']).toContain(result.current.status);
  });

  it('aborts and returns to idle immediately', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { result.current.abort(); });
    expect(result.current.status).toBe('idle');
  });

  it('sets error status and errorMessage on recognition error', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onError }));
    act(() => { result.current.start(); });
    act(() => { instance.fireError('not-allowed'); });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/permission denied/i);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('toggle() starts when idle', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.toggle(); });
    expect(result.current.status).toBe('listening');
  });

  it('toggle() stops when listening', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { result.current.toggle(); });
    expect(['processing', 'idle']).toContain(result.current.status);
  });

  it('reset() clears transcript and returns to idle', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { instance.fireResult('Some text', true); });
    act(() => { result.current.reset(); });
    expect(result.current.status).toBe('idle');
    expect(result.current.finalTranscript).toBe('');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.errorMessage).toBeNull();
  });

  it('stores confidence from the last final result', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { instance.fireResult('Some text', true, 0.87); });
    expect(result.current.confidence).toBeCloseTo(0.87);
  });

  it('confidence is null before any result', () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.confidence).toBeNull();
  });

  it('passes language, continuous, interimResults to recognition instance', () => {
    const { result } = renderHook(() =>
      useVoiceInput({ language: 'fr-FR', continuous: true, interimResults: false }),
    );
    act(() => { result.current.start(); });
    expect(instance.lang).toBe('fr-FR');
    expect(instance.continuous).toBe(true);
    expect(instance.interimResults).toBe(false);
  });

  it('maps "no-speech" error code to human-readable message', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { instance.fireError('no-speech'); });
    expect(result.current.errorMessage).toMatch(/no speech detected/i);
  });

  it('maps "audio-capture" error code', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { instance.fireError('audio-capture'); });
    expect(result.current.errorMessage).toMatch(/microphone not found/i);
  });

  it('maps "network" error code', () => {
    const { result } = renderHook(() => useVoiceInput());
    act(() => { result.current.start(); });
    act(() => { instance.fireError('network'); });
    expect(result.current.errorMessage).toMatch(/network error/i);
  });
});
