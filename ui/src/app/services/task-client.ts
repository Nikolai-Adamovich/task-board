import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Task, CreateTask, UpdateTask } from '@task-board/shared';
import type { MoveTask, MyTask } from '@app/types/frontend';

/** Query params for filtering tasks */
export interface TaskQuery {
  projectId?: string;
  sprintId?: string | null;
  assigneeId?: string;
  reporterId?: string;
  statusId?: string;
  priority?: string;
  typeId?: string;
  labelId?: string;
  search?: string;
  page?: number;
  limit?: number;
  /** Sort field and direction, e.g. "createdAt:desc" */
  sort?: string;
}

/** Paginated list response shape */
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Service()
export class TaskClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List tasks with optional filters (paginated — keep full envelope) */
  list(projectId: string, query: TaskQuery = {}): Observable<PaginatedResponse<Task>> {
    let params = new HttpParams();

    if (query.sprintId !== undefined) params = params.set('sprintId', query.sprintId ?? '');
    if (query.assigneeId) params = params.set('assigneeId', query.assigneeId);
    if (query.reporterId) params = params.set('reporterId', query.reporterId);
    if (query.statusId) params = params.set('statusId', query.statusId);
    if (query.priority) params = params.set('priority', query.priority);
    if (query.typeId) params = params.set('typeId', query.typeId);
    if (query.labelId) params = params.set('labelId', query.labelId);
    if (query.search) params = params.set('search', query.search);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());
    if (query.sort) params = params.set('sort', query.sort);
    return this.http.get<PaginatedResponse<Task>>(`${this.baseUrl}/projects/${projectId}/tasks`, { params });
  }

  /** Get a single task by ID */
  getById(id: string): Observable<Task> {
    return this.http.get<{ data: Task }>(`${this.baseUrl}/tasks/${id}`).pipe(map((res) => res.data));
  }

  /** Create a new task */
  create(projectId: string, data: CreateTask): Observable<Task> {
    return this.http
      .post<{ data: Task }>(`${this.baseUrl}/projects/${projectId}/tasks`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing task (version required for optimistic concurrency) */
  update(id: string, data: UpdateTask): Observable<Task> {
    return this.http.patch<{ data: Task }>(`${this.baseUrl}/tasks/${id}`, data).pipe(map((res) => res.data));
  }

  /** Delete a task */
  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`${this.baseUrl}/tasks/${id}`).pipe(map((res) => res.data));
  }

  /** Move a task to a different status (requires version for optimistic concurrency) */
  move(data: MoveTask): Observable<Task> {
    return this.http
      .patch<{ data: Task }>(`${this.baseUrl}/tasks/${data.taskId}`, {
        statusId: data.statusId,
        position: data.position,
        version: data.version,
      })
      .pipe(map((res) => res.data));
  }

  // ─── Cross-Tenant "My Tasks" ──────────────────────────────────────────────

  /** Get tasks assigned to the current user across all tenants */
  getMyTasks(): Observable<MyTask[]> {
    return this.http.get<{ data: MyTask[] }>(`${this.baseUrl}/tasks/my`).pipe(map((res) => res.data));
  }
}
