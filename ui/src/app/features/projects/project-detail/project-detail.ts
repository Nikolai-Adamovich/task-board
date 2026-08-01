import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucidePlus, lucideUserPlus, lucideTrash2 } from '@ng-icons/lucide';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
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
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import { ProjectRole, TenantRole } from '@task-board/shared';
import type { Project, Board, ProjectMember } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

interface BoardFormModel {
  name: string;
  description: string;
}

@Component({
  selector: 'ui-project-detail',
  imports: [
    RouterLink,
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
    FormField,
    FormRoot,
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
  protected readonly error = signal('');
  protected readonly showCreateBoard = signal(false);
  protected readonly showAddMember = signal(false);
  protected readonly showRemoveConfirm = signal(false);
  protected readonly memberToRemove = signal<ProjectMember | null>(null);
  protected readonly projectRoles = Object.values(ProjectRole);
  /** Whether the current user has admin/owner privileges */
  protected readonly isAdmin = computed(() => {
    const role = this.authStore.tenantRole();

    return role === TenantRole.Owner || role === TenantRole.Admin;
  });
  protected readonly boardModel = signal<BoardFormModel>({ name: '', description: '' });
  protected readonly createBoardForm = form(
    this.boardModel,
    schema<BoardFormModel>((field) => {
      required(field.name, { message: 'Board name is required' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          this.boardClient.create(this.projectId(), this.boardModel()).subscribe({
            next: (board) => {
              this.boards.update((list) => [...list, board]);
              this.showCreateBoard.set(false);
              this.boardModel.set({ name: '', description: '' });
            },
            error: (err) => {
              this.error.set(this.getErrorMessage(err));
            },
          });
        },
      },
    },
  );
  private readonly memberModel = signal<{ userId: string; role: string }>({
    userId: '',
    role: ProjectRole.Developer,
  });
  protected readonly addMemberForm = form(
    this.memberModel,
    schema<{ userId: string; role: string }>((field) => {
      required(field.userId, { message: 'User ID is required' });
    }),
    {
      submission: {
        action: async () => {
          this.error.set('');

          this.projectClient
            .addMember(this.projectId(), this.memberModel().userId, this.memberModel().role as ProjectRole)
            .subscribe({
              next: () => {
                this.loadMembers();
                this.showAddMember.set(false);
                this.memberModel.set({ userId: '', role: ProjectRole.Developer });
              },
              error: (err) => {
                this.error.set(this.getErrorMessage(err));
              },
            });
        },
      },
    },
  );

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
      this.memberToRemove.set(null);
    }
  }

  ngOnInit(): void {
    this.loadProject();
  }

  private loadProject(): void {
    this.loading.set(true);
    this.error.set('');
    this.projectClient
      .getById(this.projectId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (project) => {
          this.project.set(project);
          this.loadBoards();
          this.loadMembers();
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
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

  protected onRoleChange(member: ProjectMember, newRole: string | null | undefined): void {
    if (!newRole || newRole === member.role) return;
    this.projectClient.updateMemberRole(this.projectId(), member.userId, newRole).subscribe({
      next: () => this.loadMembers(),
    });
  }

  protected confirmRemoveMember(member: ProjectMember): void {
    this.memberToRemove.set(member);
    this.showRemoveConfirm.set(true);
  }

  protected removeMember(): void {
    const member = this.memberToRemove();

    if (!member) return;

    this.projectClient.removeMember(this.projectId(), member.userId).subscribe({
      next: () => {
        this.loadMembers();
        this.showRemoveConfirm.set(false);
        this.memberToRemove.set(null);
      },
    });
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}
