import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideSettings, lucideUsers, lucideChevronDown, lucideFolder, lucideChevronRight } from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { firstValueFrom } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { TenantRole, TenantStatus } from '@task-board/shared';
import { TenantStatusColorMap, NeutralColor } from '@app/constants/priority';
import type { Project } from '@task-board/shared';

@Component({
  selector: 'ui-workspace-detail',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmCollapsibleImports,
    HlmSpinnerImports,
  ],
  providers: [
    provideIcons({
      lucideSettings,
      lucideUsers,
      lucideChevronDown,
      lucideFolder,
      lucideChevronRight,
    }),
  ],
  templateUrl: './workspace-detail.html',
})
export class WorkspaceDetail implements OnInit {
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly projectClient = inject(ProjectClient);
  protected readonly tenant = computed(() => this.tenantStore.activeTenant());
  protected readonly role = computed(() => this.authStore.tenantRole());
  protected readonly projects = signal<Project[]>([]);
  protected readonly loadingProjects = signal(true);
  protected readonly projectsExpanded = signal(true);
  protected readonly TenantStatus = TenantStatus;
  protected readonly isOwnerOrAdmin = computed(() => {
    const r = this.role();

    return r === TenantRole.OWNER || r === TenantRole.ADMIN;
  });

  protected getStatusColor(status: string): string {
    return (TenantStatusColorMap as Record<string, string>)[status] ?? NeutralColor;
  }

  async ngOnInit(): Promise<void> {
    try {
      const projects = await firstValueFrom(this.projectClient.list());

      this.projects.set(projects);
    } catch {
      this.projects.set([]);
    } finally {
      this.loadingProjects.set(false);
    }
  }
}
