import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header when token is present', () => {
    store.token.set('test-jwt');

    http.get('/api/boards').subscribe();

    const req = httpMock.expectOne('/api/boards');

    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');

    req.flush({});
  });

  it('should not add Authorization header when no token', () => {
    http.get('/api/boards').subscribe();

    const req = httpMock.expectOne('/api/boards');

    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush({});
  });

  it('should skip Authorization header for /auth/login requests', () => {
    store.token.set('test-jwt');

    http.post('/api/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/login');

    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush({});
  });

  it('should skip Authorization header for /auth/register requests', () => {
    store.token.set('test-jwt');

    http.post('/api/auth/register', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/register');

    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush({});
  });

  it('should add Authorization header for /auth/me requests', () => {
    store.token.set('test-jwt');

    http.get('/api/auth/me').subscribe();

    const req = httpMock.expectOne('/api/auth/me');

    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');

    req.flush({});
  });
});
