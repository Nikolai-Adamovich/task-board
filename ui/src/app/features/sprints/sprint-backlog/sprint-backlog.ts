import { Component, inject, input, signal, OnInit, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TaskClient } from '@services/task-client';
import { PriorityDotColorMap, NeutralDotColor } from '@app/constants/priority';
import { finalize } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import type { Task, Sprint } from '@task-board/shared';

@Component({
  selector: 'ui-sprint-backlog',
  imports: [TranslocoPipe, RouterLink, HlmButtonImports, HlmSpinnerImports, HlmCardImports],
  templateUrl: './sprint-backlog.html',
})
export class SprintBacklog implements OnInit {
  private readonly taskClient = inject(TaskClient);
  readonly projectId = input.required<string>();
  readonly targetSprint = input<Sprint | null>(null);
  /** When set, task titles link to the canonical task URL (DEC-032) */
  readonly projectKey = input('');
  readonly tenantSlug = input('');
  readonly taskAdded = output<string>();
  protected readonly backlogTasks = signal<Task[]>([]);
  protected readonly loading = signal(true);

  protected getPriorityDot(priority: string): string {
    return (PriorityDotColorMap as Record<string, string>)[priority] ?? NeutralDotColor;
  }

  ngOnInit(): void {
    this.loadBacklog();
  }

  private loadBacklog(): void {
    this.loading.set(true);
    // Load tasks with no sprint (backlog)
    this.taskClient
      .list(this.projectId(), { sprintId: null, limit: 200 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.backlogTasks.set(res.data);
        },
        error: (err) => console.error(err),
      });
  }

  protected addTaskToSprint(task: Task): void {
    const sprint = this.targetSprint();

    if (!sprint) return;
    this.taskClient.update(task.id, { sprintId: sprint.id, version: task.version }).subscribe({
      next: () => {
        this.backlogTasks.update((list) => list.filter((t) => t.id !== task.id));
        this.taskAdded.emit(task.id);
      },
    });
  }
}
