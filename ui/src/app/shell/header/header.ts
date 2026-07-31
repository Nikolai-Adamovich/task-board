import { Component, inject } from '@angular/core';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';

@Component({
  selector: 'ui-header',
  imports: [HlmButtonImports, HlmSidebarImports],
  templateUrl: './header.html',
})
export class Header {
  protected readonly authStore = inject(AuthStore);

  logout(): void {
    this.authStore.logout();
  }
}
