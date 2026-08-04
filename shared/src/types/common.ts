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
  updatedAt: string;
}

/** Update user preferences request body type */
export interface UpdateUserPreferences {
  zoom?: number;
  /** Theme identifier string (e.g., "light", "dark"). */
  theme?: string;
  language?: string;
}

/** Standard error response returned by API endpoints on failure */
export interface ErrorResponse {
  /** Machine-readable error code (e.g., "VALIDATION_ERROR", "NOT_FOUND") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional additional error details (field-level validation errors, etc.) */
  details?: unknown;
}

/** Pagination query parameters */
export interface Pagination {
  /** 1-based page number */
  page: number;
  /** Number of items per page (1-100) */
  limit: number;
}

/** Common list query parameters combining pagination with search */
export interface ListQuery {
  page: number;
  limit: number;
  /** Optional search/filter string */
  search?: string;
}

/** Support request body type */
export interface SupportRequest {
  name: string;
  email: string;
  message: string;
}
