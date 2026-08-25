import { Component, computed, effect, inject, input, signal, OnInit } from '@angular/core';
import { getTenantId } from '@app/shared/utils/route-utils';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { TaskClient } from '@services/task-client';
import { StatusClient } from '@services/status-client';
import { TaskTypeClient } from '@services/task-type-client';
import { LabelClient } from '@services/label-client';
import { SprintClient } from '@services/sprint-client';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { priorityBadgeVariant } from '@app/constants/priority';
import { TaskPriority } from '@task-board/shared';
import { canManageProject, canWrite } from '@app/shared/utils/role-utils';
import { HttpErrorResponse } from '@angular/common/http';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { rxResource } from '@angular/core/rxjs-interop';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Task } from '@task-board/shared';
import { CommentThread } from '@features/comments/comment-thread/comment-thread';
import { TaskRelationships } from '@features/tasks/task-relationships/task-relationships';
import { MilkdownEditor } from '@app/shared/milkdown-editor/milkdown-editor';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';

export interface EditTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
}

interface SelectOption {
  id: string;
  name: string;
}

@Component({
  selector: 'ui-task-detail',
  imports: [
    ConfirmDialog,
    HlmAlertImports,
    DatePipe,
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmAvatarImports,
    HlmSelectImports,
    HlmDialogImports,
    CommentThread,
    TaskRelationships,
    MilkdownEditor,
  ],
  templateUrl: './task-detail.html',
})
export class TaskDetail implements OnInit {
  /** Shared badge-class helpers (see constants/priority.ts) */
  protected readonly priorityBadgeVariant = priorityBadgeVariant;
  private readonly notify = injectToasts();
  private readonly taskClient = inject(TaskClient);
  private readonly statusClient = inject(StatusClient);
  private readonly taskTypeClient = inject(TaskTypeClient);
  private readonly labelClient = inject(LabelClient);
  private readonly sprintClient = inject(SprintClient);
  private readonly projectClient = inject(ProjectClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** Bound via withComponentInputBinding() */
  readonly taskId = input.required<string>();
  private readonly taskResource = rxResource<Task | null, { taskId: string }>({
    params: () => ({ taskId: this.taskId() }),
    stream: ({ params }) => this.taskClient.getById(params.taskId),
    defaultValue: null,
  });
  protected readonly task = computed(() => (this.taskResource.hasValue() ? this.taskResource.value() : null));
  protected readonly isEditing = signal(false);
  /** Whether the edit editor has finished initializing (swap views only when ready) */
  protected readonly editReady = signal(false);
  protected readonly error = signal('');
  protected readonly currentUserId = signal('');
  /** Resolved entity names for display */
  protected readonly statusName = signal<string>('');
  protected readonly typeName = signal<string>('');
  protected readonly labelNames = signal<string[]>([]);
  protected readonly sprintName = signal<string>('');
  protected readonly showDeleteConfirm = signal(false);
  protected readonly showConflictDialog = signal(false);
  protected readonly conflictMessage = signal('');
  private readonly taskToDelete = signal<Task | null>(null);
  /** Options for inline editing */
  protected readonly statusOptions = signal<SelectOption[]>([]);
  protected readonly typeOptions = signal<SelectOption[]>([]);
  protected readonly sprintOptions = signal<SelectOption[]>([]);
  protected readonly labelOptions = signal<SelectOption[]>([]);
  protected readonly memberOptions = signal<SelectOption[]>([]);
  /** itemToString helpers for hlm-select to display human-readable labels */
  protected readonly statusItemToString = (id: string) => this.statusOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly typeItemToString = (id: string) => this.typeOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly assigneeItemToString = (id: string) => this.memberOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly sprintItemToString = (id: string) => this.sprintOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly model = signal<EditTaskForm>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM,
  });
  protected readonly editForm = form(
    this.model,
    schema<EditTaskForm>((field) => {
      required(field.title, { message: 'validation.titleRequired' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          const t = this.task();

          if (!t) return;

          this.taskClient
            .update(t.id, {
              title: this.model().title,
              description: this.model().description,
              priority: this.model().priority,
              version: t.version,
            })
            .subscribe({
              next: (updated) => {
                this.taskResource.value.set(updated);
                this.isEditing.set(false);
                this.notify.success('toasts.updated');
              },
              error: (err) => {
                if (err instanceof HttpErrorResponse && err.status === 409) {
                  this.conflictMessage.set(
                    (err as HttpErrorResponse & { userMessage?: string }).userMessage ?? 'taskDetail.conflictHint',
                  );
                  this.showConflictDialog.set(true);
                } else {
                  this.error.set(getErrorMessage(err));
                }
              },
            });
        },
      },
    },
  );

  constructor() {
    effect(() => {
      // hasValue() guards against reading `.value` in the error state
      if (!this.taskResource.hasValue()) return;

      const t = this.taskResource.value();

      if (!t) return;

      this.resolveRelatedEntities(t);
      this.loadEditOptions(t.projectId);
    });
  }

  ngOnInit(): void {
    const user = this.authStore.currentUser();

    if (user) {
      this.currentUserId.set(user.id);
    }
  }

  /** Resolve statusId/typeId/labelIds/sprintId to human-readable names */
  private resolveRelatedEntities(t: Task): void {
    // Resolve status name
    this.statusClient.list(t.projectId).subscribe({
      next: (statuses) => {
        const status = statuses.find((s) => s.id === t.statusId);

        this.statusName.set(status?.name ?? t.statusId);
      },
    });

    // Resolve type name
    this.taskTypeClient.list(t.projectId).subscribe({
      next: (types) => {
        const type = types.find((tp) => tp.id === t.typeId);

        this.typeName.set(type?.name ?? t.typeId);
      },
    });

    // Resolve label names
    this.labelClient.list(t.projectId).subscribe({
      next: (labels) => {
        const names = t.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? id);

        this.labelNames.set(names);
      },
    });

    // Resolve sprint name
    if (t.sprintId) {
      this.sprintClient.getById(t.sprintId).subscribe({
        next: (sprint) => this.sprintName.set(sprint.name),
        error: () => this.sprintName.set(t.sprintId ?? ''),
      });
    }
  }

  /** Load options for inline editing dropdowns */
  private loadEditOptions(projectId: string): void {
    this.statusClient.list(projectId).subscribe({
      next: (statuses) => this.statusOptions.set(statuses.map((s) => ({ id: s.id, name: s.name }))),
    });

    this.taskTypeClient.list(projectId).subscribe({
      next: (types) => this.typeOptions.set(types.map((t) => ({ id: t.id, name: t.name }))),
    });

    this.sprintClient.list(projectId).subscribe({
      next: (sprints) => this.sprintOptions.set(sprints.map((s) => ({ id: s.id, name: s.name }))),
    });

    this.labelClient.list(projectId).subscribe({
      next: (labels) => this.labelOptions.set(labels.map((l) => ({ id: l.id, name: l.name }))),
    });

    this.projectClient.listMembers(projectId).subscribe({
      next: (members) =>
        this.memberOptions.set(members.map((m) => ({ id: m.userId, name: m.displayName ?? m.userId }))),
    });
  }

  protected taskLabel(): string {
    const t = this.task();

    if (!t) return '';

    const key = this.projectStore.activeProject()?.key;

    return key ? `${key}-${t.number}` : `#${t.number}`;
  }

  protected canDelete(): boolean {
    return canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole());
  }

  protected canEdit(): boolean {
    return this.canEditComments();
  }

  /** Whether the current user can edit comments (Editor+ or tenant ADMIN+) */
  protected canEditComments(): boolean {
    return canWrite(this.projectStore.projectRole(), this.authStore.tenantRole());
  }

  protected startEdit(): void {
    const t = this.task();

    if (t) {
      this.model.set({
        title: t.title,
        description: t.description ?? '',
        priority: t.priority as TaskPriority,
      });
      // Keep the display view visible until the edit editor signals readiness
      this.editReady.set(false);
      this.isEditing.set(true);
    }
  }

  protected cancelEdit(): void {
    this.model.set({
      title: '',
      description: '',
      priority: TaskPriority.MEDIUM,
    });
    this.isEditing.set(false);
    this.editReady.set(false);
  }

  protected onEditReady(): void {
    this.editReady.set(true);
  }

  /** Handle Milkdown editor content change */
  protected onDescriptionChange(markdown: string): void {
    this.model.update((m) => ({ ...m, description: markdown }));
  }

  /** Inline update for a single field (Jira-style) */
  protected updateField(field: string, value: unknown): void {
    const t = this.task();

    if (!t) return;

    const update = { [field]: value, version: t.version } as Record<string, unknown>;

    this.taskClient.update(t.id, update as never).subscribe({
      next: (updated) => {
        this.taskResource.value.set(updated);
        // Re-resolve names if status/type/sprint changed
        if (field === 'statusId') {
          this.statusName.set(this.statusOptions().find((o) => o.id === value)?.name ?? (value as string));
        } else if (field === 'typeId') {
          this.typeName.set(this.typeOptions().find((o) => o.id === value)?.name ?? (value as string));
        } else if (field === 'sprintId') {
          if (value) {
            this.sprintName.set(this.sprintOptions().find((o) => o.id === value)?.name ?? (value as string));
          } else {
            this.sprintName.set('');
          }
        }
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.conflictMessage.set(
            (err as HttpErrorResponse & { userMessage?: string }).userMessage ?? 'taskDetail.conflictHint',
          );
          this.showConflictDialog.set(true);
        } else {
          this.error.set(getErrorMessage(err));
        }
      },
    });
  }

  protected confirmDeleteTask(task: Task): void {
    this.taskToDelete.set(task);
    this.showDeleteConfirm.set(true);
  }

  protected onDeleteDialogStateChange(open: boolean): void {
    if (!open) {
      this.showDeleteConfirm.set(false);
      this.taskToDelete.set(null);
    }
  }

  onConflictDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showConflictDialog.set(false);
    }
  }

  /** Reload task from server to resolve conflict */
  protected reloadAfterConflict(): void {
    this.showConflictDialog.set(false);
    this.isEditing.set(false);
    this.taskResource.reload();
  }

  protected deleteTask(): void {
    const task = this.taskToDelete();

    if (!task) return;

    this.taskClient.delete(task.id).subscribe({
      next: () => {
        // Navigate using project key from store
        const projectKey = this.projectStore.activeProject()?.key ?? task.projectId;

        this.router.navigate(['/tenants', getTenantId(this.route), 'projects', projectKey]);
      },
    });
  }
}
