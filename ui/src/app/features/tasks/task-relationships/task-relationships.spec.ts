/**
 * Tests for the TaskRelationships component.
 *
 * Covers:
 * - Loading relationships on init
 * - Creating a new relationship
 * - Deleting a relationship with confirmation
 * - isSource / otherTaskId helpers
 * - isBlocks visual distinction
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskRelationships } from './task-relationships';
import { TaskRelationshipClient } from '@services/task-relationship-client';
import { API_BASE_URL } from '@app/api-url.token';
import { TaskRelationshipType } from '@task-board/shared';
import type { TaskRelationship } from '@task-board/shared';

const NOW = '2025-01-01T00:00:00Z';
const mockRelationships: TaskRelationship[] = [
  {
    id: 'r1',
    projectId: 'p1',
    sourceTaskId: 'tk1',
    targetTaskId: 'tk2',
    type: TaskRelationshipType.BLOCKS,
    createdById: 'u1',
    createdAt: NOW,
  },
  {
    id: 'r2',
    projectId: 'p1',
    sourceTaskId: 'tk3',
    targetTaskId: 'tk1',
    type: TaskRelationshipType.RELATES_TO,
    createdById: 'u1',
    createdAt: NOW,
  },
];

describe('TaskRelationships', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let clientMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function setup(relationships: TaskRelationship[] = mockRelationships) {
    clientMock = {
      list: vi.fn().mockReturnValue(of(relationships)),
      create: vi.fn().mockReturnValue(
        of({
          id: 'r3',
          projectId: 'p1',
          sourceTaskId: 'tk1',
          targetTaskId: 'tk4',
          type: TaskRelationshipType.DUPLICATES,
          createdById: 'u1',
          createdAt: NOW,
        }),
      ),
      delete: vi.fn().mockReturnValue(of({ success: true })),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TaskRelationshipClient, useValue: clientMock },
      ],
    });

    const fixture = TestBed.createComponent(TaskRelationships);

    fixture.componentRef.setInput('taskId', 'tk1');
    fixture.componentRef.setInput('projectId', 'p1');

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Loading ─────────────────────────────────────────────────────
  it('should load relationships on init', () => {
    setup();
    expect(clientMock.list).toHaveBeenCalledWith('tk1');
    expect(component.relationships()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('should handle load error', () => {
    clientMock = {
      list: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      create: vi.fn(),
      delete: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: TaskRelationshipClient, useValue: clientMock },
      ],
    });

    const fixture = TestBed.createComponent(TaskRelationships);

    fixture.componentRef.setInput('taskId', 'tk1');
    fixture.componentRef.setInput('projectId', 'p1');

    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('relationships.loadError');
  });

  // ── Create ──────────────────────────────────────────────────────
  it('should create a new relationship', () => {
    setup();
    component.targetTaskId.set('tk4');
    component.relationshipType.set(TaskRelationshipType.DUPLICATES);
    component.createRelationship();
    expect(clientMock.create).toHaveBeenCalledWith('tk1', {
      targetTaskId: 'tk4',
      type: TaskRelationshipType.DUPLICATES,
    });
    expect(component.relationships()).toHaveLength(3);
    expect(component.showCreateForm()).toBe(false);
  });

  it('should not create with empty target task ID', () => {
    setup();
    component.targetTaskId.set('   ');
    component.createRelationship();
    expect(clientMock.create).not.toHaveBeenCalled();
  });

  // ── Delete ──────────────────────────────────────────────────────
  it('should confirm and delete a relationship', () => {
    setup();

    const rel = component.relationships()[0];

    component.confirmDelete(rel);
    expect(component.showDeleteConfirm()).toBe(true);
    expect(component.relationshipToDelete()?.id).toBe('r1');

    component.deleteRelationship();
    expect(clientMock.delete).toHaveBeenCalledWith('r1');
    expect(component.relationships()).toHaveLength(1);
    expect(component.showDeleteConfirm()).toBe(false);
  });

  // ── Helpers ─────────────────────────────────────────────────────
  it('should correctly identify source relationships', () => {
    setup();

    const asSource = component.relationships()[0]; // sourceTaskId = tk1
    const asTarget = component.relationships()[1]; // targetTaskId = tk1

    expect(component.isSource(asSource)).toBe(true);
    expect(component.isSource(asTarget)).toBe(false);
  });

  it('should return the other task ID', () => {
    setup();

    const asSource = component.relationships()[0];
    const asTarget = component.relationships()[1];

    expect(component.otherTaskId(asSource)).toBe('tk2');
    expect(component.otherTaskId(asTarget)).toBe('tk3');
  });

  it('should identify BLOCKS relationships', () => {
    setup();

    const blocks = component.relationships()[0];
    const relates = component.relationships()[1];

    expect(component.isBlocks(blocks)).toBe(true);
    expect(component.isBlocks(relates)).toBe(false);
  });
});
