import { Component, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommentClient } from '@services/comment-client';
import { AuthStore } from '@stores/auth-store';
import { hasMinTenantRole, hasMinProjectRole } from '@app/shared/utils/role-utils';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { finalize } from 'rxjs';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';
import type { Comment } from '@task-board/shared';

@Component({
  selector: 'ui-comment-thread',
  imports: [
    DatePipe,
    TranslocoPipe,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmCardImports,
    HlmTextareaImports,
    HlmAvatarImports,
    HlmDialogImports,
  ],
  templateUrl: './comment-thread.html',
})
export class CommentThread implements OnInit {
  private readonly commentClient = inject(CommentClient);
  private readonly authStore = inject(AuthStore);
  /** Task ID to load comments for */
  readonly taskId = input.required<string>();
  /** Current user's ID — used to determine edit/delete permissions */
  readonly currentUserId = input.required<string>();
  /** Whether the current user can moderate (admin/owner) */
  readonly canEdit = input<boolean>(false);
  protected readonly comments = signal<Comment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  // New comment form
  protected readonly newBody = signal('');
  protected readonly submitting = signal(false);
  // Inline edit state
  protected readonly editingId = signal<string | null>(null);
  protected readonly editBody = signal('');
  protected readonly savingEdit = signal(false);
  // Delete confirmation
  protected readonly showDeleteConfirm = signal(false);
  protected readonly commentToDelete = signal<Comment | null>(null);

  ngOnInit(): void {
    this.loadComments();
  }

  protected loadComments(): void {
    this.loading.set(true);
    this.commentClient
      .list(this.taskId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.comments.set(data);
        },
        error: () => {
          this.error.set('comments.loadError');
        },
      });
  }

  protected submitComment(): void {
    const body = this.newBody().trim();

    if (!body) return;

    this.submitting.set(true);
    this.commentClient
      .create(this.taskId(), { body })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (comment) => {
          this.comments.update((list) => [...list, comment]);
          this.newBody.set('');
        },
        error: () => {
          this.error.set('comments.createError');
        },
      });
  }

  protected startEdit(comment: Comment): void {
    this.editingId.set(comment.id);
    this.editBody.set(comment.body);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editBody.set('');
  }

  protected saveEdit(commentId: string): void {
    const body = this.editBody().trim();

    if (!body) return;

    this.savingEdit.set(true);
    this.commentClient
      .update(commentId, { body })
      .pipe(finalize(() => this.savingEdit.set(false)))
      .subscribe({
        next: (updated) => {
          this.comments.update((list) => list.map((c) => (c.id === commentId ? updated : c)));
          this.cancelEdit();
        },
        error: () => {
          this.error.set('comments.updateError');
        },
      });
  }

  protected confirmDelete(comment: Comment): void {
    this.commentToDelete.set(comment);
    this.showDeleteConfirm.set(true);
  }

  protected onDeleteDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showDeleteConfirm.set(false);
      this.commentToDelete.set(null);
    }
  }

  protected deleteComment(): void {
    const comment = this.commentToDelete();

    if (!comment) return;

    this.commentClient.delete(comment.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((c) => c.id !== comment.id));
        this.showDeleteConfirm.set(false);
        this.commentToDelete.set(null);
      },
      error: () => {
        this.error.set('comments.deleteError');
      },
    });
  }

  /** Whether the current user can edit/delete a specific comment */
  protected canModifyComment(comment: Comment): boolean {
    if (comment.authorId === this.currentUserId()) return true;

    const tenantRole = this.authStore.tenantRole();

    if (hasMinTenantRole(tenantRole, 'ADMIN')) return true;

    return hasMinProjectRole(tenantRole, 'EDITOR');
  }

  protected onNewBodyInput(event: Event): void {
    this.newBody.set((event.target as HTMLTextAreaElement).value);
  }

  protected onEditBodyInput(event: Event): void {
    this.editBody.set((event.target as HTMLTextAreaElement).value);
  }
}
