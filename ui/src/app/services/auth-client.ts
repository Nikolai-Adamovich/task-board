import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api-url.token';
import { AuthStore } from '../stores/auth-store';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@task-board/shared';

/**
 * Auth client that handles login/register API calls
 * and coordinates with the AuthStore.
 */
@Service()
export class AuthClient {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Login with credentials and store session */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, credentials).pipe(
      tap((res) => {
        this.authStore.token.set(res.token);
        this.authStore.currentUser.set(res.user);
        localStorage.setItem('taskboard_token', res.token);
      }),
    );
  }

  /** Register a new user and store session */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, data).pipe(
      tap((res) => {
        this.authStore.token.set(res.token);
        this.authStore.currentUser.set(res.user);
        localStorage.setItem('taskboard_token', res.token);
      }),
    );
  }

  /** Clear session and redirect to login */
  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/auth/login']);
  }
}
