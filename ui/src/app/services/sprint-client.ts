import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Sprint, CreateSprint, UpdateSprint } from '@task-board/shared';

@Service()
export class SprintClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List sprints for a project */
  list(projectId: string): Observable<Sprint[]> {
    return this.http
      .get<{ data: Sprint[] }>(`${this.baseUrl}/projects/${projectId}/sprints`)
      .pipe(map((res) => res.data));
  }

  /** Get a single sprint by ID */
  getById(id: string): Observable<Sprint> {
    return this.http.get<{ data: Sprint }>(`${this.baseUrl}/sprints/${id}`).pipe(map((res) => res.data));
  }

  /** Create a new sprint */
  create(projectId: string, data: CreateSprint): Observable<Sprint> {
    return this.http
      .post<{ data: Sprint }>(`${this.baseUrl}/projects/${projectId}/sprints`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing sprint */
  update(id: string, data: UpdateSprint): Observable<Sprint> {
    return this.http.patch<{ data: Sprint }>(`${this.baseUrl}/sprints/${id}`, data).pipe(map((res) => res.data));
  }

  /** Delete a sprint (tasks reassigned to backlog) */
  delete(id: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.baseUrl}/sprints/${id}`)
      .pipe(map((res) => res.data));
  }
}
