import { Component, inject, input, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { BoardClient } from '@services/board-client';
import { TaskClient } from '@services/task-client';
import { ColumnView } from '../column-view/column-view';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { NgIcon } from '@ng-icons/core';
import type { Board, Column, Task, CreateTask } from '@task-board/shared';
import type { TaskQuery } from '@services/task-client';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'ui-board-view',
  imports: [
    ColumnView,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmNativeSelectImports,
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
  protected readonly showCreateTask = signal(false);
  protected readonly creatingTask = signal(false);
  protected newTask: CreateTask = {
    title: '',
    description: '',
    projectId: '',
    boardId: '',
    columnId: '',
    priority: 'medium',
    assigneeIds: [],
  };

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateTask.set(false);
    }
  }

  ngOnInit(): void {
    this.loadBoard();
  }

  private loadBoard(): void {
    this.loading.set(true);
    this.boardClient.getById(this.boardId()).subscribe({
      next: (board) => {
        this.board.set(board);
        this.newTask.projectId = board.projectId;
        this.newTask.boardId = board.id;
        this.loadColumns();
        this.loadTasks();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadColumns(): void {
    this.boardClient.listColumns(this.boardId()).subscribe({
      next: (res) => {
        const sorted = res.data.sort((a, b) => a.position - b.position);

        this.columns.set(sorted);
        if (sorted.length > 0 && !this.newTask.columnId) {
          this.newTask.columnId = sorted[0].id;
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

  protected createTask(): void {
    if (!this.newTask.title || !this.newTask.columnId) return;
    this.creatingTask.set(true);
    this.taskClient.create(this.newTask).subscribe({
      next: (task) => {
        this.tasks.update((list) => [...list, task]);
        this.showCreateTask.set(false);
        this.newTask = {
          title: '',
          description: '',
          projectId: this.board()?.projectId ?? '',
          boardId: this.boardId(),
          columnId: this.columns()[0]?.id ?? '',
          priority: 'medium',
          assigneeIds: [],
        };
        this.creatingTask.set(false);
      },
      error: () => this.creatingTask.set(false),
    });
  }
}
