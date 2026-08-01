import { Component, inject, input, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { TaskPriority } from '@task-board/shared';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { HttpErrorResponse } from '@angular/common/http';
import { ColumnView } from '../column-view/column-view';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { NgIcon } from '@ng-icons/core';
import { finalize } from 'rxjs';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Board, Column, Task } from '@task-board/shared';
import type { TaskQuery } from '@services/task-client';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

interface CreateTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
  columnId: string;
}

@Component({
  selector: 'ui-board-view',
  imports: [
    FormField,
    ColumnView,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmNativeSelectImports,
    FormRoot,
  ],
  providers: [provideIcons({ lucidePlus })],
  templateUrl: './board-view.html',
})
export class BoardView implements OnInit {
  private readonly boardClient = inject(BoardClient);
  private readonly taskClient = inject(TaskClient);
  private readonly router = inject(Router);
  /** Bound via withComponentInputBinding() */
  readonly boardId = input.required<string>();
  readonly projectId = input<string>('');
  protected readonly board = signal<Board | null>(null);
  protected readonly columns = signal<Column[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateTask = signal(false);
  private readonly model = signal<CreateTaskForm>({
    title: '',
    description: '',
    priority: TaskPriority.Medium,
    columnId: '',
  });
  protected readonly newTaskForm = form(
    this.model,
    schema<CreateTaskForm>((field) => {
      required(field.title, { message: 'Title is required' });
      required(field.columnId, { message: 'Column is required' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          const title = this.model().title;
          const columnId = this.model().columnId;

          if (!title || !columnId) return;

          this.taskClient
            .create({
              title,
              description: this.model().description,
              projectId: this.board()?.projectId ?? '',
              boardId: this.boardId(),
              columnId,
              priority: this.model().priority,
              assigneeIds: [],
            })
            .subscribe({
              next: (task) => {
                this.tasks.update((list) => [...list, task]);
                this.showCreateTask.set(false);
                this.resetForm();
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateTask.set(false);
      this.resetForm();
    }
  }

  ngOnInit(): void {
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
          this.loadColumns();
          this.loadTasks();
        },
      });
  }

  private loadColumns(): void {
    this.boardClient.listColumns(this.boardId()).subscribe({
      next: (res) => {
        const sorted = res.data.sort((a, b) => a.position - b.position);

        this.columns.set(sorted);
        if (sorted.length > 0 && !this.model().columnId) {
          this.model.update((m) => ({ ...m, columnId: sorted[0].id }));
        }
      },
    });
  }

  private loadTasks(): void {
    const query: TaskQuery = { boardId: this.boardId(), limit: 200 };

    this.taskClient.list(query).subscribe({
      next: (res) => this.tasks.set(res.data),
    });
  }

  protected getTasksForColumn(columnId: string): Task[] {
    return this.tasks()
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  protected onTaskDrop(event: { task: Task; targetColumnId: string }): void {
    if (event.task.columnId === event.targetColumnId) return;

    this.taskClient
      .move({
        taskId: event.task.id,
        targetColumnId: event.targetColumnId,
      })
      .subscribe({
        next: (updatedTask) => {
          this.tasks.update((list) => list.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
        },
      });
  }

  protected goToTask(task: Task): void {
    this.router.navigate(['/tenants', task.tenantId, 'projects', task.projectId, 'tasks', task.id]);
  }

  private resetForm(): void {
    this.model.set({
      title: '',
      description: '',
      priority: TaskPriority.Medium,
      columnId: this.columns()[0]?.id ?? '',
    });
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
