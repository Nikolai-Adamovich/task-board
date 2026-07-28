import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TenantClient } from '@services/tenant-client';

@Component({
  selector: 'ui-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly tenantService = inject(TenantClient);
}
