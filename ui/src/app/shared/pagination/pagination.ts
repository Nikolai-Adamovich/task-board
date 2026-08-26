import { Component, booleanAttribute, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmNumberedPagination } from '@spartan-ng/helm/pagination';

@Component({
  selector: 'ui-pagination',
  imports: [HlmNumberedPagination, TranslocoPipe],
  templateUrl: './pagination.html',
})
export class Pagination {
  readonly page = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly pageSize = input<number>(20);
  readonly total = input<number>(0);
  /** Available page-size options offered by the selector. */
  readonly pageSizes = input<number[]>([10, 20, 30, 50, 70, 100]);
  /** Whether first/last edge buttons are shown. */
  readonly showEdges = input<boolean>(true, { transform: booleanAttribute });
  /** Whether an "Auto" entry (viewport-derived size) is offered in the selector. */
  readonly autoEnabled = input<boolean>(false, { transform: booleanAttribute });
  /** Whether the Auto option is currently active. */
  readonly isAuto = input<boolean>(false, { transform: booleanAttribute });
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  /** Emitted when the user selects the Auto option. */
  readonly autoPageSizeChange = output();

  protected onCurrentPageChange(newPage: number): void {
    this.pageChange.emit(newPage);
  }

  protected onItemsPerPageChange(newSize: number): void {
    this.pageSizeChange.emit(newSize);
  }
}
