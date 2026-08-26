# Architecture — Task Board

> Consolidated architecture reference (post-refactoring state). Entry point: [`AGENTS.md`](../AGENTS.md).

## 1. Monorepo layout

| Workspace | Purpose                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `shared/` | `@task-board/shared` — types, const enums (`valuesOf`), constants. Runtime-library-free; single source of truth for server + UI |
| `server/` | Hono API on Cloudflare Workers (`nodejs_compat`)                                                                                |
| `ui/`     | Angular 22 SPA (zoneless), Spartan UI + Tailwind v4, Transloco i18n                                                             |

Package boundaries: `server` and `ui` import only from `@task-board/shared`, never from each other. Shared stays
runtime-library-free (no Zod/Angular/Hono imports).

## 2. Server architecture

### 2.1 Request lifecycle (order matters)

```
logger → CORS (memoized per config) → [per-request MongoClient via runWithDb(AsyncLocalStorage)]
→ provideServices (builds service graph into c.set('svc')) → onError(errorHandler)
→ /api/auth (no tenant ctx) → authMiddleware (hono/jwt verify) → /api/tenants, invitations,
preferences, tasks/my (auth only) → tenantScoped sub-app: tenantContextMiddleware → RBAC → routes
```

### 2.2 DI composition root

- [`container.ts`](../server/src/container.ts) — pure `buildServices(env)` constructing the full repository/service
  graph **once per request**.
- [`middleware/services.ts`](../server/src/middleware/services.ts) — `provideServices` middleware exposes it as typed
  `c.get('svc')` (Hono `Variables`).
- **Must NOT memoize at module level**: repositories capture `Collection` objects bound to the per-request
  `MongoClient`; Workers reuse isolates across requests → stale sockets.
- Services declare narrow constructor interfaces for cross-aggregate deps (e.g. `TaskServiceUserRepo`) — keeps them
  unit-testable without casts.

### 2.3 Layers

```
routes/ (thin HTTP handlers: validate → svc call → envelope)
services/ (business logic, authorization via rbac, audit side effects)
repositories/ (Mongo queries; extend BaseRepository<TDoc, TDomain>)
schemas/ (Zod v4 request schemas; uuid/nonEmptyString validators in validators/)
middleware/ (auth, tenant-context, rbac, validation wrapper, services, error-handler)
errors/app-error.ts (AppError hierarchy; codes typed by shared ErrorCode)
```

### 2.4 Validation & error model

- Bodies: `zValidator('json', Schema)` → `c.req.valid('json')` is fully typed. Failure → `ValidationError` →
  `400 { error: { code: 'VALIDATION_ERROR', details } }`. Malformed JSON is normalized to the same contract in
  `error-handler.ts`.
- Envelope: `{ data }` on success; `{ error: { code, message, details? } }` on failure.
- Codes: `ErrorCode` union in `shared/types/common.ts` (single source of truth).

### 2.5 AuthN / AuthZ

- JWT HS256 via `hono/jwt` (`sign` in AuthService, `verify` in authMiddleware). Claims:
  `sub, email, displayName, tenantId, tenantRole, exp` (24 h). Invitation tokens stored as WebCrypto SHA-256 hashes.
- Coarse checks: `middleware/rbac.ts` (`requireRole`, `requirePermission`) on route groups.
- Fine-grained: `ensurePermission(action, tenantRole, projectRole)` from `rbac.service.ts` inside domain services.
  Permission matrices live only there.

### 2.6 Route mounting

Full paths are defined in route modules (e.g. `/tasks/:taskId`), so modules mount at `/` of the tenant-scoped sub-app to
avoid double nesting. Cross-tenant routes (`/api/tasks/my`, `/api/invitations`, `/api/preferences`) mount outside the
tenant sub-app.

## 3. Data model (summary)

Entities: User, Tenant, TenantMember (with embedded invitation), Project, ProjectMember, Task (KEY-NUMBER business id
via counters; identity snapshots for reporter/assignee), Status, TaskType, Board (+columns), Sprint, Label, Comment,
TaskRelationship, Filter, AuditEvent, Counter, UserPreferences (project-scoped) + UserSettings (global:
zoom/theme/language/pageSize).

- IDs: UUID v4 (`randomUUID`); tasks additionally carry `projectId + number` (e.g. `PROJ-42`), resolvable by either UUID
  or `KEY-NUMBER`.
- Optimistic concurrency: tasks carry `version`; updates require matching version → `409 TASK_VERSION_CONFLICT`.
- Soft delete: users (`deletedAt`), tenants/projects (status + `deletionScheduledAt`, archive/restore lifecycle).
  Cascades handled in services (not DB-level).
- Indexes are documented at the top of each repository file.

### 3.1 Persistence & transactions (DEC-025)

- **Replica set required:** MongoDB must run as a replica set in every environment — local dev uses the root
  [`docker-compose.yml`](../docker-compose.yml) (`mongod --replSet rs0` + `rs.initiate()` healthcheck), production uses
  Atlas Free (replica set out of the box). Multi-document transactions behave identically everywhere.
- **Atomic project seed (BR-003):** `ProjectService.createProject` wraps project insert + statuses + task types +
  default board + creator membership + default-reference updates in a transaction via
  [`withTransaction()`](../server/src/db/mongo.ts) on the request-scoped client. Abort ⇒ nothing visible.
- **Fallback:** if the topology does not support transactions (standalone `mongod`), the service logs a warning and
  falls back to ordered inserts with compensating cleanup so local dev without Docker compose still works. The fallback
  is not the primary mechanism and leaves a small visibility window during cleanup.

## 4. RBAC

Tenant roles: `OWNER > ADMIN > MEMBER` (+ invited pending). Project roles: `PROJECT_ADMIN > EDITOR > VIEWER`. Tenant
Owner/Admin bypass project-level restrictions. Permission matrices (action → roles) live only in
[`rbac.service.ts`](../server/src/services/rbac.service.ts); route groups use
`requireRole(...)`/`requirePermission('create_project')`.

## 5. UI architecture

### 5.1 Bootstrap & routing

Zoneless, standalone components, `withComponentInputBinding()` — route **and query** params bind to `input()` signals
automatically. Lazy `loadComponent` everywhere. Route tree: `auth/*` (public) → root dashboard (resolves all auth
states) → `tenants/:tenantId` shell (authGuard + tenantGuard) → project subtree (projectGuard) with
boards/tasks/sprints/members/settings/audit.

### 5.2 State & data layer

| Concern         | Pattern                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session/context | Plain `@Service()` signal stores: `AuthStore`, `TenantStore`, `ProjectStore`, `PreferencesStore`                                                   |
| Reads           | `rxResource` over a `*-client.ts` service; reactive `params`; `hasValue()`-guarded computed reads; `defaultValue` set                              |
| Query params    | Bound to `input()`; filters kept as one record signal; URL synced via `router.navigate([], { queryParamsHandling: 'merge' })`                      |
| Shared ref data | `ProjectRefStore`: `ensure(projectId, kinds)` / `invalidate(projectId, kind)` / `nameOf()` — statuses, types, sprints, labels, members             |
| Writes          | Explicit `.subscribe({ next, error })`; errors via `getErrorMessage(err)` + toast (`injectToasts()`); update resource value in place or `reload()` |
| Forms           | Signal Forms (`form()`, `schema()`, `formField`)                                                                                                   |
| Rich text       | `ui-milkdown-editor`: Milkdown WYSIWYG + toolbar (`callCommand`) ⇄ raw markdown toggle; value is always markdown                                   |

**Error-state rule:** reading `.value` of an errored resource throws even with `defaultValue` — always guard with
`hasValue()` before reading/updating.

### 5.3 Conventions

- Naming: no type suffixes (`auth-client.ts` / class `AuthClient`; stores keep `-store`; guards/interceptors/pipes keep
  theirs). Components in own folders, separate `.html`.
- Selectors: `ui-*` prefix. Feature folders under `features/<domain>/`.
- `@Service()` decorator + `inject()`; never constructor injection.
- Native control flow (`@if/@for/@switch`), `[class]/[style]` bindings, no `*ngIf`/`ngClass`.
- Spartan Helm components for all standard UI elements.

## 6. Testing

- **Server:** Vitest. Service tests mock repos via constructor; route tests mock service classes with `vi.mock` and
  inject a fake `svc` through middleware in `createTestApp()` (see any `routes/*.test.ts`).
- **UI:** Vitest via `ng test`. Resource-based components resolve asynchronously — poll signal state
  (`for (i < N && !component.task()) await setTimeout(10)`) instead of fixed timeouts.
- **E2E:** Playwright specs in `ui/e2e/`.

## 7. Design decisions (must / must-not, with rationale)

| Decision                                             | Rationale                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| New MongoClient per request; graph built per request | Workers kill sockets between requests; module-level caching leaks stale connections across isolates                                |
| `@hono/zod-validator` instead of custom middleware   | Fully typed bodies, zero hand-written duplicates; custom variant hid schema/type drift                                             |
| `hono/jwt` instead of hand-rolled HMAC               | Custom crypto missed `alg` validation (alg-confusion surface); battle-tested helpers delete ~80 lines                              |
| `rxResource` over clients for reads                  | Auto refetch/cancel on reactive params; replaces loader + loading/error signals + subscriptions                                    |
| Human-readable filter names stay in URLs             | Deep-link readability; resolution is pure `computed()` over loaded options — no polling                                            |
| IDs (not names) for task routes                      | Stable `KEY-NUMBER` format survives renames                                                                                        |
| Plain signal stores, no NgRx SignalStore             | Global state is four small context stores; native-first, revisit only if undo/DevTools-history triggers appear                     |
| `ProjectRefStore` instead of per-component fetches   | Removes N+1 requests (task-detail fired up to 9) and duplicated id⇄name mapping in 6+ components                                   |
| Bulk reorder endpoints (statuses/task-types)         | Two sequential PATCHes could leave positions inconsistent on partial failure                                                       |
| bcryptjs (pure JS) on Workers                        | Native bcrypt cannot compile for Workers; watch CPU time, PBKDF2/WebCrypto is the fallback                                         |
| Per-request Mongo client is correct                  | Cloudflare guidance: create clients inside handlers; Durable Object holding a client is the future optimization if latency matters |
