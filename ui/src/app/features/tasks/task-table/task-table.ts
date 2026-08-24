import { Component, inject, input, signal, computed, OnInit, OnDestroy, viewChild } from '@angular/core';
import { ProjectStore } from '@stores/project-store';
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
import { StatusClient } from '@services/status-client';
import { TaskTypeClient } from '@services/task-type-client';
import { SprintClient } from '@services/sprint-client';
import { LabelClient } from '@services/label-client';
import { ProjectClient } from '@services/project-client';
import { PreferencesStore } from '@stores/preferences-store';
import { Pagination } from '@app/shared/pagination/pagination';
import { FilterPanel } from '@features/filters/filter-panel/filter-panel';
import { CreateTaskDialog, SelectOption } from '@features/tasks/create-task-dialog/create-task-dialog';
import { AppliedFilterState } from '@features/filters/filter-panel/filter-panel';
import { Subscription } from 'rxjs';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import type { Task, TaskPriority, FilterCriteria, FilterSort } from '@task-board/shared';
import { taskTypeBadgeClass } from '@app/constants/priority';

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
export class TaskTable implements OnInit, OnDestroy {
  private readonly taskClient = inject(TaskClient);
  private readonly statusClient = inject(StatusClient);
  private readonly taskTypeClient = inject(TaskTypeClient);
  private readonly sprintClient = inject(SprintClient);
  private readonly labelClient = inject(LabelClient);
  private readonly projectClient = inject(ProjectClient);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private queryParamsSub?: Subscription;
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store (available after guard loads project) */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly tasks = signal<Task[]>([]);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(this.preferencesStore.pageSize());
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly statusMap = signal<Record<string, string>>({});
  protected readonly typeMap = signal<Record<string, string>>({});
  /** Task-type id → type key (task/bug/story), used for badge coloring */
  protected readonly typeKeyMap = signal<Record<string, string>>({});
  /** Shared badge-class helper (see constants/priority.ts) */
  protected readonly taskTypeBadgeClass = taskTypeBadgeClass;
  protected readonly sprintMap = signal<Record<string, string>>({});
  protected readonly labelMap = signal<Record<string, string>>({});
  /** Column-level filter signals synced with URL query params */
  protected readonly filterStatus = signal('');
  protected readonly filterPriority = signal('');
  protected readonly filterType = signal('');
  protected readonly filterAssignee = signal('');
  protected readonly filterReporter = signal('');
  protected readonly filterSprint = signal('');
  protected readonly filterLabel = signal('');
  /** Options for filter selects */
  protected readonly statusOptions = signal<SelectOption[]>([]);
  protected readonly typeOptions = signal<SelectOption[]>([]);
  protected readonly sprintOptions = signal<SelectOption[]>([]);
  protected readonly labelOptions = signal<SelectOption[]>([]);
  protected readonly memberOptions = signal<SelectOption[]>([]);
  /** Column definitions for @for header rendering */
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
      setFilterValue: (v) => {
        this.search.set(v);
        this.page.set(1);
        this.syncToUrl();
      },
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
      itemToString: (id: string) => this.typeOptions().find((o) => o.id === id)?.name ?? id,
    },
    {
      field: 'statusId',
      labelKey: 'taskTable.status',
      filterType: 'select',
      getFilterValue: () => this.filterStatus(),
      setFilterValue: (v) => this.onColumnFilterChange('status', v),
      getOptions: () => this.statusOptions(),
      allLabelKey: 'taskTable.allStatuses',
      itemToString: (id: string) => this.statusOptions().find((o) => o.id === id)?.name ?? id,
    },
    {
      field: 'priority',
      labelKey: 'taskTable.priority',
      filterType: 'select',
      getFilterValue: () => this.filterPriority(),
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
      itemToString: (id: string) => this.memberOptions().find((o) => o.id === id)?.name ?? id,
    },
    {
      field: 'reporterId',
      labelKey: 'taskTable.reporter',
      filterType: 'select',
      getFilterValue: () => this.filterReporter(),
      setFilterValue: (v) => this.onColumnFilterChange('reporter', v),
      getOptions: () => this.memberOptions(),
      allLabelKey: 'taskTable.allReporters',
      itemToString: (id: string) => this.memberOptions().find((o) => o.id === id)?.name ?? id,
    },
    {
      field: 'sprintId',
      labelKey: 'taskTable.sprint',
      filterType: 'select',
      getFilterValue: () => this.filterSprint(),
      setFilterValue: (v) => this.onColumnFilterChange('sprint', v),
      getOptions: () => this.sprintOptions(),
      allLabelKey: 'taskTable.allSprints',
      itemToString: (id: string) => this.sprintOptions().find((o) => o.id === id)?.name ?? id,
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
  /** Column sorting */
  protected readonly sortField = signal('');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');
  // ─── Create Task Dialog ────────────────────────────────────────────────────
  protected readonly showCreateDialog = signal(false);
  private readonly createTaskDialog = viewChild(CreateTaskDialog);
  // ─── Filter Panel Dialog ──────────────────────────────────────────────────
  protected readonly showFilterDialog = signal(false);
  protected readonly currentFilters = computed<FilterCriteria>(() => {
    const filters: FilterCriteria = {};

    if (this.filterStatus()) filters.statusIds = [this.filterStatus()];
    if (this.filterPriority()) filters.priority = [this.filterPriority() as TaskPriority];
    if (this.filterType()) filters.typeIds = [this.filterType()];
    if (this.filterAssignee()) filters.assigneeIds = [this.filterAssignee()];
    if (this.search()) filters.search = this.search();

    return filters;
  });
  protected readonly currentSort = computed<FilterSort>(() => ({
    field: this.sortField() || 'createdAt',
    direction: this.sortDirection(),
  }));

  protected onFilterDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showFilterDialog.set(false);
    }
  }

  protected onFilterApplied(state: AppliedFilterState): void {
    this.showFilterDialog.set(false);

    const criteria = state.filters;

    if (criteria.statusIds?.length) {
      this.filterStatus.set(criteria.statusIds[0]);
    } else {
      this.filterStatus.set('');
    }

    if (criteria.priority?.length) {
      this.filterPriority.set(criteria.priority[0]);
    } else {
      this.filterPriority.set('');
    }

    if (criteria.typeIds?.length) {
      this.filterType.set(criteria.typeIds[0]);
    } else {
      this.filterType.set('');
    }

    if (criteria.assigneeIds?.length) {
      this.filterAssignee.set(criteria.assigneeIds[0]);
    } else {
      this.filterAssignee.set('');
    }

    if (criteria.search) {
      this.search.set(criteria.search);
    } else {
      this.search.set('');
    }

    // Apply sort from saved filter
    if (state.sort?.field) {
      this.sortField.set(state.sort.field);
      this.sortDirection.set(state.sort.direction);
    }

    this.page.set(1);
    this.syncToUrl();
  }

  ngOnInit(): void {
    this.loadStatuses();
    this.loadTypes();
    this.loadSprints();
    this.loadLabels();
    this.loadMembers();

    // Sync URL query params → component state
    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      this.search.set(params['search'] ?? '');
      this.page.set(params['page'] ? +params['page'] : 1);
      this.pageSize.set(params['limit'] ? +params['limit'] : this.preferencesStore.pageSize());
      this.filterPriority.set(params['priority'] ?? '');

      const sortParam = params['sort'] ?? '';

      if (sortParam) {
        const [field, direction] = sortParam.split(':');

        this.sortField.set(field ?? '');
        this.sortDirection.set((direction === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc');
      } else {
        this.sortField.set('');
        this.sortDirection.set('desc');
      }

      // Resolve human-readable names → IDs after options are loaded
      this.resolveUrlFilters(params);

      this.loadTasks();
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.search.set(value);
    this.page.set(1);
    this.syncToUrl();
  }

  /** Toggle sort direction for a column. 3-state cycle: asc → desc → none. */
  protected toggleSort(field: string): void {
    if (this.sortField() === field) {
      if (this.sortDirection() === 'asc') {
        this.sortDirection.set('desc');
      } else {
        // Was desc → clear sort entirely
        this.sortField.set('');
        this.sortDirection.set('desc');
      }
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.page.set(1);
    this.syncToUrl();
  }

  /** Handle column filter changes from popover dropdowns/inputs */
  protected onColumnFilterChange(filterName: string, value: string): void {
    switch (filterName) {
      case 'status':
        this.filterStatus.set(value);
        break;

      case 'priority':
        this.filterPriority.set(value);
        break;

      case 'type':
        this.filterType.set(value);
        break;

      case 'assignee':
        this.filterAssignee.set(value);
        break;

      case 'reporter':
        this.filterReporter.set(value);
        break;

      case 'sprint':
        this.filterSprint.set(value);
        break;

      case 'label':
        this.filterLabel.set(value);
        break;
    }
    this.page.set(1);
    this.syncToUrl();
  }

  protected onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.syncToUrl();
  }

  protected onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.preferencesStore.setPageSize(newSize);
    this.page.set(1);
    this.syncToUrl();
  }

  protected goToTask(task: Task): void {
    const tenantId = this.getTenantId();
    const key = this.projectStore.activeProject()?.key ?? task.projectId;

    this.router.navigate(['/tenants', tenantId, 'projects', key, 'tasks', `${key}-${task.number}`]);
  }

  // ─── Create Task Dialog Handlers ──────────────────────────────────────────

  protected openCreateDialog(): void {
    this.showCreateDialog.set(true);
    // Reset form after view updates so the dialog child is available
    setTimeout(() => this.createTaskDialog()?.resetForm());
  }

  protected onCreateDialogClosed(): void {
    this.showCreateDialog.set(false);
  }

  protected onTaskCreated(): void {
    this.showCreateDialog.set(false);
    this.loadTasks();
  }

  /** Resolve human-readable filter names from URL back to IDs */
  private resolveUrlFilters(params: Record<string, string>): void {
    // These will be resolved once options are loaded (via separate subscriptions)
    // Store raw URL values first, then resolve when options arrive
    const urlStatus = params['status'] ?? '';
    const urlType = params['type'] ?? '';
    const urlAssignee = params['assignee'] ?? '';
    const urlReporter = params['reporter'] ?? '';
    const urlSprint = params['sprint'] ?? '';
    const urlLabel = params['label'] ?? '';

    // Try to resolve immediately (options may already be loaded from prior navigation)
    this.filterStatus.set(this.resolveNameToId(urlStatus, this.statusOptions()));
    this.filterType.set(this.resolveNameToId(urlType, this.typeOptions()));
    this.filterAssignee.set(this.resolveNameToId(urlAssignee, this.memberOptions()));
    this.filterReporter.set(this.resolveNameToId(urlReporter, this.memberOptions()));
    this.filterSprint.set(this.resolveNameToId(urlSprint, this.sprintOptions()));
    this.filterLabel.set(this.resolveNameToId(urlLabel, this.labelOptions()));

    // Also try to resolve after options load (for initial page load)
    if (urlStatus && !this.filterStatus()) {
      this.deferResolve('status', urlStatus);
    }
    if (urlType && !this.filterType()) {
      this.deferResolve('type', urlType);
    }
    if (urlAssignee && !this.filterAssignee()) {
      this.deferResolve('assignee', urlAssignee);
    }
    if (urlReporter && !this.filterReporter()) {
      this.deferResolve('reporter', urlReporter);
    }
    if (urlSprint && !this.filterSprint()) {
      this.deferResolve('sprint', urlSprint);
    }
    if (urlLabel && !this.filterLabel()) {
      this.deferResolve('label', urlLabel);
    }
  }

  /** Defer resolution of a URL filter name to ID until options are loaded */
  private deferResolve(filterName: string, urlValue: string): void {
    const checkAndResolve = (): boolean => {
      let options: SelectOption[] = [];
      let setter: ((id: string) => void) | null = null;

      switch (filterName) {
        case 'status':
          options = this.statusOptions();
          setter = (v) => this.filterStatus.set(v);
          break;

        case 'type':
          options = this.typeOptions();
          setter = (v) => this.filterType.set(v);
          break;

        case 'assignee':
          options = this.memberOptions();
          setter = (v) => this.filterAssignee.set(v);
          break;

        case 'reporter':
          options = this.memberOptions();
          setter = (v) => this.filterReporter.set(v);
          break;

        case 'sprint':
          options = this.sprintOptions();
          setter = (v) => this.filterSprint.set(v);
          break;

        case 'label':
          options = this.labelOptions();
          setter = (v) => this.filterLabel.set(v);
          break;
      }

      if (options.length > 0) {
        const resolved = this.resolveNameToId(urlValue, options);

        if (resolved && setter) {
          setter(resolved);
          return true;
        }
      }
      return false;
    };
    // Poll until options are loaded (max 5 seconds)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (checkAndResolve() || attempts > 50) {
        clearInterval(interval);
      }
    }, 100);
  }

  /** Resolve a human-readable name to an ID using options map */
  private resolveNameToId(name: string, options: SelectOption[]): string {
    if (!name) return '';
    // First check if it's already an ID (UUID format)
    if (options.some((o) => o.id === name)) return name;

    // Try case-insensitive name match
    const lower = name.toLowerCase();
    const match = options.find((o) => o.name.toLowerCase() === lower);

    return match?.id ?? '';
  }

  /** Get human-readable name for an ID using options */
  private idToName(id: string, options: SelectOption[]): string {
    if (!id) return '';

    const match = options.find((o) => o.id === id);

    return match?.name ?? id;
  }

  /** Sync all filter/sort/pagination state to URL query params (using human-readable names) */
  private syncToUrl(): void {
    const queryParams: Record<string, string | number | null> = {
      search: this.search() || null,
      page: this.page() > 1 ? this.page() : null,
      limit: this.pageSize(),
      priority: this.filterPriority() || null,
      // Store human-readable names instead of IDs
      status: this.filterStatus() ? this.idToName(this.filterStatus(), this.statusOptions()) : null,
      type: this.filterType() ? this.idToName(this.filterType(), this.typeOptions()) : null,
      assignee: this.filterAssignee() ? this.idToName(this.filterAssignee(), this.memberOptions()) : null,
      reporter: this.filterReporter() ? this.idToName(this.filterReporter(), this.memberOptions()) : null,
      sprint: this.filterSprint() ? this.idToName(this.filterSprint(), this.sprintOptions()) : null,
      label: this.filterLabel() ? this.idToName(this.filterLabel(), this.labelOptions()) : null,
      sort: this.sortField() ? `${this.sortField()}:${this.sortDirection()}` : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  private loadTasks(): void {
    this.taskClient
      .list(this.projectId(), {
        search: this.search() || undefined,
        statusId: this.filterStatus() || undefined,
        priority: this.filterPriority() || undefined,
        typeId: this.filterType() || undefined,
        assigneeId: this.filterAssignee() || undefined,
        reporterId: this.filterReporter() || undefined,
        sprintId: this.filterSprint() || undefined,
        labelId: this.filterLabel() || undefined,
        sort: this.sortField() ? `${this.sortField()}:${this.sortDirection()}` : undefined,
        page: this.page(),
        limit: this.pageSize(),
      })
      .subscribe({
        next: (res) => {
          this.tasks.set(res.data);
          this.total.set(res.pagination.total);
          this.totalPages.set(res.pagination.totalPages);

          // Handle invalid page — move to nearest valid page
          if (res.pagination.totalPages > 0 && this.page() > res.pagination.totalPages) {
            this.page.set(res.pagination.totalPages);
            this.syncToUrl();
          }
        },
      });
  }

  private loadStatuses(): void {
    this.statusClient.list(this.projectId()).subscribe({
      next: (statuses) => {
        const map: Record<string, string> = {};
        const opts: SelectOption[] = [];

        for (const s of statuses) {
          map[s.id] = s.name;
          opts.push({ id: s.id, name: s.name });
        }
        this.statusMap.set(map);
        this.statusOptions.set(opts);
      },
    });
  }

  private loadTypes(): void {
    this.taskTypeClient.list(this.projectId()).subscribe({
      next: (types) => {
        const map: Record<string, string> = {};
        const keyMap: Record<string, string> = {};
        const opts: SelectOption[] = [];

        for (const t of types) {
          map[t.id] = t.name;
          keyMap[t.id] = t.key;
          opts.push({ id: t.id, name: t.name });
        }
        this.typeMap.set(map);
        this.typeKeyMap.set(keyMap);
        this.typeOptions.set(opts);
      },
    });
  }

  private loadSprints(): void {
    this.sprintClient.list(this.projectId()).subscribe({
      next: (sprints) => {
        const map: Record<string, string> = {};
        const opts: SelectOption[] = [];

        for (const s of sprints) {
          map[s.id] = s.name;
          opts.push({ id: s.id, name: s.name });
        }
        this.sprintMap.set(map);
        this.sprintOptions.set(opts);
      },
    });
  }

  private loadLabels(): void {
    this.labelClient.list(this.projectId()).subscribe({
      next: (labels) => {
        const map: Record<string, string> = {};
        const opts: SelectOption[] = [];

        for (const l of labels) {
          map[l.id] = l.name;
          opts.push({ id: l.id, name: l.name });
        }
        this.labelMap.set(map);
        this.labelOptions.set(opts);
      },
    });
  }

  private loadMembers(): void {
    this.projectClient.listMembers(this.projectId()).subscribe({
      next: (members) =>
        this.memberOptions.set(members.map((m) => ({ id: m.userId, name: m.displayName ?? m.userId }))),
    });
  }

  private getTenantId(): string {
    const match = this.router.url.match(/\/tenants\/([^/?#]+)/);

    return match?.[1] ?? '';
  }
}
