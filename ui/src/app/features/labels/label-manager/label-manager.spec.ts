/**
 * Tests for the LabelManager component.
 *
 * Covers:
 * - Loading labels on init
 * - Create label validation & submission
 * - Inline rename (startEdit / saveEdit / cancelEdit)
 * - Delete label (incl. undo toast recreating the deleted label)
 * - Dialog state changes
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { submit } from '@angular/forms/signals';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { LabelManager } from './label-manager';
import { LabelClient } from '@services/label-client';
import { ProjectStore } from '@stores/project-store';
import { AuthStore } from '@stores/auth-store';
import { API_BASE_URL } from '@app/api-url.token';
import { toast } from '@spartan-ng/brain/sonner';
import type { Label } from '@task-board/shared';
import { settle } from '@app/shared/testing/zoneless';

const NOW = '2025-01-01T00:00:00Z';
const mockLabels: Label[] = [
  { id: 'l1', projectId: 'p1', name: 'feature', normalizedName: 'feature', createdAt: NOW, updatedAt: NOW },
  { id: 'l2', projectId: 'p1', name: 'bug', normalizedName: 'bug', createdAt: NOW, updatedAt: NOW },
  { id: 'l3', projectId: 'p1', name: 'enhancement', normalizedName: 'enhancement', createdAt: NOW, updatedAt: NOW },
];

describe('LabelManager', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let labelClientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup() {
    // Spy on the sonner toast object directly — module mocking is unreliable
    // under the Angular vitest builder when several specs mock the same module.
    vi.spyOn(toast, 'success').mockReturnValue('toast-id');
    vi.spyOn(toast, 'error').mockReturnValue('toast-id');

    labelClientMock = {
      list: vi.fn().mockReturnValue(of([...mockLabels])),
      create: vi.fn().mockImplementation((_pid: string, data: { name: string }) =>
        of({
          id: 'l4',
          projectId: 'p1',
          name: data.name,
          normalizedName: data.name.toLowerCase(),
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ),
      update: vi.fn().mockImplementation((id: string, data: { name: string }) => {
        const existing = mockLabels.find((l) => l.id === id) ?? mockLabels[0];

        return of({ ...existing, ...data, updatedAt: NOW });
      }),
      delete: vi.fn().mockReturnValue(of({ success: true })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: () => false,
            currentUser: () => null,
            token: () => null,
            tenantRole: () => null,
          },
        },
        { provide: LabelClient, useValue: labelClientMock },
        { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
      ],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(LabelManager);

    fixture.componentRef.setInput('projectKey', 'proj-key');
    component = fixture.componentInstance;
    await settle(fixture);
  }

  // ── Loading ─────────────────────────────────────────────

  describe('ngOnInit', () => {
    beforeEach(() => setup());

    it('should call labelClient.list with projectId', () => {
      expect(labelClientMock.list).toHaveBeenCalledWith('p1');
    });

    it('should populate labels signal', () => {
      expect(component.labels()).toHaveLength(3);
      expect(component.labels()[0].name).toBe('feature');
    });

    it('should set loading to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should handle error on load', async () => {
      labelClientMock.list.mockReturnValueOnce(throwError(() => new Error('fail')));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: API_BASE_URL, useValue: 'http://localhost/api' },
          {
            provide: AuthStore,
            useValue: {
              isAuthenticated: () => false,
              currentUser: () => null,
              token: () => null,
              tenantRole: () => null,
            },
          },
          { provide: LabelClient, useValue: labelClientMock },
          { provide: ProjectStore, useValue: { activeProject: () => ({ id: 'p1' }), projectRole: () => null } },
        ],
      });
      await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

      const fixture = TestBed.createComponent(LabelManager);

      fixture.componentRef.setInput('projectKey', 'proj-key');
      component = fixture.componentInstance;
      await settle(fixture);
      expect(component.loading()).toBe(false);
    });
  });

  // ── Create ──────────────────────────────────────────────

  describe('createForm', () => {
    beforeEach(() => setup());

    it('should not create when name is empty', () => {
      submit(component.createForm);
      expect(labelClientMock.create).not.toHaveBeenCalled();
    });

    it('should create label and add to list', () => {
      component.createModel.update(() => ({ name: 'documentation' }));
      submit(component.createForm);

      expect(labelClientMock.create).toHaveBeenCalledWith('p1', { name: 'documentation' });
      expect(component.labels()).toHaveLength(4);
      expect(component.showCreateDialog()).toBe(false);
    });

    it('should reset form after creation', () => {
      component.createModel.update(() => ({ name: 'new-label' }));
      submit(component.createForm);

      expect(component.createModel().name).toBe('');
    });
  });

  // ── Inline Edit ──────────────────────────────────────────

  describe('startEdit / saveEdit / cancelEdit', () => {
    beforeEach(() => setup());

    it('should enter edit mode', () => {
      component.startEdit(mockLabels[0]);
      expect(component.editingId()).toBe('l1');
      expect(component.editingName()).toBe('feature');
    });

    it('should cancel edit', () => {
      component.startEdit(mockLabels[0]);
      component.cancelEdit();
      expect(component.editingId()).toBeNull();
      expect(component.editingName()).toBe('');
    });

    it('should save edit and update label', () => {
      component.startEdit(mockLabels[0]);
      component.editingName.set('new-feature');
      component.saveEdit(mockLabels[0]);

      expect(labelClientMock.update).toHaveBeenCalledWith('l1', { name: 'new-feature' });
      expect(component.editingId()).toBeNull();
    });

    it('should cancel if name unchanged', () => {
      component.startEdit(mockLabels[0]);
      component.saveEdit(mockLabels[0]);
      expect(labelClientMock.update).not.toHaveBeenCalled();
      expect(component.editingId()).toBeNull();
    });
  });

  // ── Delete ───────────────────────────────────────────────

  describe('confirmDelete / deleteLabel', () => {
    beforeEach(() => setup());

    it('should open delete dialog', () => {
      component.confirmDelete(mockLabels[0]);
      expect(component.showDeleteDialog()).toBe(true);
      expect(component.deletingLabel()).toEqual(mockLabels[0]);
    });

    it('should delete label and remove from list', () => {
      component.confirmDelete(mockLabels[0]);
      component.deleteLabel();

      expect(labelClientMock.delete).toHaveBeenCalledWith('l1');
      expect(component.labels()).toHaveLength(2);
      expect(component.showDeleteDialog()).toBe(false);
      expect(component.deletingLabel()).toBeNull();
    });

    it('should offer undo that recreates the label with the same name (Q11)', () => {
      vi.mocked(toast.success).mockClear();
      component.confirmDelete(mockLabels[0]);
      component.deleteLabel();

      expect(component.labels()).toHaveLength(2);

      // The delete success toast carries an Undo action button.
      const calls = vi.mocked(toast.success).mock.calls;
      const action = calls.at(-1)?.[1]?.action;

      expect(calls.length).toBeGreaterThan(0);
      expect(action?.label).toBeTruthy();

      action?.onClick?.(new MouseEvent('click'));

      expect(labelClientMock.create).toHaveBeenCalledWith('p1', { name: 'feature' });
      expect(component.labels()).toHaveLength(3);
      expect(component.labels().some((l: Label) => l.name === 'feature')).toBe(true);
    });
  });

  // ── Dialog State Changes ─────────────────────────────────

  describe('dialog state changes', () => {
    beforeEach(() => setup());

    it('should close create dialog on closed state', () => {
      component.showCreateDialog.set(true);
      component.onDialogStateChange('closed');
      expect(component.showCreateDialog()).toBe(false);
    });

    it('should close delete dialog on closed state', () => {
      component.showDeleteDialog.set(true);
      component.onDeleteDialogStateChange(false);
      expect(component.showDeleteDialog()).toBe(false);
      expect(component.deletingLabel()).toBeNull();
    });
  });
});
