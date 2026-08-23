import type { BoardType } from '../constants/roles.js';

/** Board column — maps statuses to a visual column */
export interface BoardColumn {
  /** Unique column identifier (UUID v4) */
  id: string;
  /** Status IDs displayed in this column */
  statusIds: string[];
  /** Position/order within the board */
  position: number;
}

/** Board entity type */
export interface Board {
  /** Unique board identifier (UUID v4) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Board name */
  name: string;
  /** Board type (KANBAN or SPRINT) */
  type: BoardType;
  /** Embedded columns */
  columns: BoardColumn[];
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create board request body type */
export interface CreateBoard {
  name: string;
  type: BoardType;
  columns: { statusIds: string[]; position: number }[];
}

/** Update board request body type */
export interface UpdateBoard {
  name?: string;
  columns?: { id?: string; statusIds: string[]; position: number }[];
}
