import { describe, it, expect, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import { AuditEnrichmentService, UNKNOWN_LABEL } from './audit-enrichment.service.js';
import type { AuditServiceUserRepo } from './audit.service.js';
import type { AuditEventRepository } from '../repositories/audit-event.repository.js';
import type { AuditEvent } from '@task-board/shared';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockAuditRepo() {
  return {
    create: vi.fn().mockImplementation((input) =>
      Promise.resolve({
        id: 'event-1',
        ...input,
        createdAt: new Date().toISOString(),
      }),
    ),
    findByProject: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as AuditEventRepository;
}

function createMockUserRepo(): AuditServiceUserRepo {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'user-1', displayName: 'Alice', email: 'alice@example.com' }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuditService (DEC-028 actor snapshot at write time)', () => {
  it('resolves the actor displayName once and persists the snapshot on every event', async () => {
    const auditRepo = createMockAuditRepo();
    const userRepo = createMockUserRepo();
    const service = new AuditService(auditRepo, userRepo);

    await service.log({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      entityType: 'TASK',
      entityId: 'task-1',
      action: 'CREATED',
      actorId: 'user-1',
    });

    expect(userRepo.findById).toHaveBeenCalledWith('user-1');
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: 'user-1', displayName: 'Alice' },
      }),
    );
  });

  it('falls back to "Unknown User" when the actor cannot be resolved', async () => {
    const auditRepo = createMockAuditRepo();
    const userRepo: AuditServiceUserRepo = { findById: vi.fn().mockResolvedValue(null) };
    const service = new AuditService(auditRepo, userRepo);

    await service.log({
      tenantId: 'tenant-1',
      projectId: null,
      entityType: 'PROJECT',
      entityId: 'project-1',
      action: 'DELETED',
      actorId: 'deleted-user',
    });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: 'deleted-user', displayName: 'Unknown User' },
      }),
    );
  });

  it('persists changes alongside the actor snapshot', async () => {
    const auditRepo = createMockAuditRepo();
    const userRepo = createMockUserRepo();
    const service = new AuditService(auditRepo, userRepo);

    await service.log({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      entityType: 'SPRINT',
      entityId: 'sprint-1',
      action: 'UPDATED',
      actorId: 'user-1',
      changes: [{ field: 'status', oldValue: 'FUTURE', newValue: 'ACTIVE' }],
    });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: 'user-1', displayName: 'Alice' },
        changes: [{ field: 'status', oldValue: 'FUTURE', newValue: 'ACTIVE' }],
      }),
    );
  });
});

// ─── R3-P7: human-readable label enrichment ──────────────────────────────────

function createMockEnrichmentRepos() {
  return {
    tasks: { findByIds: vi.fn().mockResolvedValue([{ id: 'task-1', number: 123, projectId: 'proj-1' }]) },
    sprints: { findByIds: vi.fn().mockResolvedValue([{ id: 'sprint-1', name: 'Sprint 1' }]) },
    statuses: {
      findByIds: vi.fn().mockResolvedValue([
        { id: 'status-todo', name: 'To Do' },
        { id: 'status-inprog', name: 'In Progress' },
      ]),
    },
    labels: { findByIds: vi.fn().mockResolvedValue([{ id: 'label-1', name: 'bug' }]) },
    taskTypes: { findByIds: vi.fn().mockResolvedValue([]) },
    boards: { findByIds: vi.fn().mockResolvedValue([]) },
    projects: { findByIds: vi.fn().mockResolvedValue([{ id: 'proj-1', key: 'PROJ', name: 'Project' }]) },
    users: { findByIds: vi.fn().mockResolvedValue([{ id: 'user-9', displayName: 'Carol', email: 'c@x.io' }]) },
    comments: { findByIds: vi.fn().mockResolvedValue([{ id: 'comment-1', taskId: 'task-1' }]) },
    tenants: { findByIds: vi.fn().mockResolvedValue([]) },
    tenantMembers: { findByIds: vi.fn().mockResolvedValue([]) },
  };
}

const NOW = '2025-01-01T00:00:00Z';

function makeEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: 'ae-1',
    tenantId: 't1',
    projectId: 'p1',
    entityType: 'TASK',
    entityId: 'task-1',
    action: 'UPDATED',
    actor: { userId: 'u1', displayName: 'Alice' },
    changes: [],
    createdAt: NOW,
    ...overrides,
  };
}

describe('AuditEnrichmentService (R3-P7)', () => {
  it('resolves entityLabel per entity type (TASK → KEY-number, SPRINT → name)', async () => {
    const repos = createMockEnrichmentRepos();
    const service = new AuditEnrichmentService(repos);
    const events = await service.enrichEvents([
      makeEvent({ entityType: 'TASK', entityId: 'task-1' }),
      makeEvent({ entityType: 'SPRINT', entityId: 'sprint-1' }),
    ]);

    expect(events[0].entityLabel).toBe('PROJ-123');
    expect(events[1].entityLabel).toBe('Sprint 1');
  });

  it('resolves TASK keys via the task row projectId even without a PROJECT event (V7-4)', async () => {
    const repos = createMockEnrichmentRepos();
    const service = new AuditEnrichmentService(repos);
    // Page contains ONLY a TASK event — no PROJECT-entity event carries the
    // project id, so the key must be resolved through the fetched task row.
    const events = await service.enrichEvents([makeEvent({ entityType: 'TASK', entityId: 'task-1' })]);

    expect(events[0].entityLabel).toBe('PROJ-123');
    // the project lookup must have been fed the task row's projectId
    expect(repos.projects.findByIds).toHaveBeenCalledWith(['proj-1']);
  });

  it('resolves COMMENT labels via the parent task key', async () => {
    const repos = createMockEnrichmentRepos();
    const service = new AuditEnrichmentService(repos);
    const events = await service.enrichEvents([makeEvent({ entityType: 'COMMENT', entityId: 'comment-1' })]);

    expect(events[0].entityLabel).toBe('comment on PROJ-123');
  });

  it('enriches change values with oldLabel/newLabel while preserving raw values', async () => {
    const repos = createMockEnrichmentRepos();
    const service = new AuditEnrichmentService(repos);
    const events = await service.enrichEvents([
      makeEvent({
        entityType: 'TASK',
        changes: [
          { field: 'statusId', oldValue: 'status-todo', newValue: 'status-inprog' },
          { field: 'assigneeId', oldValue: null, newValue: 'user-9' },
          { field: 'labelIds', oldValue: [], newValue: ['label-1'] },
        ],
      }),
    ]);
    const [statusChange, assigneeChange, labelsChange] = events[0].changes;

    expect(statusChange.oldLabel).toBe('To Do');
    expect(statusChange.newLabel).toBe('In Progress');
    expect(statusChange.rawOldValue).toBe('status-todo');
    expect(assigneeChange.newLabel).toBe('Carol');
    expect(labelsChange.newLabel).toBe('bug');
  });

  it('batch-resolves per page — one $in query per collection regardless of event count', async () => {
    const repos = createMockEnrichmentRepos();
    const service = new AuditEnrichmentService(repos);

    await service.enrichEvents([
      makeEvent({ entityType: 'TASK', entityId: 'task-1' }),
      makeEvent({ entityType: 'TASK', entityId: 'task-1' }),
      makeEvent({
        entityType: 'TASK',
        entityId: 'task-1',
        changes: [{ field: 'statusId', oldValue: 'status-todo', newValue: 'status-inprog' }],
      }),
    ]);

    expect(repos.tasks.findByIds).toHaveBeenCalledTimes(1);
    expect(repos.statuses.findByIds).toHaveBeenCalledTimes(1);
    expect(repos.projects.findByIds).toHaveBeenCalledTimes(1);
  });

  it('falls back to "Unknown" when an id cannot be resolved', async () => {
    const repos = createMockEnrichmentRepos();

    repos.tasks.findByIds = vi.fn().mockResolvedValue([]);

    const service = new AuditEnrichmentService(repos);
    const events = await service.enrichEvents([
      makeEvent({ entityType: 'TASK', entityId: 'deleted-task' }),
      makeEvent({
        entityType: 'TASK',
        entityId: 'task-1',
        changes: [{ field: 'sprintId', oldValue: 'gone-sprint', newValue: null }],
      }),
    ]);

    expect(events[0].entityLabel).toBe(UNKNOWN_LABEL);
    // Unresolvable refs produce no labels — raw values stay untouched.
    expect(events[1].changes[0].oldLabel).toBeUndefined();
    expect(events[1].changes[0].rawOldValue).toBeUndefined();
  });

  it('leaves non-reference changes untouched', async () => {
    const repos = createMockEnrichmentRepos();
    const service = new AuditEnrichmentService(repos);
    const events = await service.enrichEvents([
      makeEvent({ changes: [{ field: 'title', oldValue: 'a', newValue: 'b' }] }),
    ]);

    expect(events[0].changes[0]).toEqual({ field: 'title', oldValue: 'a', newValue: 'b' });
  });
});

describe('AuditService queries enrich pages (R3-P7)', () => {
  it('passes page data through the enrichment service', async () => {
    const auditRepo = createMockAuditRepo();
    const page: PaginatedShape = {
      data: [makeEvent({ entityType: 'SPRINT', entityId: 'sprint-1' })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    auditRepo.findByProject = vi.fn().mockResolvedValue(page);

    const repos = createMockEnrichmentRepos();
    const service = new AuditService(auditRepo, createMockUserRepo(), new AuditEnrichmentService(repos));
    const result = await service.queryByProject('p1');

    expect(result.data[0].entityLabel).toBe('Sprint 1');
  });
});

type PaginatedShape = Awaited<ReturnType<AuditEventRepository['findByProject']>>;
