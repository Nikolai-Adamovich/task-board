# Technical Specification — Task Board

**Status:** Implementation-ready  
**Date:** 2026-08-21  
**Sources of truth:** `project-management-requirements.md`, `project-management-user-flows.md`  
**Supplementary reference:** Classic Jira (old-school Atlassian) — used only where source docs are silent

---

## Table of Contents

1. [Goal and Context](#1-goal-and-context)
2. [Technical Stack](#2-technical-stack)
3. [Users and Roles (RBAC)](#3-users-and-roles-rbac)
4. [Domain Model](#4-domain-model)
5. [API Contracts](#5-api-contracts)
6. [Authorization Matrix](#6-authorization-matrix)
7. [Business Rules](#7-business-rules)
8. [Validation Rules](#8-validation-rules)
9. [Concurrency Model](#9-concurrency-model)
10. [Pagination](#10-pagination)
11. [Seed Data](#11-seed-data)
12. [Search and Filters](#12-search-and-filters)
13. [Audit System](#13-audit-system)
14. [Error Model](#14-error-model)
15. [Frontend Screens](#15-frontend-screens)
16. [User Journeys](#16-user-journeys)
17. [Empty, Loading, and Error States](#17-empty-loading-and-error-states)
18. [Functional Requirements](#18-functional-requirements)
19. [Non-Functional Requirements](#19-non-functional-requirements)
20. [Out of Scope](#20-out-of-scope)
21. [Open Questions and Assumptions](#21-open-questions-and-assumptions)

---

## 1. Goal and Context

Build a multi-tenant project management application with the following hierarchy:

```text
User → Tenant → Project → Tasks, Sprints, Boards, Labels, Statuses, Task Types
```

The system supports:

- Multi-tenant organizations with role-based access control
- Project-level task management with configurable workflows
- Sprint-based planning with Board visualization
- Historical identity preservation after user deletion
- Optimistic concurrency for task mutations
- URL-addressable filter/pagination state

The application must be implementable from this specification alone, though the two source documents remain the
authoritative reference.

---

## 2. Technical Stack

| Layer                   | Technology           | Notes                                                        |
| ----------------------- | -------------------- | ------------------------------------------------------------ |
| Backend framework       | Hono                 | Running on Cloudflare Workers                                |
| Database                | MongoDB              | Document store                                               |
| Backend validation      | Zod                  | Schema-based request validation                              |
| Backend testing         | Vitest               | Unit and integration tests                                   |
| Frontend framework      | Angular 22           | Zoneless (no Zone.js), standalone components                 |
| UI component library    | Spartan UI           | `@spartan-ng/brain` (headless) + `@spartan-ng/helm` (styled) |
| CSS                     | Tailwind CSS v4      | Utility-first styling                                        |
| Task description editor | Milkdown WYSIWYG     | Markdown-based rich text                                     |
| State management        | Signal-based stores  | `@Service()` decorator, `signal()`, `computed()`             |
| i18n                    | Transloco            | 11 languages supported                                       |
| Frontend unit testing   | Vitest               | Via `@angular/build:unit-test` builder                       |
| E2E testing             | Playwright           | Cross-browser end-to-end tests                               |
| Shared types            | `@task-board/shared` | TypeScript types and constants shared between server and UI  |

### Angular 22 Specific Patterns

- **Zoneless change detection**: No `zone.js` polyfill; all reactivity via signals
- **Standalone components**: No NgModules; `imports` array on `@Component`
- **Lazy loading**: `loadComponent()` in route definitions
- **Component input binding**: `withComponentInputBinding()` for route params → component inputs
- **Signal-based stores**: `@Service()` decorator with `signal()`, `computed()`, `effect()`
- **HTTP interceptors**: Functional interceptors via `withInterceptors()`
- **Guards**: Functional guards via `canActivate` array

---

## 3. Users and Roles (RBAC)

### 3.1 Tenant Roles

| Role     | Description                            |
| -------- | -------------------------------------- |
| `OWNER`  | Single tenant owner; highest authority |
| `ADMIN`  | Tenant-level administrator             |
| `MEMBER` | Regular tenant member                  |

### 3.2 Project Roles

| Role            | Description                    |
| --------------- | ------------------------------ |
| `PROJECT_ADMIN` | Full project administration    |
| `EDITOR`        | Edit permitted project content |
| `VIEWER`        | Read-only access               |

### 3.3 Role Hierarchy

```text
Tenant Owner
    ↓
Tenant Admin
    ↓
Project Admin
    ↓
Editor
    ↓
Viewer
```

### 3.4 Implicit Access

Tenant Owner and Tenant Admin retain tenant-level authority **without** requiring an explicit Project Membership record.
They can access all projects within their tenant.

### 3.5 Membership Statuses

| Status           | Meaning                            |
| ---------------- | ---------------------------------- |
| `ACTIVE`         | User has active access             |
| `ACCESS_REVOKED` | Access has been revoked or expired |

### 3.6 Invitation Statuses

| Status     | Meaning                              |
| ---------- | ------------------------------------ |
| `PENDING`  | Invitation sent, awaiting acceptance |
| `EXPIRED`  | Invitation TTL exceeded              |
| `DECLINED` | User declined the invitation         |
| `REVOKED`  | Admin revoked the invitation         |

### 3.7 Invitation Lifecycle

```text
[*] → PENDING → EXPIRED
                → DECLINED
                → REVOKED
                → [*] (accepted: invitation = null, membership.status = ACTIVE)
```

**Expiration**: Derived from `invitedOn + INVITATION_TTL`. No persisted `expiresOn` field. Backend dynamically treats
invitations as expired.

**Re-invitation**: Old invitation is replaced; new token generated; `invitedBy` and `invitedOn` updated; old link
immediately invalid; new email sent.

**Acceptance**: Sets `invitation = null`, `membership.status = ACTIVE`. User must log in or register with the invited
identity.

---

## 4. Domain Model

### 4.1 Entity Relationship Diagram

```text
Tenant
  ├── TenantMemberships (userId, role, status, invitation?)
  └── Projects
        ├── ProjectMemberships (userId, role)
        ├── Tasks
        │     ├── Comments
        │     ├── TaskRelationships
        │     └── Label associations (labelIds[])
        ├── Sprints
        ├── Boards (columns → statusIds[])
        ├── Statuses
        ├── Labels
        └── TaskTypes
```

### 4.2 User

```typescript
{
  _id: ObjectId; // UUID v4
  email: String; // normalized (lowercase), unique index
  displayName: String;
  avatarUrl: String | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null; // soft delete marker
}
```

**Indexes**: `unique: { email: 1 }`

**Email normalization**: `John.Doe@Example.COM` → `john.doe@example.com`

**Deletion**: Sets `deletedAt`. Removes live membership/access. Does NOT delete Tasks, Comments, or historical
snapshots.

### 4.3 Tenant

```typescript
{
  _id: ObjectId;
  name: String;
  description: String | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETION_PENDING';
  deletionScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Status transitions**:

```text
ACTIVE → ARCHIVED → ACTIVE (restore)
ACTIVE → DELETION_PENDING → permanent deletion
DELETION_PENDING → ACTIVE (cancel deletion)
```

**Archive behavior**: Archiving a Tenant automatically archives its Projects with `archiveReason = TENANT_ARCHIVE`.
Projects already archived before the tenant archive retain their original `archiveReason` and are NOT accidentally
restored.

**Restore behavior**: Restoring a Tenant restores only Projects archived due to `TENANT_ARCHIVE`. Projects independently
archived remain archived.

### 4.4 Tenant Membership

```typescript
{
  _id: ObjectId;
  tenantId: ObjectId;
  userId: ObjectId;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: "ACTIVE" | "ACCESS_REVOKED";
  invitation: {
    status: "PENDING" | "EXPIRED" | "DECLINED" | "REVOKED";
    tokenHash: String;
    invitedBy: ObjectId;
    invitedOn: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { tenantId: 1, userId: 1 }`

**Owner constraint**: Exactly one `OWNER` per Tenant. Ownership transfer is an explicit administrative operation.

### 4.5 Project

```typescript
{
  _id: ObjectId;
  tenantId: ObjectId;
  key: String; // 2-10 chars, starts with letter, A-Z + 0-9 only
  name: String;
  description: String | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETION_PENDING';
  defaultStatusId: ObjectId;
  defaultBoardId: ObjectId;
  archiveReason: 'TENANT_ARCHIVE' | 'PROJECT_ARCHIVE' | null;
  deletionScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { tenantId: 1, key: 1 }`

**Key immutability**: Project key becomes immutable after the first Task is created.

**Status transitions**:

```text
ACTIVE → ARCHIVED → ACTIVE (restore)
ACTIVE → DELETION_PENDING → permanent deletion
DELETION_PENDING → ACTIVE (cancel deletion)
```

**Archive**: Makes project read-only. Internal entities do not need independent archive states.

**Permanent deletion cascade**: Tasks, Comments, Sprints, Boards, Labels, Statuses, Task Types, Relationships, Project
Memberships, Preferences, Filters, Project-specific audit records.

### 4.6 Project Membership

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  role: 'PROJECT_ADMIN' | 'EDITOR' | 'VIEWER';
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { projectId: 1, userId: 1 }`

**Removal behavior**: Removes project access. User remains in Tenant. Tasks and Comments are NOT deleted. User can be
re-added later; existing work remains associated.

### 4.7 Task

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  number: Number;              // sequential per project, displayed as PROJ-1, PROJ-2, etc.
  typeId: ObjectId;            // references TaskType
  title: String;               // required, max 255 chars
  description: String | null;  // Markdown, max 10000 chars
  statusId: ObjectId;          // references Status
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reporterId: ObjectId | null;
  reporterSnapshot: { displayName: String } | null;
  assigneeId: ObjectId | null;
  assigneeSnapshot: { displayName: String } | null;
  sprintId: ObjectId | null;   // null = backlog task
  labelIds: [ObjectId];
  createdById: ObjectId | null;
  createdBySnapshot: { displayName: String };
  version: Number;             // optimistic concurrency
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:

```text
{ projectId: 1, number: -1 }
{ projectId: 1, createdAt: -1 }
{ projectId: 1, updatedAt: -1 }
{ projectId: 1, statusId: 1, number: -1 }
{ projectId: 1, sprintId: 1, number: -1 }
{ projectId: 1, assigneeId: 1, number: -1 }
{ projectId: 1, reporterId: 1, number: -1 }
{ projectId: 1, priority: 1, number: -1 }
{ projectId: 1, typeId: 1, number: -1 }
```

**Task number**: Atomic MongoDB counter (`$inc`) per project. Stored as numeric `number`. Displayed as
`{PROJECT_KEY}-{number}`.

**Backlog semantics**: `sprintId = null` means the task is in the backlog. This is NOT a separate entity.

**Deletion**: Hard delete. Cascade-deletes Comments, Task Relationships, and Label associations. Audit event created
before deletion.

### 4.8 Counter

```typescript
{
  _id: String; // counter key (e.g., project ID)
  value: Number; // current sequence value
}
```

Used for atomic task number generation via MongoDB `$inc`.

### 4.9 Task Type

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  key: String; // immutable after creation
  name: String; // editable display name
  icon: String | null;
  position: Number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { projectId: 1, key: 1 }`

**Initial types**: `TASK`, `BUG`, `STORY`

**Key immutability**: The `key` field cannot be changed after creation. The `name` field is editable.

**Deletion with usage**: If a Task Type is in use by Tasks, a replacement Task Type must be specified. All affected
Tasks are updated to the replacement.

### 4.10 Status

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  name: String;
  normalizedName: String; // lowercase, for case-insensitive uniqueness
  position: Number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { projectId: 1, normalizedName: 1 }`

**Initial statuses**: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `REOPENED`, `DONE`

**Case insensitivity**: `In Progress` = `in progress` = `IN PROGRESS`

**Deletion rules**:

1. **Used by Tasks**: Replacement Status is mandatory. All affected Tasks AND Board column references are updated to the
   replacement.
2. **Not used by Tasks, but used by Boards**: Warn user which Boards reference it. Offer replacement or
   deletion-without-replacement. If deleted without replacement, the Board column reference becomes invalid (not
   displayed in Board view; shown in red in Board editor).

### 4.11 Board

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  name: String;
  type: "KANBAN" | "SPRINT";
  columns: [
    {
      id: String;          // UUID
      statusIds: [ObjectId];
      position: Number;
    }
  ];
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `{ projectId: 1 }`

**Key rules**:

- A Board belongs to a Project, NOT a Sprint
- A column may contain multiple statuses
- No `isDefault` field; `Project.defaultBoardId` is the source of truth
- Only one Board displayed at a time in the UI
- User's selected Board is a per-user/per-project preference

**Default Board columns**:

```text
Column 1: TODO, REOPENED
Column 2: IN_PROGRESS
Column 3: IN_REVIEW
Column 4: DONE
```

**Invalid references**: If a Status is deleted without replacement, the Board column referencing it is not rendered in
Board view. In Board editor, it shows as a red warning so the admin can repair it.

### 4.12 User Project Board Preference

```typescript
{
  _id: ObjectId;
  userId: ObjectId;
  projectId: ObjectId;
  defaultBoardId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { userId: 1, projectId: 1 }`

Board selection is a user/project preference. Changing one user's selection does NOT affect other users.

### 4.13 Sprint

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  name: String;
  status: 'FUTURE' | 'ACTIVE' | 'COMPLETED';
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:

```text
{ projectId: 1, status: 1 }
{ projectId: 1, startDate: 1 }
```

**Status transitions**: Unrestricted. Any status can transition to any other status, including `COMPLETED → ACTIVE`.

**Date rules**:

| Scenario                          | Behavior                        |
| --------------------------------- | ------------------------------- |
| Future Sprint with no dates       | Allowed                         |
| Start without `startDate`         | `startDate = now`               |
| Start with predefined `startDate` | Preserve predefined date        |
| Start without `endDate`           | `endDate = now`                 |
| Start with predefined `endDate`   | Preserve predefined date        |
| Complete without `endDate`        | `endDate = now`                 |
| Complete with existing `endDate`  | Preserve existing date          |
| Both dates exist                  | `endDate >= startDate` required |
| `endDate` reached                 | Does NOT auto-complete sprint   |

**Deletion**: Does NOT delete Tasks. All affected Tasks have `sprintId` set to `null`. Sprint is then hard-deleted.

### 4.14 Label

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  name: String;
  normalizedName: String; // lowercase, for case-insensitive uniqueness
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { projectId: 1, normalizedName: 1 }`

**Case insensitivity**: `Bug` = `bug` = `BUG`. If `Bug` exists, typing `bug` selects the existing label.

**Creation from Task**: When a label is first created from a Task, it is added to the project's global label list.

**Deletion**: Removes all Task-label associations for that Label.

### 4.15 Comment

```typescript
{
  _id: ObjectId;
  taskId: ObjectId;
  authorId: ObjectId | null;
  authorSnapshot: {
    displayName: String;
  }
  body: String; // Markdown
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `{ taskId: 1, createdAt: 1 }`

**Author deletion**: `authorId = null`, `authorSnapshot.displayName` preserved. UI continues to display historical
author name.

**Authorization**: Viewer cannot create, edit, or delete comments. Editor and above can create comments. Only the
comment author can edit/delete their own comment. Project Admin and above can delete any comment. **[Jira convention:
source docs are silent on admin delete-any-comment; defaulting to Jira behavior where project admins can delete any
comment.]**

### 4.16 Task Relationship

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  sourceTaskId: ObjectId;
  targetTaskId: ObjectId;
  type: 'BLOCKS' | 'RELATES_TO' | 'DUPLICATES';
  createdById: ObjectId;
  createdAt: Date;
}
```

Both Tasks must belong to the same Project. Ordinary external URLs are NOT represented by this entity; they are Markdown
links in the Task description.

### 4.17 Filter (Saved)

```typescript
{
  _id: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  name: String;
  filters: {
    search: String | null;
    statusIds: [ObjectId];
    priority: [String];
    typeIds: [ObjectId];
    assigneeIds: [ObjectId];
    reporterIds: [ObjectId];
    sprintIds: [ObjectId | null]; // null = backlog filter
    labelIds: [ObjectId];
  }
  sort: String; // e.g., "createdAt:desc"
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**: `unique: { userId: 1, projectId: 1, name: 1 }`

Saved filters are user/project-specific. Opening one restores its query state.

### 4.18 Audit Event

```typescript
{
  _id: ObjectId;
  tenantId: ObjectId;
  projectId: ObjectId | null;
  entityType: String;       // TASK, PROJECT, SPRINT, STATUS, BOARD, LABEL, TASK_TYPE, COMMENT, TASK_RELATIONSHIP
  entityId: ObjectId;
  action: String;           // CREATED, UPDATED, DELETED
  actor: {
    userId: ObjectId | null;
    displayName: String;
  };
  changes: [
    {
      field: String;
      oldValue: Mixed;
      newValue: Mixed;
    }
  ];
  createdAt: Date;
}
```

**Indexes**:

```text
{ tenantId: 1, createdAt: -1 }
{ projectId: 1, createdAt: -1 }
{ entityType: 1, entityId: 1, createdAt: -1 }
```

Actor snapshots remain meaningful after User deletion. Permanent Project deletion removes project-specific audit data.

### 4.19 Identity Snapshot

```typescript
{
  displayName: String;
}
```

Used in: `Task.reporterSnapshot`, `Task.assigneeSnapshot`, `Task.createdBySnapshot`, `Comment.authorSnapshot`,
`AuditEvent.actor.displayName`.

Snapshots are NOT updated if the User later changes their name.

---

## 5. API Contracts

### 5.1 Conventions

- **Base path**: `/api`
- **Content type**: `application/json`
- **Authentication**: JWT Bearer token in `Authorization` header
- **Tenant context**: `X-Tenant-Id` header for tenant-scoped operations
- **IDs**: UUID v4 format (not MongoDB ObjectId in API layer)
- **Timestamps**: ISO 8601 format

### 5.2 Authentication

| Method | Path                 | Description       |
| ------ | -------------------- | ----------------- |
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login`    | Login             |
| `GET`  | `/api/auth/me`       | Get current user  |

**Register request**:

```typescript
{
  email: string;
  password: string;
  displayName: string;
}
```

**Login request**:

```typescript
{
  email: string;
  password: string;
}
```

**Auth response**:

```typescript
{
  token: string; // JWT
  user: User;
}
```

### 5.3 Tenants

| Method   | Path                     | Description                      |
| -------- | ------------------------ | -------------------------------- |
| `GET`    | `/api/tenants`           | List tenants for current user    |
| `POST`   | `/api/tenants`           | Create tenant                    |
| `GET`    | `/api/tenants/:tenantId` | Get tenant details               |
| `PATCH`  | `/api/tenants/:tenantId` | Update tenant                    |
| `DELETE` | `/api/tenants/:tenantId` | Delete tenant (DELETION_PENDING) |

**Create request**:

```typescript
{
  name: string;
  description?: string;
}
```

**Update request**:

```typescript
{
  name?: string;
  description?: string;
}
```

### 5.4 Tenant Memberships

| Method   | Path                                       | Description         |
| -------- | ------------------------------------------ | ------------------- |
| `GET`    | `/api/tenants/:tenantId/members`           | List tenant members |
| `PATCH`  | `/api/tenants/:tenantId/members/:memberId` | Update member role  |
| `DELETE` | `/api/tenants/:tenantId/members/:memberId` | Remove member       |

### 5.5 Invitations

| Method   | Path                                               | Description            |
| -------- | -------------------------------------------------- | ---------------------- |
| `POST`   | `/api/tenants/:tenantId/invitations`               | Send invitation        |
| `GET`    | `/api/invitations/:token`                          | Get invitation details |
| `POST`   | `/api/invitations/:token/accept`                   | Accept invitation      |
| `POST`   | `/api/invitations/:token/decline`                  | Decline invitation     |
| `DELETE` | `/api/tenants/:tenantId/invitations/:invitationId` | Revoke invitation      |

**Send invitation request**:

```typescript
{
  email: string;
  role: TenantRole;
}
```

**Accept invitation request**:

```typescript
{
  token: string;
  password?: string;      // if user needs to register
  displayName?: string;   // if user needs to register
}
```

### 5.6 Projects

| Method   | Path                              | Description                       |
| -------- | --------------------------------- | --------------------------------- |
| `GET`    | `/api/tenants/:tenantId/projects` | List projects                     |
| `POST`   | `/api/tenants/:tenantId/projects` | Create project                    |
| `GET`    | `/api/projects/:projectId`        | Get project details               |
| `PATCH`  | `/api/projects/:projectId`        | Update project                    |
| `DELETE` | `/api/projects/:projectId`        | Delete project (DELETION_PENDING) |

**Create request**:

```typescript
{
  key: string;
  name: string;
  description?: string;
}
```

**Update request**:

```typescript
{
  name?: string;
  description?: string;
}
```

### 5.7 Project Memberships

| Method   | Path                                         | Description                |
| -------- | -------------------------------------------- | -------------------------- |
| `GET`    | `/api/projects/:projectId/members`           | List project members       |
| `POST`   | `/api/projects/:projectId/members`           | Add member to project      |
| `PATCH`  | `/api/projects/:projectId/members/:memberId` | Update member role         |
| `DELETE` | `/api/projects/:projectId/members/:memberId` | Remove member from project |

### 5.8 Tasks

| Method   | Path                             | Description                        |
| -------- | -------------------------------- | ---------------------------------- |
| `GET`    | `/api/projects/:projectId/tasks` | List tasks (paginated, filterable) |
| `POST`   | `/api/projects/:projectId/tasks` | Create task                        |
| `GET`    | `/api/tasks/:taskId`             | Get task details                   |
| `PATCH`  | `/api/tasks/:taskId`             | Update task (requires `version`)   |
| `DELETE` | `/api/tasks/:taskId`             | Delete task                        |

**Create request**:

```typescript
{
  typeId: string;
  title: string;
  description?: string;
  statusId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigneeId?: string;
  sprintId?: string;
  labelIds?: string[];
}
```

**Update request** (all fields optional except `version`):

```typescript
{
  title?: string;
  description?: string;
  statusId?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigneeId?: string | null;
  typeId?: string;
  sprintId?: string | null;
  labelIds?: string[];
  version: number;    // required for optimistic concurrency
}
```

**Query parameters**:

```typescript
{
  page?: number;        // default: 1
  limit?: number;       // default: 20, max: 100
  sort?: string;        // e.g., "createdAt:desc"
  search?: string;      // free-text search
  statusId?: string;
  priority?: string;
  typeId?: string;
  assigneeId?: string;
  reporterId?: string;
  sprintId?: string;
  labelId?: string;
}
```

### 5.9 Sprints

| Method   | Path                               | Description                              |
| -------- | ---------------------------------- | ---------------------------------------- |
| `GET`    | `/api/projects/:projectId/sprints` | List sprints                             |
| `POST`   | `/api/projects/:projectId/sprints` | Create sprint                            |
| `PATCH`  | `/api/sprints/:sprintId`           | Update sprint (including status changes) |
| `DELETE` | `/api/sprints/:sprintId`           | Delete sprint                            |

**Create request**:

```typescript
{
  name: string;
  startDate?: string;   // ISO 8601 date
  endDate?: string;     // ISO 8601 date
}
```

**Update request**:

```typescript
{
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: "FUTURE" | "ACTIVE" | "COMPLETED";
}
```

### 5.10 Boards

| Method   | Path                              | Description  |
| -------- | --------------------------------- | ------------ |
| `GET`    | `/api/projects/:projectId/boards` | List boards  |
| `POST`   | `/api/projects/:projectId/boards` | Create board |
| `PATCH`  | `/api/boards/:boardId`            | Update board |
| `DELETE` | `/api/boards/:boardId`            | Delete board |

**Create request**:

```typescript
{
  name: string;
  type: "KANBAN" | "SPRINT";
  columns: { statusIds: string[]; position: number }[];
}
```

**Update request**:

```typescript
{
  name?: string;
  columns?: { id?: string; statusIds: string[]; position: number }[];
}
```

### 5.11 Statuses

| Method   | Path                                | Description   |
| -------- | ----------------------------------- | ------------- |
| `GET`    | `/api/projects/:projectId/statuses` | List statuses |
| `POST`   | `/api/projects/:projectId/statuses` | Create status |
| `PATCH`  | `/api/statuses/:statusId`           | Update status |
| `DELETE` | `/api/statuses/:statusId`           | Delete status |

**Create request**:

```typescript
{
  name: string;
}
```

**Delete request** (when used by Tasks):

```typescript
{
  replacementStatusId: string; // mandatory when status is in use
}
```

### 5.12 Labels

| Method   | Path                              | Description  |
| -------- | --------------------------------- | ------------ |
| `GET`    | `/api/projects/:projectId/labels` | List labels  |
| `POST`   | `/api/projects/:projectId/labels` | Create label |
| `PATCH`  | `/api/labels/:labelId`            | Update label |
| `DELETE` | `/api/labels/:labelId`            | Delete label |

**Create/Update request**:

```typescript
{
  name: string;
}
```

### 5.13 Task Types

| Method   | Path                                  | Description                  |
| -------- | ------------------------------------- | ---------------------------- |
| `GET`    | `/api/projects/:projectId/task-types` | List task types              |
| `POST`   | `/api/projects/:projectId/task-types` | Create task type             |
| `PATCH`  | `/api/task-types/:taskTypeId`         | Update task type (name only) |
| `DELETE` | `/api/task-types/:taskTypeId`         | Delete task type             |

**Create request**:

```typescript
{
  key: string;
  name: string;
  icon?: string;
}
```

**Update request**:

```typescript
{
  name: string; // only name is editable; key is immutable
}
```

### 5.14 Comments

| Method   | Path                          | Description    |
| -------- | ----------------------------- | -------------- |
| `GET`    | `/api/tasks/:taskId/comments` | List comments  |
| `POST`   | `/api/tasks/:taskId/comments` | Create comment |
| `PATCH`  | `/api/comments/:commentId`    | Update comment |
| `DELETE` | `/api/comments/:commentId`    | Delete comment |

**Create/Update request**:

```typescript
{
  body: string; // Markdown
}
```

### 5.15 Task Relationships

| Method   | Path                                      | Description         |
| -------- | ----------------------------------------- | ------------------- |
| `GET`    | `/api/tasks/:taskId/relationships`        | List relationships  |
| `POST`   | `/api/tasks/:taskId/relationships`        | Create relationship |
| `DELETE` | `/api/task-relationships/:relationshipId` | Delete relationship |

**Create request**:

```typescript
{
  targetTaskId: string;
  type: 'BLOCKS' | 'RELATES_TO' | 'DUPLICATES';
}
```

### 5.16 Filters (Saved)

| Method   | Path                               | Description         |
| -------- | ---------------------------------- | ------------------- |
| `GET`    | `/api/projects/:projectId/filters` | List saved filters  |
| `POST`   | `/api/projects/:projectId/filters` | Create saved filter |
| `PATCH`  | `/api/filters/:filterId`           | Update saved filter |
| `DELETE` | `/api/filters/:filterId`           | Delete saved filter |

**Create request**:

```typescript
{
  name: string;
  filters: FilterCriteria;
  sort: FilterSort;
}
```

### 5.17 User Preferences

| Method  | Path               | Description                  |
| ------- | ------------------ | ---------------------------- |
| `GET`   | `/api/preferences` | Get current user preferences |
| `PATCH` | `/api/preferences` | Update preferences           |

**Update request**:

```typescript
{
  zoom?: number;
  theme?: string;
  language?: string;
}
```

### 5.18 User Project Board Preference

| Method | Path                                        | Description                 |
| ------ | ------------------------------------------- | --------------------------- |
| `GET`  | `/api/projects/:projectId/board-preference` | Get user's board preference |
| `PUT`  | `/api/projects/:projectId/board-preference` | Set user's board preference |

**Set request**:

```typescript
{
  defaultBoardId: string;
}
```

### 5.19 Audit

| Method | Path                             | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| `GET`  | `/api/projects/:projectId/audit` | List audit events for project |
| `GET`  | `/api/tenants/:tenantId/audit`   | List audit events for tenant  |

**Query parameters**:

```typescript
{
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
}
```

---

## 6. Authorization Matrix

### 6.1 Tenant Operations

| Operation             | Owner | Tenant Admin | Member |
| --------------------- | :---: | :----------: | :----: |
| Create Tenant         |  ✅   |      ✅      |   ✅   |
| View Tenant           |  ✅   |      ✅      |   ✅   |
| Update Tenant         |  ✅   |      ✅      |   ❌   |
| Delete Tenant         |  ✅   |      ❌      |   ❌   |
| Manage Tenant Members |  ✅   |      ✅      |   ❌   |
| Send Invitations      |  ✅   |      ✅      |   ❌   |
| Revoke Invitations    |  ✅   |      ✅      |   ❌   |
| Change Member Roles   |  ✅   |      ✅      |   ❌   |
| View Audit Log        |  ✅   |      ✅      |   ❌   |

### 6.2 Project Operations

| Operation              | Owner | Tenant Admin | Project Admin | Editor | Viewer |
| ---------------------- | :---: | :----------: | :-----------: | :----: | :----: |
| Create Project         |  ✅   |      ✅      |      ❌       |   ❌   |   ❌   |
| View Project           |  ✅   |      ✅      |      ✅       |   ✅   |   ✅   |
| Update Project         |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Delete Project         |  ✅   |      ✅      |      ❌       |   ❌   |   ❌   |
| Archive Project        |  ✅   |      ✅      |      ❌       |   ❌   |   ❌   |
| Restore Project        |  ✅   |      ✅      |      ❌       |   ❌   |   ❌   |
| Manage Project Members |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Manage Statuses        |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Manage Task Types      |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Manage Boards          |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Manage Labels          |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Create Sprint          |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Change Sprint Status   |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Delete Sprint          |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| View Audit Log         |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |

### 6.3 Task Operations

| Operation            | Owner | Tenant Admin | Project Admin | Editor | Viewer |
| -------------------- | :---: | :----------: | :-----------: | :----: | :----: |
| Create Task          |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| View Tasks           |  ✅   |      ✅      |      ✅       |   ✅   |   ✅   |
| Edit Task            |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| Delete Task          |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Create Comment       |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| Edit Own Comment     |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| Delete Own Comment   |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| Delete Any Comment   |  ✅   |      ✅      |      ✅       |   ❌   |   ❌   |
| Create Relationship  |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| Delete Relationship  |  ✅   |      ✅      |      ✅       |   ✅   |   ❌   |
| Manage Saved Filters |  ✅   |      ✅      |      ✅       |   ✅   |   ✅   |

### 6.4 Implicit Access Rule

Tenant Owner and Tenant Admin have implicit access to all projects within their tenant, regardless of whether they have
an explicit Project Membership record. Their effective project role is at least `PROJECT_ADMIN` for authorization
purposes.

---

## 7. Business Rules

### 7.1 Tenant Lifecycle

1. **Creation**: User becomes Owner. Tenant status is `ACTIVE`.
2. **Archive**: All projects archived with `archiveReason = TENANT_ARCHIVE`. Projects already archived retain their
   original reason.
3. **Restore**: Only projects with `archiveReason = TENANT_ARCHIVE` are restored.
4. **Deletion**: `ACTIVE → DELETION_PENDING → permanent deletion`. Grace period allows cancellation.

### 7.2 Project Lifecycle

1. **Creation**: Automatically seeds Task Types, Statuses, and default Board (see
   [Section 11: Seed Data](#11-seed-data)).
2. **Archive**: Project becomes read-only. Write controls disabled.
3. **Restore**: `ARCHIVED → ACTIVE`.
4. **Deletion**: `ACTIVE → DELETION_PENDING → permanent deletion`. Grace period allows cancellation. Permanent deletion
   cascades to all owned entities.

### 7.3 Task Lifecycle

1. **Creation**: Receives project's `defaultStatusId` by default. User may select another status. Task number is
   atomically assigned.
2. **Editing**: Fields are edited independently (Jira-style). Each UI save changes one field per API call.
3. **Deletion**: Hard delete. Cascade-deletes Comments, Relationships, Label associations. Audit event created before
   deletion.

### 7.4 Sprint Lifecycle

1. **Creation**: Status defaults to `FUTURE`. Dates are optional.
2. **Start**: `FUTURE → ACTIVE`. If no `startDate`, set to `now`. If no `endDate`, set to `now`. Predefined dates are
   preserved.
3. **Complete**: `ACTIVE → COMPLETED`. If no `endDate`, set to `now`. Existing `endDate` preserved.
4. **Reopen**: `COMPLETED → ACTIVE`. Dates preserved.
5. **Deletion**: Tasks have `sprintId` set to `null`. Sprint is hard-deleted.

### 7.5 Invitation Lifecycle

1. **Send**: Creates membership with `invitation.status = PENDING`. Email sent.
2. **Re-send**: Old invitation replaced. New token. Old link invalidated. New email sent.
3. **Accept**: `invitation = null`, `membership.status = ACTIVE`.
4. **Expire**: Derived from `invitedOn + INVITATION_TTL`. Backend dynamically checks.
5. **Revoke**: `invitation.status = REVOKED`.
6. **Decline**: `invitation.status = DECLINED`.

### 7.6 Membership Lifecycle

1. **Active**: User has access.
2. **Revoked**: `membership.status = ACCESS_REVOKED`. If invitation existed, `invitation = null`.
3. **Restored**: `ACCESS_REVOKED → ACTIVE`. Pending invitations cannot be bypassed; user must accept invitation.

### 7.7 User Deletion

1. Removes live membership/access from all Tenants and Projects.
2. Does NOT delete Tasks, Comments, or historical data.
3. Snapshots (`createdBySnapshot`, `reporterSnapshot`, `assigneeSnapshot`, `authorSnapshot`) preserved.
4. Search continues to find historical records by stored display name.

### 7.8 Automatic Behaviors

| Behavior                       | Trigger                 |
| ------------------------------ | ----------------------- |
| Project seed data creation     | Project creation        |
| Default status on new Task     | Task creation           |
| Case-insensitive Label reuse   | Label selection         |
| Missing `startDate` populated  | Sprint start            |
| Missing `endDate` populated    | Sprint start / complete |
| Invitation replacement         | Re-send invitation      |
| Historical snapshots preserved | User deletion           |
| Task `sprintId = null`         | Sprint deletion         |

### 7.9 Explicitly NOT Automatic

| Non-behavior                        | Explanation                  |
| ----------------------------------- | ---------------------------- |
| Sprint auto-completion on `endDate` | Must be explicitly triggered |
| Task deletion on member removal     | Tasks remain                 |
| Task deletion on user deletion      | Tasks remain                 |
| Board change for other users        | Per-user preference          |
| Task deletion on Sprint deletion    | Tasks move to backlog        |
| Task deletion on Board deletion     | Tasks unaffected             |

---

## 8. Validation Rules

### 8.1 Field-Level Validation

| Field            | Rule                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| User email       | Valid email format, normalized to lowercase, unique                               |
| User displayName | Required, non-empty                                                               |
| User password    | Minimum 8 characters **[Jira convention: source docs silent on password policy]** |
| Tenant name      | Required, non-empty                                                               |
| Project key      | 2–10 characters, starts with letter, `[A-Z0-9]` only, unique per tenant           |
| Project name     | Required, non-empty                                                               |
| Task title       | Required, max 255 characters                                                      |
| Task description | Optional, max 10000 characters, Markdown format                                   |
| Task priority    | One of: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                                       |
| Sprint name      | Required, non-empty                                                               |
| Sprint dates     | `endDate >= startDate` when both exist                                            |
| Status name      | Required, non-empty, case-insensitive unique per project                          |
| Label name       | Required, non-empty, case-insensitive unique per project                          |
| Task Type key    | Required, immutable after creation, unique per project                            |
| Task Type name   | Required, non-empty                                                               |
| Board name       | Required, non-empty                                                               |
| Comment body     | Required, non-empty                                                               |
| Filter name      | Required, non-empty, unique per user/project                                      |

### 8.2 Cross-Field Validation

| Rule                                  | Description                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Entity belongs to Project             | Status, Label, Task Type, Sprint, Board referenced by a Task must belong to the same Project |
| Replacement Status belongs to Project | When deleting a Status with replacement                                                      |
| Both tasks same Project               | Task relationships require both tasks in the same Project                                    |
| Sprint date constraint                | `endDate >= startDate` when both dates exist                                                 |
| Project key immutability              | Cannot change key after first Task exists                                                    |
| Optimistic concurrency                | `version` must match stored version                                                          |

### 8.3 Server-Side Enforcement

All validation must be enforced server-side. Client-side validation is a UX convenience, not a security boundary.

---

## 9. Concurrency Model

### 9.1 Optimistic Locking

Tasks use optimistic concurrency via a `version` field.

**Update flow**:

1. Client reads Task with `version: 12`
2. Client sends update with `version: 12`
3. Server checks: stored version == 12?
   - **Yes**: Update succeeds, version becomes 13
   - **No**: Return `TASK_VERSION_CONFLICT` error with `currentVersion`

**Request example**:

```json
{
  "title": "New title",
  "version": 12
}
```

**Conflict response**:

```json
{
  "error": {
    "code": "TASK_VERSION_CONFLICT",
    "message": "The task was modified by another user.",
    "details": {
      "currentVersion": 13
    }
  }
}
```

### 9.2 Multi-Field Patches

For operations where multiple fields can be patched simultaneously, conflict handling should compare the changed fields.
A three-way merge is preferred where practical:

1. Compare client's changed fields against the server's current state
2. If different fields were changed by different users, merge non-conflicting changes
3. If the same field was changed, return conflict

### 9.3 UI Behavior on Conflict

The UI must NOT silently overwrite another user's change. On conflict:

1. Display conflict message: "The task was modified by another user. Reload it and try again."
2. Offer to reload the latest version
3. Preserve the user's local changes for manual merge

---

## 10. Pagination

### 10.1 Request Model

```text
?page=1&limit=30&sort=createdAt:desc
```

| Parameter | Type    | Default | Constraints                                                     |
| --------- | ------- | ------- | --------------------------------------------------------------- |
| `page`    | integer | 1       | ≥ 1                                                             |
| `limit`   | integer | 20      | 1–100                                                           |
| `sort`    | string  | varies  | `field:direction` format (e.g., `createdAt:desc`, `number:asc`) |

### 10.2 Response Model

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 10352,
    "totalPages": 346
  }
}
```

### 10.3 URL State

Pagination state is URL-addressable for bookmarking and sharing:

```text
/projects/PROJ/tasks?page=345&limit=30&sort=createdAt:desc&statusId=abc123
```

### 10.4 Invalid Page Handling

If a requested page becomes invalid because records were deleted, move to the nearest valid page instead of showing a
broken table.

### 10.5 Sort Fields

Supported sort fields for Tasks:

- `number` (default: desc)
- `createdAt`
- `updatedAt`
- `priority`
- `title`
- `statusId`

---

## 11. Seed Data

### 11.1 Project Creation Seed

Creating a Project must execute a logically atomic initialization. Use a MongoDB transaction where the deployment
topology supports transactions.

**Step 1: Create Task Types**

| Key     | Name  | Position |
| ------- | ----- | -------- |
| `TASK`  | Task  | 0        |
| `BUG`   | Bug   | 1        |
| `STORY` | Story | 2        |

**Step 2: Create Statuses**

| Name          | Normalized Name | Position |
| ------------- | --------------- | -------- |
| `TODO`        | `todo`          | 0        |
| `IN_PROGRESS` | `in_progress`   | 1        |
| `IN_REVIEW`   | `in_review`     | 2        |
| `REOPENED`    | `reopened`      | 3        |
| `DONE`        | `done`          | 4        |

**Step 3: Create Default Board**

| Column   | Statuses       | Position |
| -------- | -------------- | -------- |
| Column 1 | TODO, REOPENED | 0        |
| Column 2 | IN_PROGRESS    | 1        |
| Column 3 | IN_REVIEW      | 2        |
| Column 4 | DONE           | 3        |

**Step 4: Set Project References**

```text
Project.defaultStatusId = TODO status ID
Project.defaultBoardId = created default Board ID
```

**Atomicity**: Project creation must not leave a partially initialized Project visible to users.

---

## 12. Search and Filters

### 12.1 Task Search Scope

Free-text search covers:

- Task number (e.g., `PROJ-123`)
- Task title
- Task description
- Historical reporter name (`reporterSnapshot.displayName`)
- Historical assignee name (`assigneeSnapshot.displayName`)
- Historical creator name (`createdBySnapshot.displayName`)

Search is case-insensitive. Deleted users are still discoverable through historical snapshots.

### 12.2 Structured Filters

Filters are combined with AND logic:

| Filter       | Type             | Description                       |
| ------------ | ---------------- | --------------------------------- |
| `statusId`   | ObjectId         | Filter by status                  |
| `priority`   | String           | Filter by priority                |
| `typeId`     | ObjectId         | Filter by task type               |
| `assigneeId` | ObjectId         | Filter by assignee                |
| `reporterId` | ObjectId         | Filter by reporter                |
| `sprintId`   | ObjectId \| null | Filter by sprint (null = backlog) |
| `labelId`    | ObjectId         | Filter by label                   |

### 12.3 Saved Filters

Users can save frequently used filter configurations per project:

```typescript
{
  name: "My Open Bugs";
  filters: {
    typeIds: ["BUG_TYPE_ID"],
    assigneeIds: ["CURRENT_USER_ID"],
    statusIds: ["TODO_ID", "IN_PROGRESS_ID", "IN_REVIEW_ID", "REOPENED_ID"]
  };
  sort: "createdAt:desc";
}
```

Opening a saved filter restores its complete query state.

### 12.4 URL Addressability

Filter state is represented in the URL where practical:

```text
/projects/PROJ/tasks?search=login+bug&typeId=BUG&assigneeId=me&page=1
```

---

## 13. Audit System

### 13.1 Event Structure

```typescript
{
  id: string;
  tenantId: string;
  projectId: string | null;
  entityType: "TASK" | "PROJECT" | "SPRINT" | "STATUS" | "BOARD" | "LABEL" | "TASK_TYPE" | "COMMENT" | "TASK_RELATIONSHIP";
  entityId: string;
  action: "CREATED" | "UPDATED" | "DELETED";
  actor: {
    userId: string | null;
    displayName: string;
  };
  changes: [
    {
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }
  ];
  createdAt: string;
}
```

### 13.2 Actor Snapshots

Actor identity is snapshotted at the time of the action. If the User is later deleted or changes their name, the audit
record retains the original display name.

### 13.3 Audit Scope

| Entity Type       | Audited Actions           |
| ----------------- | ------------------------- |
| Task              | Created, Updated, Deleted |
| Project           | Created, Updated, Deleted |
| Sprint            | Created, Updated, Deleted |
| Status            | Created, Updated, Deleted |
| Board             | Created, Updated, Deleted |
| Label             | Created, Updated, Deleted |
| Task Type         | Created, Updated, Deleted |
| Comment           | Created, Updated, Deleted |
| Task Relationship | Created, Deleted          |

### 13.4 Retention

Permanent Project deletion removes project-specific audit data. If long-term audit preservation is required, archive the
Project instead of permanently deleting it.

---

## 14. Error Model

### 14.1 Response Structure

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "additional": "context"
    }
  }
}
```

### 14.2 HTTP Status Codes

| Code | Usage                                |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 201  | Created                              |
| 204  | Deleted (no content)                 |
| 400  | Validation error                     |
| 401  | Unauthorized (not authenticated)     |
| 403  | Forbidden (insufficient permissions) |
| 404  | Not found                            |
| 409  | Conflict                             |
| 500  | Internal server error                |

### 14.3 Error Codes

| Code                          | HTTP Status | Description                                                   |
| ----------------------------- | ----------- | ------------------------------------------------------------- |
| `UNAUTHORIZED`                | 401         | Missing or invalid authentication                             |
| `FORBIDDEN`                   | 403         | Insufficient permissions for the operation                    |
| `NOT_FOUND`                   | 404         | Requested entity does not exist                               |
| `VALIDATION_ERROR`            | 400         | Request body or parameters failed validation                  |
| `CONFLICT`                    | 409         | General conflict (e.g., duplicate constraint)                 |
| `TASK_VERSION_CONFLICT`       | 409         | Optimistic concurrency conflict on Task                       |
| `DUPLICATE_PROJECT_KEY`       | 409         | Project key already exists in tenant                          |
| `DUPLICATE_LABEL`             | 409         | Label name already exists in project (case-insensitive)       |
| `DUPLICATE_STATUS`            | 409         | Status name already exists in project (case-insensitive)      |
| `INVALID_STATUS_REPLACEMENT`  | 400         | Replacement status is invalid or belongs to different project |
| `INVALID_SPRINT_DATES`        | 400         | `endDate < startDate`                                         |
| `INVITATION_EXPIRED`          | 410         | Invitation has expired                                        |
| `INVITATION_REVOKED`          | 410         | Invitation has been revoked                                   |
| `INVITATION_ALREADY_ACCEPTED` | 409         | Invitation was already accepted                               |
| `PROJECT_ARCHIVED`            | 403         | Attempt to modify an archived project                         |
| `TENANT_ARCHIVED`             | 403         | Attempt to modify an archived tenant                          |
| `PROJECT_KEY_IMMUTABLE`       | 400         | Attempt to change project key after tasks exist               |
| `TASK_TYPE_IN_USE`            | 409         | Cannot delete task type that is in use without replacement    |
| `STATUS_IN_USE`               | 409         | Cannot delete status that is in use without replacement       |

---

## 15. Frontend Screens

### 15.1 Screen Inventory

| Screen            | Route                                                        | Description                           |
| ----------------- | ------------------------------------------------------------ | ------------------------------------- |
| Landing Page      | `/`                                                          | Public page for logged-out users      |
| Login             | `/auth/login`                                                | Email/password login                  |
| Register          | `/auth/register`                                             | User registration                     |
| Accept Invitation | `/auth/accept-invitation`                                    | Invitation acceptance flow            |
| Dashboard         | `/`                                                          | Main dashboard (authenticated)        |
| Create Workspace  | `/workspace/create`                                          | First tenant onboarding               |
| Workspace Detail  | `/tenants/:tenantId`                                         | Tenant dashboard                      |
| Tenant Settings   | `/tenants/:tenantId/settings`                                | Tenant administration                 |
| Tenant Members    | `/tenants/:tenantId/settings/members`                        | Tenant member management              |
| Project List      | `/tenants/:tenantId/projects`                                | List of projects                      |
| Project Detail    | `/tenants/:tenantId/projects/:projectId`                     | Project overview                      |
| Board View        | `/tenants/:tenantId/projects/:projectId/boards/:boardId`     | Kanban/Sprint board                   |
| Task Table        | `/tenants/:tenantId/projects/:projectId/tasks`               | Searchable task list                  |
| Task Detail       | `/tenants/:tenantId/projects/:projectId/tasks/:taskId`       | Task detail/edit                      |
| Sprint List       | `/tenants/:tenantId/projects/:projectId/sprints`             | Sprint management                     |
| Sprint Detail     | `/tenants/:tenantId/projects/:projectId/sprints/:sprintId`   | Sprint detail/board                   |
| Project Members   | `/tenants/:tenantId/projects/:projectId/members`             | Project member management             |
| Status Manager    | `/tenants/:tenantId/projects/:projectId/settings/statuses`   | Status CRUD                           |
| Task Type Manager | `/tenants/:tenantId/projects/:projectId/settings/task-types` | Task type CRUD                        |
| Label Manager     | `/tenants/:tenantId/projects/:projectId/settings/labels`     | Label CRUD                            |
| Audit Log         | `/tenants/:tenantId/projects/:projectId/audit`               | Audit event viewer                    |
| Filter Panel      | `/tenants/:tenantId/projects/:projectId/filters`             | Saved filter management               |
| Settings          | `/settings`                                                  | User settings (theme, language, zoom) |
| FAQ               | `/faq`                                                       | Help: FAQ                             |
| Docs              | `/docs`                                                      | Help: Documentation                   |
| Support           | `/support`                                                   | Help: Support request                 |

### 15.2 Navigation Structure

**Global navigation** (always visible):

```text
Tenant Switcher → Project Switcher → Current Feature
```

**Project navigation**:

```text
Project
├── Overview
├── Board
├── Tasks
├── Sprints
├── Members
└── Settings
    ├── General
    ├── Members
    ├── Task Types
    ├── Statuses
    ├── Labels
    ├── Boards
    └── Danger Zone
```

**Tenant navigation**:

```text
Tenant
├── Projects
├── Settings
│   ├── General
│   ├── Members
│   ├── Invitations
│   ├── Projects
│   ├── Plan / Billing
│   └── Danger Zone
└── Profile / Logout
```

### 15.3 Screen Details

#### Landing Page

- Sign Up button
- Log In button
- No Tenant or Project context required

#### Login Screen

- Email field
- Password field
- Forgot password link
- Register link
- After login: redirect based on account state (no tenant → onboarding, one tenant → that tenant, multiple → selector)

#### Registration Screen

- Email field
- Password field
- Confirm Password field
- Display Name field
- Client and server validation
- Does NOT automatically create a Tenant

#### Onboarding (Create Workspace)

- Workspace name field
- Mock plan selection (Free, $0)
- Mock checkout step
- Confirmation
- Result: Tenant created, user becomes Owner

#### Tenant Dashboard

- Tenant name
- Project list
- Create Project button
- Members link
- Tenant Settings link
- Plan/Billing link
- Profile/Logout

#### Project Overview

- Project name/key
- Description
- Active Sprint
- Task summary
- Recent Tasks
- Members
- Shortcuts to Board and Tasks

#### Board View

- Single Board displayed at a time
- Columns with Tasks
- Board selector (user preference)
- Sprint filter (for Sprint Boards)
- Drag-and-drop Task movement between columns
- Multi-status columns require status selection on drop

#### Task Table

- Columns: Key, Title, Type, Status, Priority, Assignee, Reporter, Sprint, Labels, Created, Updated
- Search bar
- Filter controls
- Sort controls
- Pagination
- URL-addressable state

#### Task Detail

- Task key (e.g., PROJ-123)
- Title (editable inline)
- Type selector
- Status selector
- Priority selector
- Assignee selector
- Reporter (read-only after creation)
- Sprint selector
- Label selector (autocomplete/tag)
- Description (Milkdown WYSIWYG editor)
- Relationships section
- Comments section
- Audit history section

#### Sprint List

- Grouped by: Future, Active, Completed
- Create Sprint button
- Start/Complete/Reopen actions per sprint

#### Members Screen

- User, Email, Role, Access status, Invitation status
- Invite button
- Role change controls
- Remove/Restore access controls

### 15.4 Role-Based UI Behavior

| Role          | UI Behavior                                                                                |
| ------------- | ------------------------------------------------------------------------------------------ |
| Viewer        | All write controls hidden or disabled. Can read, search, filter.                           |
| Editor        | Can create/edit Tasks, comment, manage own comments. No admin controls.                    |
| Project Admin | Full project administration. Can manage members, statuses, types, labels, boards, sprints. |
| Tenant Admin  | All Project Admin abilities + tenant-level administration.                                 |
| Owner         | All Tenant Admin abilities + tenant deletion, ownership transfer.                          |

---

## 16. User Journeys

### 16.1 First User Journey

```text
1. Open landing page
2. Click Sign Up
3. Enter email, password, confirm password, display name
4. Complete email verification (if enabled)
5. Application detects no Tenant
6. Open onboarding
7. Enter workspace name
8. Choose Free plan
9. Complete mock checkout
10. Tenant created → user becomes Owner
11. Tenant dashboard opens (empty)
12. Click Create Project
13. Enter project name and key
14. Project initializes automatically (Task Types, Statuses, Board)
15. Open Project
16. Create first Task
17. TODO status already selected
18. Start working
```

### 16.2 Invite Collaborator Journey

```text
1. Admin opens Members
2. Click Invite
3. Enter email and select role
4. Invitation created (PENDING)
5. Email sent with secure link
6. Collaborator opens link
7. Collaborator logs in or registers
8. Invitation validated (token, expiration, revocation)
9. Collaborator accepts
10. Membership becomes ACTIVE
11. Invitation data removed
12. Collaborator lands in the relevant workspace
```

### 16.3 Re-invite Journey

```text
1. Admin sends invitation
2. User does not accept
3. Admin sends invitation again
4. Existing invitation replaced
5. New token/link generated
6. invitedBy and invitedOn updated
7. Old link becomes invalid immediately
8. New email sent
9. User accepts new invitation
```

### 16.4 Project Work Journey

```text
1. User opens Project
2. User opens Tasks or Board
3. User creates Task
4. TODO selected automatically
5. User optionally chooses another Status
6. User writes description via Milkdown WYSIWYG
7. User assigns Type, Priority, Assignee, Sprint, Labels
8. Task created
9. User opens Task detail
10. User edits fields independently (Jira-style inline editing)
11. User adds comments
12. User changes Status
13. Board reflects new Status
14. User can later assign Task to a Sprint
```

### 16.5 Sprint Workflow Journey

```text
1. Admin creates Sprint 12 (FUTURE, no dates)
2. Admin creates future Sprints ahead of time
3. Current Sprint completed
4. Admin starts Sprint 12
5. startDate preserved or set to now
6. Sprint becomes ACTIVE
7. Sprint Board displays only Sprint 12 Tasks
8. Admin completes Sprint 12
9. Missing endDate becomes now
10. Sprint becomes COMPLETED
```

### 16.6 Remove and Restore Project Access Journey

```text
1. Admin removes User from Project
2. User loses Project access
3. User remains in Tenant
4. Existing Tasks/Comments remain
5. User is later added again
6. Existing work remains associated with User
7. With Editor+ access, permitted content can be edited again
```

### 16.7 Delete User Journey

```text
1. User is deleted
2. Live membership/access disappears
3. Tasks remain
4. Comments remain
5. Historical snapshots remain
6. Audit identity remains
7. Search still finds historical Tasks by stored display name
```

### 16.8 Delete Status Journey

```text
1. Admin selects Status deletion
2. System checks Task usage
3. If Tasks use it → replacement is mandatory
4. Replacement applied to all affected Tasks
5. Replacement applied to Board references
6. Old Status deleted

If no Tasks use it but Boards do:
7. Show affected Boards
8. Admin chooses Replace or Delete Anyway
9. Missing references handled as invalid Board configuration
10. Board view hides nonexistent column
11. Board editor marks it red
```

### 16.9 Archive Project Journey

```text
1. Admin selects Archive
2. Project becomes ARCHIVED
3. Project remains readable
4. Editing controls disabled
5. Historical data remains available
6. Admin may restore the Project
```

### 16.10 Delete Project Journey

```text
1. Admin opens Danger Zone
2. Selects Delete Project
3. UI explains permanent consequences
4. Admin explicitly confirms (type project name/key)
5. Project enters DELETION_PENDING
6. Grace period begins
7. Admin may cancel
8. If not cancelled, Project permanently deleted
9. Direct Project URLs no longer resolve
```

### 16.11 Board Task Movement Journey

```text
1. User drags Task from one column to another
2. If destination column has one Status → apply directly
3. If destination column has multiple Statuses → prompt user to select
4. Backend stores the Status, not the visual column
5. Board reflects the change
```

---

## 17. Empty, Loading, and Error States

### 17.1 Empty States

| Screen            | Empty State Message                                         |
| ----------------- | ----------------------------------------------------------- |
| No Projects       | "No projects yet. Create your first project."               |
| No Tasks          | "No tasks found. Create a task or change your filters."     |
| No Sprints        | "No sprints yet. Create a future sprint to start planning." |
| No Comments       | "No comments yet. Start the discussion."                    |
| No Members        | "No additional members yet. Invite someone to collaborate." |
| No Labels         | "No labels yet. Create a label to categorize tasks."        |
| No Audit Events   | "No activity recorded yet."                                 |
| No Saved Filters  | "No saved filters. Save a filter for quick access."         |
| No Search Results | "No results found for your search."                         |

### 17.2 Loading States

- Show loading indicators while data is being fetched
- Do NOT display "No Tasks" while a Task request is still loading
- Distinguish between: Loading → Empty → Error → Content

### 17.3 Error States

| State                | Display                                                           |
| -------------------- | ----------------------------------------------------------------- |
| Network error        | "Unable to connect. Please check your connection and try again."  |
| Server error         | "Something went wrong. Please try again later."                   |
| Not found            | "The requested resource was not found."                           |
| Forbidden            | "You don't have permission to access this resource."              |
| Session expired      | Redirect to Login with return URL                                 |
| Concurrency conflict | "The task was modified by another user. Reload it and try again." |

### 17.4 Special States

| State                   | Display                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| Archived Project        | "This project is archived and is read-only." with visible `ARCHIVED` badge |
| Archived Tenant         | "This workspace is archived." with disabled write controls                 |
| Deletion Pending        | "This resource is scheduled for deletion." with cancel option              |
| Invalid Board reference | "⚠ Missing status" in Board editor; column hidden in Board view            |

### 17.5 State Distinction Rules

The frontend must visually distinguish:

```text
Loading → spinner/skeleton
Empty → message + CTA
Error → error message + retry
Forbidden → access denied message
Not Found → 404 message
Archived/Read-only → badge + disabled controls
```

Do NOT show raw database/API exceptions to users.

---

## 18. Functional Requirements

| ID     | Requirement                                                          | Source             |
| ------ | -------------------------------------------------------------------- | ------------------ |
| FR-001 | Users can register with email, password, and display name            | User Flows §2.2    |
| FR-002 | Users can log in with email and password                             | User Flows §2.3    |
| FR-003 | After login, redirect based on tenant count                          | User Flows §2.3    |
| FR-004 | New users without tenants see onboarding flow                        | User Flows §3      |
| FR-005 | Onboarding includes mock plan/checkout step                          | User Flows §3.1    |
| FR-006 | Tenant creation makes user the Owner                                 | User Flows §3.2    |
| FR-007 | Users can create Projects with name, key, description                | User Flows §5      |
| FR-008 | Project creation auto-seeds Task Types, Statuses, Board              | Requirements §7.2  |
| FR-009 | Tasks have sequential numbers per project (PROJ-1, PROJ-2)           | Requirements §9.1  |
| FR-010 | Tasks support Markdown descriptions via Milkdown WYSIWYG             | Requirements §9.4  |
| FR-011 | Tasks default to project's default status                            | Requirements §9.5  |
| FR-012 | Task fields are edited independently (Jira-style)                    | Requirements §9.6  |
| FR-013 | Tasks use optimistic concurrency with version field                  | Requirements §34   |
| FR-014 | Backlog is represented by sprintId = null                            | Requirements §10   |
| FR-015 | Sprint status transitions are unrestricted                           | Requirements §16.1 |
| FR-016 | Starting a Sprint sets startDate if missing                          | Requirements §16.3 |
| FR-017 | Completing a Sprint sets endDate if missing                          | Requirements §16.4 |
| FR-018 | endDate does not auto-complete a Sprint                              | Requirements §16.3 |
| FR-019 | Boards belong to Projects, not Sprints                               | Requirements §13   |
| FR-020 | Board columns can contain multiple statuses                          | Requirements §13   |
| FR-021 | User board selection is a per-user/per-project preference            | Requirements §15   |
| FR-022 | Labels are case-insensitive and project-level                        | Requirements §18   |
| FR-023 | Comments preserve historical author identity                         | Requirements §19   |
| FR-024 | Task relationships: BLOCKS, RELATES_TO, DUPLICATES                   | Requirements §20   |
| FR-025 | Saved filters are user/project-specific                              | Requirements §21   |
| FR-026 | Task search covers number, title, description, historical names      | Requirements §22   |
| FR-027 | Pagination is URL-addressable                                        | Requirements §23   |
| FR-028 | Audit events preserve actor snapshots                                | Requirements §24   |
| FR-029 | Tenant archive cascades to projects                                  | Requirements §3.1  |
| FR-030 | Tenant restore only restores TENANT_ARCHIVE projects                 | Requirements §3.1  |
| FR-031 | Project deletion uses grace period                                   | Requirements §25   |
| FR-032 | Task deletion is hard delete with cascade                            | Requirements §26   |
| FR-033 | Sprint deletion moves tasks to backlog                               | Requirements §27   |
| FR-034 | Status deletion requires replacement when in use                     | Requirements §12.1 |
| FR-035 | User deletion preserves historical snapshots                         | Requirements §31   |
| FR-036 | Invitation lifecycle: send, re-send, accept, expire, revoke, decline | Requirements §5.3  |
| FR-037 | Membership can be revoked and restored                               | Requirements §6    |
| FR-038 | Viewer role is strictly read-only                                    | Requirements §32   |
| FR-039 | Tenant Owner/Admin have implicit project access                      | Requirements §8.1  |
| FR-040 | Project key is immutable after first task                            | Requirements §7.1  |
| FR-041 | Drag-and-drop on Board changes task status                           | User Flows §18     |
| FR-042 | Multi-status column drop requires status selection                   | User Flows §18     |
| FR-043 | Sprint Board shows only tasks for selected sprint                    | User Flows §19     |
| FR-044 | Archived projects are read-only with visible badge                   | User Flows §33     |
| FR-045 | Project deletion requires explicit confirmation                      | User Flows §34     |
| FR-046 | Status deletion UX shows usage count and replacement                 | User Flows §37     |
| FR-047 | Task deletion requires confirmation dialog                           | User Flows §45     |
| FR-048 | Invalid board references shown in red in editor                      | User Flows §46     |
| FR-049 | Direct URLs work with authentication and authorization               | User Flows §41     |
| FR-050 | Tenant/Project switching preserves authentication                    | User Flows §7      |

---

## 19. Non-Functional Requirements

| ID      | Requirement                      | Details                                                        |
| ------- | -------------------------------- | -------------------------------------------------------------- |
| NFR-001 | Backend is authoritative         | All authorization and business rules enforced server-side      |
| NFR-002 | URL-addressable state            | Pagination, filters, and sort state in URL for bookmarking     |
| NFR-003 | Optimistic concurrency           | Tasks use version-based conflict detection                     |
| NFR-004 | Atomic operations                | Task number generation uses MongoDB `$inc`                     |
| NFR-005 | Transactional project creation   | Seed data created atomically (MongoDB transaction)             |
| NFR-006 | Case-insensitive uniqueness      | Labels and Statuses use normalized names                       |
| NFR-007 | Historical identity preservation | Snapshots survive user deletion                                |
| NFR-008 | Graceful degradation             | Distinguish loading, empty, error, forbidden, not-found states |
| NFR-009 | No raw errors to users           | API/database exceptions must not be shown raw                  |
| NFR-010 | Responsive UI                    | Spartan UI + Tailwind CSS for consistent styling               |
| NFR-011 | i18n support                     | 11 languages via Transloco                                     |
| NFR-012 | Theme support                    | Light/dark themes with CSS custom properties                   |
| NFR-013 | Lazy loading                     | All feature modules lazy-loaded via `loadComponent()`          |
| NFR-014 | Zoneless Angular                 | No Zone.js; all reactivity via signals                         |
| NFR-015 | Shared types                     | `@task-board/shared` package for type safety across server/UI  |

---

## 20. Out of Scope

The following are explicitly deferred and NOT part of the initial implementation:

| Item                             | Reason                                            |
| -------------------------------- | ------------------------------------------------- |
| Real file attachments            | No file uploads or physical storage initially     |
| Separate TaskLink entity         | URLs are Markdown text in task descriptions       |
| Separate Backlog entity          | Backlog = `sprintId = null`                       |
| Custom workflow engine           | Statuses are configurable but no transition graph |
| Sprint-owned Boards              | Boards belong to Projects                         |
| Simultaneous multi-Board display | One Board at a time                               |
| Viewer write operations          | Viewer is read-only                               |
| Automatic Sprint completion      | `endDate` does not auto-trigger completion        |
| Real payment processing          | Mock checkout only                                |
| Full notification center         | Lightweight feedback only                         |
| Advanced full-text search        | MongoDB Atlas Search deferred                     |
| Bulk Task operations             | Not implemented initially                         |
| Project templates                | Not implemented initially                         |
| Custom Task Type workflows       | Not implemented initially                         |

---

## 21. Open Questions and Assumptions

### Assumptions (filled from Jira conventions where source docs are silent)

| ID    | Assumption                                              | Rationale                                                                               |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A-001 | Password minimum length is 8 characters                 | Classic Jira convention; source docs silent                                             |
| A-002 | Comment body max length is 10000 characters             | Matches task description limit                                                          |
| A-003 | Project Admin can delete any comment in their project   | Classic Jira convention; source docs only say Viewer cannot comment                     |
| A-004 | Label has no color field initially                      | Source docs silent; can be added later                                                  |
| A-005 | Task has no position/order field within a status column | Source docs silent; tasks ordered by sort field                                         |
| A-006 | Invitation TTL is 7 days                                | Classic Jira convention; source docs reference `INVITATION_TTL` but don't specify value |
| A-007 | Deletion grace period is 30 days                        | Classic Jira convention; source docs don't specify duration                             |
| A-008 | Max 50 members per tenant on Free plan                  | Classic Jira convention; mock billing only                                              |
| A-009 | JWT token expiration is 24 hours                        | Standard practice; source docs silent                                                   |
| A-010 | Sort default for tasks is `number:desc` (newest first)  | Classic Jira convention                                                                 |

### Blocking Questions

None identified. All required information has been extracted from the source documents and supplemented with Jira
conventions where needed.

---

## JSON Summary

```json
{
  "tz_file": "docs/implementation/technical_specification.md",
  "blocking_questions": [],
  "assumptions": [
    "A-001: Password minimum length is 8 characters (Jira convention)",
    "A-002: Comment body max length is 10000 characters",
    "A-003: Project Admin can delete any comment in their project (Jira convention)",
    "A-004: Label has no color field initially",
    "A-005: Task has no position/order field within a status column",
    "A-006: Invitation TTL is 7 days (Jira convention)",
    "A-007: Deletion grace period is 30 days (Jira convention)",
    "A-008: Max 50 members per tenant on Free plan (Jira convention)",
    "A-009: JWT token expiration is 24 hours",
    "A-010: Sort default for tasks is number:desc (Jira convention)"
  ]
}
```
