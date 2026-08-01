import { Component, inject, input, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { SprintClient } from '@services/sprint-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import {
  PriorityColorMap,
  StatusColorMap,
  NeutralColor,
  PriorityDotColorMap,
  NeutralDotColor,
} from '@app/constants/priority';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon } from '@ng-icons/core';
import type { Sprint, Task } from '@task-board/shared';

@Component({
  selector: 'ui-sprint-detail',
  imports: [RouterLink, DatePipe, NgIcon, HlmButtonImports, HlmSpinnerImports, HlmBadgeImports],
  providers: [provideIcons({ lucideX })],
  templateUrl: './sprint-detail.html',
})
export class SprintDetail implements OnInit {
  private readonly sprintClient = inject(SprintClient);
  private readonly taskClient = inject(TaskClient);
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
    return (StatusColorMap as Record<string, string>)[status] ?? NeutralColor;
  }

  protected getPriorityDot(priority: string): string {
    return (PriorityDotColorMap as Record<string, string>)[priority] ?? NeutralDotColor;
  }

  protected getPriorityBadge(priority: string): string {
    return (PriorityColorMap as Record<string, string>)[priority] ?? NeutralColor;
  }

  ngOnInit(): void {
    this.loadSprint();
  }

  private loadSprint(): void {
    this.loading.set(true);
    this.sprintClient
      .getById(this.sprintId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (sprint) => {
          this.sprint.set(sprint);
          this.loadSprintTasks(sprint);
        },
        error: (err) => console.error(err),
      });
  }

  private loadSprintTasks(sprint: Sprint): void {
    if (sprint.taskIds.length === 0) return;
    this.taskClient.list({ sprintId: sprint.id, limit: 200 }).subscribe({
      next: (res) => this.sprintTasks.set(res.data),
      error: (err) => console.error(err),
    });
  }

  protected removeTaskFromSprint(taskId: string): void {
    const s = this.sprint();

    if (!s) return;
    this.sprintClient.removeTask(s.id, taskId).subscribe({
      next: () => {
        this.sprintTasks.update((list) => list.filter((t) => t.id !== taskId));
        this.sprint.update((sp) => (sp ? { ...sp, taskIds: sp.taskIds.filter((id) => id !== taskId) } : null));
      },
    });
  }
}
