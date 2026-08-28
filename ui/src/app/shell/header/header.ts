import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMenu } from '@ng-icons/lucide';
import { HeaderActions } from './header-actions/header-actions';
import { HeaderBranding } from './header-branding/header-branding';

@Component({
  selector: 'ui-header',
  imports: [HeaderBranding, HeaderActions, HlmButtonImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideMenu })],
  templateUrl: './header.html',
})
export class Header {
  /** DEC-052a: below md the Spartan sidebar renders as an offcanvas sheet —
   *  this hamburger toggles its openMobile state (no-op on desktop). */
  protected readonly sidebarService = inject(HlmSidebarService);

  protected openMobileSidebar(): void {
    this.sidebarService.setOpenMobile(true);
  }
}
