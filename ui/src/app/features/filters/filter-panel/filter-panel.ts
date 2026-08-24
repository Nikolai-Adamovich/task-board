import { Component, inject, input, output, signal, computed, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FilterClient } from '@services/filter-client';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { finalize } from 'rxjs';
import type { Filter, FilterCriteria, FilterSort, CreateFilter } from '@task-board/shared';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';

export interface AppliedFilterState {
  filters: FilterCriteria;
  sort: FilterSort;
}

@Component({
  selector: 'ui-filter-panel',
  imports: [
    ConfirmDialog,
    HlmAlertImports,
    TranslocoPipe,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmCardImports,
    HlmInputImports,
    HlmDialogImports,
    HlmFieldImports,
  ],
  templateUrl: './filter-panel.html',
})
export class FilterPanel implements OnInit {
  private readonly notify = injectToasts();
  private readonly filterClient = inject(FilterClient);
  /** Project ID to load filters for */
  readonly projectId = input.required<string>();
  /** Current filter criteria — passed in from the parent so we can save the current state */
  readonly currentFilters = input<FilterCriteria>({});
  /** Current sort — passed in from the parent */
  readonly currentSort = input<FilterSort>({ field: 'createdAt', direction: 'desc' });
  /** Emits when a saved filter is loaded — parent should apply both criteria and sort */
  readonly filterApplied = output<AppliedFilterState>();
  /** Whether the current filter/sort state has any active values */
  protected readonly hasActiveState = computed(() => {
    const f = this.currentFilters();
    const s = this.currentSort();
    const hasFilters = !!(
      f.search ||
      f.statusIds?.length ||
      f.priority?.length ||
      f.typeIds?.length ||
      f.assigneeIds?.length ||
      f.reporterIds?.length ||
      f.sprintIds?.length ||
      f.labelIds?.length
    );
    const hasSort = !!(s.field && s.field !== 'createdAt') || (s.field === 'createdAt' && s.direction !== 'desc');

    return hasFilters || hasSort;
  });
  protected readonly filters = signal<Filter[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  // Save form
  protected readonly filterName = signal('');
  protected readonly saving = signal(false);
  protected readonly showSaveForm = signal(false);
  // Delete confirmation
  protected readonly showDeleteConfirm = signal(false);
  protected readonly filterToDelete = signal<Filter | null>(null);

  ngOnInit(): void {
    this.loadFilters();
  }

  protected loadFilters(): void {
    this.loading.set(true);
    this.filterClient
      .list(this.projectId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.filters.set(data);
        },
        error: () => {
          this.error.set('filters.loadError');
        },
      });
  }

  protected saveFilter(): void {
    const name = this.filterName().trim();

    if (!name) return;

    const payload: CreateFilter = {
      name,
      filters: this.currentFilters(),
      sort: this.currentSort(),
    };

    this.saving.set(true);
    this.filterClient
      .create(this.projectId(), payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (filter) => {
          this.filters.update((list) => [...list, filter]);
          this.filterName.set('');
          this.showSaveForm.set(false);
          this.notify.success('toasts.created');
        },
        error: () => {
          this.error.set('filters.createError');
        },
      });
  }

  protected applyFilter(filter: Filter): void {
    this.filterApplied.emit({ filters: filter.filters, sort: filter.sort });
  }

  protected confirmDelete(filter: Filter): void {
    this.filterToDelete.set(filter);
    this.showDeleteConfirm.set(true);
  }

  protected onDeleteDialogStateChange(open: boolean): void {
    if (!open) {
      this.showDeleteConfirm.set(false);
      this.filterToDelete.set(null);
    }
  }

  protected deleteFilter(): void {
    const filter = this.filterToDelete();

    if (!filter) return;

    this.filterClient.delete(filter.id).subscribe({
      next: () => {
        this.filters.update((list) => list.filter((f) => f.id !== filter.id));
        this.showDeleteConfirm.set(false);
        this.filterToDelete.set(null);
        this.notify.success('toasts.deleted');
      },
      error: () => {
        this.error.set('filters.deleteError');
      },
    });
  }

  protected onFilterNameInput(event: Event): void {
    this.filterName.set((event.target as HTMLInputElement).value);
  }
}
