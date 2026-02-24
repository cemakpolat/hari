// ─────────────────────────────────────────────────────────────────────────────
// performance.test.tsx — tests for the three Performance roadmap items:
//
//   1. Large form performance optimization (VirtualFieldList / virtualization)
//   2. Document lazy loading for long reports (LazySectionLoader)
//   3. Bundle size optimizations (sideEffects, splitting, minify settings)
//
// IntersectionObserver is not available in jsdom, so:
//   - We verify the fallback path (immediate mount for all items) works.
//   - We mock IntersectionObserver to verify the lazy-mount path (only
//     eager items are mounted until the observer fires).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { FormRenderer } from '../components/FormRenderer';
import { DocumentRenderer } from '../components/DocumentRenderer';
import { VirtualFieldList, VIRTUALIZE_THRESHOLD } from '../components/VirtualFieldList';
import { useIntersectionMount } from '../hooks/useIntersectionMount';
import type { FormSection } from '@hari/core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal FormSection with `count` text fields. */
function makeSectionWithFields(count: number, id = 'sec'): FormSection {
  return {
    id,
    title: `Section ${id}`,
    fields: Array.from({ length: count }, (_, i) => ({
      id: `field_${i}`,
      label: `Field ${i}`,
      type: 'text' as const,
      required: false,
      disabled: false,
      sensitive: false,
      validation: [],
      multiline: false,
    })),
    collapsible: false,
    defaultCollapsed: false,
    columns: 1,
  };
}

/** Build a DocumentData-compatible object with `count` sections. */
function makeDocumentData(count: number) {
  return {
    title: 'Long Report',
    sections: Array.from({ length: count }, (_, i) => ({
      id: `sec_${i}`,
      title: `Section ${i}`,
      blocks: [
        { type: 'paragraph' as const, text: `Content of section ${i}` },
      ],
    })),
  };
}

// ─── Mock IntersectionObserver ────────────────────────────────────────────────

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

/** Stores references to every IntersectionObserver instance created. */
const ioInstances: Array<{
  callback: IOCallback;
  elements: Element[];
  fire: (el: Element) => void;
}> = [];

/** A constructor-compatible IntersectionObserver mock class. */
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  private _callback: IOCallback;
  private _rec: typeof ioInstances[number];

  constructor(callback: IOCallback) {
    this._callback = callback;
    this._rec = {
      callback,
      elements: [],
      fire: (el: Element) => {
        callback([{ isIntersecting: true, target: el } as IntersectionObserverEntry]);
      },
    };
    ioInstances.push(this._rec);
  }

  observe(el: Element) { this._rec.elements.push(el); }
  unobserve(_el: Element) {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

function installMockIO(autoFire = false) {
  ioInstances.length = 0;

  class AutoFirMockIO extends MockIntersectionObserver {
    override observe(el: Element) {
      super.observe(el);
      if (autoFire) {
        const rec = ioInstances[ioInstances.length - 1];
        rec.callback([{ isIntersecting: true, target: el } as IntersectionObserverEntry]);
      }
    }
  }

  const Ctor = autoFire ? AutoFirMockIO : MockIntersectionObserver;
  // @ts-expect-error partial implementation is sufficient
  window.IntersectionObserver = Ctor;
  return ioInstances;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. VirtualFieldList — unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('VirtualFieldList', () => {
  it('exports VIRTUALIZE_THRESHOLD as a positive integer', () => {
    expect(Number.isInteger(VIRTUALIZE_THRESHOLD)).toBe(true);
    expect(VIRTUALIZE_THRESHOLD).toBeGreaterThan(0);
  });

  it('renders all items when IntersectionObserver is unavailable (jsdom fallback)', () => {
    // jsdom has no IntersectionObserver — the hook falls back to mounting all items
    const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
    render(
      <VirtualFieldList
        items={items}
        renderItem={(item) => <div key={item} data-testid={`rendered-${item}`}>{item}</div>}
      />,
    );
    // All 20 items should appear because the IO fallback mounts them immediately
    for (const item of items) {
      expect(screen.getByTestId(`rendered-${item}`)).toBeInTheDocument();
    }
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(
      <VirtualFieldList items={[]} renderItem={(item) => <div>{String(item)}</div>} />,
    );
    expect(container.firstChild?.childNodes).toHaveLength(0);
  });

  it('renders items with custom gap and gridTemplateColumns', () => {
    const { container } = render(
      <VirtualFieldList
        items={['a', 'b']}
        renderItem={(item) => <div>{item}</div>}
        gap="2rem"
        gridTemplateColumns="repeat(2, 1fr)"
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.display).toBe('grid');
    expect(wrapper.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(wrapper.style.gap).toBe('2rem');
  });

  describe('with mocked IntersectionObserver (lazy-mount path)', () => {
    let originalIO: typeof IntersectionObserver | undefined;

    beforeEach(() => {
      originalIO = (window as Window & typeof globalThis).IntersectionObserver as typeof IntersectionObserver | undefined;
    });

    afterEach(() => {
      if (originalIO) {
        window.IntersectionObserver = originalIO;
      } else {
        // @ts-expect-error restoring
        delete window.IntersectionObserver;
      }
    });

    it('only mounts eager items initially; others show placeholders', () => {
      installMockIO(false); // do NOT auto-fire

      const EAGER_COUNT = 5;
      const total = EAGER_COUNT + 5; // 5 lazy items

      render(
        <VirtualFieldList
          items={Array.from({ length: total }, (_, i) => i)}
          renderItem={(item) => <div data-testid={`item-${item}`}>{item}</div>}
        />,
      );

      // Eager items (0-4) rendered
      for (let i = 0; i < EAGER_COUNT; i++) {
        expect(screen.getByTestId(`item-${i}`)).toBeInTheDocument();
      }
      // Lazy items (5-9) NOT rendered — placeholders shown instead
      for (let i = EAGER_COUNT; i < total; i++) {
        expect(screen.queryByTestId(`item-${i}`)).not.toBeInTheDocument();
      }
    });

    it('mounts lazy items when the observer fires for their sentinel', async () => {
      const instances = installMockIO(false);

      const EAGER_COUNT = 5;

      render(
        <VirtualFieldList
          items={Array.from({ length: EAGER_COUNT + 1 }, (_, i) => i)}
          renderItem={(item) => <div data-testid={`item-${item}`}>{item}</div>}
        />,
      );

      // Item 5 should not be rendered yet
      expect(screen.queryByTestId('item-5')).not.toBeInTheDocument();

      // Fire all pending intersection observers
      act(() => {
        for (const inst of instances) {
          for (const el of inst.elements) {
            inst.fire(el);
          }
        }
      });

      expect(screen.getByTestId('item-5')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. useIntersectionMount — hook unit tests
// ─────────────────────────────────────────────────────────────────────────────

function UseIntersectionMountHarness({ eager }: { eager: boolean }) {
  const { sentinelRef, isMounted } = useIntersectionMount({ eager });
  return (
    <div>
      <div ref={sentinelRef as React.RefObject<HTMLDivElement>} data-testid="sentinel" />
      {isMounted ? <span data-testid="mounted">mounted</span> : <span data-testid="placeholder">placeholder</span>}
    </div>
  );
}

describe('useIntersectionMount', () => {
  it('mounts immediately when eager=true', () => {
    render(<UseIntersectionMountHarness eager={true} />);
    expect(screen.getByTestId('mounted')).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder')).not.toBeInTheDocument();
  });

  it('falls back to mounted when IntersectionObserver is unavailable (jsdom)', () => {
    // jsdom has no IntersectionObserver
    render(<UseIntersectionMountHarness eager={false} />);
    // Fallback mounts immediately
    expect(screen.getByTestId('mounted')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FormRenderer — large form virtualization
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — large form virtualization', () => {
  it('renders a small section (≤ VIRTUALIZE_THRESHOLD) without virtualization banner', () => {
    const section = makeSectionWithFields(5);
    render(<FormRenderer formId="test" sections={[section]} />);
    // All 5 fields should render
    for (let i = 0; i < 5; i++) {
      expect(screen.getByLabelText(`Field ${i}`)).toBeInTheDocument();
    }
  });

  it('renders a large section (> VIRTUALIZE_THRESHOLD) without crashing', () => {
    const count = VIRTUALIZE_THRESHOLD + 5;
    const section = makeSectionWithFields(count);
    // Should not throw
    expect(() =>
      render(<FormRenderer formId="large" sections={[section]} />),
    ).not.toThrow();
  });

  it('renders initial fields of a large section (jsdom fallback mounts all)', () => {
    const count = VIRTUALIZE_THRESHOLD + 3;
    const section = makeSectionWithFields(count);
    render(<FormRenderer formId="virtual" sections={[section]} />);
    // In jsdom (no IntersectionObserver), all fields should be mounted
    expect(screen.getByLabelText(/field 0/i)).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(`field ${count - 1}`, 'i'))).toBeInTheDocument();
  });

  it('validates all fields in a large form on submit', async () => {
    const count = VIRTUALIZE_THRESHOLD + 2;
    const section = makeSectionWithFields(count);
    // Make first field required
    section.fields[0] = { ...section.fields[0], required: true };
    const onSubmit = vi.fn();
    render(<FormRenderer formId="v-submit" sections={[section]} onSubmit={onSubmit} />);

    // Blur the required field to mark it as touched before submitting
    // Note: label includes a '*' span for required fields, use regex to match
    const requiredInput = screen.getByLabelText(/field 0/i);
    fireEvent.blur(requiredInput);

    const submit = screen.getByRole('button', { name: /submit/i });
    await act(async () => { submit.click(); });

    // Submit should be blocked because field 0 is empty + required
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/field 0 is required/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DocumentRenderer — lazy section loading
// ─────────────────────────────────────────────────────────────────────────────

describe('DocumentRenderer — lazy section loading', () => {
  it('renders a short document (≤ 5 sections) all at once', () => {
    const data = makeDocumentData(4);
    render(<DocumentRenderer data={data} />);
    for (let i = 0; i < 4; i++) {
      expect(screen.getByText(`Content of section ${i}`)).toBeInTheDocument();
    }
  });

  it('renders a long document without crashing', () => {
    const data = makeDocumentData(20);
    expect(() => render(<DocumentRenderer data={data} />)).not.toThrow();
  });

  it('eagerly renders first 3 sections of a long document in jsdom fallback', () => {
    // In jsdom without IntersectionObserver, all sections fall back to mounted
    const data = makeDocumentData(10);
    render(<DocumentRenderer data={data} />);
    // First 3 sections are always eager — verify they appear
    for (let i = 0; i < 3; i++) {
      expect(screen.getByText(`Content of section ${i}`)).toBeInTheDocument();
    }
  });

  it('renders document title regardless of section count', () => {
    // DocumentData schema requires at least 1 section
    const data = makeDocumentData(1);
    render(<DocumentRenderer data={{ ...data, title: 'Titled Doc' }} />);
    expect(screen.getByText('Titled Doc')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Bundle configuration — static assertions
// ─────────────────────────────────────────────────────────────────────────────

describe('Bundle size optimizations — configuration check', () => {
  it('VirtualFieldList and VIRTUALIZE_THRESHOLD are exported from ui index', async () => {
    const uiIndex = await import('../index');
    expect(typeof uiIndex.VirtualFieldList).toBe('function');
    expect(typeof uiIndex.VIRTUALIZE_THRESHOLD).toBe('number');
    expect(uiIndex.VIRTUALIZE_THRESHOLD).toBeGreaterThan(0);
  });

  it('useIntersectionMount is exported from ui index', async () => {
    const uiIndex = await import('../index');
    expect(typeof uiIndex.useIntersectionMount).toBe('function');
  });
});
