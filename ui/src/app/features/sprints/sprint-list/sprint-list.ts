import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideCalendar, lucideChevronRight, lucideChevronsUpDown } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { SprintClient } from '@services/sprint-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { HttpErrorResponse } from '@angular/common/http';
import { StatusColorMap, NeutralColor } from '@app/constants/priority';
import { SprintStatus } from '@task-board/shared';
import { canManageProject } from '@app/shared/utils/role-utils';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon } from '@ng-icons/core';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Sprint } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

export interface CreateSprintForm {
  name: string;
  startDate: string;
  endDate: string;
}

interface SprintGroup {
  label: string;
  labelKey: string;
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
    HlmNativeSelectImports,
    HlmCollapsibleImports,
    HlmBadgeImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideCalendar, lucideChevronRight, lucideChevronsUpDown })],
  templateUrl: './sprint-list.html',
})
export class SprintList implements OnInit {
  private readonly sprintClient = inject(SprintClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  /** Bound via withComponentInputBinding() — now receives project key from route */
  readonly projectKey = input<string>('');
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateModal = signal(false);
  protected readonly expandedGroups = signal<Record<string, boolean>>({});
  private readonly model = signal<CreateSprintForm>({
    name: '',
    startDate: '',
    endDate: '',
  });
  protected readonly newSprintForm = form(
    this.model,
    schema<CreateSprintForm>((field) => {
      required(field.name, { message: 'validation.nameRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          const m = this.model();

          this.sprintClient
            .create(this.projectId() ?? '', {
              name: m.name,
              startDate: m.startDate ? new Date(m.startDate).toISOString() : undefined,
              endDate: m.endDate ? new Date(m.endDate).toISOString() : undefined,
            })
            .subscribe({
              next: (sprint) => {
                this.sprints.update((list) => [...list, sprint]);
                this.showCreateModal.set(false);
                f().reset({ name: '', startDate: '', endDate: '' });
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );
  /** Group sprints by status: Active, Future, Completed */
  protected readonly sprintGroups = computed<SprintGroup[]>(() => {
    const allSprints = this.sprints();
    const active = allSprints.filter((s) => s.status === SprintStatus.ACTIVE);
    const future = allSprints.filter((s) => s.status === SprintStatus.FUTURE);
    const completed = allSprints.filter((s) => s.status === SprintStatus.COMPLETED);
    const groups: SprintGroup[] = [];

    if (active.length > 0) {
      groups.push({ label: 'Active', labelKey: 'sprints.active', sprints: active });
    }
    if (future.length > 0) {
      groups.push({ label: 'Future', labelKey: 'sprints.future', sprints: future });
    }
    if (completed.length > 0) {
      groups.push({ label: 'Completed', labelKey: 'sprints.completed', sprints: completed });
    }

    return groups;
  });
  protected readonly canCreate = computed(() => {
    return canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole());
  });

  protected isGroupExpanded(groupKey: string): boolean {
    return this.expandedGroups()[groupKey] ?? true;
  }

  protected toggleGroup(groupKey: string): void {
    this.expandedGroups.update((groups) => ({
      ...groups,
      [groupKey]: !groups[groupKey],
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
        next: (sprints) => {
          this.sprints.set(sprints);
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
