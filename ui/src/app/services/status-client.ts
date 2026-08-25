import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Status, CreateStatus, UpdateStatus } from '@task-board/shared';

@Service()
export class StatusClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List statuses for a project */
  list(projectId: string): Observable<Status[]> {
    return this.http
      .get<{ data: Status[] }>(`${this.baseUrl}/projects/${projectId}/statuses`)
      .pipe(map((res) => res.data));
  }

  /** Create a new status */
  create(projectId: string, data: CreateStatus): Observable<Status> {
    return this.http
      .post<{ data: Status }>(`${this.baseUrl}/projects/${projectId}/statuses`, data)
      .pipe(map((res) => res.data));
  }

  /** Reorder statuses in one bulk pass */
  reorder(projectId: string, items: { id: string; position: number }[]): Observable<Status[]> {
    return this.http
      .patch<{ data: Status[] }>(`${this.baseUrl}/projects/${projectId}/statuses/reorder`, { items })
      .pipe(map((res) => res.data));
  }

  /** Update an existing status */
  update(statusId: string, data: UpdateStatus): Observable<Status> {
    return this.http.patch<{ data: Status }>(`${this.baseUrl}/statuses/${statusId}`, data).pipe(map((res) => res.data));
  }

  /** Delete a status (optionally with a replacement). Body sent per spec §5. */
  delete(statusId: string, replacementStatusId?: string): Observable<{ success: boolean }> {
    const body: Record<string, string> = {};

    if (replacementStatusId) {
      body['replacementStatusId'] = replacementStatusId;
    }
    return this.http
      .request<{ data: { success: boolean } }>('delete', `${this.baseUrl}/statuses/${statusId}`, {
        body,
      })
      .pipe(map((res) => res.data));
  }
}
