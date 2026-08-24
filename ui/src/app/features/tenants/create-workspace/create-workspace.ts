import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantRole } from '@task-board/shared';
import { form, FormField, FormRoot, schema, required, maxLength } from '@angular/forms/signals';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

interface WorkspaceModel {
  name: string;
  description: string;
}

@Component({
  imports: [
    HlmAlertImports,
    TranslocoPipe,
    FormField,
    FormRoot,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
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
  private readonly model = signal<WorkspaceModel>({ name: '', description: '' });
  protected readonly workspaceForm = form(
    this.model,
    schema<WorkspaceModel>((field) => {
      required(field.name, { message: 'validation.workspaceNameRequired' });
      maxLength(field.name, 100, { message: 'validation.nameMax' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          try {
            const tenant = await this.tenantStore.createTenant({
              name: this.model().name,
              description: this.model().description || undefined,
            });

            this.authStore.setTenantContext(tenant.id, TenantRole.OWNER);

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
}
