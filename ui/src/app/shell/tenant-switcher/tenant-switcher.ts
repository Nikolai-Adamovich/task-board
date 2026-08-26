import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideCheck, lucidePlus } from '@ng-icons/lucide';
import { NgIcon } from '@ng-icons/core';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports, HlmDropdownMenuTrigger } from '@spartan-ng/helm/dropdown-menu';
import type { TenantWithRole } from '@app/types/frontend';

@Component({
  selector: 'ui-tenant-switcher',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports, HlmDropdownMenuTrigger, TranslocoPipe],
  providers: [provideIcons({ lucideChevronDown, lucideCheck, lucidePlus })],
  templateUrl: './tenant-switcher.html',
})
export class TenantSwitcher {
  protected readonly tenantStore = inject(TenantStore);
  protected readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly router = inject(Router);

  protected selectTenant(tenant: TenantWithRole): void {
    this.tenantStore.setActiveTenant(tenant);
    this.authStore.setTenantRole(tenant.role);
    // Navigate to the tenant home by slug and clear project context (IA §2.1)
    this.projectStore.clearProject();
    this.router.navigate(['/t', tenant.slug]);
  }

  protected isActive(tenant: TenantWithRole): boolean {
    return this.tenantStore.activeTenant()?.id === tenant.id;
  }

  protected navigateToCreate(): void {
    this.router.navigate(['/workspace/create']);
  }
}
