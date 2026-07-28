import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, CreateProject, UpdateProject, ProjectMember } from '@task-board/shared';

/** Paginated list response shape */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Service()
export class ProjectClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List projects for the active tenant */
  list(page = 1, limit = 20): Observable<PaginatedResponse<Project>> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    return this.http.get<PaginatedResponse<Project>>(`${this.baseUrl}/projects`, { params });
  }

  /** Get a single project by ID */
  getById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/projects/${id}`);
  }

  /** Create a new project */
  create(data: CreateProject): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/projects`, data);
  }

  /** Update an existing project */
  update(id: string, data: UpdateProject): Observable<Project> {
    return this.http.patch<Project>(`${this.baseUrl}/projects/${id}`, data);
  }

  /** Delete a project */
  delete(id: string): Observable<void> {
    return this.http.delete<null>(`${this.baseUrl}/projects/${id}`) as unknown as Observable<void>;
  }

  /** List members of a project */
  listMembers(projectId: string): Observable<{ data: ProjectMember[] }> {
    return this.http.get<{ data: ProjectMember[] }>(`${this.baseUrl}/projects/${projectId}/members`);
  }

  /** Add a member to a project */
  addMember(projectId: string, userId: string, role: string): Observable<ProjectMember> {
    return this.http.post<ProjectMember>(`${this.baseUrl}/projects/${projectId}/members`, { userId, role });
  }

  /** Update a member's role */
  updateMemberRole(projectId: string, userId: string, role: string): Observable<ProjectMember> {
    return this.http.patch<ProjectMember>(`${this.baseUrl}/projects/${projectId}/members/${userId}`, { role });
  }

  /** Remove a member from a project */
  removeMember(projectId: string, userId: string): Observable<void> {
    return this.http.delete<null>(
      `${this.baseUrl}/projects/${projectId}/members/${userId}`,
    ) as unknown as Observable<void>;
  }
}
