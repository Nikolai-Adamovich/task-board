# Task Board MVP — Technical Specification

> **Version:** 4.0.0 **Date:** 2026-07-29 **Status:** Approved **Scope:** MVP vertical slice — multi-tenant task board
> with Kanban boards, tasks, sprints, RBAC, subscription tiers, email-based invitation system, and Jira-style adaptive
> dashboard **Reference:** [project_description.md](../project_description.md)

---

## 1. Goal and Context

### 1.1 What the MVP slice delivers

The MVP slice delivers a **fully functional, multi-tenant Kanban task board** with the following capabilities:

- **Tenant isolation** — organizations (tenants) are the top-level boundary for all data.
- **User management + RBAC** — users belong to tenants and projects with role-based permissions at two levels.
- **Project CRUD** — create, read, update, delete projects scoped to a tenant.
- **Boards with columns** — Kanban-style boards where columns represent task statuses.
- **Task lifecycle** — create tasks, assign them to users, move them across columns/statuses, manage backlog.
- **Sprints** — time-boxed containers that pull tasks from backlog into an active sprint.
- **Collaboration** — assignees and role-based visibility control.

### 1.2 Boundaries

| In scope (MVP)                                      | Out of scope                              |
| --------------------------------------------------- | ----------------------------------------- |
| Tenant CRUD (org creation, user membership)         | Real billing / payment gateway (Stripe)   |
| Subscription tier data model (free/premium)         | SSO / OAuth / SAML                        |
| User registration + authentication (email/password) | Advanced analytics / reporting            |
| RBAC at tenant and project level                    | Time tracking                             |
| Project CRUD inside a tenant                        | Advanced analytics / reporting            |
| Board CRUD with column/status definitions           | Knowledge base / wiki                     |
| Task CRUD with assignee + status transitions        | External integrations (Jira, Slack, etc.) |
| Sprint CRUD + backlog → sprint movement             | Advanced reporting                        |
| Role-based visibility (viewer vs. editor)           | AI-assisted features                      |

### 1.3 Architectural constraints (from project description)

- **Monorepo** with npm workspaces: `server/`, `shared/`, `ui/`, `docs/`
- **Frontend:** Angular 22+, standalone components, zoneless, signals, signal forms, Spartan UI, Tailwind CSS v4
- **Backend:** Hono on Cloudflare Workers + MongoDB
- **Shared package:** TypeScript types and constants (runtime-library free); Zod v4 schemas and API contracts in server
  package
- **Deployment:** Cloudflare Pages + Workers, MongoDB Atlas, Wrangler, GitHub Actions
- **Style:** Feature-oriented modules, strong end-to-end type safety, cloud-native

### 1.4 Technology versions

All versions are pinned as of the spec date. The implementation should use these exact major.minor versions (patch
upgrades are acceptable).

| Technology                 | Version  | Notes                                                                                    |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| **Angular**                | `22.0.8` | Signals stable, `resource()`, `linkedSignal()`, `httpResource()`, signal forms, `@defer` |
| **TypeScript**             | `6.0.0`  | Latest stable; strict mode enabled                                                       |
| **Node.js**                | `22.x`   | LTS release                                                                              |
| **Hono**                   | `4.8.0`  | RPC client for type-safe API calls                                                       |
| **MongoDB Node.js Driver** | `7.0.0`  | Async/await native API                                                                   |
| **Zod**                    | `4.0.0`  | Server-only: `z.interface()` for schemas, validation middleware                          |
| **Tailwind CSS**           | `4.1.0`  | CSS-first config via `@theme`, no `tailwind.config.js`                                   |
| **Spartan UI**             | `0.12.0` | `@spartan-ng/brain` + `@spartan-ng/helm`                                                 |
| **Vitest**                 | `4.0.0`  | Unit and integration tests                                                               |
| **Playwright**             | `1.55.0` | E2E tests                                                                                |
| **ESLint**                 | `9.x`    | Flat config (`eslint.config.js`)                                                         |
| **Prettier**               | `3.x`    | Code formatting                                                                          |
| **Wrangler**               | `4.x`    | Cloudflare dev/deploy CLI                                                                |
| **bcrypt**                 | `6.x`    | Password hashing (server-side)                                                           |
| **Resend**                 | `4.x`    | Transactional email (free tier: 3K/month); `resend` npm package                          |

#### Key Angular 22 APIs used in this MVP

| API                        | Purpose                                                      | Introduced |
| -------------------------- | ------------------------------------------------------------ | ---------- |
| `signal()`                 | Reactive primitive for component/service state               | Angular 16 |
| `computed()`               | Derived signal value                                         | Angular 16 |
| `effect()`                 | Side-effect on signal changes                                | Angular 16 |
| `linkedSignal()`           | Writable derived signal (read + write)                       | Angular 19 |
| `resource()`               | Async data loading with signal integration                   | Angular 19 |
| `httpResource()`           | HTTP-specific resource with typed responses                  | Angular 19 |
| `inject()`                 | Function-based dependency injection                          | Angular 14 |
| `@if` / `@for` / `@switch` | Built-in control flow (replaces `*ngIf`, `*ngFor`)           | Angular 17 |
| `@defer`                   | Lazy loading with trigger-based deferral                     | Angular 17 |
| Signal forms               | Signal-based form model (replaces `FormGroup`/`FormControl`) | Angular 20 |
| Standalone components      | Default component model; no NgModules                        | Angular 14 |
| Zoneless change detection  | No Zone.js; signal-driven change detection                   | Angular 18 |

#### Key Zod 4 changes from v3 (server-only)

> **Note:** Zod is used exclusively in the server package. The shared package contains only plain TypeScript types with
> no runtime validation dependency.

| Aspect             | Zod 3                                         | Zod 4                                                                  |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| Object schemas     | `z.object({...})`                             | `z.interface({...})` preferred (better perf); `z.object()` still works |
| Tree-shaking       | Full bundle                                   | `zod/mini` for smaller bundles                                         |
| Error messages     | `ZodError` with `.issues`                     | Improved error messages; `.issues` still available                     |
| Type inference     | `z.infer<typeof schema>`                      | Unchanged                                                              |
| Schema composition | `.extend()`, `.merge()`, `.pick()`, `.omit()` | Unchanged API                                                          |
| Async refinements  | `.refineAsync()`                              | `.checkAsync()` (renamed)                                              |

---

## 2. Domain Model

### 2.1 Entities and attributes

#### Tenant (Organization / Workspace)

| Field          | Type               | Description                                    |
| -------------- | ------------------ | ---------------------------------------------- |
| `_id`          | `ObjectId`         | MongoDB primary key                            |
| `id`           | `string` (UUID)    | Public identifier                              |
| `name`         | `string`           | Organization name (e.g. "Acme Corp")           |
| `slug`         | `string`           | URL-friendly unique identifier                 |
| `description`  | `string` \| `null` | Optional workspace description (max 500 chars) |
| `subscription` | `SubscriptionTier` | `free` \| `premium` — workspace tier           |
| `createdAt`    | `Date`             | Creation timestamp                             |
| `updatedAt`    | `Date`             | Last modification timestamp                    |

#### User

| Field          | Type            | Description                     |
| -------------- | --------------- | ------------------------------- |
| `_id`          | `ObjectId`      | MongoDB primary key             |
| `id`           | `string` (UUID) | Public identifier               |
| `email`        | `string`        | Unique email (global)           |
| `displayName`  | `string`        | User's display name             |
| `passwordHash` | `string`        | Hashed password (bcrypt/argon2) |
| `createdAt`    | `Date`          | Creation timestamp              |
| `updatedAt`    | `Date`          | Last modification timestamp     |

#### TenantMember (User ↔ Tenant relationship)

| Field             | Type                      | Description                                             |
| ----------------- | ------------------------- | ------------------------------------------------------- |
| `_id`             | `ObjectId`                | MongoDB primary key                                     |
| `userId`          | `string` (UUID) \| `null` | Reference to User (`null` for unregistered invitees)    |
| `tenantId`        | `string` (UUID)           | Reference to Tenant                                     |
| `role`            | `TenantRole`              | `owner` \| `admin` \| `member`                          |
| `status`          | `MemberStatus`            | `active` \| `pending` \| `declined` \| `access_revoked` |
| `invitedEmail`    | `string` \| `null`        | Email used for invitation (set for pending members)     |
| `invitationToken` | `string` \| `null`        | Unique token for accepting invitation via email link    |
| `invitedAt`       | `Date` \| `null`          | Timestamp when the invitation was sent                  |
| `createdAt`       | `Date`                    | Creation timestamp                                      |

#### Project

| Field         | Type               | Description                       |
| ------------- | ------------------ | --------------------------------- |
| `_id`         | `ObjectId`         | MongoDB primary key               |
| `id`          | `string` (UUID)    | Public identifier                 |
| `tenantId`    | `string` (UUID)    | Owner tenant (tenant isolation)   |
| `name`        | `string`           | Project name                      |
| `slug`        | `string`           | URL-friendly unique within tenant |
| `description` | `string` \| `null` | Optional description              |
| `createdAt`   | `Date`             |                                   |
| `updatedAt`   | `Date`             |                                   |

#### ProjectMember (User ↔ Project relationship)

| Field       | Type            | Description                        |
| ----------- | --------------- | ---------------------------------- |
| `_id`       | `ObjectId`      | MongoDB primary key                |
| `userId`    | `string` (UUID) | Reference to User                  |
| `projectId` | `string` (UUID) | Reference to Project               |
| `role`      | `ProjectRole`   | `admin` \| `developer` \| `viewer` |
| `createdAt` | `Date`          |                                    |

#### Board

| Field         | Type               | Description                      |
| ------------- | ------------------ | -------------------------------- |
| `_id`         | `ObjectId`         | MongoDB primary key              |
| `id`          | `string` (UUID)    | Public identifier                |
| `tenantId`    | `string` (UUID)    | Tenant isolation                 |
| `projectId`   | `string` (UUID)    | Owning project                   |
| `name`        | `string`           | Board name (e.g. "Sprint Board") |
| `description` | `string` \| `null` | Optional                         |
| `createdAt`   | `Date`             |                                  |
| `updatedAt`   | `Date`             |                                  |

#### Column

| Field       | Type            | Description                                        |
| ----------- | --------------- | -------------------------------------------------- |
| `_id`       | `ObjectId`      | MongoDB primary key                                |
| `id`        | `string` (UUID) | Public identifier                                  |
| `boardId`   | `string` (UUID) | Owning board                                       |
| `tenantId`  | `string` (UUID) | Denormalized for tenant isolation queries          |
| `name`      | `string`        | Column title (e.g. "To Do", "In Progress", "Done") |
| `position`  | `number`        | Ordering index within the board                    |
| `isDefault` | `boolean`       | Whether this is a system default column            |
| `createdAt` | `Date`          |                                                    |

#### Task

| Field         | Type                      | Description                               |
| ------------- | ------------------------- | ----------------------------------------- |
| `_id`         | `ObjectId`                | MongoDB primary key                       |
| `id`          | `string` (UUID)           | Public identifier                         |
| `tenantId`    | `string` (UUID)           | Tenant isolation                          |
| `projectId`   | `string` (UUID)           | Owning project                            |
| `boardId`     | `string` (UUID)           | Current board                             |
| `columnId`    | `string` (UUID)           | Current column/status                     |
| `sprintId`    | `string` (UUID) \| `null` | Sprint this task belongs to (nullable)    |
| `title`       | `string`                  | Task title                                |
| `description` | `string` \| `null`        | Optional detailed description             |
| `assigneeIds` | `string[]` (UUID[])       | List of assigned user IDs                 |
| `priority`    | `TaskPriority`            | `low` \| `medium` \| `high` \| `critical` |
| `position`    | `number`                  | Ordering within the column                |
| `createdBy`   | `string` (UUID)           | User who created the task                 |
| `createdAt`   | `Date`                    |                                           |
| `updatedAt`   | `Date`                    |                                           |

#### Sprint

| Field       | Type                | Description                          |
| ----------- | ------------------- | ------------------------------------ |
| `_id`       | `ObjectId`          | MongoDB primary key                  |
| `id`        | `string` (UUID)     | Public identifier                    |
| `tenantId`  | `string` (UUID)     | Tenant isolation                     |
| `projectId` | `string` (UUID)     | Owning project                       |
| `name`      | `string`            | Sprint name (e.g. "Sprint 1")        |
| `startDate` | `Date`              | Sprint start                         |
| `endDate`   | `Date`              | Sprint end                           |
| `goal`      | `string` \| `null`  | Optional sprint goal                 |
| `status`    | `SprintStatus`      | `active` \| `completed` \| `planned` |
| `taskIds`   | `string[]` (UUID[]) | Tasks in this sprint                 |
| `createdAt` | `Date`              |                                      |
| `updatedAt` | `Date`              |                                      |

### 2.2 Relationships

```
Tenant 1───* TenantMember *───1 User
Tenant 1───* Project
Project 1───* Board
Board 1───* Column
Project 1───* Task
Board 1───* Task (task is on a board)
Column 1───* Task (task is in a column)
Sprint 1───* Task (task belongs to a sprint)
Project 1───* Sprint
Project 1───* ProjectMember *───1 User
Tenant 1───* ProjectMember (via Project → Tenant)
Task *───* User (via assigneeIds)
```

### 2.3 Tenant isolation invariant

Every document that belongs to a tenant **must** carry `tenantId`. All queries and mutations are scoped by the active
tenant context derived from the authenticated user's membership. No cross-tenant data leakage is permitted.

---

## 3. RBAC Model

### 3.1 Tenant roles

| Role     | Description                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| `owner`  | Full control of the tenant. Can manage members, projects, and all data. Only one owner per tenant.                  |
| `admin`  | Can manage projects, boards, tasks, and sprints within the tenant. Can manage member roles (admin/member).          |
| `member` | Can view and collaborate on projects they have access to. Can create/edit tasks assigned to them or their projects. |

#### Member statuses

| Status           | Description                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `active`         | Fully active member. Has the access defined by their role.                                                       |
| `pending`        | Invited but not yet accepted. Appears in the member list but has **no access** to any tenant resources.          |
| `declined`       | Invitation was declined by the user. No access.                                                                  |
| `access_revoked` | Owner/admin revoked the user's access (soft-delete). No access. Remains in the member list for later management. |

> **Rule:** Only `active` members can access tenant resources. `pending`, `declined`, and `access_revoked` members are
> excluded from all permission checks. Owner/admin can later resend invitation (reset to `pending`) or hard-delete
> `declined` / `access_revoked` members permanently.

### 3.2 Project roles

| Role        | Description                                                                                |
| ----------- | ------------------------------------------------------------------------------------------ |
| `admin`     | Full control of the project: CRUD boards, columns, tasks, sprints; manage project members. |
| `developer` | Can create/edit/assign tasks; move tasks across columns; participate in sprints.           |
| `viewer`    | Read-only access to project boards, tasks, and sprints. Cannot modify anything.            |

### 3.3 Permission matrix

| Action                            | Tenant: owner | Tenant: admin | Tenant: member | Project: admin | Project: developer | Project: viewer |
| --------------------------------- | :-----------: | :-----------: | :------------: | :------------: | :----------------: | :-------------: |
| Manage tenant (settings, members) |      ✅       |      ✅       |       ❌       |       —        |         —          |        —        |
| Create project                    |      ✅       |      ✅       |       ❌       |       —        |         —          |        —        |
| Delete project                    |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |
| CRUD boards                       |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |
| CRUD columns                      |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |
| Create task                       |      ✅       |      ✅       |      ✅\*      |       ✅       |         ✅         |       ❌        |
| Edit own task                     |      ✅       |      ✅       |      ✅\*      |       ✅       |         ✅         |       ❌        |
| Edit any task                     |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |
| Move task (column change)         |      ✅       |      ✅       |      ✅\*      |       ✅       |         ✅         |       ❌        |
| Assign task                       |      ✅       |      ✅       |      ✅\*      |       ✅       |         ✅         |       ❌        |
| Create sprint                     |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |
| Manage sprint                     |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |
| View all project data             |      ✅       |      ✅       |      ✅\*      |       ✅       |         ✅         |       ✅        |
| Manage project members            |      ✅       |      ✅       |       ❌       |       ✅       |         ❌         |       ❌        |

\* Member can create/edit/move tasks only in projects where they are explicitly a member (via ProjectMember).

### 3.4 Permission resolution rules

1. **Tenant context is mandatory** — every request must carry an active tenant. The tenant context is derived from the
   user's `TenantMember` record with `status: 'active'`.
2. **Project access is a subset of tenant access** — a user must first be an active tenant member, then be granted a
   project role via `ProjectMember`.
3. **Viewer cannot write** — project viewers can read but cannot create, update, or delete any entity.
4. **Ownership overrides** — tenant owners bypass all project-level restrictions.
5. **Tenant isolation is enforced at the data layer** — every query filters by `tenantId`.
6. **Inactive members are excluded** — members with `status: 'pending'`, `status: 'declined'`, or
   `status: 'access_revoked'` cannot access any tenant resource. The `TenantContextMiddleware` must check
   `status === 'active'` when resolving tenant membership.
7. **Subscription limits are enforced on write** — project creation and member addition are blocked when the tenant's
   subscription tier limit is reached (see §14).

---

## 4. API Contracts

All endpoints are RESTful under the base path `/api/v1`. Authentication is via Bearer JWT token in the `Authorization`
header. Every request/response shape is validated with Zod v4 schemas in the server package.

### 4.1 Base URL and auth

```
Base URL: /api/v1
Auth: Bearer <jwt>
Tenant context: X-Tenant-Id header (derived from JWT claims)
```

### 4.2 Auth endpoints

| Method | Path                      | Description                                              |
| ------ | ------------------------- | -------------------------------------------------------- |
| `POST` | `/auth/register`          | Register a new user (no tenant auto-created)             |
| `POST` | `/auth/login`             | Authenticate and receive JWT                             |
| `GET`  | `/auth/me`                | Get current user profile                                 |
| `POST` | `/auth/switch-tenant`     | Switch active tenant context; returns new JWT            |
| `POST` | `/auth/accept-invitation` | Accept a pending invitation; activates tenant membership |
| `GET`  | `/invitations/:token`     | Get invitation details (public — no auth required)       |

### 4.3 Tenant endpoints

| Method   | Path                                 | Description                                                                  |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `GET`    | `/tenants`                           | List tenants the user belongs to with `role` field (active memberships only) |
| `POST`   | `/tenants`                           | Create a new tenant/workspace (subject to subscription limits)               |
| `GET`    | `/tenants/:tenantId`                 | Get tenant details                                                           |
| `PATCH`  | `/tenants/:tenantId`                 | Update tenant (owner/admin only)                                             |
| `POST`   | `/tenants/:tenantId/members`         | Invite member by email (supports unregistered users → pending)               |
| `GET`    | `/tenants/:tenantId/members`         | List all members including pending invitations                               |
| `PATCH`  | `/tenants/:tenantId/members/:userId` | Update member role                                                           |
| `DELETE` | `/tenants/:tenantId/members/:userId` | Remove/cancel member invitation                                              |

### 4.4 Project endpoints

| Method   | Path                                   | Description                           |
| -------- | -------------------------------------- | ------------------------------------- |
| `GET`    | `/projects`                            | List projects in the active tenant    |
| `POST`   | `/projects`                            | Create a project (tenant admin+ only) |
| `GET`    | `/projects/:projectId`                 | Get project details                   |
| `PATCH`  | `/projects/:projectId`                 | Update project (admin+ only)          |
| `DELETE` | `/projects/:projectId`                 | Delete project (admin+ only)          |
| `GET`    | `/projects/:projectId/members`         | List project members                  |
| `POST`   | `/projects/:projectId/members`         | Add member to project                 |
| `PATCH`  | `/projects/:projectId/members/:userId` | Update member project role            |
| `DELETE` | `/projects/:projectId/members/:userId` | Remove member from project            |

### 4.5 Board endpoints

| Method   | Path               | Description                          |
| -------- | ------------------ | ------------------------------------ |
| `GET`    | `/boards`          | List boards in a project             |
| `POST`   | `/boards`          | Create a board (project admin+ only) |
| `GET`    | `/boards/:boardId` | Get board with columns               |
| `PATCH`  | `/boards/:boardId` | Update board (project admin+ only)   |
| `DELETE` | `/boards/:boardId` | Delete board (project admin+ only)   |

### 4.6 Column endpoints

| Method   | Path                                 | Description                           |
| -------- | ------------------------------------ | ------------------------------------- |
| `GET`    | `/boards/:boardId/columns`           | List columns for a board              |
| `POST`   | `/boards/:boardId/columns`           | Create a column (project admin+ only) |
| `PATCH`  | `/boards/:boardId/columns/:columnId` | Update column (project admin+ only)   |
| `DELETE` | `/boards/:boardId/columns/:columnId` | Delete column (project admin+ only)   |
| `PATCH`  | `/boards/:boardId/columns/reorder`   | Reorder columns (project admin+ only) |

### 4.7 Task endpoints

| Method   | Path                    | Description                                                       |
| -------- | ----------------------- | ----------------------------------------------------------------- |
| `GET`    | `/tasks`                | List tasks (filtered by project, board, column, sprint, assignee) |
| `POST`   | `/tasks`                | Create a task (project member+ only)                              |
| `GET`    | `/tasks/:taskId`        | Get task details with assignees                                   |
| `PATCH`  | `/tasks/:taskId`        | Update task (assignee, status, priority, etc.)                    |
| `DELETE` | `/tasks/:taskId`        | Delete task (project admin+ only)                                 |
| `PATCH`  | `/tasks/:taskId/assign` | Assign/unassign users                                             |
| `PATCH`  | `/tasks/:taskId/move`   | Move task to a different column                                   |

### 4.8 Sprint endpoints

| Method   | Path                               | Description                               |
| -------- | ---------------------------------- | ----------------------------------------- |
| `GET`    | `/sprints`                         | List sprints in a project                 |
| `POST`   | `/sprints`                         | Create a sprint (project admin+ only)     |
| `GET`    | `/sprints/:sprintId`               | Get sprint details with tasks             |
| `PATCH`  | `/sprints/:sprintId`               | Update sprint (project admin+ only)       |
| `DELETE` | `/sprints/:sprintId`               | Delete sprint (project admin+ only)       |
| `POST`   | `/sprints/:sprintId/tasks`         | Add task(s) from backlog to sprint        |
| `DELETE` | `/sprints/:sprintId/tasks/:taskId` | Remove task from sprint (back to backlog) |

### 4.9 Request/response shape examples (Zod v4 schema references)

All schemas are defined in the server package at `server/src/schemas/` using Zod v4 (`z.interface()` for object schemas
— preferred over `z.object()` for better performance and type inference). Type definitions are in the shared package at
`shared/src/types/`.

#### Create Tenant Request

```typescript
// Zod v4 schema: CreateTenantSchema
export const CreateTenantSchema = z.interface({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  subscription: z.enum(['free', 'premium']).default('free'),
});
```

#### Create Tenant Response

```typescript
// Zod v4 schema: TenantSchema
export const TenantSchema = z.interface({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  subscription: z.enum(['free', 'premium']),
  description: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

#### Invite Member Request

```typescript
// Zod v4 schema: InviteMemberSchema
export const InviteMemberSchema = z.interface({
  email: z.email(),
  role: z.enum(['admin', 'member']),
});
```

#### Accept Invitation Request

```typescript
// Zod v4 schema: AcceptInvitationSchema
export const AcceptInvitationSchema = z.interface({
  token: z.string().min(1),
});
```

#### Invitation Details Response (public)

```typescript
// Zod v4 schema: InvitationDetailsSchema
export const InvitationDetailsSchema = z.interface({
  tenantName: z.string(),
  invitedEmail: z.string(),
  role: z.enum(['admin', 'member']),
  status: z.enum(['pending', 'accepted', 'expired']),
});
```

#### Create Project Request

```typescript
// Zod v4 schema: CreateProjectSchema
export const CreateProjectSchema = z.interface({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});
```

#### Create Board Request

```typescript
// Zod v4 schema: CreateBoardSchema
export const CreateBoardSchema = z.interface({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  columnNames: z.array(z.string().min(1).max(100)).min(1).max(20),
});
```

#### Create Task Request

```typescript
// Zod v4 schema: CreateTaskSchema
export const CreateTaskSchema = z.interface({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  projectId: z.string().uuid(),
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  sprintId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});
```

#### Move Task Request

```typescript
// Zod v4 schema: MoveTaskSchema
export const MoveTaskSchema = z.interface({
  taskId: z.string().uuid(),
  targetColumnId: z.string().uuid(),
  targetSprintId: z.string().uuid().optional(),
});
```

#### Create Sprint Request

```typescript
// Zod v4 schema: CreateSprintSchema
export const CreateSprintSchema = z.interface({
  name: z.string().min(1).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  goal: z.string().max(1000).optional(),
});
```

#### Error response (standard)

```typescript
// Zod v4 schema: ErrorResponseSchema
export const ErrorResponseSchema = z.interface({
  code: z.string(), // e.g. "NOT_FOUND", "FORBIDDEN", "VALIDATION_ERROR"
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
```

---

## 5. Data Model (MongoDB)

### 5.1 Collections

| Collection        | Document type | Tenant isolation key                      |
| ----------------- | ------------- | ----------------------------------------- |
| `tenants`         | Tenant        | `_id` (tenant is the root entity)         |
| `users`           | User          | N/A (global, but linked via TenantMember) |
| `tenant_members`  | TenantMember  | `tenantId`                                |
| `projects`        | Project       | `tenantId`                                |
| `project_members` | ProjectMember | `tenantId` (via project)                  |
| `boards`          | Board         | `tenantId`                                |
| `columns`         | Column        | `tenantId`                                |
| `tasks`           | Task          | `tenantId`                                |
| `sprints`         | Sprint        | `tenantId`                                |

### 5.2 Indexes per collection

**tenants**

- `{ slug: 1 }` — unique
- `{ ownerId: 1 }` — for subscription limit checks (owner's workspace count)

**users**

- `{ email: 1 }` — unique

**tenant_members**

- `{ userId: 1, tenantId: 1 }` — unique compound (partial filter: `{ userId: { $ne: null } }`)
- `{ tenantId: 1 }`
- `{ invitationToken: 1 }` — unique, sparse (only documents where `invitationToken` exists)
- `{ invitedEmail: 1, tenantId: 1 }` — unique, sparse (for deduplicating pending invitations)

**projects**

- `{ tenantId: 1, slug: 1 }` — unique compound
- `{ tenantId: 1 }`

**project_members**

- `{ projectId: 1, userId: 1 }` — unique compound
- `{ tenantId: 1 }` (denormalized for efficient queries)

**boards**

- `{ tenantId: 1, projectId: 1 }`
- `{ tenantId: 1 }`

**columns**

- `{ boardId: 1, position: 1 }`
- `{ tenantId: 1 }`

**tasks**

- `{ tenantId: 1, projectId: 1 }`
- `{ tenantId: 1, boardId: 1, columnId: 1, position: 1 }`
- `{ tenantId: 1, sprintId: 1 }`
- `{ tenantId: 1 }`

**sprints**

- `{ tenantId: 1, projectId: 1 }`
- `{ tenantId: 1 }`

### 5.3 Tenant isolation enforcement

- **Application layer:** Every service method receives `tenantId` from the request context and filters all queries by
  it.
- **Database layer:** All queries include `tenantId` in the filter object. No collection scan without `tenantId`.
- **No cross-tenant references:** Foreign keys (e.g., `projectId` on a task) are always scoped within the same tenant.
  The application validates this on write operations.

### 5.4 Document examples

**Project document:**

```json
{
  "_id": "ObjectId(...)",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Website Redesign",
  "slug": "website-redesign",
  "description": "Redesign the company website",
  "createdAt": "2026-07-28T08:00:00Z",
  "updatedAt": "2026-07-28T08:00:00Z"
}
```

**Task document:**

```json
{
  "_id": "ObjectId(...)",
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "projectId": "550e8400-e29b-41d4-a716-446655440002",
  "boardId": "550e8400-e29b-41d4-a716-446655440003",
  "columnId": "550e8400-e29b-41d4-a716-446655440004",
  "sprintId": null,
  "title": "Implement login page",
  "description": "Create the login page with email/password auth",
  "assigneeIds": ["550e8400-e29b-41d4-a716-446655440020"],
  "priority": "high",
  "position": 0,
  "createdBy": "550e8400-e29b-41d4-a716-446655440030",
  "createdAt": "2026-07-28T08:00:00Z",
  "updatedAt": "2026-07-28T08:00:00Z"
}
```

---

## 6. Shared Package

### 6.1 Location

`shared/` — npm workspace package (runtime-library free, zero dependencies)

### 6.2 Contents

| Path             | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `src/types/`     | Plain TypeScript interfaces for all domain objects                     |
| `src/constants/` | Shared constants (role enums, HTTP methods, API paths, default values) |
| `src/utils/`     | Utility helpers (`valuesOf()` for strongly-typed constant tuples)      |
| `index.ts`       | Barrel exports for types, constants, `valuesOf`, `DEFAULT_THEME_ID`    |

### 6.3 Key type definitions (file references)

| Type file          | Types defined                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `types/tenant.ts`  | `Tenant`, `CreateTenant`, `UpdateTenant`, `TenantMember`, `InviteMember`, `TenantWithRole`                                      |
| `types/user.ts`    | `User`, `CreateUser`                                                                                                            |
| `types/project.ts` | `Project`, `CreateProject`, `UpdateProject`, `ProjectMember`                                                                    |
| `types/board.ts`   | `Board`, `CreateBoard`, `UpdateBoard`, `Column`, `CreateColumn`                                                                 |
| `types/task.ts`    | `Task`, `CreateTask`, `UpdateTask`, `MoveTask`, `AssignTask`, `MyTask`                                                          |
| `types/sprint.ts`  | `Sprint`, `CreateSprint`, `UpdateSprint`                                                                                        |
| `types/auth.ts`    | `LoginRequest`, `RegisterRequest`, `AuthResponse`, `AcceptInvitation`, `InvitationDetails`, `MyInvitation`, `PendingInvitation` |
| `types/common.ts`  | `ThemeManifestItem`, `ErrorResponse`, `Pagination`, `ListQuery`, `UserPreferences`, `UpdateUserPreferences`, `SupportRequest`   |

### 6.4 Type definition pattern (plain TypeScript interfaces)

All TypeScript types in the shared package are plain interfaces with no runtime dependency:

```typescript
// Example: shared/src/types/project.ts
export interface Project {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProject {
  name: string;
  slug: string;
  description?: string;
}
```

### 6.5 Zod schemas and contracts (server package)

Zod validation schemas and API contracts live in the server package:

| Path                     | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `server/src/schemas/`    | Zod v4 validation schemas for all API request/response shapes       |
| `server/src/contracts/`  | API contract definitions (endpoint paths, HTTP methods, type pairs) |
| `server/src/validators/` | Reusable Zod validator helpers (UUID, slug, pagination)             |

```typescript
// Example: server/src/schemas/project.ts
import { z } from 'zod';
import { TenantRoleValues } from '@task-board/shared';

export const CreateProjectSchema = z.interface({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});
```

```typescript
// Example: server/src/contracts/project.contracts.ts
import { HttpMethod } from '@task-board/shared';

export const ProjectContracts = {
  list: {
    method: HttpMethod.GET,
    path: '/projects',
    query: { tenantId: 'string' },
    response: PaginatedResponseSchema(ProjectSchema),
  },
  create: {
    method: HttpMethod.POST,
    path: '/projects',
    body: CreateProjectSchema,
    response: ProjectSchema,
    errors: ['FORBIDDEN', 'VALIDATION_ERROR', 'CONFLICT'],
  },
} as const;
```

### 6.6 Enums and constants

| Constant             | Values                                                    |
| -------------------- | --------------------------------------------------------- |
| `TenantRole`         | `'owner'`, `'admin'`, `'member'`                          |
| `ProjectRole`        | `'admin'`, `'developer'`, `'viewer'`                      |
| `TaskPriority`       | `'low'`, `'medium'`, `'high'`, `'critical'`               |
| `SprintStatus`       | `'planned'`, `'active'`, `'completed'`                    |
| `MemberStatus`       | `'active'`, `'pending'`, `'declined'`, `'access_revoked'` |
| `SubscriptionTier`   | `'free'`, `'premium'`                                     |
| `DefaultColumnNames` | `['Backlog', 'To Do', 'In Progress', 'Review', 'Done']`   |
| `HttpMethod`         | `'GET'`, `'POST'`, `'PATCH'`, `'DELETE'`                  |

---

## 7. Frontend Architecture

### 7.1 Application shell

The Angular 22 application is a standalone-based SPA with no NgModules. Change detection is **zoneless** (no `zone.js`);
all reactivity flows through Angular Signals. Routing is handled via Angular's standalone router with functional guards
and resolvers. The root component bootstraps the app with providers for auth, tenant context, and HTTP interceptors.

```typescript
// ui/src/app/app.config.ts
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor, tenantInterceptor, errorInterceptor } from './core/interceptors';

export const appConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor])),
  ],
};
```

### 7.2 Feature modules (standalone component groups)

| Feature module | Path prefix  | Key components                                                                     | Description                                       |
| -------------- | ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| `auth`         | `/auth`      | `LoginComponent`, `RegisterComponent`, `AuthGuard`                                 | Authentication flow                               |
| `tenants`      | `/tenants`   | `TenantListComponent`, `TenantDetailComponent`, `TenantMemberListComponent`        | Tenant management                                 |
| `projects`     | `/projects`  | `ProjectListComponent`, `ProjectDetailComponent`, `ProjectMemberListComponent`     | Project CRUD and member management                |
| `boards`       | `/boards`    | `BoardListComponent`, `BoardViewComponent`, `ColumnComponent`, `TaskCardComponent` | Kanban board view and interaction                 |
| `tasks`        | `/tasks`     | `TaskDetailComponent`, `TaskFormComponent`, `TaskListComponent`                    | Task CRUD and assignment                          |
| `sprints`      | `/sprints`   | `SprintListComponent`, `SprintDetailComponent`, `SprintBacklogComponent`           | Sprint management and backlog                     |
| `dashboard`    | `/dashboard` | `DashboardComponent`                                                               | Overview of projects, boards, and recent activity |
| `layout`       | —            | `AppShellComponent`, `SidebarComponent`, `HeaderComponent`                         | Shell, navigation, tenant switcher                |

### 7.3 Routing structure

```
/app
  /auth
    /login
    /register
  /tenants
    /:tenantId
      /projects
        /:projectId
          /boards
            /:boardId
          /sprints
            /:sprintId
          /tasks
            /:taskId
  /dashboard
```

- **Guards (functional):** `authGuard` (protects all app routes), `tenantGuard` (ensures user has access to the active
  tenant), `projectGuard` (ensures user has a project role). All guards are standalone functions using `inject()`.
- **Resolvers (functional):** `projectResolver` fetches project data via `resource()` before activating project routes.

```typescript
// Functional guard example
// Auth is determined by the presence of `currentUser` (already loaded)
// or `token` (restored from localStorage — guard awaits fetchCurrentUser
// to validate the token before allowing navigation).
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (auth.currentUser()) return true;
  if (auth.token()) {
    try {
      await firstValueFrom(auth.fetchCurrentUser());
      return true;
    } catch {
      return router.parseUrl('/auth/login');
    }
  }
  return router.parseUrl('/auth/login');
};
```

### 7.4 State management

All state is signal-based. Stores are plain Angular services using `signal()`, `computed()`, `linkedSignal()`, and
`resource()` — no external state management library.

| Concern         | Mechanism                              | Key APIs                                                                                                                                                                 |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth state      | `inject(AuthStore)` — signal store     | `currentUser = signal<User \| null>(null)`, `token = signal<string \| null>(null)` — guard checks `currentUser()` first, then validates `token` via `fetchCurrentUser()` |
| Tenant context  | `inject(TenantService)` — signal store | `activeTenant = linkedSignal(() => this.tenants()[0])`, `tenants = resource({ loader: () => this.fetchTenants() })`                                                      |
| Project data    | `inject(ProjectStore)` — signal store  | `projects = resource({ loader: () => this.fetchProjects() })`, `currentProject = linkedSignal(() => this.projects()[0])`                                                 |
| Board/Task data | `inject(BoardStore)` — signal store    | `board = resource({ params: () => ({ id: this.boardId() }), loader: ({ params }) => this.fetchBoard(params.id) })`                                                       |
| UI state        | Component-level signals                | `showSidebar = signal(true)`, `selectedFilter = linkedSignal(() => FILTER_OPTIONS[0])`                                                                                   |

**`resource()` pattern** — replaces manual `HttpClient` subscription for data fetching:

```typescript
// Example: ProjectStore
@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantService);

  readonly projects = resource({
    params: () => ({ tenantId: this.tenant.activeTenant()?.id }),
    loader: async ({ params }) => {
      if (!params.tenantId) return [];
      return firstValueFrom(
        this.http.get<Project[]>(`/api/v1/projects`, {
          headers: { 'X-Tenant-Id': params.tenantId },
        }),
      );
    },
  });

  readonly currentProject = linkedSignal(() => this.projects.value()?.[0] ?? null);
}
```

**`linkedSignal()` pattern** — writable derived signal for user-selectable values:

```typescript
// Example: tenant switcher
readonly activeTenant = linkedSignal(() => this.tenants.value()?.[0] ?? null);

// User can explicitly set it (e.g. from a dropdown)
switchTenant(tenant: Tenant) {
  this.activeTenant.set(tenant);
}
```

### 7.5 Key components and their responsibilities

| Component          | Selector                | Responsibilities                                                 |
| ------------------ | ----------------------- | ---------------------------------------------------------------- |
| `app-shell`        | `<app-shell>`           | Root layout with sidebar, header, outlet                         |
| `board-view`       | `<app-board-view>`      | Renders the Kanban board with drag-and-drop column support       |
| `column-component` | `<app-column>`          | Renders a single column with its tasks                           |
| `task-card`        | `<app-task-card>`       | Displays task summary; click opens task detail                   |
| `task-form`        | `<app-task-form>`       | Create/edit task with assignee picker, priority, sprint selector |
| `sprint-backlog`   | `<app-sprint-backlog>`  | Shows backlog tasks and allows moving them into a sprint         |
| `tenant-switcher`  | `<app-tenant-switcher>` | Dropdown to switch active tenant                                 |
| `project-sidebar`  | `<app-project-sidebar>` | Lists project members, boards, sprints                           |

### 7.6 UI library and styling

- **Spartan UI** (`@spartan-ng/brain` + `@spartan-ng/helm` v0.12.0) for headless primitives and styled components
- **Tailwind CSS v4.1.0** — CSS-first configuration; no `tailwind.config.js`
- **Angular Signals** for reactive state; `@if`, `@for`, `@switch`, `@defer` for control flow
- **Signal Forms** (`@angular/forms` signal-based API) for form state management in task create/edit forms

#### Tailwind CSS v4 configuration

Tailwind v4 uses CSS-first configuration. Instead of `tailwind.config.js`, configure the theme directly in CSS:

```css
/* ui/src/styles.css */
@import 'tailwindcss';

@theme {
  --color-primary: oklch(0.623 0.214 259.815);
  --color-secondary: oklch(0.65 0.15 180);
  --color-accent: oklch(0.7 0.18 85);
  --font-sans: 'Inter', system-ui, sans-serif;
}

/* Component styles use standard Tailwind utilities */
```

No `content` configuration is needed — Tailwind v4 auto-detects source files.

### 7.7 HTTP layer

- `HttpClient` with functional interceptors for:
  - Attaching `Authorization: Bearer <token>` header
  - Attaching `X-Tenant-Id` header from the active tenant context
  - Global error handling (401 → redirect to login, 403 → show permission denied, 422 → show validation errors)
- Data fetching uses `resource()` / `httpResource()` which wraps `HttpClient` with signal integration — see Section 7.4
- Fallback: direct `HttpClient` calls return typed observables derived from shared package types when `resource()` is
  not suitable (e.g. fire-and-forget mutations)

**`httpResource()` pattern** — for simple typed HTTP GET resources:

```typescript
// Example: fetch a single project by ID
projectResource = httpResource(() => `/api/v1/projects/${this.projectId()}`, {
  defaultValue: null as Project | null,
  // parse handled by server-side validation
});
```

**Mutations** use direct `HttpClient` calls with signals for loading/error state:

```typescript
// Example: create a project
createProject(input: CreateProjectInput) {
  this.loading.set(true);
  return this.http.post<Project>('/api/v1/projects', input, {
    headers: { 'X-Tenant-Id': this.tenant.activeTenant()!.id },
  }).pipe(
    tap({
      next: (project) => { this.projects.update(list => [...list, project]); },
      error: (err) => { this.error.set(err.message); },
      finalize: () => { this.loading.set(false); },
    }),
  );
}
```

---

## 8. Backend Architecture

### 8.1 Hono route structure

```
server/src/
├── index.ts                    # Hono app bootstrap
├── middleware/
│   ├── auth.ts                 # JWT verification middleware
│   ├── tenant-context.ts       # Extracts tenantId from JWT, attaches to context
│   ├── rbac.ts                 # Role-based access control middleware
│   ├── validation.ts           # Zod v4 request body/query/param validation (schemas in server/src/schemas/)
│   └── error-handler.ts        # Global error handler → standardized error responses
├── routes/
│   ├── auth.ts                 # POST /auth/register, POST /auth/login, GET /auth/me
│   ├── tenants.ts              # CRUD for tenants and tenant members
│   ├── projects.ts             # CRUD for projects and project members
│   ├── boards.ts               # CRUD for boards
│   ├── columns.ts              # CRUD for columns + reorder
│   ├── tasks.ts                # CRUD for tasks + move + assign
│   ├── sprints.ts              # CRUD for sprints + add/remove tasks
│   └── index.ts                # Route aggregation and prefix mounting
├── services/
│   ├── auth.service.ts         # Registration, login, JWT issuance
│   ├── tenant.service.ts       # Tenant and tenant member business logic
│   ├── project.service.ts      # Project and project member business logic
│   ├── board.service.ts        # Board and column business logic
│   ├── task.service.ts         # Task CRUD, status transitions, assignment
│   ├── sprint.service.ts       # Sprint CRUD, task assignment to sprints
│   └── rbac.service.ts         # Permission checking utility
├── repositories/
│   ├── tenant.repository.ts    # MongoDB operations for tenants
│   ├── user.repository.ts      # MongoDB operations for users
│   ├── project.repository.ts   # MongoDB operations for projects
│   ├── board.repository.ts     # MongoDB operations for boards/columns
│   ├── task.repository.ts      # MongoDB operations for tasks
│   └── sprint.repository.ts    # MongoDB operations for sprints
├── db/
│   └── mongo.ts                # MongoDB connection and client setup
└── types/
    └── context.ts              # Hono context type extensions (tenantId, userId, etc.)
```

### 8.2 Middleware pipeline

Every request flows through this middleware chain:

```
Request → ErrorHandler → AuthMiddleware → TenantContextMiddleware → RBACMiddleware → ValidationMiddleware → RouteHandler
```

1. **ErrorHandler** — catches unhandled errors and returns standardized JSON error responses
2. **AuthMiddleware** — verifies JWT from `Authorization: Bearer <token>` header; sets `c.get('userId')` and
   `c.get('user')`
3. **TenantContextMiddleware** — resolves the active tenant from the user's `TenantMember` records; sets
   `c.get('tenantId')`. For routes that don't require a tenant (e.g., login), this is skipped.
4. **RBACMiddleware** — checks the user's role against the required permission for the route. Uses `rbac.service` to
   evaluate. Sets `c.get('userRole')`.
5. **ValidationMiddleware** — validates request body, query params, and path params against Zod v4 schemas from the
   server's `src/schemas/` directory. Uses `z.interface().parse()` / `.safeParse()`. Returns 422 with structured
   validation errors on failure.
6. **RouteHandler** — the actual endpoint handler, which delegates to the appropriate service.

### 8.3 Service layer design

Each service is a plain TypeScript class (no framework dependency) that:

- Receives `tenantId` as its first parameter on every method
- Delegates persistence to the corresponding repository
- Enforces business rules (e.g., only project admin can delete a board, only members can create tasks)
- Returns typed results that map directly to shared package types

**Example — `task.service.ts` method:**

```typescript
class TaskService {
  async moveTask(tenantId: string, userId: string, input: MoveTaskInput): Promise<Task> {
    // 1. Verify user has write access to the project
    // 2. Verify task belongs to the tenant
    // 3. Verify target column belongs to the same board
    // 4. Update task columnId, sprintId (if provided), and position
    // 5. Return updated task
  }
}
```

### 8.4 Repository layer design

Each repository:

- Receives a `MongoCollection` reference from the MongoDB Node.js Driver v7.0.0 (injected via factory or DI)
- Provides typed CRUD methods scoped by `tenantId`
- Handles MongoDB-specific concerns (ObjectId ↔ UUID conversion, projection, sorting)
- Returns plain TypeScript objects (no MongoDB driver types leak to services)
- Uses the driver's native async/await API (no callback patterns)

> **MongoDB Driver v7 note:** The v7 driver drops legacy callback APIs entirely. All operations return promises. Use
> `findOne()`, `insertOne()`, `updateOne()`, `deleteOne()`, `aggregate()` with `await` directly. The `Collection<T>`
> generic provides full type safety.

### 8.5 Auth and JWT

- **Registration:** `POST /auth/register` creates a user, hashes the password with bcrypt, and returns a JWT. **No
  tenant is auto-created.** The user starts with no tenants and must explicitly create or join a workspace.
- **Login:** `POST /auth/login` verifies credentials and returns a JWT. If the user has active tenant memberships, the
  JWT includes the first tenant's context. If the user has no tenants, the JWT is issued without tenant context
  (`tenantId: null`, `tenantRole: null`).
- **JWT payload (with tenant context):**

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440030",
  "email": "user@example.com",
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "tenantRole": "admin",
  "iat": 1719567600,
  "exp": 1719654000
}
```

- **JWT payload (without tenant context — new user with no workspaces):**

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440030",
  "email": "user@example.com",
  "tenantId": null,
  "tenantRole": null,
  "iat": 1719567600,
  "exp": 1719654000
}
```

- **Token strategy:** Access-token-only with 24-hour expiry. No refresh tokens in MVP. The frontend re-authenticates on
  401 by redirecting to login.
- **Signing:** HS256 with a secret stored in environment variables (`JWT_SECRET`).
- **Multi-tenant context:** The JWT contains the `tenantId` for the user's current active tenant. When the user switches
  tenants on the frontend, a new JWT is issued via `POST /auth/switch-tenant` (returns a new token with updated
  `tenantId` and `tenantRole` claims).
- **Accept invitation:** `POST /auth/accept-invitation` accepts a pending invitation by token. If the inviting email
  matches the authenticated user's email, the `TenantMember` record is updated: `userId` is set, `status` becomes
  `'active'`, and `invitationToken` is cleared. Returns a new JWT with the tenant context.

> **MVP decision (blocking question resolved):** JWT refresh strategy is access-token-only with 24h expiry. Refresh
> tokens are out of scope. If the token expires, the user is redirected to login. This is acceptable for an educational
> MVP.

### 8.6 Tenant context propagation

The `X-Tenant-Id` header is used by the frontend to indicate the active tenant. The backend middleware validates that
the authenticated user is an **active** member of the specified tenant (via `TenantMember` lookup with
`status: 'active'`). If the user is not an active member of the tenant, the request is rejected with 403. Users with
`status: 'declined'` or `status: 'access_revoked'` also receive 403. Users with no tenant context in their JWT can only
access tenant-independent endpoints (auth, invitation acceptance, workspace creation).

---

## 9. Acceptance Criteria

### 9.1 Functional acceptance criteria

| #     | Criterion                                                                     | Verification                                                                                  |
| ----- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| AC-1  | A user can register with email and password; **no tenant is auto-created**    | `POST /auth/register` returns 201 with user + JWT (no tenant in response)                     |
| AC-2  | A user can log in and receive a JWT                                           | `POST /auth/login` returns 200 with JWT; invalid credentials return 401                       |
| AC-3  | A user can create a workspace and become its owner                            | `POST /tenants` returns 201; user is auto-added as `owner` with `status: 'active'`            |
| AC-3a | A free user cannot create a second free workspace                             | `POST /tenants` with `subscription: 'free'` returns 403 when user already owns a free one     |
| AC-3b | Creating a workspace beyond the free limit requires `subscription: 'premium'` | `POST /tenants` with `subscription: 'premium'` succeeds                                       |
| AC-4  | A user can list their tenants (active memberships only)                       | `GET /tenants` returns 200 with array of tenant objects                                       |
| AC-5  | A tenant owner can invite a registered user by email                          | `POST /tenants/:tenantId/members` with registered email → `status: 'active'`                  |
| AC-5a | A tenant owner can invite an **unregistered** user by email                   | `POST /tenants/:tenantId/members` with new email → `status: 'pending'`, invitation email sent |
| AC-5b | An invited unregistered user can accept invitation after registering          | Register → `POST /auth/accept-invitation` with token → membership becomes `active`            |
| AC-5c | `GET /invitations/:token` returns invitation details without authentication   | Public endpoint returns tenant name, email, role, status                                      |
| AC-6  | A tenant admin can create a project                                           | `POST /projects` returns 201; project has `tenantId`                                          |
| AC-6a | A free workspace cannot exceed 3 projects                                     | 4th `POST /projects` on a free tenant returns 403 with `SUBSCRIPTION_LIMIT_EXCEEDED`          |
| AC-6b | A premium workspace has no project limit                                      | `POST /projects` on a premium tenant succeeds regardless of count                             |
| AC-7  | A project admin can create a board with custom columns                        | `POST /boards` creates board + columns; `GET /boards/:boardId` returns board with columns     |
| AC-8  | A developer can create a task in a project                                    | `POST /tasks` returns 201; task has `tenantId`, `projectId`, `boardId`, `columnId`            |
| AC-9  | A developer can move a task between columns                                   | `PATCH /tasks/:taskId/move` updates `columnId` and `position`                                 |
| AC-10 | A developer can assign users to a task                                        | `PATCH /tasks/:taskId/assign` updates `assigneeIds`                                           |
| AC-11 | A project admin can create a sprint                                           | `POST /sprints` returns 201                                                                   |
| AC-12 | A project admin can move a task from backlog into a sprint                    | `POST /sprints/:sprintId/tasks` adds task to sprint; task's `sprintId` is updated             |
| AC-13 | A viewer cannot create, edit, or delete tasks                                 | `POST /tasks` returns 403 for viewer role                                                     |
| AC-14 | A user from tenant A cannot access data from tenant B                         | `GET /projects` with tenant B's ID returns 403 or empty list                                  |
| AC-15 | All API responses conform to shared types                                     | Integration tests validate response shapes against server schemas                             |
| AC-16 | The frontend renders a Kanban board with columns and tasks                    | Board view displays columns in order; tasks are draggable between columns                     |
| AC-17 | The frontend enforces RBAC in the UI                                          | Viewers see read-only views; unauthorized actions are hidden/disabled                         |
| AC-18 | Tenant isolation is enforced at the database level                            | All MongoDB queries include `tenantId` filter; no cross-tenant data is returned               |
| AC-19 | A `pending` member cannot access any tenant resource                          | API calls with pending membership JWT return 403                                              |
| AC-20 | A free workspace cannot exceed 10 users per project                           | 11th member addition to a project in a free tenant returns 403                                |

### 9.2 Non-functional acceptance criteria

| #    | Criterion                          | Target                                                                                                                                            |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-1 | API response time                  | < 200ms for CRUD operations (p95)                                                                                                                 |
| NF-2 | Tenant isolation query performance | Queries with `tenantId` index scan complete in < 50ms for up to 10K documents                                                                     |
| NF-3 | Test coverage                      | ≥ 80% unit test coverage on services and repositories                                                                                             |
| NF-4 | E2E tests                          | Critical user journeys (register → create tenant → create project → create board → create task → move task → create sprint) covered by Playwright |
| NF-5 | Linting and formatting             | ESLint + Prettier pass with zero errors                                                                                                           |
| NF-6 | Type safety                        | Zero TypeScript errors in the monorepo (`tsc --noEmit`)                                                                                           |
| NF-7 | Build                              | Frontend and backend build successfully via `npm run build`                                                                                       |

---

## 10. Vertical Slice Plan

The first deployable slice delivers the **core Kanban flow** end-to-end: auth → tenant → project → board → tasks →
sprints, with RBAC enforced throughout.

### 10.1 Slice breakdown

| Step | Feature                            | Backend work                                                                               | Frontend work                                                                          |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1    | **Auth**                           | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`; JWT issuance; password hashing  | Login/Register pages; auth state store; auth guard                                     |
| 2    | **Tenant context**                 | `GET /tenants`, `POST /tenants`; tenant member resolution middleware                       | Tenant switcher in header; tenant guard                                                |
| 3    | **Project CRUD**                   | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`; project member management          | Project list page; project creation modal; project detail page                         |
| 4    | **Board + Columns**                | `GET/POST /boards`, `GET/PATCH/DELETE /boards/:id`; column CRUD; column reorder            | Board view with columns; column creation; task cards in columns                        |
| 5    | **Task CRUD + Move**               | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`; move task endpoint; assign task endpoint | Task creation modal; task detail panel; drag-and-drop between columns; assignee picker |
| 6    | **Sprint CRUD + Backlog → Sprint** | `GET/POST /sprints`, `GET/PATCH/DELETE /sprints/:id`; add/remove tasks from sprint         | Sprint list; sprint creation; backlog view; move tasks from backlog to sprint          |
| 7    | **RBAC enforcement**               | Role-check middleware on all routes; permission service                                    | UI hides/disabled unauthorized actions; role-based visibility                          |

### 10.2 Deployment order

1. **Shared package** — types, constants (foundation for both frontend and backend)
2. **Backend skeleton** — Hono app, middleware pipeline, error handler, MongoDB connection
3. **Auth + Tenant** — register, login, tenant CRUD, tenant context middleware
4. **Project + Board** — project CRUD, board + column CRUD
5. **Task** — task CRUD, move, assign
6. **Sprint** — sprint CRUD, backlog → sprint movement
7. **RBAC** — permission middleware, role checks on all endpoints
8. **Frontend** — Angular app shell, auth pages, tenant switcher, project pages, board view, task forms, sprint views
9. **Integration** — connect frontend to backend, end-to-end testing
10. **Hardening** — linting, tests, CI/CD pipeline

### 10.3 Key integration points

- **Shared package** is the single source of truth for types and validation. Both frontend and backend import from it.
- **Tenant context** flows from JWT → backend middleware → service layer → repository layer. On the frontend, it flows
  from auth store → HTTP interceptor → API calls.
- **RBAC** is enforced on the backend for all write operations and all read operations that expose data the user
  shouldn't see. The frontend uses RBAC to conditionally render UI elements.

---

## 11. Resolved Blocking Questions

The following blocking questions from the initial draft have been resolved with sensible defaults:

| #          | Question                                                                                                                                                                | Resolution                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BQ-1       | What JWT refresh strategy is acceptable for MVP?                                                                                                                        | **Access-token-only with 24h expiry.** No refresh tokens. The frontend re-authenticates on 401. See §8.5.                                                                                                                                                                                                                |
| BQ-2       | Should default column names be configurable per board or fixed?                                                                                                         | **Configurable.** `CreateBoardSchema.columnNames` accepts an array of column names. `DefaultColumnNames` constant (`['Backlog', 'To Do', 'In Progress', 'Review', 'Done']`) is used as a fallback when no columns are specified. See §6.6.                                                                               |
| BQ-3       | Is there a requirement for task comments or activity logs in MVP?                                                                                                       | **Out of scope.** Task comments and activity logs are excluded from the MVP vertical slice. They may be added in a future iteration.                                                                                                                                                                                     |
| BQ-4       | What password reset / email verification flow is expected?                                                                                                              | **Out of scope for MVP.** Basic email/password auth without password reset or email verification. Users register and log in directly. These features may be added post-MVP.                                                                                                                                              |
| BQ-5       | Should registration auto-create a tenant?                                                                                                                               | **No.** Registration creates only the user. The user must explicitly create a workspace via `POST /tenants`. A newly registered user starts with zero tenants. See §8.5.                                                                                                                                                 |
| BQ-6       | How are subscription tiers modeled for MVP (without billing)?                                                                                                           | **Simple field on Tenant.** `Tenant.subscription` is `'free'` or `'premium'`. Free users can own one free workspace. Premium workspaces are unlimited. For MVP, subscription upgrade uses a **mock payment page** (no real payment processing). See §14.5.                                                               |
| BQ-7       | How do invitations work for unregistered users?                                                                                                                         | **TenantMember with nullable userId.** A pending `TenantMember` record is created with `invitedEmail`, `invitationToken`, and `status: 'pending'`. On registration + acceptance, `userId` is set and `status` becomes `'active'`. See §14.                                                                               |
| BQ-EMAIL-1 | What email delivery infrastructure is used for invitation emails?                                                                                                       | **Resend (free tier).** 3,000 emails/month, 100/day. Simple REST API via `resend` npm package. `RESEND_API_KEY` stored as Cloudflare Worker secret. Console-logging adapter used in development. See §14.4.                                                                                                              |
| BQ-DASH-1  | The `GET /tenants` endpoint returns `Tenant[]` without the user's role per tenant. The dashboard state detection (State 3 vs State 4) requires knowing the user's role. | **Resolved:** Extend `GET /tenants` response to include `role` field per tenant. The endpoint queries `tenant_members` for the current user and joins with `tenants`. See §4.3.                                                                                                                                          |
| BQ-DASH-2  | The decline invitation flow needs a product decision on soft-delete vs hard-delete.                                                                                     | **Resolved:** Soft-delete for declining (`status: 'declined'`). Additionally, add `'access_revoked'` status for owner/admin revocation. Both `declined` and `access_revoked` members remain in the member list but have no access. Owner/admin can resend invitation (→ `pending`) or hard-delete permanently. See §3.1. |
| BQ-DASH-3  | The `GET /tasks/my` cross-tenant endpoint joins tasks with multiple collections. Should denormalized fields be stored on the Task document or joined at query time?     | **Resolved:** Application-level aggregation. Different tenants could theoretically be in different databases, so cross-tenant aggregation must happen at the application level. See §15.10.2.                                                                                                                            |

---

## 12. Missing UI Features

> **Status:** To be implemented. Backend APIs are fully deployed; frontend UI is missing. **Date added:** 2026-07-29

This section covers UI features that have working backend endpoints but no corresponding Angular frontend
implementation. Each subsection defines the scope, user stories, acceptance criteria, component design, route structure,
and API integration details.

### 12.1 Tenant Member Management

**Current state:** The backend exposes `POST /tenants/:tenantId/members`, `PATCH /tenants/:tenantId/members/:userId`,
and `DELETE /tenants/:tenantId/members/:userId`. The [`TenantClient`](ui/src/app/services/tenant-client.ts:13) service
only has [`loadTenants()`](ui/src/app/services/tenant-client.ts:28) and
[`setActiveTenant()`](ui/src/app/services/tenant-client.ts:52) — no member management methods exist.

#### 12.1.1 User stories

| #    | As a…         | I want to…                                              | So that…                                            |
| ---- | ------------- | ------------------------------------------------------- | --------------------------------------------------- |
| TM-1 | Tenant owner  | Invite a user by email with a role                      | New team members can join my organization           |
| TM-2 | Tenant owner  | View a list of all tenant members with their roles      | I know who has access                               |
| TM-3 | Tenant owner  | Change a member's role (admin ↔ member)                 | I can adjust permissions as responsibilities change |
| TM-4 | Tenant owner  | Remove a member from the tenant                         | I can revoke access for departed users              |
| TM-5 | Tenant admin  | Invite members and manage member roles (but not owners) | Admins can help manage the team                     |
| TM-6 | Tenant member | View the member list (read-only)                        | I can see who is in my organization                 |

#### 12.1.2 Acceptance criteria

| #        | Criterion                                                                                              | Verification                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| AC-TM-1  | A tenant owner/admin sees an "Invite Member" button on the tenant settings or a dedicated members page | Button is visible; clicking opens an invite dialog                              |
| AC-TM-2  | The invite dialog accepts an email and a role (`owner` / `admin` / `member`) dropdown                  | Form submits `POST /tenants/:tenantId/members` with `{ email, role }`           |
| AC-TM-3  | After a successful invite, the member list refreshes and shows the new member                          | New member appears in the list with correct role badge                          |
| AC-TM-4  | A member list displays each member with avatar fallback, user ID (or email if resolved), and role      | Visual layout matches the project member list pattern                           |
| AC-TM-5  | An owner/admin can change a member's role via a `NativeSelect` dropdown inline in the member row       | Selecting a new role calls `PATCH /tenants/:tenantId/members/:userId`           |
| AC-TM-6  | An owner/admin can remove a member via a delete button with a confirmation dialog                      | Confirming calls `DELETE /tenants/:tenantId/members/:userId`; member removed    |
| AC-TM-7  | The owner cannot be removed or have their role changed                                                 | Remove/edit controls are disabled or hidden for the owner row                   |
| AC-TM-8  | An admin cannot promote someone to `owner` or remove the owner                                         | API returns 403; UI disables `owner` option in the role selector for non-owners |
| AC-TM-9  | A tenant member (non-admin) sees the member list but no invite/edit/remove controls                    | Read-only view; no action buttons rendered                                      |
| AC-TM-10 | Error states (invalid email, user not found, duplicate membership) are displayed inline                | Error message shown below the invite form or as a toast                         |

#### 12.1.3 `TenantClient` extension

The [`TenantClient`](ui/src/app/services/tenant-client.ts:13) service must be extended with the following methods. Types
[`TenantMember`](shared/src/types/tenant.ts:14) and [`TenantRole`](shared/src/constants/roles.ts:2) are already defined
in the shared package.

```typescript
// Methods to add to TenantClient:

/** List members of a tenant */
listMembers(tenantId: string): Observable<{ data: TenantMember[] }>

/** Invite a member by email with a role */
inviteMember(tenantId: string, email: string, role: TenantRole): Observable<TenantMember>

/** Update a member's role */
updateMemberRole(tenantId: string, userId: string, role: TenantRole): Observable<TenantMember>

/** Remove a member from the tenant */
removeMember(tenantId: string, userId: string): Observable<void>
```

> **Note:** The backend invite endpoint (`POST /tenants/:tenantId/members`) accepts `{ email, role }` in the body (not
> `userId`). This is different from the project member add endpoint which accepts `{ userId, role }`.

#### 12.1.4 UI component design

**New component: `TenantMemberListComponent`**

| Aspect           | Detail                                                                            |
| ---------------- | --------------------------------------------------------------------------------- |
| **Selector**     | `ui-tenant-member-list`                                                           |
| **Location**     | `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts`            |
| **Standalone**   | Yes                                                                               |
| **Dependencies** | `TenantClient`, `AuthStore` (to check current user's tenant role for RBAC gating) |

**Spartan UI components used:**

| Component                | Usage                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| `HlmButtonImports`       | "Invite Member" button; "Remove" action button; dialog confirm/cancel buttons |
| `HlmDialogImports`       | Invite member dialog; remove confirmation dialog                              |
| `HlmFieldImports`        | Form field wrappers for email input and role select                           |
| `HlmInputImports`        | Email input field in invite dialog                                            |
| `HlmNativeSelectImports` | Role dropdown (`owner`/`admin`/`member`) in invite dialog and inline in rows  |
| `HlmBadgeImports`        | Role badge next to each member                                                |
| `HlmAvatarImports`       | Avatar fallback with user initials                                            |
| `HlmSpinnerImports`      | Loading state while fetching members                                          |

**Template structure:**

```
<div>
  <!-- Header with invite button (visible only for owner/admin) -->
  <div class="flex items-center justify-between">
    <h3>Members</h3>
    @if (canManageMembers()) {
      <button hlmBtn (click)="showInviteDialog.set(true)">Invite Member</button>
    }
  </div>

  <!-- Member list -->
  @if (loading()) {
    <hlm-spinner />
  } @else {
    <div class="rounded-lg border">
      @for (member of members(); track member.userId) {
        <div class="flex items-center justify-between px-4 py-3">
          <!-- Avatar + user info -->
          <div class="flex items-center gap-3">
            <hlm-avatar><div hlmAvatarFallback>{{ initials(member) }}</div></hlm-avatar>
            <span>{{ member.userId }}</span>
          </div>
          <!-- Role control -->
          @if (canManageMembers() && !isOwner(member)) {
            <hlm-native-select [value]="member.role" (valueChange)="changeRole(member, $event)">
              @for (role of availableRoles(); track role) {
                <option [value]="role">{{ role }}</option>
              }
            </hlm-native-select>
            <button hlmBtn variant="destructive" size="sm" (click)="confirmRemove(member)">Remove</button>
          } @else {
            <span hlmBadge variant="secondary">{{ member.role }}</span>
          }
        </div>
      }
    </div>
  }
</div>

<!-- Invite Dialog -->
<hlm-dialog ...>
  <hlm-dialog-content *hlmDialogPortal>
    <hlm-dialog-header><h3 hlmDialogTitle>Invite Member</h3></hlm-dialog-header>
    <form>
      <hlm-field>
        <label hlmFieldLabel>Email</label>
        <input hlmInput type="email" [(ngModel)]="inviteEmail" />
      </hlm-field>
      <hlm-field>
        <label hlmFieldLabel>Role</label>
        <hlm-native-select [(ngModel)]="inviteRole">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </hlm-native-select>
      </hlm-field>
    </form>
    <hlm-dialog-footer>
      <button hlmBtn variant="outline" hlmDialogClose>Cancel</button>
      <button hlmBtn (click)="inviteMember()" [disabled]="inviting()">
        @if (inviting()) { <hlm-spinner /> Inviting... } @else { Invite }
      </button>
    </hlm-dialog-footer>
  </hlm-dialog-content>
</hlm-dialog>

<!-- Remove Confirmation Dialog -->
<hlm-dialog ...>
  <hlm-dialog-content *hlmDialogPortal>
    <hlm-dialog-header><h3 hlmDialogTitle>Remove Member</h3></hlm-dialog-header>
    <p>Are you sure you want to remove this member?</p>
    <hlm-dialog-footer>
      <button hlmBtn variant="outline" hlmDialogClose>Cancel</button>
      <button hlmBtn variant="destructive" (click)="removeMember()">Remove</button>
    </hlm-dialog-footer>
  </hlm-dialog-content>
</hlm-dialog>
```

#### 12.1.5 Route structure

| Option              | Route                                 | Description                              |
| ------------------- | ------------------------------------- | ---------------------------------------- |
| **A (recommended)** | `/tenants/:tenantId/settings/members` | Nested under tenant settings (see §12.2) |
| B                   | `/tenants/:tenantId/members`          | Standalone route at tenant level         |

Option A is recommended because tenant member management is a tenant-level administrative action and belongs alongside
tenant settings (name, slug, delete). This avoids adding a top-level navigation item.

#### 12.1.6 Angular 22 patterns

- **Signals:** `members = signal<TenantMember[]>([])`, `loading = signal(false)`, `showInviteDialog = signal(false)`
- **`computed()`:**
  `canManageMembers = computed(() => { const role = this.currentUserTenantRole(); return role === 'owner' || role === 'admin'; })`
- **`@if` / `@for` control flow** for conditional rendering and list iteration
- **`inject()`** for dependency injection of `TenantClient` and `AuthStore`
- **Standalone component** — no NgModule
- **`FormsModule`** with `ngModel` for form bindings in the invite dialog

#### 12.1.7 Blocking question

> **BQ-TM-1:** The server [`tenants.ts`](server/src/routes/tenants.ts:94) route file does not include a
> `GET /:tenantId/members` endpoint (to list tenant members), although the server contract
> [`tenant.contracts.ts`](server/src/contracts/tenant.contracts.ts:74) defines it as `listMembers`. This endpoint must
> be verified as deployed or added to the backend before the member list UI can function. **This is a blocking
> dependency.**

---

### 12.2 Tenant Settings Page

**Current state:** The backend exposes `PATCH /tenants/:tenantId` (update name/slug) and `DELETE /tenants/:tenantId`
(delete tenant). No settings UI exists anywhere in the frontend.

#### 12.2.1 User stories

| #    | As a…         | I want to…                             | So that…                                        |
| ---- | ------------- | -------------------------------------- | ----------------------------------------------- |
| TS-1 | Tenant owner  | View and edit the tenant name and slug | I can correct typos or rebrand the organization |
| TS-2 | Tenant owner  | Delete the tenant with confirmation    | I can permanently remove an unused organization |
| TS-3 | Tenant admin  | View and edit the tenant name and slug | Admins can manage basic tenant info             |
| TS-4 | Tenant member | View the tenant settings (read-only)   | I can see the organization details              |

#### 12.2.2 Acceptance criteria

| #       | Criterion                                                                                    | Verification                                                                        |
| ------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AC-TS-1 | A tenant settings page is accessible at `/tenants/:tenantId/settings`                        | Route loads; page renders with current tenant name and slug                         |
| AC-TS-2 | The page displays the tenant name and slug in editable input fields                          | Fields are pre-populated with current values from `TenantClient.activeTenant()`     |
| AC-TS-3 | An owner/admin can edit the name and slug and save changes                                   | "Save" button calls `PATCH /tenants/:tenantId` with updated fields                  |
| AC-TS-4 | After a successful update, the tenant list and active tenant in `TenantClient` are refreshed | `activeTenant()` signal reflects the new name/slug                                  |
| AC-TS-5 | A "Delete Tenant" button is visible only to the owner                                        | Button is hidden for admin and member roles                                         |
| AC-TS-6 | Clicking "Delete Tenant" opens a confirmation dialog requiring the tenant name to be typed   | Prevents accidental deletion; confirmation input must match tenant name             |
| AC-TS-7 | Confirming deletion calls `DELETE /tenants/:tenantId` and redirects to the dashboard         | User lands on `/dashboard`; deleted tenant is removed from `TenantClient.tenants()` |
| AC-TS-8 | Validation errors (e.g., slug already taken) are displayed inline                            | Error message appears below the slug field                                          |
| AC-TS-9 | Members see the settings page in read-only mode (inputs disabled, no delete button)          | Fields are disabled; save/delete buttons are hidden                                 |

#### 12.2.3 `TenantClient` extension

```typescript
// Methods to add to TenantClient:

/** Update tenant name/slug */
updateTenant(tenantId: string, data: UpdateTenant): Observable<Tenant>

/** Delete a tenant */
deleteTenant(tenantId: string): Observable<void>
```

Type [`UpdateTenant`](shared/src/types/tenant.ts:11) is already defined in the shared package.

#### 12.2.4 UI component design

**New component: `TenantSettingsComponent`**

| Aspect           | Detail                                                           |
| ---------------- | ---------------------------------------------------------------- |
| **Selector**     | `ui-tenant-settings`                                             |
| **Location**     | `ui/src/app/features/tenants/tenant-settings/tenant-settings.ts` |
| **Standalone**   | Yes                                                              |
| **Dependencies** | `TenantClient`, `AuthStore`, `Router`                            |

**Spartan UI components used:**

| Component           | Usage                                                 |
| ------------------- | ----------------------------------------------------- |
| `HlmButtonImports`  | "Save" button; "Delete Tenant" button; dialog buttons |
| `HlmDialogImports`  | Delete confirmation dialog                            |
| `HlmFieldImports`   | Field wrappers for name and slug inputs               |
| `HlmInputImports`   | Text inputs for tenant name and slug                  |
| `HlmSpinnerImports` | Loading state; saving state                           |

**Template structure:**

```
<div class="mx-auto max-w-2xl">
  <h2>Tenant Settings</h2>

  @if (loading()) {
    <hlm-spinner />
  } @else {
    <!-- Edit form -->
    <form (ngSubmit)="save()" class="space-y-4">
      <hlm-field>
        <label hlmFieldLabel>Name</label>
        <input hlmInput [(ngModel)]="form.name" name="name" [disabled]="!canEdit()" />
      </hlm-field>
      <hlm-field>
        <label hlmFieldLabel>Slug</label>
        <input hlmInput [(ngModel)]="form.slug" name="slug" [disabled]="!canEdit()" />
      </hlm-field>
      @if (error()) {
        <p class="text-sm text-destructive">{{ error() }}</p>
      }
      @if (canEdit()) {
        <button hlmBtn (click)="save()" [disabled]="saving()">
          @if (saving()) { <hlm-spinner /> Saving... } @else { Save Changes }
        </button>
      }
    </form>

    <!-- Danger zone -->
    @if (isOwner()) {
      <div class="mt-8 rounded-lg border border-destructive/30 p-4">
        <h3 class="text-destructive font-semibold">Danger Zone</h3>
        <p class="text-sm text-muted-foreground mt-1">
          Deleting a tenant is permanent and cannot be undone.
        </p>
        <button hlmBtn variant="destructive" class="mt-3" (click)="showDeleteDialog.set(true)">
          Delete Tenant
        </button>
      </div>
    }
  }
</div>

<!-- Delete Confirmation Dialog -->
<hlm-dialog ...>
  <hlm-dialog-content *hlmDialogPortal>
    <hlm-dialog-header><h3 hlmDialogTitle>Delete Tenant</h3></hlm-dialog-header>
    <p>Type the tenant name <strong>{{ tenantName() }}</strong> to confirm:</p>
    <input hlmInput [(ngModel)]="confirmName" placeholder="Type tenant name..." />
    <hlm-dialog-footer>
      <button hlmBtn variant="outline" hlmDialogClose>Cancel</button>
      <button hlmBtn variant="destructive" [disabled]="confirmName !== tenantName()" (click)="deleteTenant()">
        @if (deleting()) { <hlm-spinner /> Deleting... } @else { Delete Permanently }
      </button>
    </hlm-dialog-footer>
  </hlm-dialog-content>
</hlm-dialog>
```

#### 12.2.5 Route structure

```
/tenants/:tenantId
  /settings                  ← TenantSettingsComponent (new)
    /members                 ← TenantMemberListComponent (new, see §12.1)
```

Both routes are children of the existing `tenants/:tenantId` route in [`app.routes.ts`](ui/src/app/app.routes.ts:27) and
rendered inside the [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts) outlet.

```typescript
// Addition to app.routes.ts children array:
{
  path: 'settings',
  loadComponent: () => import('./features/tenants/tenant-settings/tenant-settings').then(m => m.TenantSettings),
},
{
  path: 'settings/members',
  loadComponent: () => import('./features/tenants/tenant-member-list/tenant-member-list').then(m => m.TenantMemberList),
},
```

#### 12.2.6 Sidebar navigation

The [`SidebarComponent`](ui/src/app/shell/sidebar/sidebar.html) should include a "Settings" link that navigates to
`/tenants/:tenantId/settings`. This link should be visible to all tenant members but the settings content enforces its
own RBAC (read-only for members, editable for admin/owner, deletable for owner only).

---

### 12.3 Project Member Management

**Current state:** [`ProjectClient`](ui/src/app/services/project-client.ts:16) already has
[`listMembers()`](ui/src/app/services/project-client.ts:48), [`addMember()`](ui/src/app/services/project-client.ts:53),
[`updateMemberRole()`](ui/src/app/services/project-client.ts:58), and
[`removeMember()`](ui/src/app/services/project-client.ts:63). The
[`ProjectDetail`](ui/src/app/features/projects/project-detail/project-detail.ts:38) component loads and displays members
with avatar + role badge in [`project-detail.html`](ui/src/app/features/projects/project-detail/project-detail.html:54),
but **no UI exists for adding, removing, or changing roles**.

#### 12.3.1 User stories

| #    | As a…             | I want to…                                              | So that…                                          |
| ---- | ----------------- | ------------------------------------------------------- | ------------------------------------------------- |
| PM-1 | Project admin     | Add a tenant member to the project with a specific role | I can grant project access to specific people     |
| PM-2 | Project admin     | Change a project member's role                          | I can adjust their permissions within the project |
| PM-3 | Project admin     | Remove a member from the project                        | I can revoke project-level access                 |
| PM-4 | Project developer | View the member list (read-only)                        | I can see who is on the project                   |
| PM-5 | Project viewer    | View the member list (read-only)                        | I can see who is on the project                   |

#### 12.3.2 Acceptance criteria

| #       | Criterion                                                                                        | Verification                                                            |
| ------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| AC-PM-1 | The project detail page shows an "Add Member" button for project admins                          | Button visible only when current user has `project:admin` role          |
| AC-PM-2 | Clicking "Add Member" opens a dialog with a user picker and role selector                        | Dialog renders with tenant members as selectable options                |
| AC-PM-3 | Submitting the add-member form calls `POST /projects/:projectId/members` with `{ userId, role }` | New member appears in the list after refresh                            |
| AC-PM-4 | A project admin can change a member's role inline via a `NativeSelect` dropdown                  | Selecting a new role calls `PATCH /projects/:projectId/members/:userId` |
| AC-PM-5 | A project admin can remove a member with a confirmation step                                     | Confirming calls `DELETE /projects/:projectId/members/:userId`          |
| AC-PM-6 | Non-admin users see the member list but no add/edit/remove controls                              | Read-only view; action buttons hidden                                   |
| AC-PM-7 | The project admin cannot remove themselves if they are the last admin                            | API returns 403; UI disables remove for the last admin                  |
| AC-PM-8 | Error states are displayed inline (e.g., user already a member)                                  | Error message shown in the dialog or as a toast                         |

#### 12.3.3 UI component design

**Approach:** Extend the existing [`ProjectDetail`](ui/src/app/features/projects/project-detail/project-detail.ts:38)
component rather than creating a separate component. The member section already exists in
[`project-detail.html`](ui/src/app/features/projects/project-detail/project-detail.html:54) — it needs to be augmented
with action controls.

**Changes to [`ProjectDetail`](ui/src/app/features/projects/project-detail/project-detail.ts:38):**

| Aspect            | Change                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New signals**   | `showAddMember = signal(false)`, `addingMember = signal(false)`, `selectedUserId = signal('')`, `selectedRole = signal<ProjectRole>('developer')` |
| **New inputs**    | Tenant member list fetched via `TenantClient.listMembers()` for the user picker                                                                   |
| **New imports**   | `HlmNativeSelectImports` for role dropdown; extend existing `HlmDialogImports`                                                                    |
| **RBAC computed** | `canManageMembers = computed(() => currentUserProjectRole() === 'admin')`                                                                         |

**Spartan UI components used (additional to existing):**

| Component                | Usage                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| `HlmNativeSelectImports` | Role dropdown in add-member dialog and inline role selector      |
| `HlmDialogImports`       | Add-member dialog; remove confirmation dialog (already imported) |
| `HlmButtonImports`       | "Add Member" button; remove action button (already imported)     |

**Template changes to the members section:**

```
<!-- Members section (enhanced) -->
<section>
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold text-foreground">Members</h3>
    @if (canManageMembers()) {
      <button hlmBtn size="sm" (click)="showAddMember.set(true)">
        <ng-icon name="lucidePlus" class="mr-1" /> Add Member
      </button>
    }
  </div>

  @if (members().length === 0) {
    <p class="text-sm text-muted-foreground">No members yet.</p>
  } @else {
    <div class="rounded-lg border border-border">
      @for (member of members(); track member.userId) {
        <div class="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
          <div class="flex items-center gap-3">
            <hlm-avatar class="h-8 w-8">
              <div hlmAvatarFallback class="text-xs font-medium">
                {{ member.userId.substring(0, 2).toUpperCase() }}
              </div>
            </hlm-avatar>
            <span class="text-sm text-foreground">{{ member.userId }}</span>
          </div>
          <div class="flex items-center gap-2">
            @if (canManageMembers()) {
              <hlm-native-select [value]="member.role" (valueChange)="changeProjectRole(member, $event)">
                @for (role of projectRoles; track role) {
                  <option [value]="role">{{ role }}</option>
                }
              </hlm-native-select>
              <button hlmBtn variant="destructive" size="sm" (click)="confirmRemoveProjectMember(member)">
                Remove
              </button>
            } @else {
              <span hlmBadge variant="secondary">{{ member.role }}</span>
            }
          </div>
        </div>
      }
    </div>
  }
</section>

<!-- Add Member Dialog -->
<hlm-dialog [state]="showAddMember() ? 'open' : 'closed'" (stateChanged)="onAddMemberDialogStateChange($event)">
  <hlm-dialog-content *hlmDialogPortal>
    <hlm-dialog-header><h3 hlmDialogTitle>Add Member</h3></hlm-dialog-header>
    <form class="space-y-4">
      <hlm-field>
        <label hlmFieldLabel>User</label>
        <hlm-native-select [(ngModel)]="selectedUserId" name="userId">
          <option value="" disabled>Select a user...</option>
          @for (user of tenantMembers(); track user.userId) {
            <option [value]="user.userId">{{ user.userId }}</option>
          }
        </hlm-native-select>
      </hlm-field>
      <hlm-field>
        <label hlmFieldLabel>Role</label>
        <hlm-native-select [(ngModel)]="selectedRole" name="role">
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
          <option value="viewer">Viewer</option>
        </hlm-native-select>
      </hlm-field>
    </form>
    <hlm-dialog-footer>
      <button hlmBtn variant="outline" hlmDialogClose>Cancel</button>
      <button hlmBtn (click)="addProjectMember()" [disabled]="addingMember()">
        @if (addingMember()) { <hlm-spinner /> Adding... } @else { Add Member }
      </button>
    </hlm-dialog-footer>
  </hlm-dialog-content>
</hlm-dialog>
```

#### 12.3.4 API integration

All methods already exist on [`ProjectClient`](ui/src/app/services/project-client.ts:16):

| Action        | Method                                                                                  | API call                                      |
| ------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| List members  | [`listMembers(projectId)`](ui/src/app/services/project-client.ts:48)                    | `GET /projects/:projectId/members`            |
| Add member    | [`addMember(projectId, userId, role)`](ui/src/app/services/project-client.ts:53)        | `POST /projects/:projectId/members`           |
| Update role   | [`updateMemberRole(projectId, userId, role)`](ui/src/app/services/project-client.ts:58) | `PATCH /projects/:projectId/members/:userId`  |
| Remove member | [`removeMember(projectId, userId)`](ui/src/app/services/project-client.ts:63)           | `DELETE /projects/:projectId/members/:userId` |

The tenant member list (for the user picker in the add-member dialog) must be fetched from `TenantClient.listMembers()`
(new method, see §12.1.3).

#### 12.3.5 Route structure

No new routes. This feature is an enhancement to the existing
[`ProjectDetail`](ui/src/app/features/projects/project-detail/project-detail.ts:38) component at
`/tenants/:tenantId/projects/:projectId`.

---

### 12.4 Cross-cutting requirements

#### 12.4.1 Angular 22 patterns (applies to all features above)

| Pattern                             | Requirement                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| **Signals**                         | All state managed via `signal()`, `computed()`, `linkedSignal()`                        |
| **`resource()` / `httpResource()`** | Use for data fetching where appropriate; fall back to direct `HttpClient` for mutations |
| **`@if` / `@for` / `@switch`**      | Built-in control flow only; no `*ngIf`, `*ngFor`, `ngSwitch`                            |
| **`inject()`**                      | Function-based DI; no constructor injection                                             |
| **Standalone components**           | All new components are standalone; no NgModules                                         |
| **`FormsModule`**                   | Signal forms or `ngModel` for form bindings                                             |
| **`@defer`**                        | Lazy-load heavy dialogs or secondary content where beneficial                           |

#### 12.4.2 Spartan UI components (maximal usage required)

All new UI must use Spartan UI (`@spartan-ng/helm`) components. The following are available in the project:

| Component     | Import                   | Usage in this spec                                 |
| ------------- | ------------------------ | -------------------------------------------------- |
| Button        | `HlmButtonImports`       | All action buttons, dialog triggers                |
| Dialog        | `HlmDialogImports`       | Invite/add member, delete confirmation, all modals |
| Field + Label | `HlmFieldImports`        | Form field wrappers with labels and error messages |
| Input         | `HlmInputImports`        | Text inputs (email, name, slug)                    |
| Textarea      | `HlmTextareaImports`     | Description fields                                 |
| NativeSelect  | `HlmNativeSelectImports` | Role dropdowns in member lists and invite dialogs  |
| Badge         | `HlmBadgeImports`        | Role badges in member lists                        |
| Avatar        | `HlmAvatarImports`       | User avatar fallbacks in member lists              |
| Spinner       | `HlmSpinnerImports`      | Loading and submitting states                      |
| Separator     | `HlmSeparatorImports`    | Visual separation between sections                 |

#### 12.4.3 RBAC visibility rules

| UI Element                  | Tenant: owner | Tenant: admin | Tenant: member | Project: admin | Project: developer | Project: viewer |
| --------------------------- | :-----------: | :-----------: | :------------: | :------------: | :----------------: | :-------------: |
| Tenant settings page (edit) |      ✅       |      ✅       |       👁️       |       —        |         —          |        —        |
| Tenant delete button        |      ✅       |      ❌       |       ❌       |       —        |         —          |        —        |
| Tenant member invite        |      ✅       |      ✅       |       ❌       |       —        |         —          |        —        |
| Tenant member role change   |      ✅       |     ✅\*      |       ❌       |       —        |         —          |        —        |
| Tenant member remove        |      ✅       |     ✅\*      |       ❌       |       —        |         —          |        —        |
| Project member add          |       —       |       —       |       —        |       ✅       |         ❌         |       ❌        |
| Project member role change  |       —       |       —       |       —        |       ✅       |         ❌         |       ❌        |
| Project member remove       |       —       |       —       |       —        |       ✅       |         ❌         |       ❌        |

\* Admin cannot change the owner's role or remove the owner.

#### 12.4.4 Error handling

All new components must integrate with the existing
[`error.interceptor.ts`](ui/src/app/interceptors/error.interceptor.ts) pattern:

- **401** → redirect to `/auth/login`
- **403** → display "Permission denied" message; disable the action that triggered it
- **422** → display validation errors inline (below the relevant form field)
- **409 (conflict)** → display "Already exists" or similar message (e.g., user is already a member)
- **500** → display generic error toast

#### 12.4.5 Testing requirements

| Layer           | Requirement                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| **Unit**        | Each new component must have a `.spec.ts` with ≥ 80% coverage                          |
| **Unit**        | `TenantClient` member methods must have tests                                          |
| **Integration** | Member invite/remove flows tested with mocked HTTP                                     |
| **E2E**         | Playwright tests for: tenant member invite → project member add → role change → remove |

---

## 13. Updated Registration Flow (v3.0.0)

> **Date added:** 2026-07-29 **Replaces:** The auto-tenant creation in §8.5 registration flow.

### 13.1 What changed

In v2.0.0, `AuthService.register()` automatically created a personal tenant and added the user as owner. In v3.0.0,
registration creates **only the user**. The user starts with zero tenants and must explicitly create a workspace.

### 13.2 Registration flow (step by step)

```
1. Client sends POST /auth/register { email, password, displayName }
2. Server validates input (Zod schema)
3. Server checks email uniqueness
4. Server hashes password (bcrypt)
5. Server creates User document
6. Server generates JWT WITHOUT tenant context (tenantId: null, tenantRole: null)
7. Server returns { token, user }
```

### 13.3 Post-registration state

After registration, the user:

- Has a valid JWT (can call `/auth/me`, `/tenants`, `POST /tenants`)
- Has **no** tenant memberships
- Cannot access any tenant-scoped resources until they create or join a workspace
- The frontend should redirect to a "Create Workspace" or "Accept Invitation" screen

### 13.4 Workspace creation flow

```
1. Authenticated user sends POST /tenants { name, slug, subscription }
2. Server validates subscription limits (see §14)
3. Server creates Tenant document with the specified subscription tier
4. Server creates TenantMember { userId, tenantId, role: 'owner', status: 'active' }
5. Server returns Tenant
6. Frontend calls POST /auth/switch-tenant to get a JWT with tenant context
```

### 13.5 Login flow for users with no tenants

```
1. Client sends POST /auth/login { email, password }
2. Server verifies credentials
3. Server looks up user's TenantMember records
4. If no active memberships: JWT issued with tenantId: null
5. If memberships exist: JWT issued with first active tenant's context
6. Frontend checks tenantId in JWT; if null, redirects to workspace creation
```

---

## 14. Subscription Tiers & Invitation System

> **Date added:** 2026-07-29 **Status:** Defined for implementation.

### 14.1 Subscription tiers

| Tier      | Workspaces allowed | Projects per workspace | Users per project |
| --------- | ------------------ | ---------------------- | ----------------- |
| `free`    | 1 (owned by user)  | 3                      | 10                |
| `premium` | Unlimited          | Unlimited              | Unlimited         |

### 14.2 Subscription enforcement rules

| Rule # | Rule                                                                                                        | Enforcement point                |
| ------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------- |
| SE-1   | A user can own at most **one** free workspace                                                               | `TenantService.createTenant()`   |
| SE-2   | A user can own **unlimited** premium workspaces                                                             | `TenantService.createTenant()`   |
| SE-3   | A free workspace can have at most **3** projects                                                            | `ProjectService.createProject()` |
| SE-4   | A premium workspace has **no** project limit                                                                | N/A (always passes)              |
| SE-5   | A project in a free workspace can have at most **10** members (tenant members who are also project members) | `ProjectService.addMember()`     |
| SE-6   | A project in a premium workspace has **no** member limit                                                    | N/A (always passes)              |
| SE-7   | Subscription limits return error code `SUBSCRIPTION_LIMIT_EXCEEDED` with HTTP 403                           | All enforcement points           |

### 14.3 Invitation system

#### 14.3.1 Invitation flow for registered users

```
1. Owner/admin sends POST /tenants/:tenantId/members { email: "user@example.com", role: "member" }
2. Server looks up User by email → user found
3. Server checks: is user already an active member? → reject with 409
4. Server creates TenantMember { userId: user.id, tenantId, role, status: 'active', invitedEmail: email }
5. Server returns TenantMember with status: 'active'
```

#### 14.3.2 Invitation flow for unregistered users

```
1. Owner/admin sends POST /tenants/:tenantId/members { email: "new@example.com", role: "member" }
2. Server looks up User by email → user NOT found
3. Server generates a unique invitationToken (crypto.randomUUID)
4. Server creates TenantMember {
     userId: null,
     tenantId,
     role,
     status: 'pending',
     invitedEmail: "new@example.com",
     invitationToken: "<token>",
     invitedAt: new Date()
   }
5. Server sends invitation email with link: {FRONTEND_URL}/auth/accept-invitation?token=<token>
6. Server returns TenantMember with status: 'pending'
```

#### 14.3.3 Invitation acceptance flow

```
1. Invited person clicks email link → navigates to /auth/accept-invitation?token=<token>
2. Frontend calls GET /invitations/:token (public, no auth) → shows invitation details
3. If user is not registered:
   a. User registers via POST /auth/register
   b. Frontend stores the invitation token
4. If user is already registered:
   a. User logs in (if not already)
5. Authenticated user calls POST /auth/accept-invitation { token }
6. Server validates:
   a. Token exists and status is 'pending'
   b. Authenticated user's email matches invitedEmail
7. Server updates TenantMember: { userId: user.id, status: 'active', invitationToken: null }
8. Server returns updated TenantMember
9. Frontend calls POST /auth/switch-tenant to get JWT with new tenant context
```

#### 14.3.4 Invitation cancellation

```
1. Owner/admin sends DELETE /tenants/:tenantId/members/:memberId
2. If the member is pending (status: 'pending'), the invitation is cancelled
3. The TenantMember document is deleted
```

#### 14.3.5 Duplicate invitation prevention

- If a `pending` invitation already exists for `(invitedEmail, tenantId)`, the server returns 409 Conflict
- If the invited email already belongs to an `active` member, the server returns 409 Conflict
- If a `pending` invitation exists for an email that is now registered, the server may optionally convert it to `active`
  (auto-link)

### 14.4 Email delivery (MVP)

> **BQ-EMAIL-1 resolved:** Invitation emails are sent via **Resend** (free tier: 3,000 emails/month, 100/day). Resend
> provides a simple REST API with excellent developer experience. The `resend` npm package is used server-side.

- **Development:** Invitation link is logged to the server console (Resend API key not required in dev)
- **Production:** Resend REST API (`POST https://api.resend.com/emails`) sends the invitation email
- **Email content:** Plain text with the invitation link, tenant name, and assigned role
- **No email verification** is required beyond the invitation token
- **Configuration:** `RESEND_API_KEY` environment variable (stored as a Cloudflare Worker secret)
- **From address:** `noreply@<configured-domain>` (domain must be verified in Resend dashboard)

#### Email service adapter

The backend defines an `EmailService` interface in the service layer. The Resend implementation calls the Resend REST
API using the `resend` npm package:

```typescript
// server/src/services/email.service.ts
import { Resend } from 'resend';

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

interface EmailService {
  send(payload: EmailPayload): Promise<void>;
}

class ResendEmailService implements EmailService {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async send(payload: EmailPayload): Promise<void> {
    await this.resend.emails.send({
      from: 'noreply@taskboard.example.com',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
  }
}
```

> **Assumption:** The `resend` npm package is added as a server dependency. The `RESEND_API_KEY` is stored as a
> Cloudflare Worker secret. In development, a console-logging adapter is used as a fallback.

### 14.5 Mock payment page (MVP)

> **Decision:** For MVP, subscription upgrade uses a simulated payment page. No real payment processing (Stripe, etc.)
> is integrated. The user clicks "Upgrade to Premium", sees a mock payment form, and upon "payment" the tenant's
> subscription is upgraded directly.

#### 14.5.1 Upgrade flow

```
1. User clicks "Upgrade to Premium" on tenant settings page
2. Frontend navigates to /tenants/:tenantId/upgrade
3. Mock payment page displays:
   - Plan summary (Premium features: unlimited projects, unlimited members)
   - Simulated price (e.g., "$9.99/month")
   - "Pay Now" button
4. User clicks "Pay Now"
5. Frontend calls PATCH /tenants/:tenantId { subscription: 'premium' }
6. Backend updates Tenant.subscription to 'premium'
7. Frontend shows success message and redirects to tenant settings
```

#### 14.5.2 Backend change

The existing `PATCH /tenants/:tenantId` endpoint already supports updating the `subscription` field. No new endpoint is
needed. The backend must allow `subscription` to be upgraded from `'free'` to `'premium'` via this endpoint (tenant
owner/admin only).

#### 14.5.3 Frontend component

| Aspect           | Detail                                                        |
| ---------------- | ------------------------------------------------------------- |
| **Route**        | `/tenants/:tenantId/upgrade`                                  |
| **Component**    | `UpgradeComponent` (new)                                      |
| **Location**     | `ui/src/app/features/tenants/upgrade/upgrade.ts`              |
| **Description**  | Mock payment page with plan summary and "Pay Now" button      |
| **Dependencies** | `TenantClient` (to call `PATCH /tenants/:tenantId`), `Router` |

**Spartan UI components used:**

| Component           | Usage                                 |
| ------------------- | ------------------------------------- |
| `HlmButtonImports`  | "Pay Now" button; "Cancel" button     |
| `HlmCardImports`    | Plan summary card; payment form card  |
| `HlmSpinnerImports` | Processing state while "payment" runs |

#### 14.5.4 Acceptance criteria

| #        | Criterion                                                                                   | Verification                                                                |
| -------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AC-PAY-1 | A free-tier tenant owner sees an "Upgrade to Premium" button on tenant settings             | Button visible when `tenant.subscription === 'free'`                        |
| AC-PAY-2 | Clicking "Upgrade to Premium" navigates to the mock payment page                            | Route `/tenants/:tenantId/upgrade` loads; page shows plan summary and price |
| AC-PAY-3 | Clicking "Pay Now" calls `PATCH /tenants/:tenantId` with `{ subscription: 'premium' }`      | Backend returns updated tenant with `subscription: 'premium'`               |
| AC-PAY-4 | After successful upgrade, the user is redirected to tenant settings with success message    | Tenant settings now shows "Premium" badge; "Upgrade" button is hidden       |
| AC-PAY-5 | A premium tenant shows "Premium" badge on tenant settings and sidebar tenant switcher       | Visual indicator present                                                    |
| AC-PAY-6 | The mock payment page clearly indicates it is a simulation (e.g., "Demo — no real payment") | Page contains a disclaimer that no real payment is processed                |
| AC-PAY-7 | Only tenant owner/admin can upgrade; members see no upgrade option                          | `PATCH /tenants/:tenantId` returns 403 for member role                      |

### 14.6 Data model additions

#### TenantMember document (updated)

```json
{
  "_id": "ObjectId(...)",
  "userId": null,
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "role": "member",
  "status": "pending",
  "invitedEmail": "new@example.com",
  "invitationToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "invitedAt": "2026-07-29T10:00:00Z",
  "createdAt": "2026-07-29T10:00:00Z"
}
```

#### Tenant document (updated)

```json
{
  "_id": "ObjectId(...)",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "subscription": "free",
  "createdAt": "2026-07-29T10:00:00Z",
  "updatedAt": "2026-07-29T10:00:00Z"
}
```

### 14.7 Service layer changes

#### `AuthService.register()` — updated

- **Remove:** Auto-tenant creation, slug generation, TenantMember creation
- **Keep:** Email uniqueness check, password hashing, user creation, JWT generation
- **Change:** JWT issued with `tenantId: null`, `tenantRole: null`

#### `AuthService.login()` — updated

- **Change:** If user has no active memberships, JWT is issued with `tenantId: null`
- **Keep:** Password verification, JWT generation

#### `AuthService.acceptInvitation()` — new

- Validates invitation token
- Checks authenticated user's email matches `invitedEmail`
- Updates TenantMember: sets `userId`, `status: 'active'`, clears `invitationToken`
- Returns updated TenantMember

#### `TenantService.createTenant()` — updated

- **Add:** Subscription limit check (SE-1, SE-2)
- **Keep:** Slug uniqueness check, tenant creation, owner membership creation
- **Change:** `subscription` field is set on the Tenant document

#### `TenantService.inviteMember()` — updated

- **Change:** If user not found by email, create pending invitation instead of throwing error
- **Add:** Generate `invitationToken`, set `status: 'pending'`, `invitedEmail`
- **Add:** Delegate email sending to email service adapter
- **Keep:** Duplicate membership check, role assignment

#### `ProjectService.createProject()` — updated

- **Add:** Subscription limit check (SE-3): count projects in tenant, reject if free tier limit reached

#### `ProjectService.addMember()` — updated

- **Add:** Subscription limit check (SE-5): count project members, reject if free tier limit reached

---

## 15. Jira-Style Dashboard (Phase 11)

> **Date added:** 2026-07-29 **Status:** Defined for implementation. **Replaces:** The simple dashboard at
> [`ui/src/app/features/dashboard/dashboard.ts`](ui/src/app/features/dashboard/dashboard.ts).

### 15.1 Goal

Replace the current simple dashboard (which only shows projects for the active tenant) with a **smart landing page**
that adapts its content based on the user's authentication status and workspace membership state. The dashboard is the
first page every user sees — it must guide them to the correct action without requiring them to understand the
application's internal model.

### 15.2 Context

**Current state:**

- The root route (`/`) is protected by [`authGuard`](ui/src/app/guards/auth.guard.ts:24), which redirects
  unauthenticated users to `/auth/login`.
- The [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component loads tenants via
  [`TenantClient.loadTenants()`](ui/src/app/services/tenant-client.ts:30) and then projects for the active tenant.
- There is no visitor landing page, no pending-invitation view, and no cross-tenant "my tasks" view.
- The [`AuthStore`](ui/src/app/stores/auth-store.ts:21) exposes `isAuthenticated`, `hasTenant`, and `needsWorkspace`
  computed signals.

**Target state:**

- The root route (`/`) renders a single [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component that
  internally detects the user's state and renders the appropriate sub-view (State 0–4).
- Unauthenticated visitors see a static landing page (no backend calls).
- Authenticated users see one of four personalized views based on their workspace membership and invitation status.

### 15.3 Dashboard states overview

| State | Name                | Auth required | Condition                                                    | Primary CTA                                 |
| ----- | ------------------- | :-----------: | ------------------------------------------------------------ | ------------------------------------------- |
| 0     | Visitor             |      No       | `isAuthenticated() === false`                                | Register / Login                            |
| 1     | New User            |      Yes      | Authenticated, zero tenants, zero pending invitations        | "Create your first workspace"               |
| 2     | Pending Invitations |      Yes      | Authenticated, zero tenants, ≥ 1 pending invitation          | Accept/Decline invitations                  |
| 3     | Member              |      Yes      | Authenticated, ≥ 1 tenant as `member` or `admin` (not owner) | View workspaces and recent tasks            |
| 4     | Owner               |      Yes      | Authenticated, ≥ 1 tenant as `owner`                         | Manage workspaces, view pending invitations |

### 15.4 State detection logic

The [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component executes the following logic in
[`ngOnInit()`](ui/src/app/features/dashboard/dashboard.ts:24). The state is exposed as a signal
`dashboardState = signal<DashboardState>('loading')` where `DashboardState` is a union type:

```typescript
type DashboardState = 'loading' | 'visitor' | 'new-user' | 'pending-invitations' | 'member' | 'owner';
```

**Detection algorithm:**

```
1. dashboardState.set('loading')

2. IF authStore.isAuthenticated() === false:
     → dashboardState = 'visitor'
     → STOP (no API calls)

3. Load tenants: await tenantClient.loadTenants()
   Load pending invitations: await invitationClient.getMyInvitations()

4. IF tenants.length === 0 AND pendingInvitations.length === 0:
     → dashboardState = 'new-user'
     → STOP

5. IF tenants.length === 0 AND pendingInvitations.length > 0:
     → dashboardState = 'pending-invitations'
     → STOP

6. IF user owns at least one tenant (check membership role === 'owner'):
     → dashboardState = 'owner'
     → Load additional data: pending sent invitations, recent tasks

7. ELSE (user is member/admin but not owner of any tenant):
     → dashboardState = 'member'
     → Load additional data: recent tasks across all tenants
```

**Owner detection:** The [`TenantClient`](ui/src/app/services/tenant-client.ts:23) must expose the user's role per
tenant. The existing `loadTenants()` returns `Tenant[]` which does not include the user's role. A new method or
augmented response is needed — see §15.8.1.

### 15.5 State 0: Visitor (not logged in)

| Aspect        | Detail                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Condition** | `authStore.isAuthenticated() === false`                                                                                                          |
| **Route**     | `/` (root)                                                                                                                                       |
| **Guard**     | None — the root route must NOT use `authGuard` (see §15.7.1)                                                                                     |
| **Backend**   | None — purely static content                                                                                                                     |
| **No shell**  | The visitor view does NOT render inside [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts); it renders the full page including its own header |

#### 15.5.1 UI description

The visitor landing page is a marketing-style page with the following sections:

1. **Hero section**
   - Headline: "Task Board — Simple, powerful project management"
   - Subheadline: Brief product description (1–2 sentences)
   - CTA buttons: "Get Started" (→ `/auth/register`) and "Log In" (→ `/auth/login`)

2. **Features section** — 3–4 feature cards with icons:
   - Kanban boards with drag-and-drop
   - Sprint management
   - Team collaboration with role-based access
   - Multi-workspace support

3. **Free plan callout** — highlights free tier limits:
   - 1 workspace, 3 projects, 10 users per project

4. **Footer CTA** — "Ready to get started? Create your free account"

#### 15.5.2 Spartan UI components

| Component          | Usage         |
| ------------------ | ------------- |
| `HlmButtonImports` | CTA buttons   |
| `HlmCardImports`   | Feature cards |

No `HlmSpinnerImports` needed — no loading state for static content.

### 15.6 State 1: New User (authenticated, no workspace, no memberships)

| Aspect            | Detail                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| **Condition**     | `isAuthenticated() && tenants.length === 0 && pendingInvitations.length === 0` |
| **Backend calls** | `GET /tenants` (existing), `GET /invitations/my` (new — §15.8.1)               |

#### 15.6.1 UI description

1. **Welcome header**: "Welcome to Task Board, {displayName}!"
2. **CTA card** — prominent card with:
   - "Create your first workspace" button → navigates to `/workspace/create`
   - Brief explanation of what a workspace is
3. **Free plan info** card:
   - Limits: 1 workspace, 3 projects, 10 users
   - Link: "Learn about Premium" (text only, no navigation in MVP — or links to `/upgrade` info)
4. **Check for invitations**:
   - On load, the component calls `GET /invitations/my` to check for pending invitations by email.
   - If invitations are found, the state transitions to State 2 instead.

#### 15.6.2 Acceptance criteria

| #         | Criterion                                                                          | Verification                                                         |
| --------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AC-DASH-1 | An authenticated user with zero tenants and zero invitations sees the welcome view | Dashboard renders welcome header + "Create your first workspace" CTA |
| AC-DASH-2 | Clicking "Create your first workspace" navigates to `/workspace/create`            | Router navigates to the create workspace page                        |
| AC-DASH-3 | Free plan limits (1 workspace, 3 projects, 10 users) are displayed                 | Info card shows correct limits                                       |
| AC-DASH-4 | The component calls `GET /invitations/my` on init to check for pending invitations | Network tab shows the request                                        |

### 15.7 State 2: Pending Invitations (authenticated, no tenants, has invitations)

| Aspect            | Detail                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| **Condition**     | `isAuthenticated() && tenants.length === 0 && pendingInvitations.length > 0` |
| **Backend calls** | `GET /tenants` (existing), `GET /invitations/my` (new — §15.8.1)             |

#### 15.7.1 UI description

1. **Header**: "You have pending invitations"
2. **Invitation cards** — one card per pending invitation, each showing:
   - Workspace name (from invitation details)
   - Invited role (badge: `owner` / `admin` / `member`)
   - Inviter email or name
   - "Accept" button → calls `POST /auth/accept-invitation` with the invitation token
   - "Decline" button → calls `DELETE /invitations/:id` (new — §15.8.1) or a new decline endpoint
3. **Secondary CTA**: "Or create your own workspace" → `/workspace/create`
4. **After accepting**: The component reloads tenants and transitions to State 3 or 4 based on the new membership.

#### 15.7.2 Acceptance criteria

| #         | Criterion                                                                                    | Verification                                                   |
| --------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| AC-DASH-5 | A user with pending invitations sees invitation cards with workspace name, role, and actions | Cards render with correct data from `GET /invitations/my`      |
| AC-DASH-6 | Clicking "Accept" calls `POST /auth/accept-invitation` and transitions to State 3/4          | API call succeeds; dashboard re-renders with workspace view    |
| AC-DASH-7 | Clicking "Decline" removes the invitation from the list                                      | Invitation card disappears; if no invitations remain → State 1 |
| AC-DASH-8 | The "Create your own workspace" link navigates to `/workspace/create`                        | Router navigates correctly                                     |

### 15.8 State 3: Member (authenticated, belongs to workspaces, not owner)

| Aspect            | Detail                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| **Condition**     | `isAuthenticated() && tenants.length > 0 && user is NOT owner of any tenant` |
| **Backend calls** | `GET /tenants` (existing), `GET /tasks/my` (new — §15.8.2)                   |

#### 15.8.1 UI description

1. **Header**: "Welcome back, {displayName}"
2. **"My Workspaces" section** — cards for each workspace the user belongs to:
   - Workspace name
   - User's role (badge)
   - Project count (requires tenant metadata — see §15.9.1)
   - Click → navigates to the tenant's project list (`/tenants/:tenantId/projects`)
3. **"My Recent Tasks" section** — tasks assigned to the user across all workspaces:
   - Task title, priority badge, project name, column name
   - Sorted by `updatedAt` descending, limit 10
   - Click → navigates to task detail (`/tenants/:tenantId/projects/:projectId/tasks/:taskId`)
4. **"Quick Stats" section** — summary cards:
   - Total tasks assigned to me
   - Tasks by priority breakdown (low / medium / high / critical)

#### 15.8.2 Acceptance criteria

| #          | Criterion                                                                              | Verification                                              |
| ---------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AC-DASH-9  | A member sees "My Workspaces" cards with workspace name, role badge, and project count | Cards render with data from `GET /tenants`                |
| AC-DASH-10 | Clicking a workspace card navigates to that tenant's project list                      | Router navigates to `/tenants/:tenantId/projects`         |
| AC-DASH-11 | "My Recent Tasks" shows up to 10 tasks assigned to the user across all tenants         | Tasks fetched via `GET /tasks/my`; list renders correctly |
| AC-DASH-12 | "Quick Stats" shows total assigned task count and priority breakdown                   | Stats computed from `GET /tasks/my` response              |
| AC-DASH-13 | Clicking a task in "My Recent Tasks" navigates to the task detail page                 | Router navigates to correct tenant/project/task URL       |

### 15.9 State 4: Owner (authenticated, owns one or more workspaces)

| Aspect            | Detail                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Condition**     | `isAuthenticated() && user is owner of at least one tenant`                                    |
| **Backend calls** | `GET /tenants` (existing), `GET /tasks/my` (new), `GET /tenants/:id/invitations/pending` (new) |

#### 15.9.1 UI description

Includes everything from State 3, **plus**:

1. **"Pending Invitations Sent" section** — shows invitations the owner sent that are still pending:
   - Invitee email, role, invited date
   - "Resend" button (re-triggers invitation email) and "Cancel" button (deletes the invitation)
   - Only shown for owned tenants
2. **Workspace management links** per owned workspace:
   - Settings → `/tenants/:tenantId/settings`
   - Members → `/tenants/:tenantId/settings/members`
   - Upgrade (if free tier) → `/tenants/:tenantId/upgrade`
3. **"Create another workspace" button** — shown if the user is under the subscription limit (1 free workspace):
   - Navigates to `/workspace/create`

#### 15.9.2 Acceptance criteria

| #          | Criterion                                                                                    | Verification                                                  |
| ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| AC-DASH-14 | An owner sees "Pending Invitations Sent" with invitee email, role, and action buttons        | Data fetched via `GET /tenants/:tenantId/invitations/pending` |
| AC-DASH-15 | Clicking "Cancel" on a pending invitation calls `DELETE /tenants/:tenantId/members/:userId`  | Invitation removed from list                                  |
| AC-DASH-16 | Workspace management links (Settings, Members, Upgrade) are visible for owned workspaces     | Links navigate to correct routes                              |
| AC-DASH-17 | "Create another workspace" is visible only when the user has not reached the free tier limit | Button hidden if user already owns 1 free workspace           |
| AC-DASH-18 | Owner sees all State 3 content (My Workspaces, My Recent Tasks, Quick Stats)                 | All State 3 sections render correctly                         |

### 15.10 New API endpoints

#### 15.10.1 `GET /invitations/my` — Pending invitations for the authenticated user

| Aspect             | Detail                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **Method**         | `GET`                                                                                       |
| **Path**           | `/api/v1/invitations/my`                                                                    |
| **Auth**           | Required (Bearer JWT)                                                                       |
| **Tenant context** | **Not required** — cross-tenant query                                                       |
| **Description**    | Returns all pending invitations where `invitedEmail` matches the authenticated user's email |

**Query parameters:** None.

**Response (200):**

```typescript
// Zod v4 schema
export const MyInvitationSchema = z.interface({
  id: z.string().uuid(), // TenantMember ID
  tenantId: z.string().uuid(),
  tenantName: z.string(), // Denormalized from Tenant collection
  role: z.enum(['owner', 'admin', 'member']),
  invitedAt: z.string().datetime().nullable(),
});

export const MyInvitationsResponseSchema = z.interface({
  data: z.array(MyInvitationSchema),
  total: z.number().int().nonnegative(),
});
```

**Implementation notes:**

- Query `tenant_members` collection: `{ invitedEmail: user.email, status: 'pending' }`
- Join with `tenants` collection to get `tenantName` for each result
- This endpoint requires a new route file or addition to the auth routes (since it's cross-tenant)
- The [`TenantMemberRepository`](server/src/repositories/tenant-member.repository.ts:65) already has
  [`findPendingByEmail()`](server/src/repositories/tenant-member.repository.ts:65) which returns the raw
  `TenantMemberDocument[]`

#### 15.10.2 `GET /tasks/my` — Tasks assigned to the authenticated user across all tenants

| Aspect             | Detail                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Method**         | `GET`                                                                                                       |
| **Path**           | `/api/v1/tasks/my`                                                                                          |
| **Auth**           | Required (Bearer JWT)                                                                                       |
| **Tenant context** | **Not required** — cross-tenant query                                                                       |
| **Description**    | Returns tasks where the authenticated user's ID is in `assigneeIds`, across all tenants the user belongs to |

**Query parameters:**

| Parameter  | Type     | Default | Description               |
| ---------- | -------- | ------- | ------------------------- |
| `page`     | `number` | `1`     | Page number               |
| `limit`    | `number` | `10`    | Results per page (max 50) |
| `priority` | `string` | —       | Filter by priority        |

**Response (200):**

```typescript
export const MyTasksResponseSchema = z.interface({
  data: z.array(
    TaskSchema.extend({
      tenantName: z.string(), // Denormalized
      projectName: z.string(), // Denormalized
      columnTitle: z.string(), // Column name
    }),
  ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
```

**Implementation notes:**

1. Get user's active tenant memberships: `tenant_members` where `{ userId, status: 'active' }`
2. Extract `tenantId` list from memberships
3. Query `tasks` where `{ tenantId: { $in: tenantIds }, assigneeIds: userId }`
4. Sort by `updatedAt` descending
5. Paginate
6. Join with `tenants`, `projects`, and `columns` collections for display names
7. This is a new route — register at the app level (not under tenant-scoped router)

**MongoDB index required:**

```
{ tenantId: 1, assigneeIds: 1, updatedAt: -1 }
```

This compound index enables efficient cross-tenant assignment queries. The existing `{ tenantId: 1 }` index alone is not
sufficient for the `assigneeIds` array match.

#### 15.10.3 `GET /tenants/:tenantId/invitations/pending` — Pending invitations sent by a tenant

| Aspect             | Detail                                                   |
| ------------------ | -------------------------------------------------------- |
| **Method**         | `GET`                                                    |
| **Path**           | `/api/v1/tenants/:tenantId/invitations/pending`          |
| **Auth**           | Required (Bearer JWT)                                    |
| **Tenant context** | Required — tenant-scoped                                 |
| **RBAC**           | Owner or admin only                                      |
| **Description**    | Returns all pending invitations for the specified tenant |

**Response (200):**

```typescript
export const PendingInvitationSchema = z.interface({
  id: z.string().uuid(), // TenantMember ID
  invitedEmail: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']),
  invitedAt: z.string().datetime().nullable(),
});

export const PendingInvitationsResponseSchema = z.interface({
  data: z.array(PendingInvitationSchema),
  total: z.number().int().nonnegative(),
});
```

**Implementation notes:**

- The [`TenantMemberRepository`](server/src/repositories/tenant-member.repository.ts:91) already has
  [`findPendingByTenant()`](server/src/repositories/tenant-member.repository.ts:91)
- Add a service method in [`TenantService`](server/src/services/tenant.service.ts:13) that wraps this with RBAC check
  (owner/admin only)
- Add a route in [`tenants.ts`](server/src/routes/tenants.ts:25)

#### 15.10.4 `DELETE /invitations/:invitationId` — Decline a pending invitation (by invitee)

| Aspect             | Detail                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Method**         | `DELETE`                                                                              |
| **Path**           | `/api/v1/invitations/:invitationId`                                                   |
| **Auth**           | Required (Bearer JWT)                                                                 |
| **Tenant context** | **Not required** — cross-tenant action                                                |
| **Description**    | Allows an authenticated user to decline a pending invitation addressed to their email |

**Implementation notes:**

- Validate that the authenticated user's email matches `invitedEmail` on the invitation
- Validate that the invitation status is `'pending'`
- Update the invitation status to `'declined'` (soft-delete — preserves audit trail)
- `declined` and `access_revoked` members do NOT appear in `GET /tenants` and have no tenant access
- Owner/admin can later resend invitation (reset to `'pending'`) or hard-delete the member permanently
- Return 204 No Content

### 15.11 Shared package additions

#### 15.11.1 New schemas

| Schema file         | New schemas                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `schemas/tenant.ts` | `MyInvitationSchema`, `MyInvitationsResponseSchema`, `PendingInvitationSchema`, `PendingInvitationsResponseSchema` |
| `schemas/task.ts`   | `MyTaskSchema` (extends `TaskSchema` with `tenantName`, `projectName`, `columnTitle`), `MyTasksResponseSchema`     |

#### 15.11.2 New contracts

| Contract file         | New contracts                           |
| --------------------- | --------------------------------------- |
| `contracts/auth.ts`   | `getMyInvitations`, `declineInvitation` |
| `contracts/task.ts`   | `getMyTasks`                            |
| `contracts/tenant.ts` | `getPendingInvitations`                 |

#### 15.11.3 New types

| Type file         | New types                           |
| ----------------- | ----------------------------------- |
| `types/tenant.ts` | `MyInvitation`, `PendingInvitation` |
| `types/task.ts`   | `MyTask`                            |

### 15.12 Frontend service extensions

#### 15.12.1 `TenantClient` additions

```typescript
// Add to TenantClient:

/** Get pending invitations for the current user's email (cross-tenant) */
getMyInvitations(): Observable<{ data: MyInvitation[]; total: number }>

/** Get pending invitations sent by a tenant (owner/admin only) */
getPendingInvitations(tenantId: string): Observable<{ data: PendingInvitation[]; total: number }>
```

#### 15.12.2 New `InvitationClient` service (or extend `TenantClient`)

```typescript
/** Decline a pending invitation */
declineInvitation(invitationId: string): Observable<void>
```

This can be added to [`TenantClient`](ui/src/app/services/tenant-client.ts:23) or extracted into a dedicated
`InvitationClient` service. Recommendation: add to `TenantClient` since invitation logic is already partially there (see
[`getInvitationDetails()`](ui/src/app/services/tenant-client.ts:125) and
[`acceptInvitation()`](ui/src/app/services/tenant-client.ts:130)).

#### 15.12.3 New `TaskClient` method (or new cross-tenant method)

```typescript
// Add to TaskClient:

/** Get tasks assigned to the current user across all tenants */
getMyTasks(page?: number, limit?: number): Observable<MyTasksResponse>
```

### 15.13 Frontend routing changes

#### 15.13.1 Root route guard change

The root route (`/`) currently uses [`authGuard`](ui/src/app/guards/auth.guard.ts:24) which redirects unauthenticated
users to `/auth/login`. This must change to allow unauthenticated visitors to see the landing page.

**Option A (recommended):** Remove `authGuard` from the root route. The
[`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component internally handles all states including the
visitor state. Authenticated data loading only happens when `isAuthenticated()` is true.

```typescript
// app.routes.ts — changed root route
{
  path: '',
  // NO canActivate — the dashboard handles visitor state internally
  loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
},
```

**Option B:** Create a `softAuthGuard` that does not redirect but instead sets a signal indicating auth status. This
adds complexity without clear benefit — Option A is simpler.

**Impact on existing routes:** All other routes (`/workspace/create`, `/tenants/:tenantId/*`) retain their `authGuard` —
only the root `/` changes.

#### 15.13.2 Dashboard component structure

The [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts:17) component becomes a stateful orchestrator that
delegates to child sub-views:

```
ui/src/app/features/dashboard/
├── dashboard.ts                     # Main orchestrator (state detection)
├── dashboard.html                   # @switch on dashboardState
├── visitor/
│   └── landing-page.ts              # State 0: static marketing page
├── new-user/
│   └── welcome-view.ts              # State 1: create workspace CTA
├── pending-invitations/
│   └── invitation-view.ts           # State 2: invitation cards
├── member/
│   └── member-dashboard.ts          # State 3: workspaces + tasks
└── owner/
    └── owner-dashboard.ts           # State 4: full dashboard
```

**Template pattern:**

```html
<!-- dashboard.html -->
@switch (dashboardState()) { @case ('loading') {
<div class="flex items-center justify-center py-20">
  <hlm-spinner />
</div>
} @case ('visitor') {
<ui-landing-page />
} @case ('new-user') {
<ui-welcome-view />
} @case ('pending-invitations') {
<ui-invitation-view [invitations]="pendingInvitations()" />
} @case ('member') {
<ui-member-dashboard [tenants]="tenants()" [tasks]="myTasks()" [stats]="taskStats()" />
} @case ('owner') {
<ui-owner-dashboard
  [tenants]="tenants()"
  [tasks]="myTasks()"
  [stats]="taskStats()"
  [pendingInvitations]="sentInvitations()"
/>
} }
```

#### 15.13.3 Angular 22 patterns

| Pattern                         | Usage in Dashboard                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `signal()`                      | `dashboardState`, `tenants`, `myTasks`, `pendingInvitations`, `sentInvitations`, `loading` |
| `computed()`                    | `isOwner`, `isMember`, `hasInvitations`, `taskStats`                                       |
| `effect()`                      | Trigger data loading when state transitions                                                |
| `resource()` / `httpResource()` | Data fetching for tasks and invitations with signal integration                            |
| `@if` / `@for` / `@switch`      | Control flow in all sub-view templates                                                     |
| `inject()`                      | DI of `AuthStore`, `TenantClient`, `TaskClient`, `Router`                                  |
| Standalone components           | All sub-views are standalone                                                               |

### 15.14 Existing `email.service.ts` changes

The [`EmailService`](server/src/services/email.service.ts:9) does not need changes for the dashboard feature. However,
the invitation email content should be reviewed to ensure it includes:

- Accept link with token
- Decline link (optional — can be handled in-app)
- Workspace name and role

The existing implementation at [`sendInvitationEmail()`](server/src/services/email.service.ts:20) already includes the
accept URL. A decline URL is not needed if declining is handled in the dashboard UI (State 2).

### 15.15 Cross-cutting requirements

#### 15.15.1 RBAC visibility

| UI Element                        | Visitor | New User | Pending Invitee | Member | Owner |
| --------------------------------- | :-----: | :------: | :-------------: | :----: | :---: |
| Landing page content              |   ✅    |    ❌    |       ❌        |   ❌   |  ❌   |
| "Create workspace" CTA            |   ❌    |    ✅    |       ✅        |   ❌   |  ✅   |
| Invitation cards (accept/decline) |   ❌    |    ❌    |       ✅        |   ❌   |  ❌   |
| "My Workspaces" section           |   ❌    |    ❌    |       ❌        |   ✅   |  ✅   |
| "My Recent Tasks" section         |   ❌    |    ❌    |       ❌        |   ✅   |  ✅   |
| "Pending Invitations Sent"        |   ❌    |    ❌    |       ❌        |   ❌   |  ✅   |
| Workspace management links        |   ❌    |    ❌    |       ❌        |   ❌   |  ✅   |

#### 15.15.2 Error handling

| Scenario                             | Behavior                                                      |
| ------------------------------------ | ------------------------------------------------------------- |
| `GET /tenants` fails                 | Show error state with retry button                            |
| `GET /invitations/my` fails          | Treat as zero invitations (non-blocking)                      |
| `GET /tasks/my` fails                | Show "Unable to load tasks" with retry; other sections render |
| `POST /auth/accept-invitation` fails | Show error toast; invitation card remains                     |
| `DELETE /invitations/:id` fails      | Show error toast; invitation card remains                     |

#### 15.15.3 Testing requirements

| Layer           | Requirement                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Unit**        | Dashboard component state detection logic — all 5 states with mocked stores                            |
| **Unit**        | Each sub-view component (landing, welcome, invitation, member, owner)                                  |
| **Unit**        | New service methods (`getMyInvitations`, `getMyTasks`, `getPendingInvitations`)                        |
| **Integration** | State transitions: visitor → register → new user → create workspace → owner                            |
| **Integration** | Invitation flow: invite → pending view → accept → member view                                          |
| **E2E**         | Full journey: visit `/` as visitor → register → create workspace → invite member → see owner dashboard |

### 15.16 MongoDB index additions

| Collection       | Index                                            | Purpose                                      |
| ---------------- | ------------------------------------------------ | -------------------------------------------- |
| `tasks`          | `{ tenantId: 1, assigneeIds: 1, updatedAt: -1 }` | Efficient `GET /tasks/my` cross-tenant query |
| `tenant_members` | `{ invitedEmail: 1, status: 1 }`                 | Efficient `GET /invitations/my` query        |

The existing `{ invitedEmail: 1, tenantId: 1 }` sparse unique index on `tenant_members` does not cover the `status`
filter. A new index `{ invitedEmail: 1, status: 1 }` is recommended for the dashboard invitation lookup.

---

## 16. Workspace Detail Page (Phase 12)

> **Date added:** 2026-07-30 **Status:** Defined for implementation. **Depends on:** §15 (Jira-Style Dashboard).

### 16.1 Goal

Add a **Workspace Detail** page at `/tenants/:tenantId` that serves as the default landing page when a user navigates
into a workspace. This page provides an at-a-glance view of the workspace — its name, the user's role, an optional
description, quick-action buttons, and a collapsible project list — replacing the current behavior where navigating to
`/tenants/:tenantId` with an empty child path renders only the [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts)
header and sidebar with no content.

### 16.2 Context

**Current state:**

- The [`app.routes.ts`](ui/src/app/app.routes.ts:34) tenant route group at `tenants/:tenantId` uses
  [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts) as the parent component with child routes for `settings`,
  `settings/members`, `upgrade`, `projects`, `sprints`, and project detail — but **no default (empty path) child
  route**.
- Navigating to `/tenants/:tenantId` renders the [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts) with an empty
  `<router-outlet>`.
- The [`TenantSchema`](server/src/schemas/tenant.ts:8) has **no `description` field** — only `id`, `name`, `slug`,
  `subscription`, `createdAt`, `updatedAt`.
- Owner dashboard ([`owner-dashboard.html`](ui/src/app/features/dashboard/owner-dashboard/owner-dashboard.html:48))
  workspace cards show the tenant name as plain text with separate action buttons (Projects, Settings, Members,
  Upgrade).
- Member dashboard ([`member-dashboard.html`](ui/src/app/features/dashboard/member-dashboard/member-dashboard.html:34))
  workspace cards link directly to `/tenants/:tenantId/projects`.
- The [`TenantWithRoleSchema`](server/src/schemas/tenant.ts:107) extends
  [`TenantSchema`](server/src/schemas/tenant.ts:8) with a `role` field — already available from the tenant list
  endpoint.

**Target state:**

- `/tenants/:tenantId` (empty child path) renders a new `WorkspaceDetail` component inside the
  [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts).
- The [`TenantSchema`](server/src/schemas/tenant.ts:8) includes an optional `description` field (max 500 characters,
  nullable).
- Dashboard workspace card titles link to `/tenants/:tenantId` (the workspace detail page) instead of directly to
  projects or showing only plain text.

### 16.3 Functional requirements

| #        | Requirement                                                                                                                                                                                                                                                                                                               | Priority |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: |
| FR-16.1  | Add `description` field (`string`, max 500, nullable/optional) to [`TenantSchema`](server/src/schemas/tenant.ts:8)                                                                                                                                                                                                        |   High   |
| FR-16.2  | Add `description` to [`CreateTenantSchema`](server/src/schemas/tenant.ts:33) (optional) and [`UpdateTenantSchema`](server/src/schemas/tenant.ts:50) (optional)                                                                                                                                                            |   High   |
| FR-16.3  | Update [`TenantDocument`](server/src/repositories/tenant.repository.ts:11) interface to include `description: string \| null`                                                                                                                                                                                             |   High   |
| FR-16.4  | Update [`TenantRepository`](server/src/repositories/tenant.repository.ts:36) — [`create()`](server/src/repositories/tenant.repository.ts:57) and [`update()`](server/src/repositories/tenant.repository.ts:72) methods and [`toDomain()`](server/src/repositories/tenant.repository.ts:23) mapper to handle `description` |   High   |
| FR-16.5  | Update [`TenantService.updateTenant()`](server/src/services/tenant.service.ts:96) to pass `description` through to the repository                                                                                                                                                                                         |   High   |
| FR-16.6  | Update [`TenantClient.updateTenant()`](ui/src/app/services/tenant-client.ts:38) signature to accept `description` in the data parameter                                                                                                                                                                                   |   High   |
| FR-16.7  | Update [`TenantStore.updateTenant()`](ui/src/app/stores/tenant-store.ts:53) signature to accept `description` in the data parameter                                                                                                                                                                                       |   High   |
| FR-16.8  | Register a default (empty path `''`) child route in [`app.routes.ts`](ui/src/app/app.routes.ts:37) inside the `tenants/:tenantId` children array                                                                                                                                                                          |   High   |
| FR-16.9  | Create `WorkspaceDetail` component at `ui/src/app/features/tenants/workspace-detail/`                                                                                                                                                                                                                                     |   High   |
| FR-16.10 | Display workspace name as `<h1>`                                                                                                                                                                                                                                                                                          |   High   |
| FR-16.11 | Display user's role badge (owner/admin/member) using [`HlmBadge`](ui/libs/ui/badge/src/lib/hlm-badge.ts)                                                                                                                                                                                                                  |   High   |
| FR-16.12 | Display workspace description text (or a placeholder like "No description" when null/empty)                                                                                                                                                                                                                               |   High   |
| FR-16.13 | Display action buttons block (medium size): Settings, Members, Upgrade                                                                                                                                                                                                                                                    |   High   |
| FR-16.14 | Action buttons are **only visible** to users with `owner` or `admin` tenant role                                                                                                                                                                                                                                          |   High   |
| FR-16.15 | **Upgrade** button is **only visible** when user is `owner` **and** tenant subscription is `free`                                                                                                                                                                                                                         |   High   |
| FR-16.16 | Display a collapsible project list below the action buttons using [`HlmCollapsible`](ui/libs/ui/collapsible/src/lib/hlm-collapsible.ts)                                                                                                                                                                                   |   High   |
| FR-16.17 | For `owner`/`admin`: project list shows **all projects** in the workspace (via [`ProjectClient.list()`](ui/src/app/services/project-client.ts:21))                                                                                                                                                                        |   High   |
| FR-16.18 | For `member`: project list shows **only projects the member is added to** (requires a filtered API or client-side filter)                                                                                                                                                                                                 |   High   |
| FR-16.19 | On [`owner-dashboard.html`](ui/src/app/features/dashboard/owner-dashboard/owner-dashboard.html:48), make the workspace card title (`tenant.name`) a link to `/tenants/:tenantId`                                                                                                                                          |  Medium  |
| FR-16.20 | On [`member-dashboard.html`](ui/src/app/features/dashboard/member-dashboard/member-dashboard.html:34), change the workspace card link target from `/tenants/:tenantId/projects` to `/tenants/:tenantId`                                                                                                                   |  Medium  |

### 16.4 Non-functional requirements

| #     | Requirement                                                                                                                       | Target                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| NFR-1 | Workspace Detail page loads within 2 seconds on 3G connection                                                                     | Performance                |
| NFR-2 | Collapsible project list uses `@defer` for lazy rendering                                                                         | Performance                |
| NFR-3 | All new components are standalone (no NgModules)                                                                                  | Architecture consistency   |
| NFR-4 | All new components use signals (no RxJS subscriptions in components)                                                              | Architecture consistency   |
| NFR-5 | New/modified schemas use Zod v4 `z.object()` (matching existing code)                                                             | Shared package consistency |
| NFR-6 | Backward compatibility — existing tenants with no `description` field in MongoDB must render gracefully (null → placeholder text) | Data migration             |

### 16.5 User stories / scenarios

#### US-16.1: View workspace detail as owner

**As an** owner of a workspace, **I want to** navigate to `/tenants/:tenantId` and see a summary of my workspace, **so
that** I can quickly understand the workspace state and take action.

**Acceptance:**

- Page displays workspace name as `<h1>`, role badge "owner", and description (or "No description" placeholder).
- Action buttons (Settings, Members, Upgrade) are visible because the user is owner on a free plan.
- Collapsible project list shows all projects in the workspace.

#### US-16.2: View workspace detail as admin

**As an** admin of a workspace, **I want to** see the workspace detail page with management action buttons, **so that**
I can manage the workspace without navigating through the dashboard.

**Acceptance:**

- Page displays workspace name, role badge "admin", and description.
- Settings and Members buttons are visible; Upgrade button is **not** visible (admin is not owner).
- Project list shows all projects.

#### US-16.3: View workspace detail as member

**As a** member of a workspace, **I want to** see the workspace detail page with only relevant information, **so that**
I can find my projects without seeing admin-only controls.

**Acceptance:**

- Page displays workspace name, role badge "member", and description.
- Action buttons (Settings, Members, Upgrade) are **not** visible.
- Project list shows **only** projects the member is added to.

#### US-16.4: Navigate from dashboard to workspace detail

**As a** user viewing the dashboard, **I want to** click on a workspace card title to navigate to the workspace detail
page, **so that** I can quickly access workspace information.

**Acceptance:**

- Owner dashboard: workspace card `tenant.name` is a link to `/tenants/:tenantId`.
- Member dashboard: workspace card links to `/tenants/:tenantId` (instead of `/tenants/:tenantId/projects`).

#### US-16.5: Empty description graceful handling

**As a** user viewing a workspace that has no description set, **I want to** see a placeholder message instead of broken
layout, **so that** the page remains usable.

**Acceptance:**

- When `description` is `null` or empty string, the description area shows "No description provided." in muted text.

#### US-16.6: Collapse/expand project list

**As a** user viewing the workspace detail page, **I want to** collapse and expand the project list, **so that** I can
focus on the workspace overview when I don't need the project list.

**Acceptance:**

- Project list is rendered inside a collapsible container.
- Default state: expanded.
- Clicking the collapse trigger hides the project list; clicking again shows it.
- The collapse trigger shows the project count (e.g., "Projects (5)").

### 16.6 Acceptance criteria

| #     | Criterion                                                                                                                                  | Verification method                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| AC-1  | [`TenantSchema`](server/src/schemas/tenant.ts:8) includes `description: z.string().max(500).nullable().optional()`                         | Unit test: schema parses `{ id, name, slug, subscription, description: null, ... }` |
| AC-2  | [`CreateTenantSchema`](server/src/schemas/tenant.ts:33) accepts optional `description` field                                               | Unit test: schema parses `{ name, slug, description: "text" }` and `{ name, slug }` |
| AC-3  | [`UpdateTenantSchema`](server/src/schemas/tenant.ts:50) accepts optional `description` field                                               | Unit test: schema parses `{ description: "new desc" }`                              |
| AC-4  | [`TenantDocument`](server/src/repositories/tenant.repository.ts:11) has `description: string \| null`                                      | TypeScript compilation — no type errors                                             |
| AC-5  | [`TenantRepository.create()`](server/src/repositories/tenant.repository.ts:57) stores `description` in MongoDB                             | Integration test: create tenant with description, read back                         |
| AC-6  | [`TenantRepository.update()`](server/src/repositories/tenant.repository.ts:72) accepts and persists `description`                          | Integration test: update description, verify persistence                            |
| AC-7  | [`TenantRepository.toDomain()`](server/src/repositories/tenant.repository.ts:23) maps `description` correctly (null → undefined if needed) | Unit test: mapper output matches [`TenantSchema`](server/src/schemas/tenant.ts:8)   |
| AC-8  | `PATCH /api/v1/tenants/:tenantId` accepts `{ description: "..." }` in request body                                                         | Integration test: HTTP PATCH with description body                                  |
| AC-9  | `GET /api/v1/tenants/:tenantId` returns `description` in response                                                                          | Integration test: HTTP GET returns description field                                |
| AC-10 | Route `''` (empty path) is registered as first child of `tenants/:tenantId` in [`app.routes.ts`](ui/src/app/app.routes.ts:37)              | Unit test: route inspection; navigating to `/tenants/:id` loads WorkspaceDetail     |
| AC-11 | [`WorkspaceDetail`](ui/src/app/features/tenants/workspace-detail/) renders workspace name as `<h1>`                                        | Unit test: component fixture contains `<h1>` with tenant name                       |
| AC-12 | Role badge displays correct role text (owner/admin/member)                                                                                 | Unit test: badge text matches input role                                            |
| AC-13 | Description text renders when present; placeholder renders when null/empty                                                                 | Unit test: two component fixture variants                                           |
| AC-14 | Settings, Members, Upgrade buttons visible for owner on free plan                                                                          | Unit test: button presence with role=owner, subscription=free                       |
| AC-15 | Settings, Members buttons visible for admin; Upgrade hidden                                                                                | Unit test: button presence with role=admin                                          |
| AC-16 | All action buttons hidden for member                                                                                                       | Unit test: button presence with role=member                                         |
| AC-17 | Upgrade button hidden for owner on premium plan                                                                                            | Unit test: button presence with role=owner, subscription=premium                    |
| AC-18 | Collapsible project list renders projects for owner/admin (all projects)                                                                   | Unit test: project list items match mock data                                       |
| AC-19 | Collapsible project list renders only member's projects for member role                                                                    | Unit test: project list items filtered for member                                   |
| AC-20 | Owner dashboard workspace card title is a `<a>` link to `/tenants/:tenantId`                                                               | Unit test: `href` or `routerLink` inspection                                        |
| AC-21 | Member dashboard workspace card links to `/tenants/:tenantId` (not `/tenants/:tenantId/projects`)                                          | Unit test: `routerLink` inspection                                                  |
| AC-22 | E2E: navigating to `/tenants/:tenantId` renders workspace name, role, description, action buttons (as owner)                               | Playwright E2E test                                                                 |
| AC-23 | E2E: as member, action buttons are not visible on workspace detail page                                                                    | Playwright E2E test                                                                 |

### 16.7 Data model changes

#### 16.7.1 Server package — [`TenantSchema`](server/src/schemas/tenant.ts:8)

Add `description` field:

```typescript
// In server/src/schemas/tenant.ts — TenantSchema
export const TenantSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  subscription: z.enum(SubscriptionTier),
  description: z.string().max(500).nullable().optional(), // NEW
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
```

#### 16.7.2 Server package — [`CreateTenantSchema`](server/src/schemas/tenant.ts:33)

Add optional `description`:

```typescript
export const CreateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  subscription: z.enum(SubscriptionTier).default('free'),
  description: z.string().max(500).optional(), // NEW
});
```

#### 16.7.3 Server package — [`UpdateTenantSchema`](server/src/schemas/tenant.ts:50)

Add optional `description`:

```typescript
export const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .optional(),
  description: z.string().max(500).optional(), // NEW
});
```

#### 16.7.4 Server — [`TenantDocument`](server/src/repositories/tenant.repository.ts:11)

Add `description` to the MongoDB document interface:

```typescript
export interface TenantDocument {
  _id?: import('mongodb').ObjectId;
  id: string;
  name: string;
  slug: string;
  subscription: string;
  description: string | null; // NEW
  createdAt: Date;
  updatedAt: Date;
}
```

#### 16.7.5 Server — [`TenantRepository`](server/src/repositories/tenant.repository.ts:36)

Update [`toDomain()`](server/src/repositories/tenant.repository.ts:23) mapper:

```typescript
function toDomain(doc: TenantDocument): Tenant {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    subscription: doc.subscription as Tenant['subscription'],
    description: doc.description ?? undefined, // NEW — null → undefined for schema compat
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
```

Update [`create()`](server/src/repositories/tenant.repository.ts:57) input type:

```typescript
async create(input: { name: string; slug: string; subscription?: string; description?: string }): Promise<Tenant> {
  // ...
  description: input.description ?? null,
  // ...
}
```

Update [`update()`](server/src/repositories/tenant.repository.ts:72) input type:

```typescript
async update(id: string, input: Partial<Pick<TenantDocument, 'name' | 'slug' | 'description'>>): Promise<Tenant | null> {
  // unchanged logic — $set already handles arbitrary fields
}
```

#### 16.7.6 Server — [`TenantService`](server/src/services/tenant.service.ts)

Update [`createTenant()`](server/src/services/tenant.service.ts:32) to pass `description`:

```typescript
const tenant = await this.tenantRepo.create({ ...input, subscription, description: input.description });
```

Update [`updateTenant()`](server/src/services/tenant.service.ts:96) — the `input` type already flows from
[`UpdateTenantSchema`](server/src/schemas/tenant.ts:50) through to the repository. No code change needed beyond the
schema change if the service passes `input` directly to `this.tenantRepo.update(id, input)`. Verify this is the case; if
the service destructures fields explicitly, add `description` to the destructure.

#### 16.7.7 Server — [`TenantRepository`](server/src/repositories/tenant.repository.ts:36) type export

If [`TenantRepository.update()`](server/src/repositories/tenant.repository.ts:72) uses an explicit `Pick` type, update
it to include `'description'`:

```typescript
async update(id: string, input: Partial<Pick<TenantDocument, 'name' | 'slug' | 'description'>>): Promise<Tenant | null>
```

### 16.8 Frontend changes

#### 16.8.1 New route — [`app.routes.ts`](ui/src/app/app.routes.ts:37)

Add an empty-path child route as the **first** child (before `settings`):

```typescript
// In the children array of 'tenants/:tenantId'
{
  path: '',
  loadComponent: () =>
    import('./features/tenants/workspace-detail/workspace-detail').then((m) => m.WorkspaceDetail),
},
```

> **Note:** The empty path must be the first child to avoid route matching conflicts. Angular matches routes in order;
> placing it first ensures `/tenants/:tenantId` resolves to `WorkspaceDetail` rather than falling through to another
> child or showing an empty outlet.

#### 16.8.2 New component — `ui/src/app/features/tenants/workspace-detail/`

**Files:**

```
ui/src/app/features/tenants/workspace-detail/
├── workspace-detail.ts      # Component class
└── workspace-detail.html    # Template
```

**Component class** (`workspace-detail.ts`):

```typescript
import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantStore } from '@stores/tenant-store';
import { AuthStore } from '@stores/auth-store';
import { ProjectClient } from '@services/project-client';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideSettings, lucideUsers, lucideCreditCard, lucideChevronDown, lucideFolder } from '@ng-icons/lucide';
import type { Project } from '@task-board/shared';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'ui-workspace-detail',
  imports: [RouterLink, HlmBadgeImports, HlmButtonImports, HlmCardImports, HlmCollapsibleImports, NgIcon],
  providers: [provideIcons({ lucideSettings, lucideUsers, lucideCreditCard, lucideChevronDown, lucideFolder })],
  templateUrl: './workspace-detail.html',
})
export class WorkspaceDetail implements OnInit {
  private readonly tenantStore = inject(TenantStore);
  private readonly authStore = inject(AuthStore);
  private readonly projectClient = inject(ProjectClient);

  protected readonly tenant = computed(() => this.tenantStore.activeTenant());
  protected readonly role = computed(() => this.authStore.tenantRole());
  protected readonly description = computed(() => this.tenant()?.description ?? '');
  protected readonly projects = signal<Project[]>([]);
  protected readonly loadingProjects = signal(true);
  protected readonly projectsExpanded = signal(true);

  protected readonly isOwnerOrAdmin = computed(() => {
    const r = this.role();
    return r === 'owner' || r === 'admin';
  });

  protected readonly showUpgrade = computed(() => {
    return this.role() === 'owner' && this.tenant()?.subscription === 'free';
  });

  async ngOnInit(): Promise<void> {
    try {
      const res = await firstValueFrom(this.projectClient.list(1, 100));
      this.projects.set(res.data);
    } catch {
      // Non-blocking — projects section shows empty state
    } finally {
      this.loadingProjects.set(false);
    }
  }
}
```

**Template** (`workspace-detail.html`):

```html
<div class="mx-auto max-w-3xl py-8">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-foreground">{{ tenant()?.name }}</h1>
    <div class="mt-2 flex items-center gap-3">
      <span hlmBadge class="bg-purple-100 text-purple-700">{{ role() }}</span>
    </div>
  </div>

  <!-- Description -->
  <div class="mb-6">
    @if (description()) {
    <p class="text-sm text-muted-foreground">{{ description() }}</p>
    } @else {
    <p class="text-sm text-muted-foreground italic">No description provided.</p>
    }
  </div>

  <!-- Action Buttons (owner/admin only) -->
  @if (isOwnerOrAdmin()) {
  <div class="mb-6 flex flex-wrap gap-2">
    <a hlmBtn variant="outline" size="md" [routerLink]="['/tenants', tenant()?.id, 'settings']">
      <ng-icon name="lucideSettings" class="mr-1.5 h-4 w-4" />
      Settings
    </a>
    <a hlmBtn variant="outline" size="md" [routerLink]="['/tenants', tenant()?.id, 'settings/members']">
      <ng-icon name="lucideUsers" class="mr-1.5 h-4 w-4" />
      Members
    </a>
    @if (showUpgrade()) {
    <a hlmBtn variant="outline" size="md" [routerLink]="['/tenants', tenant()?.id, 'upgrade']">
      <ng-icon name="lucideCreditCard" class="mr-1.5 h-4 w-4" />
      Upgrade
    </a>
    }
  </div>
  }

  <!-- Collapsible Project List -->
  <hlm-collapsible [open]="projectsExpanded()" (openChange)="projectsExpanded.set($event)">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Projects ({{ projects().length }})</h2>
      <button hlmCollapsibleTrigger size="sm" variant="ghost">
        <ng-icon
          name="lucideChevronDown"
          class="h-4 w-4 transition-transform"
          [class.rotate-180]="projectsExpanded()"
        />
      </button>
    </div>

    <div hlmCollapsibleContent>
      @if (loadingProjects()) {
      <div class="py-4 text-center text-sm text-muted-foreground">Loading projects…</div>
      } @else if (projects().length === 0) {
      <div class="rounded-lg border border-dashed border-border py-8 text-center">
        <p class="text-sm text-muted-foreground">No projects yet.</p>
      </div>
      } @else {
      <div class="mt-4 space-y-2">
        @for (project of projects(); track project.id) {
        <a
          [routerLink]="['/tenants', tenant()?.id, 'projects', project.id]"
          class="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
        >
          <ng-icon name="lucideFolder" class="h-4 w-4 text-muted-foreground" />
          <div>
            <p class="text-sm font-medium text-foreground">{{ project.name }}</p>
            @if (project.description) {
            <p class="text-xs text-muted-foreground">{{ project.description }}</p>
            }
          </div>
        </a>
        }
      </div>
      }
    </div>
  </hlm-collapsible>
</div>
```

#### 16.8.3 [`TenantClient`](ui/src/app/services/tenant-client.ts) update

Update [`updateTenant()`](ui/src/app/services/tenant-client.ts:38) signature:

```typescript
updateTenant(tenantId: string, data: { name?: string; slug?: string; description?: string }): Observable<Tenant> {
  return this.http.patch<Tenant>(`${this.apiBaseUrl}/tenants/${tenantId}`, data);
}
```

#### 16.8.4 [`TenantStore`](ui/src/app/stores/tenant-store.ts) update

Update [`updateTenant()`](ui/src/app/stores/tenant-store.ts:53) signature:

```typescript
async updateTenant(tenantId: string, data: { name?: string; slug?: string; description?: string }): Promise<Tenant> {
  // unchanged body — data is passed through to tenantClient.updateTenant()
}
```

#### 16.8.5 [`TenantStore`](ui/src/app/stores/tenant-store.ts) — active tenant type

The [`TenantStore`](ui/src/app/stores/tenant-store.ts:14) stores `Tenant` objects. After the
[`TenantSchema`](server/src/schemas/tenant.ts:8) change (§16.7.1), the `Tenant` type will include `description`. No
store code changes needed — the type flows automatically.

#### 16.8.6 Dashboard changes

**[`owner-dashboard.html`](ui/src/app/features/dashboard/owner-dashboard/owner-dashboard.html:48)** — Make the workspace
name a link:

```html
<!-- Current: plain text -->
<h3 class="text-sm font-semibold text-foreground">{{ tenant.name }}</h3>

<!-- New: link to workspace detail -->
<a [routerLink]="['/tenants', tenant.id]" class="text-sm font-semibold text-foreground hover:text-primary">
  {{ tenant.name }}
</a>
```

**[`member-dashboard.html`](ui/src/app/features/dashboard/member-dashboard/member-dashboard.html:34)** — Change link
target from projects to workspace detail:

```html
<!-- Current: links to projects -->
<a [routerLink]="['/tenants', tenant.id, 'projects']" ...>
  <!-- New: links to workspace detail -->
  <a [routerLink]="['/tenants', tenant.id]" ...></a
></a>
```

### 16.9 RBAC visibility matrix

| UI Element                  | Owner (free) | Owner (premium) | Admin | Member |
| --------------------------- | :----------: | :-------------: | :---: | :----: |
| Workspace name (`<h1>`)     |      ✅      |       ✅        |  ✅   |   ✅   |
| Role badge                  |      ✅      |       ✅        |  ✅   |   ✅   |
| Description text            |      ✅      |       ✅        |  ✅   |   ✅   |
| Settings button             |      ✅      |       ✅        |  ✅   |   ❌   |
| Members button              |      ✅      |       ✅        |  ✅   |   ❌   |
| Upgrade button              |      ✅      |       ❌        |  ❌   |   ❌   |
| Project list (all projects) |      ✅      |       ✅        |  ✅   |   ❌   |
| Project list (own projects) |      ❌      |       ❌        |  ❌   |   ✅   |

### 16.10 Out of scope

- Editing workspace description inline on the workspace detail page (description is edited via Settings page).
- Workspace avatar / logo upload.
- Recent activity feed on the workspace detail page.
- Project creation from the workspace detail page (existing flow via `/tenants/:tenantId/projects`).
- Drag-and-drop reordering of projects in the list.
- Workspace analytics or statistics on the detail page.

### 16.11 Open questions / assumptions

#### Blocking questions

| #       | Question                                                                                                                                                                                                                                                                                                                                                                  | Impact                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| BQ-16.1 | The [`GET /projects`](server/src/routes/projects.ts) endpoint returns all projects for the active tenant. For `member` role, does the server already filter by project membership, or does the client need to filter? If the server returns all projects regardless of project membership, a new query parameter or endpoint is needed for member-scoped project listing. | FR-16.18 — member project visibility |
| BQ-16.2 | Does [`TenantRepository.update()`](server/src/repositories/tenant.repository.ts:72) need an explicit migration for existing documents that lack the `description` field, or does MongoDB handle missing fields gracefully as `null`/`undefined`?                                                                                                                          | AC-6 — backward compatibility        |

#### Assumptions

| #   | Assumption                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | MongoDB documents without a `description` field will return `undefined` when accessed, which maps to `null` in the domain model — no migration needed                                         |
| A-2 | The [`HlmCollapsible`](ui/libs/ui/collapsible/src/lib/hlm-collapsible.ts) Spartan UI component is already installed and available in the project                                              |
| A-3 | The [`ProjectClient.list()`](ui/src/app/services/project-client.ts:21) method uses the active tenant context (via `X-Tenant-Id` header interceptor) to scope results                          |
| A-4 | For member role, the current `GET /projects` endpoint returns all tenant projects; client-side filtering by project membership will be used as an interim solution pending BQ-16.1 resolution |
| A-5 | The empty-path child route does not conflict with wildcard redirects since Angular resolves child routes before the parent's wildcard                                                         |

---

## Summary

```json
{
  "tz_file": "docs/implementation/technical_specification.md",
  "blocking_questions": [
    "BQ-TM-1: The server tenants.ts route file does not include a GET /:tenantId/members endpoint (to list tenant members), although the shared contract tenant.contracts.ts defines it as listMembers. This endpoint must be verified as deployed or added to the backend before the tenant member list UI can function.",
    "BQ-16.1: Does GET /projects filter by project membership for 'member' tenant role, or does it return all tenant projects? A new query parameter or endpoint may be needed for member-scoped project listing.",
    "BQ-16.2: Does TenantRepository.update() need a migration for existing documents lacking the 'description' field, or does MongoDB handle missing fields gracefully?"
  ],
  "assumptions": [
    "JWT is the sole authentication mechanism; no OAuth, no SSO.",
    "MongoDB Atlas is the only data store; no relational database.",
    "All API communication is over HTTPS; no WebSocket or real-time subscriptions in MVP.",
    "The shared package is published locally via npm workspaces; no private registry needed.",
    "Drag-and-drop on the frontend uses native HTML5 drag-and-drop or a lightweight library; no heavy dependency.",
    "Registration does NOT auto-create a tenant. Users must explicitly create a workspace after registration.",
    "User emails are globally unique across all tenants.",
    "The `X-Tenant-Id` header is the mechanism for frontend to declare active tenant; the backend validates active membership (status: 'active').",
    "Password hashing uses bcryptjs (pure JS, Workers-compatible); no native bcrypt or argon2.",
    "Zod v4 is used in the server package for validation; `z.interface()` preferred for object schemas. The shared package is runtime-library free (no Zod dependency).",
    "Angular 22 zoneless mode is the default; no `zone.js` dependency.",
    "Tailwind CSS v4 CSS-first configuration; no `tailwind.config.js`.",
    "Hono RPC client is available for type-safe frontend→backend calls but the explicit shared-package contract approach is used as the primary pattern.",
    "The tenant member invite endpoint (POST /tenants/:tenantId/members) accepts { email, role } in the body. It supports both registered and unregistered users.",
    "TenantClient needs to be extended with member management, tenant update/delete, and invitation acceptance methods.",
    "The existing error interceptor (error.interceptor.ts) handles 401/403/422 globally; new components integrate with this pattern.",
    "Subscription tiers are enforced at the service layer. For MVP, subscription upgrade uses a mock payment page (no real Stripe/payment integration). The tenant's `subscription` field is updated directly via `PATCH /tenants/:tenantId`.",
    "Invitation tokens are UUIDs stored on the TenantMember document. The frontend invitation acceptance URL is {FRONTEND_URL}/auth/accept-invitation?token=<token>.",
    "Inactive members (status: 'pending', 'declined', 'access_revoked') have no access to any tenant resource. Only 'active' members can access tenant-scoped endpoints. 'declined' and 'access_revoked' members remain in the member list visible to owner/admin for later management (resend or hard-delete).",
    "Free workspace limits: 1 workspace per user, 3 projects per workspace, 10 users per project. Premium: unlimited.",
    "A newly registered user with no tenants receives a JWT with tenantId: null. The frontend must handle this state by showing a workspace creation or invitation acceptance screen.",
    "Invitation emails are sent via Resend (free tier: 3,000/month, 100/day). The `resend` npm package is a server dependency. `RESEND_API_KEY` is a Cloudflare Worker secret. In dev, a console-logging adapter logs invitation links.",
    "The root route (/) removes the authGuard to allow unauthenticated visitors to see the landing page. All other authenticated routes retain their guards.",
    "Cross-tenant endpoints (GET /invitations/my, GET /tasks/my) do not require the X-Tenant-Id header. They are registered at the app level outside the tenant-scoped router.",
    "The dashboard component handles all state detection internally via signals — no separate route guards for each dashboard state.",
    "GET /tasks/my returns tasks enriched with denormalized tenantName, projectName, and columnTitle for display. Application-level aggregation is used (not DB-level), since tenants could be in different databases.",
    "Declining an invitation sets the TenantMember status to 'declined' (soft delete) rather than deleting the record, to preserve audit trail.",
    "Owner/admin revoking access sets the TenantMember status to 'access_revoked' (soft delete). Owner/admin can later resend invitation (→ 'pending') or hard-delete permanently.",
    "GET /tenants response includes a 'role' field per tenant, derived from the tenant_members join.",
    "MongoDB documents without a 'description' field return undefined when accessed — no migration needed for existing tenant documents.",
    "The HlmCollapsible Spartan UI component is already installed and available in the project.",
    "ProjectClient.list() uses the active tenant context (X-Tenant-Id header) to scope results.",
    "For member role, client-side filtering of projects by project membership is used as an interim solution until a server-side filter endpoint is available.",
    "The empty-path child route does not conflict with wildcard redirects since Angular resolves child routes before the parent's wildcard."
  ]
}
```
