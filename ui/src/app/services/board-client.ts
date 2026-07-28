import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Board, CreateBoard, UpdateBoard, Column, CreateColumn } from '@task-board/shared';

@Service()
export class BoardClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List boards for a project */
  list(projectId: string): Observable<{ data: Board[] }> {
    const params = new HttpParams().set('projectId', projectId);

    return this.http.get<{ data: Board[] }>(`${this.baseUrl}/boards`, { params });
  }

  /** Get a single board by ID */
  getById(id: string): Observable<Board> {
    return this.http.get<Board>(`${this.baseUrl}/boards/${id}`);
  }

  /** Create a new board */
  create(projectId: string, data: CreateBoard): Observable<Board> {
    return this.http.post<Board>(`${this.baseUrl}/boards`, { ...data, projectId });
  }

  /** Update an existing board */
  update(id: string, data: UpdateBoard): Observable<Board> {
    return this.http.patch<Board>(`${this.baseUrl}/boards/${id}`, data);
  }

  /** Delete a board */
  delete(id: string): Observable<void> {
    return this.http.delete<null>(`${this.baseUrl}/boards/${id}`) as unknown as Observable<void>;
  }

  /** List columns for a board */
  listColumns(boardId: string): Observable<{ data: Column[] }> {
    return this.http.get<{ data: Column[] }>(`${this.baseUrl}/boards/${boardId}/columns`);
  }

  /** Create a column in a board */
  createColumn(boardId: string, data: CreateColumn): Observable<Column> {
    return this.http.post<Column>(`${this.baseUrl}/boards/${boardId}/columns`, data);
  }
}
