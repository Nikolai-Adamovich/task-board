import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideCalendar, lucideChevronRight, lucideChevronsUpDown } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { SprintClient } from '@services/sprint-client';
import { AuthStore } from '@stores/auth-store';
import { HttpErrorResponse } from '@angular/common/http';
import { StatusColorMap, NeutralColor } from '@app/constants/priority';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { NgIcon } from '@ng-icons/core';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Sprint } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

export interface CreateSprintForm {
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
}

interface ProjectSprintGroup {
  projectId: string;
  projectName: string;
  tenantId: string;
  sprints: Sprint[];
}

@Component({
  selector: 'ui-sprint-list',
  imports: [
    RouterLink,
    DatePipe,
    TranslocoPipe,
    FormField,
    FormRoot,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmNativeSelectImports,
    HlmCollapsibleImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideCalendar, lucideChevronRight, lucideChevronsUpDown })],
  templateUrl: './sprint-list.html',
})
export class SprintList implements OnInit {
  private readonly sprintClient = inject(SprintClient);
  private readonly authStore = inject(AuthStore);
  /** Bound via withComponentInputBinding() */
  readonly projectId = input<string>('');
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateModal = signal(false);
  protected readonly expandedGroups = signal<Record<string, boolean>>({});
  private readonly model = signal<CreateSprintForm>({
    name: '',
    startDate: '',
    endDate: '',
    goal: '',
  });
  protected readonly newSprintForm = form(
    this.model,
    schema<CreateSprintForm>((field) => {
      required(field.name, { message: 'validation.nameRequired' });
      required(field.startDate, { message: 'validation.startDateRequired' });
      required(field.endDate, { message: 'validation.endDateRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          this.sprintClient
            .create(this.projectId() ?? '', {
              name: this.model().name,
              startDate: new Date(this.model().startDate).toISOString(),
              endDate: new Date(this.model().endDate).toISOString(),
              goal: this.model().goal,
            })
            .subscribe({
              next: (sprint) => {
                this.sprints.update((list) => [...list, sprint]);
                this.showCreateModal.set(false);
                f().reset({ name: '', startDate: '', endDate: '', goal: '' });
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );
  protected readonly projectGroups = computed<ProjectSprintGroup[]>(() => {
    const groups = new Map<string, { sprints: Sprint[]; projectName: string; tenantId: string }>();

    for (const sprint of this.sprints()) {
      const pid = sprint.projectId;
      const group = groups.get(pid);

      if (group) {
        group.sprints.push(sprint);
      } else {
        groups.set(pid, { sprints: [sprint], projectName: sprint.projectId, tenantId: sprint.tenantId });
      }
    }

    return Array.from(groups.entries()).map(([pid, group]) => ({
      projectId: pid,
      projectName: group.projectName,
      tenantId: group.tenantId,
      sprints: group.sprints,
    }));
  });
  protected readonly canCreate = computed(() => {
    return !!this.authStore.currentUser();
  });

  protected isGroupExpanded(projectId: string): boolean {
    return this.expandedGroups()[projectId] ?? false;
  }

  protected toggleGroup(projectId: string): void {
    this.expandedGroups.update((groups) => ({
      ...groups,
      [projectId]: !groups[projectId],
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
    this.sprintClient
      .list(this.projectId() ?? '')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.sprints.set(res.data);
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
      });
  }

  protected getStatusColor(status: string): string {
    return (StatusColorMap as Record<string, string>)[status] ?? NeutralColor;
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'errors.unexpected';
  }
}
