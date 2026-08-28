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
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUp,
  lucideArrowDown,
  lucideColumns2,
  lucideEyeOff,
  lucideFilter,
  lucideRows3,
  lucideX,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { TaskClient } from '@services/task-client';
import { Pagination } from '@app/shared/pagination/pagination';
import { FilterPanel } from '@features/filters/filter-panel/filter-panel';
import { AppliedFilterState } from '@features/filters/filter-panel/filter-panel';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
// P13b: BrnPopover is read from the cursor-anchored popover so the programmatic
// open can call `setOrigin` (a trigger click would do this implicitly).
import { BrnPopover } from '@spartan-ng/brain/popover';
import type {
  Task,
  TaskPriority,
  FilterCriteria,
  FilterSort,
  TaskTableColumnKey,
  BulkUpdateTasks,
} from '@task-board/shared';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { TASK_TABLE_COLUMN_KEYS, TASK_TABLE_PINNED_COLUMNS, DEFAULT_TASK_TABLE_COLUMNS } from '@task-board/shared';
import { taskTypeBadgeVariant, priorityBadgeVariant, priorityLabelKey } from '@app/constants/priority';
import {
  AUTO_PAGE_SIZE_SENTINEL,
  computeAutoPageSize,
  rowHeightForDensity,
} from '@app/shared/auto-table/auto-page-size';
import { useAutoRowMeasurement } from '@app/shared/auto-table/use-auto-row-measurement';
import { useTableDensity } from '@app/shared/auto-table/table-density';

interface TaskColumnDef {
  field: string;
  /** R3-P4: stable preference key shared with the server (`taskTableColumns`) */
  columnKey: TaskTableColumnKey;
  labelKey: string;
  filterType: 'none' | 'text' | 'select' | 'date';
  width?: string;
  popoverWidth?: string;
  /**
   * Round-4 F3: overlay alignment for the header filter popover. The rightmost
   * columns (Created/Updated) use `'end'` so the popover opens leftward and is
   * not clipped at the right viewport edge.
   */
  align?: 'start' | 'center' | 'end';
  getFilterValue: () => string;
  setFilterValue?: (value: string) => void;
  getOptions?: () => SelectOption[];
  /** Q13/F-01: date-range accessors for `filterType: 'date'` columns */
  getDateFrom?: () => string;
  getDateTo?: () => string;
  /** Empty string on either side clears that bound */
  setDateRange?: (from: string, to: string) => void;
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

/**
 * Q10: sentinels for the nullable bulk-select options — hlm-select values are
 * strings, so "unassign"/"clear sprint" need a non-empty marker that maps to
 * `null` in the request body.
 */
const BULK_UNASSIGNED = '__unassigned__';
const BULK_NO_SPRINT = '__no_sprint__';

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
    NgTemplateOutlet,
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
    HlmTooltipImports,
    HlmDatePickerImports,
    Pagination,
    FilterPanel,
  ],
  providers: [
    provideIcons({
      lucideArrowUp,
      lucideArrowDown,
      lucideColumns2,
      lucideEyeOff,
      lucideFilter,
      lucideRows3,
      lucideX,
    }),
  ],
  templateUrl: './task-table.html',
})
export class TaskTable {
  private readonly taskClient = inject(TaskClient);
  /** Round-4 F1: translates the date-mode select values for its trigger display */
  private readonly transloco = inject(TranslocoService);
  /** Q10: bulk-update success/failure feedback */
  private readonly notify = injectToasts();
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly preferencesStore = inject(PreferencesStore);
  /** R3-P8: DatePipe token derived from the user's date/time format preference */
  protected readonly dateTimeFmt = this.preferencesStore.dateTimePipeFormat;
  /** P12 (item 28): active language passed as the DatePipe locale for localized month names */
  protected readonly lang = this.preferencesStore.language;
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
  // Q12: date-range filter params (set via column-header popovers) — captured by saved views
  readonly createdFrom = input('');
  readonly createdTo = input('');
  readonly updatedFrom = input('');
  readonly updatedTo = input('');
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
   * Q9 (RQ-04 ⑤): device-local table density. Compact mode shrinks vertical cell
   * padding via a class on the `<table>`; the Auto math below reacts through the
   * density-aware fallback row height.
   */
  private readonly density = useTableDensity();
  protected readonly isCompact = this.density.compact;
  protected readonly toggleDensity = this.density.toggle;
  /** Density-aware fallback row height used by the Auto page-size math */
  private readonly rowHeightPx = computed(() => rowHeightForDensity(this.density.compact()));
  /**
   * R3-P3: height available for table ROWS, measured from the table wrapper via a
   * shared ResizeObserver (wrapper height minus its header row). No window/chrome
   * constants — the table bottom aligns with the page bottom at any viewport height.
   */
  private readonly measurement = useAutoRowMeasurement();
  protected readonly availableRowsHeight = this.measurement.availableRowsHeight;
  /**
   * Effective row height for the Auto math: the REAL measured
   * body-row height when available (real rows are ~44px vs the 48px fallback —
   * using the fallback undercounts how many rows fit), otherwise the
   * density-aware constant.
   */
  private readonly effectiveRowHeightPx = computed(() => this.measurement.measuredRowHeight() || this.rowHeightPx());
  private readonly tableWrapRef = viewChild<ElementRef<HTMLDivElement>>('tableWrap');
  /**
   * Effective numeric page size used for fetching/rendering. In Auto mode this is
   * recomputed from the measured wrapper height; otherwise it is the URL `limit`
   * or the stored preference.
   */
  protected readonly pageSize = computed(() =>
    this.isAutoMode()
      ? computeAutoPageSize(this.availableRowsHeight(), this.effectiveRowHeightPx())
      : this.limit() || this.preferencesStore.pageSize(),
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

  /** Translated priority label (P11); unknown values render verbatim. */
  protected priorityLabel(priority: string): string {
    const key = priorityLabelKey(priority);

    return key ? this.transloco.translate(key) : priority;
  }
  // ─── Data ──────────────────────────────────────────────────────────────────
  protected readonly tasks = signal<Task[]>([]);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loading = signal(true);
  // ─── Q10 (RQ-04 ③): multi-select + bulk actions ─────────────────────────────
  /** Page-scoped selection set — cleared whenever the table data reloads */
  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selectedIds().size);
  protected readonly allSelected = computed(
    () => this.tasks().length > 0 && this.tasks().every((task) => this.selectedIds().has(task.id)),
  );
  /** Bulk-bar field buffers (empty string = untouched) */
  protected readonly bulkStatus = signal('');
  protected readonly bulkAssignee = signal('');
  protected readonly bulkSprint = signal('');
  protected readonly applyingBulk = signal(false);
  /** Mirrors the server's exactly-one-field contract client-side */
  protected readonly canApplyBulk = computed(
    () => [this.bulkStatus(), this.bulkAssignee(), this.bulkSprint()].filter((v) => v !== '').length === 1,
  );
  /**
   * colspan for empty/spacer rows — visible columns plus the selection
   * checkbox column when it is rendered.
   */
  protected readonly renderedColumnCount = computed(() => this.visibleColumnCount() + (this.canCreateTasks() ? 1 : 0));
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
      width: 'w-23',
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
      width: 'w-[30%] min-w-50',
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
      width: 'w-23',
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
      width: 'w-33',
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
      width: 'w-25',
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
      width: 'w-33',
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
      width: 'w-33',
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
      width: 'w-28',
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
      width: 'w-35',
      getFilterValue: () => '',
    },
    {
      field: 'createdAt',
      columnKey: 'created',
      labelKey: 'taskTable.created',
      // Q13/F-01: date-range filter (on/before/after/between) via header popover
      filterType: 'date',
      width: 'w-25',
      // Round-4 F3: rightmost column — open the popover leftward (no viewport clipping)
      align: 'end',
      getFilterValue: () => '',
      getDateFrom: () => this.createdFrom(),
      getDateTo: () => this.createdTo(),
      setDateRange: (from, to) => this.patchParams({ createdFrom: from || null, createdTo: to || null }),
    },
    {
      field: 'updatedAt',
      columnKey: 'updated',
      labelKey: 'taskTable.updated',
      filterType: 'date',
      width: 'w-25',
      // Round-4 F3: rightmost column — open the popover leftward (no viewport clipping)
      align: 'end',
      getFilterValue: () => '',
      getDateFrom: () => this.updatedFrom(),
      getDateTo: () => this.updatedTo(),
      setDateRange: (from, to) => this.patchParams({ updatedFrom: from || null, updatedTo: to || null }),
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
  /** Column-chooser popover visibility (toolbar instance) */
  protected readonly showColumnChooser = signal(false);
  /**
   * Round-5 P9 (item 24): cursor-anchored chooser instance — opened from the
   * header context menu so the chooser appears near the cursor, not at the
   * toolbar button. Shares state/handlers with the toolbar instance.
   */
  protected readonly showContextColumnChooser = signal(false);
  /** Column targeted by the header context menu */
  protected readonly contextColumn = signal<TaskColumnDef | null>(null);
  private readonly ctxAnchorRef = viewChild<ElementRef<HTMLSpanElement>>('ctxAnchor');
  /** Hidden trigger button of the cursor-anchored chooser popover */
  private readonly ctxChooserAnchorRef = viewChild<ElementRef<HTMLButtonElement>>('ctxChooserAnchor');
  /** P13b: the BrnPopover hosting the cursor-anchored chooser (for setOrigin). */
  private readonly ctxChooserPopover = viewChild('ctxChooserAnchor', { read: BrnPopover });
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
    // Q12: date ranges participate in save/active-detection of saved views
    if (this.createdFrom()) filters.createdFrom = this.createdFrom();
    if (this.createdTo()) filters.createdTo = this.createdTo();
    if (this.updatedFrom()) filters.updatedFrom = this.updatedFrom();
    if (this.updatedTo()) filters.updatedTo = this.updatedTo();

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
    // Q13/F-01: inclusive ISO date-range filters (server applies $gte/$lte)
    createdFrom: this.createdFrom() || undefined,
    createdTo: this.createdTo() || undefined,
    updatedFrom: this.updatedFrom() || undefined,
    updatedTo: this.updatedTo() || undefined,
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
  /**
   * P8-12: scope key of the last completed fetch (see the fetch effect).
   * Null until the first response lands — the initial load must not "clear"
   * an already-empty selection.
   */
  private lastScopeKey: string | null = null;
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

      // P8-12: identity of THIS request's query scope — everything that changes
      // WHICH tasks are listed (project, filters, page, sort) but NOT the page
      // size. Captured synchronously so the response handler can tell a scope
      // change (clear selection) from a limit-only refetch (keep it).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { limit: _limit, ...scope } = query;
      const scopeKey = JSON.stringify({ pid, scope });

      this.loading.set(true);
      this.taskClient.list(pid, query).subscribe({
        next: (res) => {
          this.tasks.set(res.data);
          this.total.set(res.pagination.total);
          this.totalPages.set(res.pagination.totalPages);
          this.loading.set(false);
          // Q10/P8-12: selection is page-scoped — cleared when the query scope
          // (filters/page/sort/project) changes, but NOT on limit-only refetches.
          // Clicking a row checkbox renders the bulk bar, which shrinks the table
          // wrapper; in Auto page-size mode the ResizeObserver then recomputes the
          // size and refetches — that refetch must not wipe the fresh selection.
          if (this.lastScopeKey !== null && scopeKey !== this.lastScopeKey) {
            this.selectedIds.set(new Set());
          }
          this.lastScopeKey = scopeKey;

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

    // R3-P3: measure the table wrapper via the shared ResizeObserver instead of
    // deriving the Auto page size from window.innerHeight. The fetch effect depends
    // on `pageSize`, so a refetch only happens when the row count actually changes.
    effect(() => {
      this.measurement.observe(this.tableWrapRef()?.nativeElement, 'thead');
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
    this.scheduleColumnPersist(nextKeys);
  }

  /**
   * Round-5 P9 (item 25): bulk show/hide of ALL non-pinned columns at once.
   * Pinned Key/Title always stay; persistence goes through the same debounced
   * path as single toggles so rapid changes coalesce into one request.
   */
  protected toggleAllColumns(visible: boolean): void {
    const nextKeys: TaskTableColumnKey[] = visible ? [...TASK_TABLE_COLUMN_KEYS] : [...TASK_TABLE_PINNED_COLUMNS];

    this.localColumns.set([...nextKeys]);
    this.scheduleColumnPersist(nextKeys);
  }

  /** Debounced persistence of the visible-column set (~400 ms) */
  private scheduleColumnPersist(nextKeys: readonly TaskTableColumnKey[]): void {
    if (this.columnPersistHandle !== null) clearTimeout(this.columnPersistHandle);

    const pid = this.projectId();

    if (!pid) return;

    this.columnPersistHandle = setTimeout(() => {
      this.columnPersistHandle = null;
      this.preferencesStore.setTaskTableColumns(pid, [...nextKeys]);
    }, TaskTable.COLUMN_PERSIST_DEBOUNCE_MS);
  }

  /** Round-5 P9 (item 25): Select-all state over the toggleable (non-pinned) columns */
  protected readonly toggleableColumns = computed(() =>
    this.taskColumns.filter((col) => !this.isPinnedColumn(col.columnKey)),
  );
  protected readonly allColumnsSelected = computed(() =>
    this.toggleableColumns().every((col) => this.visibleColumnKeys().has(col.columnKey)),
  );
  protected readonly someColumnsSelected = computed(() => {
    const selected = this.toggleableColumns().filter((col) => this.visibleColumnKeys().has(col.columnKey)).length;

    return selected > 0 && selected < this.toggleableColumns().length;
  });

  /** Right-click on a column header → open the context menu at the cursor */
  protected onHeaderContextMenu(event: MouseEvent, col: TaskColumnDef): void {
    event.preventDefault();
    this.contextColumn.set(col);

    const anchor = this.ctxAnchorRef()?.nativeElement;

    if (!anchor) return;

    anchor.style.left = `${event.clientX}px`;
    anchor.style.top = `${event.clientY}px`;

    // Round-5 P9 (item 24): keep the cursor-anchored chooser trigger at the
    // same coordinates so "Select columns" opens the popover at the cursor.
    const chooserAnchor = this.ctxChooserAnchorRef()?.nativeElement;

    if (chooserAnchor) {
      chooserAnchor.style.left = `${event.clientX}px`;
      chooserAnchor.style.top = `${event.clientY}px`;
    }

    // Open once the anchor position is committed to the DOM
    setTimeout(() => {
      this.ctxMenuTrigger()?.open();
      // Round-4 F4: Linux fires `contextmenu` on mousedown — when the right button
      // is released the browser fires `auxclick`/`click` on the `<th>`, which CDK's
      // overlay outside-click dispatcher treats as an outside click and closes the
      // menu immediately. Swallow that single terminating event.
      this.swallowNextClick();
    });
  }

  /**
   * Round-4 F4: swallow exactly ONE terminating click after a programmatic menu
   * open. One-shot capture-phase listeners on `document` stop the event before it
   * reaches CDK's body-level outside-click dispatcher; they remove themselves after
   * the first event (or after ~500 ms as a safety), so a later click that selects a
   * menu item is never eaten.
   */
  private swallowNextClick(): void {
    let handle: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (): void => {
      document.removeEventListener('auxclick', swallow, true);
      document.removeEventListener('click', swallow, true);

      if (handle !== null) clearTimeout(handle);

      handle = null;
    };
    const swallow = (event: Event): void => {
      event.stopPropagation();
      cleanup();
    };

    handle = setTimeout(cleanup, 500);
    document.addEventListener('auxclick', swallow, true);
    document.addEventListener('click', swallow, true);
  }

  protected canHideContextColumn(): boolean {
    const col = this.contextColumn();

    return !!col && !this.isPinnedColumn(col.columnKey) && this.visibleColumnKeys().has(col.columnKey);
  }

  protected hideContextColumn(): void {
    const col = this.contextColumn();

    if (col) this.toggleColumn(col.columnKey, false);
  }

  /** Round-5 P9 (item 24): open the CURSOR-anchored instance, never the toolbar one */
  protected openChooserFromContextMenu(): void {
    // P13b: the popover is opened via the `[state]` binding (not a trigger
    // click), so BrnPopoverTrigger never runs `setOrigin` — without an origin
    // the overlay fell back to its default (mid-table) position. Point it at
    // the hidden cursor-anchored trigger button first.
    const anchor = this.ctxChooserAnchorRef()?.nativeElement;

    if (anchor) this.ctxChooserPopover()?.setOrigin(anchor);

    this.showColumnChooser.set(false);
    this.showContextColumnChooser.set(true);
  }

  protected onChooserStateChange(state: 'open' | 'closed'): void {
    // P13b: when the toolbar popover is opened by CLICKING its trigger, the
    // overlay's internal state goes 'open' but the `[state]` binding signal
    // stayed false — so the × button's `showColumnChooser.set(false)` was a
    // no-op (same value → input never changes → BrnOverlay's effect never
    // closes). Mirror the overlay state into the signal so the binding is the
    // single source of truth. Round-5 P9: only one instance open at a time.
    if (state === 'open') {
      this.showColumnChooser.set(true);
      this.showContextColumnChooser.set(false);
    } else {
      this.showColumnChooser.set(false);
    }
  }

  protected onContextChooserStateChange(state: 'open' | 'closed'): void {
    if (state === 'open') {
      this.showContextColumnChooser.set(true);
      this.showColumnChooser.set(false);
    } else {
      this.showContextColumnChooser.set(false);
    }
  }

  /** Round-5 P9 (item 25): × button in the shared chooser header — closes whichever instance is open */
  protected closeColumnChooser(): void {
    this.showColumnChooser.set(false);
    this.showContextColumnChooser.set(false);
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
    // Q13/F-01: date chips clear BOTH bounds of their range
    if (param === 'createdFrom' || param === 'createdTo') {
      const createdCol = this.taskColumns.find((c) => c.columnKey === 'created');

      if (createdCol) this.clearDateModeOverride(createdCol);
      this.patchParams({ createdFrom: null, createdTo: null });
      return;
    }
    if (param === 'updatedFrom' || param === 'updatedTo') {
      const updatedCol = this.taskColumns.find((c) => c.columnKey === 'updated');

      if (updatedCol) this.clearDateModeOverride(updatedCol);
      this.patchParams({ updatedFrom: null, updatedTo: null });
      return;
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
    // Round-4 F2: drop any explicit UI-mode overrides — derived mode takes over again
    this.dateModeOverrides.set({});
    this.patchParams({
      search: null,
      priority: null,
      status: null,
      type: null,
      assignee: null,
      reporter: null,
      sprint: null,
      label: null,
      createdFrom: null,
      createdTo: null,
      updatedFrom: null,
      updatedTo: null,
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
      !!this.label() ||
      !!this.createdFrom() ||
      !!this.createdTo() ||
      !!this.updatedFrom() ||
      !!this.updatedTo(),
  );
  /** Active filters as removable chips rendered above the table */
  protected readonly activeFilterChips = computed<{ param: string; labelKey: string; value: string }[]>(() => {
    const chips: { param: string; labelKey: string; value: string }[] = [];
    const pid = this.projectId();

    if (this.search()) {
      chips.push({ param: 'search', labelKey: 'taskTable.filterSearch', value: this.search() });
    }
    if (this.priority()) {
      // P11: translated display label instead of the raw enum value
      chips.push({
        param: 'priority',
        labelKey: 'taskTable.filterPriority',
        value: this.priorityLabel(this.priority()),
      });
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

    // Q13/F-01: date-range chips — one chip per bounded column
    const dateChip = (param: 'createdFrom' | 'updatedFrom', from: string, to: string, labelKey: string): void => {
      if (!from && !to) return;

      let value: string;

      if (from && to) {
        value = from === to ? from : `${from} … ${to}`;
      } else {
        value = from || `≤ ${to}`;
      }

      chips.push({ param, labelKey, value });
    };

    dateChip('createdFrom', this.createdFrom(), this.createdTo(), 'taskTable.filterCreated');
    dateChip('updatedFrom', this.updatedFrom(), this.updatedTo(), 'taskTable.filterUpdated');

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
    this.router.navigate(['/w', tenantSlug, 'projects', projectKey, 'tasks', `${projectKey}-${task.number}`]);
  }

  /** Q13/F-03: middle-click (auxclick, button 1) opens the task in a new tab */
  protected openTaskInNewTab(event: MouseEvent, task: Task): void {
    if (event.button !== 1) return;

    event.preventDefault();

    const tenantSlug = getTenantSlug(this.route);
    const projectKey =
      this.route.snapshot.paramMap.get('projectKey') ?? this.projectStore.activeProject()?.key ?? task.projectId;
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/w', tenantSlug, 'projects', projectKey, 'tasks', `${projectKey}-${task.number}`]),
    );

    window.open(url, '_blank');
  }

  // ─── Q13/F-01: date-range filter helpers ───────────────────────────────────

  private static toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
  }

  protected isoToDate(value: string): Date | undefined {
    if (!value) return undefined;

    const [y, m, d] = value.split('-').map(Number);

    return new Date(y, m - 1, d);
  }

  /**
   * P12 (item 28): trigger label formatter for the date-filter pickers — the
   * selected date renders with the user's date format + active locale via
   * DatePipe (no weekday), instead of the picker's raw default. Passed as
   * `formatDate` to the `hlm-date-picker` instances in the template.
   */
  protected readonly dateFilterTriggerFormat = (date: Date): string => {
    const locale = this.preferencesStore.language();

    return new DatePipe(locale).transform(date, this.preferencesStore.datePipeFormat(), undefined, locale) ?? '';
  };
  /**
   * Round-4 F2: per-column UI-mode override. Picking e.g. 'between' before any
   * dates exist must NOT invent bounds — the override keeps the UI in the chosen
   * mode until real bounds determine it again (or the filter is removed/cleared).
   */
  private readonly dateModeOverrides = signal<Partial<Record<string, string>>>({});

  private setDateModeOverride(col: TaskColumnDef, mode: string): void {
    this.dateModeOverrides.update((overrides) => ({ ...overrides, [col.columnKey]: mode }));
  }

  private clearDateModeOverride(col: TaskColumnDef): void {
    this.dateModeOverrides.update((overrides) => {
      if (!(col.columnKey in overrides)) return overrides;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [col.columnKey]: _removed, ...rest } = overrides;

      return rest;
    });
  }

  /** Derive the popover's mode select value from the current from/to bounds */
  protected dateMode(col: TaskColumnDef): 'none' | 'on' | 'before' | 'after' | 'between' {
    // Round-4 F2: an explicit user choice wins over the derived mode
    const override = this.dateModeOverrides()[col.columnKey];

    if (
      override === 'none' ||
      override === 'on' ||
      override === 'before' ||
      override === 'after' ||
      override === 'between'
    ) {
      return override;
    }

    const from = col.getDateFrom?.() ?? '';
    const to = col.getDateTo?.() ?? '';

    if (!from && !to) return 'none';
    if (from && to) return from === to ? 'on' : 'between';

    return to ? 'before' : 'after';
  }

  /**
   * Round-4 F1: translated trigger label for the date-mode select (values are raw
   * mode strings — without this the trigger shows 'none'/'between'/… verbatim).
   */
  protected readonly dateModeToString = (mode: string): string =>
    this.transloco.translate(`taskTable.dateMode.${mode}`);

  /**
   * Round-4 F2: switching modes NEVER invents dates (the old `today` fallback wrote
   * createdFrom=createdTo=<today> the moment 'between' was picked). Only EXISTING
   * bounds are rearranged; the UI-mode override keeps the chosen mode visible.
   */
  protected onDateModeChange(col: TaskColumnDef, mode: string): void {
    const from = col.getDateFrom?.() ?? '';
    const to = col.getDateTo?.() ?? '';

    switch (mode) {
      case 'none':
        this.clearDateModeOverride(col);
        col.setDateRange?.('', '');
        break;

      case 'on': {
        this.setDateModeOverride(col, mode);

        const d = from || to;

        col.setDateRange?.(d, d);
        break;
      }

      case 'before':
        this.setDateModeOverride(col, mode);
        col.setDateRange?.('', to || from);
        break;

      case 'after':
        this.setDateModeOverride(col, mode);
        col.setDateRange?.(from || to, '');
        break;

      case 'between': {
        this.setDateModeOverride(col, mode);

        if (from) {
          col.setDateRange?.(from, '');
        } else if (to) {
          col.setDateRange?.('', to);
        } else {
          col.setDateRange?.('', '');
        }
        break;
      }
    }
  }

  protected onDateFromChange(col: TaskColumnDef, value: Date | null): void {
    col.setDateRange?.(value ? TaskTable.toIsoDate(value) : '', col.getDateTo?.() ?? '');
  }

  protected onDateToChange(col: TaskColumnDef, value: Date | null): void {
    col.setDateRange?.(col.getDateFrom?.() ?? '', value ? TaskTable.toIsoDate(value) : '');
  }

  /** Single-bound modes ('on'/'before'/'after') share one picker */
  protected onSingleDateChange(col: TaskColumnDef, value: Date | null): void {
    const iso = value ? TaskTable.toIsoDate(value) : '';

    if (this.dateMode(col) === 'before') {
      col.setDateRange?.('', iso);
    } else {
      col.setDateRange?.(iso, this.dateMode(col) === 'on' ? iso : '');
    }
  }

  // ─── Q10 (RQ-04 ③): multi-select + bulk actions ────────────────────────────

  /** Toggle a single row's checkbox */
  protected toggleRowSelection(taskId: string, checked: boolean): void {
    const next = new Set(this.selectedIds());

    if (checked) {
      next.add(taskId);
    } else {
      next.delete(taskId);
    }
    this.selectedIds.set(next);
  }

  /** Header select-all — page-scoped (only the tasks currently loaded) */
  protected toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.tasks().map((task) => task.id)) : new Set());
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /** V9-4: resolve the selected status id to its label for the bulk trigger */
  protected readonly statusItemToString = (id: string) => this.refStore.nameOf(this.projectId(), 'statuses', id);

  /** Setting one bulk field clears the others (exactly-one contract) */
  protected onBulkStatusChange(value: string): void {
    this.bulkStatus.set(value);

    if (value) {
      this.bulkAssignee.set('');
      this.bulkSprint.set('');
    }
  }

  protected onBulkAssigneeChange(value: string): void {
    this.bulkAssignee.set(value);

    if (value) {
      this.bulkStatus.set('');
      this.bulkSprint.set('');
    }
  }

  protected onBulkSprintChange(value: string): void {
    this.bulkSprint.set(value);

    if (value) {
      this.bulkStatus.set('');
      this.bulkAssignee.set('');
    }
  }

  private resetBulkFields(): void {
    this.bulkStatus.set('');
    this.bulkAssignee.set('');
    this.bulkSprint.set('');
  }

  /** Apply the single chosen field to every selected task */
  protected applyBulkUpdate(): void {
    if (!this.canApplyBulk() || this.applyingBulk() || this.selectedCount() === 0) return;

    const data: BulkUpdateTasks['data'] = {};

    if (this.bulkStatus()) {
      data.statusId = this.bulkStatus();
    } else if (this.bulkAssignee()) {
      data.assigneeId = this.bulkAssignee() === BULK_UNASSIGNED ? null : this.bulkAssignee();
    } else if (this.bulkSprint()) {
      data.sprintId = this.bulkSprint() === BULK_NO_SPRINT ? null : this.bulkSprint();
    }

    this.applyingBulk.set(true);
    this.taskClient.bulkUpdate(this.projectId(), { taskIds: [...this.selectedIds()], data }).subscribe({
      next: (res) => {
        this.applyingBulk.set(false);

        if (res.failed && res.failed.length > 0) {
          this.notify.error('taskTable.bulk.partial', { count: res.updated, failed: res.failed.length });
        } else {
          this.notify.success('taskTable.bulk.success', { count: res.updated });
        }
        this.clearSelection();
        this.resetBulkFields();
        // Re-fetch the current page so updated rows are reflected
        this.reloadTick.update((tick) => tick + 1);
      },
      error: (err) => {
        this.applyingBulk.set(false);
        this.notify.error(getErrorMessage(err));
      },
    });
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
      // Q12: re-apply saved date ranges like any other criterion
      createdFrom: criteria.createdFrom ?? null,
      createdTo: criteria.createdTo ?? null,
      updatedFrom: criteria.updatedFrom ?? null,
      updatedTo: criteria.updatedTo ?? null,
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

    this.router.navigate(['/w', tenantSlug, 'projects', projectKey, 'tasks', 'new']);
  }
}
