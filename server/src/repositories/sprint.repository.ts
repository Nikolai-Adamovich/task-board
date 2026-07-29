import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Sprint } from '@task-board/shared';

// ─── MongoDB Document Shape ───────────────────────────────────────────────────

export interface SprintDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  goal: string | null;
  status: string;
  taskIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function toDomain(doc: SprintDocument): Sprint {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    projectId: doc.projectId,
    name: doc.name,
    startDate: doc.startDate.toISOString(),
    endDate: doc.endDate.toISOString(),
    goal: doc.goal ?? undefined,
    status: doc.status as Sprint['status'],
    taskIds: doc.taskIds,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ─── Sprint Repository ───────────────────────────────────────────────────────

export class SprintRepository {
  constructor(private readonly collection: Collection<SprintDocument>) {}

  async findById(tenantId: string, id: string): Promise<Sprint | null> {
    const doc = await this.collection.findOne({ id, tenantId });

    return doc ? toDomain(doc) : null;
  }

  async findByProject(tenantId: string, projectId: string): Promise<Sprint[]> {
    const docs = await this.collection.find({ tenantId, projectId }).sort({ startDate: -1 }).toArray();

    return docs.map(toDomain);
  }

  async findByTenant(tenantId: string): Promise<Sprint[]> {
    const docs = await this.collection.find({ tenantId }).sort({ startDate: -1 }).toArray();

    return docs.map(toDomain);
  }

  async create(
    tenantId: string,
    input: {
      projectId: string;
      name: string;
      startDate: string;
      endDate: string;
      goal?: string;
    },
  ): Promise<Sprint> {
    const now = new Date();
    const doc: SprintDocument = {
      id: randomUUID(),
      tenantId,
      projectId: input.projectId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      goal: input.goal ?? null,
      status: 'planned',
      taskIds: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      startDate?: string | Date;
      endDate?: string | Date;
      goal?: string | null;
      status?: string;
    },
  ): Promise<Sprint | null> {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) updateFields.name = input.name;
    if (input.startDate !== undefined) updateFields.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) updateFields.endDate = new Date(input.endDate);
    if (input.goal !== undefined) updateFields.goal = input.goal;
    if (input.status !== undefined) updateFields.status = input.status;

    const result = await this.collection.findOneAndUpdate(
      { id, tenantId },
      { $set: updateFields },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id, tenantId });

    return result.deletedCount > 0;
  }

  async addTask(tenantId: string, sprintId: string, taskId: string): Promise<Sprint | null> {
    const result = await this.collection.findOneAndUpdate(
      { id: sprintId, tenantId },
      {
        $addToSet: { taskIds: taskId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }

  async removeTask(tenantId: string, sprintId: string, taskId: string): Promise<Sprint | null> {
    const result = await this.collection.findOneAndUpdate(
      { id: sprintId, tenantId },
      {
        $pull: { taskIds: taskId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' },
    );

    return result ? toDomain(result) : null;
  }
}
