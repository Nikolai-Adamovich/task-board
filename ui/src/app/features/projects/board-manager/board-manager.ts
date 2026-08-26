import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertTriangle, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { rxResource } from '@angular/core/rxjs-interop';
import { BoardClient } from '@services/board-client';
import { StatusClient } from '@services/status-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { BoardType, type Status } from '@task-board/shared';
import { form, FormField, FormRoot, schema, required } from '@angular/forms/signals';
import type { Board, CreateBoard } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import { canManageProject } from '@app/shared/utils/role-utils';
import { injectToasts } from '@app/shared/utils/toast-utils';
import { getErrorMessage } from '@app/shared/utils/error-utils';

interface BoardFormModel {
  name: string;
  type: string;
}

/**
 * Project settings — Boards administration page (spec S15, DEC-035).
 * List / create / rename / delete boards. Deleting the default board is
 * blocked client-side (BR-023). Columns referencing statuses that no longer
 * exist are marked red.
 */
@Component({
  selector: 'ui-board-manager',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmBadgeImports,
    HlmCardImports,
    HlmEmptyImports,
    HlmAlertImports,
    FormField,
    FormRoot,
  ],
  providers: [provideIcons({ lucideAlertTriangle, lucidePencil, lucidePlus, lucideTrash2 })],
  templateUrl: './board-manager.html',
})
export class BoardManager {
  private readonly notify = injectToasts();
  private readonly boardClient = inject(BoardClient);
  private readonly statusClient = inject(StatusClient);
  private readonly authStore = inject(AuthStore);
  private readonly projectStore = inject(ProjectStore);
  /** Bound via withComponentInputBinding() — receives project key from route */
  readonly projectKey = input.required<string>();
  /** Resolved project UUID from the store */
  protected readonly projectId = computed(() => this.projectStore.activeProject()?.id ?? '');
  /**
   * Whether the current user can manage project settings (PROJECT_ADMIN+).
   * Tenant OWNER/ADMIN bypass project role checks.
   */
  protected readonly isAdmin = computed(() =>
    canManageProject(this.projectStore.projectRole(), this.authStore.tenantRole()),
  );
  protected readonly defaultBoardId = computed(() => this.projectStore.activeProject()?.defaultBoardId ?? '');
  protected readonly boardTypes = Object.values(BoardType);
  private readonly boardsResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => this.boardClient.list(params.projectId),
    defaultValue: [] as Board[],
  });
  protected readonly boards = computed(() => (this.boardsResource.hasValue() ? this.boardsResource.value() : []));
  protected readonly loading = computed(() => this.boardsResource.isLoading());
  private readonly actionError = signal('');
  protected readonly error = computed(() => {
    if (this.actionError()) return this.actionError();

    const err = this.boardsResource.error();

    return err ? getErrorMessage(err) : '';
  });
  private readonly statusesResource = rxResource({
    params: () => ({ projectId: this.projectId() }),
    stream: ({ params }) => this.statusClient.list(params.projectId),
    defaultValue: [] as Status[],
  });
  /** Boards containing column references to deleted/nonexistent statuses */
  protected readonly invalidRefBoardIds = computed(() => {
    const statusIds = new Set(this.statusesResource.value().map((s) => s.id));
    const invalid = new Set<string>();

    for (const board of this.boards()) {
      if (board.columns.some((col) => col.statusIds.some((id) => !statusIds.has(id)))) {
        invalid.add(board.id);
      }
    }

    return invalid;
  });

  protected hasInvalidRefs(board: Board): boolean {
    return this.invalidRefBoardIds().has(board.id);
  }

  protected isDefault(board: Board): boolean {
    return board.id === this.defaultBoardId();
  }

  // ─── Create dialog ────────────────────────────────────────────────────────

  protected readonly showCreateDialog = signal(false);
  private readonly createModel = signal<BoardFormModel>({ name: '', type: BoardType.KANBAN });
  protected readonly createBoardForm = form(
    this.createModel,
    schema<BoardFormModel>((field) => {
      required(field.name, { message: 'validation.boardNameRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.actionError.set('');

          const model = this.createModel();
          const boardData: CreateBoard = {
            name: model.name,
            type: model.type as BoardType,
            columns: [
              { statusIds: [], position: 0 },
              { statusIds: [], position: 1 },
              { statusIds: [], position: 2 },
            ],
          };

          return new Promise<void>((resolve) => {
            this.boardClient.create(this.projectId(), boardData).subscribe({
              next: (board) => {
                if (this.boardsResource.hasValue()) {
                  this.boardsResource.value.update((list) => [...list, board]);
                } else {
                  this.boardsResource.reload();
                }
                this.showCreateDialog.set(false);
                f().reset({ name: '', type: BoardType.KANBAN });
                this.notify.success('toasts.created');
                resolve();
              },
              error: (err) => {
                this.actionError.set(getErrorMessage(err));
                resolve();
              },
            });
          });
        },
      },
    },
  );
  protected readonly renamingBoard = signal<Board | null>(null);
  protected readonly renameModel = signal<BoardFormModel>({ name: '', type: BoardType.KANBAN });
  protected readonly renameBoardForm = form(
    this.renameModel,
    schema<BoardFormModel>((field) => {
      required(field.name, { message: 'validation.boardNameRequired' });
    }),
    {
      submission: {
        action: async (f) => {
          this.actionError.set('');

          const board = this.renamingBoard();

          if (!board) return;

          return new Promise<void>((resolve) => {
            this.boardClient.update(board.id, { name: this.renameModel().name }).subscribe({
              next: (updated) => {
                if (this.boardsResource.hasValue()) {
                  this.boardsResource.value.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
                }
                this.renamingBoard.set(null);
                f().reset({ name: '', type: BoardType.KANBAN });
                this.notify.success('toasts.updated');
                resolve();
              },
              error: (err) => {
                this.actionError.set(getErrorMessage(err));
                resolve();
              },
            });
          });
        },
      },
    },
  );

  protected openRenameDialog(board: Board): void {
    this.renamingBoard.set(board);
    this.renameModel.set({ name: board.name, type: board.type });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  protected readonly deletingBoard = signal<Board | null>(null);

  protected requestDelete(board: Board): void {
    if (!this.isDefault(board)) {
      this.deletingBoard.set(board);
    }
  }

  protected confirmDelete(): void {
    const board = this.deletingBoard();

    if (!board || this.isDefault(board)) return;

    this.boardClient.delete(board.id).subscribe({
      next: () => {
        if (this.boardsResource.hasValue()) {
          this.boardsResource.value.update((list) => list.filter((b) => b.id !== board.id));
        }
        this.deletingBoard.set(null);
        this.notify.success('toasts.deleted');
      },
      error: (err) => {
        this.actionError.set(getErrorMessage(err));
        this.deletingBoard.set(null);
      },
    });
  }

  // ─── Dialog plumbing ──────────────────────────────────────────────────────

  protected onCreateDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') this.showCreateDialog.set(false);
  }

  protected onRenameDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') this.renamingBoard.set(null);
  }

  protected onDeleteDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') this.deletingBoard.set(null);
  }
}
