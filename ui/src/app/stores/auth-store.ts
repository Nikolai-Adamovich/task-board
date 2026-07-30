import { Service, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@app/api-url.token';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { User, AuthResponse } from '@task-board/shared';

const TOKEN_KEY = 'taskboard_token';

/** Shape of the decoded JWT payload relevant to the auth store */
interface JwtPayload {
  tenantId?: string | null;
  tenantRole?: string | null;
}

/**
 * Signal-based auth store.
 * Manages the current user, JWT token, tenant context, and authentication state.
 */
@Service()
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly tenantId = signal<string | null>(null);
  readonly tenantRole = signal<string | null>(null);
  /** Whether the current user belongs to at least one tenant */
  readonly hasTenant = computed(() => this.tenantId() !== null);
  /** Whether the user is authenticated but has no workspace (tenant) yet */
  readonly needsWorkspace = computed(() => this.isAuthenticated() && !this.tenantId());
  /** Whether a user is currently authenticated */
  readonly isAuthenticated = computed(() => this.token() !== null && this.currentUser() !== null);

  constructor() {
    // Restore token from localStorage on init.
    // fetchCurrentUser() is NOT called here — the authGuard handles
    // it explicitly and waits for the result to avoid a race condition
    // where logout() clears the token before the guard finishes.
    const stored = localStorage.getItem(TOKEN_KEY);

    if (stored) {
      this.token.set(stored);
      this.decodeJwtPayload(stored);
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
    this.tenantId.set(null);
    this.tenantRole.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  /** Manually set the tenant context (e.g. when switching tenants) */
  setTenantContext(tenantId: string | null, role: string | null): void {
    this.tenantId.set(tenantId);
    this.tenantRole.set(role);
  }

  /** Manually set the tenant role (e.g. when tenant context changes) */
  setTenantRole(role: string): void {
    this.tenantRole.set(role);
  }

  /** Store token + user from an auth response */
  setSession(response: AuthResponse): void {
    this.token.set(response.token);
    this.currentUser.set(response.user);
    this.decodeJwtPayload(response.token);
    localStorage.setItem(TOKEN_KEY, response.token);
  }

  /** Decode tenant-related fields from the JWT payload */
  private decodeJwtPayload(jwt: string): void {
    try {
      const parts = jwt.split('.');

      if (parts.length !== 3 || !parts[1]) {
        this.tenantId.set(null);
        this.tenantRole.set(null);
        return;
      }

      // base64url → base64
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = atob(base64);
      const payload = JSON.parse(jsonPayload) as JwtPayload;

      this.tenantId.set(payload.tenantId ?? null);
      this.tenantRole.set(payload.tenantRole ?? null);
    } catch {
      this.tenantId.set(null);
      this.tenantRole.set(null);
    }
  }

  /** Fetch the current user using the stored token. Returns an Observable. */
  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiBaseUrl}/auth/me`).pipe(
      tap({
        next: (user) => this.currentUser.set(user),
        error: (err) => {
          // Only clear session on 401 (invalid/expired token).
          // For other errors (network, 500, etc.) keep the token so the
          // user stays logged in.
          if (err.status === 401) {
            this.logout();
          }
        },
      }),
    );
  }
}
