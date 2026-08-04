/** User entity type */
export interface User {
  /** Unique user identifier (UUID v4) */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  displayName: string;
  /** Account creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Create user request body type */
export interface CreateUser {
  email: string;
  password: string;
  displayName: string;
}
