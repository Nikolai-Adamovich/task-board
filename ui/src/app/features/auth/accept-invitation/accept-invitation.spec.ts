/**
 * Tests for the AcceptInvitation component.
 *
 * Covers:
 * - Signal form field validation (displayName, password, confirmPassword)
 * - Form-level validity
 * - ngOnInit: token extraction, invitation loading, error handling
 * - acceptAsNewUser: password mismatch, successful accept
 * - acceptAsExistingUser: successful accept
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AcceptInvitation } from './accept-invitation';
import { TenantClient } from '@services/tenant-client';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { InvitationDetails, AuthResponse, User } from '@task-board/shared';

const mockInvitationDetails: InvitationDetails = {
  email: 'invited@example.com',
  tenantName: 'Acme',
  role: 'MEMBER',
  status: 'PENDING',
  isRegistered: false,
};
const mockAuthResponse: AuthResponse = {
  token: 'jwt-token',
  user: { id: 'u1', email: 'invited@example.com', displayName: 'Test' } as User,
};

describe('AcceptInvitation', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let fixture: ComponentFixture<AcceptInvitation>;
  let tenantClientMock: {
    getInvitationDetails: ReturnType<typeof vi.fn>;
    acceptInvitation: ReturnType<typeof vi.fn>;
  };
  let authStoreMock: {
    setSession: ReturnType<typeof vi.fn>;
  };
  let routeMock: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };

  function setup(token: string | null = 'valid-token', details: InvitationDetails = mockInvitationDetails) {
    tenantClientMock = {
      getInvitationDetails: vi.fn().mockReturnValue(of(details)),
      acceptInvitation: vi.fn().mockReturnValue(of(mockAuthResponse)),
    };
    authStoreMock = {
      setSession: vi.fn(),
    };
    routeMock = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockReturnValue(token),
        },
      },
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TenantClient, useValue: tenantClientMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: ActivatedRoute, useValue: routeMock },
      ],
    });

    fixture = TestBed.createComponent(AcceptInvitation);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Form field validation ──────────────────────────────────────────────

  describe('displayName field', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.invitationForm.displayName().invalid()).toBe(true);
    });

    it('should be valid for non-empty value', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        displayName: 'John',
      }));
      expect(component.invitationForm.displayName().valid()).toBe(true);
    });

    it('should be invalid when exceeding 100 characters', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        displayName: 'a'.repeat(101),
      }));
      expect(component.invitationForm.displayName().invalid()).toBe(true);
    });

    it('should be valid at 100 characters', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        displayName: 'a'.repeat(100),
      }));
      expect(component.invitationForm.displayName().valid()).toBe(true);
    });
  });

  describe('password field', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.invitationForm.password().invalid()).toBe(true);
    });

    it('should be invalid when shorter than 8 characters', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        password: 'short',
      }));
      expect(component.invitationForm.password().invalid()).toBe(true);
    });

    it('should be valid at 8 characters', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        password: '12345678',
      }));
      expect(component.invitationForm.password().valid()).toBe(true);
    });

    it('should be invalid when exceeding 128 characters', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        password: 'a'.repeat(129),
      }));
      expect(component.invitationForm.password().invalid()).toBe(true);
    });
  });

  describe('confirmPassword field', () => {
    beforeEach(() => setup());

    it('should be invalid when empty', () => {
      expect(component.invitationForm.confirmPassword().invalid()).toBe(true);
    });

    it('should be valid when filled', () => {
      component.model.update((m: { displayName: string; password: string; confirmPassword: string }) => ({
        ...m,
        confirmPassword: 'something',
      }));
      expect(component.invitationForm.confirmPassword().valid()).toBe(true);
    });
  });

  // ── Form-level validation ──────────────────────────────────────────────

  describe('form validity', () => {
    beforeEach(() => setup());

    it('should be invalid when all fields are empty', () => {
      expect(component.invitationForm().invalid()).toBe(true);
    });

    it('should be valid when all fields are correctly filled', () => {
      component.model.update(() => ({
        displayName: 'John',
        password: 'secure123',
        confirmPassword: 'secure123',
      }));
      expect(component.invitationForm().valid()).toBe(true);
    });
  });

  // ── ngOnInit ───────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should fetch invitation details when token is present', () => {
      setup('valid-token');

      expect(tenantClientMock.getInvitationDetails).toHaveBeenCalledWith('valid-token');
      expect(component.invitation()).toEqual(mockInvitationDetails);
      expect(component.loading()).toBe(false);
    });

    it('should set error when no token in query params', () => {
      setup(null);

      expect(component.error()).toBe('auth.invitation.noToken');
      expect(component.loading()).toBe(false);
      expect(tenantClientMock.getInvitationDetails).not.toHaveBeenCalled();
    });

    it('should set error on invitation fetch failure', () => {
      tenantClientMock = {
        getInvitationDetails: vi
          .fn()
          .mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'Expired invitation' } }))),
        acceptInvitation: vi.fn(),
      };
      authStoreMock = { setSession: vi.fn() };
      routeMock = { snapshot: { queryParamMap: { get: vi.fn().mockReturnValue('bad-token') } } };

      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          { provide: TenantClient, useValue: tenantClientMock },
          { provide: AuthStore, useValue: authStoreMock },
          { provide: ActivatedRoute, useValue: routeMock },
        ],
      });

      const fixture = TestBed.createComponent(AcceptInvitation);

      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.error()).toBe('Expired invitation');
      expect(component.loading()).toBe(false);
    });
  });

  // ── V5-2: unregistered invitee must set a password (register-with-invite) ──

  describe('acceptAsNewUser (V5-2)', () => {
    it('should send token + password + displayName so the placeholder account becomes usable', async () => {
      setup();

      component.model.update(() => ({
        displayName: 'V Five Member',
        password: 'securepass123',
        confirmPassword: 'securepass123',
      }));
      await component.acceptAsNewUser();

      expect(tenantClientMock.acceptInvitation).toHaveBeenCalledWith({
        token: 'valid-token',
        password: 'securepass123',
        displayName: 'V Five Member',
      });
      expect(authStoreMock.setSession).toHaveBeenCalledWith(mockAuthResponse);
    });

    it('should not call the client when passwords do not match', async () => {
      setup();

      component.model.update(() => ({
        displayName: 'V Five Member',
        password: 'securepass123',
        confirmPassword: 'different123',
      }));
      await component.acceptAsNewUser();

      expect(tenantClientMock.acceptInvitation).not.toHaveBeenCalled();
      expect(authStoreMock.setSession).not.toHaveBeenCalled();
    });

    it('should render the registration form for an unregistered invitee (isRegistered=false)', () => {
      setup('valid-token', { ...mockInvitationDetails, isRegistered: false });

      expect(fixture.nativeElement.querySelector('#invitation-form')).toBeTruthy();
    });

    it('should NOT render the registration form for a registered invitee', () => {
      setup('valid-token', { ...mockInvitationDetails, isRegistered: true });

      expect(fixture.nativeElement.querySelector('#invitation-form')).toBeNull();
    });
  });

  // ── acceptAsExistingUser ───────────────────────────────────────────────

  describe('acceptAsExistingUser', () => {
    beforeEach(() => setup());

    it('should call tenantClient.acceptInvitation with token only', () => {
      component.acceptAsExistingUser();

      expect(tenantClientMock.acceptInvitation).toHaveBeenCalledWith({ token: 'valid-token' });
    });

    it('should call authStore.setSession and navigate on success', () => {
      component.acceptAsExistingUser();

      expect(authStoreMock.setSession).toHaveBeenCalledWith(mockAuthResponse);
    });

    it('should set error on failure', () => {
      tenantClientMock.acceptInvitation.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ error: { message: 'Already a member' } })),
      );
      component.acceptAsExistingUser();

      expect(component.error()).toBe('Already a member');
      expect(component.loading()).toBe(false);
    });
  });
});
