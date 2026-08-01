import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideSettings, lucideTrash2, lucideSave } from '@ng-icons/lucide';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { TenantRole } from '@task-board/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'ui-tenant-settings',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmDialogImports,
    FormField,
    FormRoot,
  ],
  providers: [provideIcons({ lucideSettings, lucideTrash2, lucideSave })],
  templateUrl: './tenant-settings.html',
})
export class TenantSettings implements OnInit {
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showDeleteDialog = signal(false);
  protected readonly deleteConfirmName = signal('');
  /** Current tenant name, used for delete confirmation comparison */
  protected readonly currentTenantName = computed(() => this.tenantStore.activeTenant()?.name ?? '');
  private readonly tenantId = computed(() => this.tenantStore.activeTenant()?.id ?? null);
  protected readonly canEdit = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.Owner || role === TenantRole.Admin;
  });
  private readonly model = signal<{ name: string; slug: string }>({ name: '', slug: '' });
  protected readonly settingsForm = form(
    this.model,
    schema<{ name: string; slug: string }>((field) => {
      required(field.name, { message: 'Name is required' });
      required(field.slug, { message: 'Slug is required' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          const id = this.tenantId();

          if (!id) return;

          try {
            await this.tenantStore.updateTenant(id, { name: this.model().name, slug: this.model().slug });
            this.router.navigate(['/']);
          } catch (err) {
            this.error.set(this.getErrorMessage(err));
          }
        },
      },
    },
  );

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteDialog.set(false);
      this.deleteConfirmName.set('');
    }
  }

  ngOnInit(): void {
    const tenant = this.tenantStore.activeTenant();

    if (tenant) {
      this.model.set({ name: tenant.name, slug: tenant.slug });
      this.loading.set(false);
    } else {
      this.loading.set(false);
    }
  }

  protected deleteTenant(): void {
    const tenant = this.tenantStore.activeTenant();

    if (!tenant || this.deleteConfirmName() !== tenant.name) return;

    this.tenantStore.deleteTenant(tenant.id).then(
      () => {
        this.router.navigate(['/']);
      },
      (err) => {
        this.error.set(this.getErrorMessage(err));
      },
    );
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
