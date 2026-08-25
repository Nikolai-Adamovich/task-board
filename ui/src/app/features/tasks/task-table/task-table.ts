import { Component, inject, input, computed, effect, viewChild, signal } from '@angular/core';
import { numberAttribute } from '@angular/core';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { ProjectRefStore, type SelectOption } from '@stores/project-ref-store';
import { getTenantId } from '@app/shared/utils/route-utils';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUp, lucideArrowDown, lucideFilter } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { TaskClient } from '@services/task-client';
import { Pagination } from '@app/shared/pagination/pagination';
import { FilterPanel } from '@features/filters/filter-panel/filter-panel';
import { CreateTaskDialog } from '@features/tasks/create-task-dialog/create-task-dialog';
import { AppliedFilterState } from '@features/filters/filter-panel/filter-panel';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import type { Task, TaskPriority, FilterCriteria, FilterSort } from '@task-board/shared';
import { taskTypeBadgeVariant, priorityBadgeVariant } from '@app/constants/priority';

interface TaskColumnDef {
  field: string;
  labelKey: string;
  filterType: 'none' | 'text' | 'select';
  width?: string;
  popoverWidth?: string;
  getFilterValue: () => string;
  setFilterValue?: (value: string) => void;
  getOptions?: () => SelectOption[];
  allLabelKey?: string;
  placeholder?: string;
  staticOptions?: { value: string; labelKey: string }[];
  itemToString?: (value: string) => string;
}

const COLUMN_COUNT = 11;

/** Case-insensitive name → id resolution against a loaded option list */
function resolveNameToId(name: string, options: SelectOption[]): string {
  if (!name) return '';
  // Already an id?
  if (options.some((o) => o.id === name)) return name;

  const lower = name.toLowerCase();
  const match = options.find((o) => o.name.toLowerCase() === lower);

  return match?.id ?? '';
}

@Component({
  selector: 'ui-task-table',
  imports: [
    DatePipe,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmInputImports,
    HlmBadgeImports,
    HlmSelectImports,
    HlmDialogImports,
    HlmCardImports,
    HlmTableImports,
    HlmPopoverImports,
    Pagination,
    FilterPanel,
    CreateTaskDialog,
  ],
  providers: [provideIcons({ lucideArrowUp, lucideArrowDown, lucideFilter })],
  templateUrl: './task-table.html',
})
export class TaskTable {
  private readonly taskClient = inject(TaskClient);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly refStore = inject(ProjectRefStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  // ─── Route & query params (bound automatically by withComponentInputBinding) ──
  readonly projectKey = input.required<string>();
  /** Raw URL values — human-readable names or ids */
  readonly search = input('');
  readonly page = input(1, { transform: numberAttribute });
  readonly limit = input(this.preferencesStore.pageSize(), { transform: numberAttribute });
  readonly priority = input('');
  readonly status = input('');
  readonly type = input('');
  readonly assignee = input('');
  readonly reporter = input('');
  readonly sprint = input('');
  readonly label = input('');
  /** `${field}:${direction}` */
  readonly sort = input('');
  // ─── Derived state ─────────────────────────────────────────────────────────
  /** Resolved project UUID from the store (available after guard loads project) */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  /** Template alias — the URL param is `limit`, the pagination component says `pageSize` */
  protected readonly pageSize = computed(() => this.limit() || this.preferencesStore.pageSize());
  /** Safe page number — falls back to 1 when the query param is absent */
  protected readonly safePage = computed(() => this.page() || 1);
  protected readonly sortField = computed(() => (this.sort() ?? '').split(':')[0] ?? '');
  protected readonly sortDirection = computed<'asc' | 'desc'>(() =>
    (this.sort() ?? '').split(':')[1] === 'asc' ? 'asc' : 'desc',
  );
  // Reference data (reactive — empty until loaded)
  protected readonly statusOptions = computed(() => this.refStore.options(this.projectId(), 'statuses'));
  protected readonly typeOptions = computed(() => this.refStore.options(this.projectId(), 'types'));
  protected readonly sprintOptions = computed(() => this.refStore.options(this.projectId(), 'sprints'));
  protected readonly labelOptions = computed(() => this.refStore.options(this.projectId(), 'labels'));
  protected readonly memberOptions = computed(() => this.refStore.options(this.projectId(), 'members'));
  protected readonly statusMap = computed(() => this.refStore.nameMap(this.projectId(), 'statuses'));
  protected readonly typeMap = computed(() => this.refStore.nameMap(this.projectId(), 'types'));
  protected readonly sprintMap = computed(() => this.refStore.nameMap(this.projectId(), 'sprints'));
  protected readonly labelMap = computed(() => this.refStore.nameMap(this.projectId(), 'labels'));
  protected readonly typeKeyMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};

    for (const option of this.typeOptions()) {
      if (option.key) map[option.id] = option.key;
    }
    return map;
  });
  /**
   * URL name/id → resolved id. Pure computeds: when reference data finishes
   * loading they recompute automatically — no polling needed.
   */
  private readonly filterStatus = computed(() => resolveNameToId(this.status(), this.statusOptions()));
  private readonly filterType = computed(() => resolveNameToId(this.type(), this.typeOptions()));
  private readonly filterAssignee = computed(() => resolveNameToId(this.assignee(), this.memberOptions()));
  private readonly filterReporter = computed(() => resolveNameToId(this.reporter(), this.memberOptions()));
  private readonly filterSprint = computed(() => resolveNameToId(this.sprint(), this.sprintOptions()));
  private readonly filterLabel = computed(() => resolveNameToId(this.label(), this.labelOptions()));
  /** Shared badge-variant helpers (see constants/priority.ts) */
  protected readonly taskTypeBadgeVariant = taskTypeBadgeVariant;
  protected readonly priorityBadgeVariant = priorityBadgeVariant;
  // ─── Data ──────────────────────────────────────────────────────────────────
  protected readonly tasks = signal<Task[]>([]);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);
  // ─── Column definitions for @for header rendering ──────────────────────────
  protected readonly taskColumns: TaskColumnDef[] = [
    {
      field: 'number',
      labelKey: 'taskTable.key',
      filterType: 'none',
      width: 'w-16',
      getFilterValue: () => '',
    },
    {
      field: 'title',
      labelKey: 'taskTable.titleCol',
      filterType: 'text',
      popoverWidth: 'w-56',
      getFilterValue: () => this.search(),
      setFilterValue: (v) => this.patchParams({ search: v || null }),
      placeholder: 'taskTable.searchPlaceholder',
    },
    {
      field: 'typeId',
      labelKey: 'taskTable.type',
      filterType: 'select',
      getFilterValue: () => this.filterType(),
      setFilterValue: (v) => this.onColumnFilterChange('type', v),
      getOptions: () => this.typeOptions(),
      allLabelKey: 'taskTable.allTypes',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'types', id),
    },
    {
      field: 'statusId',
      labelKey: 'taskTable.status',
      filterType: 'select',
      getFilterValue: () => this.filterStatus(),
      setFilterValue: (v) => this.onColumnFilterChange('status', v),
      getOptions: () => this.statusOptions(),
      allLabelKey: 'taskTable.allStatuses',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'statuses', id),
    },
    {
      field: 'priority',
      labelKey: 'taskTable.priority',
      filterType: 'select',
      getFilterValue: () => this.priority(),
      setFilterValue: (v) => this.onColumnFilterChange('priority', v),
      allLabelKey: 'taskTable.allPriorities',
      staticOptions: [
        { value: 'LOW', labelKey: 'priority.low' },
        { value: 'MEDIUM', labelKey: 'priority.medium' },
        { value: 'HIGH', labelKey: 'priority.high' },
        { value: 'CRITICAL', labelKey: 'priority.critical' },
      ],
    },
    {
      field: 'assigneeId',
      labelKey: 'taskTable.assignee',
      filterType: 'select',
      getFilterValue: () => this.filterAssignee(),
      setFilterValue: (v) => this.onColumnFilterChange('assignee', v),
      getOptions: () => this.memberOptions(),
      allLabelKey: 'taskTable.allAssignees',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'members', id),
    },
    {
      field: 'reporterId',
      labelKey: 'taskTable.reporter',
      filterType: 'select',
      getFilterValue: () => this.filterReporter(),
      setFilterValue: (v) => this.onColumnFilterChange('reporter', v),
      getOptions: () => this.memberOptions(),
      allLabelKey: 'taskTable.allReporters',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'members', id),
    },
    {
      field: 'sprintId',
      labelKey: 'taskTable.sprint',
      filterType: 'select',
      getFilterValue: () => this.filterSprint(),
      setFilterValue: (v) => this.onColumnFilterChange('sprint', v),
      getOptions: () => this.sprintOptions(),
      allLabelKey: 'taskTable.allSprints',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'sprints', id),
    },
    {
      field: 'labelIds',
      labelKey: 'taskTable.labels',
      filterType: 'none',
      getFilterValue: () => '',
    },
    {
      field: 'createdAt',
      labelKey: 'taskTable.created',
      filterType: 'none',
      getFilterValue: () => '',
    },
    {
      field: 'updatedAt',
      labelKey: 'taskTable.updated',
      filterType: 'none',
      getFilterValue: () => '',
    },
  ];
  protected readonly COLUMN_COUNT = COLUMN_COUNT;
  // ─── Dialogs ───────────────────────────────────────────────────────────────
  protected readonly showCreateDialog = signal(false);
  private readonly createTaskDialog = viewChild(CreateTaskDialog);
  protected readonly showFilterDialog = signal(false);
  protected readonly currentFilters = computed<FilterCriteria>(() => {
    const filters: FilterCriteria = {};

    if (this.filterStatus()) filters.statusIds = [this.filterStatus()];
    if (this.priority()) filters.priority = [this.priority() as TaskPriority];
    if (this.filterType()) filters.typeIds = [this.filterType()];
    if (this.filterAssignee()) filters.assigneeIds = [this.filterAssignee()];
    if (this.search()) filters.search = this.search();

    return filters;
  });
  protected readonly currentSort = computed<FilterSort>(() => ({
    field: this.sortField() || 'createdAt',
    direction: this.sortDirection(),
  }));
  /** Query sent to the API — recomputed whenever any URL param changes */
  private readonly taskQuery = computed(() => ({
    search: this.search() || undefined,
    statusId: this.filterStatus() || undefined,
    priority: this.priority() || undefined,
    typeId: this.filterType() || undefined,
    assigneeId: this.filterAssignee() || undefined,
    reporterId: this.filterReporter() || undefined,
    sprintId: this.filterSprint() || undefined,
    labelId: this.filterLabel() || undefined,
    sort: this.sortField() ? `${this.sortField()}:${this.sortDirection()}` : undefined,
    page: this.safePage(),
    limit: this.pageSize(),
  }));

  constructor() {
    // Load reference data whenever the project context becomes available
    effect(() => {
      this.refStore.ensure(this.projectId(), ['statuses', 'types', 'sprints', 'labels', 'members']);
    });

    // Reload tasks whenever the query changes (initial load included)
    effect(() => {
      const query = this.taskQuery();
      const pid = this.projectId();

      if (!pid) return;

      this.taskClient.list(pid, query).subscribe({
        next: (res) => {
          this.tasks.set(res.data);
          this.total.set(res.pagination.total);
          this.totalPages.set(res.pagination.totalPages);

          // Handle invalid page — move to nearest valid page
          if (res.pagination.totalPages > 0 && this.page() > res.pagination.totalPages) {
            this.patchParams({ page: res.pagination.totalPages });
          }
        },
        error: (err) => console.error('Failed to load tasks:', err),
      });
    });
  }

  // ─── URL sync ──────────────────────────────────────────────────────────────

  /** Merge params into the URL; null removes a param. Inputs update reactively. */
  private patchParams(params: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Convert an id to its human-readable name for URL storage */
  private idToName(kind: Parameters<ProjectRefStore['nameOf']>[1], id: string): string | null {
    return id ? this.refStore.nameOf(this.projectId(), kind, id) : null;
  }

  /** Sync all filter/sort/pagination state to URL query params */
  private syncToUrl(): void {
    this.patchParams({
      search: this.search() || null,
      page: this.page() > 1 ? this.page() : null,
      limit: this.limit(),
      priority: this.priority() || null,
      status: this.idToName('statuses', this.filterStatus()),
      type: this.idToName('types', this.filterType()),
      assignee: this.idToName('members', this.filterAssignee()),
      reporter: this.idToName('members', this.filterReporter()),
      sprint: this.idToName('sprints', this.filterSprint()),
      label: this.idToName('labels', this.filterLabel()),
      sort: this.sortField() ? `${this.sortField()}:${this.sortDirection()}` : null,
    });
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.patchParams({ search: value || null, page: null });
  }

  /** Toggle sort direction for a column. 3-state cycle: asc → desc → none. */
  protected toggleSort(field: string): void {
    let nextSort: string | null;

    if (this.sortField() === field && this.sortDirection() === 'asc') {
      nextSort = `${field}:desc`;
    } else if (this.sortField() === field) {
      nextSort = null; // was desc → clear sort entirely
    } else {
      nextSort = `${field}:asc`;
    }
    this.patchParams({ sort: nextSort, page: null });
  }

  /** Handle column filter changes from popover dropdowns/inputs */
  protected onColumnFilterChange(filterName: string, value: string): void {
    this.patchParams({ [filterName]: value || null, page: null });
  }

  protected onPageChange(newPage: number): void {
    this.patchParams({ page: newPage > 1 ? newPage : null });
  }

  protected onPageSizeChange(newSize: number): void {
    this.preferencesStore.setPageSize(newSize);
    this.patchParams({ limit: newSize, page: null });
  }

  protected goToTask(task: Task): void {
    const tenantId = getTenantId(this.route);
    // The table only renders under projects/:projectKey — prefer the route param
    // so the link is correct even before ProjectStore is hydrated.
    const projectKey =
      this.route.snapshot.paramMap.get('projectKey') ?? this.projectStore.activeProject()?.key ?? task.projectId;

    // Backend accepts KEY-NUMBER format for GET /tasks/:taskId
    this.router.navigate(['/tenants', tenantId, 'projects', projectKey, 'tasks', `${projectKey}-${task.number}`]);
  }

  // ─── Filter Panel Dialog ──────────────────────────────────────────────────

  protected onFilterDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showFilterDialog.set(false);
    }
  }

  protected onFilterApplied(state: AppliedFilterState): void {
    this.showFilterDialog.set(false);

    const criteria = state.filters;
    const params: Record<string, string | number | null> = {
      search: criteria.search ?? null,
      priority: criteria.priority?.[0] ?? null,
      status: this.idToName('statuses', criteria.statusIds?.[0] ?? ''),
      type: this.idToName('types', criteria.typeIds?.[0] ?? ''),
      assignee: this.idToName('members', criteria.assigneeIds?.[0] ?? ''),
      page: null,
    };

    // Apply sort from saved filter
    if (state.sort?.field) {
      params['sort'] = `${state.sort.field}:${state.sort.direction}`;
    }

    this.patchParams(params);
  }

  // ─── Create Task Dialog Handlers ──────────────────────────────────────────

  protected openCreateDialog(): void {
    this.showCreateDialog.set(true);
    this.createTaskDialog()?.resetForm();
  }

  protected onCreateDialogClosed(): void {
    this.showCreateDialog.set(false);
  }

  protected onTaskCreated(): void {
    this.showCreateDialog.set(false);
    this.syncToUrl(); // re-navigates with identical params → effect reloads tasks
  }
}
