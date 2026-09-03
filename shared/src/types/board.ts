import type { BoardTask } from './task.js';

/** Board column — maps statuses to a visual column */
export interface BoardColumn {
  /** Unique column identifier (UUID v4) */
  id: string;
  /** Status IDs displayed in this column */
  statusIds: string[];
  /** Position/order within the board */
  position: number;
}

/**
 * The project's single board (workflow/view configuration).
 * A project owns EXACTLY one board and the board is identified by its
 * `projectId` — there is no separate board id, no per-board name/type, and no
 * board CRUD: the board is created with the project and deleted with it.
 * Sprint scoping is a URL query filter (`?sprintId=`) on the frontend, never
 * a property of the board.
 */
export interface BoardConfig {
  /** Owning project ID (unique — the board's natural identifier) */
  projectId: string;
  /** Ordered workflow columns; each groups one or more statuses */
  columns: BoardColumn[];
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Update-board request body type (columns/workflow only) */
export interface UpdateBoardColumns {
  columns: { id?: string; statusIds: string[]; position: number }[];
}

/**
 * One board column page (`GET …/tasks/board`).
 *
 * `tasks` holds at most `BOARD_PAGE_SIZE` cards; `hasMore` is server state
 * derived from the internal `BOARD_PAGE_SIZE + 1` probe (never from the local
 * array length). `nextCursor` is the opaque resume key built from the last
 * returned card — `null` when there is nothing more to load.
 */
export interface BoardColumnPage {
  tasks: BoardTask[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Board pagination response — keyed by board column id. */
export type BoardPage = Record<string, BoardColumnPage>;
