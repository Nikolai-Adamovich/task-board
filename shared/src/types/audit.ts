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
  /**
   * R3-P7 (additive): human-readable label for `oldValue` when it references
   * another entity (status name, member display name, sprint name, …).
   * Absent when the raw value is already human-readable or could not be resolved.
   */
  oldLabel?: string | null;
  /** R3-P7 (additive): human-readable label for `newValue` — see {@link oldLabel} */
  newLabel?: string | null;
  /**
   * R3-P7 (additive): original raw value preserved when the UI prefers to render
   * labels. Only set when at least one label was resolved for this change.
   */
  rawOldValue?: unknown;
  /** R3-P7 (additive): see {@link rawOldValue} */
  rawNewValue?: unknown;
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
  /**
   * R3-P7 (additive): human-readable entity reference resolved server-side per page
   * (e.g. `PROJ-123` for tasks, sprint/status/label names). Null when unresolvable.
   */
  entityLabel?: string | null;
}
