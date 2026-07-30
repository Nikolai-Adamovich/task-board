import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import {
  lucideSettings,
  lucideUsers,
  lucideCreditCard,
  lucideChevronDown,
  lucideFolder,
  lucideChevronRight,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { firstValueFrom } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import type { Project } from '@task-board/shared';

@Component({
  selector: 'ui-workspace-detail',
  imports: [
    RouterLink,
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
      lucideCreditCard,
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
  protected readonly isOwnerOrAdmin = computed(() => {
    const r = this.role();

    return r === 'owner' || r === 'admin';
  });
  protected readonly isOwner = computed(() => this.role() === 'owner');
  protected readonly showUpgrade = computed(() => this.isOwner() && this.tenant()?.subscription === 'free');

  async ngOnInit(): Promise<void> {
    try {
      const res = await firstValueFrom(this.projectClient.list(1, 100));

      this.projects.set(res.data);
    } catch {
      this.projects.set([]);
    } finally {
      this.loadingProjects.set(false);
    }
  }
}
