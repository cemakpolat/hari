// ─────────────────────────────────────────────────────────────────────────────
// VoiceMicButton component tests
//
// Covers:
//   - Unsupported state: renders "Voice input unavailable" when Web Speech API
//     is absent from window
//   - Supported state: renders a mic button with correct aria attributes
//   - Prompt text shown in idle state
//   - Listening state: "Recording…" status when mic is active
//   - Disabled prop: button is disabled
//   - Size variants: sm / md / lg all render without crashing
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceMicButton } from '../components/VoiceMicButton';

// ─── helpers ──────────────────────────────────────────────────────────────────

function deleteSpeechRecognition() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).SpeechRecognition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).webkitSpeechRecognition;
}

function installMockRecognition() {
  class MockRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((e: SpeechRecognitionEvent) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SpeechRecognition = MockRecognition;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unsupported state
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceMicButton — unsupported browser', () => {
  beforeEach(deleteSpeechRecognition);

  it('renders "Voice input unavailable" when SpeechRecognition is absent', () => {
    render(<VoiceMicButton />);
    expect(screen.getByText('Voice input unavailable')).toBeDefined();
  });

  it('does not render the mic toggle button in unsupported state', () => {
    render(<VoiceMicButton />);
    expect(screen.queryByRole('button', { name: /voice input/i })).toBeNull();
  });

  it('renders the microphone icon (aria-hidden) in unsupported state', () => {
    const { container } = render(<VoiceMicButton />);
    const icon = container.querySelector('[aria-hidden]');
    expect(icon).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Supported state (idle)
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceMicButton — supported browser (idle)', () => {
  beforeEach(installMockRecognition);
  afterEach(deleteSpeechRecognition);

  it('renders a "Start voice input" button', () => {
    render(<VoiceMicButton />);
    expect(screen.getByRole('button', { name: 'Start voice input' })).toBeDefined();
  });

  it('button is not pressed in idle state', () => {
    render(<VoiceMicButton />);
    const btn = screen.getByRole('button', { name: 'Start voice input' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('button is not disabled by default', () => {
    render(<VoiceMicButton />);
    expect(screen.getByRole('button', { name: 'Start voice input' })).not.toHaveProperty('disabled', true);
  });

  it('renders prompt text in idle state when prompt is provided', () => {
    render(<VoiceMicButton prompt="Describe your symptoms" />);
    expect(screen.getByText('Describe your symptoms')).toBeDefined();
  });

  it('does not render prompt text when not provided', () => {
    render(<VoiceMicButton />);
    // No prompt text, but also no crash
    expect(screen.queryByText(/Describe/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Disabled state
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceMicButton — disabled', () => {
  beforeEach(installMockRecognition);
  afterEach(deleteSpeechRecognition);

  it('disables the mic button when disabled=true', () => {
    render(<VoiceMicButton disabled />);
    const btn = screen.getByRole('button', { name: /voice input/i });
    expect(btn).toHaveProperty('disabled', true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Size variants
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceMicButton — size variants', () => {
  beforeEach(installMockRecognition);
  afterEach(deleteSpeechRecognition);

  it.each(['sm', 'md', 'lg'] as const)('renders without crashing at size=%s', (size) => {
    render(<VoiceMicButton size={size} />);
    expect(screen.getByRole('button', { name: /voice input/i })).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Listening state
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceMicButton — listening state', () => {
  beforeEach(installMockRecognition);
  afterEach(deleteSpeechRecognition);

  it('shows "Recording…" status text when mic button is clicked', () => {
    render(<VoiceMicButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    expect(screen.getByText('● Recording…')).toBeDefined();
  });

  it('changes aria-label to "Stop recording" while listening', () => {
    render(<VoiceMicButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeDefined();
  });

  it('sets aria-pressed=true while listening', () => {
    render(<VoiceMicButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    const btn = screen.getByRole('button', { name: 'Stop recording' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not show prompt text while recording', () => {
    render(<VoiceMicButton prompt="Say something" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    // Prompt is hidden while listening
    expect(screen.queryByText('Say something')).toBeNull();
  });
});
