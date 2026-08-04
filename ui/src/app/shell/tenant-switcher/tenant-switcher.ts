import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideCheck, lucidePlus } from '@ng-icons/lucide';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon } from '@ng-icons/core';
import type { TenantWithRole } from '@task-board/shared';

@Component({
  selector: 'ui-tenant-switcher',
  imports: [NgIcon, HlmButtonImports, TranslocoPipe],
  providers: [provideIcons({ lucideChevronDown, lucideCheck, lucidePlus })],
  templateUrl: './tenant-switcher.html',
})
export class TenantSwitcher {
  protected readonly tenantStore = inject(TenantStore);
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly isOpen = signal(false);

  protected toggleDropdown(): void {
    this.isOpen.update((v) => !v);
  }

  protected selectTenant(tenant: TenantWithRole): void {
    this.tenantStore.setActiveTenant(tenant);
    this.authStore.setTenantRole(tenant.role);
    this.isOpen.set(false);
  }

  protected isActive(tenant: TenantWithRole): boolean {
    return this.tenantStore.activeTenant()?.id === tenant.id;
  }

  protected navigateToCreate(): void {
    this.isOpen.set(false);
    this.router.navigate(['/workspace/create']);
  }
}
