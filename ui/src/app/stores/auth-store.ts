import { Service, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@app/api-url.token';
import type { User, AuthResponse } from '@task-board/shared';

const TOKEN_KEY = 'taskboard_token';

/**
 * Signal-based auth store.
 * Manages the current user, JWT token, tenant role, and authentication state.
 */
@Service()
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly tenantRole = signal<string | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    // Restore token from localStorage on init
    const stored = localStorage.getItem(TOKEN_KEY);

    if (stored) {
      this.token.set(stored);
      this.decodeTenantRole(stored);
      this.fetchCurrentUser();
    }
  }

  /** Log in with email/password and store the result */
  login(email: string, password: string): void {
    this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, { email, password }).subscribe({
      next: (res) => this.setSession(res),
      error: (err) => {
        throw err;
      },
    });
  }

  /** Register a new user and store the result */
  register(displayName: string, email: string, password: string): void {
    this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, {
        displayName,
        email,
        password,
      })
      .subscribe({
        next: (res) => this.setSession(res),
        error: (err) => {
          throw err;
        },
      });
  }

  /** Clear all auth state and localStorage */
  logout(): void {
    this.currentUser.set(null);
    this.token.set(null);
    this.tenantRole.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  /** Manually set the tenant role (e.g. when tenant context changes) */
  setTenantRole(role: string): void {
    this.tenantRole.set(role);
  }

  /** Store token + user from an auth response */
  private setSession(response: AuthResponse): void {
    this.token.set(response.token);
    this.currentUser.set(response.user);
    this.decodeTenantRole(response.token);
    localStorage.setItem(TOKEN_KEY, response.token);
  }

  /** Decode the tenantRole from the JWT payload */
  private decodeTenantRole(jwt: string): void {
    try {
      const parts = jwt.split('.');

      if (parts.length !== 3 || !parts[1]) {
        this.tenantRole.set(null);
        return;
      }

      // base64url → base64
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = atob(base64);
      const payload = JSON.parse(jsonPayload) as { tenantRole?: string };

      this.tenantRole.set(payload.tenantRole ?? null);
    } catch {
      this.tenantRole.set(null);
    }
  }

  /** Fetch the current user using the stored token */
  fetchCurrentUser(): void {
    this.http.get<User>(`${this.apiBaseUrl}/auth/me`).subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.logout(),
    });
  }
}
