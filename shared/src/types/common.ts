/** Describes a single theme entry in the generated manifest. */
export interface ThemeManifestItem {
  /** Unique theme identifier derived from the CSS filename (e.g., "light", "dark", "light1"). */
  id: string;
  /** Human-readable display name (e.g., "Light", "Dark", "Light1"). */
  name: string;
  /** Whether the theme is a light or dark variant. */
  mode: 'light' | 'dark';
  /** CSS filename relative to the themes directory (e.g., "light-theme.css"). */
  css: string;
  /** Preview colors extracted from the theme's CSS custom properties. */
  preview: {
    primary: string;
    muted: string;
    foreground: string;
    card: string;
    border: string;
  };
}

/** User preferences type */
export interface UserPreferences {
  userId: string;
  zoom: number;
  /** Theme identifier string (e.g., "light", "dark"). */
  theme: string;
  language: string;
  /** Default page size for paginated tables. */
  pageSize: number;
  updatedAt: string;
}

/** Update user preferences request body type */
export interface UpdateUserPreferences {
  zoom?: number;
  /** Theme identifier string (e.g., "light", "dark"). */
  theme?: string;
  language?: string;
  /** Default page size for paginated tables. */
  pageSize?: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Pagination query parameters */
export interface PaginationParams {
  /** 1-based page number */
  page: number;
  /** Number of items per page (1-100) */
  limit: number;
  /** Sort field and direction (e.g., "createdAt:desc") */
  sort: string;
}

/** All error codes from the technical specification §14.3 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'TASK_VERSION_CONFLICT'
  | 'DUPLICATE_PROJECT_KEY'
  | 'DUPLICATE_LABEL'
  | 'DUPLICATE_STATUS'
  | 'INVALID_STATUS_REPLACEMENT'
  | 'INVALID_SPRINT_DATES'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_ALREADY_ACCEPTED'
  | 'PROJECT_ARCHIVED'
  | 'TENANT_ARCHIVED'
  | 'PROJECT_KEY_IMMUTABLE'
  | 'TASK_TYPE_IN_USE'
  | 'STATUS_IN_USE';

/** Standard error response returned by API endpoints on failure */
export interface ErrorResponse {
  error: {
    /** Machine-readable error code (e.g., "VALIDATION_ERROR", "NOT_FOUND") */
    code: ErrorCode | string;
    /** Human-readable error message */
    message: string;
    /** Optional additional error details (field-level validation errors, etc.) */
    details?: Record<string, unknown>;
  };
}

/** Support request body type */
export interface SupportRequest {
  name: string;
  email: string;
  message: string;
}
