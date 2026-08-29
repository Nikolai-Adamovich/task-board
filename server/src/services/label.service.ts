import type { Label, CreateLabel, UpdateLabel } from '@task-board/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { LabelRepository } from '../repositories/label.repository.js';
import { ensurePermission } from './rbac.service.js';
import type { AuditService } from './audit.service.js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface LabelServiceTaskRepo {
  removeLabelFromAll(projectId: string, labelId: string): Promise<void>;
}

export interface LabelServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface LabelServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

// ─── Label Service ───────────────────────────────────────────────────────────

export class LabelService {
  constructor(
    private readonly labelRepo: LabelRepository,
    private readonly taskRepo: LabelServiceTaskRepo,
    private readonly projectRepo?: LabelServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: LabelServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate every mutation behind `manage_labels` (PROJECT_ADMIN + EDITOR;
   * tenant Owner/Admin bypass inside the RBAC matrix). Routes with
   * `:projectId` in the path are additionally gated by requirePermission —
   * this is the defense-in-depth / id-based-route layer.
   */
  private async ensureManageLabels(projectId: string, userId?: string, userRole?: string): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new ForbiddenError('Project membership lookup is unavailable');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission('manage_labels', userRole, membership?.role ?? null);
  }

  async getLabelsByProject(projectId: string): Promise<Label[]> {
    return this.labelRepo.findByProject(projectId);
  }

  async createLabel(projectId: string, input: CreateLabel, userId?: string, userRole?: string): Promise<Label> {
    await this.ensureManageLabels(projectId, userId, userRole);

    const normalizedName = input.name.toLowerCase().trim();
    const existing = await this.labelRepo.findByProjectAndNormalizedName(projectId, normalizedName);

    if (existing) {
      throw new ConflictError('A label with this name already exists in this project', 'DUPLICATE_LABEL');
    }

    const label = await this.labelRepo.create(projectId, input);

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'LABEL',
        entityId: label.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return label;
  }

  async updateLabel(labelId: string, input: UpdateLabel, userId?: string, userRole?: string): Promise<Label> {
    const label = await this.labelRepo.findById(labelId);

    if (!label) {
      throw new NotFoundError('Label not found');
    }

    await this.ensureManageLabels(label.projectId, userId, userRole);

    const normalizedName = input.name.toLowerCase().trim();
    const existing = await this.labelRepo.findByProjectAndNormalizedName(label.projectId, normalizedName);

    if (existing && existing.id !== labelId) {
      throw new ConflictError('A label with this name already exists in this project', 'DUPLICATE_LABEL');
    }

    const updated = await this.labelRepo.update(labelId, { name: input.name, normalizedName });

    if (!updated) {
      throw new NotFoundError('Label not found');
    }

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(updated.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: updated.projectId,
        entityType: 'LABEL',
        entityId: updated.id,
        action: 'UPDATED',
        actorId: userId,
        changes: [{ field: 'name', oldValue: label.name, newValue: input.name }],
      });
    }

    return updated;
  }

  async deleteLabel(labelId: string, userId?: string, userRole?: string): Promise<void> {
    const label = await this.labelRepo.findById(labelId);

    if (!label) {
      throw new NotFoundError('Label not found');
    }

    await this.ensureManageLabels(label.projectId, userId, userRole);

    // Remove all task-label associations
    await this.taskRepo.removeLabelFromAll(label.projectId, labelId);

    // Audit side effect (before delete)
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(label.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: label.projectId,
        entityType: 'LABEL',
        entityId: labelId,
        action: 'DELETED',
        actorId: userId,
      });
    }

    await this.labelRepo.delete(labelId);
  }
}
