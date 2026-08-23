import type { AuditAction, AuditEntityType } from '../constants/roles.js';

/** Audit actor — who performed the action */
export interface AuditActor {
  /** User ID of the actor (null if user was deleted) */
  userId: string | null;
  /** Display name at time of action */
  displayName: string;
}

/** Single field change in an audit event */
export interface AuditChange {
  /** Field name that changed */
  field: string;
  /** Previous value (null for creates) */
  oldValue: unknown;
  /** New value (null for deletes) */
  newValue: unknown;
}

/** Audit event entity type */
export interface AuditEvent {
  /** Unique audit event identifier (UUID v4) */
  id: string;
  /** Tenant ID */
  tenantId: string;
  /** Project ID (null for tenant-level audit events) */
  projectId: string | null;
  /** Type of entity that was affected */
  entityType: AuditEntityType;
  /** ID of the entity that was affected */
  entityId: string;
  /** Action performed */
  action: AuditAction;
  /** Actor who performed the action */
  actor: AuditActor;
  /** List of changes made */
  changes: AuditChange[];
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}
