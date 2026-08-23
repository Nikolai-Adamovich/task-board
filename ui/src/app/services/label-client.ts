import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Label, CreateLabel, UpdateLabel } from '@task-board/shared';

@Service()
export class LabelClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List labels for a project */
  list(projectId: string): Observable<Label[]> {
    return this.http
      .get<{ data: Label[] }>(`${this.baseUrl}/projects/${projectId}/labels`)
      .pipe(map((res) => res.data));
  }

  /** Create a new label */
  create(projectId: string, data: CreateLabel): Observable<Label> {
    return this.http
      .post<{ data: Label }>(`${this.baseUrl}/projects/${projectId}/labels`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing label */
  update(labelId: string, data: UpdateLabel): Observable<Label> {
    return this.http.patch<{ data: Label }>(`${this.baseUrl}/labels/${labelId}`, data).pipe(map((res) => res.data));
  }

  /** Delete a label */
  delete(labelId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.baseUrl}/labels/${labelId}`)
      .pipe(map((res) => res.data));
  }
}
