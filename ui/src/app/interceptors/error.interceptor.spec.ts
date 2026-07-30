import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';

describe('errorInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'auth/login', redirectTo: '/' }]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call authStore.logout() on 401', () => {
    const store = TestBed.inject(AuthStore);
    const logoutSpy = vi.spyOn(store, 'logout');

    // Set a token so logout has something to clear
    store.setSession({
      token: 'test',
      user: { id: '1', email: 'a@b.com', displayName: 'A', createdAt: '', updatedAt: '' },
    });

    http.get('/api/boards').subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpMock.expectOne('/api/boards');

    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalled();
    expect(store.token()).toBeNull();
  });

  it('should pass through successful responses', () => {
    http.get<{ id: string }>('/api/boards').subscribe((res) => {
      expect(res.id).toBe('board-1');
    });

    const req = httpMock.expectOne('/api/boards');

    req.flush({ id: 'board-1' });
  });
});
