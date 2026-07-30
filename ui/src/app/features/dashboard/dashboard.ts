import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { AuthStore } from '@stores/auth-store';
import { TenantStore } from '@stores/tenant-store';
import { TenantClient } from '@services/tenant-client';
import { TaskClient } from '@services/task-client';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import type { TenantWithRole, MyInvitation, MyTask } from '@task-board/shared';

// Sub-views
import { LandingPage } from './landing-page/landing-page';
import { WelcomeView } from './welcome-view/welcome-view';
import { InvitationView } from './invitation-view/invitation-view';
import { MemberDashboard } from './member-dashboard/member-dashboard';
import { OwnerDashboard } from './owner-dashboard/owner-dashboard';

type DashboardState = 'visitor' | 'new-user' | 'pending-invitations' | 'member' | 'owner';

@Component({
  selector: 'ui-dashboard',
  imports: [HlmSpinnerImports, LandingPage, WelcomeView, InvitationView, MemberDashboard, OwnerDashboard],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  protected readonly authStore = inject(AuthStore);
  protected readonly tenantStore = inject(TenantStore);
  protected readonly tenantClient = inject(TenantClient);
  protected readonly taskClient = inject(TaskClient);
  protected readonly tenants = signal<TenantWithRole[]>([]);
  protected readonly invitations = signal<MyInvitation[]>([]);
  protected readonly tasks = signal<MyTask[]>([]);
  protected readonly loading = signal(true);
  protected readonly dashboardState = computed<DashboardState>(() => {
    if (!this.authStore.isAuthenticated()) return 'visitor';
    if (this.invitations().length > 0 && this.tenants().length === 0) return 'pending-invitations';
    if (this.tenants().length === 0) return 'new-user';
    if (this.tenants().some((t) => t.role === 'owner')) return 'owner';
    return 'member';
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

  private loadData(): void {
    let pending = 2;
    const done = () => {
      if (--pending === 0) this.loading.set(false);
    };

    this.tenantClient.getMyInvitations().subscribe({
      next: (res) => {
        this.invitations.set(res.data);
        done();
      },
      error: () => done(),
    });

    this.taskClient.getMyTasks().subscribe({
      next: (res) => {
        this.tasks.set(res.data);
        done();
      },
      error: () => done(),
    });
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
