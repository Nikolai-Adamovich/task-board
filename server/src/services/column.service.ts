import type { Column, CreateColumn } from '@task-board/shared';
import { ForbiddenError, NotFoundError } from '../middleware/error-handler.js';
import { ColumnRepository } from '../repositories/column.repository.js';

// ─── Column Service ──────────────────────────────────────────────────────────

export class ColumnService {
  constructor(private readonly columnRepo: ColumnRepository) {}

  /**
   * List all columns for a board, sorted by position.
   */
  async listColumns(tenantId: string, boardId: string): Promise<Column[]> {
    return this.columnRepo.findByBoard(tenantId, boardId);
  }

  /**
   * Create a new column in a board. Admin+ only.
   * If no position is specified, the column is appended at the end.
   */
  async createColumn(tenantId: string, boardId: string, input: CreateColumn, userRole: string): Promise<Column> {
    this.requireAdmin(userRole);

    // Determine position: use provided or append at end
    let position = input.position;

    if (position === undefined) {
      const existing = await this.columnRepo.findByBoard(tenantId, boardId);

      position = existing.length;
    }

    return this.columnRepo.create(tenantId, {
      boardId,
      name: input.name,
      position,
    });
  }

  /**
   * Update a column. Admin+ only.
   */
  async updateColumn(
    tenantId: string,
    id: string,
    input: { name?: string; position?: number },
    userRole: string,
  ): Promise<Column> {
    this.requireAdmin(userRole);

    const column = await this.columnRepo.update(tenantId, id, input);

    if (!column) {
      throw new NotFoundError('Column not found');
    }

    return column;
  }

  /**
   * Delete a column. Admin+ only. Cannot delete default columns.
   */
  async deleteColumn(tenantId: string, id: string, userRole: string): Promise<void> {
    this.requireAdmin(userRole);

    const column = await this.columnRepo.findById(tenantId, id);

    if (!column) {
      throw new NotFoundError('Column not found');
    }

    if (column.isDefault) {
      throw new ForbiddenError('Cannot delete a default column');
    }

    await this.columnRepo.delete(tenantId, id);
  }

  /**
   * Reorder columns within a board. Admin+ only.
   */
  async reorderColumns(tenantId: string, boardId: string, columnIds: string[], userRole: string): Promise<Column[]> {
    this.requireAdmin(userRole);

    await this.columnRepo.reorder(tenantId, boardId, columnIds);
    return this.columnRepo.findByBoard(tenantId, boardId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireAdmin(role: string): void {
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('Only owner or admin can perform this action');
    }
  }
}
