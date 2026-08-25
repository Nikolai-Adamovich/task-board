import { randomUUID } from 'node:crypto';
import { BaseRepository } from './base.repository.js';
import { ProjectStatus } from '@task-board/shared';
import type { Project } from '@task-board/shared';

// Required MongoDB indexes:
// - { id: 1 } (unique)
// - { tenantId: 1, key: 1 } (unique)

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface ProjectDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  defaultStatusId: string;
  defaultBoardId: string;
  archiveReason: string | null;
  deletionScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: ProjectDocument): Project {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    key: doc.key,
    name: doc.name,
    description: doc.description,
    status: doc.status as Project['status'],
    defaultStatusId: doc.defaultStatusId,
    defaultBoardId: doc.defaultBoardId,
    archiveReason: doc.archiveReason as Project['archiveReason'],
    deletionScheduledAt: doc.deletionScheduledAt ? doc.deletionScheduledAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Project Repository ──────────────────────────────────────────────────────

export class ProjectRepository extends BaseRepository<ProjectDocument, Project> {
  protected toDomain(doc: ProjectDocument): Project {
    return toDomain(doc);
  }

  async findByKey(key: string): Promise<Project | null> {
    const doc = await this.collection.findOne({ key });

    return doc ? toDomain(doc) : null;
  }

  async findByTenant(tenantId: string): Promise<Project[]> {
    const docs = await this.collection.find({ tenantId }).toArray();

    return docs.map(toDomain);
  }

  async findByTenantAndKey(tenantId: string, key: string): Promise<Project | null> {
    const doc = await this.collection.findOne({ tenantId, key });

    return doc ? toDomain(doc) : null;
  }

  async create(tenantId: string, input: { key: string; name: string; description?: string }): Promise<Project> {
    const now = new Date();
    const doc: ProjectDocument = {
      id: randomUUID(),
      tenantId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      status: ProjectStatus.ACTIVE,
      defaultStatusId: '',
      defaultBoardId: '',
      archiveReason: null,
      deletionScheduledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    id: string,
    input: Partial<
      Pick<
        ProjectDocument,
        | 'name'
        | 'description'
        | 'status'
        | 'defaultStatusId'
        | 'defaultBoardId'
        | 'archiveReason'
        | 'deletionScheduledAt'
      >
    >,
  ): Promise<Project | null> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }
}
