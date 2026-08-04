/**
 * Tests for the Login component Signal Form validation.
 *
 * Validates that the form enforces the same rules as the Zod LoginRequestSchema:
 * - email: required, valid email format
 * - password: required (no length restriction at login)
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Login } from './login';
import { API_BASE_URL } from '@app/api-url.token';

describe('Login form validation', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup() {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    const fixture = TestBed.createComponent(Login);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Email validation ─────────────────────────────────────────────────────

  describe('email', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.loginForm.email().invalid()).toBe(true);
      expect(component.loginForm.email().errors().length).toBeGreaterThan(0);
    });

    it('should be valid for standard email', () => {
      component.model.update((m: { email: string; password: string }) => ({ ...m, email: 'user@example.com' }));

      expect(component.loginForm.email().valid()).toBe(true);
    });

    it('should be valid for email without TLD (test@test)', () => {
      component.model.update((m: { email: string; password: string }) => ({ ...m, email: 'test@test' }));

      expect(component.loginForm.email().valid()).toBe(true);
    });

    it('should be valid for email with subdomain', () => {
      component.model.update((m: { email: string; password: string }) => ({ ...m, email: 'user@sub.domain.com' }));

      expect(component.loginForm.email().valid()).toBe(true);
    });

    it('should be invalid for email without @ sign', () => {
      component.model.update((m: { email: string; password: string }) => ({ ...m, email: 'not-an-email' }));

      expect(component.loginForm.email().invalid()).toBe(true);
    });
  });

  // ── Password validation ──────────────────────────────────────────────────

  describe('password', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.loginForm.password().invalid()).toBe(true);
    });

    it('should be valid for single character (no min length at login)', () => {
      component.model.update((m: { email: string; password: string }) => ({ ...m, password: 'a' }));

      expect(component.loginForm.password().valid()).toBe(true);
    });

    it('should be valid for long password', () => {
      component.model.update((m: { email: string; password: string }) => ({ ...m, password: 'a'.repeat(200) }));

      expect(component.loginForm.password().valid()).toBe(true);
    });
  });

  // ── Form-level validation ────────────────────────────────────────────────

  describe('form validity', () => {
    beforeEach(() => setup());

    it('should be invalid when both fields are empty', () => {
      expect(component.loginForm().invalid()).toBe(true);
    });

    it('should be valid when both fields are filled', () => {
      component.model.update(() => ({ email: 'user@example.com', password: 'secret' }));

      expect(component.loginForm().valid()).toBe(true);
    });

    it('should be invalid when only email is filled', () => {
      component.model.update(() => ({ email: 'user@example.com', password: '' }));

      expect(component.loginForm().invalid()).toBe(true);
    });

    it('should be invalid when only password is filled', () => {
      component.model.update(() => ({ email: '', password: 'secret' }));

      expect(component.loginForm().invalid()).toBe(true);
    });
  });
});
