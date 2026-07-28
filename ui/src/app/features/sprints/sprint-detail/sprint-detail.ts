import { Component, inject, input, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { SprintClient } from '../../../services/sprint-client';
import { TaskClient } from '../../../services/task-client';
import { AuthStore } from '../../../stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon } from '@ng-icons/core';
import type { Sprint, Task } from '@task-board/shared';

const statusColorMap: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
};

@Component({
  selector: 'app-sprint-detail',
  imports: [RouterLink, DatePipe, NgIcon, HlmButtonImports, HlmSpinnerImports, HlmBadgeImports],
  providers: [provideIcons({ lucideX })],
  templateUrl: './sprint-detail.html',
})
export class SprintDetail implements OnInit {
  private readonly sprintService = inject(SprintClient);
  private readonly taskService = inject(TaskClient);
  private readonly authStore = inject(AuthStore);

  /** Bound via withComponentInputBinding() */
  readonly sprintId = input.required<string>();

  protected readonly sprint = signal<Sprint | null>(null);
  protected readonly sprintTasks = signal<Task[]>([]);
  protected readonly loading = signal(true);

  protected canManage(): boolean {
    return !!this.authStore.currentUser();
  }

  protected getStatusColor(status: string): string {
    return statusColorMap[status] ?? 'bg-gray-100 text-gray-700';
  }

  protected getPriorityDot(priority: string): string {
    const map: Record<string, string> = {
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500',
    };
    return map[priority] ?? 'bg-gray-500';
  }

  protected getPriorityBadge(priority: string): string {
    const map: Record<string, string> = {
      low: 'bg-blue-100 text-blue-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return map[priority] ?? 'bg-gray-100 text-gray-700';
  }

  ngOnInit(): void {
    this.loadSprint();
  }

  private loadSprint(): void {
    this.loading.set(true);
    this.sprintService.getById(this.sprintId()).subscribe({
      next: (sprint) => {
        this.sprint.set(sprint);
        this.loadSprintTasks(sprint);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSprintTasks(sprint: Sprint): void {
    if (sprint.taskIds.length === 0) return;
    this.taskService.list({ sprintId: sprint.id, limit: 200 }).subscribe({
      next: (res) => this.sprintTasks.set(res.data),
    });
  }

  protected removeTaskFromSprint(taskId: string): void {
    const s = this.sprint();
    if (!s) return;
    this.sprintService.removeTask(s.id, taskId).subscribe({
      next: () => {
        this.sprintTasks.update((list) => list.filter((t) => t.id !== taskId));
        this.sprint.update((sp) => (sp ? { ...sp, taskIds: sp.taskIds.filter((id) => id !== taskId) } : null));
      },
    });
  }
}
