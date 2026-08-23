import { Component, input, output } from '@angular/core';
import { HlmNumberedPagination } from '@spartan-ng/helm/pagination';

@Component({
  selector: 'ui-pagination',
  imports: [HlmNumberedPagination],
  templateUrl: './pagination.html',
})
export class Pagination {
  readonly page = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly pageSize = input<number>(20);
  readonly total = input<number>(0);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected onCurrentPageChange(newPage: number): void {
    this.pageChange.emit(newPage);
  }

  protected onItemsPerPageChange(newSize: number): void {
    this.pageSizeChange.emit(newSize);
  }
}
