import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideCalendar, lucideChevronRight, lucideChevronsUpDown } from '@ng-icons/lucide';
import { SprintClient } from '@services/sprint-client';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { NgIcon } from '@ng-icons/core';
import type { Sprint, CreateSprint, Project } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

/** A project group with its sprints */
interface ProjectSprintGroup {
  projectId: string;
  projectName: string;
  tenantId: string;
  sprints: Sprint[];
}

const statusColorMap: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
};

@Component({
  selector: 'ui-sprint-list',
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmCollapsibleImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideCalendar, lucideChevronRight, lucideChevronsUpDown })],
  templateUrl: './sprint-list.html',
})
export class SprintList implements OnInit {
  private readonly sprintClient = inject(SprintClient);
  private readonly projectClient = inject(ProjectClient);
  private readonly authStore = inject(AuthStore);
  /** Bound via withComponentInputBinding() — optional for tenant-level view */
  readonly projectId = input<string>();
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly showCreateModal = signal(false);
  /** Track which project groups are expanded */
  protected readonly expandedGroups = signal<Record<string, boolean>>({});
  protected startDateStr = '';
  protected endDateStr = '';
  protected newSprint: Omit<CreateSprint, 'startDate' | 'endDate'> & {
    startDate?: string;
    endDate?: string;
  } = { name: '', goal: '' };
  /** Group sprints by project (only used in tenant-level view) */
  protected readonly projectGroups = computed<ProjectSprintGroup[]>(() => {
    const projectId = this.projectId();

    if (projectId) return [];

    const sprints = this.sprints();
    const projects = this.projects();
    const groupMap = new Map<string, Sprint[]>();

    for (const sprint of sprints) {
      const group = groupMap.get(sprint.projectId) ?? [];

      group.push(sprint);
      groupMap.set(sprint.projectId, group);
    }

    return Array.from(groupMap.entries()).map(([pid, groupSprints]) => ({
      projectId: pid,
      projectName: projects.find((p) => p.id === pid)?.name ?? pid,
      tenantId: groupSprints[0].tenantId,
      sprints: groupSprints,
    }));
  });

  protected canCreate(): boolean {
    return !!this.authStore.currentUser() && !!this.projectId();
  }

  protected getStatusColor(status: string): string {
    return statusColorMap[status] ?? 'bg-gray-100 text-gray-700';
  }

  protected isGroupExpanded(projectId: string): boolean {
    return this.expandedGroups()[projectId] !== false;
  }

  protected toggleGroup(projectId: string): void {
    this.expandedGroups.update((groups) => ({
      ...groups,
      [projectId]: groups[projectId] === false,
    }));
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateModal.set(false);
    }
  }

  ngOnInit(): void {
    this.loadSprints();
  }

  private loadSprints(): void {
    this.loading.set(true);

    const projectId = this.projectId();

    if (projectId) {
      this.sprintClient.list(projectId).subscribe({
        next: (res) => {
          this.sprints.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      // Tenant-level view: load sprints and projects in parallel
      this.sprintClient.listByTenant().subscribe({
        next: (sprintRes) => {
          this.sprints.set(sprintRes.data);

          // Load projects to resolve names
          this.projectClient.list(1, 100).subscribe({
            next: (projectRes) => {
              this.projects.set(projectRes.data);

              // Initialize all groups as expanded
              const expanded: Record<string, boolean> = {};

              for (const project of projectRes.data) {
                expanded[project.id] = true;
              }
              this.expandedGroups.set(expanded);
              this.loading.set(false);
            },
            error: () => this.loading.set(false),
          });
        },
        error: () => this.loading.set(false),
      });
    }
  }

  protected createSprint(): void {
    const projectId = this.projectId();

    if (!projectId || !this.newSprint.name || !this.startDateStr || !this.endDateStr) return;
    this.creating.set(true);

    const data: CreateSprint = {
      name: this.newSprint.name,
      startDate: new Date(this.startDateStr).toISOString(),
      endDate: new Date(this.endDateStr).toISOString(),
      goal: this.newSprint.goal,
    };

    this.sprintClient.create(projectId, data).subscribe({
      next: (sprint) => {
        this.sprints.update((list) => [...list, sprint]);
        this.showCreateModal.set(false);
        this.newSprint = { name: '', goal: '' };
        this.startDateStr = '';
        this.endDateStr = '';
        this.creating.set(false);
      },
      error: () => this.creating.set(false),
    });
  }
}
