/**
 * Tests for the tenantInterceptor.
 *
 * Covers:
 * - Attaches X-Tenant-Id header when tenant ID exists in localStorage
 * - Skips header for /auth/* requests
 * - Passes through unchanged when no tenant ID in localStorage
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { tenantInterceptor } from './tenant.interceptor';

const TENANT_KEY = 'taskboard_tenant_id';

describe('tenantInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([tenantInterceptor])), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should attach X-Tenant-Id header when tenant ID exists in localStorage', () => {
    localStorage.setItem(TENANT_KEY, 'tenant-123');

    http.get('/api/projects').subscribe();

    const req = httpMock.expectOne('/api/projects');

    expect(req.request.headers.get('X-Tenant-Id')).toBe('tenant-123');
    req.flush({});
  });

  it('should not attach X-Tenant-Id header when localStorage is empty', () => {
    http.get('/api/projects').subscribe();

    const req = httpMock.expectOne('/api/projects');

    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    req.flush({});
  });

  it('should skip X-Tenant-Id header for /auth/* requests', () => {
    localStorage.setItem(TENANT_KEY, 'tenant-123');

    http.post('/api/auth/login', { email: 'a@b.com', password: 'x' }).subscribe();

    const req = httpMock.expectOne('/api/auth/login');

    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    req.flush({});
  });

  it('should skip X-Tenant-Id header for requests containing /auth/ in URL', () => {
    localStorage.setItem(TENANT_KEY, 'tenant-123');

    http.get('/api/auth/me').subscribe();

    const req = httpMock.expectOne('/api/auth/me');

    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    req.flush({});
  });
});
