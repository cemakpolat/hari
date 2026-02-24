// ─────────────────────────────────────────────────────────────────────────────
// Focus management tests — WCAG 2.4.3 Focus Order
//
// Verifies that overlay/dialog/panel components:
//   1. Move focus INTO the overlay when it opens
//   2. RETURN focus to the triggering element when the overlay closes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { ExplainPanel } from '../components/ExplainPanel';
import { DocumentRenderer } from '../components/DocumentRenderer';
import type { ExplainabilityContext } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ExplainabilityContext fixture
// ─────────────────────────────────────────────────────────────────────────────

const EXPLAIN_CTX: ExplainabilityContext = {
  summary: 'Test summary',
  dataSources: [],
  assumptions: ['A is true'],
  confidenceRange: { low: 0.7, high: 0.9 },
  alternativesConsidered: [],
  whatIfQueries: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// ExplainPanel
// ─────────────────────────────────────────────────────────────────────────────

describe('ExplainPanel focus management', () => {
  it('moves focus to the close button when the panel mounts', () => {
    render(<ExplainPanel context={EXPLAIN_CTX} onClose={vi.fn()} />);
    const closeBtn = screen.getByRole('button', { name: 'Close explain panel' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('returns focus to the trigger element when the panel unmounts', () => {
    // Wrapper: trigger button conditionally shows the panel
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open panel</button>
          {open && (
            <ExplainPanel
              context={EXPLAIN_CTX}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      );
    }

    render(<Wrapper />);
    const trigger = screen.getByRole('button', { name: 'Open panel' });

    // Explicitly focus the trigger so ExplainPanel captures it on mount
    act(() => { trigger.focus(); });
    fireEvent.click(trigger);

    // Panel is open; close button should have focus
    const closeBtn = screen.getByRole('button', { name: 'Close explain panel' });
    expect(document.activeElement).toBe(closeBtn);

    // Close the panel — focus should return to the trigger
    act(() => { fireEvent.click(closeBtn); });
    expect(document.activeElement).toBe(trigger);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DocumentRenderer — ImageBlock lightbox
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_DOC_DATA = {
  title: 'Image test',
  sections: [
    {
      id: 's1',
      title: 'Section',
      collapsible: false,
      defaultCollapsed: false,
      blocks: [
        {
          type: 'image' as const,
          src: 'https://example.com/photo.jpg',
          alt: 'A photo',
          caption: 'Caption text',
        },
      ],
    },
  ],
};

describe('DocumentRenderer ImageBlock lightbox focus management', () => {
  it('img is keyboard-focusable (tabIndex=0)', () => {
    render(<DocumentRenderer data={IMAGE_DOC_DATA} density="operator" />);
    // The img should carry tabIndex=0 so it can receive focus
    const img = screen.getByRole('img', { name: /A photo/ }) as HTMLImageElement;
    expect(img.tabIndex).toBe(0);
  });

  it('moves focus to the close button when the lightbox opens', () => {
    render(<DocumentRenderer data={IMAGE_DOC_DATA} density="operator" />);
    const img = screen.getByRole('img', { name: /A photo/ });
    act(() => { img.focus(); });
    fireEvent.click(img);
    const closeBtn = screen.getByRole('button', { name: 'Close lightbox' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('returns focus to the img when the lightbox closes via close button', () => {
    render(<DocumentRenderer data={IMAGE_DOC_DATA} density="operator" />);
    const img = screen.getByRole('img', { name: /A photo/ });

    // Focus the img before opening so ExplainPanel captures it
    act(() => { img.focus(); });
    fireEvent.click(img);

    // Close the lightbox
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close lightbox' }));
    });
    expect(document.activeElement).toBe(img);
  });

  it('returns focus to the img when the lightbox closes via backdrop click', () => {
    const { container } = render(<DocumentRenderer data={IMAGE_DOC_DATA} density="operator" />);
    const img = screen.getByRole('img', { name: /A photo/ });

    act(() => { img.focus(); });
    fireEvent.click(img);

    // Click the backdrop (the outer fixed dialog div)
    const backdrop = container.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
    act(() => { fireEvent.click(backdrop); });
    expect(document.activeElement).toBe(img);
  });

  it('img responds to Enter key to open lightbox', () => {
    render(<DocumentRenderer data={IMAGE_DOC_DATA} density="operator" />);
    const img = screen.getByRole('img', { name: /A photo/ });
    act(() => { img.focus(); });
    fireEvent.keyDown(img, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Close lightbox' })).toBeDefined();
  });
});
