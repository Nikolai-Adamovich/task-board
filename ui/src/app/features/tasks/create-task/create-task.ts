import { Component, computed, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { form, FormField, FormRoot, schema, required, maxLength } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { TaskClient } from '@services/task-client';
import { LabelClient } from '@services/label-client';
import { ProjectStore } from '@stores/project-store';
import { ProjectRefStore, type SelectOption } from '@stores/project-ref-store';
import { getTenantSlug } from '@app/shared/utils/route-utils';
import { MilkdownEditor } from '@app/shared/milkdown-editor/milkdown-editor';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { TaskPriority } from '@task-board/shared';
import type { CreateTask, Task } from '@task-board/shared';

interface CreateTaskFormModel {
  title: string;
  description: string;
  statusId: string;
  priority: TaskPriority;
  typeId: string;
  assigneeId: string;
  sprintId: string;
}

/**
 * Unified create-task page (U1) — same layout as task detail, rendered in
 * create mode at `…/tasks/new`. Replaces the board and task-table dialogs.
 */
@Component({
  selector: 'ui-task-create',
  imports: [
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmBadgeImports,
    HlmSelectImports,
    HlmAutocompleteImports,
    HlmAlertImports,
    MilkdownEditor,
  ],
  templateUrl: './create-task.html',
})
export class TaskCreate {
  private readonly notify = injectToasts();
  private readonly taskClient = inject(TaskClient);
  private readonly labelClient = inject(LabelClient);
  private readonly projectStore = inject(ProjectStore);
  private readonly refStore = inject(ProjectRefStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  /** Resolved project UUID (projectGuard hydrates the store before activation) */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  // ─── Reference data via the shared per-project store ───────────────────────
  protected readonly statusOptions = computed(() => this.refStore.options(this.projectId(), 'statuses'));
  protected readonly typeOptions = computed(() => this.refStore.options(this.projectId(), 'types'));
  protected readonly sprintOptions = computed(() => this.refStore.options(this.projectId(), 'sprints'));
  protected readonly labelOptions = computed(() => this.refStore.options(this.projectId(), 'labels'));
  protected readonly memberOptions = computed(() => this.refStore.options(this.projectId(), 'members'));
  /** itemToString helpers for hlm-select to display human-readable labels */
  protected readonly statusItemToString = (id: string) => this.statusOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly typeItemToString = (id: string) => this.typeOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly assigneeItemToString = (id: string) => this.memberOptions().find((o) => o.id === id)?.name ?? id;
  protected readonly sprintItemToString = (id: string) => this.sprintOptions().find((o) => o.id === id)?.name ?? id;
  // ─── Form ──────────────────────────────────────────────────────────────────
  protected readonly model = signal<CreateTaskFormModel>({
    title: '',
    description: '',
    statusId: '',
    priority: TaskPriority.MEDIUM,
    typeId: '',
    assigneeId: '',
    sprintId: '',
  });
  protected readonly error = signal('');
  protected readonly createForm = form(
    this.model,
    schema<CreateTaskFormModel>((field) => {
      required(field.title, { message: 'validation.titleRequired' });
      // V4-3: mirror the server's 255-char title limit client-side
      maxLength(field.title, 255, { message: 'validation.titleMaxLength' });
      required(field.typeId, { message: 'validation.typeRequired' });
      required(field.statusId, { message: 'validation.statusRequired' });
      required(field.priority, { message: 'validation.priorityRequired' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          const m = this.model();
          const pid = this.projectId();
          const title = m.title.trim();

          if (!title || !pid || !m.typeId || !m.statusId) return;

          try {
            const labelIds = await this.resolveLabelIds();
            const payload: CreateTask = {
              title,
              typeId: m.typeId,
              statusId: m.statusId,
              priority: m.priority,
            };
            const description = m.description.trim();

            if (description) payload.description = description;
            if (m.assigneeId) payload.assigneeId = m.assigneeId;
            if (m.sprintId) payload.sprintId = m.sprintId;
            if (labelIds.length > 0) payload.labelIds = labelIds;

            const task = await firstValueFrom(this.taskClient.create(pid, payload));

            this.notify.success('toasts.created');
            this.goToCreatedTask(task);
          } catch (err) {
            this.error.set(getErrorMessage(err));
          }
        },
      },
    },
  );
  // ─── Labels (case-insensitive autocomplete, BR-019) ────────────────────────
  /** Free-text search buffer for the label autocomplete */
  protected readonly labelSearch = signal('');
  /** Selected labels; `id === ''` marks a label that will be created on submit */
  protected readonly selectedLabels = signal<SelectOption[]>([]);
  /** Existing labels matching the search, excluding already-selected ones */
  protected readonly filteredLabelOptions = computed(() => {
    const search = this.labelSearch().toLowerCase();
    const selected = new Set(this.selectedLabels().map((l) => l.id));

    return this.labelOptions().filter((o) => !selected.has(o.id) && o.name.toLowerCase().includes(search));
  });
  /** A new label can be created when the search is non-empty and matches no existing label case-insensitively */
  protected readonly canCreateLabel = computed(() => {
    const name = this.labelSearch().trim().toLowerCase();

    if (!name) return false;

    return !this.labelOptions().some((o) => o.name.toLowerCase() === name);
  });
  /** Synthetic option representing "create a new label with the typed name" */
  protected readonly newLabelOption = computed<SelectOption>(() => ({ id: '', name: this.labelSearch().trim() }));
  protected readonly labelItemToString = (option: SelectOption) => option?.name ?? '';

  constructor() {
    effect(() => {
      this.refStore.ensure(this.projectId(), ['statuses', 'types', 'sprints', 'labels', 'members']);
    });

    // V4-5 / R3-P1: preselect by ID — `project.defaultStatusId` when present among
    // the loaded statuses, otherwise the first status by position. No name matching.
    effect(() => {
      const statuses = this.statusOptions();

      if (statuses.length === 0 || this.model().statusId) return;

      const defaultStatusId = this.projectStore.activeProject()?.defaultStatusId;
      const preselect =
        defaultStatusId && statuses.some((s) => s.id === defaultStatusId) ? defaultStatusId : statuses[0].id;

      this.model.update((m) => ({ ...m, statusId: preselect }));
    });

    // R3-P1: default type = first type by position (no name matching)
    effect(() => {
      const types = this.typeOptions();

      if (types.length === 0 || this.model().typeId) return;

      this.model.update((m) => ({ ...m, typeId: types[0].id }));
    });
  }

  /** Handle Milkdown editor content change */
  protected onDescriptionChange(markdown: string): void {
    this.model.update((m) => ({ ...m, description: markdown }));
  }

  protected onFieldChange<K extends keyof CreateTaskFormModel>(field: K, value: CreateTaskFormModel[K]): void {
    this.model.update((m) => ({ ...m, [field]: value }));
  }

  /** Add a picked label (existing or to-be-created) unless already selected */
  protected onLabelPicked(option: SelectOption): void {
    if (!option?.name) return;

    const name = option.name.toLowerCase();
    const alreadySelected =
      this.selectedLabels().some((l) => (option.id ? l.id === option.id : l.name.toLowerCase() === name)) ||
      this.labelOptions().some(
        (o) => o.name.toLowerCase() === name && this.selectedLabels().some((l) => l.id === o.id),
      );

    if (alreadySelected) {
      this.labelSearch.set('');
      return;
    }

    this.selectedLabels.update((labels) =>
      option.id ? [...labels, option] : [...labels, { id: '', name: option.name }],
    );
    this.labelSearch.set('');
  }

  protected removeLabel(label: SelectOption): void {
    this.selectedLabels.update((labels) => labels.filter((l) => l !== label));
  }

  protected cancel(): void {
    this.location.back();
  }

  /**
   * Resolve selected labels to ids. Existing ids pass through; pending names are
   * resolved case-insensitively against project labels first (BR-019) and only
   * created when no match exists.
   */
  private async resolveLabelIds(): Promise<string[]> {
    const pid = this.projectId();
    const ids: string[] = [];
    let createdNew = false;

    for (const label of this.selectedLabels()) {
      if (label.id) {
        ids.push(label.id);
        continue;
      }

      const existing = this.labelOptions().find((o) => o.name.toLowerCase() === label.name.toLowerCase());

      if (existing) {
        ids.push(existing.id);
        continue;
      }

      const created = await firstValueFrom(this.labelClient.create(pid, { name: label.name }));

      ids.push(created.id);
      createdNew = true;
    }

    if (createdNew) this.refStore.invalidate(pid, 'labels');

    return [...new Set(ids)];
  }

  /** Navigate to the canonical URL of the freshly created task */
  private goToCreatedTask(task: Task): void {
    const key =
      this.projectStore.activeProject()?.key ?? this.route.snapshot.paramMap.get('projectKey') ?? task.projectId;

    this.router.navigate(['/t', getTenantSlug(this.route), 'projects', key, 'tasks', `${key}-${task.number}`]);
  }
}
