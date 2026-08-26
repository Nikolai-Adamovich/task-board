import { Component, DestroyRef, ElementRef, inject, input, computed, effect, signal, viewChild } from '@angular/core';
import { numberAttribute } from '@angular/core';
import { NavigationEnd, Router, ActivatedRoute } from '@angular/router';
import { CdkMenuTrigger } from '@angular/cdk/menu';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectStore } from '@stores/project-store';
import { PreferencesStore } from '@stores/preferences-store';
import { ProjectRefStore, type SelectOption } from '@stores/project-ref-store';
import { getTenantSlug } from '@app/shared/utils/route-utils';
import { AuthStore } from '@stores/auth-store';
import { canWrite } from '@app/shared/utils/role-utils';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUp, lucideArrowDown, lucideColumns2, lucideEyeOff, lucideFilter, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { TaskClient } from '@services/task-client';
import { Pagination } from '@app/shared/pagination/pagination';
import { FilterPanel } from '@features/filters/filter-panel/filter-panel';
import { AppliedFilterState } from '@features/filters/filter-panel/filter-panel';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import type { Task, TaskPriority, FilterCriteria, FilterSort, TaskTableColumnKey } from '@task-board/shared';
import { TASK_TABLE_COLUMN_KEYS, TASK_TABLE_PINNED_COLUMNS, DEFAULT_TASK_TABLE_COLUMNS } from '@task-board/shared';
import { taskTypeBadgeVariant, priorityBadgeVariant, priorityLabel } from '@app/constants/priority';

interface TaskColumnDef {
  field: string;
  /** R3-P4: stable preference key shared with the server (`taskTableColumns`) */
  columnKey: TaskTableColumnKey;
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

/**
 * V1-3: strict numeric query-param transform — `numberAttribute` yields `NaN`
 * for empty/garbage values which previously leaked into the URL as
 * `?limit=NaN`. Non-finite or non-positive values fall back to 0 so callers
 * apply their own defaults.
 */
export function safeNumericParam(value: unknown): number {
  const n = numberAttribute(value);

  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ─── Auto page-size (U3 / R3-P3) ──────────────────────────────────────────────
/** Sentinel persisted in PreferencesStore.pageSize meaning "Auto" (measured-height derived). */
export const AUTO_PAGE_SIZE_SENTINEL = 0;
/** Fixed row height of the tasks table — the basis of all Auto math and min-height. */
export const TASK_ROW_HEIGHT_PX = 48;
/** Auto page-size clamp bounds. */
export const AUTO_MIN_ROWS = 5;
export const AUTO_MAX_ROWS = 100;

/**
 * Rows that fit the available table-body height: floor(availableHeight / 48)
 * clamped to [5..100]. `availableHeight` is MEASURED from the table wrapper via a
 * ResizeObserver (R3-P3) — no window/chrome constants.
 */
export function computeAutoPageSize(availableHeight: number): number {
  return Math.min(AUTO_MAX_ROWS, Math.max(AUTO_MIN_ROWS, Math.floor(availableHeight / TASK_ROW_HEIGHT_PX)));
}

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
    HlmCheckboxImports,
    HlmDropdownMenuImports,
    Pagination,
    FilterPanel,
  ],
  providers: [provideIcons({ lucideArrowUp, lucideArrowDown, lucideColumns2, lucideEyeOff, lucideFilter, lucideX })],
  templateUrl: './task-table.html',
})
export class TaskTable {
  private readonly taskClient = inject(TaskClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  /** R3-P8: DatePipe token derived from the user's date/time format preference */
  protected readonly dateTimeFmt = this.preferencesStore.dateTimePipeFormat;
  private readonly refStore = inject(ProjectRefStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  // ─── Route & query params (bound automatically by withComponentInputBinding) ──
  readonly projectKey = input.required<string>();
  /** Raw URL values — human-readable names or ids */
  readonly search = input('');
  readonly page = input(1, { transform: safeNumericParam });
  readonly limit = input(this.preferencesStore.pageSize(), { transform: safeNumericParam });
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
  /**
   * True when the persisted preference is the Auto sentinel — the effective page size
   * is then derived from the measured table-wrapper height instead of a fixed number.
   */
  protected readonly isAutoMode = computed(() => this.preferencesStore.pageSize() === AUTO_PAGE_SIZE_SENTINEL);
  /**
   * R3-P3: height available for table ROWS, measured from the table wrapper via a
   * ResizeObserver (wrapper height minus its header row). Replaces the old
   * window.innerHeight − chrome-constant math so the table bottom aligns with the
   * page bottom at any viewport height.
   */
  protected readonly availableRowsHeight = signal(0);
  private readonly tableWrapRef = viewChild<ElementRef<HTMLDivElement>>('tableWrap');
  /**
   * Effective numeric page size used for fetching/rendering. In Auto mode this is
   * recomputed from the measured wrapper height; otherwise it is the URL `limit`
   * or the stored preference.
   */
  protected readonly pageSize = computed(() =>
    this.isAutoMode()
      ? computeAutoPageSize(this.availableRowsHeight())
      : this.limit() || this.preferencesStore.pageSize(),
  );
  /**
   * Height of the invisible spacer row that keeps the table body at
   * page-size × row-height even on a short last page, so the pagination footer
   * does not jump vertically.
   */
  protected readonly bodySpacerHeight = computed(() =>
    Math.max(0, this.pageSize() * TASK_ROW_HEIGHT_PX - this.tasks().length * TASK_ROW_HEIGHT_PX),
  );
  /** Safe page number — falls back to 1 when the query param is absent */
  protected readonly safePage = computed(() => this.page() || 1);
  /** V2-10: the New Task control is hidden from VIEWER-role users */
  protected readonly canCreateTasks = computed(() =>
    canWrite(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
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
  /** Shared badge-variant/label helpers (see constants/priority.ts) */
  protected readonly taskTypeBadgeVariant = taskTypeBadgeVariant;
  protected readonly priorityBadgeVariant = priorityBadgeVariant;
  protected readonly priorityLabel = priorityLabel;
  // ─── Data ──────────────────────────────────────────────────────────────────
  protected readonly tasks = signal<Task[]>([]);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loading = signal(true);
  // ─── Column definitions for @for header rendering ──────────────────────────
  // V4-8 (reopened): under `table-fixed` the fixed px widths of the non-title
  // columns must stay well below typical container widths — otherwise the Title
  // column collapses to 0px and the adjacent Type header overlaps (and swallows
  // clicks on) the Title sort button. Fixed sums are trimmed AND the Title column
  // gets an explicit percentage width so it always keeps a proportional share.
  protected readonly taskColumns: TaskColumnDef[] = [
    {
      field: 'number',
      columnKey: 'key',
      labelKey: 'taskTable.key',
      filterType: 'none',
      width: 'w-[90px]',
      getFilterValue: () => '',
    },
    {
      field: 'title',
      columnKey: 'title',
      labelKey: 'taskTable.titleCol',
      filterType: 'text',
      // V4-8 (reopened): `w-auto` alone collapses to 0px when the fixed widths of
      // the other columns consume the container. An explicit percentage width keeps
      // a proportional share under `table-fixed` at every viewport.
      width: 'w-[30%] min-w-[200px]',
      popoverWidth: 'w-56',
      getFilterValue: () => this.searchInput(),
      setFilterValue: (v) => this.onSearchInput(v),
      placeholder: 'taskTable.searchPlaceholder',
    },
    {
      field: 'typeId',
      columnKey: 'type',
      labelKey: 'taskTable.type',
      filterType: 'select',
      width: 'w-[90px]',
      getFilterValue: () => this.filterType(),
      setFilterValue: (v) => this.onColumnFilterChange('type', v),
      getOptions: () => this.typeOptions(),
      allLabelKey: 'taskTable.allTypes',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'types', id),
    },
    {
      field: 'statusId',
      columnKey: 'status',
      labelKey: 'taskTable.status',
      filterType: 'select',
      width: 'w-[130px]',
      getFilterValue: () => this.filterStatus(),
      setFilterValue: (v) => this.onColumnFilterChange('status', v),
      getOptions: () => this.statusOptions(),
      allLabelKey: 'taskTable.allStatuses',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'statuses', id),
    },
    {
      field: 'priority',
      columnKey: 'priority',
      labelKey: 'taskTable.priority',
      filterType: 'select',
      width: 'w-[100px]',
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
      columnKey: 'assignee',
      labelKey: 'taskTable.assignee',
      filterType: 'select',
      width: 'w-[130px]',
      getFilterValue: () => this.filterAssignee(),
      setFilterValue: (v) => this.onColumnFilterChange('assignee', v),
      getOptions: () => this.memberOptions(),
      allLabelKey: 'taskTable.allAssignees',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'members', id),
    },
    {
      field: 'reporterId',
      columnKey: 'reporter',
      labelKey: 'taskTable.reporter',
      filterType: 'select',
      width: 'w-[130px]',
      getFilterValue: () => this.filterReporter(),
      setFilterValue: (v) => this.onColumnFilterChange('reporter', v),
      getOptions: () => this.memberOptions(),
      allLabelKey: 'taskTable.allReporters',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'members', id),
    },
    {
      field: 'sprintId',
      columnKey: 'sprint',
      labelKey: 'taskTable.sprint',
      filterType: 'select',
      width: 'w-[110px]',
      getFilterValue: () => this.filterSprint(),
      setFilterValue: (v) => this.onColumnFilterChange('sprint', v),
      getOptions: () => this.sprintOptions(),
      allLabelKey: 'taskTable.allSprints',
      itemToString: (id: string) => this.refStore.nameOf(this.projectId(), 'sprints', id),
    },
    {
      field: 'labelIds',
      columnKey: 'labels',
      labelKey: 'taskTable.labels',
      filterType: 'none',
      width: 'w-[140px]',
      getFilterValue: () => '',
    },
    {
      field: 'createdAt',
      columnKey: 'created',
      labelKey: 'taskTable.created',
      filterType: 'none',
      width: 'w-[100px]',
      getFilterValue: () => '',
    },
    {
      field: 'updatedAt',
      columnKey: 'updated',
      labelKey: 'taskTable.updated',
      filterType: 'none',
      width: 'w-[100px]',
      getFilterValue: () => '',
    },
  ];
  protected readonly COLUMN_COUNT = COLUMN_COUNT;
  // ─── Column visibility (R3-P4) ─────────────────────────────────────────────
  /**
   * Local override applied immediately on toggle; the debounced persist goes to
   * PreferencesStore afterwards. Null = fall through to the persisted preference.
   */
  private readonly localColumns = signal<TaskTableColumnKey[] | null>(null);
  /**
   * Effective visible column keys. Pinned columns (`key`, `title`) are always
   * included regardless of what was persisted; null preference = default set.
   */
  protected readonly visibleColumnKeys = computed<ReadonlySet<TaskTableColumnKey>>(() => {
    const pid = this.projectId();
    const stored = pid ? this.preferencesStore.getTaskTableColumns(pid) : null;
    const keys = this.localColumns() ?? stored ?? DEFAULT_TASK_TABLE_COLUMNS;

    return new Set<TaskTableColumnKey>([...TASK_TABLE_PINNED_COLUMNS, ...keys]);
  });
  /** Column definitions filtered by the visible set — drives header rendering. */
  protected readonly visibleTaskColumns = computed(() =>
    this.taskColumns.filter((col) => this.visibleColumnKeys().has(col.columnKey)),
  );
  /** Visible fields — guards body-cell rendering so hidden cells leave the DOM. */
  protected readonly visibleFields = computed(() => new Set(this.visibleTaskColumns().map((col) => col.field)));
  /** colspan for empty/spacer rows — follows the visible column count */
  protected readonly visibleColumnCount = computed(() => this.visibleTaskColumns().length);
  /** Column-chooser popover visibility */
  protected readonly showColumnChooser = signal(false);
  /** Column targeted by the header context menu */
  protected readonly contextColumn = signal<TaskColumnDef | null>(null);
  private readonly ctxAnchorRef = viewChild<ElementRef<HTMLSpanElement>>('ctxAnchor');
  private readonly ctxMenuTrigger = viewChild(CdkMenuTrigger);
  /** Debounced persistence of column toggles (~400 ms) */
  private static readonly COLUMN_PERSIST_DEBOUNCE_MS = 400;
  private columnPersistHandle: ReturnType<typeof setTimeout> | null = null;
  // ─── Dialogs ───────────────────────────────────────────────────────────────
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
  /** Free-text search is debounced (~300 ms) so typing doesn't fire a request per keystroke */
  private static readonly SEARCH_DEBOUNCE_MS = 300;
  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  /** Local buffer for the search box — committed to the URL only after the debounce */
  protected readonly searchInput = signal('');
  /**
   * V1-3: bumped when a router navigation completes while this table is alive
   * (e.g. browser-back from `tasks/new`). Read by the fetch effect so returning
   * to the table always re-runs the query — the list can never go stale.
   */
  private readonly reloadTick = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Load reference data whenever the project context becomes available
    effect(() => {
      this.refStore.ensure(this.projectId(), ['statuses', 'types', 'sprints', 'labels', 'members']);
    });

    // R3-P4: load the per-project preferences (incl. taskTableColumns) for this table
    effect(() => {
      const pid = this.projectId();

      if (pid) this.preferencesStore.loadProjectPreferences(pid);
    });

    // Reload tasks whenever the query changes (initial load included)
    effect(() => {
      const query = this.taskQuery();
      const pid = this.projectId();

      this.reloadTick(); // V1-3: re-run the fetch when navigation back completes

      if (!pid) return;

      this.loading.set(true);
      this.taskClient.list(pid, query).subscribe({
        next: (res) => {
          this.tasks.set(res.data);
          this.total.set(res.pagination.total);
          this.totalPages.set(res.pagination.totalPages);
          this.loading.set(false);

          // Handle invalid page — move to nearest valid page
          if (res.pagination.totalPages > 0 && this.page() > res.pagination.totalPages) {
            this.patchParams({ page: res.pagination.totalPages });
          }
        },
        error: (err) => {
          console.error('Failed to load tasks:', err);
          this.loading.set(false);
        },
      });
    });

    // Keep the buffered search text in sync with external URL changes (back/forward, chip removal).
    // V4-7: `?? ''` — withComponentInputBinding yields `undefined` for an absent
    // `?search=` param; letting undefined into the buffer made the input render
    // the literal string "undefined" (V1-2/V3-8 regression).
    effect(() => this.searchInput.set(this.search() ?? ''));

    // V1-3: refresh on route activation. The first NavigationEnd belongs to this
    // mount (the fetch effect already ran); every later one means we came back.
    let firstNavigation = true;

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (firstNavigation) {
          firstNavigation = false;
          return;
        }
        this.reloadTick.update((tick) => tick + 1);
      });

    // R3-P3: measure the table wrapper with a ResizeObserver instead of deriving the
    // Auto page size from window.innerHeight. The fetch effect depends on `pageSize`,
    // so a refetch only happens when the computed row count actually changes.
    effect(() => {
      const el = this.tableWrapRef()?.nativeElement;

      if (!el || typeof ResizeObserver === 'undefined') return;

      const measure = (entry?: ResizeObserverEntry) => {
        // Prefer the observed contentRect; fall back to a direct read for the first pass
        const wrapperHeight = Math.round(entry?.contentRect.height ?? el.getBoundingClientRect().height);
        const head = el.querySelector('thead');
        const headHeight = head ? Math.round(head.getBoundingClientRect().height) : 0;

        this.availableRowsHeight.set(Math.max(0, wrapperHeight - headHeight));
      };

      measure(); // synchronous first measurement — avoids an initial min-rows fetch

      const observer = new ResizeObserver((entries) => measure(entries[0]));

      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    this.destroyRef.onDestroy(() => {
      if (this.searchDebounceHandle !== null) clearTimeout(this.searchDebounceHandle);
      if (this.columnPersistHandle !== null) clearTimeout(this.columnPersistHandle);
    });
  }

  // ─── Column visibility (R3-P4) ─────────────────────────────────────────────

  /** Identity-anchor columns can never be hidden */
  protected isPinnedColumn(columnKey: TaskTableColumnKey): boolean {
    return (TASK_TABLE_PINNED_COLUMNS as readonly string[]).includes(columnKey);
  }

  /**
   * Toggle a column's visibility. Applies immediately via `localColumns`; the
   * persistence call is debounced so rapid toggles coalesce into one request.
   */
  protected toggleColumn(columnKey: TaskTableColumnKey, visible: boolean): void {
    if (this.isPinnedColumn(columnKey)) return;

    const current = this.visibleColumnKeys();
    const nextKeys = TASK_TABLE_COLUMN_KEYS.filter((key) =>
      visible ? current.has(key) || key === columnKey : current.has(key) && key !== columnKey,
    );

    this.localColumns.set([...nextKeys]);

    if (this.columnPersistHandle !== null) clearTimeout(this.columnPersistHandle);

    const pid = this.projectId();

    if (!pid) return;

    this.columnPersistHandle = setTimeout(() => {
      this.columnPersistHandle = null;
      this.preferencesStore.setTaskTableColumns(pid, nextKeys);
    }, TaskTable.COLUMN_PERSIST_DEBOUNCE_MS);
  }

  /** Right-click on a column header → open the context menu at the cursor */
  protected onHeaderContextMenu(event: MouseEvent, col: TaskColumnDef): void {
    event.preventDefault();
    this.contextColumn.set(col);

    const anchor = this.ctxAnchorRef()?.nativeElement;

    if (!anchor) return;

    anchor.style.left = `${event.clientX}px`;
    anchor.style.top = `${event.clientY}px`;

    // Open once the anchor position is committed to the DOM
    setTimeout(() => this.ctxMenuTrigger()?.open());
  }

  protected canHideContextColumn(): boolean {
    const col = this.contextColumn();

    return !!col && !this.isPinnedColumn(col.columnKey) && this.visibleColumnKeys().has(col.columnKey);
  }

  protected hideContextColumn(): void {
    const col = this.contextColumn();

    if (col) this.toggleColumn(col.columnKey, false);
  }

  protected openChooserFromContextMenu(): void {
    this.showColumnChooser.set(true);
  }

  protected onChooserStateChange(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.showColumnChooser.set(false);
    }
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

  // ─── Handlers ──────────────────────────────────────────────────────────────

  protected onSearch(event: Event): void {
    this.onSearchInput((event.target as HTMLInputElement).value);
  }

  /** Buffer keystrokes and commit the search param after ~300 ms of inactivity */
  protected onSearchInput(value: string): void {
    this.searchInput.set(value);

    if (this.searchDebounceHandle !== null) clearTimeout(this.searchDebounceHandle);

    this.searchDebounceHandle = setTimeout(() => {
      this.searchDebounceHandle = null;
      this.patchParams({ search: value || null, page: null });
    }, TaskTable.SEARCH_DEBOUNCE_MS);
  }

  /** Remove a single active filter via its chip's × button */
  protected removeFilter(param: string): void {
    if (param === 'search') {
      if (this.searchDebounceHandle !== null) {
        clearTimeout(this.searchDebounceHandle);
        this.searchDebounceHandle = null;
      }
      this.searchInput.set('');
    }
    this.onColumnFilterChange(param, '');
  }

  /** One-click reset of every active filter (filtered-empty state CTA) */
  protected clearFilters(): void {
    if (this.searchDebounceHandle !== null) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = null;
    }
    this.searchInput.set('');
    this.patchParams({
      search: null,
      priority: null,
      status: null,
      type: null,
      assignee: null,
      reporter: null,
      sprint: null,
      label: null,
      page: null,
    });
  }

  /** True when any filter param is active — distinguishes filtered-empty from true-empty */
  protected readonly hasActiveFilters = computed(
    () =>
      !!this.search() ||
      !!this.priority() ||
      !!this.status() ||
      !!this.type() ||
      !!this.assignee() ||
      !!this.reporter() ||
      !!this.sprint() ||
      !!this.label(),
  );
  /** Active filters as removable chips rendered above the table */
  protected readonly activeFilterChips = computed<{ param: string; labelKey: string; value: string }[]>(() => {
    const chips: { param: string; labelKey: string; value: string }[] = [];
    const pid = this.projectId();

    if (this.search()) {
      chips.push({ param: 'search', labelKey: 'taskTable.filterSearch', value: this.search() });
    }
    if (this.priority()) {
      // R3-P5: title-case display label instead of the raw enum value
      chips.push({ param: 'priority', labelKey: 'taskTable.filterPriority', value: priorityLabel(this.priority()) });
    }
    if (this.filterStatus()) {
      chips.push({
        param: 'status',
        labelKey: 'taskTable.filterStatus',
        value: this.refStore.nameOf(pid, 'statuses', this.filterStatus()),
      });
    }
    if (this.filterType()) {
      chips.push({
        param: 'type',
        labelKey: 'taskTable.filterType',
        value: this.refStore.nameOf(pid, 'types', this.filterType()),
      });
    }
    if (this.filterAssignee()) {
      chips.push({
        param: 'assignee',
        labelKey: 'taskTable.filterAssignee',
        value: this.refStore.nameOf(pid, 'members', this.filterAssignee()),
      });
    }
    if (this.filterReporter()) {
      chips.push({
        param: 'reporter',
        labelKey: 'taskTable.filterReporter',
        value: this.refStore.nameOf(pid, 'members', this.filterReporter()),
      });
    }
    if (this.filterSprint()) {
      chips.push({
        param: 'sprint',
        labelKey: 'taskTable.filterSprint',
        value: this.refStore.nameOf(pid, 'sprints', this.filterSprint()),
      });
    }
    if (this.filterLabel()) {
      chips.push({
        param: 'label',
        labelKey: 'taskTable.filterLabel',
        value: this.refStore.nameOf(pid, 'labels', this.filterLabel()),
      });
    }

    return chips;
  });

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

  /**
   * Numeric page-size selection: persist and write to the URL.
   * Auto selection (`onAutoPageSize`) intentionally OMITS `limit` from the URL and
   * resolves the size client-side, so the URL stays stable across screen sizes.
   */
  protected onPageSizeChange(newSize: number): void {
    // V1-3: never persist or write a non-finite size (`?limit=NaN`) to the URL
    if (!Number.isFinite(newSize) || newSize <= 0) return;

    this.preferencesStore.setPageSize(newSize);
    this.patchParams({ limit: newSize, page: null });
  }

  /** Auto page-size selection: persist the sentinel and drop `limit` from the URL. */
  protected onAutoPageSize(): void {
    this.preferencesStore.setPageSize(AUTO_PAGE_SIZE_SENTINEL);
    this.patchParams({ limit: null, page: null });
  }

  // ─── Cell tooltips (fixed layout ellipsis) ─────────────────────────────────

  /** `KEY-123` display key used in the Key cell and its title tooltip */
  protected taskKey(task: Task): string {
    return `${this.projectKey() ? `${this.projectKey()}-` : '#'}${task.number}`;
  }

  protected sprintName(task: Task): string {
    return task.sprintId ? (this.sprintMap()[task.sprintId] ?? task.sprintId) : '';
  }

  /** Comma-joined label names for the Labels cell tooltip */
  protected labelNames(task: Task): string {
    return (task.labelIds ?? []).map((id) => this.labelMap()[id] ?? id).join(', ');
  }

  protected goToTask(task: Task): void {
    const tenantSlug = getTenantSlug(this.route);
    // The table only renders under projects/:projectKey — prefer the route param
    // so the link is correct even before ProjectStore is hydrated.
    const projectKey =
      this.route.snapshot.paramMap.get('projectKey') ?? this.projectStore.activeProject()?.key ?? task.projectId;

    // Canonical task URL uses the project key + task number (DEC-032)
    this.router.navigate(['/t', tenantSlug, 'projects', projectKey, 'tasks', `${projectKey}-${task.number}`]);
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
      reporter: this.idToName('members', criteria.reporterIds?.[0] ?? ''),
      sprint: this.idToName('sprints', criteria.sprintIds?.[0] ?? ''),
      label: this.idToName('labels', criteria.labelIds?.[0] ?? ''),
      page: null,
    };

    // Apply sort from saved filter
    if (state.sort?.field) {
      params['sort'] = `${state.sort.field}:${state.sort.direction}`;
    }

    this.patchParams(params);
  }

  /** Navigate to the unified create-task page (U1 — replaces the table dialog) */
  goToNewTask(): void {
    const tenantSlug = getTenantSlug(this.route);
    const projectKey = this.route.snapshot.paramMap.get('projectKey') ?? this.projectStore.activeProject()?.key ?? '';

    this.router.navigate(['/t', tenantSlug, 'projects', projectKey, 'tasks', 'new']);
  }
}
