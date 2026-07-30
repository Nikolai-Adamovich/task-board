import { Component, inject, input, signal, OnInit, output } from '@angular/core';
import { SprintClient } from '@services/sprint-client';
import { TaskClient } from '@services/task-client';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import type { Task, Sprint } from '@task-board/shared';

@Component({
  selector: 'ui-sprint-backlog',
  imports: [HlmButtonImports, HlmSpinnerImports, HlmCardImports],
  templateUrl: './sprint-backlog.html',
})
export class SprintBacklog implements OnInit {
  private readonly taskClient = inject(TaskClient);
  private readonly sprintClient = inject(SprintClient);
  readonly projectId = input.required<string>();
  readonly boardId = input<string>('');
  readonly targetSprint = input<Sprint | null>(null);
  readonly taskAdded = output<string>();
  protected readonly backlogTasks = signal<Task[]>([]);
  protected readonly loading = signal(true);

  protected getPriorityDot(priority: string): string {
    const map: Record<string, string> = {
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500',
    };

    return map[priority] ?? 'bg-gray-500';
  }

  ngOnInit(): void {
    this.loadBacklog();
  }

  private loadBacklog(): void {
    this.loading.set(true);
    // Load tasks with no sprint (backlog)
    this.taskClient.list({ projectId: this.projectId(), sprintId: null, limit: 200 }).subscribe({
      next: (res) => {
        this.backlogTasks.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected addTaskToSprint(taskId: string): void {
    const sprint = this.targetSprint();

    if (!sprint) return;
    this.sprintClient.addTask(sprint.id, taskId).subscribe({
      next: () => {
        this.backlogTasks.update((list) => list.filter((t) => t.id !== taskId));
        this.taskAdded.emit(taskId);
      },
    });
  }
}
