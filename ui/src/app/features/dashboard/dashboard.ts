import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TenantRole } from '@task-board/shared';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { TenantClient } from '@services/tenant-client';
import { TaskClient } from '@services/task-client';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import type { TenantWithRole, MyInvitation, MyTask } from '@app/types/frontend';

// Sub-views
import { LandingPage } from './landing-page/landing-page';
import { WelcomeView } from './welcome-view/welcome-view';
import { InvitationView } from './invitation-view/invitation-view';
import { MemberDashboard } from './member-dashboard/member-dashboard';
import { OwnerDashboard } from './owner-dashboard/owner-dashboard';

type DashboardState =
  'visitor' | 'new-user' | 'pending-invitations' | typeof TenantRole.MEMBER | typeof TenantRole.OWNER;

@Component({
  selector: 'ui-dashboard',
  imports: [HlmSpinnerImports, LandingPage, WelcomeView, InvitationView, MemberDashboard, OwnerDashboard],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  protected readonly TenantRole = TenantRole;
  private readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantClient = inject(TenantClient);
  private readonly taskClient = inject(TaskClient);
  protected readonly tenants = signal<TenantWithRole[]>([]);
  protected readonly invitations = signal<MyInvitation[]>([]);
  protected readonly tasks = signal<MyTask[]>([]);
  protected readonly loading = signal(true);
  protected readonly dashboardState = computed<DashboardState>(() => {
    if (!this.authStore.isAuthenticated()) return 'visitor';
    if (this.invitations().length > 0 && this.tenants().length === 0) return 'pending-invitations';
    if (this.tenants().length === 0) return 'new-user';
    if (this.tenants().some((t) => t.role === TenantRole.OWNER)) return TenantRole.OWNER;
    return TenantRole.MEMBER;
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

    // Load tenants (with roles)
    this.tenantStore.loadTenants().then(
      () => {
        this.tenants.set(this.tenantStore.tenants() as TenantWithRole[]);
        this.loadData();
      },
      () => this.loading.set(false),
    );
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [invitationsRes, tasksRes] = await Promise.all([
        firstValueFrom(this.tenantClient.getMyInvitations()),
        firstValueFrom(this.taskClient.getMyTasks()),
      ]);

      if (invitationsRes) {
        this.invitations.set(invitationsRes);
      }

      if (tasksRes) {
        this.tasks.set(tasksRes);
      }
    } catch {
      // Silently handle errors
    } finally {
      this.loading.set(false);
    }
  }

  protected onInvitationHandled(): void {
    this.loading.set(true);
    this.tenantStore.loadTenants().then(
      () => {
        this.tenants.set(this.tenantStore.tenants() as TenantWithRole[]);
        this.loadData();
      },
      () => this.loading.set(false),
    );
  }
}
