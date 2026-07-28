import type { Collection } from 'mongodb';
import type { ProjectMember } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface ProjectMemberDocument {
  _id?: import('mongodb').ObjectId;
  userId: string;
  projectId: string;
  tenantId: string;
  role: string;
  createdAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: ProjectMemberDocument): ProjectMember {
  return {
    userId: doc.userId,
    projectId: doc.projectId,
    tenantId: doc.tenantId,
    role: doc.role as ProjectMember['role'],
  };
}

// ─── Project Member Repository ───────────────────────────────────────────────

export class ProjectMemberRepository {
  constructor(private readonly collection: Collection<ProjectMemberDocument>) {}

  async findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null> {
    const doc = await this.collection.findOne({ userId, projectId });

    return doc ? toDomain(doc) : null;
  }

  async findByProject(projectId: string): Promise<ProjectMember[]> {
    const docs = await this.collection.find({ projectId }).toArray();

    return docs.map(toDomain);
  }

  async findByUser(userId: string, tenantId: string): Promise<ProjectMember[]> {
    const docs = await this.collection.find({ userId, tenantId }).toArray();

    return docs.map(toDomain);
  }

  async create(input: { userId: string; projectId: string; tenantId: string; role: string }): Promise<ProjectMember> {
    const doc: ProjectMemberDocument = {
      userId: input.userId,
      projectId: input.projectId,
      tenantId: input.tenantId,
      role: input.role,
      createdAt: new Date(),
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async updateRole(projectId: string, userId: string, role: string): Promise<ProjectMember | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, projectId },
      { $set: { role } },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(projectId: string, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, projectId });

    return result.deletedCount > 0;
  }
}
