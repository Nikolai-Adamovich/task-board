import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';

/**
 * Infinite-scroll sentinel for one board column.
 *
 * The host element sits at the bottom of the column scroll container (its
 * scroll root). When it comes within the prefetch margin below the viewport
 * the column loads its next page. Binding `disabled` while the column is
 * exhausted or loading deactivates the sentinel — an exhausted column must
 * never re-trigger requests.
 */
@Directive({
  selector: '[uiBoardSentinel]',
})
export class BoardSentinel implements OnInit, OnDestroy {
  /** When true the sentinel never fires (exhausted column or active load). */
  readonly disabled = input(false);
  /** Emitted when the sentinel enters the prefetch margin. */
  readonly nearBottom = output();
  private readonly element = inject(ElementRef);
  private observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    const target = this.element.nativeElement as HTMLElement;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (!this.disabled() && entries.some((entry) => entry.isIntersecting)) {
          this.nearBottom.emit();
        }
      },
      // Prefetch starts while the sentinel is still ~800px below the fold.
      { root: target.parentElement, rootMargin: '0px 0px 800px 0px', threshold: 0 },
    );
    this.observer.observe(target);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
