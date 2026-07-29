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
> `GET /:tenantId/members` endpoint (to list tenant members), although the shared contract
> [`tenant.contracts.ts`](shared/src/contracts/tenant.contracts.ts:74) defines it as `listMembers`. This endpoint must
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

## Summary

```json
{
  "tz_file": "docs/implementation/technical_specification.md",
  "blocking_questions": [
    "BQ-TM-1: The server tenants.ts route file does not include a GET /:tenantId/members endpoint (to list tenant members), although the shared contract tenant.contracts.ts defines it as listMembers. This endpoint must be verified as deployed or added to the backend before the tenant member list UI can function."
  ],
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
    "Hono RPC client is available for type-safe frontend→backend calls but the explicit shared-package contract approach is used as the primary pattern (simpler for educational purposes).",
    "The tenant member invite endpoint (POST /tenants/:tenantId/members) accepts { email, role } in the body, not { userId, role } — consistent with the server route implementation.",
    "TenantClient needs to be extended with member management and tenant update/delete methods; ProjectClient already has all required project member methods.",
    "The existing error interceptor (error.interceptor.ts) handles 401/403/422 globally; new components integrate with this pattern rather than implementing custom error handling."
  ]
}
```
