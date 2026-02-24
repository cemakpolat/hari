// ─────────────────────────────────────────────────────────────────────────────
// useVoiceInput — React hook that wraps the Web Speech API (SpeechRecognition).
//
// Features:
//   - Auto-typed status machine: idle → listening → processing → idle
//   - Exposes both interim transcripts (for live preview) and the final result
//   - Configurable language, continuous mode, max alternatives
//   - Graceful degradation when SpeechRecognition is unavailable (SSR, Firefox)
//   - Full cleanup on unmount to prevent memory leaks / lingering sessions
//   - onResult callback for driving external field state
//
// Usage:
//   const voice = useVoiceInput({ language: 'en-US', onResult: (t) => setValue(t) });
//   <button onClick={voice.toggle} disabled={!voice.isSupported}>🎤</button>
//   {voice.interimTranscript && <p>{voice.interimTranscript}</p>}
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
// Speech Recognition types are declared in ../speech-recognition.d.ts

export type VoiceInputStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

export type VoiceInputAppendMode = 'replace' | 'append' | 'append-space';

export interface UseVoiceInputOptions {
  /**
   * BCP-47 language tag for recognition.
   * @default 'en-US'
   */
  language?: string;
  /**
   * Whether to keep the microphone open for multiple utterances.
   * @default false
   */
  continuous?: boolean;
  /**
   * Whether to fire result events during speech (not just at the end).
   * @default true
   */
  interimResults?: boolean;
  /**
   * Number of alternative transcripts to request from the engine.
   * @default 1
   */
  maxAlternatives?: number;
  /**
   * How the transcript is combined with an existing field value.
   * 'replace'       — overwrites the existing content
   * 'append'        — concatenates directly (no space)
   * 'append-space'  — concatenates with a leading space
   * @default 'replace'
   */
  appendMode?: VoiceInputAppendMode;
  /**
   * Callback invoked with the **final** transcript after each utterance.
   * Receives the raw transcript string; handle state updates here.
   */
  onResult?: (transcript: string) => void;
  /**
   * Optional callback when recognition stops (voluntarily or on error).
   */
  onEnd?: () => void;
  /**
   * Optional callback when a SpeechRecognitionError occurs.
   */
  onError?: (error: SpeechRecognitionErrorEvent) => void;
}

export interface UseVoiceInputResult {
  /** Whether the browser supports SpeechRecognition at all. */
  isSupported: boolean;
  /** Current state of the voice session. */
  status: VoiceInputStatus;
  /** Live interim transcript (updated while the user speaks). */
  interimTranscript: string;
  /** Consolidated final transcript of the whole session. */
  finalTranscript: string;
  /** Human-readable error message, set when status === 'error'. */
  errorMessage: string | null;
  /** Confidence [0–1] of the last final result (if provided by the engine). */
  confidence: number | null;
  /** Start listening. No-op if already listening or unsupported. */
  start: () => void;
  /** Stop listening gracefully (processes buffered audio). */
  stop: () => void;
  /** Abort immediately (discards buffered audio). */
  abort: () => void;
  /** Toggle between start and stop — convenient for a single mic button. */
  toggle: () => void;
  /** Reset transcript and error state back to idle. */
  reset: () => void;
}

// ── Implementation ─────────────────────────────────────────────────────────────

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
    appendMode = 'replace',
    onResult,
    onEnd,
    onError,
  } = options;

  // ── Detect API availability (once, outside state) ──────────────────────────
  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [status, setStatus] = useState<VoiceInputStatus>(
    isSupported ? 'idle' : 'unsupported',
  );
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Keep a stable ref to the recognition instance
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Allow callbacks to close over latest values without causing effect re-runs
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onEndRef.current = onEnd;
  onErrorRef.current = onError;

  // Accumulated final text across multiple recognition results in one session
  const sessionTextRef = useRef('');

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  // ── Create (or recreate) the recognition instance ──────────────────────────
  const buildRecognition = useCallback((): SpeechRecognition | null => {
    if (!isSupported) return null;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const rec = new Ctor();
    rec.lang = language;
    rec.continuous = continuous;
    rec.interimResults = interimResults;
    rec.maxAlternatives = maxAlternatives;

    rec.onstart = () => {
      setStatus('listening');
      setErrorMessage(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let newFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          newFinal += text;
          setConfidence(result[0].confidence ?? null);
        } else {
          interim += text;
        }
      }

      if (interim) setInterimTranscript(interim);

      if (newFinal) {
        const separator =
          appendMode === 'append-space'
            ? ' '
            : appendMode === 'append'
              ? ''
              : null; // replace

        let combined: string;
        if (separator !== null && sessionTextRef.current) {
          combined = sessionTextRef.current + separator + newFinal;
        } else {
          combined = newFinal;
        }

        sessionTextRef.current = combined;
        setFinalTranscript(combined);
        setInterimTranscript('');
        onResultRef.current?.(combined);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg = mapErrorCode(event.error);
      setStatus('error');
      setErrorMessage(msg);
      setInterimTranscript('');
      onErrorRef.current?.(event);
    };

    rec.onend = () => {
      // Only transition to idle if we didn't land in 'error'
      setStatus((prev) => (prev === 'error' ? prev : 'idle'));
      setInterimTranscript('');
      onEndRef.current?.();
    };

    return rec;
  }, [isSupported, language, continuous, interimResults, maxAlternatives, appendMode]);

  // ── Public API ──────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (!isSupported || status === 'listening') return;
    sessionTextRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
    setConfidence(null);

    // Abort any lingering instance before creating a new one
    recognitionRef.current?.abort();
    const rec = buildRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.start();
    setStatus('listening');
  }, [isSupported, status, buildRecognition]);

  const stop = useCallback(() => {
    if (status !== 'listening') return;
    setStatus('processing');
    recognitionRef.current?.stop();
  }, [status]);

  const abort = useCallback(() => {
    recognitionRef.current?.abort();
    setStatus('idle');
    setInterimTranscript('');
  }, []);

  const toggle = useCallback(() => {
    if (status === 'listening') {
      stop();
    } else {
      start();
    }
  }, [status, start, stop]);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    sessionTextRef.current = '';
    setStatus(isSupported ? 'idle' : 'unsupported');
    setInterimTranscript('');
    setFinalTranscript('');
    setErrorMessage(null);
    setConfidence(null);
  }, [isSupported]);

  return {
    isSupported,
    status,
    interimTranscript,
    finalTranscript,
    errorMessage,
    confidence,
    start,
    stop,
    abort,
    toggle,
    reset,
  };
}

// ── Error code mapping ─────────────────────────────────────────────────────────

function mapErrorCode(code: string): string {
  switch (code) {
    case 'no-speech':
      return 'No speech detected. Please try again.';
    case 'audio-capture':
      return 'Microphone not found or not accessible.';
    case 'not-allowed':
      return 'Microphone permission denied. Please allow access in your browser settings.';
    case 'network':
      return 'Network error during recognition. Check your connection.';
    case 'aborted':
      return 'Recognition was aborted.';
    case 'service-not-allowed':
      return 'Speech recognition service is not allowed in this context.';
    case 'bad-grammar':
      return 'Speech grammar could not be compiled.';
    case 'language-not-supported':
      return 'The selected language is not supported by your browser.';
    default:
      return `Recognition error: ${code}`;
  }
}
