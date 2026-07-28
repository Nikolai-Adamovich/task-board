import { Component, inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';
import { TenantSwitcher } from '../tenant-switcher/tenant-switcher';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'ui-header',
  imports: [TenantSwitcher, HlmButtonImports],
  templateUrl: './header.html',
})
export class Header {
  protected readonly authStore = inject(AuthStore);

  logout(): void {
    this.authStore.logout();
  }
}
