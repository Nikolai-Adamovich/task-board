import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-url.token';
import type { Task, CreateTask, UpdateTask, MoveTask } from '@task-board/shared';

/** Query params for filtering tasks */
export interface TaskQuery {
  projectId?: string;
  boardId?: string;
  columnId?: string;
  sprintId?: string | null;
  assigneeId?: string;
  page?: number;
  limit?: number;
}

/** Paginated list response shape */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Service()
export class TaskClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List tasks with optional filters */
  list(query: TaskQuery = {}): Observable<PaginatedResponse<Task>> {
    let params = new HttpParams();

    if (query.projectId) params = params.set('projectId', query.projectId);
    if (query.boardId) params = params.set('boardId', query.boardId);
    if (query.columnId) params = params.set('columnId', query.columnId);
    if (query.sprintId !== undefined) params = params.set('sprintId', query.sprintId ?? '');
    if (query.assigneeId) params = params.set('assigneeId', query.assigneeId);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());
    return this.http.get<PaginatedResponse<Task>>(`${this.baseUrl}/tasks`, { params });
  }

  /** Get a single task by ID */
  getById(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}`);
  }

  /** Create a new task */
  create(data: CreateTask): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks`, data);
  }

  /** Update an existing task */
  update(id: string, data: UpdateTask): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/tasks/${id}`, data);
  }

  /** Delete a task */
  delete(id: string): Observable<void> {
    return this.http.delete<null>(`${this.baseUrl}/tasks/${id}`) as unknown as Observable<void>;
  }

  /** Move a task to a different column */
  move(data: MoveTask): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks/move`, data);
  }

  /** Assign users to a task */
  assign(taskId: string, assigneeIds: string[]): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks/${taskId}/assign`, { assigneeIds });
  }
}
