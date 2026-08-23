import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import { ApiPaths } from '@task-board/shared';
import type {
  UserPreferences,
  UpdateUserPreferences,
  UserProjectBoardPreference,
  UpdateUserProjectBoardPreference,
} from '@task-board/shared';

/**
 * Pure HTTP client for user-preferences endpoints — no state management.
 * All methods return Observables; the PreferencesStore handles orchestration.
 */
@Service()
export class UserPreferencesClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Get preferences for the current user */
  getPreferences(): Observable<UserPreferences> {
    return this.http
      .get<{ data: UserPreferences }>(`${this.apiBaseUrl}${ApiPaths.preferences.base}`)
      .pipe(map((res) => res.data));
  }

  /** Update preferences for the current user (partial update) */
  updatePreferences(data: UpdateUserPreferences): Observable<UserPreferences> {
    return this.http
      .put<{ data: UserPreferences }>(`${this.apiBaseUrl}${ApiPaths.preferences.base}`, data)
      .pipe(map((res) => res.data));
  }

  /** Get project-scoped board preferences for the current user */
  getProjectPreferences(projectId: string): Observable<UserProjectBoardPreference> {
    return this.http
      .get<{ data: UserProjectBoardPreference }>(`${this.apiBaseUrl}/projects/${projectId}/preferences`)
      .pipe(map((res) => res.data));
  }

  /** Update project-scoped board preferences for the current user */
  updateProjectPreferences(
    projectId: string,
    data: UpdateUserProjectBoardPreference,
  ): Observable<UserProjectBoardPreference> {
    return this.http
      .patch<{ data: UserProjectBoardPreference }>(`${this.apiBaseUrl}/projects/${projectId}/preferences`, data)
      .pipe(map((res) => res.data));
  }
}
