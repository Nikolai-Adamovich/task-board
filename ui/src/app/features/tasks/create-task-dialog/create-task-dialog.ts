import { Component, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { TaskClient } from '@services/task-client';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import type { TaskPriority, CreateTask } from '@task-board/shared';

export interface SelectOption {
  id: string;
  name: string;
}

interface CreateTaskForm {
  title: string;
  description: string;
  typeId: string;
  statusId: string;
  priority: TaskPriority;
  assigneeId: string;
  sprintId: string;
  labelIds: string[];
}

@Component({
  selector: 'ui-create-task-dialog',
  imports: [
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmSelectImports,
    HlmDialogImports,
    HlmFieldImports,
  ],
  templateUrl: './create-task-dialog.html',
})
export class CreateTaskDialog {
  private readonly taskClient = inject(TaskClient);
  readonly projectId = input.required<string>();
  readonly open = input(false);
  readonly typeOptions = input<SelectOption[]>([]);
  readonly statusOptions = input<SelectOption[]>([]);
  readonly sprintOptions = input<SelectOption[]>([]);
  readonly memberOptions = input<SelectOption[]>([]);
  readonly labelOptions = input<SelectOption[]>([]);
  readonly dialogClosed = output();
  readonly taskCreated = output();
  protected readonly createError = signal('');
  protected readonly createModel = signal<CreateTaskForm>({
    title: '',
    description: '',
    typeId: '',
    statusId: '',
    priority: 'MEDIUM' as TaskPriority,
    assigneeId: '',
    sprintId: '',
    labelIds: [],
  });
  protected readonly createForm = form(
    this.createModel,
    schema<CreateTaskForm>((field) => {
      required(field.title, { message: 'validation.titleRequired' });
      required(field.typeId, { message: 'validation.typeRequired' });
      required(field.statusId, { message: 'validation.statusRequired' });
      required(field.priority, { message: 'validation.priorityRequired' });
    }),
    {
      submission: {
        action: async () => {
          this.createError.set('');

          const m = this.createModel();
          const trimmedTitle = m.title.trim();
          const trimmedDescription = m.description.trim();

          if (!trimmedTitle) {
            this.createModel.update((v) => ({ ...v, title: '' }));
            return;
          }

          const payload: CreateTask = {
            title: trimmedTitle,
            typeId: m.typeId,
            statusId: m.statusId,
            priority: m.priority,
          };

          if (trimmedDescription) payload.description = trimmedDescription;
          if (m.assigneeId) payload.assigneeId = m.assigneeId;
          if (m.sprintId) payload.sprintId = m.sprintId;
          if (m.labelIds.length > 0) payload.labelIds = m.labelIds;

          this.taskClient.create(this.projectId(), payload).subscribe({
            next: () => {
              this.dialogClosed.emit();
              this.taskCreated.emit();
            },
            error: () => {
              this.createError.set('taskTable.createError');
            },
          });
        },
      },
    },
  );
  /** itemToString helpers for hlm-select to display human-readable labels */
  protected readonly typeItemToString = (id: string) => this.typeOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly statusItemToString = (id: string) => this.statusOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly assigneeItemToString = (id: string) => this.memberOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly sprintItemToString = (id: string) => this.sprintOptions().find((o) => o.id === id)?.name ?? id;

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.dialogClosed.emit();
    }
  }

  protected onFieldChange(field: keyof CreateTaskForm, value: string | string[]): void {
    this.createModel.update((m) => ({ ...m, [field]: value }));
  }

  protected toggleLabel(labelId: string): void {
    this.createModel.update((m) => {
      const idx = m.labelIds.indexOf(labelId);

      return {
        ...m,
        labelIds: idx >= 0 ? m.labelIds.filter((id) => id !== labelId) : [...m.labelIds, labelId],
      };
    });
  }

  protected isLabelSelected(labelId: string): boolean {
    return this.createModel().labelIds.includes(labelId);
  }

  /** Reset form with default values (called when dialog opens) */
  resetForm(): void {
    const taskType = this.typeOptions().find((o) => o.name.toLowerCase() === 'task');
    const todoStatus = this.statusOptions().find((o) => o.name.toLowerCase() === 'todo');

    this.createModel.set({
      title: '',
      description: '',
      typeId: taskType?.id ?? '',
      statusId: todoStatus?.id ?? '',
      priority: 'MEDIUM' as TaskPriority,
      assigneeId: '',
      sprintId: '',
      labelIds: [],
    });
    this.createError.set('');
  }
}
