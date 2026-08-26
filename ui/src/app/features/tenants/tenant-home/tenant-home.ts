import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucidePlus,
  lucideFolder,
  lucideSettings,
  lucideUsers,
  lucideListTodo,
  lucideArrowRight,
  lucideUserPlus,
} from '@ng-icons/lucide';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { InvitationStatus, TenantRole, TenantStatus } from '@task-board/shared';
import type { Project, Task, TenantMember } from '@task-board/shared';
import { priorityBadgeVariant, roleBadgeVariant, statusBadgeVariant } from '@app/constants/priority';
import { ProjectClient } from '@services/project-client';
import { TaskClient } from '@services/task-client';
import { TenantClient } from '@services/tenant-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';

export interface CreateProjectForm {
  name: string;
  key: string;
  description: string;
}

/** View model for one row of the "My Tasks" widget */
interface MyTaskItem {
  task: Task;
  projectKey: string;
  projectName: string;
}

/**
 * Unified tenant home (`/t/:tenantSlug`, DEC-033) — serves all roles.
 * Workspace header, primary "Create project" CTA, projects grid,
 * "My Tasks" widget and a pending-invitations summary for admins.
 */
@Component({
  selector: 'ui-tenant-home',
  imports: [
    HlmAlertImports,
    HlmEmptyImports,
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmSpinnerImports,
    FormField,
    FormRoot,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideFolder,
      lucideSettings,
      lucideUsers,
      lucideListTodo,
      lucideArrowRight,
      lucideUserPlus,
    }),
  ],
  templateUrl: './tenant-home.html',
})
export class TenantHome {
  private readonly notify = injectToasts();
  private readonly projectClient = inject(ProjectClient);
  private readonly taskClient = inject(TaskClient);
  private readonly tenantClient = inject(TenantClient);
  protected readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  /** Shared badge helpers (see constants/priority.ts) */
  protected readonly statusBadgeVariant = statusBadgeVariant;
  protected readonly roleBadgeVariant = roleBadgeVariant;
  protected readonly priorityBadgeVariant = priorityBadgeVariant;
  protected readonly TenantStatus = TenantStatus;
  protected readonly TenantRole = TenantRole;
  protected readonly tenant = computed(() => this.tenantStore.activeTenant());
  protected readonly role = computed(() => this.authStore.tenantRole());
  protected readonly isOwnerOrAdmin = computed(() => {
    const r = this.role();

    return r === TenantRole.OWNER || r === TenantRole.ADMIN;
  });
  // ─── Projects grid ────────────────────────────────────────────────────────
  private readonly projectsResource = rxResource({
    stream: () => this.projectClient.list(),
    defaultValue: [] as Project[],
  });
  protected readonly projects = computed(() => (this.projectsResource.hasValue() ? this.projectsResource.value() : []));
  protected readonly loadingProjects = computed(() => this.projectsResource.isLoading());
  // ─── My Tasks widget (recent tasks assigned to me in THIS tenant) ─────────
  private readonly myTasksResource = rxResource({
    stream: () => this.taskClient.getMyTasks(),
    defaultValue: [] as Task[],
  });
  private readonly myTasks = computed(() => (this.myTasksResource.hasValue() ? this.myTasksResource.value() : []));
  /** Tasks scoped to this tenant's projects, each resolved to its project key */
  protected readonly myTaskItems = computed<MyTaskItem[]>(() => {
    const byProjectId = new Map(this.projects().map((p) => [p.id, p]));

    return this.myTasks().flatMap((task) => {
      const project = byProjectId.get(task.projectId);

      return project ? [{ task, projectKey: project.key, projectName: project.name }] : [];
    });
  });
  // ─── Pending invitations summary (admins) ────────────────────────────────
  protected readonly pendingInvites = signal<TenantMember[]>([]);
  protected readonly loadingInvites = signal(false);
  // ─── Create project dialog ────────────────────────────────────────────────
  protected readonly showCreateModal = signal(false);
  private readonly actionError = signal('');
  protected readonly error = computed(() => this.actionError());
  private readonly model = signal<CreateProjectForm>({
    name: '',
    key: '',
    description: '',
  });
  protected readonly newProjectForm = form(
    this.model,
    schema<CreateProjectForm>((field) => {
      required(field.name, { message: 'validation.nameRequired' });
      required(field.key, { message: 'validation.keyRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.actionError.set('');
          this.projectClient
            .create({
              name: this.model().name,
              key: this.model().key.toUpperCase(),
              description: this.model().description || undefined,
            })
            .subscribe({
              next: (project) => {
                if (this.projectsResource.hasValue()) {
                  this.projectsResource.value.update((list) => [...list, project]);
                } else {
                  this.projectsResource.reload();
                }
                this.showCreateModal.set(false);
                f().reset({ name: '', key: '', description: '' });
                this.notify.success('toasts.created');
              },
              error: (err) => {
                this.actionError.set(getErrorMessage(err));
              },
            });
        },
      },
    },
  );

  constructor() {
    // Pending-invitation summary for admins (DEC-033)
    effect(() => {
      const tenant = this.tenant();

      if (!this.isOwnerOrAdmin() || !tenant) return;

      this.loadingInvites.set(true);
      this.tenantClient.listMembers(tenant.id).subscribe({
        next: (members) => {
          this.pendingInvites.set(members.filter((m) => m.invitation?.status === InvitationStatus.PENDING));
          this.loadingInvites.set(false);
        },
        error: () => this.loadingInvites.set(false),
      });
    });
  }

  /** V2-10: only tenant OWNER/ADMIN may create projects — the server denies MEMBERs. */
  protected canCreate(): boolean {
    return this.isOwnerOrAdmin();
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateModal.set(false);
    }
  }
}
