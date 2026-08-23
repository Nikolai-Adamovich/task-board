# Architecture — Task Board

**Status:** Implementation-ready **Date:** 2026-08-21 **Based on:** `technical_specification.md`,
`project-management-requirements.md`, `project-management-user-flows.md` **Existing codebase audit date:** 2026-08-21

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Server Architecture](#2-server-architecture)
3. [Repository Pattern](#3-repository-pattern)
4. [Service Layer](#4-service-layer)
5. [Route Organization](#5-route-organization)
6. [Middleware Stack](#6-middleware-stack)
7. [Zod Schemas](#7-zod-schemas)
8. [Angular Architecture](#8-angular-architecture)
9. [Navigation and Routing](#9-navigation-and-routing)
10. [State Management](#10-state-management)
11. [Component Architecture](#11-component-architecture)
12. [Audit Side-Effect Strategy](#12-audit-side-effect-strategy)
13. [RBAC Enforcement Strategy](#13-rbac-enforcement-strategy)
14. [Existing Codebase: Keep / Modify / Rebuild](#14-existing-codebase-keep--modify--rebuild)
15. [Design Decisions](#15-design-decisions)
16. [Summary](#16-summary)

---

## 1. Project Structure

### 1.1 Monorepo Layout

```text
task-board/
├── shared/                          # @task-board/shared — types & constants
│   ├── src/
│   │   ├── constants/
│   │   │   ├── roles.ts             # TenantRole, ProjectRole, TaskPriority, SprintStatus, etc.
│   │   │   ├── paths.ts             # API_BASE_PATH, ApiPaths
│   │   │   ├── http.ts              # HttpMethod
│   │   │   ├── theme.ts             # DEFAULT_THEME_ID
│   │   │   └── expand-state.ts      # ExpandState
│   │   ├── types/
│   │   │   ├── user.ts
│   │   │   ├── auth.ts
│   │   │   ├── tenant.ts
│   │   │   ├── project.ts
│   │   │   ├── task.ts
│   │   │   ├── sprint.ts
│   │   │   ├── board.ts
│   │   │   ├── status.ts
│   │   │   ├── task-type.ts
│   │   │   ├── label.ts
│   │   │   ├── comment.ts
│   │   │   ├── task-relationship.ts
│   │   │   ├── filter.ts
│   │   │   ├── audit.ts
│   │   │   ├── user-preference.ts
│   │   │   └── common.ts            # PaginatedResponse, ErrorResponse, etc.
│   │   ├── utils/
│   │   │   └── values-of.ts
│   │   └── index.ts                 # Barrel re-exports
│   ├── package.json
│   └── tsconfig.json
│
├── server/                          # Hono on Cloudflare Workers
│   ├── src/
│   │   ├── db/
│   │   │   └── mongo.ts             # connectMongo(), getCollection()
│   │   ├── errors/
│   │   │   └── app-error.ts         # AppError hierarchy with ErrorCode
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT verification (Web Crypto API)
│   │   │   ├── tenant-context.ts    # X-Tenant-Id resolution
│   │   │   ├── rbac.ts              # requireRole(), requirePermission()
│   │   │   ├── validation.ts        # validateBody(), validateQuery()
│   │   │   └── error-handler.ts     # Global error handler
│   │   ├── repositories/            # One per entity (MongoDB collection mapping)
│   │   ├── services/                # Business logic, RBAC enforcement, audit
│   │   ├── routes/                  # Hono route modules
│   │   ├── schemas/                 # Zod request/response schemas
│   │   ├── validators/              # Reusable Zod primitives (uuid, email, etc.)
│   │   ├── types/
│   │   │   └── context.ts           # AppEnv (Bindings + Variables)
│   │   └── index.ts                 # App bootstrap, middleware ordering, route mounting
│   ├── vitest.config.ts
│   ├── wrangler.toml
│   └── package.json
│
└── ui/                              # Angular 22 zoneless
    ├── src/
    │   ├── app/
    │   │   ├── app.ts               # Root component
    │   │   ├── app.config.ts         # Application providers
    │   │   ├── app.routes.ts         # Top-level route definitions
    │   │   ├── app.html
    │   │   ├── api-url.token.ts      # API_BASE_URL injection token
    │   │   ├── constants/            # Frontend-only constants
    │   │   ├── features/             # Feature modules (one folder per feature)
    │   │   ├── guards/               # Functional route guards
    │   │   ├── interceptors/         # Functional HTTP interceptors
    │   │   ├── services/             # HTTP client services
    │   │   ├── shared/               # Shared UI components (Milkdown, pagination, toast)
    │   │   ├── shell/                # App shell, header, sidebar, tenant-switcher
    │   │   ├── stores/               # Signal-based stores (@Service())
    │   │   └── types/                # Frontend-specific types
    │   ├── environments/
    │   ├── public/
    │   │   ├── assets/i18n/          # Transloco translation files
    │   │   └── themes/               # CSS theme files
    │   └── styles.css
    ├── angular.json
    ├── components.json               # Spartan UI component config
    ├── playwright.config.ts
    ├── e2e/                          # Playwright E2E tests
    ├── libs/ui/                      # Spartan UI library wrappers
    └── package.json
```

### 1.2 Package Boundaries

| Package  | Depends on             | Cannot import |
| -------- | ---------------------- | ------------- |
| `shared` | Nothing (runtime-free) | server, ui    |
| `server` | shared                 | ui            |
| `ui`     | shared                 | server        |

The `shared` package is the single source of truth for TypeScript interfaces and constant enums used by both server and
UI. It contains **no** runtime library imports (no Zod, no Angular, no Hono, no RxJS).

---

## 2. Server Architecture

### 2.1 Layer Model

```text
Request
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  Hono App Bootstrap (index.ts)                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Global Middleware                                       ││
│  │  logger → CORS → MongoDB connect → errorHandler         ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Route-Level Middleware                                  ││
│  │  authMiddleware → tenantContextMiddleware → rbac         ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Route Handler                                           ││
│  │  validateBody(schema) → handler logic                    ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Service Layer                                           ││
│  │  Business logic, RBAC enforcement, cross-entity ops      ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Repository Layer                                        ││
│  │  MongoDB collection CRUD, queries, domain mapping        ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│                       MongoDB                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Request Lifecycle

```text
1. Logger middleware logs the request
2. CORS middleware sets headers
3. MongoDB connection ensured
4. Error handler wraps all downstream
5. Auth middleware verifies JWT → sets userId, user
6. Tenant context middleware reads X-Tenant-Id → sets tenantId, tenantRole
7. RBAC middleware checks permission → throws 403 if insufficient
8. Validation middleware parses & validates body/query → sets validatedBody
9. Route handler delegates to service
10. Service executes business logic via repositories
11. Service calls audit service for side effects
12. Response returned through error handler
```

### 2.3 Dependency Injection Approach

The server uses **manual constructor injection** — no DI container. Each route handler creates service instances with
their repository dependencies at request time:

```typescript
// Pattern in route handlers
function createTaskService(): TaskService {
  const collection = getCollection<TaskDocument>('tasks');
  const taskRepo = new TaskRepository(collection);
  const counterService = new CounterService(new CounterRepository(getCollection('counters')));
  // ... other repos
  return new TaskService(taskRepo, counterService, ...);
}
```

This keeps the code explicit and testable. Services accept repository **interfaces** for cross-service dependencies
(e.g., [`TaskServiceUserRepo`](server/src/services/task.service.ts:12)).

---

## 3. Repository Pattern

### 3.1 Contract

Each entity gets **one repository class** that:

1. Accepts a [`Collection<Document>`](server/src/repositories/task.repository.ts:97) in the constructor
2. Defines a **Document interface** (MongoDB shape with `_id` optional)
3. Maps Document → Domain type via a private [`toDomain()`](server/src/repositories/task.repository.ts:70) function
4. Exposes CRUD methods returning **domain types** (from `@task-board/shared`)
5. Handles pagination with a [`PaginatedResult<T>`](server/src/repositories/task.repository.ts:58) wrapper

### 3.2 Repository Inventory

Every entity from the spec has an existing repository. The table below lists each, its MongoDB collection, and unique
indexes.

| Repository                                                                              | Collection           | Unique Index                           |
| --------------------------------------------------------------------------------------- | -------------------- | -------------------------------------- |
| [`UserRepository`](server/src/repositories/user.repository.ts)                          | `users`              | `{ email: 1 }`                         |
| [`TenantRepository`](server/src/repositories/tenant.repository.ts)                      | `tenants`            | —                                      |
| [`TenantMemberRepository`](server/src/repositories/tenant-member.repository.ts)         | `tenant_members`     | `{ tenantId: 1, userId: 1 }`           |
| [`ProjectRepository`](server/src/repositories/project.repository.ts)                    | `projects`           | `{ tenantId: 1, key: 1 }`              |
| [`ProjectMemberRepository`](server/src/repositories/project-member.repository.ts)       | `project_members`    | `{ projectId: 1, userId: 1 }`          |
| [`TaskRepository`](server/src/repositories/task.repository.ts)                          | `tasks`              | `{ id: 1 }` + 8 compound indexes       |
| [`CounterRepository`](server/src/repositories/counter.repository.ts)                    | `counters`           | `{ _id: 1 }`                           |
| [`SprintRepository`](server/src/repositories/sprint.repository.ts)                      | `sprints`            | `{ projectId: 1, status: 1 }`          |
| [`BoardRepository`](server/src/repositories/board.repository.ts)                        | `boards`             | `{ projectId: 1 }`                     |
| [`StatusRepository`](server/src/repositories/status.repository.ts)                      | `statuses`           | `{ projectId: 1, normalizedName: 1 }`  |
| [`TaskTypeRepository`](server/src/repositories/task-type.repository.ts)                 | `task_types`         | `{ projectId: 1, key: 1 }`             |
| [`LabelRepository`](server/src/repositories/label.repository.ts)                        | `labels`             | `{ projectId: 1, normalizedName: 1 }`  |
| [`CommentRepository`](server/src/repositories/comment.repository.ts)                    | `comments`           | `{ taskId: 1, createdAt: 1 }`          |
| [`TaskRelationshipRepository`](server/src/repositories/task-relationship.repository.ts) | `task_relationships` | —                                      |
| [`FilterRepository`](server/src/repositories/filter.repository.ts)                      | `filters`            | `{ userId: 1, projectId: 1, name: 1 }` |
| [`UserPreferencesRepository`](server/src/repositories/user-preferences.repository.ts)   | `user_preferences`   | `{ userId: 1 }`                        |
| [`AuditEventRepository`](server/src/repositories/audit-event.repository.ts)             | `audit_events`       | 3 compound indexes                     |

### 3.3 ID Strategy

All entities use **UUID v4** as the `id` field (stored as a string). MongoDB's native `_id` is auto-generated. The `id`
field is the primary lookup key in all repository methods. The [`uuid()`](server/src/validators/common.ts:9) Zod
validator accepts both UUID v4 and 24-char hex (ObjectId) formats for API flexibility.

### 3.4 Optimistic Concurrency

[`TaskRepository.updateWithVersion()`](server/src/repositories/task.repository.ts) uses an atomic `findOneAndUpdate`
with `{ id, version }` filter, setting `version: version + 1`. If no document matches, the update returns `null`
indicating a conflict.

---

## 4. Service Layer

### 4.1 Responsibilities

Each service:

1. **Validates business rules** (project active, entity belongs to project, date constraints)
2. **Enforces RBAC** via inline role checks or [`rbacService.can()`](server/src/services/rbac.service.ts:100)
3. **Coordinates cross-entity operations** (cascade deletes, seed data, status replacement)
4. **Captures identity snapshots** before writes
5. **Triggers audit logging** as a side effect
6. **Returns domain types** from `@task-board/shared`

### 4.2 Service Inventory

| Service                                                                       | Key Business Logic                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`AuthService`](server/src/services/auth.service.ts)                          | Register, login, JWT generation, current user                             |
| [`TenantService`](server/src/services/tenant.service.ts)                      | CRUD, archive/restore, deletion cascade                                   |
| [`ProjectService`](server/src/services/project.service.ts)                    | CRUD, atomic seed data, archive/restore, key immutability                 |
| [`TaskService`](server/src/services/task.service.ts)                          | CRUD, optimistic concurrency, counter, identity snapshots, cascade delete |
| [`SprintService`](server/src/services/sprint.service.ts)                      | CRUD, status transitions, date auto-fill, backlog migration on delete     |
| [`BoardService`](server/src/services/board.service.ts)                        | CRUD, column validation, default board creation                           |
| [`StatusService`](server/src/services/status.service.ts)                      | CRUD, case-insensitive uniqueness, replacement on delete                  |
| [`TaskTypeService`](server/src/services/task-type.service.ts)                 | CRUD, key immutability, replacement on delete                             |
| [`LabelService`](server/src/services/label.service.ts)                        | CRUD, case-insensitive uniqueness, association cleanup                    |
| [`CommentService`](server/src/services/comment.service.ts)                    | CRUD, author ownership, admin delete-any                                  |
| [`TaskRelationshipService`](server/src/services/task-relationship.service.ts) | Create/delete, same-project validation                                    |
| [`FilterService`](server/src/services/filter.service.ts)                      | CRUD, user/project scoping                                                |
| [`UserPreferencesService`](server/src/services/user-preferences.service.ts)   | User settings, board preference per project                               |
| [`CounterService`](server/src/services/counter.service.ts)                    | Atomic `$inc` for task numbers                                            |
| [`RbacService`](server/src/services/rbac.service.ts)                          | Permission matrix evaluation                                              |
| [`AuditService`](server/src/services/audit.service.ts)                        | Event logging with actor snapshot                                         |
| [`EmailService`](server/src/services/email.service.ts)                        | Invitation emails via Resend                                              |

### 4.3 Cross-Service Dependencies

Services that need data from other entities use **interface contracts** rather than importing concrete repository
classes:

```typescript
// TaskService depends on user lookup without importing UserRepository
export interface TaskServiceUserRepo {
  findById(id: string): Promise<{ id: string; displayName?: string; name?: string; email: string } | null>;
}
```

This keeps services loosely coupled and testable with mocks.

---

## 5. Route Organization

### 5.1 Mounting Structure

```text
app (Hono)
│
├── /api/health                          # No auth
│
├── /api/auth                            # No auth, no tenant context
│   ├── POST /register
│   ├── POST /login
│   └── GET  /me
│
├── /api/tenants                         # Auth only, no tenant context
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:tenantId
│   ├── PATCH  /:tenantId
│   ├── DELETE /:tenantId
│   ├── GET    /:tenantId/members
│   ├── PATCH  /:tenantId/members/:memberId
│   ├── DELETE /:tenantId/members/:memberId
│   ├── POST   /:tenantId/invitations
│   └── DELETE /:tenantId/invitations/:invitationId
│
├── /api/invitations                     # Auth only, cross-tenant
│   ├── GET    /:token
│   ├── POST   /:token/accept
│   └── POST   /:token/decline
│
├── /api                                 # Auth only, no tenant context
│   └── /preferences                     # GET, PATCH (user preferences)
│
├── /api/tasks/my                        # Auth only, cross-tenant
│
└── /api                                 # Auth + tenantContextMiddleware
    │
    ├── /tenants/:tenantId/audit         # Tenant audit
    ├── /tenants/:tenantId/projects      # Project CRUD (nested under tenant)
    │
    ├── /projects/:projectId             # Project detail, update, delete
    ├── /projects/:projectId/members     # Project membership
    ├── /projects/:projectId/tasks       # Task list, create
    ├── /projects/:projectId/sprints     # Sprint list, create
    ├── /projects/:projectId/boards      # Board list, create
    ├── /projects/:projectId/statuses    # Status list, create
    ├── /projects/:projectId/task-types  # Task type list, create
    ├── /projects/:projectId/labels      # Label list, create
    ├── /projects/:projectId/filters     # Filter list, create
    ├── /projects/:projectId/audit       # Project audit
    ├── /projects/:projectId/board-preference  # User board preference
    │
    ├── /tasks/:taskId                   # Task detail, update, delete
    ├── /tasks/:taskId/comments          # Comment list, create
    ├── /tasks/:taskId/relationships     # Relationship list, create
    │
    ├── /sprints/:sprintId               # Sprint update, delete
    ├── /boards/:boardId                 # Board update, delete
    ├── /statuses/:statusId              # Status update, delete
    ├── /task-types/:taskTypeId          # Task type update, delete
    ├── /labels/:labelId                 # Label update, delete
    ├── /comments/:commentId             # Comment update, delete
    ├── /task-relationships/:relId       # Relationship delete
    ├── /filters/:filterId               # Filter update, delete
    └── /preferences                     # Board preference (project-scoped)
```

### 5.2 Route Module Pattern

Each route module is a factory function returning a [`Hono<AppEnv>`](server/src/routes/tasks.ts:27):

```typescript
export function createTaskRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/projects/:projectId/tasks', async (c) => {
    /* ... */
  });
  router.post('/projects/:projectId/tasks', validateBody(CreateTaskSchema), async (c) => {
    /* ... */
  });
  router.get('/tasks/:taskId', async (c) => {
    /* ... */
  });
  router.patch('/tasks/:taskId', validateBody(UpdateTaskSchema), async (c) => {
    /* ... */
  });
  router.delete('/tasks/:taskId', async (c) => {
    /* ... */
  });

  return router;
}
```

### 5.3 API Response Envelope

All list endpoints return:

```json
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
```

All single-resource endpoints return:

```json
{ "data": { ... } }
```

Delete endpoints return `204 No Content`.

---

## 6. Middleware Stack

### 6.1 Global Middleware (applied to all requests)

| Order | Middleware      | File                                                       | Purpose                            |
| ----- | --------------- | ---------------------------------------------------------- | ---------------------------------- |
| 1     | `logger()`      | Hono built-in                                              | Request logging                    |
| 2     | `cors()`        | [index.ts](server/src/index.ts:20)                         | CORS headers, configurable origins |
| 3     | MongoDB connect | [index.ts](server/src/index.ts:33)                         | Ensure DB connection on `/api/*`   |
| 4     | `errorHandler`  | [error-handler.ts](server/src/middleware/error-handler.ts) | Global error → structured JSON     |

### 6.2 Auth Middleware

**File:** [`auth.ts`](server/src/middleware/auth.ts)

- Reads `Authorization: Bearer <token>` header
- Verifies JWT signature using Web Crypto API (HMAC-SHA256) — Cloudflare Workers compatible
- Rejects soft-deleted users (`deletedAt != null`)
- Sets [`c.get('userId')`](server/src/types/context.ts:19) and [`c.get('user')`](server/src/types/context.ts:21)
- Applied to all `/api/*` routes **except** `/api/auth/*`

### 6.3 Tenant Context Middleware

**File:** [`tenant-context.ts`](server/src/middleware/tenant-context.ts)

- Reads `X-Tenant-Id` header
- Queries `tenant_members` collection for active membership
- Rejects `ACCESS_REVOKED` members with 403
- Sets [`c.get('tenantId')`](server/src/types/context.ts:23) and [`c.get('tenantRole')`](server/src/types/context.ts:25)
- Applied **only** to tenant-scoped routes (not auth, invitations, preferences)

### 6.4 RBAC Middleware

**File:** [`rbac.ts`](server/src/middleware/rbac.ts)

Two factories:

1. **[`requireRole(...roles)`](server/src/middleware/rbac.ts:60)** — Legacy tenant-role check. Used in route registry
   for broad tenant membership gating.
2. **[`requirePermission(action, projectLevel?)`](server/src/middleware/rbac.ts:30)** — Permission matrix check via
   [`rbacService.can()`](server/src/services/rbac.service.ts:100). Tenant Owner/Admin bypass project-level restrictions.

### 6.5 Validation Middleware

**File:** [`validation.ts`](server/src/middleware/validation.ts)

- **[`validateBody(schema)`](server/src/middleware/validation.ts:45)** — Parses JSON body, validates against Zod schema,
  sets `validatedBody` on context
- **[`validateQuery(schema)`](server/src/middleware/validation.ts:75)** — Validates query params against Zod schema,
  sets `validatedQuery` on context

### 6.6 Middleware Application Summary

```text
/api/auth/*           → logger, cors, mongo, errorHandler
/api/tenants/*        → logger, cors, mongo, errorHandler, auth
/api/invitations/*    → logger, cors, mongo, errorHandler, auth
/api/preferences      → logger, cors, mongo, errorHandler, auth
/api/tasks/my         → logger, cors, mongo, errorHandler, auth
/api/* (tenant-scoped) → logger, cors, mongo, errorHandler, auth, tenantContext, rbac
```

---

## 7. Zod Schemas

### 7.1 Location and Organization

| Directory                                          | Purpose                             |
| -------------------------------------------------- | ----------------------------------- |
| [`server/src/schemas/`](server/src/schemas/)       | Per-entity request/response schemas |
| [`server/src/validators/`](server/src/validators/) | Reusable Zod primitives             |

### 7.2 Reusable Validators

**File:** [`validators/common.ts`](server/src/validators/common.ts)

| Validator                                                           | Usage                                       |
| ------------------------------------------------------------------- | ------------------------------------------- |
| [`uuid()`](server/src/validators/common.ts:9)                       | Entity ID fields (UUID v4 or 24-char hex)   |
| [`email()`](server/src/validators/common.ts:57)                     | Email with normalization (lowercase + trim) |
| [`nonEmptyString(max, name?)`](server/src/validators/common.ts:37)  | Required text fields                        |
| [`optionalString(max)`](server/src/validators/common.ts:46)         | Optional text fields                        |
| [`nullableOptionalString(max)`](server/src/validators/common.ts:51) | Nullable + optional text                    |
| [`isoDateTime()`](server/src/validators/common.ts:66)               | ISO 8601 date strings                       |
| [`nonNegativeInt()`](server/src/validators/common.ts:76)            | Numeric fields                              |

### 7.3 Schema Inventory

| File                                                                      | Schemas                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`schemas/auth.ts`](server/src/schemas/auth.ts)                           | `RegisterRequestSchema`, `LoginRequestSchema`                    |
| [`schemas/tenant.ts`](server/src/schemas/tenant.ts)                       | `CreateTenantSchema`, `UpdateTenantSchema`                       |
| [`schemas/project.ts`](server/src/schemas/project.ts)                     | `CreateProjectSchema`, `UpdateProjectSchema`                     |
| [`schemas/task.ts`](server/src/schemas/task.ts)                           | `CreateTaskSchema`, `UpdateTaskSchema`, `TaskQuerySchema`        |
| [`schemas/sprint.ts`](server/src/schemas/sprint.ts)                       | `CreateSprintSchema`, `UpdateSprintSchema`                       |
| [`schemas/board.ts`](server/src/schemas/board.ts)                         | `CreateBoardSchema`, `UpdateBoardSchema`                         |
| [`schemas/status.ts`](server/src/schemas/status.ts)                       | `CreateStatusSchema`, `UpdateStatusSchema`, `DeleteStatusSchema` |
| [`schemas/task-type.ts`](server/src/schemas/task-type.ts)                 | `CreateTaskTypeSchema`, `UpdateTaskTypeSchema`                   |
| [`schemas/label.ts`](server/src/schemas/label.ts)                         | `CreateLabelSchema`, `UpdateLabelSchema`                         |
| [`schemas/comment.ts`](server/src/schemas/comment.ts)                     | `CreateCommentSchema`, `UpdateCommentSchema`                     |
| [`schemas/task-relationship.ts`](server/src/schemas/task-relationship.ts) | `CreateTaskRelationshipSchema`                                   |
| [`schemas/filter.ts`](server/src/schemas/filter.ts)                       | `CreateFilterSchema`, `UpdateFilterSchema`                       |
| [`schemas/user.ts`](server/src/schemas/user.ts)                           | User-related schemas                                             |
| [`schemas/user-preferences.ts`](server/src/schemas/user-preferences.ts)   | `UpdatePreferencesSchema`                                        |
| [`schemas/audit.ts`](server/src/schemas/audit.ts)                         | `AuditQuerySchema`                                               |
| [`schemas/common.ts`](server/src/schemas/common.ts)                       | Shared schema fragments                                          |

### 7.4 Relationship to Shared Types

Zod schemas in `server/src/schemas/` **mirror** the TypeScript interfaces in `shared/src/types/`. The Zod schemas handle
**validation and parsing**; the shared types handle **compile-time type safety**. Route handlers cast `validatedBody` to
the shared type after Zod validation:

```typescript
const body = c.get('validatedBody') as CreateTask; // from @task-board/shared
```

---

## 8. Angular Architecture

### 8.1 Angular 22 Patterns

| Pattern                   | Implementation                                                                  |
| ------------------------- | ------------------------------------------------------------------------------- |
| Zoneless change detection | No `zone.js`; all reactivity via `signal()`, `computed()`, `effect()`           |
| Standalone components     | No NgModules; `imports` on `@Component`                                         |
| Lazy loading              | `loadComponent()` in route definitions                                          |
| Component input binding   | `withComponentInputBinding()` in [`app.config.ts`](ui/src/app/app.config.ts:17) |
| Signal-based stores       | [`@Service()`](ui/src/app/stores/auth-store.ts:21) decorator with signals       |
| HTTP interceptors         | Functional via `withInterceptors()`                                             |
| Guards                    | Functional via `canActivate` array                                              |
| i18n                      | Transloco (11 languages)                                                        |
| UI library                | Spartan UI (`@spartan-ng/brain` + `@spartan-ng/helm`)                           |
| CSS                       | Tailwind CSS v4                                                                 |

### 8.2 Application Configuration

**File:** [`app.config.ts`](ui/src/app/app.config.ts:14)

```typescript
provideRouter(routes, withComponentInputBinding()),
provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor])),
provideSpartanHlm(),
provideTransloco({ ... }),
```

### 8.3 Application Bootstrap Flow

```text
1. App loads → AuthStore restores token from localStorage
2. Route navigation → authGuard checks authentication
3. If authenticated → tenantGuard loads tenants, resolves active tenant
4. If tenant-scoped route → projectGuard loads project context
5. HTTP interceptors attach Authorization, X-Tenant-Id headers
6. Error interceptor handles 401 → redirect to login
```

---

## 9. Navigation and Routing

### 9.1 Route Tree

**File:** [`app.routes.ts`](ui/src/app/app.routes.ts:6)

```text
/                                    → Dashboard (handles logged-in/logged-out states)
/auth/login                          → Login (unauthenticated)
/auth/register                       → Register (unauthenticated)
/auth/accept-invitation              → AcceptInvitation (unauthenticated)
/workspace/create                    → CreateWorkspace (authGuard)
/settings                            → Settings (authGuard)
/faq                                 → Faq (public)
/docs                                → Docs (public)
/support                             → Support (public)

/tenants/:tenantId                   → AppShell (authGuard + tenantGuard)
├── /                                → WorkspaceDetail
├── /settings                        → TenantSettings
├── /settings/members                → TenantMemberList
├── /projects                        → ProjectList
└── /projects/:projectId             → (projectGuard)
    ├── /                            → ProjectDetail
    ├── /boards/:boardId             → BoardView
    ├── /tasks                       → TaskTable
    ├── /tasks/:taskId               → TaskDetail
    ├── /sprints                     → SprintList
    ├── /sprints/:sprintId           → SprintDetail
    ├── /members                     → ProjectMemberList
    ├── /settings/statuses           → StatusManager
    ├── /settings/task-types         → TaskTypeManager
    ├── /settings/labels             → LabelManager
    ├── /audit                       → AuditLogViewer
    └── /filters                     → FilterPanel
```

### 9.2 Guards

| Guard                                                | File                      | Logic                                                                |
| ---------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| [`authGuard`](ui/src/app/guards/auth.guard.ts)       | `guards/auth.guard.ts`    | Checks `currentUser` or restores from token via `fetchCurrentUser()` |
| [`tenantGuard`](ui/src/app/guards/tenant.guard.ts)   | `guards/tenant.guard.ts`  | Loads tenants, resolves active tenant from URL param                 |
| [`projectGuard`](ui/src/app/guards/project.guard.ts) | `guards/project.guard.ts` | Loads project context, resolves project role                         |

### 9.3 URL State

Task table state (page, limit, sort, filters) is URL-addressable:

```text
/tenants/:tenantId/projects/:projectId/tasks?page=2&limit=30&sort=createdAt:desc&statusId=abc123
```

The Angular router's query params are the source of truth. The
[`TaskTable`](ui/src/app/features/tasks/task-table/task-table.ts) component reads and writes query params to synchronize
filter/sort/pagination state.

---

## 10. State Management

### 10.1 Store Architecture

The application uses **signal-based stores** decorated with [`@Service()`](ui/src/app/stores/auth-store.ts:21). Each
store is a singleton injectable service that owns a domain slice of state.

### 10.2 Store Inventory

| Store                                              | File                          | State                                                                                 |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| [`AuthStore`](ui/src/app/stores/auth-store.ts)     | `stores/auth-store.ts`        | `currentUser`, `token`, `tenantId`, `tenantRole`, `isAuthenticated`, `needsWorkspace` |
| [`TenantStore`](ui/src/app/stores/tenant-store.ts) | `stores/tenant-store.ts`      | `tenants`, `activeTenant`                                                             |
| `PreferencesStore`                                 | `stores/preferences-store.ts` | User preferences (theme, language, zoom)                                              |

### 10.3 Store Pattern

```typescript
@Service()
export class AuthStore {
  private readonly authClient = inject(AuthClient);
  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null && this.currentUser() !== null);

  async login(credentials: LoginRequest): Promise<void> {
    const res = await firstValueFrom(this.authClient.login(credentials));
    this.setSession(res);
  }
  // ...
}
```

### 10.4 Per-Feature State

Feature-level state (e.g., task list, sprint list, board columns) is managed **locally within components** using
`signal()` and `computed()`. There are no feature-level stores for entities — components call HTTP client services
directly and manage their own loading/error/data signals.

### 10.5 Context Flow

```text
AuthStore.token ──────────────────► authInterceptor → Authorization header
TenantStore.activeTenant ─────────► tenantInterceptor → X-Tenant-Id header
AuthStore.tenantRole ─────────────► UI role-based visibility
ProjectGuard (resolves role) ─────► c.get('projectRole') on server
```

---

## 11. Component Architecture

### 11.1 Feature Module Structure

Each feature follows this folder convention:

```text
features/<feature-name>/
├── <component-name>/
│   ├── <component-name>.ts          # Component class (standalone)
│   ├── <component-name>.html        # Template
│   ├── <component-name>.spec.ts     # Unit test
│   └── <component-name>.css         # (optional, inline styles preferred)
```

### 11.2 Feature Inventory (mapped to spec screens)

| Feature Folder                           | Component           | Spec Screen                   |
| ---------------------------------------- | ------------------- | ----------------------------- |
| `features/auth/login/`                   | `Login`             | Login Screen                  |
| `features/auth/register/`                | `Register`          | Registration Screen           |
| `features/auth/accept-invitation/`       | `AcceptInvitation`  | Accept Invitation             |
| `features/dashboard/`                    | `Dashboard`         | Landing Page / Dashboard      |
| `features/dashboard/landing-page/`       | `LandingPage`       | Landing Page (logged out)     |
| `features/dashboard/welcome-view/`       | `WelcomeView`       | Dashboard (no tenant)         |
| `features/dashboard/owner-dashboard/`    | `OwnerDashboard`    | Tenant Dashboard              |
| `features/dashboard/member-dashboard/`   | `MemberDashboard`   | Member Dashboard              |
| `features/dashboard/invitation-view/`    | `InvitationView`    | Invitation acceptance         |
| `features/tenants/create-workspace/`     | `CreateWorkspace`   | Create Workspace / Onboarding |
| `features/tenants/workspace-detail/`     | `WorkspaceDetail`   | Tenant Dashboard              |
| `features/tenants/tenant-settings/`      | `TenantSettings`    | Tenant Settings               |
| `features/tenants/tenant-member-list/`   | `TenantMemberList`  | Tenant Members                |
| `features/projects/project-list/`        | `ProjectList`       | Project List                  |
| `features/projects/project-detail/`      | `ProjectDetail`     | Project Overview              |
| `features/projects/project-member-list/` | `ProjectMemberList` | Project Members               |
| `features/boards/board-view/`            | `BoardView`         | Board View                    |
| `features/boards/task-card/`             | `TaskCard`          | (Board task card)             |
| `features/tasks/task-table/`             | `TaskTable`         | Task Table                    |
| `features/tasks/task-detail/`            | `TaskDetail`        | Task Detail                   |
| `features/tasks/task-relationships/`     | `TaskRelationships` | Task Relationships            |
| `features/sprints/sprint-list/`          | `SprintList`        | Sprint List                   |
| `features/sprints/sprint-detail/`        | `SprintDetail`      | Sprint Detail                 |
| `features/sprints/sprint-backlog/`       | `SprintBacklog`     | Sprint Backlog                |
| `features/statuses/status-manager/`      | `StatusManager`     | Status Manager                |
| `features/task-types/task-type-manager/` | `TaskTypeManager`   | Task Type Manager             |
| `features/labels/label-manager/`         | `LabelManager`      | Label Manager                 |
| `features/filters/filter-panel/`         | `FilterPanel`       | Filter Panel                  |
| `features/audit/audit-log-viewer/`       | `AuditLogViewer`    | Audit Log                     |
| `features/comments/comment-thread/`      | `CommentThread`     | Comment Thread                |
| `features/settings/`                     | `Settings`          | User Settings                 |
| `features/help/faq/`                     | `Faq`               | FAQ                           |
| `features/help/docs/`                    | `Docs`              | Documentation                 |
| `features/help/support/`                 | `Support`           | Support                       |

### 11.3 Shell Components

| Component          | File                              | Purpose                                      |
| ------------------ | --------------------------------- | -------------------------------------------- |
| `AppShell`         | `shell/app-shell/`                | Main layout wrapper for tenant-scoped routes |
| `Header`           | `shell/header/`                   | Top navigation bar                           |
| `Sidebar`          | `shell/sidebar/`                  | Project navigation sidebar                   |
| `TenantSwitcher`   | `shell/tenant-switcher/`          | Tenant selection dropdown                    |
| `HeaderActions`    | `shell/header/header-actions/`    | Action buttons                               |
| `HeaderBranding`   | `shell/header/header-branding/`   | Logo/brand                                   |
| `HeaderSearch`     | `shell/header/header-search/`     | Global search                                |
| `UserMenu`         | `shell/header/user-menu/`         | User profile menu                            |
| `LanguageSwitcher` | `shell/header/language-switcher/` | i18n language selector                       |
| `HelpMenu`         | `shell/header/help-menu/`         | Help links                                   |

### 11.4 Shared Components

| Component        | File                      | Purpose                            |
| ---------------- | ------------------------- | ---------------------------------- |
| `MilkdownEditor` | `shared/milkdown-editor/` | WYSIWYG Markdown editor (Milkdown) |
| `Pagination`     | `shared/pagination/`      | Page navigation controls           |
| `ToastContainer` | `shared/toast-container/` | Notification toasts                |

### 11.5 Spartan UI Integration

Spartan UI components are configured via [`components.json`](ui/components.json) and wrapped in
[`libs/ui/`](ui/libs/ui/). Existing wrappers:

| Wrapper | Path               |
| ------- | ------------------ |
| Avatar  | `libs/ui/avatar/`  |
| Field   | `libs/ui/field/`   |
| Input   | `libs/ui/input/`   |
| Spinner | `libs/ui/spinner/` |

Additional Spartan components should be added via `npx spartan-ng add <component>` and wrapped in `libs/ui/`.

### 11.6 HTTP Client Services

Each entity has a dedicated HTTP client service under [`ui/src/app/services/`](ui/src/app/services/):

| Service                  | File                                   | Endpoints              |
| ------------------------ | -------------------------------------- | ---------------------- |
| `AuthClient`             | `services/auth-client.ts`              | register, login, me    |
| `TenantClient`           | `services/tenant-client.ts`            | CRUD, archive, members |
| `ProjectClient`          | `services/project-client.ts`           | CRUD, members          |
| `TaskClient`             | `services/task-client.ts`              | CRUD, search, filters  |
| `SprintClient`           | `services/sprint-client.ts`            | CRUD, status change    |
| `BoardClient`            | `services/board-client.ts`             | CRUD                   |
| `StatusClient`           | `services/status-client.ts`            | CRUD                   |
| `TaskTypeClient`         | `services/task-type-client.ts`         | CRUD                   |
| `LabelClient`            | `services/label-client.ts`             | CRUD                   |
| `CommentClient`          | `services/comment-client.ts`           | CRUD                   |
| `TaskRelationshipClient` | `services/task-relationship-client.ts` | Create, delete         |
| `FilterClient`           | `services/filter-client.ts`            | CRUD                   |
| `AuditClient`            | `services/audit-client.ts`             | Query events           |
| `UserPreferencesClient`  | `services/user-preferences-client.ts`  | Get/update prefs       |
| `NotificationService`    | `services/notification.service.ts`     | Toast notifications    |
| `SupportClient`          | `services/support-client.ts`           | Support requests       |

---

## 12. Audit Side-Effect Strategy

### 12.1 Approach

Audit events are written as **side effects** within service methods, not as a separate concern. Each service that
mutates auditable entities calls [`AuditService.log()`](server/src/services/audit.service.ts:21) after a successful
write.

### 12.2 Auditable Entities and Actions

| Entity            | Actions                   | Service Method                                                             |
| ----------------- | ------------------------- | -------------------------------------------------------------------------- |
| Task              | CREATED, UPDATED, DELETED | `TaskService.createTask()`, `updateTask()`, `deleteTask()`                 |
| Project           | CREATED, UPDATED, DELETED | `ProjectService.createProject()`, `updateProject()`, `deleteProject()`     |
| Sprint            | CREATED, UPDATED, DELETED | `SprintService.createSprint()`, `updateSprint()`, `deleteSprint()`         |
| Status            | CREATED, UPDATED, DELETED | `StatusService.createStatus()`, `updateStatus()`, `deleteStatus()`         |
| Board             | CREATED, UPDATED, DELETED | `BoardService.createBoard()`, `updateBoard()`, `deleteBoard()`             |
| Label             | CREATED, UPDATED, DELETED | `LabelService.createLabel()`, `updateLabel()`, `deleteLabel()`             |
| Task Type         | CREATED, UPDATED, DELETED | `TaskTypeService.createTaskType()`, `updateTaskType()`, `deleteTaskType()` |
| Comment           | CREATED, UPDATED, DELETED | `CommentService.createComment()`, `updateComment()`, `deleteComment()`     |
| Task Relationship | CREATED, DELETED          | `TaskRelationshipService.create()`, `delete()`                             |

### 12.3 Audit Event Structure

```typescript
await auditService.log({
  tenantId,
  projectId,
  entityType: 'TASK',
  entityId: task.id,
  action: 'UPDATED',
  actorId: userId,
  changes: [{ field: 'statusId', oldValue: oldStatus, newValue: newStatus }],
});
```

The [`AuditService`](server/src/services/audit.service.ts:12) captures the actor's `displayName` at write time via
[`captureActor()`](server/src/services/audit.service.ts:51), ensuring historical identity preservation.

### 12.4 Audit Scope

- **Project-scoped events**: Stored with `projectId`, queryable via `GET /projects/:projectId/audit`
- **Tenant-scoped events**: Stored with `tenantId`, queryable via `GET /tenants/:tenantId/audit`
- **Permanent project deletion**: Removes project-specific audit records
- **Permanent tenant deletion**: Removes tenant audit records

---

## 13. RBAC Enforcement Strategy

### 13.1 Two-Tier Model

```text
Tenant Role (Owner > Admin > Member)
    ↓
Project Role (Project Admin > Editor > Viewer)
```

Tenant Owner and Admin have **implicit project access** — they bypass project-level role checks.

### 13.2 Permission Matrix

**File:** [`rbac.service.ts`](server/src/services/rbac.service.ts:42)

```typescript
// Tenant-level permissions
const tenantPermissions = {
  manage_tenant: [OWNER, ADMIN],
  create_project: [OWNER, ADMIN],
};

// Project-level permissions (Owner/Admin bypass all)
const projectPermissions = {
  manage_project: [PROJECT_ADMIN],
  manage_project_members: [PROJECT_ADMIN],
  create_sprint: [PROJECT_ADMIN],
  change_sprint_status: [PROJECT_ADMIN],
  edit_project_config: [PROJECT_ADMIN],
  create_task: [PROJECT_ADMIN, EDITOR],
  edit_task: [PROJECT_ADMIN, EDITOR],
  delete_task: [PROJECT_ADMIN],
  view_task: [PROJECT_ADMIN, EDITOR, VIEWER],
  manage_labels: [PROJECT_ADMIN, EDITOR],
  manage_statuses: [PROJECT_ADMIN],
  manage_boards: [PROJECT_ADMIN],
  create_comment: [PROJECT_ADMIN, EDITOR],
  edit_comment: [PROJECT_ADMIN, EDITOR],
  delete_comment: [PROJECT_ADMIN, EDITOR],
  view_comment: [PROJECT_ADMIN, EDITOR, VIEWER],
  manage_task_relationships: [PROJECT_ADMIN, EDITOR],
  manage_filters: [PROJECT_ADMIN, EDITOR, VIEWER],
  view_audit_events: [PROJECT_ADMIN],
};
```

### 13.3 Enforcement Points

| Layer              | Mechanism                                                                    | Example                     |
| ------------------ | ---------------------------------------------------------------------------- | --------------------------- |
| Route (middleware) | [`requirePermission('create_task', true)`](server/src/middleware/rbac.ts:30) | Gates entire endpoint       |
| Service (inline)   | `this.requireEditorOrAbove(userRole, projectRole)`                           | Business-logic-level checks |
| UI (visibility)    | `*ngIf` / `@if` based on role from AuthStore                                 | Hide/disable write controls |

### 13.4 Special RBAC Rules

| Rule                                            | Implementation                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Viewer is strictly read-only                    | `view_*` permissions only                                                                     |
| Editor can create/edit but not delete tasks     | `create_task`, `edit_task` but not `delete_task`                                              |
| Only comment author can edit/delete own comment | Service-level check in [`CommentService`](server/src/services/comment.service.ts)             |
| Project Admin can delete any comment            | Service-level override in `CommentService`                                                    |
| Tenant Owner/Admin bypass project RBAC          | [`rbacService.can()`](server/src/services/rbac.service.ts:100) returns `true` for Owner/Admin |

---

## 14. Existing Codebase: Keep / Modify / Rebuild

### 14.1 Server — Keep (with modifications)

| Component                                                                 | Status     | Action Required                                                                       |
| ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| [`index.ts`](server/src/index.ts) bootstrap                               | **Keep**   | Already correct middleware ordering and route mounting                                |
| [`middleware/auth.ts`](server/src/middleware/auth.ts)                     | **Keep**   | Web Crypto JWT, soft-delete rejection — matches spec                                  |
| [`middleware/tenant-context.ts`](server/src/middleware/tenant-context.ts) | **Keep**   | X-Tenant-Id resolution, ACCESS_REVOKED rejection                                      |
| [`middleware/rbac.ts`](server/src/middleware/rbac.ts)                     | **Keep**   | Both `requireRole` and `requirePermission` present                                    |
| [`middleware/validation.ts`](server/src/middleware/validation.ts)         | **Keep**   | Zod v4 compatible, body + query validation                                            |
| [`middleware/error-handler.ts`](server/src/middleware/error-handler.ts)   | **Keep**   | Structured error model matches spec                                                   |
| [`errors/app-error.ts`](server/src/errors/app-error.ts)                   | **Modify** | Add missing error codes: `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`, `STATUS_IN_USE` |
| [`types/context.ts`](server/src/types/context.ts)                         | **Keep**   | AppEnv with all required context variables                                            |
| [`db/mongo.ts`](server/src/db/mongo.ts)                                   | **Keep**   | Connection management                                                                 |

### 14.2 Server Repositories — Keep (all present)

All 17 repositories exist and follow the correct pattern. No new repositories needed.

**Modifications needed:**

- [`TaskRepository`](server/src/repositories/task.repository.ts) — Verify `search()` method covers task number format
  (e.g., `PROJ-123`)
- [`StatusRepository`](server/src/repositories/status.repository.ts) — Verify `normalizedName` uniqueness enforcement
- [`BoardRepository`](server/src/repositories/board.repository.ts) — Add method for updating column status references
  when a status is deleted with replacement

### 14.3 Server Services — Keep (with modifications)

All services exist. Key modifications:

| Service                                                       | Modification                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`ProjectService`](server/src/services/project.service.ts)    | Ensure atomic seed data uses MongoDB transaction; add `PROJECT_KEY_IMMUTABLE` check          |
| [`TaskService`](server/src/services/task.service.ts)          | Add audit side effects for create/update/delete                                              |
| [`SprintService`](server/src/services/sprint.service.ts)      | Verify date auto-fill on start/complete; add audit side effects                              |
| [`StatusService`](server/src/services/status.service.ts)      | Add `STATUS_IN_USE` error code; implement replacement logic for both tasks AND board columns |
| [`TaskTypeService`](server/src/services/task-type.service.ts) | Add `TASK_TYPE_IN_USE` error code; implement replacement logic                               |
| [`CommentService`](server/src/services/comment.service.ts)    | Add audit side effects; implement admin delete-any-comment                                   |
| [`TenantService`](server/src/services/tenant.service.ts)      | Verify archive/restore cascade respects `archiveReason`                                      |
| [`AuditService`](server/src/services/audit.service.ts)        | **Keep as-is** — already correct                                                             |
| [`RbacService`](server/src/services/rbac.service.ts)          | **Keep as-is** — permission matrix matches spec                                              |

### 14.4 Server Routes — Keep (all present)

All route modules exist and follow the correct pattern. No new routes needed.

**Modifications needed:**

- Verify all routes use `validateBody()` / `validateQuery()` middleware
- Ensure `projectRole` is set on context for project-scoped routes before RBAC checks
- Add missing `requirePermission()` calls where routes currently only use `requireRole()`

### 14.5 Server Schemas — Modify

| Schema                                                    | Modification                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| [`schemas/status.ts`](server/src/schemas/status.ts)       | Add `DeleteStatusSchema` with `replacementStatusId`                |
| [`schemas/task-type.ts`](server/src/schemas/task-type.ts) | Add delete schema with optional `replacementTypeId`                |
| [`schemas/project.ts`](server/src/schemas/project.ts)     | Add `ProjectKeySchema` (2-10 chars, starts with letter, A-Z + 0-9) |
| [`schemas/tenant.ts`](server/src/schemas/tenant.ts)       | Add `SendInvitationSchema`                                         |

### 14.6 Shared Package — Keep (with additions)

All types and constants are present and match the spec.

**Additions needed:**

- Add `PROJECT_KEY_IMMUTABLE`, `TASK_TYPE_IN_USE`, `STATUS_IN_USE` to error code types in
  [`shared/src/types/common.ts`](shared/src/types/common.ts)

### 14.7 Angular — Keep (with modifications)

| Component                                                                             | Status     | Action Required                                       |
| ------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| [`app.config.ts`](ui/src/app/app.config.ts)                                           | **Keep**   | Correct providers, interceptors, Transloco            |
| [`app.routes.ts`](ui/src/app/app.routes.ts)                                           | **Keep**   | All spec screens have routes                          |
| [`stores/auth-store.ts`](ui/src/app/stores/auth-store.ts)                             | **Keep**   | JWT management, session, tenant context               |
| [`stores/tenant-store.ts`](ui/src/app/stores/tenant-store.ts)                         | **Keep**   | Tenant CRUD, active tenant management                 |
| `stores/preferences-store.ts`                                                         | **Keep**   | Theme/language/zoom                                   |
| [`guards/auth.guard.ts`](ui/src/app/guards/auth.guard.ts)                             | **Keep**   | Race condition handling correct                       |
| `guards/tenant.guard.ts`                                                              | **Keep**   | Tenant resolution                                     |
| `guards/project.guard.ts`                                                             | **Keep**   | Project resolution                                    |
| [`interceptors/auth.interceptor.ts`](ui/src/app/interceptors/auth.interceptor.ts)     | **Keep**   | Bearer token attachment                               |
| [`interceptors/tenant.interceptor.ts`](ui/src/app/interceptors/tenant.interceptor.ts) | **Keep**   | X-Tenant-Id header                                    |
| [`interceptors/error.interceptor.ts`](ui/src/app/interceptors/error.interceptor.ts)   | **Modify** | Add all spec error codes to `ERROR_CODE_MESSAGES` map |
| All feature components                                                                | **Keep**   | Structure matches spec screens                        |
| All HTTP client services                                                              | **Keep**   | Correct API path usage                                |

### 14.8 E2E Tests — Modify

Existing Playwright tests in [`ui/e2e/`](ui/e2e/) cover auth, board, project, sprint, and task flows. These should be
expanded to cover:

- Invitation flow (accept, decline, revoke)
- Status deletion with replacement
- Task type deletion with replacement
- Tenant archive/restore cascade
- Optimistic concurrency conflict UI
- Role-based UI visibility (Viewer sees no write controls)

---

## 15. Design Decisions

### 15.1 DD-001: Manual DI over Container

**Decision:** Use manual constructor injection in route handlers instead of a DI container.

**Rationale:** Cloudflare Workers have fast cold starts. A DI container adds complexity without meaningful benefit for
~20 services. The explicit wiring in route handlers makes dependencies visible and debuggable.

### 15.2 DD-002: UUID v4 over MongoDB ObjectId

**Decision:** Use UUID v4 strings as entity IDs in the API and application layer. MongoDB's `_id` is auto-generated
separately.

**Rationale:** UUIDs are generated client-side or server-side without coordination. They're portable across databases
and don't leak insertion order. The `id` field is indexed and used for all lookups.

### 15.3 DD-003: Signal Stores over NgRx/Akita

**Decision:** Use Angular 22 `@Service()` decorator with `signal()` / `computed()` for state management.

**Rationale:** The application has relatively simple state requirements (auth, tenant, preferences). Signals provide
fine-grained reactivity without the boilerplate of a full state management library. Feature-level state stays local to
components.

### 15.4 DD-004: Flat Route Modules over Nested Resource Router

**Decision:** Each route module defines full paths (e.g., `/projects/:projectId/tasks`) and is mounted at `/` within a
tenant-scoped sub-app.

**Rationale:** Hono's router doesn't support deeply nested resource mounting as elegantly as Express. Flat modules are
easier to test in isolation and avoid double-nesting bugs. The tenant-scoped sub-app handles the shared
`tenantContextMiddleware` application.

### 15.5 DD-005: Audit as Service Side-Effect

**Decision:** Audit logging happens inside service methods, not as a separate middleware or event system.

**Rationale:** Audit requires access to the old and new entity state, the actor identity, and the change diff. This
information is only available within the service method. A middleware approach would require complex state passing. The
side-effect approach is explicit, testable, and doesn't require an event bus.

### 15.6 DD-006: Identity Snapshots over Live References

**Decision:** Store `displayName` snapshots alongside `userId` references on Tasks, Comments, and Audit Events.

**Rationale:** When a user is deleted, their `userId` becomes a dangling reference. Snapshots preserve human-readable
identity in historical records without requiring a "deleted user" placeholder entity. This matches the spec's
"historical identity preservation" requirement.

### 15.7 DD-007: Zod for Server Validation Only

**Decision:** Zod schemas live in `server/src/schemas/`. The `shared` package contains only TypeScript interfaces (no
Zod).

**Rationale:** The `shared` package must be runtime-free. Zod is a server-side concern. The shared types provide
compile-time safety; Zod provides runtime validation. They mirror each other but are maintained separately.

### 15.8 DD-008: Spartan UI over Material/PrimeNG

**Decision:** Use Spartan UI (`@spartan-ng/brain` + `@spartan-ng/helm`) with Tailwind CSS.

**Rationale:** Spartan provides headless primitives (Brain) with styled defaults (Helm) that integrate naturally with
Tailwind. This avoids the theming conflicts and bundle bloat of opinionated UI libraries like Angular Material.
Components are composable and style-customizable.

### 15.9 DD-009: Web Crypto JWT over jsonwebtoken

**Decision:** Implement JWT verification using the Web Crypto API in [`auth.ts`](server/src/middleware/auth.ts:26).

**Rationale:** Cloudflare Workers don't support Node.js `crypto` module. The Web Crypto API is available globally in
Workers and provides HMAC-SHA256 verification. This avoids polyfills and keeps the bundle small.

### 15.10 DD-010: Backlog as sprintId=null

**Decision:** No separate Backlog entity. Tasks with `sprintId = null` are backlog tasks.

**Rationale:** This is a spec requirement. It avoids an unnecessary entity and keeps the data model simple. Sprint
assignment is just setting `sprintId`; removing from sprint is setting it back to `null`.

---

## 16. Summary

### Architecture File

[`docs/implementation/architecture.md`](docs/implementation/architecture.md)

### Existing Codebase Assessment

The existing codebase is **substantially complete** and architecturally sound. The monorepo structure, layer separation,
middleware stack, repository pattern, service layer, route organization, Angular architecture, and state management all
align with the technical specification.

**What to keep:** ~90% of the existing code. All repositories, most services, all routes, all Angular components,
stores, guards, interceptors, and the shell structure.

**What to modify:** Error codes (add missing), Zod schemas (add delete schemas), audit side effects (add to services
that lack them), RBAC enforcement (add `requirePermission()` where only `requireRole()` exists), search coverage (task
number format).

**What to rebuild:** Nothing. No component requires a full rebuild.

### Risks

| Risk                                                                               | Impact                                         | Mitigation                                                                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| MongoDB transactions may not be available on all Cloudflare Workers MongoDB setups | Project creation seed data may not be atomic   | Implement as sequential operations with rollback-on-error; document transaction requirement                             |
| Optimistic concurrency `findOneAndUpdate` race window                              | Extremely rare double-update                   | MongoDB atomic operations minimize window; version check is on the query filter                                         |
| Milkdown WYSIWYG integration complexity                                            | Task description editing may have edge cases   | Isolate Milkdown in [`shared/milkdown-editor/`](ui/src/app/shared/milkdown-editor/) component; test Markdown round-trip |
| Transloco missing keys for new features                                            | UI shows raw keys                              | Use `missingHandler.useFallbackTranslation: true` (already configured)                                                  |
| Spartan UI component coverage                                                      | May need additional components not yet wrapped | Add via `npx spartan-ng add <component>` as needed                                                                      |
| Invitation email delivery in Workers                                               | Resend API may have latency                    | Email sending is fire-and-forget; invitation creation succeeds regardless                                               |

### Assumptions

| ID    | Assumption                              | Source             |
| ----- | --------------------------------------- | ------------------ |
| A-001 | Password minimum length is 8 characters | Technical Spec §21 |
| A-006 | Invitation TTL is 7 days                | Technical Spec §21 |
| A-007 | Deletion grace period is 30 days        | Technical Spec §21 |
| A-009 | JWT token expiration is 24 hours        | Technical Spec §21 |
| A-010 | Default task sort is `number:desc`      | Technical Spec §21 |
