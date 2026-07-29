import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthStore } from '@stores/auth-store';
import { TenantClient } from '@services/tenant-client';
import { ProjectClient } from '@services/project-client';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import type { Project } from '@task-board/shared';

@Component({
  selector: 'ui-dashboard',
  imports: [RouterLink, DatePipe, HlmSpinnerImports, HlmCardImports, HlmAvatarImports],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  protected readonly authStore = inject(AuthStore);
  protected readonly tenantService = inject(TenantClient);
  private readonly projectService = inject(ProjectClient);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    // fetchCurrentUser is now handled by the authGuard before the
    // Dashboard loads. No need to call it here.

    // Load tenants first, then load projects once tenant is available
    this.tenantService.loadTenants().subscribe({
      next: () => {
        if (this.tenantService.activeTenant()) {
          this.loadProjects();
        }
      },
    });
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.projectService.list(1, 6).subscribe({
      next: (res) => {
        this.projects.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
