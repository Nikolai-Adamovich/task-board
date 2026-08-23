import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@task-board/shared';

/**
 * Pure HTTP client for auth endpoints — no state management.
 * All methods return Observables; the AuthStore handles orchestration.
 */
@Service()
export class AuthClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Authenticate a user with email and password */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<{ data: AuthResponse }>(`${this.apiBaseUrl}/auth/login`, credentials)
      .pipe(map((res) => res.data));
  }

  /** Register a new user account */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<{ data: AuthResponse }>(`${this.apiBaseUrl}/auth/register`, data)
      .pipe(map((res) => res.data));
  }

  /** Get the currently authenticated user's profile */
  getCurrentUser(): Observable<User> {
    return this.http.get<{ data: User }>(`${this.apiBaseUrl}/auth/me`).pipe(map((res) => res.data));
  }
}
