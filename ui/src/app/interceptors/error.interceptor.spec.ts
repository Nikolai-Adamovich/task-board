import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { API_BASE_URL } from '../api-url.token';

describe('errorInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();

    routerNavigateSpy = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: Router, useValue: { navigate: routerNavigateSpy } },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should redirect to /auth/login on 401', () => {
    http.get('/api/boards').subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpMock.expectOne('/api/boards');

    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('should pass through successful responses', () => {
    http.get<{ id: string }>('/api/boards').subscribe((res) => {
      expect(res.id).toBe('board-1');
    });

    const req = httpMock.expectOne('/api/boards');

    req.flush({ id: 'board-1' });
  });
});
