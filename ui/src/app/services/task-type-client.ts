import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { TaskType, CreateTaskType, UpdateTaskType } from '@task-board/shared';

@Service()
export class TaskTypeClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List task types for a project */
  list(projectId: string): Observable<TaskType[]> {
    return this.http
      .get<{ data: TaskType[] }>(`${this.baseUrl}/projects/${projectId}/task-types`)
      .pipe(map((res) => res.data));
  }

  /** Create a new task type */
  create(projectId: string, data: CreateTaskType): Observable<TaskType> {
    return this.http
      .post<{ data: TaskType }>(`${this.baseUrl}/projects/${projectId}/task-types`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing task type */
  /** Reorder task types in one bulk pass */
  reorder(projectId: string, items: { id: string; position: number }[]): Observable<TaskType[]> {
    return this.http
      .patch<{ data: TaskType[] }>(`${this.baseUrl}/projects/${projectId}/task-types/reorder`, { items })
      .pipe(map((res) => res.data));
  }

  update(taskTypeId: string, data: UpdateTaskType): Observable<TaskType> {
    return this.http
      .patch<{ data: TaskType }>(`${this.baseUrl}/task-types/${taskTypeId}`, data)
      .pipe(map((res) => res.data));
  }

  /** Delete a task type (optionally with a replacement). Body sent per spec §5. */
  delete(taskTypeId: string, replacementTypeId?: string): Observable<{ success: boolean }> {
    const body: Record<string, string> = {};

    if (replacementTypeId) {
      body['replacementTypeId'] = replacementTypeId;
    }
    return this.http
      .request<{ data: { success: boolean } }>('delete', `${this.baseUrl}/task-types/${taskTypeId}`, {
        body,
      })
      .pipe(map((res) => res.data));
  }
}
