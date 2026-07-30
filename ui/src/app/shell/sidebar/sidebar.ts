import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TenantStore } from '@stores/tenant-store';

@Component({
  selector: 'ui-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly tenantStore = inject(TenantStore);
}
