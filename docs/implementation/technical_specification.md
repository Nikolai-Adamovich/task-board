# Task Board MVP — Technical Specification

> **Version:** 2.0.0 **Date:** 2026-07-28 **Status:** Approved **Scope:** MVP vertical slice — multi-tenant task board
> with Kanban boards, tasks, sprints, and RBAC **Reference:** [project_description.md](../project_description.md)

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
| Tenant CRUD (org creation, user membership)         | Billing / subscription management         |
| User registration + authentication (email/password) | SSO / OAuth / SAML                        |
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
- **Shared package:** TypeScript types, Zod v4 schemas, API contracts
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
| **Zod**                    | `4.0.0`  | `z.interface()` for schemas, `zod/mini` for tree-shaking                                 |
| **Tailwind CSS**           | `4.1.0`  | CSS-first config via `@theme`, no `tailwind.config.js`                                   |
| **Spartan UI**             | `0.12.0` | `@spartan-ng/brain` + `@spartan-ng/helm`                                                 |
| **Vitest**                 | `4.0.0`  | Unit and integration tests                                                               |
| **Playwright**             | `1.55.0` | E2E tests                                                                                |
| **ESLint**                 | `9.x`    | Flat config (`eslint.config.js`)                                                         |
| **Prettier**               | `3.x`    | Code formatting                                                                          |
| **Wrangler**               | `4.x`    | Cloudflare dev/deploy CLI                                                                |
| **bcrypt**                 | `6.x`    | Password hashing (server-side)                                                           |

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

#### Key Zod 4 changes from v3

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

#### Tenant (Organization)

| Field       | Type            | Description                          |
| ----------- | --------------- | ------------------------------------ |
| `_id`       | `ObjectId`      | MongoDB primary key                  |
| `id`        | `string` (UUID) | Public identifier                    |
| `name`      | `string`        | Organization name (e.g. "Acme Corp") |
| `slug`      | `string`        | URL-friendly unique identifier       |
| `createdAt` | `Date`          | Creation timestamp                   |
| `updatedAt` | `Date`          | Last modification timestamp          |

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

| Field       | Type            | Description                    |
| ----------- | --------------- | ------------------------------ |
| `_id`       | `ObjectId`      | MongoDB primary key            |
| `userId`    | `string` (UUID) | Reference to User              |
| `tenantId`  | `string` (UUID) | Reference to Tenant            |
| `role`      | `TenantRole`    | `owner` \| `admin` \| `member` |
| `createdAt` | `Date`          |                                |

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
   user's `TenantMember` record.
2. **Project access is a subset of tenant access** — a user must first be a tenant member, then be granted a project
   role via `ProjectMember`.
3. **Viewer cannot write** — project viewers can read but cannot create, update, or delete any entity.
4. **Ownership overrides** — tenant owners bypass all project-level restrictions.
5. **Tenant isolation is enforced at the data layer** — every query filters by `tenantId`.

---

## 4. API Contracts

All endpoints are RESTful under the base path `/api/v1`. Authentication is via Bearer JWT token in the `Authorization`
header. Every request/response shape is defined with Zod schemas in the shared package.

### 4.1 Base URL and auth

```
Base URL: /api/v1
Auth: Bearer <jwt>
Tenant context: X-Tenant-Id header (derived from JWT claims)
```

### 4.2 Auth endpoints

| Method | Path             | Description                  |
| ------ | ---------------- | ---------------------------- |
| `POST` | `/auth/register` | Register a new user          |
| `POST` | `/auth/login`    | Authenticate and receive JWT |
| `GET`  | `/auth/me`       | Get current user profile     |

### 4.3 Tenant endpoints

| Method   | Path                                 | Description                              |
| -------- | ------------------------------------ | ---------------------------------------- |
| `GET`    | `/tenants`                           | List tenants the user belongs to         |
| `POST`   | `/tenants`                           | Create a new tenant (user becomes owner) |
| `GET`    | `/tenants/:tenantId`                 | Get tenant details                       |
| `PATCH`  | `/tenants/:tenantId`                 | Update tenant (owner/admin only)         |
| `POST`   | `/tenants/:tenantId/members`         | Invite/add member to tenant              |
| `PATCH`  | `/tenants/:tenantId/members/:userId` | Update member role                       |
| `DELETE` | `/tenants/:tenantId/members/:userId` | Remove member from tenant                |

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

All schemas are defined in the shared package at `packages/shared/src/schemas/` using Zod v4 (`z.interface()` for object
schemas — preferred over `z.object()` for better performance and type inference).

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
});
```

#### Create Tenant Response

```typescript
// Zod v4 schema: TenantSchema
export const TenantSchema = z.interface({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

**users**

- `{ email: 1 }` — unique

**tenant_members**

- `{ userId: 1, tenantId: 1 }` — unique compound
- `{ tenantId: 1 }`

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

`packages/shared/` — npm workspace package

### 6.2 Contents

| Path              | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `src/schemas/`    | Zod validation schemas for all API request/response shapes                           |
| `src/types/`      | TypeScript type definitions derived from Zod schemas (`infer` from Zod)              |
| `src/contracts/`  | API contract definitions (endpoint paths, HTTP methods, request/response type pairs) |
| `src/constants/`  | Shared constants (e.g., default column names, role enums, priority enums)            |
| `src/validators/` | Reusable Zod validator helpers (e.g., UUID validator, slug validator)                |
| `index.ts`        | Barrel exports for all shared types, schemas, and contracts                          |

### 6.3 Key Zod schemas (file references)

| Schema file          | Schemas defined                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `schemas/tenant.ts`  | `CreateTenantSchema`, `TenantSchema`, `UpdateTenantSchema`, `TenantMemberSchema`           |
| `schemas/user.ts`    | `UserSchema`, `CreateUserSchema`, `LoginRequestSchema`, `AuthResponseSchema`               |
| `schemas/project.ts` | `CreateProjectSchema`, `ProjectSchema`, `UpdateProjectSchema`, `ProjectMemberSchema`       |
| `schemas/board.ts`   | `CreateBoardSchema`, `BoardSchema`, `UpdateBoardSchema`, `ColumnSchema`                    |
| `schemas/task.ts`    | `CreateTaskSchema`, `TaskSchema`, `UpdateTaskSchema`, `MoveTaskSchema`, `AssignTaskSchema` |
| `schemas/sprint.ts`  | `CreateSprintSchema`, `SprintSchema`, `UpdateSprintSchema`                                 |
| `schemas/auth.ts`    | `LoginRequestSchema`, `RegisterRequestSchema`, `AuthResponseSchema`                        |
| `schemas/common.ts`  | `ErrorResponseSchema`, `PaginationSchema`, `PaginatedResponseSchema`                       |

### 6.4 Type derivation (Zod v4)

All TypeScript types are derived from Zod v4 schemas using `z.infer<>` (API unchanged from v3):

```typescript
// Example: packages/shared/src/types/project.ts
import { z } from 'zod';
import { ProjectSchema, CreateProjectSchema, UpdateProjectSchema } from '../schemas/project';

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
```

> **Zod v4 note:** For tree-shaking in the frontend bundle, import from `"zod/mini"` instead of `"zod"` when only
> parsing/validation is needed (no full ZodError details). The backend can use the full `"zod"` bundle without concern.

### 6.5 Contract definitions

API contracts define the method, path, request type, response type, and possible error codes for each endpoint:

```typescript
// Example: packages/shared/src/contracts/project.contracts.ts
import { HttpMethod } from '../constants';

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

| Constant             | Values                                                  |
| -------------------- | ------------------------------------------------------- |
| `TenantRole`         | `'owner'`, `'admin'`, `'member'`                        |
| `ProjectRole`        | `'admin'`, `'developer'`, `'viewer'`                    |
| `TaskPriority`       | `'low'`, `'medium'`, `'high'`, `'critical'`             |
| `SprintStatus`       | `'planned'`, `'active'`, `'completed'`                  |
| `DefaultColumnNames` | `['Backlog', 'To Do', 'In Progress', 'Review', 'Done']` |
| `HttpMethod`         | `'GET'`, `'POST'`, `'PATCH'`, `'DELETE'`                |

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
import { provideZonelessChangeDetection } from '@angular/core';
import { routes } from './app.routes';
import { authInterceptor, tenantInterceptor, errorInterceptor } from './core/interceptors';

export const appConfig = {
  providers: [
    provideZonelessChangeDetection(),
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
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return true;
};
```

### 7.4 State management

All state is signal-based. Stores are plain Angular services using `signal()`, `computed()`, `linkedSignal()`, and
`resource()` — no external state management library.

| Concern         | Mechanism                              | Key APIs                                                                                                                 |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Auth state      | `inject(AuthService)` — signal store   | `currentUser = signal<User \| null>(null)`, `isAuthenticated = computed(() => !!this.currentUser())`                     |
| Tenant context  | `inject(TenantService)` — signal store | `activeTenant = linkedSignal(() => this.tenants()[0])`, `tenants = resource({ loader: () => this.fetchTenants() })`      |
| Project data    | `inject(ProjectStore)` — signal store  | `projects = resource({ loader: () => this.fetchProjects() })`, `currentProject = linkedSignal(() => this.projects()[0])` |
| Board/Task data | `inject(BoardStore)` — signal store    | `board = resource({ params: () => ({ id: this.boardId() }), loader: ({ params }) => this.fetchBoard(params.id) })`       |
| UI state        | Component-level signals                | `showSidebar = signal(true)`, `selectedFilter = linkedSignal(() => FILTER_OPTIONS[0])`                                   |

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
  parse: (data) => ProjectSchema.parse(data), // Zod v4 runtime validation
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
│   ├── validation.ts           # Zod request body/query/param validation
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
   shared package. Uses `z.interface().parse()` / `.safeParse()`. Returns 422 with structured validation errors on
   failure.
6. **RouteHandler** — the actual endpoint handler, which delegates to the appropriate service.

### 8.3 Service layer design

Each service is a plain TypeScript class (no framework dependency) that:

- Receives `tenantId` as its first parameter on every method
- Delegates persistence to the corresponding repository
- Enforces business rules (e.g., only project admin can delete a board, only members can create tasks)
- Returns typed results that map directly to shared package response schemas

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

- **Registration:** `POST /auth/register` creates a user, hashes the password with bcrypt, and returns a JWT.
- **Login:** `POST /auth/login` verifies credentials and returns a JWT.
- **JWT payload:**

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

- **Token strategy:** Access-token-only with 24-hour expiry. No refresh tokens in MVP. The frontend re-authenticates on
  401 by redirecting to login.
- **Signing:** HS256 with a secret stored in environment variables (`JWT_SECRET`).
- **Multi-tenant context:** The JWT contains the `tenantId` for the user's current active tenant. When the user switches
  tenants on the frontend, a new JWT is issued via `POST /auth/switch-tenant` (returns a new token with updated
  `tenantId` and `tenantRole` claims).

> **MVP decision (blocking question resolved):** JWT refresh strategy is access-token-only with 24h expiry. Refresh
> tokens are out of scope. If the token expires, the user is redirected to login. This is acceptable for an educational
> MVP.

### 8.6 Tenant context propagation

The `X-Tenant-Id` header is used by the frontend to indicate the active tenant. The backend middleware validates that
the authenticated user is a member of the specified tenant (via `TenantMember` lookup). If the user is not a member of
the tenant, the request is rejected with 403.

---

## 9. Acceptance Criteria

### 9.1 Functional acceptance criteria

| #     | Criterion                                                  | Verification                                                                              |
| ----- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AC-1  | A user can register with email and password                | `POST /auth/register` returns 201 with user + JWT                                         |
| AC-2  | A user can log in and receive a JWT                        | `POST /auth/login` returns 200 with JWT; invalid credentials return 401                   |
| AC-3  | A user can create a tenant and become its owner            | `POST /tenants` returns 201; user is auto-added as `owner`                                |
| AC-4  | A user can list their tenants                              | `GET /tenants` returns 200 with array of tenant objects                                   |
| AC-5  | A tenant owner can invite members                          | `POST /tenants/:tenantId/members` adds a member with specified role                       |
| AC-6  | A tenant admin can create a project                        | `POST /projects` returns 201; project has `tenantId`                                      |
| AC-7  | A project admin can create a board with custom columns     | `POST /boards` creates board + columns; `GET /boards/:boardId` returns board with columns |
| AC-8  | A developer can create a task in a project                 | `POST /tasks` returns 201; task has `tenantId`, `projectId`, `boardId`, `columnId`        |
| AC-9  | A developer can move a task between columns                | `PATCH /tasks/:taskId/move` updates `columnId` and `position`                             |
| AC-10 | A developer can assign users to a task                     | `PATCH /tasks/:taskId/assign` updates `assigneeIds`                                       |
| AC-11 | A project admin can create a sprint                        | `POST /sprints` returns 201                                                               |
| AC-12 | A project admin can move a task from backlog into a sprint | `POST /sprints/:sprintId/tasks` adds task to sprint; task's `sprintId` is updated         |
| AC-13 | A viewer cannot create, edit, or delete tasks              | `POST /tasks` returns 403 for viewer role                                                 |
| AC-14 | A user from tenant A cannot access data from tenant B      | `GET /projects` with tenant B's ID returns 403 or empty list                              |
| AC-15 | All API responses conform to shared Zod schemas            | Integration tests validate response shapes against schemas                                |
| AC-16 | The frontend renders a Kanban board with columns and tasks | Board view displays columns in order; tasks are draggable between columns                 |
| AC-17 | The frontend enforces RBAC in the UI                       | Viewers see read-only views; unauthorized actions are hidden/disabled                     |
| AC-18 | Tenant isolation is enforced at the database level         | All MongoDB queries include `tenantId` filter; no cross-tenant data is returned           |

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

1. **Shared package** — types, schemas, contracts (foundation for both frontend and backend)
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

| #    | Question                                                          | Resolution                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BQ-1 | What JWT refresh strategy is acceptable for MVP?                  | **Access-token-only with 24h expiry.** No refresh tokens. The frontend re-authenticates on 401. See §8.5.                                                                                                                                  |
| BQ-2 | Should default column names be configurable per board or fixed?   | **Configurable.** `CreateBoardSchema.columnNames` accepts an array of column names. `DefaultColumnNames` constant (`['Backlog', 'To Do', 'In Progress', 'Review', 'Done']`) is used as a fallback when no columns are specified. See §6.6. |
| BQ-3 | Is there a requirement for task comments or activity logs in MVP? | **Out of scope.** Task comments and activity logs are excluded from the MVP vertical slice. They may be added in a future iteration.                                                                                                       |
| BQ-4 | What password reset / email verification flow is expected?        | **Out of scope for MVP.** Basic email/password auth without password reset or email verification. Users register and log in directly. These features may be added post-MVP.                                                                |

---

## Summary

```json
{
  "tz_file": "docs/implementation/technical_specification.md",
  "blocking_questions": [],
  "assumptions": [
    "JWT is the sole authentication mechanism; no OAuth, no SSO.",
    "MongoDB Atlas is the only data store; no relational database.",
    "All API communication is over HTTPS; no WebSocket or real-time subscriptions in MVP.",
    "The shared package is published locally via npm workspaces; no private registry needed.",
    "Drag-and-drop on the frontend uses native HTML5 drag-and-drop or a lightweight library; no heavy dependency.",
    "Tenant creation is self-service (any registered user can create a tenant and become its owner).",
    "User emails are globally unique across all tenants.",
    "The `X-Tenant-Id` header is the mechanism for frontend to declare active tenant; the backend validates membership.",
    "Password hashing uses bcrypt (v6.x); no argon2 in MVP.",
    "Zod v4 is used throughout; `z.interface()` preferred for object schemas, `zod/mini` for frontend tree-shaking.",
    "Angular 22 zoneless mode is the default; no `zone.js` dependency.",
    "Tailwind CSS v4 CSS-first configuration; no `tailwind.config.js`.",
    "Hono RPC client is available for type-safe frontend→backend calls but the explicit shared-package contract approach is used as the primary pattern (simpler for educational purposes)."
  ]
}
```
