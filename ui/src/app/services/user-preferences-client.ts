import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import { ApiPaths } from '@task-board/shared';
import type { UserPreferences, UpdateUserPreferences } from '@task-board/shared';

/**
 * Pure HTTP client for user-preferences endpoints — no state management.
 * All methods return Observables; the PreferencesStore handles orchestration.
 */
@Service()
export class UserPreferencesClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Get preferences for a specific user */
  getPreferences(userId: string): Observable<UserPreferences> {
    const path = ApiPaths.users.preferences.replace(':id', userId);

    return this.http.get<UserPreferences>(`${this.apiBaseUrl}${path}`);
  }

  /** Update preferences for a specific user (partial update) */
  updatePreferences(userId: string, data: UpdateUserPreferences): Observable<UserPreferences> {
    const path = ApiPaths.users.preferences.replace(':id', userId);

    return this.http.put<UserPreferences>(`${this.apiBaseUrl}${path}`, data);
  }
}
