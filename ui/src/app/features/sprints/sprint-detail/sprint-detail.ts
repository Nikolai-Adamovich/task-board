import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { getTenantId } from '@app/shared/utils/route-utils';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { SprintClient } from '@services/sprint-client';
import { TaskClient } from '@services/task-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { canManageProject } from '@app/shared/utils/role-utils';
import { PriorityDotColorMap, NeutralDotColor, priorityBadgeVariant, type BadgeVariant } from '@app/constants/priority';
import { SprintStatus } from '@task-board/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { NgIcon } from '@ng-icons/core';
import type { Sprint, Task } from '@task-board/shared';
import { statusBadgeVariant } from '@app/constants/priority';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'ui-sprint-detail',
  imports: [
    ConfirmDialog,
    HlmEmptyImports,
    RouterLink,
    DatePipe,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmBadgeImports,
    HlmDialogImports,
  ],
  providers: [provideIcons({ lucideX })],
  templateUrl: './sprint-detail.html',
})
export class SprintDetail implements OnInit {
  /** Shared badge-class helper (see constants/priority.ts) */
  protected readonly statusBadgeVariant = statusBadgeVariant;
  private readonly sprintClient = inject(SprintClient);
  private readonly taskClient = inject(TaskClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** Bound via withComponentInputBinding() */
  readonly sprintId = input.required<string>();
  protected readonly sprint = signal<Sprint | null>(null);
  protected readonly tenantId = signal<string>('');
  protected readonly sprintTasks = signal<Task[]>([]);
  protected readonly loading = signal(true);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly canManage = computed(() => {
    return canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole());
  });

  protected getPriorityDot(priority: string): string {
    return (PriorityDotColorMap as Record<string, string>)[priority] ?? NeutralDotColor;
  }

  protected getPriorityBadge(priority: string): BadgeVariant {
    return priorityBadgeVariant(priority);
  }

  /** Get available status transitions for the current sprint */
  protected get availableTransitions(): { label: string; status: string }[] {
    const s = this.sprint();

    if (!s) return [];

    switch (s.status) {
      case SprintStatus.FUTURE:
        return [{ label: 'Start Sprint', status: SprintStatus.ACTIVE }];

      case SprintStatus.ACTIVE:
        return [{ label: 'Complete Sprint', status: SprintStatus.COMPLETED }];

      case SprintStatus.COMPLETED:
        return [{ label: 'Reopen Sprint', status: SprintStatus.ACTIVE }];

      default:
        return [];
    }
  }

  protected transitionSprint(newStatus: string): void {
    const s = this.sprint();

    if (!s) return;

    this.sprintClient.update(s.id, { status: newStatus as Sprint['status'] }).subscribe({
      next: (sprint) => {
        this.sprint.set(sprint);
      },
      error: (err) => console.error(err),
    });
  }

  protected onDeleteDialogStateChange(open: boolean): void {
    if (!open) {
      this.showDeleteConfirm.set(false);
    }
  }

  protected deleteSprint(): void {
    const s = this.sprint();

    if (!s) return;

    this.sprintClient.delete(s.id).subscribe({
      next: () => {
        const projectKey = this.projectStore.activeProject()?.key ?? s.projectId;

        this.router.navigate(['/tenants', getTenantId(this.route), 'projects', projectKey]);
      },
      error: (err) => console.error(err),
    });
  }

  ngOnInit(): void {
    this.tenantId.set(getTenantId(this.route));
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
          this.loadSprintTasks(sprint.projectId);
        },
        error: (err) => console.error(err),
      });
  }

  private loadSprintTasks(projectId: string): void {
    this.taskClient.list(projectId, { sprintId: this.sprintId(), limit: 200 }).subscribe({
      next: (res) => this.sprintTasks.set(res.data),
      error: (err) => console.error(err),
    });
  }

  protected removeTaskFromSprint(task: Task): void {
    this.taskClient.update(task.id, { sprintId: null, version: task.version }).subscribe({
      next: () => {
        this.sprintTasks.update((list) => list.filter((t) => t.id !== task.id));
      },
    });
  }
}
