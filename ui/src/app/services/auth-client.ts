import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  /** POST /auth/login */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, credentials);
  }

  /** POST /auth/register */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, data);
  }

  /** GET /auth/me */
  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiBaseUrl}/auth/me`);
  }
}
