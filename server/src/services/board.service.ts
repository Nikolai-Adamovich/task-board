import type { Board, Column, CreateBoard, UpdateBoard } from '@task-board/shared';
import { DefaultColumnNames } from '@task-board/shared';
import { ForbiddenError, NotFoundError } from '../middleware/error-handler.js';
import { BoardRepository } from '../repositories/board.repository.js';
import { ColumnRepository } from '../repositories/column.repository.js';

// ─── Board Service ───────────────────────────────────────────────────────────

export class BoardService {
  constructor(
    private readonly boardRepo: BoardRepository,
    private readonly columnRepo: ColumnRepository,
  ) {}

  /**
   * List all boards for a project within a tenant.
   */
  async listBoards(tenantId: string, projectId: string): Promise<Board[]> {
    return this.boardRepo.findByProject(tenantId, projectId);
  }

  /**
   * Create a new board with default columns. Admin+ only.
   */
  async createBoard(
    tenantId: string,
    input: CreateBoard & { projectId: string },
    userRole: string,
  ): Promise<{ board: Board; columns: Column[] }> {
    this.requireAdmin(userRole);

    const board = await this.boardRepo.create(tenantId, {
      projectId: input.projectId,
      name: input.name,
      description: input.description,
    });
    // Create columns — use custom names if provided, otherwise use defaults
    const columnNames = input.columnNames ?? [...DefaultColumnNames];
    const columns: Column[] = [];

    for (let i = 0; i < columnNames.length; i++) {
      const column = await this.columnRepo.create(tenantId, {
        boardId: board.id,
        name: columnNames[i],
        position: i,
        isDefault: i < DefaultColumnNames.length && !input.columnNames,
      });

      columns.push(column);
    }

    return { board, columns };
  }

  /**
   * Get a board by ID with its columns.
   */
  async getBoard(tenantId: string, id: string): Promise<{ board: Board; columns: Column[] }> {
    const board = await this.boardRepo.findById(tenantId, id);

    if (!board) {
      throw new NotFoundError('Board not found');
    }

    const columns = await this.columnRepo.findByBoard(tenantId, id);

    return { board, columns };
  }

  /**
   * Update a board. Admin+ only.
   */
  async updateBoard(tenantId: string, id: string, input: UpdateBoard, userRole: string): Promise<Board> {
    this.requireAdmin(userRole);

    const board = await this.boardRepo.update(tenantId, id, input);

    if (!board) {
      throw new NotFoundError('Board not found');
    }

    return board;
  }

  /**
   * Delete a board and its columns. Admin+ only.
   */
  async deleteBoard(tenantId: string, id: string, userRole: string): Promise<void> {
    this.requireAdmin(userRole);

    // Delete all columns first
    const columns = await this.columnRepo.findByBoard(tenantId, id);

    for (const column of columns) {
      await this.columnRepo.delete(tenantId, column.id);
    }

    const deleted = await this.boardRepo.delete(tenantId, id);

    if (!deleted) {
      throw new NotFoundError('Board not found');
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireAdmin(role: string): void {
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can perform this action');
    }
  }
}
