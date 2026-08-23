import type { AuditEvent, AuditActor, AuditChange, AuditEntityType, AuditAction } from '@task-board/shared';
import {
  AuditEventRepository,
  type AuditQueryOptions,
  type PaginatedResult,
} from '../repositories/audit-event.repository.js';

export interface AuditServiceUserRepo {
  findById(id: string): Promise<{ id: string; displayName?: string; name?: string; email: string } | null>;
}

export class AuditService {
  constructor(
    private readonly auditRepo: AuditEventRepository,
    private readonly userRepo: AuditServiceUserRepo,
  ) {}

  /**
   * Log an audit event. Actor displayName is captured at write time.
   */
  async log(input: {
    tenantId: string;
    projectId: string | null;
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    actorId: string;
    changes?: AuditChange[];
  }): Promise<AuditEvent> {
    const actor = await this.captureActor(input.actorId);

    return this.auditRepo.create({
      tenantId: input.tenantId,
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actor,
      changes: input.changes ?? [],
    });
  }

  async queryByProject(projectId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    return this.auditRepo.findByProject(projectId, options);
  }

  async queryByTenant(tenantId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    return this.auditRepo.findByTenant(tenantId, options);
  }

  private async captureActor(userId: string): Promise<AuditActor> {
    const user = await this.userRepo.findById(userId);

    return {
      userId,
      displayName: user?.displayName ?? user?.name ?? user?.email ?? 'Unknown User',
    };
  }
}
