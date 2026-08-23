import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project, CreateProject, UpdateProject, ProjectMember } from '@task-board/shared';

@Service()
export class ProjectClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** List projects for the active tenant */
  list(): Observable<Project[]> {
    return this.http.get<{ data: Project[] }>(`${this.baseUrl}/projects`).pipe(map((res) => res.data));
  }

  /** Get a single project by ID */
  getById(id: string): Observable<Project> {
    return this.http.get<{ data: Project }>(`${this.baseUrl}/projects/${id}`).pipe(map((res) => res.data));
  }

  /** Get a single project by key within a tenant */
  getByKey(_tenantId: string, key: string): Observable<Project> {
    return this.http.get<{ data: Project }>(`${this.baseUrl}/projects/by-key/${key}`).pipe(map((res) => res.data));
  }

  /** Create a new project */
  create(data: CreateProject): Observable<Project> {
    return this.http.post<{ data: Project }>(`${this.baseUrl}/projects`, data).pipe(map((res) => res.data));
  }

  /** Update an existing project */
  update(id: string, data: UpdateProject): Observable<Project> {
    return this.http.patch<{ data: Project }>(`${this.baseUrl}/projects/${id}`, data).pipe(map((res) => res.data));
  }

  /** Delete a project (triggers DELETION_PENDING) */
  delete(id: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.baseUrl}/projects/${id}`)
      .pipe(map((res) => res.data));
  }

  // ─── Project Lifecycle ────────────────────────────────────────────────────

  /** Archive a project. */
  archive(id: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.baseUrl}/projects/${id}/archive`, {})
      .pipe(map((res) => res.data));
  }

  /** Restore an archived project. */
  restore(id: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.baseUrl}/projects/${id}/restore`, {})
      .pipe(map((res) => res.data));
  }

  /** Cancel a pending deletion. */
  cancelDeletion(id: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ data: { success: boolean } }>(`${this.baseUrl}/projects/${id}/cancel-deletion`, {})
      .pipe(map((res) => res.data));
  }

  /** List members of a project */
  listMembers(projectId: string): Observable<ProjectMember[]> {
    return this.http
      .get<{ data: ProjectMember[] }>(`${this.baseUrl}/projects/${projectId}/members`)
      .pipe(map((res) => res.data));
  }

  /** Add a member to a project */
  addMember(projectId: string, userId: string, role: string): Observable<ProjectMember> {
    return this.http
      .post<{ data: ProjectMember }>(`${this.baseUrl}/projects/${projectId}/members`, { userId, role })
      .pipe(map((res) => res.data));
  }

  /** Update a member's role */
  updateMemberRole(projectId: string, userId: string, role: string): Observable<ProjectMember> {
    return this.http
      .patch<{ data: ProjectMember }>(`${this.baseUrl}/projects/${projectId}/members/${userId}`, { role })
      .pipe(map((res) => res.data));
  }

  /** Remove a member from a project */
  removeMember(projectId: string, userId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ data: { success: boolean } }>(`${this.baseUrl}/projects/${projectId}/members/${userId}`)
      .pipe(map((res) => res.data));
  }
}
