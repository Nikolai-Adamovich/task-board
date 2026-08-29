import { randomUUID } from 'node:crypto';
import type { Board, CreateBoard, UpdateBoard } from '@task-board/shared';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { assertTenantEntity } from './tenant-assert.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { StatusRepository } from '../repositories/status.repository.js';
import { ensurePermission } from './rbac.service.js';
import type { AuditService } from './audit.service.js';

export interface BoardServiceProjectRepo {
  findById(id: string): Promise<{ tenantId: string } | null>;
}

/** Minimal project-member repository interface to resolve the caller's project role */
export interface BoardServiceProjectMemberRepo {
  findByUserAndProject(userId: string, projectId: string): Promise<{ role: string } | null>;
}

// ─── Board Service ───────────────────────────────────────────────────────────

export class BoardService {
  constructor(
    private readonly boardRepo: BoardRepository,
    private readonly statusRepo: StatusRepository,
    private readonly projectRepo?: BoardServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: BoardServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate every mutation behind `manage_boards` (PROJECT_ADMIN only;
   * tenant Owner/Admin bypass inside the RBAC matrix). Routes with
   * `:projectId` in the path are additionally gated by requirePermission —
   * this is the defense-in-depth / id-based-route layer.
   */
  private async ensureManageBoards(projectId: string, userId?: string, userRole?: string): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new ForbiddenError('Project membership lookup is unavailable');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission('manage_boards', userRole, membership?.role ?? null);
  }

  async getBoardsByProject(projectId: string): Promise<Board[]> {
    return this.boardRepo.findByProject(projectId);
  }

  async getBoard(id: string, tenantId: string): Promise<Board> {
    const board = await this.boardRepo.findById(id);

    if (!board) {
      throw new NotFoundError('Board not found');
    }

    // M-02: a bare board id must never cross tenant boundaries (404, not 403)
    await assertTenantEntity(this.projectRepo, board.projectId, tenantId, 'Board');

    return board;
  }

  async createBoard(projectId: string, input: CreateBoard, userId?: string, userRole?: string): Promise<Board> {
    await this.ensureManageBoards(projectId, userId, userRole);

    // Validate all statusIds belong to the same project
    await this.validateStatusIds(
      projectId,
      input.columns.flatMap((c) => c.statusIds),
    );

    // Generate UUID for each column
    const columns = input.columns.map((col) => ({
      id: randomUUID(),
      statusIds: col.statusIds,
      position: col.position,
    }));
    const board = await this.boardRepo.create(projectId, {
      name: input.name,
      type: input.type,
      columns,
    });

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'BOARD',
        entityId: board.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return board;
  }

  async updateBoard(
    id: string,
    tenantId: string,
    input: UpdateBoard,
    userId?: string,
    userRole?: string,
  ): Promise<Board> {
    const board = await this.getBoard(id, tenantId);

    await this.ensureManageBoards(board.projectId, userId, userRole);

    const updateFields: { name?: string; columns?: { id: string; statusIds: string[]; position: number }[] } = {};

    if (input.name !== undefined) {
      updateFields.name = input.name;
    }

    if (input.columns !== undefined) {
      // Validate all statusIds belong to the same project
      await this.validateStatusIds(
        board.projectId,
        input.columns.flatMap((c) => c.statusIds),
      );

      updateFields.columns = input.columns.map((col) => ({
        id: col.id ?? randomUUID(),
        statusIds: col.statusIds,
        position: col.position,
      }));
    }

    const updated = await this.boardRepo.update(id, updateFields);

    if (!updated) {
      throw new NotFoundError('Board not found');
    }

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(updated.projectId);
      const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (input.name !== undefined) changes.push({ field: 'name', oldValue: board.name, newValue: input.name });
      if (input.columns !== undefined)
        changes.push({ field: 'columns', oldValue: board.columns, newValue: input.columns });
      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: updated.projectId,
        entityType: 'BOARD',
        entityId: updated.id,
        action: 'UPDATED',
        actorId: userId,
        changes,
      });
    }

    return updated;
  }

  async deleteBoard(id: string, userId?: string, userRole?: string): Promise<void> {
    const board = await this.boardRepo.findById(id);

    if (!board) {
      throw new NotFoundError('Board not found');
    }

    await this.ensureManageBoards(board.projectId, userId, userRole);

    // Audit side effect (before delete)
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(board.projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId: board.projectId,
        entityType: 'BOARD',
        entityId: id,
        action: 'DELETED',
        actorId: userId,
      });
    }

    await this.boardRepo.delete(id);
  }

  /**
   * Validate that all status IDs exist and belong to the given project.
   *
   * M-14: ONE batched `findByIds` query instead of a sequential `findById`
   * per status id; ownership is validated in code afterwards.
   */
  private async validateStatusIds(projectId: string, statusIds: string[]): Promise<void> {
    const uniqueStatusIds = [...new Set(statusIds)];

    if (uniqueStatusIds.length === 0) return;

    const statuses = await this.statusRepo.findByIds(uniqueStatusIds);
    const byId = new Map(statuses.map((status) => [status.id, status]));

    for (const statusId of uniqueStatusIds) {
      const status = byId.get(statusId);

      if (!status || status.projectId !== projectId) {
        throw new NotFoundError(`Status ${statusId} not found in project ${projectId}`);
      }
    }
  }
}
