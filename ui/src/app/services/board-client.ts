import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { BoardConfig, UpdateBoardColumns } from '@task-board/shared';

/**
 * Pure HTTP client for the project's single board (doc 102).
 * The board is identified by its projectId — there is no board CRUD.
 */
@Service()
export class BoardClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Get the project's single board */
  getForProject(projectId: string): Observable<BoardConfig> {
    return this.http
      .get<{ data: BoardConfig }>(`${this.baseUrl}/projects/${projectId}/board`)
      .pipe(map((res) => res.data));
  }

  /** Update the project board's columns (workflow) */
  updateColumns(projectId: string, data: UpdateBoardColumns): Observable<BoardConfig> {
    return this.http
      .patch<{ data: BoardConfig }>(`${this.baseUrl}/projects/${projectId}/board`, data)
      .pipe(map((res) => res.data));
  }
}
