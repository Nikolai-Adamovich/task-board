/**
 * Tests for the Pagination wrapper + vendored HlmNumberedPagination edge
 * behavior: Previous/Next stay rendered when showEdges is true (default) and
 * get the shadcn disabled pattern (pointer-events-none opacity-50) at the
 * first/last page; goToPrevious/goToNext early-return at the edges.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Pagination } from './pagination';

describe('Pagination', () => {
  function setup(inputs: Record<string, number | boolean> = {}) {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } }), Pagination],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(Pagination);

    // 5 pages of 10 items
    fixture.componentRef.setInput('total', 50);
    fixture.componentRef.setInput('pageSize', 10);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll('li[data-slot="pagination-item"]'));
    const pageChanges: number[] = [];

    fixture.componentInstance.pageChange.subscribe((p) => pageChanges.push(p));

    return { fixture, el, items, pageChanges };
  }

  it('renders both edge items on the first page, with Previous disabled', () => {
    const { items } = setup();

    expect(items.length).toBe(7); // Previous + 5 pages + Next
    expect(items[0].querySelector('ng-icon')).toBeTruthy(); // chevron-only edge buttons
    expect(items[0].classList.contains('pointer-events-none')).toBe(true);
    expect(items[0].classList.contains('opacity-50')).toBe(true);
    expect(items[items.length - 1].classList.contains('pointer-events-none')).toBe(false);
    expect(items[items.length - 1].classList.contains('opacity-50')).toBe(false);
  });

  it('disables Next on the last page while Previous stays enabled', () => {
    const { items } = setup({ page: 5 });

    expect(items[0].classList.contains('pointer-events-none')).toBe(false);
    expect(items[items.length - 1].classList.contains('pointer-events-none')).toBe(true);
    expect(items[items.length - 1].classList.contains('opacity-50')).toBe(true);
  });

  it('enables both edges on a middle page', () => {
    const { items } = setup({ page: 3 });

    expect(items[0].classList.contains('pointer-events-none')).toBe(false);
    expect(items[items.length - 1].classList.contains('pointer-events-none')).toBe(false);
  });

  it('does not emit pageChange when clicking a disabled edge, and emits when clicking an enabled one', () => {
    const { items, pageChanges } = setup({ page: 1 });

    (items[0] as HTMLElement).click(); // disabled Previous — guarded
    expect(pageChanges).toEqual([]);

    (items[items.length - 1] as HTMLElement).click(); // enabled Next
    expect(pageChanges).toEqual([2]);
  });

  it('hides the edge items entirely when showEdges is false', () => {
    const { items } = setup({ showEdges: false });

    expect(items.length).toBe(5); // page numbers only
    expect(items[0].querySelector('ng-icon')).toBeNull();
    expect(items[items.length - 1].querySelector('ng-icon')).toBeNull();
  });
});
