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
    private readonly enrichment?: { enrichEvents(events: AuditEvent[]): Promise<AuditEvent[]> },
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

  /**
   * TOP-3 №2: log a batch of events with ONE actor lookup and ONE insert.
   * The actor is identical across the batch (e.g. every task of a single
   * bulk update). Each event keeps its own `changes` and `createdAt`.
   * No-op for an empty batch — no DB operations.
   */
  async logMany(
    actorId: string,
    events: {
      tenantId: string;
      projectId: string | null;
      entityType: AuditEntityType;
      entityId: string;
      action: AuditAction;
      changes?: AuditChange[];
    }[],
  ): Promise<void> {
    if (events.length === 0) return;

    const actor = await this.captureActor(actorId);

    await this.auditRepo.createMany(
      events.map((event) => ({
        tenantId: event.tenantId,
        projectId: event.projectId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        actor,
        changes: event.changes ?? [],
        createdAt: new Date(),
      })),
    );
  }

  async queryByProject(projectId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    const result = await this.auditRepo.findByProject(projectId, options);

    return this.enrich(result);
  }

  async queryByTenant(tenantId: string, options: AuditQueryOptions = {}): Promise<PaginatedResult<AuditEvent>> {
    const result = await this.auditRepo.findByTenant(tenantId, options);

    return this.enrich(result);
  }

  /** R3-P7: resolve human-readable labels for one page — batched, never per-event. */
  private async enrich(result: PaginatedResult<AuditEvent>): Promise<PaginatedResult<AuditEvent>> {
    if (!this.enrichment) return result;

    return { ...result, data: await this.enrichment.enrichEvents(result.data) };
  }

  private async captureActor(userId: string): Promise<AuditActor> {
    const user = await this.userRepo.findById(userId);

    return {
      userId,
      displayName: user?.displayName ?? user?.name ?? user?.email ?? 'Unknown User',
    };
  }
}
