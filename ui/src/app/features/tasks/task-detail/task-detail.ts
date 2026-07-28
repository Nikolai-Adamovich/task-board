import { Component, inject, input, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskClient } from '../../../services/task-client';
import { AuthStore } from '../../../stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import type { Task, UpdateTask } from '@task-board/shared';

const priorityColorMap: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

@Component({
  selector: 'app-task-detail',
  imports: [
    DatePipe,
    FormsModule,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmAvatarImports,
    HlmNativeSelectImports,
  ],
  templateUrl: './task-detail.html',
})
export class TaskDetail implements OnInit {
  private readonly taskService = inject(TaskClient);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  /** Bound via withComponentInputBinding() */
  readonly taskId = input.required<string>();

  protected readonly task = signal<Task | null>(null);
  protected readonly loading = signal(true);
  protected readonly isEditing = signal(false);
  protected readonly saving = signal(false);
  protected editForm: UpdateTask = {};

  ngOnInit(): void {
    this.loadTask();
  }

  private loadTask(): void {
    this.loading.set(true);
    this.taskService.getById(this.taskId()).subscribe({
      next: (task) => {
        this.task.set(task);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected getPriorityColor(priority: string): string {
    return priorityColorMap[priority] ?? 'bg-gray-100 text-gray-700';
  }

  protected canDelete(): boolean {
    return !!this.authStore.currentUser();
  }

  protected startEdit(): void {
    const t = this.task();
    if (t) {
      this.editForm = {
        title: t.title,
        description: t.description ?? '',
        priority: t.priority,
      };
      this.isEditing.set(true);
    }
  }

  protected cancelEdit(): void {
    this.editForm = {};
    this.isEditing.set(false);
  }

  protected saveTask(): void {
    const t = this.task();
    if (!t) return;
    this.saving.set(true);
    this.taskService.update(t.id, this.editForm).subscribe({
      next: (updated) => {
        this.task.set(updated);
        this.isEditing.set(false);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected deleteTask(task: Task): void {
    if (!confirm('Are you sure you want to delete this task?')) return;
    this.taskService.delete(task.id).subscribe({
      next: () => {
        this.router.navigate(['/tenants', task.tenantId, 'projects', task.projectId]);
      },
    });
  }
}
