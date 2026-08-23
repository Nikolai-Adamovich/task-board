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

  async findByProject(projectId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    const { page = 1, limit = 20, entityType, entityId } = options;
    const query: Record<string, unknown> = { projectId };

    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);

    return {
      data: docs.map(toDomain),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByTenant(tenantId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    const { page = 1, limit = 20, entityType, entityId } = options;
    const query: Record<string, unknown> = { tenantId };

    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
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
