import type { BoardConfig, UpdateBoardColumns } from '@task-board/shared';
import { NotFoundError } from '../errors/app-error.js';
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

/**
 * Single-board model (doc 102): a project owns EXACTLY one board, identified
 * by its projectId. There is no board CRUD — the board is created atomically
 * with the project (seed) and deleted with it (cascade). The only mutation is
 * editing the columns/workflow.
 */
export class BoardService {
  constructor(
    private readonly boardRepo: BoardRepository,
    private readonly statusRepo: StatusRepository,
    private readonly projectRepo?: BoardServiceProjectRepo,
    private readonly auditService?: AuditService,
    private readonly projectMemberRepo?: BoardServiceProjectMemberRepo,
  ) {}

  /**
   * V2-4: gate the mutation behind `manage_boards` (PROJECT_ADMIN only;
   * tenant Owner/Admin bypass inside the RBAC matrix). The route also runs
   * requirePermission — this is the defense-in-depth layer.
   */
  private async ensureManageBoards(projectId: string, userId?: string, userRole?: string): Promise<void> {
    if (!userId || !userRole) {
      return; // no caller context → nothing to enforce against (legacy/test callers)
    }

    if (!this.projectMemberRepo) {
      throw new Error('Project member repository is not configured');
    }

    const membership = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    ensurePermission('manage_boards', userRole, membership?.role ?? null);
  }

  /** The project's single board. */
  async getBoardByProject(projectId: string): Promise<BoardConfig> {
    const board = await this.boardRepo.findByProject(projectId);

    if (!board) {
      throw new NotFoundError('Board not found');
    }

    return board;
  }

  /** Replace the board's columns (workflow edit). */
  async updateColumns(
    projectId: string,
    input: UpdateBoardColumns,
    userId?: string,
    userRole?: string,
  ): Promise<BoardConfig> {
    await this.ensureManageBoards(projectId, userId, userRole);

    const current = await this.getBoardByProject(projectId);

    // Validate all statusIds belong to the same project
    await this.validateStatusIds(
      projectId,
      input.columns.flatMap((c) => c.statusIds),
    );

    const updated = await this.boardRepo.updateColumns(projectId, input.columns);

    if (!updated) {
      throw new NotFoundError('Board not found');
    }

    // Audit side effect
    if (this.auditService && userId && this.projectRepo) {
      const project = await this.projectRepo.findById(projectId);

      await this.auditService.log({
        tenantId: project?.tenantId ?? '',
        projectId,
        entityType: 'BOARD',
        entityId: projectId,
        action: 'UPDATED',
        actorId: userId,
        changes: [{ field: 'columns', oldValue: current.columns, newValue: updated.columns }],
      });
    }

    return updated;
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
