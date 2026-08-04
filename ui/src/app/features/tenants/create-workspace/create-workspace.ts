import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoPipe } from '@jsverse/transloco';
import { SubscriptionTier, TenantRole } from '@task-board/shared';
import { form, FormField, FormRoot, schema, required, minLength, maxLength } from '@angular/forms/signals';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

interface WorkspaceModel {
  name: string;
  slug: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

@Component({
  imports: [
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmButtonImports,
    HlmSpinnerImports,
  ],
  selector: 'ui-create-workspace',
  templateUrl: './create-workspace.html',
})
export class CreateWorkspace {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  protected readonly error = signal('');
  private readonly model = signal<WorkspaceModel>({ name: '', slug: '' });
  protected readonly workspaceForm = form(
    this.model,
    schema<WorkspaceModel>((field) => {
      required(field.name, { message: 'validation.workspaceNameRequired' });
      maxLength(field.name, 100, { message: 'validation.nameMax' });
      required(field.slug, { message: 'validation.slugRequired' });
      minLength(field.slug, 2, { message: 'validation.slugMin' });
      maxLength(field.slug, 80, { message: 'validation.slugMax' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          try {
            const tenant = await this.tenantStore.createTenant({
              name: this.model().name,
              slug: this.model().slug,
              subscription: SubscriptionTier.Free,
            });

            this.authStore.setTenantContext(tenant.id, TenantRole.Owner);

            await this.router.navigateByUrl('/');
          } catch (err) {
            if (err instanceof HttpErrorResponse) {
              this.error.set(err.error?.message ?? err.message);
            } else {
              this.error.set('createWorkspace.failed');
            }
          }
        },
      },
    },
  );

  protected onNameChange(): void {
    const name = this.model().name;

    this.model.update((m) => ({ ...m, slug: slugify(name) }));
  }
}
