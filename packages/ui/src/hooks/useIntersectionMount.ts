// ─────────────────────────────────────────────────────────────────────────────
// useIntersectionMount — mount content lazily when its sentinel enters the viewport.
//
// Usage (list virtualization):
//   const { isMounted, sentinelRef } = useIntersectionMount({ rootMargin: '300px' });
//
// The element referenced by `sentinelRef` is observed with IntersectionObserver.
// Once it intersects (with optional rootMargin for pre-loading), `isMounted`
// flips to true and stays true permanently (mount-once semantics).
//
// This hook is the backbone of:
//   - VirtualFieldList  (FormRenderer — large forms)
//   - LazySectionLoader (DocumentRenderer — long reports)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

export interface UseIntersectionMountOptions {
  /**
   * Expand the intersection root by this margin so content is mounted slightly
   * before it enters the visible viewport.  Defaults to '400px'.
   */
  rootMargin?: string;
  /** Intersection ratio threshold. Defaults to 0. */
  threshold?: number;
  /**
   * When true the element is considered mounted immediately — useful for
   * above-the-fold content that should always render eagerly.
   */
  eager?: boolean;
}

export interface UseIntersectionMountResult<T extends Element = HTMLDivElement> {
  /** Ref to attach to the sentinel / container element. */
  sentinelRef: React.RefObject<T>;
  /** True once the element has intersected (and permanently afterwards). */
  isMounted: boolean;
}

export function useIntersectionMount<T extends Element = HTMLDivElement>({
  rootMargin = '400px',
  threshold = 0,
  eager = false,
}: UseIntersectionMountOptions = {}): UseIntersectionMountResult<T> {
  const sentinelRef = useRef<T>(null);
  const [isMounted, setIsMounted] = useState(eager);

  useEffect(() => {
    if (eager) return; // already mounted — nothing to observe
    if (typeof IntersectionObserver === 'undefined') {
      // SSR / test environment without IntersectionObserver — mount everything
      setIsMounted(true);
      return;
    }

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsMounted(true);
          observer.disconnect(); // mount-once — stop observing after first intersection
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  // rootMargin and threshold are intentionally excluded — they are static options
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eager]);

  return { sentinelRef, isMounted };
}
