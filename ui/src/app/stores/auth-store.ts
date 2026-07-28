import { Service, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@app/api-url.token';
import type { User, AuthResponse } from '@task-board/shared';

const TOKEN_KEY = 'taskboard_token';

/**
 * Signal-based auth store.
 * Manages the current user, JWT token, and authentication state.
 */
@Service()
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    // Restore token from localStorage on init
    const stored = localStorage.getItem(TOKEN_KEY);

    if (stored) {
      this.token.set(stored);
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
    localStorage.removeItem(TOKEN_KEY);
  }

  /** Store token + user from an auth response */
  private setSession(response: AuthResponse): void {
    this.token.set(response.token);
    this.currentUser.set(response.user);
    localStorage.setItem(TOKEN_KEY, response.token);
  }

  /** Fetch the current user using the stored token */
  fetchCurrentUser(): void {
    this.http.get<User>(`${this.apiBaseUrl}/auth/me`).subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.logout(),
    });
  }
}
