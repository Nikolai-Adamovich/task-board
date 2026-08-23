import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { TaskRelationship, CreateTaskRelationship } from '@task-board/shared';

/** Pure HTTP client for task-relationship endpoints — no state management. */
@Service()
export class TaskRelationshipClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List all relationships for a task (as source and target) */
  list(taskId: string): Observable<TaskRelationship[]> {
    return this.http
      .get<{ data: TaskRelationship[] }>(`${this.baseUrl}/tasks/${taskId}/relationships`)
      .pipe(map((res) => res.data));
  }

  /** Create a new relationship from a source task */
  create(taskId: string, data: CreateTaskRelationship): Observable<TaskRelationship> {
    return this.http
      .post<{ data: TaskRelationship }>(`${this.baseUrl}/tasks/${taskId}/relationships`, data)
      .pipe(map((res) => res.data));
  }

  /** Delete a relationship */
  delete(relationshipId: string): Observable<{ success: true }> {
    return this.http
      .delete<{ data: { success: true } }>(`${this.baseUrl}/task-relationships/${relationshipId}`)
      .pipe(map((res) => res.data));
  }
}
