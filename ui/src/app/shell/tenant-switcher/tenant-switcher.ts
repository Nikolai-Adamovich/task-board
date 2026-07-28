import { Component, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideCheck } from '@ng-icons/lucide';
import { TenantClient } from '@services/tenant-client';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon } from '@ng-icons/core';
import type { Tenant } from '@task-board/shared';

@Component({
  selector: 'ui-tenant-switcher',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideChevronDown, lucideCheck })],
  templateUrl: './tenant-switcher.html',
})
export class TenantSwitcher {
  protected readonly tenantService = inject(TenantClient);
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
}
