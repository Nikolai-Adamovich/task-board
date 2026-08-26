import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { errorInterceptor } from './error.interceptor';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';

describe('errorInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
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
      user: {
        id: '1',
        email: 'a@b.com',
        displayName: 'A',
        avatarUrl: null,
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
      },
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

  it('should handle structured VALIDATION_ERROR response', () => {
    const errorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { email: 'Invalid email format' },
      },
    };

    http.get('/api/boards').subscribe({
      error: (err) => {
        expect(err.status).toBe(422);
        expect(err.userMessage).toBe('errors.validation');
      },
    });

    const req = httpMock.expectOne('/api/boards');

    req.flush(errorBody, { status: 422, statusText: 'Unprocessable Entity' });
  });

  it('should map INVALID_CREDENTIALS to neutral invalid-credentials copy (V1-8)', () => {
    const errorBody = {
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    };

    http.post('/api/auth/login', {}).subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
        expect(err.userMessage).toBe('errors.invalidCredentials');
      },
    });

    const req = httpMock.expectOne('/api/auth/login');

    req.flush(errorBody, { status: 401, statusText: 'Unauthorized' });
  });

  it('should handle structured NOT_FOUND response', () => {
    const errorBody = {
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    };

    http.get('/api/tasks/999').subscribe({
      error: (err) => {
        expect(err.status).toBe(404);
        expect(err.userMessage).toBe('errors.notFound');
      },
    });

    const req = httpMock.expectOne('/api/tasks/999');

    req.flush(errorBody, { status: 404, statusText: 'Not Found' });
  });

  it('should handle structured TASK_VERSION_CONFLICT response', () => {
    const errorBody = {
      error: {
        code: 'TASK_VERSION_CONFLICT',
        message: 'Task has been modified by another user',
      },
    };

    http.patch('/api/tasks/1', {}).subscribe({
      error: (err) => {
        expect(err.status).toBe(409);
        expect(err.userMessage).toBe('errors.taskVersionConflict');
      },
    });

    const req = httpMock.expectOne('/api/tasks/1');

    req.flush(errorBody, { status: 409, statusText: 'Conflict' });
  });

  it('should handle 403 permission denied', () => {
    const errorBody = {
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission',
      },
    };

    http.delete('/api/tenants/1').subscribe({
      error: (err) => {
        expect(err.status).toBe(403);
        expect(err.userMessage).toBe('errors.forbidden');
      },
    });

    const req = httpMock.expectOne('/api/tenants/1');

    req.flush(errorBody, { status: 403, statusText: 'Forbidden' });
  });

  it('should handle unknown error codes gracefully', () => {
    const errorBody = {
      error: {
        code: 'UNKNOWN_CODE',
        message: 'Something went wrong',
      },
    };

    http.get('/api/boards').subscribe({
      error: (err) => {
        expect(err.userMessage).toBe('Something went wrong');
      },
    });

    const req = httpMock.expectOne('/api/boards');

    req.flush(errorBody, { status: 500, statusText: 'Internal Server Error' });
  });
});
