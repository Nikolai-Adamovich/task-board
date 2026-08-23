import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Comment, CreateComment, UpdateComment } from '@task-board/shared';

/** Pure HTTP client for comment endpoints — no state management. */
@Service()
export class CommentClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List all comments for a task */
  list(taskId: string): Observable<Comment[]> {
    return this.http.get<{ data: Comment[] }>(`${this.baseUrl}/tasks/${taskId}/comments`).pipe(map((res) => res.data));
  }

  /** Create a new comment on a task */
  create(taskId: string, data: CreateComment): Observable<Comment> {
    return this.http
      .post<{ data: Comment }>(`${this.baseUrl}/tasks/${taskId}/comments`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing comment */
  update(commentId: string, data: UpdateComment): Observable<Comment> {
    return this.http
      .patch<{ data: Comment }>(`${this.baseUrl}/comments/${commentId}`, data)
      .pipe(map((res) => res.data));
  }

  /** Delete a comment */
  delete(commentId: string): Observable<{ success: true }> {
    return this.http
      .delete<{ data: { success: true } }>(`${this.baseUrl}/comments/${commentId}`)
      .pipe(map((res) => res.data));
  }
}
