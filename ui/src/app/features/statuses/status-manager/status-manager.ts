import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucidePlus, lucidePencil, lucideTrash2, lucideCheck, lucideX, lucideGripVertical } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { StatusClient } from '@services/status-client';
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
import type { Status, CreateStatus } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

interface CreateStatusForm {
  name: string;
}

@Component({
  selector: 'ui-status-manager',
  imports: [
    HlmAlertImports,
    HlmEmptyImports,
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
  templateUrl: './status-manager.html',
})
export class StatusManager implements OnInit {
  private readonly notify = injectToasts();
  private readonly statusClient = inject(StatusClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  protected readonly canManage = computed(() =>
    canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  /** Bound via withComponentInputBinding() — now receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly statuses = signal<Status[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateDialog = signal(false);
  protected readonly showDeleteDialog = signal(false);
  protected readonly deletingStatus = signal<Status | null>(null);
  protected readonly replacementStatusId = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly saving = signal(false);
  private readonly createModel = signal<CreateStatusForm>({ name: '' });
  protected readonly createForm = form(
    this.createModel,
    schema<CreateStatusForm>((field) => {
      required(field.name, { message: 'validation.statusNameRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          const maxPosition = this.statuses().reduce((max, s) => Math.max(max, s.position), -1);
          const data: CreateStatus = { name: this.createModel().name, position: maxPosition + 1 };

          this.statusClient.create(this.projectId(), data).subscribe({
            next: (status) => {
              this.statuses.update((list) => [...list, status]);
              this.showCreateDialog.set(false);
              f().reset({ name: '' });
              this.notify.success('toasts.created');
            },
            error: (err) => {
              this.error.set(getErrorMessage(err));
            },
          });
        },
      },
    },
  );
  protected readonly otherStatuses = computed(() => {
    const deletingId = this.deletingStatus()?.id;

    return this.statuses().filter((s) => s.id !== deletingId);
  });

  protected startEdit(status: Status): void {
    this.editingId.set(status.id);
    this.editingName.set(status.name);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
  }

  protected saveEdit(status: Status): void {
    const name = this.editingName().trim();

    if (!name || name === status.name) {
      this.cancelEdit();
      return;
    }

    this.saving.set(true);
    this.statusClient
      .update(status.id, { name })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.statuses.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
          this.cancelEdit();
          this.notify.success('toasts.updated');
        },
        error: (err) => {
          this.error.set(getErrorMessage(err));
        },
      });
  }

  protected moveUp(status: Status): void {
    const sorted = [...this.statuses()].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((s) => s.id === status.id);

    if (idx <= 0) return;

    const target = sorted[idx - 1];

    this.swapPositions(status, target);
  }

  protected moveDown(status: Status): void {
    const sorted = [...this.statuses()].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((s) => s.id === status.id);

    if (idx < 0 || idx >= sorted.length - 1) return;

    const target = sorted[idx + 1];

    this.swapPositions(status, target);
  }

  private swapPositions(a: Status, b: Status): void {
    this.saving.set(true);

    let completed = 0;
    const checkDone = () => {
      completed++;
      if (completed === 2) {
        this.saving.set(false);
        this.loadStatuses();
      }
    };

    this.statusClient.update(a.id, { position: b.position }).subscribe({
      next: () => checkDone(),
      error: (err) => {
        this.error.set(getErrorMessage(err));
        this.saving.set(false);
      },
    });
    this.statusClient.update(b.id, { position: a.position }).subscribe({
      next: () => checkDone(),
      error: (err) => {
        this.error.set(getErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(status: Status): void {
    this.deletingStatus.set(status);
    this.replacementStatusId.set('');
    this.showDeleteDialog.set(true);
  }

  protected deleteStatus(): void {
    const status = this.deletingStatus();

    if (!status) return;

    this.saving.set(true);

    const replacementId = this.replacementStatusId() || undefined;

    this.statusClient
      .delete(status.id, replacementId)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.statuses.update((list) => list.filter((s) => s.id !== status.id));
          this.showDeleteDialog.set(false);
          this.deletingStatus.set(null);
          this.notify.success('toasts.deleted');
        },
        error: (err) => {
          this.error.set(getErrorMessage(err));
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
      this.deletingStatus.set(null);
    }
  }

  ngOnInit(): void {
    this.loadStatuses();
  }

  private loadStatuses(): void {
    this.loading.set(true);
    this.error.set('');
    this.statusClient
      .list(this.projectId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (statuses) => {
          this.statuses.set(statuses.sort((a, b) => a.position - b.position));
        },
        error: (err) => {
          this.error.set(getErrorMessage(err));
        },
      });
  }
}
