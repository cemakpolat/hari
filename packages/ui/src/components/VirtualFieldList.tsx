// ─────────────────────────────────────────────────────────────────────────────
// VirtualFieldList — IntersectionObserver-based lazy-mount list for form fields.
//
// For sections that have many fields it is wasteful to mount every field on
// initial render.  VirtualFieldList renders a lightweight placeholder for each
// field that is not yet visible, and swaps it for the real field content once
// its placeholder scrolls into (or near) the viewport.  Once mounted a field
// stays mounted ("mount-once" semantics) so values, focus and validation state
// are never lost.
//
// The first `eagerCount` items are always mounted immediately so above-the-fold
// content appears without a flash.
//
// Activation threshold: virtualization only kicks in when the list has more
// than VIRTUALIZE_THRESHOLD items.  Smaller lists render normally to avoid any
// IntersectionObserver overhead.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';

/** Activate virtualization only for sections with more than this many fields. */
export const VIRTUALIZE_THRESHOLD = 15;

/** Number of items at the top of the list that are always eagerly rendered. */
const EAGER_COUNT = 5;

/** Root margin used for the IntersectionObserver — pre-loads items 300 px ahead. */
const ROOT_MARGIN = '300px';

interface VirtualFieldListProps<T> {
  /** The complete list of items to render. */
  items: T[];
  /**
   * Render function for a single mounted item.
   * Receives the item and its 0-based index.
   */
  renderItem: (item: T, index: number) => React.ReactNode;
  /**
   * Estimated height (in px) used for the placeholder while an item is not yet
   * mounted.  Defaults to 72 px (a typical single-field height).
   */
  estimatedItemHeight?: number;
  /** CSS class applied to each item wrapper div. */
  itemClassName?: string;
  /** CSS gap between items (passed to the container's `gap` style). */
  gap?: string;
  /** Grid template columns for multi-column layouts. */
  gridTemplateColumns?: string;
}

// ── Per-item lazy wrapper ─────────────────────────────────────────────────────

interface LazyItemProps {
  eager: boolean;
  estimatedHeight: number;
  children: React.ReactNode;
}

function LazyItem({ eager, estimatedHeight, children }: LazyItemProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(eager);

  useEffect(() => {
    if (eager || mounted) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, mounted]);

  if (mounted) {
    return <>{children}</>;
  }

  // Placeholder preserves the approximate layout height so the scrollbar
  // doesn't jump when fields are mounted as the user scrolls down.
  return (
    <div
      ref={sentinelRef}
      aria-hidden="true"
      style={{
        minHeight: estimatedHeight,
        borderRadius: '0.375rem',
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'hari-shimmer 1.4s infinite',
      }}
    />
  );
}

// ── Shimmer keyframe (injected once) ──────────────────────────────────────────

let shimmerInjected = false;
function ensureShimmerStyle() {
  if (shimmerInjected || typeof document === 'undefined') return;
  shimmerInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes hari-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// ── Main component ────────────────────────────────────────────────────────────

export function VirtualFieldList<T>({
  items,
  renderItem,
  estimatedItemHeight = 72,
  gap = '1rem',
  gridTemplateColumns,
}: VirtualFieldListProps<T>) {
  // Inject shimmer keyframe on first use
  React.useEffect(() => { ensureShimmerStyle(); }, []);

  const isGrid = !!gridTemplateColumns;

  return (
    <div
      style={
        isGrid
          ? { display: 'grid', gridTemplateColumns, gap }
          : { display: 'flex', flexDirection: 'column', gap }
      }
    >
      {items.map((item, index) => (
        <LazyItem
          key={index}
          eager={index < EAGER_COUNT}
          estimatedHeight={estimatedItemHeight}
        >
          {renderItem(item, index)}
        </LazyItem>
      ))}
    </div>
  );
}
