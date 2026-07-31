import { Component, computed, inject, signal } from '@angular/core';
import { ExpandState, SubscriptionTier } from '@task-board/shared';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideLogOut, lucidePalette, lucideSettings } from '@ng-icons/lucide';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import {
  HlmDropdownMenu,
  HlmDropdownMenuItem,
  HlmDropdownMenuLabel,
  HlmDropdownMenuSeparator,
  HlmDropdownMenuTrigger,
} from '@spartan-ng/helm/dropdown-menu';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { getRoleColor } from '../role-color.util';
import { UserMenuThemeSheet } from './user-menu-theme-sheet/user-menu-theme-sheet';
import { UserMenuZoomControls } from './user-menu-zoom-controls/user-menu-zoom-controls';

@Component({
  selector: 'ui-user-menu',
  imports: [
    RouterLink,
    NgIcon,
    HlmAvatarImports,
    HlmBadgeImports,
    HlmButtonImports,
    HlmDropdownMenu,
    HlmDropdownMenuItem,
    HlmDropdownMenuLabel,
    HlmDropdownMenuSeparator,
    HlmDropdownMenuTrigger,
    UserMenuThemeSheet,
    UserMenuZoomControls,
  ],
  providers: [provideIcons({ lucideGlobe, lucidePalette, lucideSettings, lucideLogOut })],
  templateUrl: './user-menu.html',
})
export class UserMenu {
  protected readonly ExpandState = ExpandState;
  private readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  protected readonly user = computed(() => this.authStore.currentUser());
  protected readonly role = computed(() => this.authStore.tenantRole());
  protected readonly subscription = computed(
    () => this.tenantStore.activeTenant()?.subscription ?? SubscriptionTier.Free,
  );
  protected readonly roleColor = computed(() => getRoleColor(this.role()));
  protected readonly roleLabel = computed(() => {
    const r = this.role();

    if (!r) return 'Member';
    return r.charAt(0).toUpperCase() + r.slice(1);
  });
  protected readonly initials = computed(() => {
    const name = this.user()?.displayName ?? '';

    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });
  protected readonly themeSheetOpen = signal<ExpandState>(ExpandState.Closed);

  protected logout(): void {
    this.authStore.logout();
  }
}
