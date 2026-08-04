import { Component, inject, input, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { PriorityColorMap, NeutralColor } from '@app/constants/priority';
import { TaskPriority } from '@task-board/shared';
import { HttpErrorResponse } from '@angular/common/http';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { finalize } from 'rxjs';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Task } from '@task-board/shared';

export interface EditTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
}

@Component({
  selector: 'ui-task-detail',
  imports: [
    DatePipe,
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmAvatarImports,
    HlmNativeSelectImports,
    HlmDialogImports,
  ],
  templateUrl: './task-detail.html',
})
export class TaskDetail implements OnInit {
  private readonly taskClient = inject(TaskClient);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  /** Bound via withComponentInputBinding() */
  readonly taskId = input.required<string>();
  protected readonly task = signal<Task | null>(null);
  protected readonly loading = signal(true);
  protected readonly isEditing = signal(false);
  protected readonly error = signal('');
  protected readonly showDeleteConfirm = signal(false);
  private readonly taskToDelete = signal<Task | null>(null);
  private readonly model = signal<EditTaskForm>({
    title: '',
    description: '',
    priority: TaskPriority.Medium,
  });
  protected readonly editForm = form(
    this.model,
    schema<EditTaskForm>((field) => {
      required(field.title, { message: 'validation.titleRequired' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');
          this.taskClient
            .update(this.taskId(), {
              title: this.model().title,
              description: this.model().description,
              priority: this.model().priority,
            })
            .subscribe({
              next: (updated) => {
                this.task.set(updated);
                this.isEditing.set(false);
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  ngOnInit(): void {
    this.loadTask();
  }

  private loadTask(): void {
    this.loading.set(true);
    this.taskClient
      .getById(this.taskId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (task) => {
          this.task.set(task);
        },
        error: (err) => this.error.set(this.getErrorMessage(err)),
      });
  }

  protected getPriorityColor(priority: string): string {
    return (PriorityColorMap as Record<string, string>)[priority] ?? NeutralColor;
  }

  protected canDelete(): boolean {
    return !!this.authStore.currentUser();
  }

  protected startEdit(): void {
    const t = this.task();

    if (t) {
      this.model.set({
        title: t.title,
        description: t.description ?? '',
        priority: t.priority as TaskPriority,
      });
      this.isEditing.set(true);
    }
  }

  protected cancelEdit(): void {
    this.model.set({
      title: '',
      description: '',
      priority: TaskPriority.Medium,
    });
    this.isEditing.set(false);
  }

  protected confirmDeleteTask(task: Task): void {
    this.taskToDelete.set(task);
    this.showDeleteConfirm.set(true);
  }

  protected onDeleteDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteConfirm.set(false);
      this.taskToDelete.set(null);
    }
  }

  protected deleteTask(): void {
    const task = this.taskToDelete();

    if (!task) return;

    this.taskClient.delete(task.id).subscribe({
      next: () => {
        this.router.navigate(['/tenants', task.tenantId, 'projects', task.projectId]);
      },
    });
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'errors.unexpected';
  }
}
