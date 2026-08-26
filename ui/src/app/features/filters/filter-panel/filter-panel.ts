import { Component, inject, input, output, signal, computed, effect, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FilterClient } from '@services/filter-client';
import { ProjectRefStore } from '@stores/project-ref-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { finalize } from 'rxjs';
import type { Filter, FilterCriteria, FilterSort, CreateFilter, TaskPriority } from '@task-board/shared';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';

export interface AppliedFilterState {
  filters: FilterCriteria;
  sort: FilterSort;
}

/** Single-value criteria keys editable through the panel's select fields */
type SingleFilterKey = 'statusIds' | 'typeIds' | 'assigneeIds' | 'reporterIds' | 'sprintIds' | 'labelIds';

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
    HlmNativeSelectImports,
  ],
  templateUrl: './filter-panel.html',
})
export class FilterPanel implements OnInit {
  private readonly notify = injectToasts();
  private readonly filterClient = inject(FilterClient);
  /** Per-project reference data for the filter-field option lists */
  private readonly refStore = inject(ProjectRefStore);
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
  // ─── V4-10: editable filter fields ──────────────────────────────────────────
  /** Reference-data option lists (reactive — empty until ProjectRefStore loads) */
  protected readonly statusOptions = computed(() => this.refStore.options(this.projectId(), 'statuses'));
  protected readonly typeOptions = computed(() => this.refStore.options(this.projectId(), 'types'));
  protected readonly memberOptions = computed(() => this.refStore.options(this.projectId(), 'members'));
  protected readonly sprintOptions = computed(() => this.refStore.options(this.projectId(), 'sprints'));
  protected readonly labelOptions = computed(() => this.refStore.options(this.projectId(), 'labels'));
  protected readonly priorityOptions: { value: TaskPriority; labelKey: string }[] = [
    { value: 'LOW', labelKey: 'priority.low' },
    { value: 'MEDIUM', labelKey: 'priority.medium' },
    { value: 'HIGH', labelKey: 'priority.high' },
    { value: 'CRITICAL', labelKey: 'priority.critical' },
  ];
  /**
   * Working copy of the criteria edited by the panel's fields. Re-seeded from
   * `currentFilters` whenever the parent state changes (e.g. after apply/clear).
   */
  protected readonly draft = signal<FilterCriteria>({});

  constructor() {
    effect(() => this.refStore.ensure(this.projectId(), ['statuses', 'types', 'sprints', 'labels', 'members']));
    // Re-seed the draft when the parent's current filters change
    effect(() => this.draft.set({ ...this.currentFilters() }));
  }

  /** First id of a single-value criteria key (for select bindings) */
  protected firstOf(key: SingleFilterKey): string {
    return this.draft()[key]?.[0] ?? '';
  }

  /** Set (or clear, with `''`) a single-value criteria key */
  protected setSingle(key: SingleFilterKey, id: string): void {
    this.draft.update((f) => ({ ...f, [key]: id ? [id] : undefined }));
  }

  protected onDraftSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();

    this.draft.update((f) => ({ ...f, search: value || undefined }));
  }

  protected onDraftPriority(value: string): void {
    this.draft.update((f) => ({ ...f, priority: value ? [value as TaskPriority] : undefined }));
  }

  /** Emit the edited criteria — the parent maps them onto its URL params */
  protected applyDraft(): void {
    this.filterApplied.emit({ filters: this.draft(), sort: this.currentSort() });
  }

  /** Reset every field and emit the cleared state */
  protected clearDraft(): void {
    this.draft.set({});
    this.applyDraft();
  }
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
