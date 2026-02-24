// ─────────────────────────────────────────────────────────────────────────────
// VoiceMicButton — self-contained mic button + transcript display.
//
// Wraps useVoiceInput; handles visual state machine, interim transcript,
// confidence indicator, error banner, and auto-stop timer.
//
// Usage:
//   <VoiceMicButton
//     language="en-US"
//     onTranscript={(t) => setValue(t)}
//     appendMode="append-space"
//     prompt="Describe the issue in detail"
//   />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { UseVoiceInputOptions } from '../hooks/useVoiceInput';

export interface VoiceMicButtonProps
  extends Omit<UseVoiceInputOptions, 'onResult' | 'onEnd' | 'onError'> {
  /** Called with the final transcript text after each utterance. */
  onTranscript?: (transcript: string) => void;
  /** Maximum recording time in seconds before auto-stop. @default 60 */
  maxDurationSeconds?: number;
  /** Hint text shown below the button. */
  prompt?: string;
  disabled?: boolean;
  /** Size variant. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Extra style on the wrapper element. */
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  sm: { btn: '2rem', icon: '1rem', font: '0.7rem' },
  md: { btn: '2.5rem', icon: '1.25rem', font: '0.75rem' },
  lg: { btn: '3rem', icon: '1.5rem', font: '0.8rem' },
};

export function VoiceMicButton({
  language = 'en-US',
  continuous = false,
  interimResults = true,
  maxAlternatives = 1,
  appendMode = 'replace',
  onTranscript,
  maxDurationSeconds = 60,
  prompt,
  disabled = false,
  size = 'md',
  style,
}: VoiceMicButtonProps) {
  const voice = useVoiceInput({
    language,
    continuous,
    interimResults,
    maxAlternatives,
    appendMode,
    onResult: onTranscript,
  });

  const sz = SIZE_MAP[size];

  // Auto-stop timer
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (voice.status === 'listening') {
      autoStopRef.current = setTimeout(voice.stop, maxDurationSeconds * 1000);
    } else {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    }
    return () => { if (autoStopRef.current) clearTimeout(autoStopRef.current); };
  }, [voice.status, voice.stop, maxDurationSeconds]);

  if (!voice.isSupported) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: sz.font,
          color: '#94a3b8',
          ...style,
        }}
      >
        <span
          title="Voice input is not supported by your browser"
          style={{ fontSize: sz.icon, opacity: 0.4 }}
          aria-hidden
        >
          🎤
        </span>
        <span>Voice input unavailable</span>
      </div>
    );
  }

  const isListening = voice.status === 'listening';
  const isProcessing = voice.status === 'processing';
  const isError = voice.status === 'error';
  const isBusy = isListening || isProcessing;

  const btnColor = isError
    ? '#ef4444'
    : isListening
      ? '#dc2626'
      : isProcessing
        ? '#f59e0b'
        : '#4f46e5';

  const btnBg = isError
    ? '#fef2f2'
    : isListening
      ? '#fee2e2'
      : isProcessing
        ? '#fefce8'
        : '#eff6ff';

  const btnBorder = isListening ? '#fca5a5' : isProcessing ? '#fcd34d' : '#c7d2fe';

  const ariaLabel = isListening
    ? 'Stop recording'
    : isProcessing
      ? 'Processing speech…'
      : 'Start voice input';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {/* Mic button */}
        <button
          type="button"
          onClick={voice.toggle}
          disabled={disabled || isProcessing}
          aria-label={ariaLabel}
          aria-pressed={isListening}
          style={{
            width: sz.btn,
            height: sz.btn,
            borderRadius: '50%',
            border: `2px solid ${btnBorder}`,
            backgroundColor: btnBg,
            color: btnColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: sz.icon,
            cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.2s',
            flexShrink: 0,
            boxShadow: isListening ? `0 0 0 3px ${btnColor}33` : 'none',
            animation: isListening ? 'hari-mic-pulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {isProcessing ? '⏳' : isBusy ? '⏹' : '🎤'}
        </button>

        {/* Status text */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {isListening && (
            <span
              role="status"
              aria-live="polite"
              style={{ fontSize: sz.font, color: '#dc2626', fontWeight: 600 }}
            >
              ● Recording…
            </span>
          )}
          {isProcessing && (
            <span role="status" style={{ fontSize: sz.font, color: '#d97706', fontWeight: 600 }}>
              Processing…
            </span>
          )}
          {!isBusy && !isError && voice.finalTranscript && (
            <span style={{ fontSize: sz.font, color: '#16a34a', fontWeight: 500 }}>
              ✓ Captured
              {voice.confidence !== null && (
                <span style={{ color: '#6b7280', fontWeight: 400 }}>
                  {' '}({Math.round(voice.confidence * 100)}% confidence)
                </span>
              )}
            </span>
          )}
          {!isBusy && !isError && !voice.finalTranscript && prompt && (
            <span style={{ fontSize: sz.font, color: '#64748b' }}>{prompt}</span>
          )}

          {/* Interim transcript */}
          {voice.interimTranscript && (
            <span
              aria-live="polite"
              style={{
                fontSize: sz.font,
                color: '#475569',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '240px',
              }}
            >
              {voice.interimTranscript}…
            </span>
          )}
        </div>

        {/* Reset button — only when there's a transcript or error */}
        {(voice.finalTranscript || isError) && !isBusy && (
          <button
            type="button"
            onClick={voice.reset}
            aria-label="Clear voice transcript"
            style={{
              fontSize: '0.65rem',
              padding: '0.2rem 0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.25rem',
              backgroundColor: 'white',
              color: '#64748b',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Error message */}
      {isError && voice.errorMessage && (
        <div
          role="alert"
          style={{
            fontSize: sz.font,
            color: '#dc2626',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '0.25rem',
            padding: '0.25rem 0.5rem',
          }}
        >
          {voice.errorMessage}
        </div>
      )}

      <MicPulseStyle />
    </div>
  );
}

// Inject pulse keyframe once
let _micStyleInjected = false;
function MicPulseStyle() {
  if (_micStyleInjected || typeof document === 'undefined') return null;
  _micStyleInjected = true;
  return (
    <style>{`
      @keyframes hari-mic-pulse {
        0%, 100% { box-shadow: 0 0 0 0px rgba(220,38,38,0.4); }
        50%       { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .hari-mic-btn { animation: none !important; }
      }
    `}</style>
  );
}
