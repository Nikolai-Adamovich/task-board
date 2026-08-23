import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucidePlus, lucidePencil, lucideTrash2, lucideCheck, lucideX, lucideGripVertical } from '@ng-icons/lucide';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { TaskTypeClient } from '@services/task-type-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { canManageProject } from '@app/shared/utils/role-utils';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { TaskType, CreateTaskType } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

interface CreateTaskTypeForm {
  key: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'ui-task-type-manager',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmCardImports,
    HlmBadgeImports,
    FormField,
    FormRoot,
  ],
  providers: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideCheck, lucideX, lucideGripVertical })],
  templateUrl: './task-type-manager.html',
})
export class TaskTypeManager implements OnInit {
  private readonly taskTypeClient = inject(TaskTypeClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  protected readonly canManage = computed(() =>
    canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  /** Bound via withComponentInputBinding() — now receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly taskTypes = signal<TaskType[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateDialog = signal(false);
  protected readonly showDeleteDialog = signal(false);
  protected readonly deletingType = signal<TaskType | null>(null);
  protected readonly replacementTypeId = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly editingIcon = signal('');
  protected readonly saving = signal(false);
  private readonly createModel = signal<CreateTaskTypeForm>({ key: '', name: '', icon: '' });
  protected readonly createForm = form(
    this.createModel,
    schema<CreateTaskTypeForm>((field) => {
      required(field.key, { message: 'validation.taskTypeKeyRequired' });
      required(field.name, { message: 'validation.taskTypeNameRequired' });
      required(field.icon, { message: 'validation.taskTypeIconRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          const maxPosition = this.taskTypes().reduce((max, t) => Math.max(max, t.position), -1);
          const model = this.createModel();
          const data: CreateTaskType = {
            key: model.key.toUpperCase(),
            name: model.name,
            icon: model.icon,
            position: maxPosition + 1,
          };

          this.taskTypeClient.create(this.projectId(), data).subscribe({
            next: (taskType) => {
              this.taskTypes.update((list) => [...list, taskType]);
              this.showCreateDialog.set(false);
              f().reset({ key: '', name: '', icon: '' });
            },
            error: (err) => {
              this.error.set(this.getErrorMessage(err));
            },
          });
        },
      },
    },
  );
  protected readonly otherTaskTypes = computed(() => {
    const deletingId = this.deletingType()?.id;

    return this.taskTypes().filter((t) => t.id !== deletingId);
  });

  protected startEdit(taskType: TaskType): void {
    this.editingId.set(taskType.id);
    this.editingName.set(taskType.name);
    this.editingIcon.set(taskType.icon ?? '');
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.editingIcon.set('');
  }

  protected saveEdit(taskType: TaskType): void {
    const name = this.editingName().trim();
    const icon = this.editingIcon().trim();

    if ((!name || name === taskType.name) && (!icon || icon === taskType.icon)) {
      this.cancelEdit();
      return;
    }

    const updateData: { name?: string; icon?: string } = {};

    if (name && name !== taskType.name) updateData.name = name;
    if (icon && icon !== taskType.icon) updateData.icon = icon;

    this.saving.set(true);
    this.taskTypeClient
      .update(taskType.id, updateData)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.taskTypes.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          this.cancelEdit();
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
      });
  }

  protected moveUp(taskType: TaskType): void {
    const sorted = [...this.taskTypes()].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((t) => t.id === taskType.id);

    if (idx <= 0) return;
    this.swapPositions(taskType, sorted[idx - 1]);
  }

  protected moveDown(taskType: TaskType): void {
    const sorted = [...this.taskTypes()].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((t) => t.id === taskType.id);

    if (idx < 0 || idx >= sorted.length - 1) return;
    this.swapPositions(taskType, sorted[idx + 1]);
  }

  private swapPositions(a: TaskType, b: TaskType): void {
    this.saving.set(true);

    let completed = 0;
    const checkDone = () => {
      completed++;
      if (completed === 2) {
        this.saving.set(false);
        this.loadTaskTypes();
      }
    };

    this.taskTypeClient.update(a.id, { position: b.position }).subscribe({
      next: () => checkDone(),
      error: (err) => {
        this.error.set(this.getErrorMessage(err));
        this.saving.set(false);
      },
    });
    this.taskTypeClient.update(b.id, { position: a.position }).subscribe({
      next: () => checkDone(),
      error: (err) => {
        this.error.set(this.getErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(taskType: TaskType): void {
    this.deletingType.set(taskType);
    this.replacementTypeId.set('');
    this.showDeleteDialog.set(true);
  }

  protected deleteTaskType(): void {
    const taskType = this.deletingType();

    if (!taskType) return;

    this.saving.set(true);

    const replacementId = this.replacementTypeId() || undefined;

    this.taskTypeClient
      .delete(taskType.id, replacementId)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.taskTypes.update((list) => list.filter((t) => t.id !== taskType.id));
          this.showDeleteDialog.set(false);
          this.deletingType.set(null);
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
      });
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateDialog.set(false);
    }
  }

  protected onDeleteDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteDialog.set(false);
      this.deletingType.set(null);
    }
  }

  ngOnInit(): void {
    this.loadTaskTypes();
  }

  private loadTaskTypes(): void {
    this.loading.set(true);
    this.error.set('');
    this.taskTypeClient
      .list(this.projectId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (types) => {
          this.taskTypes.set(types.sort((a, b) => a.position - b.position));
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
      });
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }
    return 'errors.unexpected';
  }
}
