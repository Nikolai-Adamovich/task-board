import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideFolder, lucidePanelLeft, lucideSettings, lucideUsers } from '@ng-icons/lucide';
import { TenantStore } from '@stores/tenant-store';
import { TenantSwitcher } from '../tenant-switcher/tenant-switcher';

@Component({
  selector: 'ui-sidebar',
  imports: [RouterLink, RouterLinkActive, HlmSidebarImports, HlmButtonImports, NgIcon, TenantSwitcher, TranslocoPipe],
  providers: [
    provideIcons({
      lucidePanelLeft,
      lucideFolder,
      lucideCalendar,
      lucideSettings,
      lucideUsers,
    }),
  ],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly tenantStore = inject(TenantStore);
}
