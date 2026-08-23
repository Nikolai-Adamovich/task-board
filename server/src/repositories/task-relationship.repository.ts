import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { TaskRelationship, TaskRelationshipType } from '@task-board/shared';

export interface TaskRelationshipDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: string;
  createdById: string;
  createdAt: Date;
}

function toDomain(doc: TaskRelationshipDocument): TaskRelationship {
  return {
    id: doc.id,
    projectId: doc.projectId,
    sourceTaskId: doc.sourceTaskId,
    targetTaskId: doc.targetTaskId,
    type: doc.type as TaskRelationshipType,
    createdById: doc.createdById,
    createdAt: doc.createdAt.toISOString(),
  };
}

export class TaskRelationshipRepository {
  constructor(private readonly collection: Collection<TaskRelationshipDocument>) {}

  async findById(id: string): Promise<TaskRelationship | null> {
    const doc = await this.collection.findOne({ id });

    return doc ? toDomain(doc) : null;
  }

  async findByTask(taskId: string): Promise<TaskRelationship[]> {
    const docs = await this.collection.find({ $or: [{ sourceTaskId: taskId }, { targetTaskId: taskId }] }).toArray();

    return docs.map(toDomain);
  }

  async findBySourceAndTarget(sourceTaskId: string, targetTaskId: string): Promise<TaskRelationship | null> {
    const doc = await this.collection.findOne({ sourceTaskId, targetTaskId });

    return doc ? toDomain(doc) : null;
  }

  async create(input: {
    projectId: string;
    sourceTaskId: string;
    targetTaskId: string;
    type: string;
    createdById: string;
  }): Promise<TaskRelationship> {
    const doc: TaskRelationshipDocument = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };

    await this.collection.insertOne(doc);
    return toDomain(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });

    return result.deletedCount > 0;
  }

  async deleteByTask(taskId: string): Promise<void> {
    await this.collection.deleteMany({ $or: [{ sourceTaskId: taskId }, { targetTaskId: taskId }] });
  }

  /**
   * Delete all entities belonging to a project. Used for cascade delete.
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.collection.deleteMany({ projectId });
  }
}
