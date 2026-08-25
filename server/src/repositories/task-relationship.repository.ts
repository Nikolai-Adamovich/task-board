import { BaseRepository } from './base.repository.js';
import { randomUUID } from 'node:crypto';
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

export class TaskRelationshipRepository extends BaseRepository<TaskRelationshipDocument, TaskRelationship> {
  protected toDomain(doc: TaskRelationshipDocument): TaskRelationship {
    return toDomain(doc);
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
