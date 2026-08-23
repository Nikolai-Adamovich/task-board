import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Filter, CreateFilter, UpdateFilter } from '@task-board/shared';

/** Pure HTTP client for filter endpoints — no state management. */
@Service()
export class FilterClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List saved filters for a project */
  list(projectId: string): Observable<Filter[]> {
    return this.http
      .get<{ data: Filter[] }>(`${this.baseUrl}/projects/${projectId}/filters`)
      .pipe(map((res) => res.data));
  }

  /** Create a new saved filter */
  create(projectId: string, data: CreateFilter): Observable<Filter> {
    return this.http
      .post<{ data: Filter }>(`${this.baseUrl}/projects/${projectId}/filters`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing filter */
  update(filterId: string, data: UpdateFilter): Observable<Filter> {
    return this.http.patch<{ data: Filter }>(`${this.baseUrl}/filters/${filterId}`, data).pipe(map((res) => res.data));
  }

  /** Delete a filter */
  delete(filterId: string): Observable<{ success: true }> {
    return this.http
      .delete<{ data: { success: true } }>(`${this.baseUrl}/filters/${filterId}`)
      .pipe(map((res) => res.data));
  }
}
