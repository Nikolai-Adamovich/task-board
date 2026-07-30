import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucidePlus, lucideUserPlus, lucideTrash2 } from '@ng-icons/lucide';
import { ProjectClient } from '@services/project-client';
import { BoardClient } from '@services/board-client';
import { AuthStore } from '@stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { ProjectRole, TenantRole } from '@task-board/shared';
import type { Project, Board, ProjectMember, CreateBoard } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'ui-project-detail',
  imports: [
    RouterLink,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmAvatarImports,
    HlmNativeSelectImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideUserPlus, lucideTrash2 })],
  templateUrl: './project-detail.html',
})
export class ProjectDetail implements OnInit {
  private readonly projectClient = inject(ProjectClient);
  private readonly boardClient = inject(BoardClient);
  private readonly authStore = inject(AuthStore);
  /** Bound via withComponentInputBinding() */
  readonly projectId = input.required<string>();
  protected readonly project = signal<Project | null>(null);
  protected readonly boards = signal<Board[]>([]);
  protected readonly members = signal<ProjectMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly showCreateBoard = signal(false);
  protected readonly creatingBoard = signal(false);
  protected newBoard: CreateBoard = { name: '', description: '' };
  // ── Member management state ──────────────────────────────────────────────────
  protected readonly showAddMember = signal(false);
  protected readonly addingMember = signal(false);
  protected readonly showRemoveConfirm = signal(false);
  protected readonly removingMember = signal(false);
  protected newMemberUserId = '';
  protected newMemberRole = 'developer';
  protected memberToRemove: ProjectMember | null = null;
  protected readonly projectRoles = Object.values(ProjectRole);
  /** Whether the current user has admin/owner privileges */
  protected readonly isAdmin = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.Owner || role === TenantRole.Admin;
  });

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateBoard.set(false);
    }
  }

  protected onAddMemberDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showAddMember.set(false);
    }
  }

  protected onRemoveDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showRemoveConfirm.set(false);
      this.memberToRemove = null;
    }
  }

  ngOnInit(): void {
    this.loadProject();
  }

  private loadProject(): void {
    this.loading.set(true);
    this.projectClient.getById(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loadBoards();
        this.loadMembers();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadBoards(): void {
    this.boardClient.list(this.projectId()).subscribe({
      next: (res) => this.boards.set(res.data),
    });
  }

  private loadMembers(): void {
    this.projectClient.listMembers(this.projectId()).subscribe({
      next: (res) => this.members.set(res.data),
    });
  }

  protected createBoard(): void {
    if (!this.newBoard.name) return;
    this.creatingBoard.set(true);
    this.boardClient.create(this.projectId(), this.newBoard).subscribe({
      next: (board) => {
        this.boards.update((list) => [...list, board]);
        this.showCreateBoard.set(false);
        this.newBoard = { name: '', description: '' };
        this.creatingBoard.set(false);
      },
      error: () => this.creatingBoard.set(false),
    });
  }

  // ── Member management methods ────────────────────────────────────────────────

  protected addMember(): void {
    if (!this.newMemberUserId) return;
    this.addingMember.set(true);
    this.projectClient.addMember(this.projectId(), this.newMemberUserId, this.newMemberRole).subscribe({
      next: () => {
        this.loadMembers();
        this.showAddMember.set(false);
        this.newMemberUserId = '';
        this.newMemberRole = 'developer';
        this.addingMember.set(false);
      },
      error: () => this.addingMember.set(false),
    });
  }

  protected onRoleChange(member: ProjectMember, newRole: string): void {
    if (newRole === member.role) return;
    this.projectClient.updateMemberRole(this.projectId(), member.userId, newRole).subscribe({
      next: () => this.loadMembers(),
    });
  }

  protected confirmRemoveMember(member: ProjectMember): void {
    this.memberToRemove = member;
    this.showRemoveConfirm.set(true);
  }

  protected removeMember(): void {
    if (!this.memberToRemove) return;
    this.removingMember.set(true);
    this.projectClient.removeMember(this.projectId(), this.memberToRemove.userId).subscribe({
      next: () => {
        this.loadMembers();
        this.showRemoveConfirm.set(false);
        this.memberToRemove = null;
        this.removingMember.set(false);
      },
      error: () => this.removingMember.set(false),
    });
  }
}
