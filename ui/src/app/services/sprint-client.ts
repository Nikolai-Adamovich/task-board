import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Sprint, CreateSprint, UpdateSprint } from '@task-board/shared';

/** Paginated list response shape */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Service()
export class SprintClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List sprints for a project */
  list(projectId: string): Observable<PaginatedResponse<Sprint>> {
    const params = new HttpParams().set('projectId', projectId);

    return this.http.get<PaginatedResponse<Sprint>>(`${this.baseUrl}/sprints`, { params });
  }

  /** Get a single sprint by ID */
  getById(id: string): Observable<Sprint> {
    return this.http.get<Sprint>(`${this.baseUrl}/sprints/${id}`);
  }

  /** Create a new sprint */
  create(projectId: string, data: CreateSprint): Observable<Sprint> {
    return this.http.post<Sprint>(`${this.baseUrl}/sprints`, { ...data, projectId });
  }

  /** Update an existing sprint */
  update(id: string, data: UpdateSprint): Observable<Sprint> {
    return this.http.patch<Sprint>(`${this.baseUrl}/sprints/${id}`, data);
  }

  /** Delete a sprint */
  delete(id: string): Observable<void> {
    return this.http.delete<null>(`${this.baseUrl}/sprints/${id}`) as unknown as Observable<void>;
  }

  /** Add a task to a sprint */
  addTask(sprintId: string, taskId: string): Observable<Sprint> {
    return this.http.post<Sprint>(`${this.baseUrl}/sprints/${sprintId}/tasks`, { taskId });
  }

  /** Remove a task from a sprint */
  removeTask(sprintId: string, taskId: string): Observable<Sprint> {
    return this.http.delete<Sprint>(`${this.baseUrl}/sprints/${sprintId}/tasks/${taskId}`);
  }
}
