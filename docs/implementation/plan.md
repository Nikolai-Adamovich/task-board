# Implementation Plan — Task Board

**Status:** Ready for execution  
**Date:** 2026-08-21  
**Based on:** `technical_specification.md`, `architecture.md`, `project-management-requirements.md`,
`project-management-user-flows.md`  
**Principle:** Skeleton first (models, auth, RBAC, empty board/sprint), then features, then polish. Each task is
implementable in one developer pass with clear done criteria.

---

## Summary

**Total tasks:** 42  
**Phases:** 7  
**Plan path:** `docs/implementation/plan.md`

---

## Phase 0: Cleanup

Remove or verify obsolete code not covered by the architecture's "keep" assessment. This phase ensures a clean baseline
before modifications begin.

### Task 0.1: Audit and Remove Obsolete Files

- **Goal:** Identify and remove any files, imports, or dead code that are not referenced by the architecture's
  keep/modify/rebuild assessment. Verify no orphaned modules exist.
- **Affected files/modules:** Entire monorepo scan — `shared/`, `server/`, `ui/`
- **Acceptance criteria:**
  - No unused files remain in `shared/src/`, `server/src/`, `ui/src/`
  - No dead imports or unused exports in barrel files (`shared/src/index.ts`, `server/src/routes/index.ts`)
  - All existing test files compile without errors
- **Dependencies:** None

### Task 0.2: Verify Build Baseline

- **Goal:** Ensure the entire monorepo builds cleanly (shared → server → ui) before any modifications.
- **Affected files/modules:** `shared/package.json`, `server/package.json`, `ui/package.json`, root `package.json`
- **Acceptance criteria:**
  - `npm run build` succeeds in `shared/`
  - `npm run build` (or `tsc --noEmit`) succeeds in `server/`
  - `npm run build` succeeds in `ui/`
  - All existing tests pass: `npm test` in `server/`, `npm test` in `ui/`
- **Dependencies:** Task 0.1

---

## Phase 1: Shared Types — Update `@task-board/shared` to Match Spec

Update the shared types and constants package to be the single source of truth matching the technical specification
exactly.

### Task 1.1: Add Missing Error Codes to Shared Types

- **Goal:** Add `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`, `STATUS_IN_USE` error code types to the shared package so
  both server and UI can reference them.
- **Affected files/modules:** [`shared/src/types/common.ts`](shared/src/types/common.ts)
- **Acceptance criteria:**
  - `ErrorResponse.code` type or a new `ErrorCode` union type includes all spec error codes from §14.3: `UNAUTHORIZED`,
    `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `TASK_VERSION_CONFLICT`, `DUPLICATE_PROJECT_KEY`,
    `DUPLICATE_LABEL`, `DUPLICATE_STATUS`, `INVALID_STATUS_REPLACEMENT`, `INVALID_SPRINT_DATES`, `INVITATION_EXPIRED`,
    `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `PROJECT_ARCHIVED`, `TENANT_ARCHIVED`, `PROJECT_KEY_IMMUTABLE`,
    `TASK_TYPE_IN_USE`, `STATUS_IN_USE`
  - Shared package builds without errors
- **Dependencies:** Task 0.2

### Task 1.2: Verify and Align All Shared Entity Types with Spec

- **Goal:** Audit every shared type file against the spec's domain model (§4) and API contracts (§5). Ensure field
  names, types, optionality, and nullability match exactly.
- **Affected files/modules:**
  - [`shared/src/types/user.ts`](shared/src/types/user.ts)
  - [`shared/src/types/tenant.ts`](shared/src/types/tenant.ts)
  - [`shared/src/types/project.ts`](shared/src/types/project.ts)
  - [`shared/src/types/task.ts`](shared/src/types/task.ts)
  - [`shared/src/types/sprint.ts`](shared/src/types/sprint.ts)
  - [`shared/src/types/board.ts`](shared/src/types/board.ts)
  - [`shared/src/types/status.ts`](shared/src/types/status.ts)
  - [`shared/src/types/task-type.ts`](shared/src/types/task-type.ts)
  - [`shared/src/types/label.ts`](shared/src/types/label.ts)
  - [`shared/src/types/comment.ts`](shared/src/types/comment.ts)
  - [`shared/src/types/task-relationship.ts`](shared/src/types/task-relationship.ts)
  - [`shared/src/types/filter.ts`](shared/src/types/filter.ts)
  - [`shared/src/types/audit.ts`](shared/src/types/audit.ts)
  - [`shared/src/types/user-preference.ts`](shared/src/types/user-preference.ts)
  - [`shared/src/types/auth.ts`](shared/src/types/auth.ts)
  - [`shared/src/constants/roles.ts`](shared/src/constants/roles.ts)
- **Acceptance criteria:**
  - Every field in the spec's domain model has a corresponding TypeScript interface member
  - `IdentitySnapshot` type exists with `{ displayName: string }`
  - `ArchiveReason` constant includes `TENANT_ARCHIVE` and `PROJECT_ARCHIVE`
  - All request/response types for API contracts (§5) are present
  - `shared/` builds without errors
- **Dependencies:** Task 1.1

### Task 1.3: Verify Shared Constants Match Spec

- **Goal:** Ensure all constant enums in `shared/src/constants/roles.ts` match the spec's values exactly.
- **Affected files/modules:** [`shared/src/constants/roles.ts`](shared/src/constants/roles.ts)
- **Acceptance criteria:**
  - `TenantRole`: `OWNER`, `ADMIN`, `MEMBER`
  - `ProjectRole`: `PROJECT_ADMIN`, `EDITOR`, `VIEWER`
  - `TaskPriority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - `SprintStatus`: `FUTURE`, `ACTIVE`, `COMPLETED`
  - `MemberStatus`: `ACTIVE`, `ACCESS_REVOKED`
  - `InvitationStatus`: `PENDING`, `EXPIRED`, `DECLINED`, `REVOKED`
  - `BoardType`: `KANBAN`, `SPRINT`
  - `TaskRelationshipType`: `BLOCKS`, `RELATES_TO`, `DUPLICATES`
  - `TenantStatus`: `ACTIVE`, `ARCHIVED`, `DELETION_PENDING`
  - `ProjectStatus`: `ACTIVE`, `ARCHIVED`, `DELETION_PENDING`
  - `AuditEntityType`: all 9 entity types from spec §13.3
  - `AuditAction`: `CREATED`, `UPDATED`, `DELETED`
- **Dependencies:** Task 1.2

---

## Phase 2: Server Foundation — Error Model, RBAC, Validation Updates

Update the server's foundational layers to match the spec's error model, RBAC enforcement, and validation rules.

### Task 2.1: Add Missing Error Codes to Server Error Model

- **Goal:** Add `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`, `STATUS_IN_USE` to the server's `ErrorCode` type and create
  convenience subclasses or factory methods.
- **Affected files/modules:** [`server/src/errors/app-error.ts`](server/src/errors/app-error.ts)
- **Acceptance criteria:**
  - `ErrorCode` union includes `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`, `STATUS_IN_USE`
  - `ConflictError` constructor's `code` parameter type includes the new codes
  - Existing tests in `server/src/middleware/error-handler.test.ts` still pass
  - New unit tests verify each new error code produces the correct HTTP status and JSON structure
- **Dependencies:** Task 1.1

### Task 2.2: Update Error Interceptor to Cover All Spec Error Codes

- **Goal:** Add all spec error codes to the frontend error interceptor's `ERROR_CODE_MESSAGES` map.
- **Affected files/modules:**
  [`ui/src/app/interceptors/error.interceptor.ts`](ui/src/app/interceptors/error.interceptor.ts)
- **Acceptance criteria:**
  - `ERROR_CODE_MESSAGES` includes entries for: `DUPLICATE_PROJECT_KEY`, `DUPLICATE_LABEL`, `DUPLICATE_STATUS`,
    `INVALID_STATUS_REPLACEMENT`, `INVALID_SPRINT_DATES`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`,
    `INVITATION_ALREADY_ACCEPTED`, `PROJECT_ARCHIVED`, `TENANT_ARCHIVED`, `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`,
    `STATUS_IN_USE`
  - Each maps to a Transloco translation key
  - Existing interceptor tests pass
- **Dependencies:** Task 2.1

### Task 2.3: Verify RBAC Permission Matrix Against Spec

- **Goal:** Audit the `RbacService` permission matrix against the spec's authorization matrix (§6). Ensure every
  operation has the correct permission action and role mapping.
- **Affected files/modules:** [`server/src/services/rbac.service.ts`](server/src/services/rbac.service.ts)
- **Acceptance criteria:**
  - Every row in spec §6.1 (Tenant Operations) maps to a `tenantPermissions` entry
  - Every row in spec §6.2 (Project Operations) maps to a `projectPermissions` entry
  - Every row in spec §6.3 (Task Operations) maps to a `projectPermissions` entry
  - Tenant Owner/Admin bypass project-level restrictions (already implemented — verify)
  - `delete_comment` permission allows `PROJECT_ADMIN` to delete any comment (spec §4.15)
  - Existing RBAC tests pass
- **Dependencies:** Task 0.2

### Task 2.4: Add `requirePermission()` to Routes Missing RBAC Enforcement

- **Goal:** Audit all route modules and add `requirePermission()` middleware where routes currently only use
  `requireRole()` or have no RBAC check at all.
- **Affected files/modules:**
  - [`server/src/routes/tasks.ts`](server/src/routes/tasks.ts)
  - [`server/src/routes/sprints.ts`](server/src/routes/sprints.ts)
  - [`server/src/routes/boards.ts`](server/src/routes/boards.ts)
  - [`server/src/routes/statuses.ts`](server/src/routes/statuses.ts)
  - [`server/src/routes/task-types.ts`](server/src/routes/task-types.ts)
  - [`server/src/routes/labels.ts`](server/src/routes/labels.ts)
  - [`server/src/routes/comments.ts`](server/src/routes/comments.ts)
  - [`server/src/routes/task-relationships.ts`](server/src/routes/task-relationships.ts)
  - [`server/src/routes/filters.ts`](server/src/routes/filters.ts)
  - [`server/src/routes/audit.ts`](server/src/routes/audit.ts)
  - [`server/src/routes/projects.ts`](server/src/routes/projects.ts)
  - [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts)
  - [`server/src/routes/invitations.ts`](server/src/routes/invitations.ts)
- **Acceptance criteria:**
  - Every route handler has the correct `requirePermission(action, true)` middleware
  - Permission mapping matches spec §6 authorization matrix
  - Viewer cannot create/edit/delete tasks (403 returned)
  - Editor cannot delete tasks (403 returned)
  - Project Admin can manage all project resources
  - Existing route tests pass
- **Dependencies:** Task 2.3

### Task 2.5: Verify and Update Zod Schemas for Spec Compliance

- **Goal:** Audit all Zod schemas against the spec's validation rules (§8). Add missing schemas, fix validation
  constraints.
- **Affected files/modules:**
  - [`server/src/schemas/status.ts`](server/src/schemas/status.ts) — verify `DeleteStatusSchema` exists with
    `replacementStatusId`
  - [`server/src/schemas/task-type.ts`](server/src/schemas/task-type.ts) — verify `DeleteTaskTypeSchema` exists with
    `replacementTypeId`
  - [`server/src/schemas/project.ts`](server/src/schemas/project.ts) — verify `projectKey` validator (2-10 chars, starts
    with letter, A-Z + 0-9)
  - [`server/src/schemas/task.ts`](server/src/schemas/task.ts) — verify `title` max 255, `description` max 10000,
    `version` required on update
  - [`server/src/schemas/sprint.ts`](server/src/schemas/sprint.ts) — verify date validation
  - [`server/src/schemas/comment.ts`](server/src/schemas/comment.ts) — verify body max 10000
  - [`server/src/schemas/tenant.ts`](server/src/schemas/tenant.ts) — verify `SendInvitationSchema` exists
  - [`server/src/schemas/filter.ts`](server/src/schemas/filter.ts) — verify filter criteria schema
  - [`server/src/schemas/audit.ts`](server/src/schemas/audit.ts) — verify query schema
- **Acceptance criteria:**
  - All validation rules from spec §8.1 are enforced in Zod schemas
  - `DeleteStatusSchema` has `replacementStatusId` (optional UUID)
  - `DeleteTaskTypeSchema` has `replacementTypeId` (optional UUID)
  - `CreateProjectSchema` validates key format
  - `UpdateTaskSchema` requires `version` field
  - All schemas compile and existing tests pass
- **Dependencies:** Task 1.2

---

## Phase 3: Server Entities — Backend-First Entity Updates

For each entity, update repository → service → route to match the spec. Focus on missing business logic, audit side
effects, and cascade behaviors.

### Task 3.1: Task Repository — Add Missing Query Methods

- **Goal:** Add repository methods required by other services for cross-entity operations.
- **Affected files/modules:** [`server/src/repositories/task.repository.ts`](server/src/repositories/task.repository.ts)
- **Acceptance criteria:**
  - `countByStatus(projectId, statusId)` — returns count of tasks with given status
  - `updateManyByStatus(projectId, oldStatusId, newStatusId)` — bulk updates status references
  - `countByType(projectId, typeId)` — returns count of tasks with given type
  - `updateManyByType(projectId, oldTypeId, newTypeId)` — bulk updates type references
  - `clearSprintFromTasks(projectId, sprintId)` — sets `sprintId = null` for all tasks in sprint
  - `search()` method covers task number format (e.g., `PROJ-123`) in addition to title/description/snapshots
  - All existing task repository tests pass
  - New unit tests for each new method
- **Dependencies:** Task 0.2

### Task 3.2: Board Repository — Add Status Column Replacement Method

- **Goal:** Add a method to replace status references within board columns when a status is deleted with replacement.
- **Affected files/modules:**
  [`server/src/repositories/board.repository.ts`](server/src/repositories/board.repository.ts)
- **Acceptance criteria:**
  - `replaceStatusInColumns(projectId, oldStatusId, newStatusId)` — updates all board columns in the project that
    reference the old status ID to use the new status ID
  - Handles the case where the new status ID already exists in the column (no duplicates)
  - Unit tests verify correct behavior
- **Dependencies:** Task 0.2

### Task 3.3: Task Service — Add Audit Side Effects

- **Goal:** Add audit logging to `createTask()`, `updateTask()`, and `deleteTask()` methods.
- **Affected files/modules:** [`server/src/services/task.service.ts`](server/src/services/task.service.ts)
- **Acceptance criteria:**
  - `createTask()` calls `auditService.log()` with `entityType: 'TASK'`, `action: 'CREATED'`
  - `updateTask()` calls `auditService.log()` with `entityType: 'TASK'`, `action: 'UPDATED'`, including changed fields
    in `changes` array
  - `deleteTask()` calls `auditService.log()` with `entityType: 'TASK'`, `action: 'DELETED'` **before** the hard delete
  - `TaskService` constructor accepts an `AuditService` dependency (or audit log interface)
  - Existing task service tests pass (may need mock audit service)
- **Dependencies:** Tasks 2.1, 3.1

### Task 3.4: Sprint Service — Add Audit Side Effects and Date Auto-Fill

- **Goal:** Add audit logging and verify date auto-fill behavior matches spec §7.4.
- **Affected files/modules:** [`server/src/services/sprint.service.ts`](server/src/services/sprint.service.ts)
- **Acceptance criteria:**
  - `createSprint()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateSprint()` calls `auditService.log()` with `action: 'UPDATED'`, including status/date changes
  - `deleteSprint()` calls `auditService.log()` with `action: 'DELETED'` before deletion
  - Starting a sprint (`FUTURE → ACTIVE`): if no `endDate`, set `endDate = now` (spec §16.2 says "If no endDate exists
    when starting: endDate = now")
  - Completing a sprint (`ACTIVE → COMPLETED`): if no `endDate`, set `endDate = now`
  - Date constraint: `endDate >= startDate` when both exist
  - Existing sprint service tests pass
- **Dependencies:** Task 2.1

### Task 3.5: Comment Service — Add Audit Side Effects and Admin Delete-Any

- **Goal:** Add audit logging and implement Project Admin delete-any-comment authorization.
- **Affected files/modules:** [`server/src/services/comment.service.ts`](server/src/services/comment.service.ts)
- **Acceptance criteria:**
  - `createComment()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateComment()` calls `auditService.log()` with `action: 'UPDATED'`
  - `deleteComment()` calls `auditService.log()` with `action: 'DELETED'`
  - `deleteComment()` authorization: comment author can delete own comment; Project Admin (and above via tenant bypass)
    can delete any comment
  - `updateComment()` authorization: comment author can edit own comment; Project Admin can edit any comment
  - Current implementation uses tenant role (`OWNER`/`ADMIN`) — update to use project role (`PROJECT_ADMIN`) for the
    admin override
  - `CommentService` constructor accepts `AuditService` dependency and project role context
  - Existing comment service tests pass
- **Dependencies:** Tasks 2.1, 2.3

### Task 3.6: Project Service — Add Audit Side Effects, Key Immutability Check, and Cascade Delete

- **Goal:** Add audit logging, enforce project key immutability after first task, and implement full cascade on
  permanent deletion.
- **Affected files/modules:** [`server/src/services/project.service.ts`](server/src/services/project.service.ts)
- **Acceptance criteria:**
  - `createProject()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateProject()` calls `auditService.log()` with `action: 'UPDATED'`
  - `deleteProject()` (soft delete to DELETION_PENDING) calls `auditService.log()` with `action: 'DELETED'`
  - `updateProject()` rejects key changes with `PROJECT_KEY_IMMUTABLE` error if tasks exist for the project
  - `permanentDelete()` cascades to: Tasks, Comments, Sprints, Boards, Labels, Statuses, Task Types, Relationships,
    Project Memberships, Preferences, Filters, Project-specific audit records
  - Existing project service tests pass
- **Dependencies:** Tasks 2.1, 3.1

### Task 3.7: Status Service — Use Correct Error Code and Add Audit

- **Goal:** Fix error code from `INVALID_STATUS_REPLACEMENT` to `STATUS_IN_USE` when status is in use, and add audit
  side effects.
- **Affected files/modules:** [`server/src/services/status.service.ts`](server/src/services/status.service.ts)
- **Acceptance criteria:**
  - `deleteStatus()` throws `STATUS_IN_USE` (not `INVALID_STATUS_REPLACEMENT`) when tasks use the status and no
    replacement is provided
  - `createStatus()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateStatus()` calls `auditService.log()` with `action: 'UPDATED'`
  - `deleteStatus()` calls `auditService.log()` with `action: 'DELETED'`
  - Replacement logic correctly updates both tasks AND board columns
  - Existing status service tests pass
- **Dependencies:** Tasks 2.1, 3.1, 3.2

### Task 3.8: Task Type Service — Use Correct Error Code and Add Audit

- **Goal:** Fix error code from `INVALID_STATUS_REPLACEMENT` to `TASK_TYPE_IN_USE` when task type is in use, and add
  audit side effects.
- **Affected files/modules:** [`server/src/services/task-type.service.ts`](server/src/services/task-type.service.ts)
- **Acceptance criteria:**
  - `deleteTaskType()` throws `TASK_TYPE_IN_USE` (not `INVALID_STATUS_REPLACEMENT`) when tasks use the type and no
    replacement is provided
  - `createTaskType()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateTaskType()` calls `auditService.log()` with `action: 'UPDATED'`
  - `deleteTaskType()` calls `auditService.log()` with `action: 'DELETED'`
  - Existing task type service tests pass
- **Dependencies:** Task 2.1

### Task 3.9: Label Service — Add Audit Side Effects

- **Goal:** Add audit logging to label CRUD operations.
- **Affected files/modules:** [`server/src/services/label.service.ts`](server/src/services/label.service.ts)
- **Acceptance criteria:**
  - `createLabel()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateLabel()` calls `auditService.log()` with `action: 'UPDATED'`
  - `deleteLabel()` calls `auditService.log()` with `action: 'DELETED'`
  - Label deletion removes all task-label associations
  - Case-insensitive uniqueness enforced via `normalizedName`
- **Dependencies:** Task 2.1

### Task 3.10: Board Service — Add Audit Side Effects

- **Goal:** Add audit logging to board CRUD operations.
- **Affected files/modules:** [`server/src/services/board.service.ts`](server/src/services/board.service.ts)
- **Acceptance criteria:**
  - `createBoard()` calls `auditService.log()` with `action: 'CREATED'`
  - `updateBoard()` calls `auditService.log()` with `action: 'UPDATED'`
  - `deleteBoard()` calls `auditService.log()` with `action: 'DELETED'`
  - Board deletion does NOT affect tasks
- **Dependencies:** Task 2.1

### Task 3.11: Task Relationship Service — Add Audit Side Effects

- **Goal:** Add audit logging to task relationship create/delete operations.
- **Affected files/modules:**
  [`server/src/services/task-relationship.service.ts`](server/src/services/task-relationship.service.ts)
- **Acceptance criteria:**
  - `create()` calls `auditService.log()` with `action: 'CREATED'`
  - `delete()` calls `auditService.log()` with `action: 'DELETED'`
  - Both tasks must belong to the same project (enforced in service)
- **Dependencies:** Task 2.1

### Task 3.12: Tenant Service — Verify Archive/Restore Cascade

- **Goal:** Verify and fix tenant archive/restore cascade to respect `archiveReason`.
- **Affected files/modules:** [`server/src/services/tenant.service.ts`](server/src/services/tenant.service.ts)
- **Acceptance criteria:**
  - Archiving a tenant sets all its projects to `ARCHIVED` with `archiveReason = TENANT_ARCHIVE`
  - Projects already archived before the tenant archive retain their original `archiveReason` and are NOT modified
  - Restoring a tenant restores ONLY projects with `archiveReason = TENANT_ARCHIVE`
  - Projects independently archived (with `archiveReason = PROJECT_ARCHIVE`) remain archived
  - Tenant deletion sets `DELETION_PENDING` with grace period
  - Audit side effects for tenant CRUD operations
  - Existing tenant service tests pass
- **Dependencies:** Task 2.1

### Task 3.13: Status Route — Use DeleteStatusSchema in Request Body

- **Goal:** Update the status DELETE route to accept `replacementStatusId` from the request body (via
  `validateBody(DeleteStatusSchema)`) instead of query parameter.
- **Affected files/modules:** [`server/src/routes/statuses.ts`](server/src/routes/statuses.ts)
- **Acceptance criteria:**
  - `DELETE /statuses/:statusId` uses `validateBody(DeleteStatusSchema)` middleware
  - `replacementStatusId` is read from validated body, not query params
  - Returns 204 No Content on success
  - Existing status route tests pass
- **Dependencies:** Tasks 2.5, 3.7

### Task 3.14: Task Type Route — Use DeleteTaskTypeSchema in Request Body

- **Goal:** Update the task type DELETE route to accept `replacementTypeId` from the request body.
- **Affected files/modules:** [`server/src/routes/task-types.ts`](server/src/routes/task-types.ts)
- **Acceptance criteria:**
  - `DELETE /task-types/:taskTypeId` uses `validateBody(DeleteTaskTypeSchema)` middleware
  - `replacementTypeId` is read from validated body
  - Returns 204 No Content on success
  - Existing task type route tests pass
- **Dependencies:** Tasks 2.5, 3.8

### Task 3.15: Server Integration Tests — Audit Coverage

- **Goal:** Write integration tests verifying audit events are created for all auditable entity operations.
- **Affected files/modules:** New test files or additions to existing service test files
- **Acceptance criteria:**
  - Test that creating a task produces an audit event with `action: 'CREATED'`
  - Test that updating a task produces an audit event with `action: 'UPDATED'` and correct `changes`
  - Test that deleting a task produces an audit event with `action: 'DELETED'` before deletion
  - Similar tests for: Project, Sprint, Status, Board, Label, Task Type, Comment, Task Relationship
  - All tests pass
- **Dependencies:** Tasks 3.3 through 3.11

### Task 3.16: Server Integration Tests — Status/TaskType Deletion with Replacement

- **Goal:** Write integration tests for the status and task type deletion-with-replacement flows.
- **Affected files/modules:**
  [`server/src/services/status.service.test.ts`](server/src/services/status.service.test.ts),
  [`server/src/services/task-type.service.test.ts`](server/src/services/task-type.service.test.ts)
- **Acceptance criteria:**
  - Deleting a status in use without replacement returns `STATUS_IN_USE` error
  - Deleting a status in use with replacement updates all affected tasks and board columns
  - Deleting a task type in use without replacement returns `TASK_TYPE_IN_USE` error
  - Deleting a task type in use with replacement updates all affected tasks
  - Deleting a status not in use by tasks but used by boards succeeds (board columns become invalid)
  - All tests pass
- **Dependencies:** Tasks 3.7, 3.8

---

## Phase 4: Frontend Foundation — Guards, Interceptors, Stores, Services

Update the Angular frontend's foundational layers to support all spec features.

### Task 4.1: Update Error Interceptor with All Spec Error Codes

- **Goal:** Ensure the error interceptor handles all spec error codes with user-friendly Transloco messages.
- **Affected files/modules:**
  - [`ui/src/app/interceptors/error.interceptor.ts`](ui/src/app/interceptors/error.interceptor.ts)
  - [`ui/public/assets/i18n/en.json`](ui/public/assets/i18n/en.json) (and other language files)
- **Acceptance criteria:**
  - `ERROR_CODE_MESSAGES` map includes all 18 spec error codes
  - Each error code maps to a Transloco key that exists in `en.json`
  - `PROJECT_ARCHIVED` and `TENANT_ARCHIVED` show appropriate read-only messages
  - `TASK_VERSION_CONFLICT` shows conflict resolution message
  - Existing interceptor tests pass
- **Dependencies:** Task 2.2

### Task 4.2: Verify Guards — Auth, Tenant, Project

- **Goal:** Verify all three guards work correctly for the spec's navigation model.
- **Affected files/modules:**
  - [`ui/src/app/guards/auth.guard.ts`](ui/src/app/guards/auth.guard.ts)
  - [`ui/src/app/guards/tenant.guard.ts`](ui/src/app/guards/tenant.guard.ts)
  - [`ui/src/app/guards/project.guard.ts`](ui/src/app/guards/project.guard.ts)
- **Acceptance criteria:**
  - `authGuard`: redirects unauthenticated users to `/auth/login` with return URL
  - `tenantGuard`: loads tenants, resolves active tenant from URL param, handles no-tenant → onboarding
  - `projectGuard`: loads project context, resolves project role, handles archived/deleted projects
  - All guard tests pass
- **Dependencies:** Task 0.2

### Task 4.3: Verify HTTP Client Services Match API Contracts

- **Goal:** Audit all HTTP client services against the spec's API contracts (§5). Ensure correct paths, methods,
  request/response types.
- **Affected files/modules:**
  - [`ui/src/app/services/auth-client.ts`](ui/src/app/services/auth-client.ts)
  - [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts)
  - [`ui/src/app/services/project-client.ts`](ui/src/app/services/project-client.ts)
  - [`ui/src/app/services/task-client.ts`](ui/src/app/services/task-client.ts)
  - [`ui/src/app/services/sprint-client.ts`](ui/src/app/services/sprint-client.ts)
  - [`ui/src/app/services/board-client.ts`](ui/src/app/services/board-client.ts)
  - [`ui/src/app/services/status-client.ts`](ui/src/app/services/status-client.ts)
  - [`ui/src/app/services/task-type-client.ts`](ui/src/app/services/task-type-client.ts)
  - [`ui/src/app/services/label-client.ts`](ui/src/app/services/label-client.ts)
  - [`ui/src/app/services/comment-client.ts`](ui/src/app/services/comment-client.ts)
  - [`ui/src/app/services/task-relationship-client.ts`](ui/src/app/services/task-relationship-client.ts)
  - [`ui/src/app/services/filter-client.ts`](ui/src/app/services/filter-client.ts)
  - [`ui/src/app/services/audit-client.ts`](ui/src/app/services/audit-client.ts)
  - [`ui/src/app/services/user-preferences-client.ts`](ui/src/app/services/user-preferences-client.ts)
- **Acceptance criteria:**
  - Every API endpoint from spec §5 has a corresponding client method
  - HTTP methods match (GET, POST, PATCH, DELETE, PUT)
  - Request body types match spec contracts
  - Response types match spec contracts
  - Status DELETE sends `replacementStatusId` in request body
  - Task Type DELETE sends `replacementTypeId` in request body
- **Dependencies:** Task 2.5

### Task 4.4: Verify and Update Stores — Auth, Tenant, Preferences

- **Goal:** Verify signal-based stores provide all state needed by the spec's screens.
- **Affected files/modules:**
  - [`ui/src/app/stores/auth-store.ts`](ui/src/app/stores/auth-store.ts)
  - [`ui/src/app/stores/tenant-store.ts`](ui/src/app/stores/tenant-store.ts)
  - `ui/src/app/stores/preferences-store.ts`
- **Acceptance criteria:**
  - `AuthStore` exposes: `currentUser`, `token`, `tenantId`, `tenantRole`, `isAuthenticated`, `needsWorkspace`
  - `TenantStore` exposes: `tenants`, `activeTenant`
  - `PreferencesStore` exposes: theme, language, zoom
  - Login redirects based on tenant count (no tenant → onboarding, one → dashboard, multiple → selector)
  - Logout clears all state
  - Store tests pass
- **Dependencies:** Task 0.2

### Task 4.5: Add Transloco Translation Keys for All Error Codes and UI States

- **Goal:** Ensure all error codes, empty states, loading states, and special states have Transloco translation keys.
- **Affected files/modules:**
  - [`ui/public/assets/i18n/en.json`](ui/public/assets/i18n/en.json)
  - Other language files in [`ui/public/assets/i18n/`](ui/public/assets/i18n/)
- **Acceptance criteria:**
  - All 18 error codes have translation keys under `errors.*`
  - All empty state messages from spec §17.1 have keys
  - All special state messages from spec §17.4 have keys (archived, deletion pending, invalid board reference)
  - `en.json` is complete; other language files get placeholder English keys
- **Dependencies:** Task 4.1

---

## Phase 5: Frontend Screens — Implement and Verify Each Screen

Verify and update each screen from the spec's screen inventory (§15.1) and user flows document.

### Task 5.1: Landing Page and Auth Screens

- **Goal:** Verify Landing Page, Login, Register, and Accept Invitation screens match spec behavior.
- **Affected files/modules:**
  - [`ui/src/app/features/dashboard/landing-page/`](ui/src/app/features/dashboard/landing-page/)
  - [`ui/src/app/features/auth/login/`](ui/src/app/features/auth/login/)
  - [`ui/src/app/features/auth/register/`](ui/src/app/features/auth/register/)
  - [`ui/src/app/features/auth/accept-invitation/`](ui/src/app/features/auth/accept-invitation/)
- **Acceptance criteria:**
  - Landing page: Sign Up and Log In buttons, no auth context required
  - Login: email, password, forgot password link, register link; redirects based on tenant count
  - Register: email, password, confirm password, display name; client + server validation; does NOT auto-create tenant
  - Accept Invitation: validates token, handles expired/revoked/declined states, supports login or register flow
  - All screens handle loading, error, and empty states
  - Existing tests pass
- **Dependencies:** Tasks 4.1, 4.4

### Task 5.2: Onboarding — Create Workspace Screen

- **Goal:** Verify the Create Workspace onboarding flow matches spec §3 and user flows §3.
- **Affected files/modules:**
  [`ui/src/app/features/tenants/create-workspace/`](ui/src/app/features/tenants/create-workspace/)
- **Acceptance criteria:**
  - Workspace name field
  - Mock plan selection (Free, $0)
  - Mock checkout step (no real payment data)
  - Confirmation step
  - Result: tenant created, user becomes Owner, tenant dashboard opens
  - Existing tests pass
- **Dependencies:** Task 5.1

### Task 5.3: Dashboard — Tenant Dashboard and Project List

- **Goal:** Verify dashboard screens show correct content based on user state and role.
- **Affected files/modules:**
  - [`ui/src/app/features/dashboard/`](ui/src/app/features/dashboard/)
  - [`ui/src/app/features/dashboard/owner-dashboard/`](ui/src/app/features/dashboard/owner-dashboard/)
  - [`ui/src/app/features/dashboard/member-dashboard/`](ui/src/app/features/dashboard/member-dashboard/)
  - [`ui/src/app/features/dashboard/welcome-view/`](ui/src/app/features/dashboard/welcome-view/)
  - [`ui/src/app/features/dashboard/invitation-view/`](ui/src/app/features/dashboard/invitation-view/)
  - [`ui/src/app/features/projects/project-list/`](ui/src/app/features/projects/project-list/)
  - [`ui/src/app/features/tenants/workspace-detail/`](ui/src/app/features/tenants/workspace-detail/)
- **Acceptance criteria:**
  - No tenant → welcome/onboarding view
  - Has tenant → owner dashboard or member dashboard based on role
  - Project list shows "No projects yet. Create your first project." empty state
  - Create Project button visible for Owner/Admin only
  - Tenant name, Members link, Settings link, Plan/Billing link visible
  - Existing tests pass
- **Dependencies:** Task 5.2

### Task 5.4: Project Overview Screen

- **Goal:** Verify Project Overview shows project name/key, description, active sprint, task summary, recent tasks,
  members, and shortcuts.
- **Affected files/modules:**
  [`ui/src/app/features/projects/project-detail/`](ui/src/app/features/projects/project-detail/)
- **Acceptance criteria:**
  - Displays project name and key
  - Shows description
  - Shows active sprint (if any)
  - Shows task summary (counts by status)
  - Shows recent tasks
  - Shows member count
  - Shortcuts to Board and Tasks
  - Archived project shows `ARCHIVED` badge and disables write controls
  - Existing tests pass
- **Dependencies:** Task 5.3

### Task 5.5: Board View Screen

- **Goal:** Verify Board View supports drag-and-drop, multi-status columns, board selector, and sprint filter.
- **Affected files/modules:**
  - [`ui/src/app/features/boards/board-view/`](ui/src/app/features/boards/board-view/)
  - [`ui/src/app/features/boards/task-card/`](ui/src/app/features/boards/task-card/)
- **Acceptance criteria:**
  - Single board displayed at a time
  - Columns render tasks grouped by status
  - Board selector dropdown (user preference, per-project)
  - Sprint filter for Sprint Boards (shows only tasks for selected sprint)
  - Drag-and-drop task movement between columns
  - Multi-status column drop: prompts user to select target status
  - Invalid board column references (deleted status without replacement) are hidden in board view
  - Viewer role: no drag-and-drop (read-only)
  - Existing tests pass
- **Dependencies:** Tasks 4.3, 5.4

### Task 5.6: Task Table Screen

- **Goal:** Verify Task Table supports search, filter, sort, pagination, and URL-addressable state.
- **Affected files/modules:** [`ui/src/app/features/tasks/task-table/`](ui/src/app/features/tasks/task-table/)
- **Acceptance criteria:**
  - Columns: Key, Title, Type, Status, Priority, Assignee, Reporter, Sprint, Labels, Created, Updated
  - Search bar with free-text search
  - Filter controls: status, priority, type, assignee, reporter, sprint, label
  - Sort controls with supported fields
  - Pagination with page/limit selector
  - URL-addressable state (page, limit, sort, filters in query params)
  - Invalid page handling: moves to nearest valid page
  - Empty state: "No tasks found. Create a task or change your filters."
  - Loading state: spinner/skeleton (not "No tasks" while loading)
  - Viewer role: no create/edit controls
  - Existing tests pass
- **Dependencies:** Tasks 4.3, 5.4

### Task 5.7: Task Detail Screen

- **Goal:** Verify Task Detail supports Jira-style inline editing, Milkdown description editor, relationships, comments,
  and audit history.
- **Affected files/modules:**
  - [`ui/src/app/features/tasks/task-detail/`](ui/src/app/features/tasks/task-detail/)
  - [`ui/src/app/features/tasks/task-relationships/`](ui/src/app/features/tasks/task-relationships/)
  - [`ui/src/app/features/comments/comment-thread/`](ui/src/app/features/comments/comment-thread/)
  - [`ui/src/app/shared/milkdown-editor/`](ui/src/app/shared/milkdown-editor/)
- **Acceptance criteria:**
  - Task key displayed (e.g., PROJ-123)
  - Title editable inline
  - Type selector (dropdown of project task types)
  - Status selector
  - Priority selector
  - Assignee selector (project members)
  - Reporter (read-only after creation, shows snapshot if user deleted)
  - Sprint selector
  - Label selector (autocomplete/tag, case-insensitive reuse)
  - Description: Milkdown WYSIWYG editor, saves Markdown
  - Relationships section: create/delete BLOCKS, RELATES_TO, DUPLICATES
  - Comments section: create, edit (own only), delete (own or admin)
  - Audit history section (if user has `view_audit_events` permission)
  - Optimistic concurrency: conflict dialog with reload option, preserves local changes
  - Task deletion: confirmation dialog, cascade deletes comments/relationships
  - Viewer role: all write controls hidden/disabled
  - Existing tests pass
- **Dependencies:** Tasks 4.3, 5.6

### Task 5.8: Sprint List and Sprint Detail Screens

- **Goal:** Verify Sprint screens support create, start, complete, reopen, and delete flows.
- **Affected files/modules:**
  - [`ui/src/app/features/sprints/sprint-list/`](ui/src/app/features/sprints/sprint-list/)
  - [`ui/src/app/features/sprints/sprint-detail/`](ui/src/app/features/sprints/sprint-detail/)
  - [`ui/src/app/features/sprints/sprint-backlog/`](ui/src/app/features/sprints/sprint-backlog/)
- **Acceptance criteria:**
  - Sprint list grouped by: Future, Active, Completed
  - Create Sprint button (Project Admin+ only)
  - Start/Complete/Reopen actions per sprint (Project Admin+ only)
  - Sprint detail shows sprint name, status, dates, and associated tasks
  - Sprint Board shows only tasks for the selected sprint
  - Date validation: `endDate >= startDate`
  - Empty state: "No sprints yet. Create a future sprint to start planning."
  - Sprint deletion: confirmation, tasks moved to backlog (`sprintId = null`)
  - Existing tests pass
- **Dependencies:** Tasks 4.3, 5.4

### Task 5.9: Project Members Screen

- **Goal:** Verify Project Members screen supports add, role change, remove, and restore.
- **Affected files/modules:**
  [`ui/src/app/features/projects/project-member-list/`](ui/src/app/features/projects/project-member-list/)
- **Acceptance criteria:**
  - Displays: User, Email, Role, Access status
  - Add member button (Project Admin+ only)
  - Role change controls (Project Admin+ only)
  - Remove/Restore access controls (Project Admin+ only)
  - Empty state: "No additional members yet. Invite someone to collaborate."
  - Removing a member does NOT delete their tasks/comments
  - Existing tests pass
- **Dependencies:** Task 4.3

### Task 5.10: Tenant Settings and Tenant Members Screens

- **Goal:** Verify Tenant Settings and Tenant Members screens match spec.
- **Affected files/modules:**
  - [`ui/src/app/features/tenants/tenant-settings/`](ui/src/app/features/tenants/tenant-settings/)
  - [`ui/src/app/features/tenants/tenant-member-list/`](ui/src/app/features/tenants/tenant-member-list/)
- **Acceptance criteria:**
  - Tenant Settings: General, Members, Invitations, Projects, Plan/Billing, Danger Zone sections
  - Tenant Members: User, Email, Role, Access status, Invitation status
  - Invite button (Owner/Admin only)
  - Role change controls (Owner/Admin only)
  - Remove/Restore access controls (Owner/Admin only)
  - Invitation management: send, re-send, revoke
  - Tenant archive/restore (Owner only)
  - Tenant deletion (Owner only, with confirmation)
  - Existing tests pass
- **Dependencies:** Task 4.3

### Task 5.11: Status Manager, Task Type Manager, Label Manager Screens

- **Goal:** Verify project settings screens for Status, Task Type, and Label management.
- **Affected files/modules:**
  - [`ui/src/app/features/statuses/status-manager/`](ui/src/app/features/statuses/status-manager/)
  - [`ui/src/app/features/task-types/task-type-manager/`](ui/src/app/features/task-types/task-type-manager/)
  - [`ui/src/app/features/labels/label-manager/`](ui/src/app/features/labels/label-manager/)
- **Acceptance criteria:**
  - Status Manager: create, rename, reorder, delete with replacement flow
    - Delete UX: shows usage count, mandatory replacement when in use by tasks
    - Shows affected boards when not used by tasks but used by boards
    - Offers "Replace" or "Delete Anyway" for board-only usage
  - Task Type Manager: create, rename (key immutable), delete with replacement flow
    - Delete UX: shows usage count, mandatory replacement when in use
  - Label Manager: create, rename, delete (removes task-label associations)
  - All managers: Project Admin+ only (write controls hidden for Editor/Viewer)
  - Existing tests pass
- **Dependencies:** Tasks 4.3, 5.4

### Task 5.12: Audit Log Screen

- **Goal:** Verify Audit Log viewer shows project and tenant audit events.
- **Affected files/modules:**
  [`ui/src/app/features/audit/audit-log-viewer/`](ui/src/app/features/audit/audit-log-viewer/)
- **Acceptance criteria:**
  - Displays audit events with: timestamp, actor, entity type, entity ID, action, changes
  - Pagination support
  - Filter by entity type
  - Actor display name preserved even if user deleted
  - Project Admin+ only (or Tenant Admin+ for tenant-level audit)
  - Empty state: "No activity recorded yet."
  - Existing tests pass
- **Dependencies:** Task 4.3

### Task 5.13: Filter Panel and Saved Filters

- **Goal:** Verify Filter Panel supports saved filter CRUD and restores query state.
- **Affected files/modules:** [`ui/src/app/features/filters/filter-panel/`](ui/src/app/features/filters/filter-panel/)
- **Acceptance criteria:**
  - Save current filter configuration with a name
  - List saved filters for current project
  - Open a saved filter restores its complete query state (all criteria + sort)
  - Edit/Delete saved filters
  - Filters are user/project-specific
  - Empty state: "No saved filters. Save a filter for quick access."
  - All roles can manage their own filters (Viewer included)
  - Existing tests pass
- **Dependencies:** Task 5.6

### Task 5.14: User Settings Screen

- **Goal:** Verify User Settings screen supports theme, language, and zoom preferences.
- **Affected files/modules:** [`ui/src/app/features/settings/`](ui/src/app/features/settings/)
- **Acceptance criteria:**
  - Theme selector (light, dark, etc.)
  - Language selector (11 languages)
  - Zoom control
  - Changes persist via `PATCH /api/preferences`
  - Existing tests pass
- **Dependencies:** Task 4.4

### Task 5.15: Shell Components — AppShell, Header, Sidebar, Tenant Switcher

- **Goal:** Verify shell components provide correct navigation, context switching, and role-based visibility.
- **Affected files/modules:**
  - [`ui/src/app/shell/app-shell/`](ui/src/app/shell/app-shell/)
  - [`ui/src/app/shell/header/`](ui/src/app/shell/header/)
  - [`ui/src/app/shell/sidebar/`](ui/src/app/shell/sidebar/)
  - [`ui/src/app/shell/tenant-switcher/`](ui/src/app/shell/tenant-switcher/)
- **Acceptance criteria:**
  - Global navigation: Tenant Switcher → Project Switcher → Current Feature
  - Tenant switching: keeps user authenticated, loads selected tenant, clears incompatible project context
  - Project switching: loads project context, permissions, boards, sprints, etc.
  - Sidebar shows project navigation: Overview, Board, Tasks, Sprints, Members, Settings
  - Settings submenu: General, Members, Task Types, Statuses, Labels, Boards, Danger Zone
  - Header shows: branding, search, language switcher, help menu, user menu
  - Role-based visibility: Viewer sees no admin links, Editor sees no project settings
  - Existing tests pass
- **Dependencies:** Tasks 4.4, 5.3

### Task 5.16: Help Screens — FAQ, Docs, Support

- **Goal:** Verify help screens are accessible and functional.
- **Affected files/modules:**
  - [`ui/src/app/features/help/faq/`](ui/src/app/features/help/faq/)
  - [`ui/src/app/features/help/docs/`](ui/src/app/features/help/docs/)
  - [`ui/src/app/features/help/support/`](ui/src/app/features/help/support/)
- **Acceptance criteria:**
  - FAQ page renders content
  - Docs page renders content
  - Support page has contact form (name, email, message)
  - All pages are publicly accessible or accessible to authenticated users
- **Dependencies:** None

---

## Phase 6: Integration — End-to-End Flow Verification

Verify that all user journeys from the spec work end-to-end.

### Task 6.1: E2E — First User Journey (Register → Onboarding → Create Project → Create Task)

- **Goal:** Write Playwright E2E test covering the complete first-user journey from spec §16.1.
- **Affected files/modules:** [`ui/e2e/`](ui/e2e/) (new or updated test file)
- **Acceptance criteria:**
  - Register new user
  - Redirect to onboarding (no tenant)
  - Create workspace with mock checkout
  - Tenant created, user is Owner
  - Create project with name and key
  - Project auto-initialized (task types, statuses, board)
  - Create first task with default TODO status
  - Task appears in task list and board
- **Dependencies:** All Phase 5 tasks

### Task 6.2: E2E — Invitation Flow (Send → Accept → Access)

- **Goal:** Write Playwright E2E test covering the invitation journey from spec §16.2.
- **Affected files/modules:** [`ui/e2e/`](ui/e2e/)
- **Acceptance criteria:**
  - Admin sends invitation with email and role
  - Invitation appears as PENDING in member list
  - Collaborator opens invitation link
  - Collaborator registers or logs in
  - Invitation accepted, membership becomes ACTIVE
  - Collaborator can access the tenant/project
- **Dependencies:** All Phase 5 tasks

### Task 6.3: E2E — Task Editing and Concurrency Conflict

- **Goal:** Write Playwright E2E test covering Jira-style inline editing and optimistic concurrency conflict handling.
- **Affected files/modules:** [`ui/e2e/task.spec.ts`](ui/e2e/task.spec.ts)
- **Acceptance criteria:**
  - Open task detail
  - Edit title inline → save → verify update
  - Edit status → save → verify update
  - Edit description via Milkdown → save → verify Markdown round-trip
  - Simulate concurrency conflict → verify conflict dialog appears
  - Reload preserves latest version
- **Dependencies:** All Phase 5 tasks

### Task 6.4: E2E — Sprint Workflow (Create → Start → Complete → Reopen)

- **Goal:** Write Playwright E2E test covering the sprint workflow from spec §16.5.
- **Affected files/modules:** [`ui/e2e/sprint.spec.ts`](ui/e2e/sprint.spec.ts)
- **Acceptance criteria:**
  - Create future sprint (no dates)
  - Start sprint → verify startDate set, status = ACTIVE
  - Complete sprint → verify endDate set, status = COMPLETED
  - Reopen sprint → verify status = ACTIVE, dates preserved
  - Sprint board shows only tasks for selected sprint
- **Dependencies:** All Phase 5 tasks

### Task 6.5: E2E — Status Deletion with Replacement

- **Goal:** Write Playwright E2E test covering status deletion UX from spec §16.8.
- **Affected files/modules:** [`ui/e2e/`](ui/e2e/) (new test file)
- **Acceptance criteria:**
  - Delete status in use by tasks → replacement mandatory
  - Select replacement → verify tasks and board columns updated
  - Delete status not in use by tasks but used by boards → show affected boards
  - Delete without replacement → verify board column becomes invalid (red in editor, hidden in view)
- **Dependencies:** All Phase 5 tasks

### Task 6.6: E2E — Project Archive/Restore and Delete

- **Goal:** Write Playwright E2E test covering project lifecycle from spec §16.9 and §16.10.
- **Affected files/modules:** [`ui/e2e/project.spec.ts`](ui/e2e/project.spec.ts)
- **Acceptance criteria:**
  - Archive project → verify read-only state, ARCHIVED badge
  - Restore project → verify active state
  - Delete project → verify DELETION_PENDING, grace period, confirmation flow
  - Cancel deletion → verify project restored to ACTIVE
- **Dependencies:** All Phase 5 tasks

### Task 6.7: E2E — Role-Based UI Visibility

- **Goal:** Write Playwright E2E test verifying role-based UI behavior from spec §15.4.
- **Affected files/modules:** [`ui/e2e/`](ui/e2e/) (new test file)
- **Acceptance criteria:**
  - Viewer: all write controls hidden/disabled, can read/search/filter
  - Editor: can create/edit tasks, comment, manage own comments; no admin controls
  - Project Admin: full project administration visible
  - Tenant Admin: all project admin + tenant settings
  - Owner: all tenant admin + tenant deletion
- **Dependencies:** All Phase 5 tasks

### Task 6.8: E2E — Board Drag-and-Drop with Multi-Status Columns

- **Goal:** Write Playwright E2E test covering board task movement from spec §16.11.
- **Affected files/modules:** [`ui/e2e/board.spec.ts`](ui/e2e/board.spec.ts)
- **Acceptance criteria:**
  - Drag task from single-status column to single-status column → status updates directly
  - Drag task to multi-status column (e.g., TODO+REOPENED) → status selection prompt appears
  - Select status → task moves and status updates
  - Board reflects the change
- **Dependencies:** All Phase 5 tasks

---

## Task Dependency Graph

```
Phase 0: 0.1 → 0.2
Phase 1: 0.2 → 1.1 → 1.2 → 1.3
Phase 2: 1.1 → 2.1 → 2.2
         0.2 → 2.3 → 2.4
         1.2 → 2.5
Phase 3: 0.2 → 3.1, 3.2
         2.1 + 3.1 → 3.3
         2.1 → 3.4, 3.5, 3.9, 3.10, 3.11, 3.12
         2.1 + 3.1 + 3.2 → 3.7
         2.1 → 3.8
         2.1 + 3.1 → 3.6
         2.5 + 3.7 → 3.13
         2.5 + 3.8 → 3.14
         3.3-3.11 → 3.15
         3.7 + 3.8 → 3.16
Phase 4: 2.2 → 4.1 → 4.5
         0.2 → 4.2, 4.4
         2.5 → 4.3
Phase 5: 4.1 + 4.4 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5, 5.6, 5.8, 5.9, 5.10, 5.11, 5.12, 5.15
         5.6 → 5.7, 5.13
         4.4 → 5.14
Phase 6: All Phase 5 → 6.1 through 6.8
```

---

## Entity Coverage Matrix

| Entity             | Shared Type | Repository | Service |  Route  | Zod Schema |  Audit  |     Frontend Screen     |
| ------------------ | :---------: | :--------: | :-----: | :-----: | :--------: | :-----: | :---------------------: |
| User               |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   |    ✅ (auth screens)    |
| Tenant             |     ✅      |     ✅     | ✅ 3.12 |   ✅    |     ✅     |   ✅    |  ✅ (tenant settings)   |
| Tenant Membership  |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   |   ✅ (tenant members)   |
| Invitation         |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   | ✅ (accept-invitation)  |
| Project            |     ✅      |     ✅     | ✅ 3.6  |   ✅    |   ✅ 2.5   | ✅ 3.6  |   ✅ (project detail)   |
| Project Membership |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   |  ✅ (project members)   |
| Task               |     ✅      |   ✅ 3.1   | ✅ 3.3  |   ✅    |     ✅     | ✅ 3.3  | ✅ (task table/detail)  |
| Sprint             |     ✅      |     ✅     | ✅ 3.4  |   ✅    |     ✅     | ✅ 3.4  | ✅ (sprint list/detail) |
| Board              |     ✅      |   ✅ 3.2   | ✅ 3.10 |   ✅    |     ✅     | ✅ 3.10 |     ✅ (board view)     |
| Status             |     ✅      |     ✅     | ✅ 3.7  | ✅ 3.13 |     ✅     | ✅ 3.7  |   ✅ (status manager)   |
| Task Type          |     ✅      |     ✅     | ✅ 3.8  | ✅ 3.14 |     ✅     | ✅ 3.8  | ✅ (task type manager)  |
| Label              |     ✅      |     ✅     | ✅ 3.9  |   ✅    |     ✅     | ✅ 3.9  |   ✅ (label manager)    |
| Comment            |     ✅      |     ✅     | ✅ 3.5  |   ✅    |     ✅     | ✅ 3.5  |   ✅ (comment thread)   |
| Task Relationship  |     ✅      |     ✅     | ✅ 3.11 |   ✅    |     ✅     | ✅ 3.11 | ✅ (task relationships) |
| Filter             |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   |    ✅ (filter panel)    |
| User Preferences   |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   |      ✅ (settings)      |
| Audit Event        |     ✅      |     ✅     |   ✅    |   ✅    |     ✅     |   N/A   |     ✅ (audit log)      |
| Counter            |     ✅      |     ✅     |   ✅    |   N/A   |    N/A     |   N/A   |     N/A (internal)      |

---

## Screen Coverage Matrix

| Screen            | Route                                                        | Task |
| ----------------- | ------------------------------------------------------------ | ---- |
| Landing Page      | `/`                                                          | 5.1  |
| Login             | `/auth/login`                                                | 5.1  |
| Register          | `/auth/register`                                             | 5.1  |
| Accept Invitation | `/auth/accept-invitation`                                    | 5.1  |
| Dashboard         | `/`                                                          | 5.3  |
| Create Workspace  | `/workspace/create`                                          | 5.2  |
| Workspace Detail  | `/tenants/:tenantId`                                         | 5.3  |
| Tenant Settings   | `/tenants/:tenantId/settings`                                | 5.10 |
| Tenant Members    | `/tenants/:tenantId/settings/members`                        | 5.10 |
| Project List      | `/tenants/:tenantId/projects`                                | 5.3  |
| Project Detail    | `/tenants/:tenantId/projects/:projectId`                     | 5.4  |
| Board View        | `/tenants/:tenantId/projects/:projectId/boards/:boardId`     | 5.5  |
| Task Table        | `/tenants/:tenantId/projects/:projectId/tasks`               | 5.6  |
| Task Detail       | `/tenants/:tenantId/projects/:projectId/tasks/:taskId`       | 5.7  |
| Sprint List       | `/tenants/:tenantId/projects/:projectId/sprints`             | 5.8  |
| Sprint Detail     | `/tenants/:tenantId/projects/:projectId/sprints/:sprintId`   | 5.8  |
| Project Members   | `/tenants/:tenantId/projects/:projectId/members`             | 5.9  |
| Status Manager    | `/tenants/:tenantId/projects/:projectId/settings/statuses`   | 5.11 |
| Task Type Manager | `/tenants/:tenantId/projects/:projectId/settings/task-types` | 5.11 |
| Label Manager     | `/tenants/:tenantId/projects/:projectId/settings/labels`     | 5.11 |
| Audit Log         | `/tenants/:tenantId/projects/:projectId/audit`               | 5.12 |
| Filter Panel      | `/tenants/:tenantId/projects/:projectId/filters`             | 5.13 |
| Settings          | `/settings`                                                  | 5.14 |
| FAQ               | `/faq`                                                       | 5.16 |
| Docs              | `/docs`                                                      | 5.16 |
| Support           | `/support`                                                   | 5.16 |
