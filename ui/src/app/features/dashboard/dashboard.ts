import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { TenantClient } from '@services/tenant-client';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import type { MyInvitation } from '@app/types/frontend';

// Sub-views
import { LandingPage } from './landing-page/landing-page';
import { WelcomeView } from './welcome-view/welcome-view';
import { InvitationView } from './invitation-view/invitation-view';

type DashboardState = 'visitor' | 'new-user' | 'pending-invitations' | 'redirecting';

/**
 * Root entry (`/`, DEC-033).
 *
 * - Visitor → landing page.
 * - Authenticated with accessible tenants → redirect to the last-selected
 *   (or first) tenant home `/w/:tenantSlug` (last-selection preference is
 *   persisted by the TenantStore in localStorage).
 * - Authenticated without tenants → welcome view; with only pending
 *   invitations → invitation view. Both behaviors are preserved.
 */
@Component({
  selector: 'ui-dashboard',
  imports: [HlmSpinnerImports, LandingPage, WelcomeView, InvitationView],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantClient = inject(TenantClient);
  private readonly router = inject(Router);
  protected readonly invitations = signal<MyInvitation[]>([]);
  protected readonly loading = signal(true);
  protected readonly dashboardState = computed<DashboardState>(() => {
    if (!this.authStore.isAuthenticated()) return 'visitor';
    if (this.tenantStore.tenants().length > 0) return 'redirecting';
    if (this.invitations().length > 0) return 'pending-invitations';
    return 'new-user';
  });

  async ngOnInit(): Promise<void> {
    // After page reload the token is restored from localStorage but
    // currentUser is not loaded yet. Fetch it before checking auth state.
    if (!this.authStore.currentUser() && this.authStore.token()) {
      try {
        await this.authStore.fetchCurrentUser();
      } catch {
        // 401 → fetchCurrentUser calls logout(); other errors → still not authenticated
        this.loading.set(false);
        return;
      }
    }

    if (!this.authStore.isAuthenticated()) {
      this.loading.set(false);
      return;
    }

    // Load tenants (with roles); TenantStore restores the last selection
    try {
      const tenants = await this.tenantStore.loadTenants();
      const active = this.tenantStore.activeTenant();

      if (tenants.length > 0 && active) {
        await this.router.navigate(['/w', active.slug], { replaceUrl: true });
        return;
      }
    } catch {
      this.loading.set(false);
      return;
    }

    // No tenants — load pending invitations for the welcome/invitation views
    try {
      const invitationsRes = await firstValueFrom(this.tenantClient.getMyInvitations());

      if (invitationsRes) {
        this.invitations.set(invitationsRes);
      }
    } catch {
      // Silently handle errors
    } finally {
      this.loading.set(false);
    }
  }

  /** Reload tenants after an invitation was accepted/declined */
  protected async onInvitationHandled(): Promise<void> {
    this.loading.set(true);

    try {
      const tenants = await this.tenantStore.loadTenants();
      const active = this.tenantStore.activeTenant();

      if (tenants.length > 0 && active) {
        await this.router.navigate(['/w', active.slug], { replaceUrl: true });
        return;
      }

      const invitationsRes = await firstValueFrom(this.tenantClient.getMyInvitations());

      this.invitations.set(invitationsRes ?? []);
    } catch {
      // keep current state
    } finally {
      this.loading.set(false);
    }
  }
}
