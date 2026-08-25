import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideFolderOpen } from '@ng-icons/lucide';
import { rxResource } from '@angular/core/rxjs-interop';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { NgIcon } from '@ng-icons/core';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

export interface CreateProjectForm {
  name: string;
  key: string;
  description: string;
}

@Component({
  selector: 'ui-project-list',
  imports: [
    HlmAlertImports,
    HlmEmptyImports,
    RouterLink,
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
  ],
  providers: [provideIcons({ lucidePlus, lucideFolderOpen })],
  templateUrl: './project-list.html',
})
export class ProjectList {
  private readonly notify = injectToasts();
  private readonly projectClient = inject(ProjectClient);
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly projectsResource = rxResource({
    params: () => {
      const tenantId = this.tenantStore.activeTenant()?.id;

      return tenantId ? { tenantId } : undefined; // undefined → resource stays idle
    },
    stream: () => this.projectClient.list(),
    defaultValue: [],
  });
  protected readonly projects = computed(() => (this.projectsResource.hasValue() ? this.projectsResource.value() : []));
  protected readonly loading = computed(() => this.projectsResource.isLoading());
  private readonly actionError = signal('');
  protected readonly error = computed(() => {
    if (this.actionError()) return this.actionError();

    const err = this.projectsResource.error();

    return err ? getErrorMessage(err) : '';
  });
  protected readonly showCreateModal = signal(false);
  protected readonly tenantId = computed(() => this.tenantStore.activeTenant()?.id ?? '');
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

  protected canCreate(): boolean {
    return !!this.authStore.currentUser();
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateModal.set(false);
    }
  }
}
