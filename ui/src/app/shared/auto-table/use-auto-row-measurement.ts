import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Measured row heights below this threshold are treated as pathological
 * (collapsed/hidden rows mid-render) and ignored — consumers fall back to the
 * density-aware constant instead of blowing up the Auto page-size count.
 */
export const MIN_MEASURED_ROW_HEIGHT_PX = 24;

/**
 * Shared ResizeObserver measurement for Auto page-size (R3-P3 / Q2).
 *
 * Observes a table-wrapper element and exposes the height available for table
 * ROWS (wrapper height minus the optional header element) plus the height of the
 * first REAL body row. Consumers derive their page size from these via
 * `computeAutoPageSize` — passing the measured row height (when available)
 * instead of the fixed fallback constant prevents undercounting when real rows
 * are shorter than `TABLE_ROW_HEIGHT_PX`. Must be called within an injection
 * context; the observer is disconnected on destroy.
 *
 * ```ts
 * const measurement = useAutoRowMeasurement();
 * effect(() => measurement.observe(this.tableWrapRef()?.nativeElement, 'thead'));
 * ```
 */
export function useAutoRowMeasurement(): {
  availableRowsHeight: ReturnType<typeof signal<number>>;
  measuredRowHeight: ReturnType<typeof signal<number>>;
  observe: (el: HTMLElement | null | undefined, headerSelector?: string) => void;
} {
  const destroyRef = inject(DestroyRef);
  const availableRowsHeight = signal(0);
  /** Height of the first real body row (0 = no valid measurement yet). */
  const measuredRowHeight = signal(0);
  let observer: ResizeObserver | null = null;
  let observedRow: Element | null = null;

  function observe(el: HTMLElement | null | undefined, headerSelector?: string): void {
    if (!el || typeof ResizeObserver === 'undefined') return;

    observer?.disconnect();
    observedRow = null;

    const measure = (entry?: ResizeObserverEntry): void => {
      // Prefer the observed contentRect — but only when it belongs to the wrapper;
      // row-element ticks carry the ROW's rect, which must not be read as the
      // wrapper height.
      const wrapperHeight = Math.round(
        entry && (!entry.target || entry.target === el) ? entry.contentRect.height : el.getBoundingClientRect().height,
      );
      const head = headerSelector ? el.querySelector(headerSelector) : null;
      const headHeight = head ? Math.round(head.getBoundingClientRect().height) : 0;

      availableRowsHeight.set(Math.max(0, wrapperHeight - headHeight));

      // Measure the first REAL body row (spacer/empty-state rows are aria-hidden).
      // Heights below the sanity threshold are ignored → signal stays 0 so
      // consumers fall back to the density constant.
      const row = el.querySelector('tbody tr:not([aria-hidden="true"])');
      const rowHeight = row ? Math.round(row.getBoundingClientRect().height) : 0;

      measuredRowHeight.set(rowHeight >= MIN_MEASURED_ROW_HEIGHT_PX ? rowHeight : 0);

      // Track the row element so a newly rendered or resized row re-triggers a
      // measurement even when the wrapper itself does not change size
      // (`observe()` always delivers an initial callback per spec).
      if (row !== observedRow) {
        if (observedRow) observer?.unobserve(observedRow);

        observedRow = row;

        if (row) observer?.observe(row);
      }
    };

    measure(); // synchronous first measurement — avoids an initial min-rows fetch

    observer = new ResizeObserver((entries) => measure(entries[0]));
    observer.observe(el);

    // The first pass ran before this observer existed — attach the tracked row now
    if (observedRow) observer.observe(observedRow);
  }

  destroyRef.onDestroy(() => observer?.disconnect());

  return { availableRowsHeight, measuredRowHeight, observe };
}
