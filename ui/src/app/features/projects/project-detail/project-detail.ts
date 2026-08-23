import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucidePlus, lucideTrash2, lucideArchive, lucideRotateCcw, lucideXCircle } from '@ng-icons/lucide';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ProjectClient } from '@services/project-client';
import { BoardClient } from '@services/board-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import { TenantRole, ProjectRole, BoardType, ProjectStatus } from '@task-board/shared';
import { ProjectStatusColorMap, NeutralColor } from '@app/constants/priority';
import type { Project, Board, CreateBoard } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

interface BoardFormModel {
  name: string;
  type: string;
}

@Component({
  selector: 'ui-project-detail',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmCardImports,
    FormField,
    FormRoot,
  ],
  providers: [provideIcons({ lucidePlus, lucideTrash2, lucideArchive, lucideRotateCcw, lucideXCircle })],
  templateUrl: './project-detail.html',
})
export class ProjectDetail implements OnInit {
  private readonly projectClient = inject(ProjectClient);
  private readonly boardClient = inject(BoardClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  /** Bound via withComponentInputBinding() — now receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  protected readonly project = signal<Project | null>(null);
  protected readonly boards = signal<Board[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showCreateBoard = signal(false);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly deleteConfirmText = signal('');
  protected readonly boardTypes = Object.values(BoardType);
  protected readonly ProjectStatus = ProjectStatus;
  /**
   * Whether the current user has admin privileges.
   * Tenant OWNER/ADMIN bypass project role checks.
   * Project PROJECT_ADMIN can manage settings.
   */
  protected readonly isAdmin = computed(() => {
    const tenantRole = this.authStore.tenantRole();

    if (tenantRole === TenantRole.OWNER || tenantRole === TenantRole.ADMIN) return true;

    const projectRole = this.projectStore.projectRole();

    return projectRole === ProjectRole.PROJECT_ADMIN;
  });
  protected readonly boardModel = signal<BoardFormModel>({ name: '', type: BoardType.KANBAN });
  protected readonly createBoardForm = form(
    this.boardModel,
    schema<BoardFormModel>((field) => {
      required(field.name, { message: 'validation.boardNameRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.error.set('');

          const model = this.boardModel();
          const boardData: CreateBoard = {
            name: model.name,
            type: model.type as BoardType,
            columns: [
              { statusIds: [], position: 0 },
              { statusIds: [], position: 1 },
              { statusIds: [], position: 2 },
            ],
          };

          this.boardClient.create(this.projectId(), boardData).subscribe({
            next: (board) => {
              this.boards.update((list) => [...list, board]);
              this.showCreateBoard.set(false);
              f().reset({ name: '', type: BoardType.KANBAN });
            },
            error: (err) => {
              this.error.set(this.getErrorMessage(err));
            },
          });
        },
      },
    },
  );

  protected getStatusColor(status: string): string {
    return (ProjectStatusColorMap as Record<string, string>)[status] ?? NeutralColor;
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateBoard.set(false);
    }
  }

  protected onDeleteDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteConfirm.set(false);
      this.deleteConfirmText.set('');
    }
  }

  /** Whether the project is archived — disables all write controls */
  protected get isArchived(): boolean {
    return this.project()?.status !== ProjectStatus.ACTIVE;
  }

  /** Whether the delete confirmation text matches the project key */
  protected get canConfirmDelete(): boolean {
    const p = this.project();

    return p !== null && this.deleteConfirmText() === p.key;
  }

  protected requestDeleteProject(): void {
    this.deleteConfirmText.set('');
    this.showDeleteConfirm.set(true);
  }

  protected confirmDeleteProject(): void {
    this.deleteProject();
    this.showDeleteConfirm.set(false);
    this.deleteConfirmText.set('');
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
        },
        error: (err) => {
          this.error.set(this.getErrorMessage(err));
        },
      });
  }

  private loadBoards(): void {
    this.boardClient.list(this.projectId()).subscribe({
      next: (boards) => this.boards.set(boards),
    });
  }

  // ─── Project Lifecycle ────────────────────────────────────────────────────

  protected archiveProject(): void {
    this.projectClient.archive(this.projectId()).subscribe({
      next: () => {
        this.project.update((p) => (p ? { ...p, status: ProjectStatus.ARCHIVED } : p));
      },
      error: (err) => this.error.set(this.getErrorMessage(err)),
    });
  }

  protected restoreProject(): void {
    this.projectClient.restore(this.projectId()).subscribe({
      next: () => {
        this.project.update((p) => (p ? { ...p, status: ProjectStatus.ACTIVE, deletionScheduledAt: null } : p));
      },
      error: (err) => this.error.set(this.getErrorMessage(err)),
    });
  }

  protected deleteProject(): void {
    this.projectClient.delete(this.projectId()).subscribe({
      next: () => {
        this.project.update((p) => (p ? { ...p, status: ProjectStatus.DELETION_PENDING } : p));
      },
      error: (err) => this.error.set(this.getErrorMessage(err)),
    });
  }

  protected cancelDeletion(): void {
    this.projectClient.cancelDeletion(this.projectId()).subscribe({
      next: () => {
        this.project.update((p) => (p ? { ...p, status: ProjectStatus.ACTIVE, deletionScheduledAt: null } : p));
      },
      error: (err) => this.error.set(this.getErrorMessage(err)),
    });
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message ?? err.message;
    }

    return 'errors.unexpected';
  }
}
