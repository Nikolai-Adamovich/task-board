import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideFolderOpen } from '@ng-icons/lucide';
import { ProjectClient } from '../../../services/project-client';
import { TenantClient } from '../../../services/tenant-client';
import { AuthStore } from '../../../stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { NgIcon } from '@ng-icons/core';
import type { Project, CreateProject } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'app-project-list',
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideFolderOpen })],
  templateUrl: './project-list.html',
})
export class ProjectList implements OnInit {
  private readonly projectService = inject(ProjectClient);
  private readonly tenantService = inject(TenantClient);
  private readonly authStore = inject(AuthStore);

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly showCreateModal = signal(false);
  protected newProject: CreateProject = { name: '', slug: '', description: '' };

  protected tenantId = signal('');

  protected canCreate(): boolean {
    return !!this.authStore.currentUser();
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateModal.set(false);
    }
  }

  ngOnInit(): void {
    const tenant = this.tenantService.activeTenant();
    if (tenant) {
      this.tenantId.set(tenant.id);
      this.loadProjects();
    }
  }

  protected loadProjects(): void {
    this.loading.set(true);
    this.projectService.list().subscribe({
      next: (res) => {
        this.projects.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected createProject(): void {
    if (!this.newProject.name || !this.newProject.slug) return;
    this.creating.set(true);
    this.projectService.create(this.newProject).subscribe({
      next: (project) => {
        this.projects.update((list) => [...list, project]);
        this.showCreateModal.set(false);
        this.newProject = { name: '', slug: '', description: '' };
        this.creating.set(false);
      },
      error: () => this.creating.set(false),
    });
  }
}
