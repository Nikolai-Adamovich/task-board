# Task Board MVP — Architecture

> **Version:** 4.1.0 **Date:** 2026-08-04 **Status:** Approved **Reference:**
> [Technical Specification v4.0.0](../implementation/technical_specification.md) ·
> [Project Description](../project_description.md)

---

## 1. System Architecture

### 1.1 High-level diagram (text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Angular 22+ SPA (standalone components, zoneless, signals)         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │  │
│  │  │  Auth     │  │  Tenant  │  │  Project │  │  Board / Task /    │  │  │
│  │  │  Module   │  │  Context │  │  Module  │  │  Sprint Modules    │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  State Stores (signals): AuthStore, TenantService, BoardStore  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  HTTP Interceptors (auth header, X-Tenant-Id, error handling) │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│                          HTTPS (Bearer JWT + X-Tenant-Id)                 │
│                                    │                                      │
├────────────────────────────────────┼──────────────────────────────────────┤
│                              CLOUDFLARE EDGE                              │
│  ┌────────────────────────────────┼────────────────────────────────────┐  │
│  │  Cloudflare Pages (static SPA) │  Cloudflare Workers (Hono API)    │  │
│  │  /auth/*, /tenants/*, etc.    │  /api/v1/*                         │  │
│  └────────────────────────────────┼────────────────────────────────────┘  │
│                                    │                                      │
├────────────────────────────────────┼──────────────────────────────────────┤
│                              BACKEND (Hono on Workers)                   │
│  ┌────────────────────────────────┼────────────────────────────────────┐  │
│  │  Middleware Pipeline:         │                                      │  │
│  │  ErrorHandler → Auth →        │  TenantContext → RBAC → Validation │  │
│  │  → RouteHandler               │                                      │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  Routes (feature-organized):  │                                      │  │
│  │  /auth, /tenants, /projects,  │  /boards, /columns, /tasks,        │  │
│  │  /sprints, /invitations       │                                      │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  Services (business logic):   │                                      │  │
│  │  AuthService, TenantService,  │  ProjectService, BoardService,      │  │
│  │  TaskService, SprintService,  │  RBACService, EmailService          │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  Repositories (data access):  │                                      │  │
│  │  TenantRepo, UserRepo,        │  ProjectRepo, BoardRepo,            │  │
│  │  TaskRepo, SprintRepo,        │  TenantMemberRepo                   │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  MongoDB (MongoDB Atlas)      │                                      │  │
│  └────────────────────────────────┴────────────────────────────────────┘  │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Email Service (Resend) — invitation emails                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component boundaries

| Boundary           | Responsibility                                                                                | Technology                        |
| ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------- |
| **Client**         | SPA rendering, user interaction, local state, API calls                                       | Angular 22+ standalone components |
| **Edge (Pages)**   | Static asset serving, SPA routing fallback                                                    | Cloudflare Pages                  |
| **Edge (Workers)** | API request handling, middleware pipeline, auth, validation, subscription limits              | Hono on Cloudflare Workers        |
| **Data**           | Document storage, tenant-scoped queries, indexes                                              | MongoDB Atlas                     |
| **Email**          | Transactional email delivery (invitation emails)                                              | Resend (REST API)                 |
| **Shared**         | Types, constants, utility helpers — consumed by both client and server (runtime-library free) | npm workspace package             |

### 1.3 Data flow

**Standard CRUD flow:**

1. **User interacts with UI** → Angular component emits an action (e.g., creates a task).
2. **Component calls a service** → `TaskService` in the Angular app builds a typed request using shared types.
3. **HTTP interceptor** attaches `Authorization: Bearer <jwt>` and `X-Tenant-Id` headers.
4. **Request reaches Hono Worker** → passes through the middleware pipeline (auth → tenant context → RBAC → validation).
5. **Route handler** delegates to the appropriate service (e.g., `TaskService.createTask()`).
6. **Service** enforces business rules, checks subscription limits, calls the repository.
7. **Repository** executes a MongoDB query scoped by `tenantId`.
8. **Result** flows back through the service → route handler → middleware → response.
9. **Frontend receives typed response** → updates signal-based store → UI re-renders.

**Registration flow (no auto-tenant):**

1. User submits registration form → `POST /auth/register { email, password, displayName }`.
2. Server creates user, issues JWT with `tenantId: null`.
3. Frontend receives JWT → stores it → redirects to workspace creation or invitation acceptance screen.

**Invitation flow:**

1. Tenant owner/admin sends `POST /tenants/:tenantId/members { email, role }`.
2. If email belongs to a registered user → `TenantMember` created with `status: 'active'`.
3. If email is unregistered → `TenantMember` created with `status: 'pending'`, `invitationToken` generated, invitation
   email sent via Resend.
4. Invited person clicks email link → `/auth/accept-invitation?token=<token>`.
5. Frontend calls `GET /invitations/:token` (public) → shows invitation details.
6. User registers (if needed) → calls `POST /auth/accept-invitation { token }`.
7. Server activates membership, returns updated `TenantMember`. Frontend calls `POST /auth/switch-tenant` for new JWT.

### 1.4 Tenant context flow

```
Frontend:  User selects tenant → TenantService.setActiveTenant(tenantId)
           → HTTP interceptor reads tenantId → attaches X-Tenant-Id header

Backend:   X-Tenant-Id header → TenantContextMiddleware
           → validates user is a TenantMember of that tenant WITH status: 'active'
           → pending/declined/access_revoked members are rejected with 403
           → sets c.get('tenantId') on the Hono context
           → all downstream services/repositories use this tenantId
```

---

## 2. Monorepo Structure

### 2.1 Top-level layout

```
task-board/
├── server/                    # Hono backend (Cloudflare Workers)
│   ├── src/
│   │   ├── index.ts           # Hono app bootstrap
│   │   ├── middleware/        # Auth, tenant context, RBAC, validation, error handler
│   │   ├── routes/            # Feature-organized route files
│   │   ├── services/          # Business logic layer
│   │   ├── repositories/      # MongoDB data access layer
│   │   ├── db/                # MongoDB connection setup
│   │   └── types/             # Hono context type extensions
│   ├── wrangler.toml          # Worker configuration
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                    # Shared npm workspace package (runtime-library free)
│   ├── src/
│   │   ├── types/             # Plain TypeScript interfaces (no Zod dependency)
│   │   ├── constants/         # Enums, default values, shared constants (valuesOf helper)
│   │   ├── utils/             # Utility helpers (valuesOf)
│   │   └── index.ts           # Barrel exports — constants, types, valuesOf
│   ├── package.json           # Zero dependencies
│   └── tsconfig.json
│
├── server/ (schemas/, contracts/, validators/)
│   ├── src/
│   │   ├── schemas/           # Zod v4 validation schemas (one file per domain)
│   │   ├── contracts/         # API contract definitions (method, path, types)
│   │   └── validators/        # Reusable Zod validator helpers (uuid, slug, pagination)
│
├── ui/                        # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts
│   │   │   ├── app.routes.ts  # Standalone router configuration
│   │   │   ├── app.config.ts  # Providers (auth, tenant, HTTP interceptors)
│   │   │   ├── shell/         # AppShellComponent, SidebarComponent, HeaderComponent
│   │   │   ├── auth/          # LoginComponent, RegisterComponent, AuthGuard
│   │   │   ├── tenants/       # TenantListComponent, TenantDetailComponent, TenantMemberListComponent
│   │   │   ├── projects/      # ProjectListComponent, ProjectDetailComponent, ProjectMemberListComponent
│   │   │   ├── boards/        # BoardViewComponent, ColumnComponent, TaskCardComponent
│   │   │   ├── tasks/         # TaskDetailComponent, TaskFormComponent, TaskListComponent
│   │   │   ├── sprints/       # SprintListComponent, SprintDetailComponent, SprintBacklogComponent
│   │   │   ├── dashboard/     # Adaptive dashboard (Phase 11): state detection + sub-views
│   │   │   ├── layout/        # AppShellComponent, SidebarComponent, HeaderComponent
│   │   │   └── shared/        # Shared UI components (buttons, modals, spinners)
│   │   ├── services/          # Angular services (AuthService, TenantService, etc.)
│   │   ├── stores/            # Signal-based state stores
│   │   ├── interceptors/      # HTTP interceptors (auth, tenant, error)
│   │   ├── guards/            # Route guards (AuthGuard, TenantGuard, ProjectGuard)
│   │   └── resolvers/         # Route resolvers (ProjectResolver)
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── project_description.md
│   └── implementation/
│       ├── technical_specification.md
│       └── architecture.md    # This file
│
├── .roomodes
├── package.json               # Root npm workspace config
└── tsconfig.base.json         # Shared TypeScript base config
```

### 2.2 npm workspace configuration

The root `package.json` defines the workspaces:

```json
{
  "workspaces": ["server", "shared", "ui"]
}
```

- `shared` is a dependency of both `server` and `ui`.
- `server` and `ui` are independent of each other (no direct dependency).
- All three packages share the same TypeScript base config via `tsconfig.base.json`.

### 2.3 Feature-oriented organization principle

Each feature (auth, tenants, projects, boards, tasks, sprints) has its own files in every package:

- **shared:** `types/<feature>.ts`, `constants/`
- **server:** `schemas/<feature>.ts`, `contracts/<feature>.contracts.ts`, `validators/`
- **server:** `routes/<feature>.ts`, `services/<feature>.service.ts`, `repositories/<feature>.repository.ts`
- **ui:** `feature/<feature>/` directory with components, services, and guards grouped together

This keeps related code co-located and makes vertical slices easy to identify and implement.

---

## 3. Shared Package Design

### 3.1 Purpose

The shared package is the **single source of truth** for types and constants. It is a runtime-library-free package (zero
dependencies) consumed by both the Angular frontend and the Hono backend, ensuring end-to-end type safety. Zod
validation schemas, API contracts, and validators live in the server package.

### 3.2 Directory layout

```
shared/src/
├── types/
│   ├── auth.ts                # LoginRequest, RegisterRequest, AuthResponse, etc.
│   ├── tenant.ts              # Tenant, CreateTenant, UpdateTenant, TenantMember, etc.
│   ├── user.ts                # User, CreateUser
│   ├── project.ts             # Project, CreateProject, UpdateProject, ProjectMember
│   ├── board.ts               # Board, CreateBoard, UpdateBoard, Column, CreateColumn
│   ├── task.ts                # Task, CreateTask, UpdateTask, MoveTask, AssignTask, MyTask
│   ├── sprint.ts              # Sprint, CreateSprint, UpdateSprint
│   └── common.ts              # ThemeManifestItem, ErrorResponse, Pagination, ListQuery,
│                              # UserPreferences, UpdateUserPreferences, SupportRequest
├── constants/
│   ├── roles.ts               # TenantRole, ProjectRole, TaskPriority, SprintStatus, MemberStatus, SubscriptionTier
│   │                          # (uses valuesOf() helper for strongly-typed value tuples)
│   ├── columns.ts             # DefaultColumnNames
│   ├── http.ts                # HttpMethod (uses valuesOf() helper)
│   ├── paths.ts               # API path constants
│   ├── theme.ts               # DEFAULT_THEME_ID = 'light'
│   └── expand-state.ts        # ExpandState constants
├── utils/
│   └── values-of.ts           # valuesOf(obj) — extracts values from `as const` objects as typed tuples
└── index.ts                   # Barrel exports — constants, types, valuesOf, DEFAULT_THEME_ID
```

> **Note:** Zod validation schemas, API contracts, and validator helpers are in the **server package**:
>
> ```
> server/src/
> ├── schemas/                  # Zod v4 validation schemas (one file per domain)
> ├── contracts/                # API contract definitions (method, path, types)
> └── validators/               # Reusable Zod validator helpers (uuid, slug, pagination)
> ```

### 3.3 Type definition pattern (plain TypeScript interfaces)

All TypeScript types in the shared package are plain interfaces with no runtime dependency:

```typescript
// shared/src/types/project.ts
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

export interface UpdateProject {
  name?: string;
  slug?: string;
  description?: string;
}
```

The server package defines Zod schemas that validate against these types:

```typescript
// server/src/schemas/project.ts
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

### 3.4 Contract definitions

API contracts define the method, path, request/response types, and error codes for each endpoint. They live in the
server package and serve as the contract between frontend and backend:

```typescript
// server/src/contracts/task.contracts.ts
import { HttpMethod } from '@task-board/shared';

export const TaskContracts = {
  list: {
    method: HttpMethod.GET,
    path: '/tasks',
    query: {
      tenantId: 'string',
      projectId: 'string',
      boardId: 'string',
      columnId: 'string',
      sprintId: 'string',
    },
    response: PaginatedResponseSchema(TaskSchema),
  },
  create: {
    method: HttpMethod.POST,
    path: '/tasks',
    body: CreateTaskSchema,
    response: TaskSchema,
    errors: ['FORBIDDEN', 'VALIDATION_ERROR', 'CONFLICT', 'NOT_FOUND'],
  },
  move: {
    method: HttpMethod.PATCH,
    path: '/tasks/:taskId/move',
    body: MoveTaskSchema,
    response: TaskSchema,
    errors: ['FORBIDDEN', 'VALIDATION_ERROR', 'NOT_FOUND'],
  },
} as const;
```

### 3.5 How end-to-end type safety is achieved

1. **Plain TypeScript interfaces** in the shared package define the shape of all domain objects.
2. **Zod schemas** in the server package define runtime validation for all request/response shapes, importing constants
   from `shared` (e.g., `z.enum(TenantRoleValues)`).
3. **API contracts** in the server package reference Zod schemas for request bodies and response shapes.
4. **Frontend** imports types from `shared` — API responses are typed without runtime validation (server validates).
5. **Backend** imports schemas from local `../schemas/` for request validation and returns typed results.
6. **`tsc --noEmit`** across the monorepo catches any type mismatch between frontend and backend.

### 3.6 Key enums and constants

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

## 4. Backend Architecture

### 4.1 Hono app bootstrap

```typescript
// server/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { tenantContextMiddleware } from './middleware/tenant-context';
import { rbacMiddleware } from './middleware/rbac';
import { validationMiddleware } from './middleware/validation';
import { authRoutes } from './routes/auth';
import { tenantRoutes } from './routes/tenants';
import { projectRoutes } from './routes/projects';
import { boardRoutes } from './routes/boards';
import { columnRoutes } from './routes/columns';
import { taskRoutes } from './routes/tasks';
import { sprintRoutes } from './routes/sprints';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', errorHandler);

// Auth routes (no tenant context required)
app.route('/api/v1/auth', authRoutes);

// Cross-tenant routes (auth required, no tenant context, no RBAC)
app.use('/api/v1/invitations/*', authMiddleware);
app.use('/api/v1/tasks/my', authMiddleware);
app.route('/api/v1/invitations', invitationRoutes); // GET /invitations/my, DELETE /invitations/:id
app.route('/api/v1/tasks', taskRoutes); // GET /tasks/my registered here (cross-tenant)

// All other routes require auth + tenant context + RBAC + validation
app.use('/api/v1/*', authMiddleware);
app.use('/api/v1/*', tenantContextMiddleware);
app.use('/api/v1/*', rbacMiddleware);
app.use('/api/v1/*', validationMiddleware);

// Tenant-scoped feature routes
app.route('/api/v1/tenants', tenantRoutes);
app.route('/api/v1/projects', projectRoutes);
app.route('/api/v1/boards', boardRoutes);
app.route('/api/v1/columns', columnRoutes);
app.route('/api/v1/tasks', taskRoutes); // tenant-scoped task routes (CRUD, move, assign)
app.route('/api/v1/sprints', sprintRoutes);

export default app;
```

### 4.2 Route organization by feature

Each feature has its own route file that defines all endpoints for that domain:

```
server/src/routes/
├── auth.ts            # POST /auth/register, POST /auth/login, GET /auth/me,
│                      # POST /auth/switch-tenant, POST /auth/accept-invitation,
│                      # GET /invitations/:token (public)
├── invitations.ts     # GET /invitations/my (cross-tenant), DELETE /invitations/:id (NEW v4.0.0)
├── tenants.ts         # CRUD for tenants; member invite/list/update/remove;
│                      # GET /:tenantId/invitations/pending (NEW v4.0.0)
├── projects.ts        # CRUD for projects and project members
├── boards.ts          # CRUD for boards
├── columns.ts         # CRUD for columns + reorder
├── tasks.ts           # CRUD for tasks + move + assign; GET /my (cross-tenant, NEW v4.0.0)
├── sprints.ts         # CRUD for sprints + add/remove tasks
└── index.ts           # Route aggregation (if needed for grouping)
```

Each route file is a Hono `Router` instance that is mounted by the main app. Routes are thin — they validate input (via
the validation middleware), call the service layer, and return typed responses.

### 4.3 Middleware pipeline

Every request (except auth routes) flows through this chain:

```
Request → ErrorHandler → AuthMiddleware → TenantContextMiddleware → RBACMiddleware → ValidationMiddleware → RouteHandler
```

| Middleware                  | Order      | Responsibility                                                                                                                                                                                                                                                        |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ErrorHandler**            | 1 (global) | Catches unhandled errors, returns standardized JSON error responses                                                                                                                                                                                                   |
| **AuthMiddleware**          | 2          | Verifies JWT from `Authorization: Bearer <token>` header; sets `c.get('userId')` and `c.get('user')`                                                                                                                                                                  |
| **TenantContextMiddleware** | 3          | Resolves active tenant from `X-Tenant-Id` header + user's `TenantMember` record with `status: 'active'`; rejects pending/declined/access_revoked members with 403; sets `c.get('tenantId')`. Skipped for auth routes and cross-tenant routes (invitations, tasks/my). |
| **RBACMiddleware**          | 4          | Checks user's role against required permission for the route. Uses `rbac.service`. Sets `c.get('userRole')`.                                                                                                                                                          |
| **ValidationMiddleware**    | 5          | Validates request body, query params, and path params against Zod v4 schemas from server's `src/schemas/`. Uses `z.interface().parse()` / `.safeParse()`. Returns 422 with structured validation errors on failure.                                                   |
| **RouteHandler**            | 6          | Delegates to the appropriate service method                                                                                                                                                                                                                           |

### 4.4 Service layer design

Each service is a **plain TypeScript class** with no framework dependency:

- **First parameter on every method is `tenantId`** — enforces tenant scoping at the service level.
- **Delegates persistence to the repository** — no direct MongoDB driver usage in services.
- **Enforces business rules** — e.g., only project admin can delete a board, only members can create tasks.
- **Enforces subscription limits** — project creation (max 3 for free), member addition (max 10 for free), workspace
  creation (max 1 free workspace per user).
- **Returns typed results** that map directly to shared package types.
- **Throws typed errors** that the error handler middleware converts to standardized HTTP responses.

**Service inventory:**

| Service          | Responsibility                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AuthService`    | Registration (user-only, no auto-tenant), login, JWT issuance, tenant switching, invitation acceptance                     |
| `TenantService`  | Tenant CRUD, member management (invite, list, update role, remove), subscription limit enforcement                         |
| `ProjectService` | Project CRUD, project member management, subscription limit enforcement (max 3 projects for free, max 10 members for free) |
| `BoardService`   | Board CRUD, column CRUD, column reordering                                                                                 |
| `TaskService`    | Task CRUD, status transitions (column move), assignment                                                                    |
| `SprintService`  | Sprint CRUD, add/remove tasks from sprint                                                                                  |
| `RBACService`    | Permission checking utility based on role + action matrix                                                                  |
| `EmailService`   | Sends invitation emails via Resend (`resend` npm package); console-logging adapter in development                          |

**Example — `task.service.ts`:**

```typescript
class TaskService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly rbac: RBACService,
  ) {}

  async moveTask(tenantId: string, userId: string, input: MoveTaskInput): Promise<Task> {
    // 1. Verify user has write access to the project
    const project = await this.projectRepo.findById(tenantId, input.projectId);
    if (!project) throw new NotFoundError('Project not found');
    const canWrite = await this.rbac.canWrite(userId, project.id, tenantId);
    if (!canWrite) throw new ForbiddenError('Insufficient permissions');

    // 2. Verify task belongs to the tenant
    const task = await this.taskRepo.findById(tenantId, input.taskId);
    if (!task) throw new NotFoundError('Task not found');

    // 3. Verify target column belongs to the same board
    const column = await this.taskRepo.findColumn(tenantId, input.targetColumnId);
    if (column.boardId !== task.boardId) throw new ValidationError('Column belongs to a different board');

    // 4. Update task
    return this.taskRepo.update(tenantId, input.taskId, {
      columnId: input.targetColumnId,
      sprintId: input.targetSprintId ?? null,
      position: 0, // default position; service calculates based on column
    });
  }
}
```

### 4.5 Repository / data access layer design

Each repository:

- Receives a `MongoCollection` reference from the MongoDB Node.js Driver v7.0.0 (injected via factory or constructor).
- Provides typed CRUD methods **scoped by `tenantId`** — every query includes `tenantId` in the filter.
- Handles MongoDB-specific concerns: `ObjectId` ↔ UUID conversion, projection, sorting.
- Returns **plain TypeScript objects** — no MongoDB driver types leak to services.
- Uses the driver's native async/await API — the v7 driver drops legacy callback APIs entirely; all operations return
  promises. Use `findOne()`, `insertOne()`, `updateOne()`, `deleteOne()`, `aggregate()` with `await` directly. The
  `Collection<T>` generic provides full type safety.
- Validates that referenced documents belong to the same tenant on write operations (prevents cross-tenant reference
  injection).

**Example — `task.repository.ts`:**

```typescript
class TaskRepository {
  constructor(private readonly collection: MongoCollection<TaskDocument>) {}

  async findById(tenantId: string, taskId: string): Promise<Task | null> {
    const result = await this.collection.findOne({
      tenantId,
      id: taskId,
    });
    return result ? this.toDomain(result) : null;
  }

  async findByBoardAndColumn(tenantId: string, boardId: string, columnId: string): Promise<Task[]> {
    return this.collection
      .find({ tenantId, boardId, columnId })
      .sort({ position: 1 })
      .toArray()
      .then((docs) => docs.map((d) => this.toDomain(d)));
  }

  async create(tenantId: string, input: CreateTaskInput): Promise<Task> {
    const doc: TaskDocument = {
      ...input,
      tenantId,
      id: uuidv4(),
      position: await this.getNextPosition(tenantId, input.columnId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.collection.insertOne(doc);
    return this.toDomain(doc);
  }

  private toDomain(doc: TaskDocument): Task {
    return {
      id: doc.id,
      tenantId: doc.tenantId,
      projectId: doc.projectId,
      boardId: doc.boardId,
      columnId: doc.columnId,
      sprintId: doc.sprintId,
      title: doc.title,
      description: doc.description,
      assigneeIds: doc.assigneeIds,
      priority: doc.priority,
      position: doc.position,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
```

### 4.6 Hono context type extensions

```typescript
// server/src/types/context.ts
import type { User } from '@task-board/shared';
import type { TenantRole, ProjectRole } from '@task-board/shared';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    user: User;
    tenantId: string; // set by TenantContextMiddleware (only on tenant-scoped routes)
    userRole: TenantRole | ProjectRole;
  }
}
```

This allows route handlers to access typed context variables via `c.get('userId')`, `c.get('tenantId')`, etc. Note that
`tenantId` is only set on routes that pass through `TenantContextMiddleware`. Auth routes and public routes (e.g.,
`/invitations/:token`) do not set it.

**`TenantMemberRepository` document shape (updated for v4.0.0):**

The `TenantMemberDocument` now supports nullable `userId` (for pending invitations), `status`, `invitedEmail`,
`invitationToken`, and `invitedAt`:

```typescript
interface TenantMemberDocument {
  _id?: ObjectId;
  userId: string | null; // null for unregistered invitees
  tenantId: string;
  role: string; // 'owner' | 'admin' | 'member'
  status: string; // 'active' | 'pending' | 'declined' | 'access_revoked'
  invitedEmail: string | null; // set for pending invitations
  invitationToken: string | null; // unique token for accepting invitation
  invitedAt: Date | null; // when the invitation was sent
  createdAt: Date;
}
```

**Dashboard data — `GET /tenants` response (v4.0.0):**

The `GET /tenants` response now includes a `role` field per tenant, derived from the `tenant_members` join. This enables
the frontend dashboard to detect the user's role per workspace without an additional API call:

```typescript
// Extended tenant response for dashboard
interface TenantWithRole extends Tenant {
  role: TenantRole; // from tenant_members join
}
```

---

## 5. Frontend Architecture

### 5.1 Application shell

The Angular 22+ application is a **standalone-based SPA** with no NgModules. Change detection is **zoneless** (no
`zone.js`); all reactivity flows through Angular Signals. The root component bootstraps the app with providers for auth,
tenant context, HTTP interceptors, and routing.

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

### 5.2 Standalone component structure

All components are standalone — no NgModules. Components declare their own imports, outputs, and providers. Feature
groups are organized as standalone component trees:

```
ui/src/app/
├── app.component.ts              # Root component, renders <app-shell>
├── app.routes.ts                 # Standalone router config with guards
├── app.config.ts                 # Providers and bootstrap config
├── shell/
│   ├── app-shell.component.ts    # Root layout: sidebar + header + <router-outlet>
│   ├── sidebar.component.ts      # Navigation, tenant switcher, project list
│   └── header.component.ts       # User menu, tenant indicator, notifications
├── auth/
│   ├── login.component.ts
│   ├── register.component.ts
│   ├── accept-invitation.component.ts  # Public invitation acceptance page
│   └── auth.guard.ts
├── tenants/
│   ├── tenant-list.component.ts
│   ├── tenant-detail.component.ts
│   ├── tenant-settings/          # NEW (Phase 9) — tenant settings page
│   │   └── tenant-settings.ts
│   └── tenant-member-list/       # NEW (Phase 9) — tenant member list
│       └── tenant-member-list.ts
├── projects/
│   ├── project-list.component.ts
│   ├── project-detail.component.ts
│   └── project-member-list.component.ts
├── boards/
│   ├── board-view.component.ts   # Kanban board with columns
│   ├── column.component.ts       # Single column with task cards
│   └── task-card.component.ts    # Task summary card
├── tasks/
│   ├── task-detail.component.ts
│   ├── task-form.component.ts
│   └── task-list.component.ts
├── sprints/
│   ├── sprint-list.component.ts
│   ├── sprint-detail.component.ts
│   └── sprint-backlog.component.ts
├── dashboard/                    # NEW (Phase 11) — adaptive dashboard
│   ├── dashboard.ts              # Main orchestrator (state detection via signals)
│   ├── dashboard.html            # @switch on dashboardState
│   ├── visitor/
│   │   └── landing-page.ts       # State 0: static marketing page
│   ├── new-user/
│   │   └── welcome-view.ts       # State 1: create workspace CTA
│   ├── pending-invitations/
│   │   └── invitation-view.ts    # State 2: invitation cards
│   ├── member/
│   │   └── member-dashboard.ts   # State 3: workspaces + tasks
│   └── owner/
│       └── owner-dashboard.ts    # State 4: full dashboard + sent invitations
├── shared/
│   ├── ui-button.component.ts
│   ├── ui-modal.component.ts
│   └── ui-spinner.component.ts
├── services/                     # Angular services for API communication
│   ├── auth.service.ts
│   ├── tenant.service.ts
│   ├── project.service.ts
│   ├── board.service.ts
│   ├── task.service.ts
│   └── sprint.service.ts
├── stores/                       # Signal-based state stores (plain services)
│   ├── auth.store.ts
│   ├── tenant.store.ts
│   ├── project.store.ts
│   ├── board.store.ts
│   └── task.store.ts
├── interceptors/                 # Functional HTTP interceptors
│   ├── auth.interceptor.ts
│   ├── tenant.interceptor.ts
│   └── error.interceptor.ts
├── guards/                       # Functional route guards (CanActivateFn)
│   ├── auth.guard.ts
│   ├── tenant.guard.ts
│   └── project.guard.ts
└── resolvers/                    # Functional route resolvers (resource-based)
    └── project.resolver.ts
```

### 5.3 Routing structure

```
/app
  /                                    # NO guard — Dashboard handles all states internally
    (DashboardComponent)
  /workspace/create                    # authGuard only (no tenant required)
  /auth
    /login
    /register
    /accept-invitation                 # Public page — invitation acceptance (no auth guard)
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
      /settings                        # TenantSettings (NEW — Phase 9)
        /members                       # TenantMemberList (NEW — Phase 9)
```

**Guards (functional — `CanActivateFn`):**

| Guard          | Protects                                   | Logic                                                                                        |
| -------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `authGuard`    | `/workspace/create`, `/tenants/*`          | Redirects to `/auth/login` if no authenticated user                                          |
| `tenantGuard`  | `/tenants/:tenantId/*`                     | Ensures user is an **active** member of the tenant; rejects declined/access_revoked with 403 |
| `projectGuard` | `/tenants/:tenantId/projects/:projectId/*` | Ensures user has a project role; redirects if not                                            |

**Key routing change (v4.0.0):** The root route (`/`) **removes** `authGuard`. The
[`Dashboard`](ui/src/app/features/dashboard/dashboard.ts) component internally handles all five states (visitor →
new-user → pending-invitations → member → owner). Authenticated data loading only happens when `isAuthenticated()` is
true. See [§12](#12-dashboard-architecture-phase-11) for details.

All guards are standalone functions using `inject()` — no class-based guards.

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

**Resolver (functional — uses `resource()`):**

| Resolver          | Route                  | Logic                                                                                            |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `projectResolver` | `/projects/:projectId` | Fetches project data via `resource()` before activating the route; 404 if not found or no access |

```typescript
// Functional resolver example
export const projectResolver: ResolveFn<Project | null> = (route) => {
  const projectStore = inject(ProjectStore);
  const projectId = route.paramMap.get('projectId');
  return projectStore.loadProject(projectId!);
};
```

### 5.4 State management (signal-based)

All state is signal-based. Stores are plain Angular services using `signal()`, `computed()`, `linkedSignal()`, and
`resource()` — no external state management library.

| Concern         | Mechanism                              | Key APIs                                                                                                                                                                     |
| --------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth state      | `inject(AuthStore)` — signal store     | `currentUser = signal<User \| null>(null)`, `token = signal<string \| null>(null)` — guard checks `currentUser()` first, then validates `token` via `fetchCurrentUser()`     |
| Tenant context  | `inject(TenantService)` — signal store | `activeTenant = linkedSignal(() => this.tenants()[0] ?? null)`, `tenants = resource({ loader: () => this.fetchTenants() })` — may be `null` for new users with no workspaces |
| Project data    | `inject(ProjectStore)` — signal store  | `projects = resource({ loader: () => this.fetchProjects() })`, `currentProject = linkedSignal(() => this.projects()[0])`                                                     |
| Board/Task data | `inject(BoardStore)` — signal store    | `board = resource({ params: () => ({ id: this.boardId() }), loader: ({ params }) => this.fetchBoard(params.id) })`                                                           |
| UI state        | Component-level signals                | `showSidebar = signal(true)`, `selectedFilter = linkedSignal(() => FILTER_OPTIONS[0])`                                                                                       |

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

**`httpResource()` pattern** — for simple typed HTTP GET resources with signal integration:

```typescript
// Example: fetch a single project by ID
projectResource = httpResource(() => `/api/v1/projects/${this.projectId()}`, {
  defaultValue: null as Project | null,
});
```

### 5.5 Service layer for API communication

Each Angular service wraps `HttpClient` calls and returns typed observables derived from shared package types. Services
are injectable and singleton (provided at root level) using `inject()` for dependency injection.

**Example — `task.service.ts`:**

```typescript
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantService);

  listTasks(params: TaskListParams): Observable<PaginatedResponse<Task>> {
    return this.http.get<PaginatedResponse<Task>>('/api/v1/tasks', {
      params,
      headers: { 'X-Tenant-Id': this.tenant.activeTenant()!.id },
    });
  }

  createTask(input: CreateTaskInput): Observable<Task> {
    return this.http.post<Task>('/api/v1/tasks', input, {
      headers: { 'X-Tenant-Id': this.tenant.activeTenant()!.id },
    });
  }

  moveTask(taskId: string, input: MoveTaskInput): Observable<Task> {
    return this.http.patch<Task>(`/api/v1/tasks/${taskId}/move`, input, {
      headers: { 'X-Tenant-Id': this.tenant.activeTenant()!.id },
    });
  }
}
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

### 5.6 Tenant context in the UI

The tenant context is managed by `TenantService` and flows through the system:

1. **On login**, the JWT is decoded. If `tenantId` is `null` (new user with no workspaces), the frontend redirects to a
   workspace creation or invitation acceptance screen. No `X-Tenant-Id` header is sent.
2. **If the user has tenants**, `TenantService` fetches the user's `TenantMember` records (active memberships only).
3. **User selects an active tenant** via the `<app-tenant-switcher>` dropdown in the header.
4. **`TenantService.setActiveTenant(tenantId)`** updates the `activeTenant` signal.
5. **HTTP interceptor** reads `activeTenant` from `TenantService` and attaches `X-Tenant-Id` header to every outgoing
   request. If `activeTenant` is `null`, the header is omitted (user can only access tenant-independent endpoints).
6. **Route guards** (`TenantGuard`, `ProjectGuard`) check the active tenant against the user's memberships.
7. **UI conditionally renders** based on the active tenant and the user's roles (e.g., admin-only actions are hidden for
   `member` role).

### 5.7 UI library and styling

- **Spartan UI** (`@spartan-ng/brain` + `@spartan-ng/helm` v0.12.0) for headless primitives and styled components.
- **Tailwind CSS v4.1.0** — CSS-first configuration; no `tailwind.config.js`.
- **Angular Signals** for reactive state; `@if`, `@for`, `@switch`, `@defer` for control flow.
- **Signal Forms** (`@angular/forms` signal-based API) for form state management in task create/edit forms.

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

---

## 6. Database Design

### 6.1 MongoDB collections

| Collection        | Document type | Tenant isolation key                  |
| ----------------- | ------------- | ------------------------------------- |
| `tenants`         | Tenant        | `_id` (tenant is the root entity)     |
| `users`           | User          | N/A (global, linked via TenantMember) |
| `tenant_members`  | TenantMember  | `tenantId`                            |
| `projects`        | Project       | `tenantId`                            |
| `project_members` | ProjectMember | `tenantId` (denormalized)             |
| `boards`          | Board         | `tenantId`                            |
| `columns`         | Column        | `tenantId` (denormalized)             |
| `tasks`           | Task          | `tenantId`                            |
| `sprints`         | Sprint        | `tenantId`                            |

### 6.2 Indexes per collection

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
- `{ invitedEmail: 1, status: 1 }` — for efficient `GET /invitations/my` cross-tenant query (NEW v4.0.0)

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
- `{ tenantId: 1, assigneeIds: 1, updatedAt: -1 }` — for efficient `GET /tasks/my` cross-tenant query (NEW v4.0.0)
- `{ tenantId: 1 }`

**sprints**

- `{ tenantId: 1, projectId: 1 }`
- `{ tenantId: 1 }`

### 6.3 Document shapes

All documents include `tenantId` for tenant isolation. UUIDs are stored as strings (not ObjectIds) for cross-system
compatibility. MongoDB's `_id` is the ObjectId primary key; the public `id` field is a UUID v4 string.

**Tenant document:**

```json
{
  "_id": "ObjectId(...)",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "subscription": "free",
  "createdAt": "2026-07-28T08:00:00Z",
  "updatedAt": "2026-07-28T08:00:00Z"
}
```

**TenantMember document (pending invitation):**

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

**Project document:**

```json
{
  "_id": "ObjectId(...)",
  "id": "550e8400-e29b-41d4-a716-446655440002",
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

**Sprint document:**

```json
{
  "_id": "ObjectId(...)",
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "projectId": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Sprint 1",
  "startDate": "2026-08-01T00:00:00Z",
  "endDate": "2026-08-14T23:59:59Z",
  "goal": "Complete login and board views",
  "status": "planned",
  "taskIds": [],
  "createdAt": "2026-07-28T08:00:00Z",
  "updatedAt": "2026-07-28T08:00:00Z"
}
```

### 6.4 Tenant isolation enforcement

- **Application layer:** Every service method receives `tenantId` from the request context and filters all queries by
  it.
- **Database layer:** All queries include `tenantId` in the filter object. No collection scan without `tenantId`.
- **No cross-tenant references:** Foreign keys (e.g., `projectId` on a task) are always scoped within the same tenant.
  The application validates this on write operations.
- **Indexes are tenant-aware:** Every collection has indexes that include `tenantId` as the leading or co-leading field,
  ensuring queries are tenant-scoped index scans.

---

## 7. Auth & Tenant Context

### 7.1 Authentication (MVP — email/password + JWT)

For the MVP, authentication is email/password with JWT. No OAuth, SSO, or refresh token strategy.

**Registration flow (v3.0.0 — no auto-tenant):**

1. `POST /auth/register` creates a user with hashed password (bcrypt).
2. **No tenant is auto-created.** The user starts with zero tenants.
3. JWT is issued with `tenantId: null`, `tenantRole: null`.
4. The frontend redirects to a workspace creation or invitation acceptance screen.

**Login flow:**

1. `POST /auth/login` verifies credentials and looks up active `TenantMember` records.
2. If the user has active memberships, JWT includes the first tenant's context.
3. If the user has no tenants, JWT is issued with `tenantId: null`.

**JWT payload (with tenant context):**

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

**JWT payload (without tenant context — new user with no workspaces):**

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

4. **Token expiry:** 24 hours (access token only). Refresh token strategy is out of scope for MVP.
5. **Signing:** HS256 with a secret stored in `JWT_SECRET` environment variable.
6. **Multi-tenant switching:** `POST /auth/switch-tenant` returns a new JWT with updated `tenantId` and `tenantRole`.
7. **Invitation acceptance:** `POST /auth/accept-invitation` accepts a pending invitation by token, activates the
   membership, and returns a new JWT with the tenant context.

### 7.2 Tenant context resolution

The tenant context is the bridge between authentication and data access:

**Frontend:**

1. After login, the `AuthService` stores the JWT and decodes the `tenantId` from it.
2. `TenantService` fetches the user's `TenantMember` records to know which tenants they belong to.
3. The user selects an active tenant via the tenant switcher in the header.
4. The active `tenantId` is stored in `TenantService` and attached to every API request via the `X-Tenant-Id` header.

**Backend:**

1. `TenantContextMiddleware` reads the `X-Tenant-Id` header.
2. It looks up the `TenantMember` record for the authenticated user (`userId` from JWT) and the specified `tenantId`.
3. **The middleware checks `status === 'active'`** — pending, declined, and `access_revoked` members are rejected
   with 403.
4. If the user is an active member, the middleware sets `c.get('tenantId')` on the Hono context.
5. If the user is not an active member, the request is rejected with 403.
6. For auth routes (`/auth/register`, `/auth/login`, `/auth/accept-invitation`, `/invitations/:token`), tenant context
   is not required. Users with `tenantId: null` in their JWT can only access tenant-independent endpoints.

### 7.3 RBAC enforcement

RBAC is enforced at two layers:

1. **Backend middleware:** `RBACMiddleware` checks the user's role (from JWT `tenantRole` claim) against the required
   permission for the route. The `RBACService` provides the `can()` method that evaluates permissions based on the
   permission matrix in the technical specification.
2. **Frontend UI:** Components conditionally render actions based on the user's role (e.g., delete buttons are hidden
   for `viewer` role, admin-only menus are hidden for `member` role). This is a UX convenience — the backend is the
   source of truth for authorization.

### 7.4 Permission resolution rules (from spec)

1. **Tenant context is mandatory** — every request must carry an active tenant. The tenant context is derived from the
   user's `TenantMember` record with `status: 'active'`.
2. **Project access is a subset of tenant access** — a user must first be an active tenant member, then be granted a
   project role via `ProjectMember`.
3. **Viewer cannot write** — project viewers can read but cannot create, update, or delete any entity.
4. **Ownership overrides** — tenant owners bypass all project-level restrictions.
5. **Tenant isolation is enforced at the data layer** — every query filters by `tenantId`.
6. **Inactive members are excluded** — members with `status: 'pending'`, `status: 'declined'`, or
   `status: 'access_revoked'` cannot access any tenant resource. The `TenantContextMiddleware` must check
   `status === 'active'` when resolving tenant membership. Owner/admin can later resend invitation (`→ 'pending'`) or
   hard-delete permanently.
7. **Subscription limits are enforced on write** — project creation and member addition are blocked when the tenant's
   subscription tier limit is reached (see §14 of the technical specification).

---

## 8. Deployment Architecture

### 8.1 Cloudflare Pages + Workers

```
User Browser
    │
    ▼
Cloudflare DNS (task-board.com)
    │
    ├──► Cloudflare Pages (static assets)
    │     ├── Angular SPA build output (index.html, JS bundles, CSS)
    │     └── SPA fallback: all non-API routes → index.html
    │
    └──► Cloudflare Workers (Hono API)
          ├── /api/v1/auth/*
          ├── /api/v1/tenants/*
          ├── /api/v1/projects/*
          ├── /api/v1/boards/*
          ├── /api/v1/columns/*
          ├── /api/v1/tasks/*
          └── /api/v1/sprints/*
```

- **Cloudflare Pages** serves the Angular SPA as static assets. The SPA handles client-side routing; any unknown path
  falls back to `index.html`.
- **Cloudflare Workers** runs the Hono application at the edge. API routes are prefixed with `/api/v1/`.
- Both are deployed from the same repository via GitHub Actions.

### 8.2 MongoDB Atlas connection

```
Cloudflare Worker (Hono)
    │
    │  MongoDB connection string (MONGODB_URI)
    │  Stored in Cloudflare Workers secrets / environment variables
    │
    ▼
MongoDB Atlas (M0/M2/M5 cluster for MVP)
    ├── Database: taskboard
    ├── Collections: tenants, users, tenant_members, projects,
    │                 project_members, boards, columns, tasks, sprints
    └── Network access: IP whitelist for Cloudflare Workers outbound IPs
```

- **Connection string** is stored as a Cloudflare Workers secret (`MONGODB_URI`), not in source code.
- **MongoDB Atlas** is the only data store. No relational database.
- **Index strategy** ensures all queries are tenant-scoped index scans (see Section 6.2).
- **Connection pooling** is handled by the MongoDB Node.js Driver v7.0.0 (used by Hono on Workers).

### 8.3 Environment configuration

| Variable         | Description                                                                  | Required   |
| ---------------- | ---------------------------------------------------------------------------- | ---------- |
| `MONGODB_URI`    | MongoDB Atlas connection string                                              | Yes        |
| `JWT_SECRET`     | Secret key for HS256 JWT signing                                             | Yes        |
| `NODE_ENV`       | `development` or `production`                                                | Yes        |
| `CORS_ORIGIN`    | Allowed origin for CORS (frontend URL)                                       | Yes        |
| `PORT`           | Local dev port (default: 8787)                                               | No         |
| `RESEND_API_KEY` | Resend API key for sending invitation emails                                 | Yes (prod) |
| `FRONTEND_URL`   | Frontend base URL for invitation links (e.g. `https://task-board.pages.dev`) | Yes        |

### 8.4 CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (conceptual)
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }

      - run: npm install
      - run: npm run build --workspace=shared
      - run: npm run build --workspace=server
      - run: npm run build --workspace=ui

      - run: npm run test --workspace=server
      - run: npm run lint --workspace=server

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: cloudflare/wrangler-action@v3
        with:
          command: pages deploy ui/dist --project-name=task-board
      - uses: cloudflare/wrangler-action@v3
        with:
          command: deploy server/src/index.ts --name=task-board-api
```

### 8.5 Local development

- **Backend:** `wrangler dev` starts a local Hono dev server with hot reload.
- **Frontend:** `ng serve` (or `npm start` in the `ui/` workspace) starts the Angular dev server.
- **Database:** MongoDB Atlas free tier (M0) is used for all environments; no local MongoDB needed.
- **Shared package:** Built first, then linked via npm workspaces.

---

## 9. Key Design Decisions

### 9.1 Why Hono 4.8.0 on Cloudflare Workers?

- **Edge-native:** Hono is designed for edge runtimes and has first-class Cloudflare Workers support. This aligns with
  the cloud-native deployment target.
- **Lightweight:** Hono has a minimal footprint (~10KB gzipped), which is ideal for edge execution with cold start
  constraints.
- **TypeScript-first:** The entire backend is TypeScript 6.0.0, matching the rest of the stack and enabling end-to-end
  type safety with the shared package.
- **RPC client:** Hono 4.8.0 includes an RPC client for type-safe frontend→backend calls. However, the explicit
  shared-package contract approach is used as the primary pattern (simpler for educational purposes).
- **Simple routing:** Hono's routing API is concise and intuitive, keeping the backend code easy to read and maintain.
- **No framework overhead:** Unlike Express or NestJS, Hono doesn't impose a heavy abstraction layer. Services and
  repositories are plain TypeScript classes, making them easy to test and reason about.

### 9.2 Why standalone Angular components (no NgModules)?

- **Modern Angular (22+):** Standalone components are the recommended approach for new Angular applications. They reduce
  boilerplate and simplify the component model.
- **Zoneless change detection:** Combined with signals, zoneless change detection eliminates the zone.js overhead and
  provides more predictable reactivity.
- **Smaller bundle:** No NgModule metadata means smaller bundle size, which matters for edge-deployed SPAs.
- **Simpler DI:** `inject()` replaces constructor-based module injection, making dependencies more explicit and
  testable.
- **Aligns with project description:** The project description explicitly specifies standalone components, zoneless,
  signals, and signal forms.

### 9.3 How tenant isolation works

Tenant isolation is enforced at **three layers**:

1. **Data layer:** Every MongoDB document carries `tenantId`. Every query includes `tenantId` in the filter. Every index
   is designed to support tenant-scoped queries. No collection scan without `tenantId`.
2. **Application layer:** Every service method receives `tenantId` as its first parameter. The repository layer always
   filters by `tenantId`. On write operations, the service validates that referenced documents (e.g., `projectId` on a
   task) belong to the same tenant.
3. **API layer:** The `TenantContextMiddleware` validates that the authenticated user is an **active** member of the
   tenant specified in the `X-Tenant-Id` header (checks `status: 'active'`). Pending or declined members are rejected
   with 403.

This three-layer defense ensures that even if one layer is bypassed, the other layers still prevent cross-tenant data
leakage.

### 9.4 Why a shared package for types and constants?

- **Single source of truth:** Types and constants are defined once in `shared/` and consumed by both frontend and
  backend. This eliminates type drift between client and server. The shared package has zero runtime dependencies.
- **End-to-end type safety:** Plain TypeScript interfaces define domain shapes. The server package adds Zod schemas for
  runtime validation, importing constants from shared (e.g., `z.enum(TenantRoleValues)`).
- **Contract-first API design:** API contracts in the server package define the exact shape of every request and
  response, making it impossible for the frontend and backend to disagree on the API surface.
- **Separation of concerns:** Runtime validation (Zod) lives only in the server package. The shared package remains
  lightweight and dependency-free, ideal for the frontend bundle.
- **Educational value:** This pattern demonstrates how to achieve strong type safety across a full-stack TypeScript
  application, which is a key architectural principle of the project.

### 9.5 Why MongoDB over a relational database?

- **Schema flexibility:** Task boards, columns, and sprints have evolving structures. MongoDB's document model
  accommodates schema changes without migrations.
- **Tenant isolation is natural:** Every document carries `tenantId`, and MongoDB's query model makes it easy to filter
  by tenant.
- **Embedded documents:** Some relationships (e.g., `assigneeIds` on a task) are naturally embedded arrays rather than
  requiring joins.
- **Cloud-native:** MongoDB Atlas integrates seamlessly with Cloudflare Workers and is a managed service that requires
  no operational overhead for MVP.
- **Trade-off:** No joins or transactions for complex relational queries. This is acceptable for the MVP scope where
  relationships are simple and denormalization is used where needed (e.g., `tenantId` denormalized on `columns`,
  `project_members`).

### 9.6 Why JWT with tenant role in the payload?

- **Stateless auth:** JWTs allow the backend to verify authentication without a session store, which is ideal for edge
  deployment on Cloudflare Workers.
- **Tenant context in the token:** Including `tenantId` and `tenantRole` in the JWT payload means the tenant context
  middleware can resolve the tenant without an additional database lookup for the tenant membership check.
- **Nullable tenantId:** New users with no workspaces receive a JWT with `tenantId: null`. This allows the frontend to
  handle the "no workspace" state without a separate auth flow.
- **Trade-off:** JWTs are not easily revoked. For MVP with 24-hour expiry, this is acceptable. A refresh token strategy
  would be needed for production.

### 9.9 Why Resend for email delivery?

- **Simplicity:** Resend provides a straightforward REST API with a clean `resend` npm package. No SMTP configuration
  needed.
- **Free tier:** 3,000 emails/month, 100/day — sufficient for an MVP with invitation-based growth.
- **Edge-compatible:** REST API calls work from Cloudflare Workers without special configuration.
- **Console fallback:** In development, invitation links are logged to the console. No API key required for local dev.

### 9.10 Why subscription tiers as a simple field?

- **No billing complexity:** For MVP, subscription tiers are modeled as a `subscription` field on the `Tenant` document
  (`'free'` | `'premium'`). A mock payment page handles upgrades. No real payment gateway integration.
- **Service-layer enforcement:** Subscription limits (1 free workspace, 3 projects/workspace, 10 users/project) are
  enforced in the service layer, not the database. This keeps the data model simple while allowing limits to be changed
  without schema migrations.
- **Upgrade path:** The `PATCH /tenants/:tenantId` endpoint already supports updating the `subscription` field. Real
  billing can be added later by integrating Stripe webhooks that call the same endpoint.

### 9.7 Why feature-oriented modules over layered architecture?

- **Vertical slices:** Each feature (auth, tenants, projects, boards, tasks, sprints) is self-contained with its own
  routes, services, repositories, and (on the frontend) components, services, and guards. This makes it easy to
  understand, test, and extend a single feature without touching unrelated code.
- **Aligns with the vertical slice plan:** The technical specification's vertical slice plan (Section 10) is organized
  by feature, not by layer. Feature-oriented organization matches this delivery strategy.
- **Simpler onboarding:** A new developer can understand the auth feature by looking at the auth files in each package,
  without needing to understand the entire codebase.

### 9.8 Why no real-time (WebSocket) in MVP?

- **Simplicity:** HTTP request/response is the simplest communication pattern and is sufficient for the MVP scope.
- **Edge compatibility:** Cloudflare Workers support HTTP natively but WebSocket support is more limited and adds
  complexity.
- **Scope discipline:** The technical specification explicitly excludes real-time features from the MVP. Adding
  WebSocket later is an extension point (see Section 10).

---

## 10. Extension Points

### 10.1 Where future features would plug in

| Future Feature                                | Where It Plugs In                                                                                                 | What Changes                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real Billing / Subscriptions**              | `server/src/routes/billing.ts`, `server/src/schemas/billing.ts`, `server/src/contracts/billing.contracts.ts`      | Replace mock payment page with real Stripe integration. New `billing.service.ts`, `billing.repository.ts`. New `subscriptions` collection. Stripe webhook handler.                    |
| **SSO / OAuth / SAML**                        | `server/src/middleware/auth.ts` (extend auth middleware), `server/src/schemas/auth.ts` (add SSO provider schemas) | Replace or augment JWT auth with OAuth flow. New `auth_providers` and `sso_sessions` collections. New `SSOProviderService`.                                                           |
| **Advanced Analytics / Reporting**            | `server/src/routes/analytics.ts`, `server/src/schemas/analytics.ts`                                               | New route file, new schemas, new contracts. New `analytics.service.ts` that reads from existing collections and aggregates data. New `analytics` collection for pre-computed reports. |
| **Time Tracking**                             | `server/src/routes/time-tracking.ts`, `server/src/schemas/time-tracking.ts`                                       | New route file, new schemas, new contracts. New `time_entries` MongoDB collection. New `time-tracking.service.ts`.                                                                    |
| **Task Comments / Activity Logs**             | `server/src/routes/comments.ts`, `server/src/routes/activity.ts`, `server/src/schemas/comment.ts`                 | New route files, new schemas, new contracts. New `comments` and `activity_logs` collections.                                                                                          |
| **External Integrations (Jira, Slack)**       | `server/src/routes/integrations.ts`, `server/src/schemas/integration.ts`                                          | New route file, new schemas, new contracts. New `integrations` collection for storing webhook configs and OAuth tokens. New `integration.service.ts`.                                 |
| **Real-time Updates (WebSocket)**             | `server/src/middleware/websocket.ts`, `ui/src/services/realtime.service.ts`                                       | Add WebSocket support to Hono Workers. New `realtime.service.ts` on the frontend. New `subscriptions` collection for tracking active subscriptions.                                   |
| **Advanced RBAC (custom roles, permissions)** | `server/src/schemas/rbac.ts` (extend role/permission schemas), `server/src/services/rbac.service.ts`              | Extend `TenantRole` and `ProjectRole` enums to support custom roles. New `permissions` collection for role-permission mapping. New `permission.service.ts`.                           |
| **Multi-region / Multi-tenant DB**            | `server/src/db/mongo.ts` (connection routing), new `tenant_settings` collection                                   | Add `region` field to `Tenant` document. Route database connections based on tenant region. New `tenant_settings` collection for per-tenant DB configuration.                         |

### 10.2 Design principles that enable extensions

1. **Feature-oriented boundaries** — each new feature adds a new set of files in its own directory, without modifying
   existing feature code.
2. **Server package as contract layer** — new features define their schemas and contracts in `server/src/schemas/` and
   `server/src/contracts/`, ensuring the frontend and backend stay in sync.
3. **Middleware pipeline is extensible** — new middleware (e.g., `websocketMiddleware`, `billingMiddleware`) can be
   added to the pipeline without changing existing middleware.
4. **Repository pattern** — new data models add new repository files without changing existing repositories.
5. **Service layer is plain TypeScript** — services have no framework dependency, making them easy to test, mock, and
   extend.
6. **Tenant isolation is universal** — every new collection and every new service method follows the `tenantId` scoping
   pattern, so new features automatically inherit tenant isolation.

---

## 11. UI Architecture — Member Management & Tenant Settings

> **Reference:** [Technical Specification §12](technical_specification.md:1120) — Missing UI Features

This section defines the architectural decisions for three UI feature areas that have working backend endpoints but no
Angular frontend implementation: tenant member management, tenant settings, and project member management.

### 11.1 Blocking backend fix — missing `GET /tenants/:tenantId/members`

The route file [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:94) is missing the `GET /:tenantId/members`
endpoint. The service method [`TenantService.getTenantMembers()`](server/src/services/tenant.service.ts:205) and the
shared contract [`tenantContracts.listMembers`](server/src/contracts/tenant.contracts.ts:74) already exist.

**Required change:** Add the following route to [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:94):

```typescript
/**
 * GET /:tenantId/members — List all members of a tenant.
 * Any tenant member can view the list.
 */
router.get('/:tenantId/members', async (c) => {
  const tenantId = c.req.param('tenantId');
  const service = createTenantService();
  const members = await service.getTenantMembers(tenantId);

  return c.json({
    data: members,
    total: members.length,
  });
});
```

This route must be registered **before** the `POST /:tenantId/members` route to avoid path parameter collision
(`members` being parsed as a `:tenantId` value).

---

### 11.2 Route tree updates

Two new routes are added as children of the existing `tenants/:tenantId` route in
[`app.routes.ts`](ui/src/app/app.routes.ts:26). Both render inside the
[`AppShell`](ui/src/app/shell/app-shell/app-shell.ts) outlet.

```
/tenants/:tenantId
  /projects                          ← ProjectList (existing)
  /projects/:projectId               ← ProjectDetail (existing, enhanced)
    /boards/:boardId                 ← BoardView (existing)
    /tasks/:taskId                   ← TaskDetail (existing)
    /sprints                         ← SprintList (existing)
    /sprints/:sprintId               ← SprintDetail (existing)
  /settings                          ← TenantSettings (NEW)
    /members                         ← TenantMemberList (NEW)
```

**Route definitions to add** (inside the `children` array of the `tenants/:tenantId` route):

```typescript
{
  path: 'settings',
  loadComponent: () =>
    import('./features/tenants/tenant-settings/tenant-settings')
      .then((m) => m.TenantSettings),
},
{
  path: 'settings/members',
  loadComponent: () =>
    import('./features/tenants/tenant-member-list/tenant-member-list')
      .then((m) => m.TenantMemberList),
},
```

Both routes are protected by the existing [`authGuard`](ui/src/app/guards/auth.guard.ts) and
[`tenantGuard`](ui/src/app/guards/tenant.guard.ts) applied to the parent route. No additional guards are needed — RBAC
enforcement is handled inside the components via computed signals that read the user's tenant role from
[`AuthStore`](ui/src/app/stores/auth-store.ts).

---

### 11.3 Component hierarchy

```
AppShell (existing)
├── Header (existing, unchanged)
│   └── TenantSwitcher (existing, unchanged)
├── Sidebar (existing, enhanced — adds "Settings" link)
│   └── routerLink to /tenants/:tenantId/settings
└── <router-outlet>
    ├── TenantSettings (NEW)
    │   ├── Edit form: name + slug inputs
    │   ├── Save button (owner/admin only)
    │   ├── Danger Zone section (owner only)
    │   │   └── Delete Tenant → confirmation dialog
    │   └── Link to "Manage Members" → /settings/members
    │
    ├── TenantMemberList (NEW)
    │   ├── Member table rows (avatar + userId/email + role + status badge)
    │   ├── Invite Member button (owner/admin) → Invite dialog
    │   │   └── Invite Dialog (email input + role select)
    │   ├── Inline role change (NativeSelect, owner/admin)
    │   ├── Remove button (owner/admin) → confirmation dialog
    │   ├── Pending/declined status badges on member rows
    │   └── Read-only view for tenant members
    │
    └── ProjectDetail (existing, enhanced)
        ├── Project info section (existing, unchanged)
        ├── Boards section (existing, unchanged)
        └── Members section (enhanced)
            ├── Member rows with inline role editor (project admin)
            ├── Add Member button (project admin) → Add dialog
            │   └── Add Dialog (user picker from tenant members + role select)
            └── Remove button (project admin) → confirmation dialog
```

#### Component file locations

| Component                  | Selector                | File path                                                                                                                                      |
| -------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `TenantSettings`           | `ui-tenant-settings`    | [`ui/src/app/features/tenants/tenant-settings/tenant-settings.ts`](ui/src/app/features/tenants/tenant-settings/tenant-settings.ts)             |
| `TenantMemberList`         | `ui-tenant-member-list` | [`ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts`](ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts) |
| `ProjectDetail` (modified) | `ui-project-detail`     | [`ui/src/app/features/projects/project-detail/project-detail.ts`](ui/src/app/features/projects/project-detail/project-detail.ts:38)            |
| `Sidebar` (modified)       | `ui-sidebar`            | [`ui/src/app/shell/sidebar/sidebar.ts`](ui/src/app/shell/sidebar/sidebar.ts:10)                                                                |

---

### 11.4 Service layer extensions

#### 11.4.1 `TenantClient` — new methods

Extend [`TenantClient`](ui/src/app/services/tenant-client.ts:13) with the following methods. All types (`TenantMember`,
`TenantRole`, `UpdateTenant`, `Tenant`) are already defined in the shared package.

```typescript
// Add to TenantClient:

/** List members of a tenant */
listMembers(tenantId: string): Observable<{ data: TenantMember[] }> {
  return this.http.get<{ data: TenantMember[] }>(
    `${this.apiBaseUrl}/tenants/${tenantId}/members`,
  );
}

/** Invite a member by email with a role */
inviteMember(tenantId: string, email: string, role: TenantRole): Observable<TenantMember> {
  return this.http.post<TenantMember>(
    `${this.apiBaseUrl}/tenants/${tenantId}/members`,
    { email, role },
  );
}

/** Update a member's role */
updateMemberRole(tenantId: string, userId: string, role: TenantRole): Observable<TenantMember> {
  return this.http.patch<TenantMember>(
    `${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`,
    { role },
  );
}

/** Remove a member from the tenant */
removeMember(tenantId: string, userId: string): Observable<void> {
  return this.http.delete<null>(
    `${this.apiBaseUrl}/tenants/${tenantId}/members/${userId}`,
  ) as unknown as Observable<void>;
}

/** Update tenant name/slug */
updateTenant(tenantId: string, data: UpdateTenant): Observable<Tenant> {
  return this.http.patch<Tenant>(
    `${this.apiBaseUrl}/tenants/${tenantId}`,
    data,
  );
}

/** Delete a tenant */
deleteTenant(tenantId: string): Observable<void> {
  return this.http.delete<null>(
    `${this.apiBaseUrl}/tenants/${tenantId}`,
  ) as unknown as Observable<void>;
}
```

After `updateTenant` succeeds, the component must call `this.tenants.update(...)` and `this.activeTenant.update(...)` to
reflect the changes in the signal store.

After `deleteTenant` succeeds, the component must remove the tenant from `this.tenants` signal, clear `activeTenant` if
it was the deleted tenant, and navigate to `/dashboard`.

#### 11.4.2 `ProjectClient` — no changes needed

All project member methods already exist on [`ProjectClient`](ui/src/app/services/project-client.ts:48):
[`listMembers()`](ui/src/app/services/project-client.ts:48), [`addMember()`](ui/src/app/services/project-client.ts:53),
[`updateMemberRole()`](ui/src/app/services/project-client.ts:58),
[`removeMember()`](ui/src/app/services/project-client.ts:63).

The `ProjectDetail` component enhancement only needs to call these existing methods.

---

### 11.5 RBAC — UI visibility model

#### 11.5.1 Tenant role source

The [`AuthStore`](ui/src/app/stores/auth-store.ts:13) stores the current `User` object. The user's **tenant role** is
determined by looking up their `TenantMember` record from the tenant context. Two approaches:

1. **Preferred:** Decode `tenantRole` from the JWT payload (the JWT already includes `tenantRole` per
   [§7.1](#71-authentication-mvp--mocksimple)). Add a `tenantRole` computed signal to `AuthStore`:

   ```typescript
   readonly tenantRole = computed(() => {
     const token = this.token();
     if (!token) return null;
     const payload = JSON.parse(atob(token.split('.')[1]));
     return payload.tenantRole as TenantRole | null;
   });
   ```

2. **Alternative:** Fetch the user's `TenantMember` records via `TenantClient.listMembers()` and find the record
   matching the current user's ID.

Option 1 is preferred because it avoids an extra HTTP call and the JWT already contains the role.

#### 11.5.2 Project role source

The [`ProjectDetail`](ui/src/app/features/projects/project-detail/project-detail.ts:38) component already loads members
via [`ProjectClient.listMembers()`](ui/src/app/services/project-client.ts:48). The current user's project role is
derived by matching `member.userId === authStore.currentUser()?.id`:

```typescript
readonly currentUserProjectRole = computed(() => {
  const userId = this.authStore.currentUser()?.id;
  return this.members().find((m) => m.userId === userId)?.role ?? null;
});
```

#### 11.5.3 Visibility matrix

| UI Element                 | Condition                                                |
| -------------------------- | -------------------------------------------------------- |
| Tenant settings: edit form | `tenantRole() === 'owner' \|\| tenantRole() === 'admin'` |
| Tenant settings: save btn  | Same as edit form                                        |
| Tenant delete button       | `tenantRole() === 'owner'`                               |
| Tenant member invite btn   | `tenantRole() === 'owner' \|\| tenantRole() === 'admin'` |
| Tenant member role change  | Same as invite btn + `!isOwner(member)`                  |
| Tenant member remove btn   | Same as invite btn + `!isOwner(member)`                  |
| Project member add btn     | `projectRole() === 'admin'`                              |
| Project member role change | `projectRole() === 'admin'`                              |
| Project member remove btn  | `projectRole() === 'admin'`                              |

**Implementation pattern — `computed()` signals:**

```typescript
// TenantMemberList / TenantSettings:
protected readonly canManage = computed(() => {
  const role = this.authStore.tenantRole();
  return role === 'owner' || role === 'admin';
});
protected readonly isOwner = computed(() => this.authStore.tenantRole() === 'owner');

// ProjectDetail:
protected readonly canManageProjectMembers = computed(() => {
  return this.currentUserProjectRole() === 'admin';
});
```

---

### 11.6 Spartan UI component mapping

All new UI uses Spartan UI (`@spartan-ng/helm`) components. The following table maps each UI element to its Spartan
component import.

#### 11.6.1 `TenantSettings`

| UI Element                 | Spartan Component     | Import                       |
| -------------------------- | --------------------- | ---------------------------- |
| Page layout card           | `HlmCardImports`      | `@spartan-ng/helm/card`      |
| Name / slug input fields   | `HlmInputImports`     | `@spartan-ng/helm/input`     |
| Field wrappers with labels | `HlmFieldImports`     | `@spartan-ng/helm/field`     |
| Save Changes button        | `HlmButtonImports`    | `@spartan-ng/helm/button`    |
| Delete Tenant button       | `HlmButtonImports`    | `@spartan-ng/helm/button`    |
| Delete confirmation dialog | `HlmDialogImports`    | `@spartan-ng/helm/dialog`    |
| Confirm name input         | `HlmInputImports`     | `@spartan-ng/helm/input`     |
| Loading / saving spinner   | `HlmSpinnerImports`   | `@spartan-ng/helm/spinner`   |
| Section separator          | `HlmSeparatorImports` | `@spartan-ng/helm/separator` |

#### 11.6.2 `TenantMemberList`

| UI Element                      | Spartan Component        | Import                           |
| ------------------------------- | ------------------------ | -------------------------------- |
| "Invite Member" button          | `HlmButtonImports`       | `@spartan-ng/helm/button`        |
| Invite dialog                   | `HlmDialogImports`       | `@spartan-ng/helm/dialog`        |
| Email input in dialog           | `HlmInputImports`        | `@spartan-ng/helm/input`         |
| Role dropdown (invite + inline) | `HlmNativeSelectImports` | `@spartan-ng/helm/native-select` |
| Field wrappers in dialog        | `HlmFieldImports`        | `@spartan-ng/helm/field`         |
| Role badge (read-only rows)     | `HlmBadgeImports`        | `@spartan-ng/helm/badge`         |
| User avatar fallback            | `HlmAvatarImports`       | `@spartan-ng/helm/avatar`        |
| Remove button                   | `HlmButtonImports`       | `@spartan-ng/helm/button`        |
| Remove confirmation dialog      | `HlmDialogImports`       | `@spartan-ng/helm/dialog`        |
| Loading spinner                 | `HlmSpinnerImports`      | `@spartan-ng/helm/spinner`       |

#### 11.6.3 `ProjectDetail` (enhanced members section)

| UI Element                      | Spartan Component        | Import                           |
| ------------------------------- | ------------------------ | -------------------------------- |
| "Add Member" button             | `HlmButtonImports`       | `@spartan-ng/helm/button`        |
| Add member dialog               | `HlmDialogImports`       | `@spartan-ng/helm/dialog`        |
| User picker dropdown            | `HlmNativeSelectImports` | `@spartan-ng/helm/native-select` |
| Role dropdown (dialog + inline) | `HlmNativeSelectImports` | `@spartan-ng/helm/native-select` |
| Field wrappers                  | `HlmFieldImports`        | `@spartan-ng/helm/field`         |
| Remove button                   | `HlmButtonImports`       | `@spartan-ng/helm/button`        |
| Remove confirmation dialog      | `HlmDialogImports`       | `@spartan-ng/helm/dialog`        |

#### 11.6.4 `Sidebar` (modified)

No new Spartan imports needed. The Settings link uses the existing `RouterLink` + `RouterLinkActive` pattern with Lucide
icons (consistent with the existing Projects and Sprints links).

---

### 11.7 Data flow — member invite sequence

```
TenantSettings / TenantMemberList
  │
  ├─ 1. User clicks "Invite Member" → showInviteDialog.set(true)
  │
  ├─ 2. Dialog renders: email input + role NativeSelect
  │
  ├─ 3. User fills form, clicks "Invite"
  │     └─ TenantClient.inviteMember(tenantId, email, role)
  │          └─ POST /api/v1/tenants/:tenantId/members { email, role }
  │               └─ TenantService.inviteMember()
  │                    └─ TenantMemberRepository.create()
  │
  ├─ 4. On success: TenantClient.listMembers(tenantId) → refresh list
  │     └─ showInviteDialog.set(false)
  │
  └─ 5. On error: display inline error message (422 validation, 409 conflict)
```

### 11.8 Data flow — tenant settings update sequence

```
TenantSettings
  │
  ├─ 1. Component reads activeTenant() from TenantClient for initial form values
  │
  ├─ 2. User edits name/slug fields (ngModel bindings)
  │
  ├─ 3. User clicks "Save Changes"
  │     └─ TenantClient.updateTenant(tenantId, { name, slug })
  │          └─ PATCH /api/v1/tenants/:tenantId { name, slug }
  │               └─ TenantService.updateTenant()
  │                    └─ TenantRepository.update()
  │
  ├─ 4. On success: update TenantClient.tenants() and activeTenant() signals
  │     └─ saving.set(false)
  │
  └─ 5. On error (422 slug conflict): display inline error below slug field
```

### 11.9 Data flow — tenant delete sequence

```
TenantSettings (Danger Zone)
  │
  ├─ 1. User clicks "Delete Tenant" → showDeleteDialog.set(true)
  │
  ├─ 2. Dialog requires typing the tenant name to confirm
  │
  ├─ 3. User confirms → TenantClient.deleteTenant(tenantId)
  │     └─ DELETE /api/v1/tenants/:tenantId
  │          └─ TenantService.deleteTenant()
  │               └─ TenantRepository.delete()
  │
  ├─ 4. On success:
  │     ├─ Remove tenant from TenantClient.tenants() signal
  │     ├─ Clear activeTenant if it was the deleted tenant
  │     ├─ TenantClient.loadTenants() to refresh
  │     └─ Router.navigate(['/dashboard'])
  │
  └─ 5. On error: display error message in dialog
```

---

### 11.10 Sidebar navigation update

The [`SidebarComponent`](ui/src/app/shell/sidebar/sidebar.html:1) must add a "Settings" link visible to all tenant
members:

```html
<!-- Add after the Sprints link, inside the @if (tenantService.activeTenant()) block -->
<a
  [routerLink]="['/tenants', tenant.id, 'settings']"
  routerLinkActive="bg-primary-50 text-primary-700 font-medium"
  class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-100"
>
  <span class="i-lucide-settings h-4 w-4"></span>
  Settings
</a>
```

The link uses the `i-lucide-settings` icon (Lucide). No new component dependencies are needed — the sidebar already
imports `RouterLink` and `RouterLinkActive`.

---

### 11.11 Error handling integration

All new components integrate with the existing [`error.interceptor.ts`](ui/src/app/interceptors/error.interceptor.ts)
which globally handles:

| HTTP Status | UI Behavior                                                    |
| ----------- | -------------------------------------------------------------- |
| 401         | Redirect to `/auth/login` (handled by interceptor)             |
| 403         | Display "Permission denied" message; disable triggering action |
| 422         | Display validation errors inline below the relevant form field |
| 409         | Display "Already exists" message (e.g., duplicate membership)  |
| 500         | Display generic error toast                                    |

Components handle errors locally via the `error` callback in `subscribe()`:

```typescript
this.tenantClient.inviteMember(tenantId, email, role).subscribe({
  next: (member) => {
    this.members.update((list) => [...list, member]);
    this.inviteError.set(null);
  },
  error: (err) => {
    this.inviteError.set(err.error?.message ?? 'Failed to invite member');
  },
});
```

---

### 11.12 Summary — files to create or modify

| Action     | File                                                                                                                                    | Description                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Create** | `ui/src/app/features/tenants/tenant-settings/tenant-settings.ts`                                                                        | Tenant settings page component                  |
| **Create** | `ui/src/app/features/tenants/tenant-settings/tenant-settings.html`                                                                      | Tenant settings template                        |
| **Create** | `ui/src/app/features/tenants/tenant-settings/tenant-settings.spec.ts`                                                                   | Tenant settings unit tests                      |
| **Create** | `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts`                                                                  | Tenant member list component                    |
| **Create** | `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.html`                                                                | Tenant member list template                     |
| **Create** | `ui/src/app/features/tenants/tenant-member-list/tenant-member-list.spec.ts`                                                             | Tenant member list unit tests                   |
| **Modify** | [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts:13)                                                       | Add 6 new methods (§11.4.1)                     |
| **Modify** | [`ui/src/app/stores/auth-store.ts`](ui/src/app/stores/auth-store.ts:13)                                                                 | Add `tenantRole` computed signal (§11.5.1)      |
| **Modify** | [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts:26)                                                                               | Add settings + settings/members routes (§11.2)  |
| **Modify** | [`ui/src/app/shell/sidebar/sidebar.html`](ui/src/app/shell/sidebar/sidebar.html:1)                                                      | Add Settings nav link (§11.10)                  |
| **Modify** | [`ui/src/app/features/projects/project-detail/project-detail.ts`](ui/src/app/features/projects/project-detail/project-detail.ts:38)     | Add member management signals + methods (§11.3) |
| **Modify** | [`ui/src/app/features/projects/project-detail/project-detail.html`](ui/src/app/features/projects/project-detail/project-detail.html:54) | Add member management UI (§11.3)                |
| **Modify** | [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts:94)                                                                       | Add `GET /:tenantId/members` route (§11.1)      |

---

## 12. Dashboard Architecture (Phase 11)

> **Reference:** [Technical Specification §15](technical_specification.md) — Jira-Style Dashboard

This section defines the architectural decisions for the adaptive dashboard that replaces the simple tenant-scoped
project list with a smart landing page that adapts based on the user's authentication status and workspace membership.

### 12.1 Dashboard states

The [`Dashboard`](ui/src/app/features/dashboard/dashboard.ts) component is a stateful orchestrator that detects the
user's state and delegates to child sub-views. State is exposed as a signal:

```typescript
type DashboardState = 'loading' | 'visitor' | 'new-user' | 'pending-invitations' | 'member' | 'owner';
```

| State | Name                | Auth required | Condition                                                    | Primary CTA                                 |
| ----- | ------------------- | :-----------: | ------------------------------------------------------------ | ------------------------------------------- |
| 0     | Visitor             |      No       | `isAuthenticated() === false`                                | Register / Login                            |
| 1     | New User            |      Yes      | Authenticated, zero tenants, zero pending invitations        | "Create your first workspace"               |
| 2     | Pending Invitations |      Yes      | Authenticated, zero tenants, ≥ 1 pending invitation          | Accept/Decline invitations                  |
| 3     | Member              |      Yes      | Authenticated, ≥ 1 tenant as `member` or `admin` (not owner) | View workspaces and recent tasks            |
| 4     | Owner               |      Yes      | Authenticated, ≥ 1 tenant as `owner`                         | Manage workspaces, view pending invitations |

### 12.2 State detection algorithm

```
1. dashboardState = signal('loading')

2. IF authStore.isAuthenticated() === false:
     → dashboardState = 'visitor'
     → STOP (no API calls)

3. Load tenants: await tenantClient.loadTenants()   // now returns TenantWithRole[]
   Load pending invitations: await invitationClient.getMyInvitations()

4. IF tenants.length === 0 AND pendingInvitations.length === 0:
     → dashboardState = 'new-user'

5. IF tenants.length === 0 AND pendingInvitations.length > 0:
     → dashboardState = 'pending-invitations'

6. IF user owns at least one tenant (check role === 'owner'):
     → dashboardState = 'owner'
     → Load additional data: pending sent invitations, recent tasks

7. ELSE:
     → dashboardState = 'member'
     → Load additional data: recent tasks across all tenants
```

**Owner detection:** The [`TenantClient`](ui/src/app/services/tenant-client.ts) exposes the user's role per tenant via
the augmented `GET /tenants` response (includes `role` field from `tenant_members` join).

### 12.3 Component hierarchy

```
ui/src/app/features/dashboard/
├── dashboard.ts                     # Main orchestrator (state detection)
├── dashboard.html                   # @switch on dashboardState
├── visitor/
│   └── landing-page.ts              # State 0: static marketing page (no backend calls)
├── new-user/
│   └── welcome-view.ts              # State 1: create workspace CTA + free plan info
├── pending-invitations/
│   └── invitation-view.ts           # State 2: invitation cards (accept/decline)
├── member/
│   └── member-dashboard.ts          # State 3: My Workspaces + My Recent Tasks + Quick Stats
└── owner/
    └── owner-dashboard.ts           # State 4: everything from State 3 + Pending Invitations Sent + management links
```

**Template pattern:**

```html
<!-- dashboard.html -->
@switch (dashboardState()) { @case ('loading') {
<hlm-spinner />
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

### 12.4 Angular 22 patterns used

| Pattern                         | Usage in Dashboard                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `signal()`                      | `dashboardState`, `tenants`, `myTasks`, `pendingInvitations`, `sentInvitations`, `loading` |
| `computed()`                    | `isOwner`, `isMember`, `hasInvitations`, `taskStats`                                       |
| `effect()`                      | Trigger data loading when state transitions                                                |
| `resource()` / `httpResource()` | Data fetching for tasks and invitations with signal integration                            |
| `@if` / `@for` / `@switch`      | Control flow in all sub-view templates                                                     |
| `inject()`                      | DI of `AuthStore`, `TenantClient`, `TaskClient`, `Router`                                  |
| Standalone components           | All sub-views are standalone — no NgModules                                                |

### 12.5 New backend endpoints

Four new endpoints serve the dashboard (see [spec §15.10](technical_specification.md)):

| Endpoint                                            | Auth | Tenant Context | RBAC        | Description                                    |
| --------------------------------------------------- | :--: | :------------: | ----------- | ---------------------------------------------- |
| `GET /api/v1/invitations/my`                        | Yes  |  **Not req**   | —           | Cross-tenant: pending invitations for the user |
| `DELETE /api/v1/invitations/:invitationId`          | Yes  |  **Not req**   | —           | Cross-tenant: decline/revoke an invitation     |
| `GET /api/v1/tasks/my`                              | Yes  |  **Not req**   | —           | Cross-tenant: tasks assigned to the user       |
| `GET /api/v1/tenants/:tenantId/invitations/pending` | Yes  |    Required    | Owner/Admin | Pending invitations sent by a tenant           |

The first three are **cross-tenant** endpoints — they do NOT require the `X-Tenant-Id` header and are registered at the
app level outside the tenant-scoped middleware pipeline. The fourth is tenant-scoped and follows the standard pipeline.

### 12.6 Service layer extensions

#### `TenantClient` additions

```typescript
/** Get pending invitations for the current user's email (cross-tenant) */
getMyInvitations(): Observable<{ data: MyInvitation[]; total: number }>

/** Get pending invitations sent by a tenant (owner/admin only) */
getPendingInvitations(tenantId: string): Observable<{ data: PendingInvitation[]; total: number }>

/** Decline a pending invitation */
declineInvitation(invitationId: string): Observable<void>
```

#### `TaskClient` additions

```typescript
/** Get tasks assigned to the current user across all tenants */
getMyTasks(page?: number, limit?: number): Observable<MyTasksResponse>
```

### 12.7 Shared package additions

| Location                         | New additions                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `server/src/schemas/tenant.ts`   | `MyInvitationSchema`, `MyInvitationsResponseSchema`, `PendingInvitationSchema`, `PendingInvitationsResponseSchema` |
| `server/src/schemas/task.ts`     | `MyTaskSchema` (extends `TaskSchema` with `tenantName`, `projectName`, `columnTitle`), `MyTasksResponseSchema`     |
| `server/src/contracts/auth.ts`   | `getMyInvitations`, `declineInvitation`                                                                            |
| `server/src/contracts/task.ts`   | `getMyTasks`                                                                                                       |
| `server/src/contracts/tenant.ts` | `getPendingInvitations`                                                                                            |
| `shared/src/types/tenant.ts`     | `MyInvitation`, `PendingInvitation`                                                                                |
| `shared/src/types/task.ts`       | `MyTask`                                                                                                           |

### 12.8 Spartan UI component mapping (dashboard sub-views)

| Sub-view                   | Spartan Components                                                           |
| -------------------------- | ---------------------------------------------------------------------------- |
| `LandingPageComponent`     | `HlmButtonImports`, `HlmCardImports`                                         |
| `WelcomeViewComponent`     | `HlmButtonImports`, `HlmCardImports`, `HlmSpinnerImports`                    |
| `InvitationViewComponent`  | `HlmButtonImports`, `HlmCardImports`, `HlmBadgeImports`, `HlmSpinnerImports` |
| `MemberDashboardComponent` | `HlmButtonImports`, `HlmCardImports`, `HlmBadgeImports`, `HlmSpinnerImports` |
| `OwnerDashboardComponent`  | `HlmButtonImports`, `HlmCardImports`, `HlmBadgeImports`, `HlmSpinnerImports` |

### 12.9 Error handling

| Scenario                             | Behavior                                                      |
| ------------------------------------ | ------------------------------------------------------------- |
| `GET /tenants` fails                 | Show error state with retry button                            |
| `GET /invitations/my` fails          | Treat as zero invitations (non-blocking)                      |
| `GET /tasks/my` fails                | Show "Unable to load tasks" with retry; other sections render |
| `POST /auth/accept-invitation` fails | Show error toast; invitation card remains                     |
| `DELETE /invitations/:id` fails      | Show error toast; invitation card remains                     |

### 12.10 RBAC visibility matrix

| UI Element                        | Visitor | New User | Pending Invitee | Member | Owner |
| --------------------------------- | :-----: | :------: | :-------------: | :----: | :---: |
| Landing page content              |   ✅    |    ❌    |       ❌        |   ❌   |  ❌   |
| "Create workspace" CTA            |   ❌    |    ✅    |       ✅        |   ❌   |  ✅   |
| Invitation cards (accept/decline) |   ❌    |    ❌    |       ✅        |   ❌   |  ❌   |
| "My Workspaces" section           |   ❌    |    ❌    |       ❌        |   ✅   |  ✅   |
| "My Recent Tasks" section         |   ❌    |    ❌    |       ❌        |   ✅   |  ✅   |
| "Pending Invitations Sent"        |   ❌    |    ❌    |       ❌        |   ❌   |  ✅   |
| Workspace management links        |   ❌    |    ❌    |       ❌        |   ❌   |  ✅   |

### 12.11 Summary — files to create or modify

| Action     | File                                                                             | Description                                                                |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Create** | `server/src/routes/invitations.ts`                                               | Cross-tenant invitation routes (GET /my, DELETE /:id)                      |
| **Modify** | [`server/src/routes/tasks.ts`](server/src/routes/tasks.ts)                       | Add cross-tenant `GET /my` route                                           |
| **Modify** | [`server/src/routes/tenants.ts`](server/src/routes/tenants.ts)                   | Add `GET /:tenantId/invitations/pending` route                             |
| **Modify** | [`server/src/routes/index.ts`](server/src/routes/index.ts)                       | Register new invitation routes                                             |
| **Modify** | [`server/src/services/tenant.service.ts`](server/src/services/tenant.service.ts) | Add `getPendingInvitations()` with RBAC                                    |
| **Modify** | [`server/src/services/task.service.ts`](server/src/services/task.service.ts)     | Add `getMyTasks()` cross-tenant method                                     |
| **Modify** | `server/src/schemas/tenant.ts`                                                   | Add `MyInvitationSchema`, `PendingInvitationSchema`                        |
| **Modify** | `server/src/schemas/task.ts`                                                     | Add `MyTaskSchema`, `MyTasksResponseSchema`                                |
| **Modify** | `server/src/contracts/tenant.contracts.ts`                                       | Add `getPendingInvitations` contract                                       |
| **Modify** | `server/src/contracts/auth.contracts.ts`                                         | Add `getMyInvitations`, `declineInvitation` contracts                      |
| **Modify** | `server/src/contracts/task.contracts.ts`                                         | Add `getMyTasks` contract                                                  |
| **Modify** | `shared/src/types/tenant.ts`                                                     | Add `MyInvitation`, `PendingInvitation` types                              |
| **Modify** | `shared/src/types/task.ts`                                                       | Add `MyTask` type                                                          |
| **Modify** | [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts)   | Add `getMyInvitations()`, `getPendingInvitations()`, `declineInvitation()` |
| **Modify** | [`ui/src/app/services/task-client.ts`](ui/src/app/services/task-client.ts)       | Add `getMyTasks()` method                                                  |
| **Modify** | [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts)                           | Remove `authGuard` from root `/` route; add `/workspace/create`            |
| **Modify** | [`ui/src/app/stores/auth-store.ts`](ui/src/app/stores/auth-store.ts)             | Ensure `isAuthenticated` signal is exposed                                 |
| **Create** | `ui/src/app/features/dashboard/dashboard.ts`                                     | Dashboard orchestrator (state detection via signals)                       |
| **Create** | `ui/src/app/features/dashboard/dashboard.html`                                   | `@switch` template for 5 states + loading                                  |
| **Create** | `ui/src/app/features/dashboard/visitor/landing-page.ts`                          | State 0: static marketing page                                             |
| **Create** | `ui/src/app/features/dashboard/new-user/welcome-view.ts`                         | State 1: create workspace CTA                                              |
| **Create** | `ui/src/app/features/dashboard/pending-invitations/invitation-view.ts`           | State 2: invitation cards                                                  |
| **Create** | `ui/src/app/features/dashboard/member/member-dashboard.ts`                       | State 3: workspaces + tasks + stats                                        |
| **Create** | `ui/src/app/features/dashboard/owner/owner-dashboard.ts`                         | State 4: full dashboard + sent invitations                                 |

---

## 13. Workspace Detail Page Architecture (Phase 12)

> **Reference:** [Technical Specification §16](technical_specification.md:2743) — Workspace Detail Page

This section defines the architectural decisions for the Workspace Detail page — a frontend-only feature with a minor
shared schema change. No new backend endpoints are required; existing
[`GET /tenants/:tenantId`](server/src/routes/tenants.ts) and [`GET /projects`](server/src/routes/projects.ts) are
sufficient.

### 13.1 Overview

The Workspace Detail page adds a default landing view at [`/tenants/:tenantId`](ui/src/app/app.routes.ts:34) (empty
child path) inside the [`AppShell`](ui/src/app/shell/app-shell/app-shell.ts). It displays the workspace name, the user's
role badge, an optional description, RBAC-gated action buttons, and a collapsible project list using
[`HlmCollapsible`](ui/libs/ui/collapsible/src/lib/hlm-collapsible.ts).

**Key constraint:** This is a **frontend-only feature**. The only backend changes are schema/repository plumbing to
support the new `description` field on the `Tenant` entity. No new API endpoints, services, or routes are needed on the
server.

### 13.2 Shared layer changes — `description` field

Three Zod schemas in [`server/src/schemas/tenant.ts`](server/src/schemas/tenant.ts:8) require a `description` field:

#### 13.2.1 `TenantSchema` (line 8)

Add `description` after `subscription`:

```typescript
// server/src/schemas/tenant.ts — TenantSchema (modified)
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

The `nullable().optional()` combination handles three cases:

- **Existing MongoDB documents** without a `description` field → `undefined` (optional)
- **Explicit null** from the database → `null` (nullable)
- **String value** from user input → validated up to 500 characters

#### 13.2.2 `CreateTenantSchema` (line 33)

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

#### 13.2.3 `UpdateTenantSchema` (line 50)

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

**Type flow:** The [`Tenant`](shared/src/types/tenant.ts) type is a plain TypeScript interface. After adding
`description?: string | null` to the interface, it is automatically available across the codebase.

#### 13.2.4 `TenantWithRoleSchema` (line 107)

[`TenantWithRoleSchema`](server/src/schemas/tenant.ts:107) extends `TenantSchema` via `.extend()` — it inherits the
`description` field automatically. No change needed.

---

### 13.3 Server layer changes

#### 13.3.1 `TenantDocument` — [`server/src/repositories/tenant.repository.ts`](server/src/repositories/tenant.repository.ts:11)

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

#### 13.3.2 `toDomain()` mapper (line 23)

Map `description` from the document to the domain model:

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

**Note:** MongoDB documents created before this change will not have a `description` field. Accessing a missing field
returns `undefined`, which is valid for the `nullable().optional()` schema. No data migration is needed.

#### 13.3.3 `TenantRepository.create()` (line 57)

Update the input type to accept `description`:

```typescript
async create(input: { name: string; slug: string; subscription?: string; description?: string }): Promise<Tenant> {
  const now = new Date();
  const doc: TenantDocument = {
    id: randomUUID(),
    name: input.name,
    slug: input.slug,
    subscription: input.subscription ?? 'free',
    description: input.description ?? null, // NEW
    createdAt: now,
    updatedAt: now,
  };
  await this.collection.insertOne(doc);
  return toDomain(doc);
}
```

#### 13.3.4 `TenantRepository.update()` (line 72)

Update the `Pick` type to include `'description'`:

```typescript
async update(id: string, input: Partial<Pick<TenantDocument, 'name' | 'slug' | 'description'>>): Promise<Tenant | null> {
  // Body unchanged — $set already handles arbitrary fields
}
```

#### 13.3.5 `TenantService` — [`server/src/services/tenant.service.ts`](server/src/services/tenant.service.ts)

**`createTenant()` (line 32):** The spread `{ ...input, subscription }` already passes `description` through if present
in the `CreateTenant` input type. After the schema change, `input.description` flows automatically. **No code change
needed** — verify that the spread is used (it is, at line 48).

**`updateTenant()` (line 96):** The `input` parameter is typed as `UpdateTenant` and passed directly to
`this.tenantRepo.update(id, input)` at line 112. After the schema change, `input.description` flows automatically. **No
code change needed** — verify the direct pass-through (confirmed).

---

### 13.4 UI layer changes

#### 13.4.1 Route — [`app.routes.ts`](ui/src/app/app.routes.ts:37)

Add an empty-path child route as the **first** child of `tenants/:tenantId`:

```typescript
// In the children array of 'tenants/:tenantId' (line 37)
children: [
  {
    path: '', // NEW — must be first child
    loadComponent: () => import('./features/tenants/workspace-detail/workspace-detail').then((m) => m.WorkspaceDetail),
  },
  {
    path: 'settings',
    // ... existing
  },
  // ... rest of existing children
];
```

> **Why first?** Angular matches child routes in declaration order. An empty-path route placed after other children
> would never match because those more-specific paths would consume the request first. Placing it first ensures
> `/tenants/:tenantId` resolves to `WorkspaceDetail` rather than showing an empty `<router-outlet>`.

**Guards:** No additional guards needed. The parent route already applies
[`authGuard`](ui/src/app/guards/auth.guard.ts:24) and [`tenantGuard`](ui/src/app/guards/tenant.guard.ts:24). RBAC
enforcement is handled inside the component via computed signals.

#### 13.4.2 New component — `WorkspaceDetail`

**Location:** `ui/src/app/features/tenants/workspace-detail/`

**Files:**

| File                    | Purpose         |
| ----------------------- | --------------- |
| `workspace-detail.ts`   | Component class |
| `workspace-detail.html` | Template        |

#### 13.4.3 Component design — [`workspace-detail.ts`](ui/src/app/features/tenants/workspace-detail/workspace-detail.ts)

| Aspect           | Detail                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selector**     | `ui-workspace-detail`                                                                                                                                                 |
| **Standalone**   | Yes                                                                                                                                                                   |
| **Dependencies** | [`TenantStore`](ui/src/app/stores/tenant-store.ts:14), [`AuthStore`](ui/src/app/stores/auth-store.ts:21), [`ProjectClient`](ui/src/app/services/project-client.ts:16) |
| **Data loading** | Tenant from [`TenantStore.activeTenant()`](ui/src/app/stores/tenant-store.ts:17); projects via [`ProjectClient.list()`](ui/src/app/services/project-client.ts:21)     |
| **RBAC source**  | [`AuthStore.tenantRole`](ui/src/app/stores/auth-store.ts:27) signal (decoded from JWT)                                                                                |

**Signals:**

```typescript
// Component-level signals
protected readonly tenant = computed(() => this.tenantStore.activeTenant());
protected readonly role = computed(() => this.authStore.tenantRole() as TenantRole | null);
protected readonly description = computed(() => this.tenant()?.description ?? '');
protected readonly projects = signal<Project[]>([]);
protected readonly loadingProjects = signal(true);
protected readonly projectsExpanded = signal(true); // default: expanded

// RBAC computed signals
protected readonly isOwnerOrAdmin = computed(() => {
  const r = this.role();
  return r === 'owner' || r === 'admin';
});

protected readonly isOwner = computed(() => this.role() === 'owner');

protected readonly showUpgrade = computed(() => {
  return this.isOwner() && this.tenant()?.subscription === 'free';
});
```

**Data loading strategy:**

```typescript
async ngOnInit(): Promise<void> {
  try {
    const res = await firstValueFrom(this.projectClient.list(1, 100));
    this.projects.set(res.data);
  } catch {
    // Non-blocking — project section shows empty state
  } finally {
    this.loadingProjects.set(false);
  }
}
```

> **Member project filtering (BQ-16.1):** For `member` role,
> [`ProjectClient.list()`](ui/src/app/services/project-client.ts:21) returns all tenant projects (the backend
> `GET /projects` does not filter by project membership). As an interim solution, the component will display all
> projects for all roles. When a server-side filter endpoint becomes available, the component can pass a filter
> parameter. This is acceptable because the project list is read-only on this page — navigation to a project the member
> doesn't belong to will be caught by [`projectGuard`](ui/src/app/guards/project.guard.ts).

#### 13.4.4 Template — [`workspace-detail.html`](ui/src/app/features/tenants/workspace-detail/workspace-detail.html)

```
┌──────────────────────────────────────────────┐
│  <h1> Workspace Name                         │
│  [owner] badge                               │
│                                              │
│  Description text (or placeholder)           │
│                                              │
│  [Settings] [Members] [Upgrade]  ← owner/admin only
│                                              │
│  ▼ Projects (3)                    ← collapsible
│    ┌──────────────────────────────┐ │
│    │ 📁 Project A                 │ │
│    │ 📁 Project B                 │ │
│    │ 📁 Project C                 │ │
│    └──────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Spartan UI components:**

| UI Element                     | Spartan Component       | Import                         |
| ------------------------------ | ----------------------- | ------------------------------ |
| Role badge                     | `HlmBadgeImports`       | `@spartan-ng/helm/badge`       |
| Action buttons (Settings etc.) | `HlmButtonImports`      | `@spartan-ng/helm/button`      |
| Collapsible project list       | `HlmCollapsibleImports` | `@spartan-ng/helm/collapsible` |
| Project list cards             | `HlmCardImports`        | `@spartan-ng/helm/card`        |

Icons: `lucideSettings`, `lucideUsers`, `lucideCreditCard`, `lucideChevronDown`, `lucideFolder` via `@ng-icons/core` +
`@ng-icons/lucide`.

**Template structure:**

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
      <ng-icon name="lucideSettings" class="mr-1.5 h-4 w-4" /> Settings
    </a>
    <a hlmBtn variant="outline" size="md" [routerLink]="['/tenants', tenant()?.id, 'settings/members']">
      <ng-icon name="lucideUsers" class="mr-1.5 h-4 w-4" /> Members
    </a>
    @if (showUpgrade()) {
    <a hlmBtn variant="outline" size="md" [routerLink]="['/tenants', tenant()?.id, 'upgrade']">
      <ng-icon name="lucideCreditCard" class="mr-1.5 h-4 w-4" /> Upgrade
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
          class="flex items-center gap-3 rounded-lg border border-border bg-card p-3
                      shadow-sm transition-all hover:shadow-md hover:border-primary/30"
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

---

### 13.5 RBAC visibility matrix

| UI Element                  | Owner (free) | Owner (premium) | Admin | Member |
| --------------------------- | :----------: | :-------------: | :---: | :----: |
| Workspace name (`<h1>`)     |      ✅      |       ✅        |  ✅   |   ✅   |
| Role badge                  |      ✅      |       ✅        |  ✅   |   ✅   |
| Description text            |      ✅      |       ✅        |  ✅   |   ✅   |
| Settings button             |      ✅      |       ✅        |  ✅   |   ❌   |
| Members button              |      ✅      |       ✅        |  ✅   |   ❌   |
| Upgrade button              |      ✅      |       ❌        |  ❌   |   ❌   |
| Project list (all projects) |      ✅      |       ✅        |  ✅   |  ✅*   |

\* For `member` role, all projects are shown (server does not filter by project membership). Navigation to unauthorized
projects is blocked by [`projectGuard`](ui/src/app/guards/project.guard.ts).

**Implementation:** All visibility is driven by [`computed()`](ui/src/app/stores/auth-store.ts:27) signals reading
[`AuthStore.tenantRole`](ui/src/app/stores/auth-store.ts:27) — no role-based conditionals in the template beyond
`@if (isOwnerOrAdmin())` and `@if (showUpgrade())`.

---

### 13.6 Data flow — workspace detail load sequence

```
1. User navigates to /tenants/:tenantId
   │
   ├─ authGuard verifies authentication (existing)
   ├─ tenantGuard verifies active tenant membership (existing)
   │
   ├─ AppShell renders (sidebar + header + <router-outlet>)
   ├─ Router resolves '' child → WorkspaceDetail component
   │
   ├─ Component reads tenantStore.activeTenant() → tenant signal
   │   └─ Already loaded by TenantStore.loadTenants() on app init
   │
   ├─ Component reads authStore.tenantRole() → role signal
   │   └─ Already decoded from JWT by AuthStore constructor
   │
   ├─ Component calls ProjectClient.list(1, 100) in ngOnInit()
   │   └─ GET /api/v1/projects (X-Tenant-Id header attached by interceptor)
   │   └─ Sets projects signal; loadingProjects → false
   │
   └─ Template renders:
       ├─ <h1> with tenant name
       ├─ Role badge
       ├─ Description (or placeholder)
       ├─ Action buttons (if isOwnerOrAdmin)
       └─ Collapsible project list (HlmCollapsible)
```

**No new HTTP calls beyond existing endpoints.** Tenant data is already loaded by
[`TenantStore`](ui/src/app/stores/tenant-store.ts:14). Project data uses the existing
[`ProjectClient.list()`](ui/src/app/services/project-client.ts:21).

---

### 13.7 TenantClient and TenantStore updates

#### 13.7.1 [`TenantClient.updateTenant()`](ui/src/app/services/tenant-client.ts:38)

Add `description` to the data parameter:

```typescript
updateTenant(
  tenantId: string,
  data: { name?: string; slug?: string; description?: string; subscription?: string }
): Observable<Tenant> {
  return this.http.patch<Tenant>(`${this.apiBaseUrl}/tenants/${tenantId}`, data);
}
```

#### 13.7.2 [`TenantStore.updateTenant()`](ui/src/app/stores/tenant-store.ts:53)

Add `description` to the data parameter:

```typescript
async updateTenant(
  tenantId: string,
  data: { name?: string; slug?: string; description?: string; subscription?: string }
): Promise<Tenant> {
  // Body unchanged — data is passed through to tenantClient.updateTenant()
}
```

After these changes, the [`TenantSettings`](ui/src/app/features/tenants/tenant-settings/tenant-settings.ts) component
can edit the description field via the existing save flow. The
[`WorkspaceDetail`](ui/src/app/features/tenants/workspace-detail/workspace-detail.ts) component reads `description` from
[`TenantStore.activeTenant()`](ui/src/app/stores/tenant-store.ts:17) which is automatically updated after a successful
save.

---

### 13.8 Dashboard link updates

#### 13.8.1 [`owner-dashboard.html`](ui/src/app/features/dashboard/owner-dashboard/owner-dashboard.html:48) — workspace name link

Make the workspace card title a link to the workspace detail page:

```html
<!-- Current (line 48): plain text -->
<h3 class="text-sm font-semibold text-foreground">{{ tenant.name }}</h3>

<!-- New: link to workspace detail -->
<a [routerLink]="['/tenants', tenant.id]" class="text-sm font-semibold text-foreground hover:text-primary">
  {{ tenant.name }}
</a>
```

The existing action buttons (Projects, Settings, Members, Upgrade) remain unchanged as secondary navigation shortcuts.

#### 13.8.2 [`member-dashboard.html`](ui/src/app/features/dashboard/member-dashboard/member-dashboard.html:36) — link target change

Change the workspace card link target from projects to workspace detail:

```html
<!-- Current (line 36): links to projects -->
<a [routerLink]="['/tenants', tenant.id, 'projects']" ...>
  <!-- New: links to workspace detail -->
  <a [routerLink]="['/tenants', tenant.id]" ...></a
></a>
```

---

### 13.9 Angular 22 patterns

| Pattern              | Usage in WorkspaceDetail                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signal()`           | `projects`, `loadingProjects`, `projectsExpanded`                                                                                                                           |
| `computed()`         | `tenant`, `role`, `description`, `isOwnerOrAdmin`, `isOwner`, `showUpgrade`                                                                                                 |
| `@if` / `@for`       | Conditional rendering of description, action buttons, project list items                                                                                                    |
| `inject()`           | DI of [`TenantStore`](ui/src/app/stores/tenant-store.ts:14), [`AuthStore`](ui/src/app/stores/auth-store.ts:21), [`ProjectClient`](ui/src/app/services/project-client.ts:16) |
| Standalone component | No NgModule; declares own imports                                                                                                                                           |
| `RouterLink`         | Navigation to settings, members, upgrade, and individual projects                                                                                                           |
| `HlmCollapsible`     | Collapsible project list container                                                                                                                                          |
| `@defer`             | Not used — project list is lightweight; `@defer` can be added later if performance requires                                                                                 |

---

### 13.10 Error handling

| Scenario                                    | Behavior                                                        |
| ------------------------------------------- | --------------------------------------------------------------- |
| `GET /projects` fails                       | Non-blocking; project list shows "No projects yet." placeholder |
| `activeTenant()` is `null`                  | Component shows nothing (route guard should prevent this state) |
| `tenantRole()` is `null`                    | Action buttons hidden (default: not owner/admin)                |
| Description is `null`/`undefined`           | Placeholder text "No description provided." in muted italic     |
| Existing tenant without `description` field | MongoDB returns `undefined` → maps to `null` → placeholder      |

---

### 13.11 Summary — files to create or modify

| Action     | File                                                                                                                                              | Description                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Modify** | [`shared/src/schemas/tenant.ts`](shared/src/schemas/tenant.ts:8)                                                                                  | Add `description` to `TenantSchema`, `CreateTenantSchema`, `UpdateTenantSchema` |
| **Modify** | [`server/src/repositories/tenant.repository.ts`](server/src/repositories/tenant.repository.ts:11)                                                 | Add `description` to `TenantDocument`, `toDomain()`, `create()`, `update()`     |
| **Modify** | [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts:37)                                                                                         | Add empty-path child route for WorkspaceDetail                                  |
| **Create** | `ui/src/app/features/tenants/workspace-detail/workspace-detail.ts`                                                                                | WorkspaceDetail component class                                                 |
| **Create** | `ui/src/app/features/tenants/workspace-detail/workspace-detail.html`                                                                              | WorkspaceDetail template                                                        |
| **Modify** | [`ui/src/app/services/tenant-client.ts`](ui/src/app/services/tenant-client.ts:38)                                                                 | Add `description` to `updateTenant()` data parameter                            |
| **Modify** | [`ui/src/app/stores/tenant-store.ts`](ui/src/app/stores/tenant-store.ts:53)                                                                       | Add `description` to `updateTenant()` data parameter                            |
| **Modify** | [`ui/src/app/features/dashboard/owner-dashboard/owner-dashboard.html`](ui/src/app/features/dashboard/owner-dashboard/owner-dashboard.html:48)     | Make workspace card title a link to `/tenants/:tenantId`                        |
| **Modify** | [`ui/src/app/features/dashboard/member-dashboard/member-dashboard.html`](ui/src/app/features/dashboard/member-dashboard/member-dashboard.html:36) | Change workspace card link target to `/tenants/:tenantId`                       |

**No changes needed:**

| File                                                                             | Reason                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`server/src/services/tenant.service.ts`](server/src/services/tenant.service.ts) | `createTenant()` and `updateTenant()` pass input through via spread/direct delegation |
| [`ui/src/app/stores/auth-store.ts`](ui/src/app/stores/auth-store.ts:27)          | `tenantRole` signal already exists                                                    |
| [`shared/src/types/tenant.ts`](shared/src/types/tenant.ts)                       | Plain TypeScript interface — add `description?: string \| null` field                 |

---

### 13.12 Risks and assumptions

| #   | Risk / Assumption                                                                                                                                                                                          | Impact                                                               | Mitigation                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A1  | MongoDB documents without a `description` field return `undefined` when accessed, which maps to `null` via `?? undefined` in `toDomain()`                                                                  | No migration needed for existing tenants                             | Verified: MongoDB handles missing fields gracefully                                                             |
| A2  | [`HlmCollapsible`](ui/libs/ui/collapsible/src/lib/hlm-collapsible.ts) is already installed and available (confirmed used in [`sprint-list.ts`](ui/src/app/features/sprints/sprint-list/sprint-list.ts:17)) | No dependency installation needed                                    | Verified in codebase search                                                                                     |
| A3  | [`ProjectClient.list()`](ui/src/app/services/project-client.ts:21) uses the active tenant context via `X-Tenant-Id` header interceptor                                                                     | Project list is automatically tenant-scoped                          | Verified: interceptor attaches header from [`TenantStore.activeTenant()`](ui/src/app/stores/tenant-store.ts:17) |
| A4  | For `member` role, `GET /projects` returns all tenant projects (no server-side membership filter)                                                                                                          | Members see all projects; unauthorized nav blocked by `projectGuard` | Interim solution; server-side filter is a future enhancement (BQ-16.1)                                          |
| A5  | The empty-path child route does not conflict with wildcard redirects since Angular resolves child routes before the parent's wildcard                                                                      | No routing conflicts                                                 | Verified: Angular router matching order is depth-first, children before siblings                                |
| A6  | [`TenantService.updateTenant()`](server/src/services/tenant.service.ts:96) passes `input` directly to `this.tenantRepo.update(id, input)`                                                                  | `description` flows automatically after schema change                | Verified at line 112: direct pass-through, no field destructuring                                               |
| R1  | Backward compatibility — existing tenants without `description` field must render gracefully                                                                                                               | Placeholder text shown                                               | `nullable().optional()` schema + null coalescing in `toDomain()` handles this                                   |

---

## Summary

| Item                              | Detail                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture document**         | `docs/implementation/architecture.md`                                                                                                                                                                                                                                                                   |
| **Reference specification**       | `docs/implementation/technical_specification.md` v4.0.0                                                                                                                                                                                                                                                 |
| **Reference project description** | `docs/project_description.md`                                                                                                                                                                                                                                                                           |
| **Stack**                         | Angular 22.0.8 (standalone, zoneless, signals, `resource()`, `linkedSignal()`, `httpResource()`, signal forms) + Hono 4.8.0 on Cloudflare Workers + MongoDB Atlas + MongoDB Driver 7.0.0 + TypeScript 6.0.0 + Zod 4.0.0 (server-only) + Tailwind CSS 4.1.0 + Spartan UI 0.12.0 + Resend 4.x             |
| **Key patterns**                  | Feature-oriented modules, service/repository separation, runtime-library-free shared package (types + constants), server-side Zod v4 schemas (`z.interface()`) for validation, tenant isolation at data + application + API layers, signal-based state on the frontend, functional guards and resolvers |
| **MVP scope**                     | Auth, tenants (with subscription tiers), projects, boards, columns, tasks, sprints, RBAC, email-based invitation system, **Jira-style adaptive dashboard** — all scoped by tenant                                                                                                                       |

### Risks and Assumptions

| #   | Risk / Assumption                                                                                              | Impact                                                                 | Mitigation                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| R1  | JWT has no refresh mechanism (24h expiry only)                                                                 | Users must re-login after 24h                                          | Acceptable for MVP; refresh token strategy can be added as an extension                                            |
| R2  | MongoDB Atlas free tier (M0) has limited performance                                                           | May not handle high load                                               | Upgrade tier before production; indexes ensure efficient queries at MVP scale                                      |
| R3  | No real-time updates (WebSocket)                                                                               | Users don't see live task updates                                      | Polling or manual refresh is sufficient for MVP; WebSocket is an extension point                                   |
| R4  | No email verification or password reset                                                                        | Users may use invalid emails                                           | Out of scope for MVP; can be added as an extension                                                                 |
| R5  | `X-Tenant-Id` header is the sole tenant context mechanism                                                      | If header is missing or spoofed, tenant context is invalid             | Backend middleware validates active tenant membership on every request; tenantId in JWT provides a secondary check |
| R6  | No private npm registry for shared package                                                                     | Shared package is consumed via npm workspaces only                     | Works for monorepo; a private registry would be needed if packages are published separately                        |
| R7  | Registration does NOT auto-create a tenant                                                                     | New users have `tenantId: null` in JWT                                 | Frontend must handle the "no workspace" state; redirect to workspace creation or invitation acceptance             |
| R8  | Resend free tier (3K emails/month, 100/day) may not scale                                                      | Invitation emails may be throttled at higher usage                     | Monitor usage; upgrade Resend plan or switch provider when needed                                                  |
| R9  | Subscription limits are enforced at the service layer, not the database                                        | Limits could be bypassed if service logic has bugs                     | Comprehensive tests for subscription limit enforcement; limits are simple enough to verify manually                |
| A1  | Tenant creation is self-service (any registered user can create a tenant)                                      | May lead to orphaned tenants                                           | Acceptable for MVP; admin controls can be added later                                                              |
| A2  | User emails are globally unique across all tenants                                                             | Simplifies user lookup                                                 | Consistent with the spec; no need for tenant-scoped email uniqueness                                               |
| A3  | Password hashing uses bcryptjs (pure JS, Workers-compatible)                                                   | Security of stored passwords                                           | Industry-standard; bcryptjs is specified in the tech spec                                                          |
| A4  | Default column names are configurable per board via `CreateBoardSchema.columnNames`                            | Boards can have custom statuses                                        | Consistent with the spec; no fixed column schema                                                                   |
| A5  | Drag-and-drop uses native HTML5 drag-and-drop or a lightweight library                                         | No heavy dependency on the frontend                                    | Consistent with the "simple, educational" design principle                                                         |
| A6  | Inactive members (`status: 'pending'`, `'declined'`, `'access_revoked'`) have no access to any tenant resource | Owners can manage invitations later                                    | By design; `TenantContextMiddleware` rejects all non-active statuses with 403                                      |
| A7  | Mock payment page for subscription upgrades (no real Stripe integration)                                       | No real billing for MVP                                                | Acceptable for MVP; real billing is an extension point (§10)                                                       |
| A8  | Invitation tokens are UUIDs stored on TenantMember documents                                                   | Token security depends on MongoDB access control                       | Tokens are unique, sparse-indexed; accepted only when email matches authenticated user                             |
| R10 | Cross-tenant endpoints (`GET /tasks/my`, `GET /invitations/my`) bypass `TenantContextMiddleware`               | Must ensure these routes are correctly excluded from tenant middleware | Registered before the tenant-scoped middleware catch-all in `index.ts`; auth-only middleware applied selectively   |
| R11 | Dashboard state detection relies on two parallel API calls (`GET /tenants` + `GET /invitations/my`)            | Extra latency on initial load for authenticated users                  | Calls are made in parallel via `Promise.all()`; non-critical failures (invitations) are gracefully degraded        |
