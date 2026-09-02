import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { getTenantSlug } from '@app/shared/utils/route-utils';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX } from '@ng-icons/lucide';
import { CdkDragDrop, CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { ProjectRefStore } from '@stores/project-ref-store';
import { canWrite } from '@app/shared/utils/role-utils';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon } from '@ng-icons/core';
import type { BoardColumn, BoardConfig, BoardTask } from '@task-board/shared';
import type { TaskQuery } from '@services/task-client';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { priorityLabelKey, priorityLevelParam } from '@app/constants/priority';
import type { TaskPriorityLevel } from '@task-board/shared';
import type { TaskPriorityLevel as SharedPriorityLevel } from '@task-board/shared';
import { TaskCard } from '../task-card/task-card';
import { PRIORITY_OPTIONS } from '@app/constants/priority';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';

@Component({
  selector: 'ui-board-view',
  imports: [
    HlmAlertImports,
    TranslocoPipe,
    TaskCard,
    NgIcon,
    CdkDrag,
    CdkDropList,
    HlmButtonImports,
    HlmBadgeImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmSelectImports,
    HlmTooltipImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideX })],
  templateUrl: './board-view.html',
})
export class BoardView {
  private readonly notify = injectToasts();
  private readonly boardClient = inject(BoardClient);
  private readonly taskClient = inject(TaskClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly refStore = inject(ProjectRefStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly projectKey = input<string>('');
  /** Optional sprint filter from query params (`?sprintId=…`) */
  readonly sprintId = input<string | null>(null);
  /**
   * F-08: optional assignee filter from query params (`?assignee=…`).
   * Values: `me` (symbolic — resolved to the AuthStore user id at query time),
   * `unassigned` (client-side post-filter), or a concrete member user id.
   */
  readonly assignee = input<string | null>(null);
  /** F-08: optional priority filter from query params (`?priorityLevel=…`) */
  readonly priorityLevel = input<TaskPriorityLevel | null>(null, { transform: priorityLevelParam });
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  /** Board page header shows the project name — the board itself has no name (single-board model). */
  protected readonly projectName = computed(() => this.projectStore.activeProject()?.name ?? '');
  private readonly i18n = inject(TranslocoService);
  /** Tasks live under the active project */
  private readonly effectiveProjectId = this.projectId;
  // ─── Reads (rxResource — auto refetch/cancel when params change) ──────────
  private readonly boardResource = rxResource<BoardConfig | null, { projectId: string }>({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => (params.projectId ? this.boardClient.getForProject(params.projectId) : of(null)),
    defaultValue: null,
  });
  protected readonly board = computed(() => (this.boardResource.hasValue() ? this.boardResource.value() : null));
  private readonly tasksResource = rxResource({
    params: () => ({
      pid: this.effectiveProjectId(),
      sprintId: this.sprintId(),
      assignee: this.assignee(),
      priorityLevel: this.priorityLevel(),
    }),
    stream: ({ params }) => {
      const query: TaskQuery = { limit: 200 };

      if (params.sprintId) {
        query.sprintId = params.sprintId;
      }

      // F-08: concrete assignee/priority filters go server-side (same as sprintId).
      // `me` resolves to the current user id at query time; `unassigned` has no
      // server-side equivalent (exact-id match only) and is post-filtered below.
      const resolvedAssignee =
        params.assignee === 'me' ? (this.authStore.currentUser()?.id ?? '') : (params.assignee ?? '');

      if (resolvedAssignee && resolvedAssignee !== 'unassigned') {
        query.assigneeId = resolvedAssignee;
      }
      if (params.priorityLevel !== null && params.priorityLevel !== undefined) {
        query.priorityLevel = params.priorityLevel;
      }
      return this.taskClient.listForBoard(params.pid, query).pipe(map((res) => res.data));
    },
    defaultValue: [],
  });
  protected readonly tasks = computed(() => (this.tasksResource.hasValue() ? this.tasksResource.value() : []));
  /** F-08: client-side post-filter for the `unassigned` pseudo-value */
  protected readonly filteredTasks = computed(() => {
    const list = this.tasks();

    if (this.assignee() !== 'unassigned') return list;

    return list.filter((t) => !t.assigneeId);
  });
  /** Project members — powers the assignee filter options (shared ref store) */
  protected readonly memberOptions = computed(() => this.refStore.options(this.effectiveProjectId(), 'members'));
  /** Display label of the active assignee filter (chip + select trigger) */
  protected readonly selectedAssigneeLabel = computed(() => {
    const value = this.assignee();

    if (!value) return '';

    switch (value) {
      case 'me':
        return this.i18n.translate('boardView.currentUser');

      case 'unassigned':
        return this.i18n.translate('boardView.unassigned');

      default:
        return this.memberOptions().find((o) => o.id === value)?.name ?? value;
    }
  });

  /** Translated priority label (P11); unknown values render verbatim. */
  protected priorityLabel(priorityLevel: SharedPriorityLevel): string {
    const key = priorityLabelKey(priorityLevel);

    return key ? this.i18n.translate(key) : String(priorityLevel);
  }
  /** Display label of the active priority filter (chip + select trigger) */
  protected readonly selectedPriorityLabel = computed(() =>
    this.priorityLevel() !== null ? this.priorityLabel(this.priorityLevel() as SharedPriorityLevel) : '',
  );
  /**
   * Sprints of the board's project — powers the sprint selector (DEC-038).
   * F2: shared ProjectRefStore cache — no per-page duplicate request.
   */
  protected readonly sprints = computed(() => this.refStore.sprintEntities(this.effectiveProjectId()));
  /** Display name of the currently scoped sprint (falls back to the raw id) */
  protected readonly selectedSprintName = computed(() => {
    const id = this.sprintId();

    if (!id) return '';

    return this.sprints().find((s) => s.id === id)?.name ?? id;
  });
  protected readonly loading = computed(() => this.boardResource.isLoading());
  protected readonly error = computed(() => {
    const err = this.boardResource.error();

    return err ? getErrorMessage(err) : '';
  });
  // Reference data (statuses, task types for the card's bottom row) via the shared store
  protected readonly statusMap = computed(() => this.refStore.nameMap(this.effectiveProjectId(), 'statuses'));
  /** typeId → issue-type display name (board card bottom-left) */
  protected readonly typeMap = computed(() => this.refStore.nameMap(this.effectiveProjectId(), 'types'));

  constructor() {
    effect(() => {
      const pid = this.effectiveProjectId();

      if (!pid) return;

      // Track the entity lists so an invalidate() (sprint/status mutations)
      // re-runs this effect and refetches through ensure().
      this.refStore.sprintEntities(pid);
      this.refStore.statusEntities(pid);
      this.refStore.ensure(pid, ['statuses', 'sprints', 'members', 'types']);
    });
  }

  protected readonly canCreateTask = computed(() =>
    canWrite(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  /** itemToString helper for hlm-select to display human-readable status labels */
  protected readonly statusItemToString = (id: string) => this.statusMap()[id] ?? id;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  /** itemToString helper for the sprint selector — name + status badge text */
  protected readonly sprintItemToString = (id: string) => {
    const sprint = this.sprints().find((s) => s.id === id);

    return sprint ? `${sprint.name} (${sprint.status})` : id;
  };
  /** itemToString helper for the assignee filter — symbolic values resolve to labels */
  protected readonly assigneeItemToString = (value: string): string => {
    if (!value) return '';

    return value === this.assignee()
      ? (this.selectedAssigneeLabel() ?? '')
      : (this.memberOptions().find((o) => o.id === value)?.name ?? value);
  };
  /** itemToString helper for the priority filter */
  protected readonly priorityItemToString = (value: TaskPriorityLevel | ''): string =>
    value === '' ? '' : this.priorityLabel(value);

  /**
   * Write one board filter to the URL query params (replaceUrl, merged with
   * the other filters). Empty value clears it; the tasks resource refetches.
   */
  private setFilterParam(name: 'sprintId' | 'assignee' | 'priorityLevel', value: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [name]: value || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Sprint selector change → write `?sprintId=` to the URL (replaceUrl).
   * Empty value clears the scope; the tasks resource refetches automatically.
   */
  protected onSprintSelect(value: string): void {
    this.setFilterParam('sprintId', value);
  }

  /** Assignee filter change → write `?assignee=` (`me` stays symbolic in the URL) */
  protected onAssigneeSelect(value: string): void {
    this.setFilterParam('assignee', value);
  }

  /** Priority filter change → write `?priority=` */
  protected onPrioritySelect(value: string | number): void {
    const level = value === '' || value === null ? null : Number(value);

    this.setFilterParam('priorityLevel', level === null ? '' : String(level));
  }
  protected readonly showStatusSelect = signal(false);
  protected readonly pendingDrop = signal<{ task: BoardTask; targetColumn: BoardColumn } | null>(null);
  /**
   * S-08: display name per column id — computed once per change instead of
   * re-running per column on every CD cycle.
   */
  protected readonly columnNames = computed(() => {
    const map = new Map<string, string>();
    const statusNames = this.statusMap();

    for (const col of this.board()?.columns ?? []) {
      const names = col.statusIds.map((id) => statusNames[id]).filter(Boolean);

      map.set(col.id, names.length > 0 ? names.join(' / ') : `Column ${col.position + 1}`);
    }

    return map;
  });
  /**
   * V4-12: statusId → the single column that owns it. Board documents may contain
   * overlapping statusIds across columns (e.g. an "In Progress / Reopened" column
   * next to a pure "In Progress" column); assigning each status to exactly one
   * owner column guarantees every task renders in exactly ONE column — its actual
   * status. Ownership prefers the MOST SPECIFIC column (fewest statusIds), then
   * the lowest position — so an IN_PROGRESS task lands in the dedicated
   * "In Progress" column, while REOPENED stays in the combined column.
   */
  private readonly columnOwnerByStatusId = computed(() => {
    const owner = new Map<string, BoardColumn>();
    const b = this.board();

    if (!b) return owner;

    for (const col of [...b.columns].sort(
      (a, z) => a.statusIds.length - z.statusIds.length || a.position - z.position,
    )) {
      for (const statusId of col.statusIds) {
        if (!owner.has(statusId)) owner.set(statusId, col);
      }
    }

    return owner;
  });
  /**
   * S-08: tasks per owned column (V4-12 ownership semantics preserved via
   * `columnOwnerByStatusId`) — computed once per change instead of
   * filter+sort per column on every CD cycle.
   *
   * Column order: severity first (CRITICAL → LOW), ties by number ascending.
   * `priority` is a semantic enum (alphabetical order ≠ severity), so a Mongo
   * index sort on the raw field cannot produce severity order — this is done
   * client-side over the ≤200 loaded cards instead (a Mongo-side sort would
   * require a denormalized numeric priorityRank field; see board payload audit).
   */
  protected readonly tasksByColumnId = computed(() => {
    const owner = this.columnOwnerByStatusId();
    const map = new Map<string, BoardTask[]>();

    for (const col of this.board()?.columns ?? []) map.set(col.id, []);

    for (const task of this.filteredTasks()) {
      const column = owner.get(task.statusId);
      const list = column ? map.get(column.id) : undefined;

      if (list) list.push(task);
    }

    // severity order is the numeric level itself: DESC puts CRITICAL (3) first
    for (const list of map.values()) list.sort((a, b) => b.priorityLevel - a.priorityLevel || a.number - b.number);

    return map;
  });

  /** Get all unique statusIds from board columns */
  protected get allStatusIds(): string[] {
    const b = this.board();

    if (!b) return [];

    return b.columns.flatMap((c) => c.statusIds);
  }

  /** Navigate to the unified create-task page (U1 — replaces the board dialog) */
  goToNewTask(): void {
    const projectKey = this.route.snapshot.paramMap.get('projectKey') ?? this.projectStore.activeProject()?.key ?? '';

    this.router.navigate(['/w', getTenantSlug(this.route), 'projects', projectKey, 'tasks', 'new']);
  }

  /** Handle CDK drag-drop event */
  protected onTaskDrop(event: CdkDragDrop<BoardTask[], BoardTask[], BoardTask>, column: BoardColumn): void {
    const task = event.item.data;

    if (!task) return;

    // If dropped in the same column, do nothing
    if (event.previousContainer === event.container) return;

    // If column has multiple statuses, prompt user to select
    if (column.statusIds.length > 1) {
      this.pendingDrop.set({ task, targetColumn: column });
      this.showStatusSelect.set(true);
      return;
    }

    // Single status column — apply directly
    const targetStatusId = column.statusIds[0];

    if (targetStatusId) {
      this.moveTaskToStatus(task, targetStatusId);
    }
  }

  /** Apply the selected status from the multi-status prompt */
  protected applyStatusSelection(statusId: string): void {
    const pending = this.pendingDrop();

    if (pending) {
      this.moveTaskToStatus(pending.task, statusId);
    }
    this.showStatusSelect.set(false);
    this.pendingDrop.set(null);
  }

  protected onStatusSelectDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showStatusSelect.set(false);
      this.pendingDrop.set(null);
    }
  }

  /** Move a task to a new status via the API */
  private moveTaskToStatus(task: BoardTask, statusId: string): void {
    this.taskClient.update(task.id, { statusId, version: task.version }).subscribe({
      next: (updated) => {
        if (this.tasksResource.hasValue()) {
          this.tasksResource.value.update((list) => list.map((t) => (t.id === task.id ? updated : t)));
        } else {
          this.tasksResource.reload();
        }
      },
      error: (err) => {
        // Surface failures (incl. version conflicts) — silent drops confuse users
        this.notify.error(getErrorMessage(err));
        this.tasksResource.reload();
      },
    });
  }

  /** Get the CDK drop list IDs for all columns */
  protected getColumnDropId(column: BoardColumn): string {
    return `column-${column.id}`;
  }

  protected goToTask(task: BoardTask): void {
    const projectKey =
      this.route.snapshot.paramMap.get('projectKey') ?? this.projectStore.activeProject()?.key ?? task.projectId;

    // Canonical task URL uses the project key + task number (DEC-032)
    this.router.navigate([
      '/w',
      getTenantSlug(this.route),
      'projects',
      projectKey,
      'tasks',
      `${projectKey}-${task.number}`,
    ]);
  }
}
