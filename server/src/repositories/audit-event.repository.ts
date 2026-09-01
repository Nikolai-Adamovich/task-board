import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { AuditEvent, AuditActor, AuditChange, AuditEntityType, AuditAction } from '@task-board/shared';

export interface AuditEventDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  projectId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actor: AuditActor;
  changes: AuditChange[];
  createdAt: Date;
}

function toDomain(doc: AuditEventDocument): AuditEvent {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    projectId: doc.projectId,
    entityType: doc.entityType as AuditEntityType,
    entityId: doc.entityId,
    action: doc.action as AuditAction,
    actor: doc.actor,
    changes: doc.changes,
    createdAt: doc.createdAt.toISOString(),
  };
}

export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  /** R3-P7: filter by action (CREATED | UPDATED | DELETED) */
  action?: string;
  /** R3-P7: filter by actor user id */
  actorId?: string;
  /** R3-P7: sort by createdAt — defaults to 'desc' */
  sort?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AuditEventRepository {
  constructor(private readonly collection: Collection<AuditEventDocument>) {}

  async create(input: {
    tenantId: string;
    projectId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    actor: AuditActor;
    changes: AuditChange[];
  }): Promise<AuditEvent> {
    const doc: AuditEventDocument = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  /**
   * TOP-3 №2: persist a batch of audit events in ONE `insertMany`.
   *
   * Same document shape as {@link create}; every event keeps its own UUID and
   * its own `createdAt` (the caller captures timestamps individually — for a
   * single bulk operation the sibling events are interchangeable, so no
   * ordering contract beyond `createdAt` is required). `ordered: false` keeps
   * per-event independence without introducing an ordering mechanism.
   */
  async createMany(
    inputs: {
      tenantId: string;
      projectId: string | null;
      entityType: string;
      entityId: string;
      action: string;
      actor: AuditActor;
      changes: AuditChange[];
      createdAt?: Date;
    }[],
  ): Promise<void> {
    if (inputs.length === 0) return;

    const docs: AuditEventDocument[] = inputs.map((input) => ({
      id: randomUUID(),
      ...input,
      createdAt: input.createdAt ?? new Date(),
    }));

    await this.collection.insertMany(docs, { ordered: false });
  }

  async findByProject(projectId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    const { page = 1, limit = 20 } = options;
    const query: Record<string, unknown> = { projectId };

    this.applyFilters(query, options);

    return this.runQuery(query, options, page, limit);
  }

  async findByTenant(tenantId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    const { page = 1, limit = 20 } = options;
    const query: Record<string, unknown> = { tenantId };

    this.applyFilters(query, options);

    return this.runQuery(query, options, page, limit);
  }

  private applyFilters(query: Record<string, unknown>, options: AuditQueryOptions): void {
    if (options.entityType) query.entityType = options.entityType;
    if (options.entityId) query.entityId = options.entityId;
    if (options.action) query.action = options.action;
    if (options.actorId) query['actor.userId'] = options.actorId;
  }

  private async runQuery(
    query: Record<string, unknown>,
    options: AuditQueryOptions,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AuditEvent>> {
    const direction = options.sort === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.collection.find(query).sort({ createdAt: direction }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);

    return {
      data: docs.map(toDomain),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
