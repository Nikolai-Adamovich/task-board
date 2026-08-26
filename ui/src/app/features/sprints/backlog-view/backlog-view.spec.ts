/**
 * Tests for the BacklogView page (DEC-039).
 *
 * Covers:
 * - Resolving projectId/projectKey/tenantSlug from the stores
 * - Rendering the SprintBacklog list with the resolved project
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BacklogView } from './backlog-view';
import { TaskClient } from '@services/task-client';
import { ProjectStore } from '@stores/project-store';
import { TenantStore } from '@stores/tenant-store';
import { API_BASE_URL } from '@app/api-url.token';

describe('BacklogView', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let taskClientMock: { list: ReturnType<typeof vi.fn> };

  function setup(activeProject: Record<string, string> | null) {
    taskClientMock = {
      list: vi.fn().mockReturnValue(of({ data: [], pagination: { total: 0, page: 1, limit: 200, totalPages: 0 } })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TaskClient, useValue: taskClientMock },
        {
          provide: ProjectStore,
          useValue: { activeProject: () => activeProject, projectRole: () => null },
        },
        { provide: TenantStore, useValue: { activeTenant: () => ({ slug: 'acme' }) } },
      ],
    });

    const fixture = TestBed.createComponent(BacklogView);

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should resolve ids from the stores and load backlog tasks', () => {
    setup({ id: 'p1', key: 'ABC' });

    expect(component.projectId()).toBe('p1');
    expect(component.projectKey()).toBe('ABC');
    expect(component.tenantSlug()).toBe('acme');
    expect(taskClientMock.list).toHaveBeenCalledWith('p1', { sprintId: null, limit: 200 });
  });

  it('should fall back to empty values when no project is active', () => {
    setup(null);

    expect(component.projectId()).toBe('');
    expect(component.projectKey()).toBe('');
    expect(taskClientMock.list).not.toHaveBeenCalled();
  });
});
