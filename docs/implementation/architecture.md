# Task Board MVP — Architecture

> **Version:** 2.0.0 **Date:** 2026-07-28 **Status:** Approved **Reference:**
> [Technical Specification v2.0.0](../implementation/technical_specification.md) ·
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
│  │  /sprints                      │                                      │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  Services (business logic):   │                                      │  │
│  │  AuthService, TenantService,  │  ProjectService, BoardService,      │  │
│  │  TaskService, SprintService,  │  RBACService                        │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  Repositories (data access):  │                                      │  │
│  │  TenantRepo, UserRepo,        │  ProjectRepo, BoardRepo,            │  │
│  │  TaskRepo, SprintRepo         │                                      │  │
│  ├────────────────────────────────┼────────────────────────────────────┤  │
│  │  MongoDB (MongoDB Atlas)      │                                      │  │
│  └────────────────────────────────┴────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component boundaries

| Boundary           | Responsibility                                                         | Technology                        |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------- |
| **Client**         | SPA rendering, user interaction, local state, API calls                | Angular 22+ standalone components |
| **Edge (Pages)**   | Static asset serving, SPA routing fallback                             | Cloudflare Pages                  |
| **Edge (Workers)** | API request handling, middleware pipeline, auth, validation            | Hono on Cloudflare Workers        |
| **Data**           | Document storage, tenant-scoped queries, indexes                       | MongoDB Atlas                     |
| **Shared**         | Types, Zod schemas, API contracts — consumed by both client and server | npm workspace package             |

### 1.3 Data flow

1. **User interacts with UI** → Angular component emits an action (e.g., creates a task).
2. **Component calls a service** → `TaskService` in the Angular app builds a typed request using shared Zod-derived
   types.
3. **HTTP interceptor** attaches `Authorization: Bearer <jwt>` and `X-Tenant-Id` headers.
4. **Request reaches Hono Worker** → passes through the middleware pipeline (auth → tenant context → RBAC → validation).
5. **Route handler** delegates to the appropriate service (e.g., `TaskService.createTask()`).
6. **Service** enforces business rules, calls the repository.
7. **Repository** executes a MongoDB query scoped by `tenantId`.
8. **Result** flows back through the service → route handler → middleware → response.
9. **Frontend receives typed response** → updates signal-based store → UI re-renders.

### 1.4 Tenant context flow

```
Frontend:  User selects tenant → TenantService.setActiveTenant(tenantId)
           → HTTP interceptor reads tenantId → attaches X-Tenant-Id header

Backend:   X-Tenant-Id header → TenantContextMiddleware
           → validates user is a TenantMember of that tenant
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
├── shared/                    # Shared npm workspace package
│   ├── src/
│   │   ├── schemas/           # Zod validation schemas (one file per domain)
│   │   ├── types/             # TypeScript types derived from Zod schemas
│   │   ├── contracts/         # API contract definitions (method, path, types)
│   │   ├── constants/         # Enums, default values, shared constants
│   │   ├── validators/        # Reusable Zod validator helpers
│   │   └── index.ts           # Barrel exports
│   ├── package.json
│   └── tsconfig.json
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
│   │   │   ├── dashboard/     # DashboardComponent
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

- **shared:** `schemas/<feature>.ts`, `types/<feature>.ts`, `contracts/<feature>.contracts.ts`
- **server:** `routes/<feature>.ts`, `services/<feature>.service.ts`, `repositories/<feature>.repository.ts`
- **ui:** `feature/<feature>/` directory with components, services, and guards grouped together

This keeps related code co-located and makes vertical slices easy to identify and implement.

---

## 3. Shared Package Design

### 3.1 Purpose

The shared package is the **single source of truth** for types, validation, and API contracts. It is consumed by both
the Angular frontend and the Hono backend, ensuring end-to-end type safety from the database to the UI.

### 3.2 Directory layout

```
shared/src/
├── schemas/
│   ├── auth.ts                # LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema
│   ├── tenant.ts              # CreateTenantSchema, TenantSchema, UpdateTenantSchema, TenantMemberSchema
│   ├── user.ts                # UserSchema, CreateUserSchema
│   ├── project.ts             # CreateProjectSchema, ProjectSchema, UpdateProjectSchema, ProjectMemberSchema
│   ├── board.ts               # CreateBoardSchema, BoardSchema, UpdateBoardSchema, ColumnSchema
│   ├── task.ts                # CreateTaskSchema, TaskSchema, UpdateTaskSchema, MoveTaskSchema, AssignTaskSchema
│   ├── sprint.ts              # CreateSprintSchema, SprintSchema, UpdateSprintSchema
│   └── common.ts              # ErrorResponseSchema, PaginationSchema, PaginatedResponseSchema
├── types/
│   ├── auth.ts                # Type aliases derived from Zod schemas
│   ├── tenant.ts
│   ├── user.ts
│   ├── project.ts
│   ├── board.ts
│   ├── task.ts
│   ├── sprint.ts
│   └── common.ts
├── contracts/
│   ├── auth.contracts.ts
│   ├── tenant.contracts.ts
│   ├── project.contracts.ts
│   ├── board.contracts.ts
│   ├── task.contracts.ts
│   └── sprint.contracts.ts
├── constants/
│   ├── roles.ts               # TenantRole, ProjectRole, TaskPriority, SprintStatus
│   ├── columns.ts             # DefaultColumnNames
│   ├── http.ts                # HttpMethod enum
│   └── paths.ts               # API path constants
├── validators/
│   ├── uuid.ts                # UUID string validator
│   ├── slug.ts                # Slug validator (lowercase, hyphens)
│   └── pagination.ts          # Pagination query validator
└── index.ts                   # Barrel exports for all shared types, schemas, contracts
```

### 3.3 Type derivation pattern (Zod v4)

All TypeScript types are derived from Zod v4 schemas using `z.infer<>` (API unchanged from v3), ensuring types and
validation are always in sync:

```typescript
// shared/src/types/project.ts
import { z } from 'zod';
import { ProjectSchema, CreateProjectSchema, UpdateProjectSchema } from '../schemas/project';

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
```

> **Zod v4 note:** Use `z.interface({...})` instead of `z.object({...})` for all object schemas — it has better
> performance and type inference. The `z.object()` API still works but `z.interface()` is preferred. For frontend
> tree-shaking, import from `"zod/mini"` instead of `"zod"` when only parsing/validation is needed (no full `ZodError`
> details). The backend can use the full `"zod"` bundle without concern.

### 3.4 Contract definitions

API contracts define the method, path, request/response types, and error codes for each endpoint. They serve as the
contract between frontend and backend:

```typescript
// shared/src/contracts/task.contracts.ts
import { HttpMethod } from '../constants';

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

1. **Zod schemas** define runtime validation for all request/response shapes.
2. **TypeScript types** are derived from Zod schemas via `z.infer<>` — no separate type definitions that can drift.
3. **API contracts** reference the same Zod schemas for request bodies and response shapes.
4. **Frontend** imports types and schemas from `shared` — API responses are validated against schemas before use (or
   trusted after server-side validation).
5. **Backend** imports schemas from `shared` for request validation and returns typed results that conform to the same
   schemas.
6. **`tsc --noEmit`** across the monorepo catches any type mismatch between frontend and backend.

### 3.6 Key enums and constants

| Constant             | Values                                                  |
| -------------------- | ------------------------------------------------------- |
| `TenantRole`         | `'owner'`, `'admin'`, `'member'`                        |
| `ProjectRole`        | `'admin'`, `'developer'`, `'viewer'`                    |
| `TaskPriority`       | `'low'`, `'medium'`, `'high'`, `'critical'`             |
| `SprintStatus`       | `'planned'`, `'active'`, `'completed'`                  |
| `DefaultColumnNames` | `['Backlog', 'To Do', 'In Progress', 'Review', 'Done']` |
| `HttpMethod`         | `'GET'`, `'POST'`, `'PATCH'`, `'DELETE'`                |

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

// All other routes require auth + tenant context + RBAC + validation
app.use('/api/v1/*', authMiddleware);
app.use('/api/v1/*', tenantContextMiddleware);
app.use('/api/v1/*', rbacMiddleware);
app.use('/api/v1/*', validationMiddleware);

// Feature routes
app.route('/api/v1/tenants', tenantRoutes);
app.route('/api/v1/projects', projectRoutes);
app.route('/api/v1/boards', boardRoutes);
app.route('/api/v1/columns', columnRoutes);
app.route('/api/v1/tasks', taskRoutes);
app.route('/api/v1/sprints', sprintRoutes);

export default app;
```

### 4.2 Route organization by feature

Each feature has its own route file that defines all endpoints for that domain:

```
server/src/routes/
├── auth.ts            # POST /auth/register, POST /auth/login, GET /auth/me
├── tenants.ts         # CRUD for tenants and tenant members
├── projects.ts        # CRUD for projects and project members
├── boards.ts          # CRUD for boards
├── columns.ts         # CRUD for columns + reorder
├── tasks.ts           # CRUD for tasks + move + assign
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

| Middleware                  | Order      | Responsibility                                                                                                                                                                                             |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ErrorHandler**            | 1 (global) | Catches unhandled errors, returns standardized JSON error responses                                                                                                                                        |
| **AuthMiddleware**          | 2          | Verifies JWT from `Authorization: Bearer <token>` header; sets `c.get('userId')` and `c.get('user')`                                                                                                       |
| **TenantContextMiddleware** | 3          | Resolves active tenant from `X-Tenant-Id` header + user's `TenantMember` record; sets `c.get('tenantId')`. Skipped for auth routes.                                                                        |
| **RBACMiddleware**          | 4          | Checks user's role against required permission for the route. Uses `rbac.service`. Sets `c.get('userRole')`.                                                                                               |
| **ValidationMiddleware**    | 5          | Validates request body, query params, and path params against Zod v4 schemas from shared package. Uses `z.interface().parse()` / `.safeParse()`. Returns 422 with structured validation errors on failure. |
| **RouteHandler**            | 6          | Delegates to the appropriate service method                                                                                                                                                                |

### 4.4 Service layer design

Each service is a **plain TypeScript class** with no framework dependency:

- **First parameter on every method is `tenantId`** — enforces tenant scoping at the service level.
- **Delegates persistence to the repository** — no direct MongoDB driver usage in services.
- **Enforces business rules** — e.g., only project admin can delete a board, only members can create tasks.
- **Returns typed results** that map directly to shared package response schemas.
- **Throws typed errors** that the error handler middleware converts to standardized HTTP responses.

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
    tenantId: string;
    userRole: TenantRole | ProjectRole;
  }
}
```

This allows route handlers to access typed context variables via `c.get('userId')`, `c.get('tenantId')`, etc.

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
│   └── auth.guard.ts
├── tenants/
│   ├── tenant-list.component.ts
│   ├── tenant-detail.component.ts
│   └── tenant-member-list.component.ts
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
├── dashboard/
│   └── dashboard.component.ts
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

**Guards (functional — `CanActivateFn`):**

| Guard          | Protects                                   | Logic                                                           |
| -------------- | ------------------------------------------ | --------------------------------------------------------------- |
| `authGuard`    | All app routes                             | Redirects to `/auth/login` if no authenticated user             |
| `tenantGuard`  | `/tenants/:tenantId/*`                     | Ensures user is a member of the active tenant; redirects if not |
| `projectGuard` | `/tenants/:tenantId/projects/:projectId/*` | Ensures user has a project role; redirects if not               |

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

**`httpResource()` pattern** — for simple typed HTTP GET resources with Zod runtime validation:

```typescript
// Example: fetch a single project by ID
projectResource = httpResource(() => `/api/v1/projects/${this.projectId()}`, {
  defaultValue: null as Project | null,
  parse: (data) => ProjectSchema.parse(data), // Zod v4 runtime validation
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

1. **On login**, the user's `TenantMember` records are fetched and stored in `TenantService`.
2. **User selects an active tenant** via the `<app-tenant-switcher>` dropdown in the header.
3. **`TenantService.setActiveTenant(tenantId)`** updates the `activeTenant` signal.
4. **HTTP interceptor** reads `activeTenant` from `TenantService` and attaches `X-Tenant-Id` header to every outgoing
   request.
5. **Route guards** (`TenantGuard`, `ProjectGuard`) check the active tenant against the user's memberships.
6. **UI conditionally renders** based on the active tenant and the user's roles (e.g., admin-only actions are hidden for
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
  "createdAt": "2026-07-28T08:00:00Z",
  "updatedAt": "2026-07-28T08:00:00Z"
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

### 7.1 Authentication (MVP — mock/simple)

For the MVP, authentication is email/password with JWT. No OAuth, SSO, or refresh token strategy.

**Flow:**

1. **Registration:** `POST /auth/register` — creates a user with hashed password (bcrypt), auto-creates a tenant with
   the user as `owner`, and returns a JWT.
2. **Login:** `POST /auth/login` — verifies credentials against the hashed password, returns a JWT.
3. **JWT payload:**

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

4. **Token expiry:** 24 hours (access token only). Refresh token strategy is out of scope for MVP.
5. **Signing:** HS256 with a secret stored in `JWT_SECRET` environment variable.

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
3. If the user is a member of that tenant, the middleware sets `c.get('tenantId')` on the Hono context.
4. If the user is not a member, the request is rejected with 403.
5. For auth routes (`/auth/register`, `/auth/login`), tenant context is not required.

### 7.3 RBAC enforcement

RBAC is enforced at two layers:

1. **Backend middleware:** `RBACMiddleware` checks the user's role (from JWT `tenantRole` claim) against the required
   permission for the route. The `RBACService` provides the `can()` method that evaluates permissions based on the
   permission matrix in the technical specification.
2. **Frontend UI:** Components conditionally render actions based on the user's role (e.g., delete buttons are hidden
   for `viewer` role, admin-only menus are hidden for `member` role). This is a UX convenience — the backend is the
   source of truth for authorization.

### 7.4 Permission resolution rules (from spec)

1. **Tenant context is mandatory** — every request must carry an active tenant.
2. **Project access is a subset of tenant access** — a user must first be a tenant member, then be granted a project
   role via `ProjectMember`.
3. **Viewer cannot write** — project viewers can read but cannot create, update, or delete any entity.
4. **Ownership overrides** — tenant owners bypass all project-level restrictions.
5. **Tenant isolation is enforced at the data layer** — every query filters by `tenantId`.

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

| Variable      | Description                            | Required |
| ------------- | -------------------------------------- | -------- |
| `MONGODB_URI` | MongoDB Atlas connection string        | Yes      |
| `JWT_SECRET`  | Secret key for HS256 JWT signing       | Yes      |
| `NODE_ENV`    | `development` or `production`          | Yes      |
| `CORS_ORIGIN` | Allowed origin for CORS (frontend URL) | Yes      |
| `PORT`        | Local dev port (default: 8787)         | No       |

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

      - run: npm run test --workspace=shared
      - run: npm run test --workspace=server
      - run: npm run lint --workspace=shared
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
3. **API layer:** The `TenantContextMiddleware` validates that the authenticated user is a member of the tenant
   specified in the `X-Tenant-Id` header. Routes that require tenant context reject requests with 403 if the user is not
   a member.

This three-layer defense ensures that even if one layer is bypassed, the other layers still prevent cross-tenant data
leakage.

### 9.4 Why a shared package for types and schemas?

- **Single source of truth:** Types, validation schemas, and API contracts are defined once in `shared/` and consumed by
  both frontend and backend. This eliminates type drift between client and server.
- **End-to-end type safety:** `z.infer<>` derives TypeScript types from Zod schemas, so the same validation logic that
  runs at runtime also defines the compile-time types.
- **Contract-first API design:** API contracts in `shared/contracts/` define the exact shape of every request and
  response, making it impossible for the frontend and backend to disagree on the API surface.
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
- **Trade-off:** JWTs are not easily revoked. For MVP with 24-hour expiry, this is acceptable. A refresh token strategy
  would be needed for production.

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

| Future Feature                                | Where It Plugs In                                                                                             | What Changes                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Billing / Subscriptions**                   | `server/src/routes/billing.ts`, `shared/schemas/billing.ts`, `shared/contracts/billing.contracts.ts`          | New route file, new Zod schemas, new contracts. New `billing.service.ts` and `billing.repository.ts`. New `subscriptions` MongoDB collection.                                         |
| **SSO / OAuth / SAML**                        | `server/src/middleware/auth.ts` (extend auth middleware), `shared/schemas/auth.ts` (add SSO provider schemas) | Replace or augment JWT auth with OAuth flow. New `auth_providers` and `sso_sessions` collections. New `SSOProviderService`.                                                           |
| **Advanced Analytics / Reporting**            | `server/src/routes/analytics.ts`, `shared/schemas/analytics.ts`                                               | New route file, new schemas, new contracts. New `analytics.service.ts` that reads from existing collections and aggregates data. New `analytics` collection for pre-computed reports. |
| **Time Tracking**                             | `server/src/routes/time-tracking.ts`, `shared/schemas/time-tracking.ts`                                       | New route file, new schemas, new contracts. New `time_entries` MongoDB collection. New `time-tracking.service.ts`.                                                                    |
| **Task Comments / Activity Logs**             | `server/src/routes/comments.ts`, `server/src/routes/activity.ts`, `shared/schemas/comment.ts`                 | New route files, new schemas, new contracts. New `comments` and `activity_logs` collections.                                                                                          |
| **External Integrations (Jira, Slack)**       | `server/src/routes/integrations.ts`, `shared/schemas/integration.ts`                                          | New route file, new schemas, new contracts. New `integrations` collection for storing webhook configs and OAuth tokens. New `integration.service.ts`.                                 |
| **Real-time Updates (WebSocket)**             | `server/src/middleware/websocket.ts`, `ui/src/services/realtime.service.ts`                                   | Add WebSocket support to Hono Workers. New `realtime.service.ts` on the frontend. New `subscriptions` collection for tracking active subscriptions.                                   |
| **Advanced RBAC (custom roles, permissions)** | `shared/schemas/rbac.ts` (extend role/permission schemas), `server/src/services/rbac.service.ts`              | Extend `TenantRole` and `ProjectRole` enums to support custom roles. New `permissions` collection for role-permission mapping. New `permission.service.ts`.                           |
| **Multi-region / Multi-tenant DB**            | `server/src/db/mongo.ts` (connection routing), new `tenant_settings` collection                               | Add `region` field to `Tenant` document. Route database connections based on tenant region. New `tenant_settings` collection for per-tenant DB configuration.                         |

### 10.2 Design principles that enable extensions

1. **Feature-oriented boundaries** — each new feature adds a new set of files in its own directory, without modifying
   existing feature code.
2. **Shared package as contract layer** — new features define their schemas and contracts in `shared/`, ensuring the
   frontend and backend stay in sync.
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
shared contract [`tenantContracts.listMembers`](shared/src/contracts/tenant.contracts.ts:74) already exist.

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
    │   ├── Member table rows (avatar + userId + role)
    │   ├── Invite Member button (owner/admin) → Invite dialog
    │   │   └── Invite Dialog (email input + role select)
    │   ├── Inline role change (NativeSelect, owner/admin)
    │   ├── Remove button (owner/admin) → confirmation dialog
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

## Summary

| Item                              | Detail                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture document**         | `docs/implementation/architecture.md`                                                                                                                                                                                                                             |
| **Reference specification**       | `docs/implementation/technical_specification.md` v2.0.0                                                                                                                                                                                                           |
| **Reference project description** | `docs/project_description.md`                                                                                                                                                                                                                                     |
| **Stack**                         | Angular 22.0.8 (standalone, zoneless, signals, `resource()`, `linkedSignal()`, `httpResource()`, signal forms) + Hono 4.8.0 on Cloudflare Workers + MongoDB Atlas + MongoDB Driver 7.0.0 + TypeScript 6.0.0 + Zod 4.0.0 + Tailwind CSS 4.1.0 + Spartan UI 0.12.0  |
| **Key patterns**                  | Feature-oriented modules, service/repository separation, shared Zod v4 schemas (`z.interface()`, `zod/mini`) for end-to-end type safety, tenant isolation at data + application + API layers, signal-based state on the frontend, functional guards and resolvers |
| **MVP scope**                     | Auth, tenants, projects, boards, columns, tasks, sprints, RBAC — all scoped by tenant                                                                                                                                                                             |

### Risks and Assumptions

| #   | Risk / Assumption                                                                   | Impact                                                     | Mitigation                                                                                                  |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R1  | JWT has no refresh mechanism (24h expiry only)                                      | Users must re-login after 24h                              | Acceptable for MVP; refresh token strategy can be added as an extension                                     |
| R2  | MongoDB Atlas free tier (M0) has limited performance                                | May not handle high load                                   | Upgrade tier before production; indexes ensure efficient queries at MVP scale                               |
| R3  | No real-time updates (WebSocket)                                                    | Users don't see live task updates                          | Polling or manual refresh is sufficient for MVP; WebSocket is an extension point                            |
| R4  | No email verification or password reset                                             | Users may use invalid emails                               | Out of scope for MVP; can be added as an extension                                                          |
| R5  | `X-Tenant-Id` header is the sole tenant context mechanism                           | If header is missing or spoofed, tenant context is invalid | Backend middleware validates tenant membership on every request; tenantId in JWT provides a secondary check |
| R6  | No private npm registry for shared package                                          | Shared package is consumed via npm workspaces only         | Works for monorepo; a private registry would be needed if packages are published separately                 |
| A1  | Tenant creation is self-service (any registered user can create a tenant)           | May lead to orphaned tenants                               | Acceptable for MVP; admin controls can be added later                                                       |
| A2  | User emails are globally unique across all tenants                                  | Simplifies user lookup                                     | Consistent with the spec; no need for tenant-scoped email uniqueness                                        |
| A3  | Password hashing uses bcrypt v6.x (server-side)                                     | Security of stored passwords                               | Industry-standard; bcrypt is specified in the tech spec                                                     |
| A4  | Default column names are configurable per board via `CreateBoardSchema.columnNames` | Boards can have custom statuses                            | Consistent with the spec; no fixed column schema                                                            |
| A5  | Drag-and-drop uses native HTML5 drag-and-drop or a lightweight library              | No heavy dependency on the frontend                        | Consistent with the "simple, educational" design principle                                                  |
