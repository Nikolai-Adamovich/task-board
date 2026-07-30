import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideCheck, lucidePlus } from '@ng-icons/lucide';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon } from '@ng-icons/core';
import type { Tenant } from '@task-board/shared';

@Component({
  selector: 'ui-tenant-switcher',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideChevronDown, lucideCheck, lucidePlus })],
  templateUrl: './tenant-switcher.html',
})
export class TenantSwitcher {
  protected readonly tenantService = inject(TenantClient);
  protected readonly authStore = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly isOpen = signal(false);

  protected toggleDropdown(): void {
    this.isOpen.update((v) => !v);
  }

  protected selectTenant(tenant: Tenant): void {
    this.tenantService.setActiveTenant(tenant);
    this.isOpen.set(false);
  }

  protected isActive(tenant: Tenant): boolean {
    return this.tenantService.activeTenant()?.id === tenant.id;
  }

  protected navigateToCreate(): void {
    this.isOpen.set(false);
    this.router.navigate(['/workspace/create']);
  }
}
