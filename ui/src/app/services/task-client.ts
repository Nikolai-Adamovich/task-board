import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Task, CreateTask, UpdateTask, BulkUpdateTasks, BulkUpdateTasksResult } from '@task-board/shared';
import type { MoveTask } from '@app/types/frontend';

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
  /** Q13/F-01: inclusive ISO date (`YYYY-MM-DD`) range filters */
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  /**
   * F5 (perf audit #2): omit `description` from the response (~40% smaller
   * payload for lists). Only views that render the description (the board's
   * task-card preview) must NOT set this.
   */
  excludeDescription?: boolean;
}

/** Paginated list response shape */
export interface PaginatedResponse<T> {
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
    if (query.createdFrom) params = params.set('createdFrom', query.createdFrom);
    if (query.createdTo) params = params.set('createdTo', query.createdTo);
    if (query.updatedFrom) params = params.set('updatedFrom', query.updatedFrom);
    if (query.updatedTo) params = params.set('updatedTo', query.updatedTo);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());
    if (query.sort) params = params.set('sort', query.sort);
    if (query.excludeDescription) params = params.set('excludeDescription', 'true');
    return this.http.get<PaginatedResponse<Task>>(`${this.baseUrl}/projects/${projectId}/tasks`, { params });
  }

  /** S-05: per-status task counts for the project overview (one aggregation) */
  statusSummary(projectId: string): Observable<{ statusId: string; count: number }[]> {
    return this.http
      .get<{ data: { statusId: string; count: number }[] }>(
        `${this.baseUrl}/projects/${projectId}/tasks/status-summary`,
      )
      .pipe(map((res) => res.data));
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

  /** Q10 (RQ-04 ③): bulk status/assignee/sprint update for the tasks table */
  bulkUpdate(projectId: string, body: BulkUpdateTasks): Observable<BulkUpdateTasksResult> {
    return this.http
      .patch<{ data: BulkUpdateTasksResult }>(`${this.baseUrl}/projects/${projectId}/tasks/bulk`, body)
      .pipe(map((res) => res.data));
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

  /**
   * Get tasks assigned to the current user across all tenants.
   * Returns plain `Task` objects — the caller resolves tenant/project context.
   */
  getMyTasks(): Observable<Task[]> {
    return this.http.get<{ data: Task[] }>(`${this.baseUrl}/tasks/my`).pipe(map((res) => res.data));
  }
}
