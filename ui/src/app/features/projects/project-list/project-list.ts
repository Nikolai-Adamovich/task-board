import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideFolderOpen } from '@ng-icons/lucide';
import { finalize } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { HttpErrorResponse } from '@angular/common/http';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { NgIcon } from '@ng-icons/core';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Project } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

export interface CreateProjectForm {
  name: string;
  slug: string;
  description: string;
}

@Component({
  selector: 'ui-project-list',
  imports: [
    RouterLink,
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
export class ProjectList implements OnInit {
  private readonly projectClient = inject(ProjectClient);
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateModal = signal(false);
  protected readonly tenantId = signal('');
  private readonly model = signal<CreateProjectForm>({
    name: '',
    slug: '',
    description: '',
  });
  protected readonly newProjectForm = form(
    this.model,
    schema<CreateProjectForm>((field) => {
      required(field.name, { message: 'Name is required' });
      required(field.slug, { message: 'Slug is required' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');
          this.projectClient
            .create({
              name: this.model().name,
              slug: this.model().slug,
              description: this.model().description,
            })
            .subscribe({
              next: (project) => {
                this.projects.update((list) => [...list, project]);
                this.showCreateModal.set(false);
                f().reset({ name: '', slug: '', description: '' });
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
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

  ngOnInit(): void {
    const tenant = this.tenantStore.activeTenant();

    if (tenant) {
      this.tenantId.set(tenant.id);
      this.loadProjects();
    }
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.projectClient
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.projects.set(res.data);
        },
      });
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
