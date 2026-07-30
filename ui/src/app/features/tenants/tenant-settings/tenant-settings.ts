import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'ui-tenant-settings',
  imports: [
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmDialogImports,
  ],
  providers: [provideIcons({ lucideSettings, lucideTrash2, lucideSave })],
  templateUrl: './tenant-settings.html',
})
export class TenantSettings implements OnInit {
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly showDeleteDialog = signal(false);
  protected readonly deleteConfirmName = signal('');
  protected name = '';
  protected slug = '';
  /** Current tenant name, used for delete confirmation comparison */
  protected readonly currentTenantName = computed(() => this.tenantStore.activeTenant()?.name ?? '');
  private readonly tenantId = computed(() => this.tenantStore.activeTenant()?.id ?? null);
  protected readonly canEdit = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.Owner || role === TenantRole.Admin;
  });

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteDialog.set(false);
      this.deleteConfirmName.set('');
    }
  }

  ngOnInit(): void {
    const tenant = this.tenantStore.activeTenant();

    if (tenant) {
      this.name = tenant.name;
      this.slug = tenant.slug;
      this.loading.set(false);
    } else {
      this.loading.set(false);
    }
  }

  protected save(): void {
    const id = this.tenantId();

    if (!id || !this.name || !this.slug) return;

    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.tenantStore.updateTenant(id, { name: this.name, slug: this.slug }).then(
      () => {
        this.successMessage.set('Tenant settings updated successfully.');
        this.saving.set(false);
      },
      () => {
        this.errorMessage.set('Failed to update tenant settings.');
        this.saving.set(false);
      },
    );
  }

  protected deleteTenant(): void {
    const tenant = this.tenantStore.activeTenant();

    if (!tenant || this.deleteConfirmName() !== tenant.name) return;

    this.deleting.set(true);

    this.tenantStore.deleteTenant(tenant.id).then(
      () => {
        this.router.navigate(['/']);
      },
      () => {
        this.deleting.set(false);
        this.errorMessage.set('Failed to delete tenant.');
      },
    );
  }
}
