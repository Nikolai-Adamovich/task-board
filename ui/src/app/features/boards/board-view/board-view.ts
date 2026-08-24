import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { getTenantId } from '@app/shared/utils/route-utils';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { CdkDragDrop, CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { TaskPriority } from '@task-board/shared';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { StatusClient } from '@services/status-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { canWrite } from '@app/shared/utils/role-utils';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon } from '@ng-icons/core';
import { finalize } from 'rxjs';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Board, BoardColumn, Task } from '@task-board/shared';
import type { TaskQuery } from '@services/task-client';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { TaskCard } from '../task-card/task-card';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

interface CreateTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
  statusId: string;
  typeId: string;
}

@Component({
  selector: 'ui-board-view',
  imports: [
    HlmAlertImports,
    TranslocoPipe,
    FormField,
    TaskCard,
    NgIcon,
    CdkDrag,
    CdkDropList,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmSelectImports,
    FormRoot,
  ],
  providers: [provideIcons({ lucidePlus })],
  templateUrl: './board-view.html',
})
export class BoardView implements OnInit {
  private readonly notify = injectToasts();
  private readonly boardClient = inject(BoardClient);
  private readonly taskClient = inject(TaskClient);
  private readonly statusClient = inject(StatusClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly canCreateTask = computed(() =>
    canWrite(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  /** Bound via withComponentInputBinding() */
  readonly boardId = input.required<string>();
  readonly projectKey = input<string>('');
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly board = signal<Board | null>(null);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly statusMap = signal<Record<string, string>>({});
  /** itemToString helper for hlm-select to display human-readable status labels */
  protected readonly statusItemToString = (id: string) => this.statusMap()[id] ?? id;
  /** Optional sprint filter from query params */
  protected readonly sprintId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateTask = signal(false);
  protected readonly showStatusSelect = signal(false);
  protected readonly pendingDrop = signal<{ task: Task; targetColumn: BoardColumn } | null>(null);
  protected readonly model = signal<CreateTaskForm>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM,
    statusId: '',
    typeId: '',
  });
  protected readonly newTaskForm = form(
    this.model,
    schema<CreateTaskForm>((field) => {
      required(field.title, { message: 'validation.titleRequired' });
      required(field.statusId, { message: 'validation.statusRequired' });
      required(field.typeId, { message: 'validation.typeRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          const m = this.model();
          const pid = this.board()?.projectId ?? this.projectId();

          if (!m.title || !pid) return;

          this.taskClient
            .create(pid, {
              title: m.title,
              description: m.description || undefined,
              statusId: m.statusId,
              typeId: m.typeId,
              priority: m.priority,
            })
            .subscribe({
              next: (task) => {
                this.tasks.update((list) => [...list, task]);
                this.showCreateTask.set(false);
                this.notify.success('toasts.created');
                f().reset({
                  title: '',
                  description: '',
                  priority: TaskPriority.MEDIUM,
                  statusId: '',
                  typeId: '',
                });
              },
              error: (err) => {
                this.error.set(getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  /** Get display name for a board column */
  protected getColumnName(column: BoardColumn): string {
    const map = this.statusMap();
    const names = column.statusIds.map((id) => map[id]).filter(Boolean);

    return names.length > 0 ? names.join(' / ') : `Column ${column.position + 1}`;
  }

  /** Get tasks for a specific column based on its statusIds */
  protected getTasksForColumn(column: BoardColumn): Task[] {
    return this.tasks()
      .filter((t) => column.statusIds.includes(t.statusId))
      .sort((a, b) => a.number - b.number);
  }

  /** Get all unique statusIds from board columns */
  protected get allStatusIds(): string[] {
    const b = this.board();

    if (!b) return [];

    return b.columns.flatMap((c) => c.statusIds);
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateTask.set(false);
    }
  }

  /** Handle CDK drag-drop event */
  protected onTaskDrop(event: CdkDragDrop<Task[], Task[], Task>, column: BoardColumn): void {
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
  private moveTaskToStatus(task: Task, statusId: string): void {
    this.taskClient.update(task.id, { statusId, version: task.version }).subscribe({
      next: (updated) => {
        this.tasks.update((list) => list.map((t) => (t.id === task.id ? updated : t)));
      },
      error: (err) => console.error('Failed to move task:', err),
    });
  }

  /** Get the CDK drop list IDs for all columns */
  protected getColumnDropId(column: BoardColumn): string {
    return `column-${column.id}`;
  }

  ngOnInit(): void {
    // Read sprintId from query params
    this.route.queryParams.subscribe((params) => {
      this.sprintId.set(params['sprintId'] ?? null);
      // Reload tasks if board is already loaded
      if (this.board()) {
        this.loadTasks();
      }
    });
    this.loadBoard();
  }

  private loadBoard(): void {
    this.loading.set(true);
    this.boardClient
      .getById(this.boardId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (board) => {
          this.board.set(board);
          this.loadStatuses();
          this.loadTasks();
        },
        error: (err) => console.error(err),
      });
  }

  private loadTasks(): void {
    const pid = this.board()?.projectId ?? this.projectId();

    if (!pid) return;

    const query: TaskQuery = { limit: 200 };
    // Apply sprint filter if present
    const sid = this.sprintId();

    if (sid) {
      query.sprintId = sid;
    }

    this.taskClient.list(pid, query).subscribe({
      next: (res) => this.tasks.set(res.data),
    });
  }

  private loadStatuses(): void {
    const pid = this.board()?.projectId ?? this.projectId();

    if (!pid) return;

    this.statusClient.list(pid).subscribe({
      next: (statuses) => {
        const map: Record<string, string> = {};

        for (const s of statuses) {
          map[s.id] = s.name;
        }
        this.statusMap.set(map);
      },
    });
  }

  protected goToTask(task: Task): void {
    const projectKey = this.projectStore.activeProject()?.key ?? task.projectId;

    // Navigate using route params (tenantId, projectKey from URL)
    this.router.navigate(['/tenants', getTenantId(this.route), 'projects', projectKey, 'tasks', task.id]);
  }
}
