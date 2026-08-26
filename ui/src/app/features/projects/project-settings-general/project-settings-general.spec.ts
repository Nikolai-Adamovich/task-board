/**
 * Tests for the ProjectSettingsGeneral page (DEC-035).
 *
 * Covers:
 * - Form seeded from the project context store
 * - Saving name/description via ProjectClient.update
 * - Store sync after save
 * - isAdmin gating
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ProjectSettingsGeneral } from './project-settings-general';
import { ProjectClient } from '@services/project-client';
import { AuthStore } from '@stores/auth-store';
import { ProjectStore } from '@stores/project-store';
import { API_BASE_URL } from '@app/api-url.token';
import type { Project } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockProject: Project = {
  id: 'p0000000-0000-0000-0000-000000000001',
  tenantId: 't0000000-0000-0000-0000-000000000001',
  key: 'TP',
  name: 'Test Project',
  description: 'A project for testing',
  status: 'ACTIVE',
  defaultStatusId: 's1',
  defaultBoardId: 'b1',
  archiveReason: null,
  deletionScheduledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let component: any;
let projectClientMock: Record<string, ReturnType<typeof vi.fn>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeProjectMock: any;

function setup(options: { tenantRole?: string; projectRole?: string } = {}) {
  const state: { project: Project | null } = { project: mockProject };

  activeProjectMock = Object.assign(() => state.project, {
    set: (p: Project | null) => {
      state.project = p;
    },
    update: (fn: (p: Project | null) => Project | null) => {
      state.project = fn(state.project);
    },
  });
  projectClientMock = {
    update: vi
      .fn()
      .mockImplementation((_id: string, data: { name: string; description: string }) =>
        of({ ...mockProject, ...data }),
      ),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: 'http://localhost/api' },
      { provide: ProjectClient, useValue: projectClientMock },
      { provide: AuthStore, useValue: { tenantRole: vi.fn().mockReturnValue(options.tenantRole ?? 'OWNER') } },
      {
        provide: ProjectStore,
        useValue: {
          activeProject: activeProjectMock,
          projectRole: vi.fn().mockReturnValue(options.projectRole ?? null),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(ProjectSettingsGeneral);

  fixture.componentRef.setInput('projectKey', mockProject.key);
  component = fixture.componentInstance;
  fixture.detectChanges();
}

describe('ProjectSettingsGeneral', () => {
  it('should seed the form from the project context', () => {
    setup();

    expect(component.model().name).toBe('Test Project');
    expect(component.model().description).toBe('A project for testing');
  });

  it('should save name and description via ProjectClient.update', async () => {
    setup();
    component.model.update((m: { name: string; description: string }) => ({
      ...m,
      name: 'Renamed Project',
      description: 'New description',
    }));
    submit(component.generalForm);
    await Promise.resolve();

    expect(projectClientMock.update).toHaveBeenCalledWith(mockProject.id, {
      name: 'Renamed Project',
      description: 'New description',
    });
  });

  it('should sync the project store after a successful save', async () => {
    setup();
    component.model.update((m: { name: string; description: string }) => ({ ...m, name: 'Renamed Project' }));
    submit(component.generalForm);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(activeProjectMock().name).toBe('Renamed Project');
  });

  it('should surface an error message when the update fails', async () => {
    setup();
    projectClientMock.update.mockReturnValueOnce(throwError(() => new Error('boom')));
    component.model.update((m: { name: string; description: string }) => ({ ...m, name: 'Nope' }));
    submit(component.generalForm);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(component.error()).toBeTruthy();
  });

  describe('isAdmin', () => {
    it('should be true for tenant OWNER', () => {
      setup({ tenantRole: 'OWNER' });

      expect(component.isAdmin()).toBe(true);
    });

    it('should be false for EDITOR without tenant role', () => {
      setup({ tenantRole: 'MEMBER', projectRole: 'EDITOR' });

      expect(component.isAdmin()).toBe(false);
    });
  });
});
