import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@app/api-url.token';
import { AuthStore } from '@stores/auth-store';
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
  async login(credentials: LoginRequest): Promise<void> {
    const res = await firstValueFrom(this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, credentials));

    this.authStore.setSession(res);
  }

  /** Register a new user and store session */
  async register(data: RegisterRequest): Promise<void> {
    const res = await firstValueFrom(this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, data));

    this.authStore.setSession(res);
  }

  /** Clear session and redirect to login */
  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/auth/login']);
  }
}
