import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Collection } from 'mongodb';
import { AuditEventRepository } from './audit-event.repository.js';
import type { AuditEventDocument } from './audit-event.repository.js';

function createMockCollection() {
  return {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 0, acknowledged: true }),
    find: vi.fn(),
    countDocuments: vi.fn(),
  } as unknown as Collection<AuditEventDocument> & {
    insertOne: ReturnType<typeof vi.fn>;
    insertMany: ReturnType<typeof vi.fn>;
  };
}

const baseInput = {
  tenantId: 'tenant-1',
  projectId: 'project-1',
  entityType: 'TASK',
  entityId: 'task-1',
  action: 'UPDATED',
  actor: { userId: 'user-1', displayName: 'Alice' },
  changes: [{ field: 'statusId', oldValue: 's1', newValue: 's2' }],
};

describe('AuditEventRepository', () => {
  let collection: ReturnType<typeof createMockCollection>;
  let repo: AuditEventRepository;

  beforeEach(() => {
    collection = createMockCollection();
    repo = new AuditEventRepository(collection);
  });

  it('create keeps the single-insert path (regression guard)', async () => {
    await repo.create(baseInput);

    expect(collection.insertOne).toHaveBeenCalledTimes(1);
    expect(collection.insertMany).not.toHaveBeenCalled();

    const doc = (collection.insertOne.mock.calls.at(0)?.[0] ?? null) as AuditEventDocument | null;

    expect(doc?.id).toEqual(expect.any(String));
    expect(doc?.createdAt).toBeInstanceOf(Date);
  });

  it('createMany issues exactly ONE insertMany (TOP-3 №2)', async () => {
    await repo.createMany([baseInput, { ...baseInput, entityId: 'task-2' }]);

    expect(collection.insertMany).toHaveBeenCalledTimes(1);
    expect(collection.insertOne).not.toHaveBeenCalled();

    const call = collection.insertMany.mock.calls.at(0);
    const docs = (call?.[0] ?? []) as AuditEventDocument[];

    expect(call?.[1]).toEqual({ ordered: false });
    expect(docs).toHaveLength(2);
    // individual UUID and timestamp per event
    expect(docs[0]?.id).not.toBe(docs[1]?.id);
    expect(docs[0]?.createdAt).toBeInstanceOf(Date);
    expect(docs[1]?.createdAt).toBeInstanceOf(Date);
  });

  it('createMany is a no-op for an empty batch — no insertMany issued', async () => {
    await repo.createMany([]);

    expect(collection.insertMany).not.toHaveBeenCalled();
  });
});
