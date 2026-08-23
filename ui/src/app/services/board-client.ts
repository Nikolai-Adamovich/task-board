import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Board, CreateBoard, UpdateBoard } from '@task-board/shared';

@Service()
export class BoardClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List boards for a project */
  list(projectId: string): Observable<Board[]> {
    return this.http
      .get<{ data: Board[] }>(`${this.baseUrl}/projects/${projectId}/boards`)
      .pipe(map((res) => res.data));
  }

  /** Get a single board by ID */
  getById(id: string): Observable<Board> {
    return this.http.get<{ data: Board }>(`${this.baseUrl}/boards/${id}`).pipe(map((res) => res.data));
  }

  /** Create a new board */
  create(projectId: string, data: CreateBoard): Observable<Board> {
    return this.http
      .post<{ data: Board }>(`${this.baseUrl}/projects/${projectId}/boards`, data)
      .pipe(map((res) => res.data));
  }

  /** Update an existing board */
  update(id: string, data: UpdateBoard): Observable<Board> {
    return this.http.patch<{ data: Board }>(`${this.baseUrl}/boards/${id}`, data).pipe(map((res) => res.data));
  }

  /** Delete a board */
  delete(id: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.baseUrl}/boards/${id}`)
      .pipe(map((res) => res.data));
  }
}
