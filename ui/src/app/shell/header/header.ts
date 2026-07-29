import { Component, inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';
import { AuthClient } from '@services/auth-client';
import { TenantSwitcher } from '../tenant-switcher/tenant-switcher';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'ui-header',
  imports: [TenantSwitcher, HlmButtonImports],
  templateUrl: './header.html',
})
export class Header {
  protected readonly authStore = inject(AuthStore);
  private readonly authClient = inject(AuthClient);

  logout(): void {
    this.authClient.logout();
  }
}
