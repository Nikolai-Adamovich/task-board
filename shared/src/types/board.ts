/** Board entity type */
export interface Board {
  /** Unique board identifier (UUID v4) */
  id: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Parent project ID */
  projectId: string;
  /** Board name */
  name: string;
  /** Optional board description */
  description?: string | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create board request body type */
export interface CreateBoard {
  name: string;
  description?: string;
  /** Custom column names for the board (optional — defaults are used otherwise) */
  columnNames?: string[];
}

/** Update board request body type */
export interface UpdateBoard {
  name?: string;
  description?: string;
}

/** Column entity type */
export interface Column {
  /** Unique column identifier (UUID v4) */
  id: string;
  /** Parent board ID */
  boardId: string;
  /** Owning tenant ID */
  tenantId: string;
  /** Column display name */
  name: string;
  /** Position/order of the column within the board (0-based) */
  position: number;
  /** Whether this is a default column (cannot be deleted) */
  isDefault: boolean;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}

/** Create column request body type */
export interface CreateColumn {
  name: string;
  /** Position/order within the board. If omitted, column is appended at the end. */
  position?: number;
}
