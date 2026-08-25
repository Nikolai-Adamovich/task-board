# Refactoring Review — task-board

> ## Implementation status (updated after fix rounds 1–5) — ALL ITEMS DONE ✅
>
> **Done ✅:** S1–S20 (every finding from this review is implemented).
>
> **Round 5 (S7 final):** read paths migrated to `rxResource` in board-view, task-detail, comment-thread, project-list,
> sprint-list and audit-log-viewer. Pattern: `rxResource` over the typed clients with reactive `params` (auto refetch +
> cancel), `hasValue()`-guarded computed reads (error-state safe), mutations update the resource value in place or call
> `reload()`. Mutation-heavy managers (statuses / task-types / labels / tenant-member-list / project-member-list)
> intentionally keep explicit subscriptions per the data-layer decision matrix.
>
> **Verification (round 5):** ui build ✓, 435/435 tests pass, tsc clean, eslint clean; server 400/400 tests pass, tsc
> clean, eslint clean.

Full code review of `ui/`, `server/`, and `shared/` (Angular 22 + Hono on Cloudflare Workers + MongoDB). Each item lists
the problem, affected files, proposed solution, priority, and estimated effort.

**Priorities:** 🔴 high (bugs / security / tech debt that compounds) · 🟡 medium · 🟢 low (polish)

Recommendations cross-checked against current official guidance: Angular v22 best practices & docs (angular-cli MCP,
angular.dev), Spartan CLI healthcheck (all checks green), Hono docs (`zValidator` / typed `Variables` / `hono/jwt`), Zod
v4, MongoDB Node driver pooling docs, and Cloudflare Workers best practices (connection lifecycle, global-scope rules).
`resource` / `httpResource` / `rxResource` are **stable APIs in Angular v22**.

---

## Summary

| #   | Area   | Finding                                                                                                                                     | Priority |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | server | Per-request manual DI factories duplicated in every route file, full of `as never` casts                                                    | 🔴       |
| S2  | server | Hand-rolled validation middleware; official `@hono/zod-validator` gives fully typed bodies                                                  | 🔴       |
| S3  | server | Hand-written JWT sign/verify duplicated in two files → use built-in `hono/jwt`                                                              | 🔴       |
| S4  | ui     | No shared "project reference data" layer — statuses/types/sprints/labels/members re-fetched and re-mapped in ~6 components                  | 🔴       |
| S5  | ui     | `task-table.ts` is a 684-line god component with a `setInterval` polling hack                                                               | 🔴       |
| S6  | ui     | Name→ID resolution for human-readable URL params done by `setInterval` polling instead of reactive `computed()`                             | 🔴       |
| S7  | ui     | Manual `subscribe()` data loading everywhere; no `resource()`/`httpResource`; inconsistent error handling                                   | 🟡       |
| S8  | ui     | Query-param subscriptions instead of input binding (`withComponentInputBinding` is already enabled!)                                        | 🟡       |
| S9  | server | Inline `/api/tasks/my` route in `index.ts` bypasses the whole architecture (and skips tenant scoping)                                       | 🟡       |
| S10 | server | `tenant.service.ts` (662 lines) mixes tenants, members, invitations, emails                                                                 | 🟡       |
| S11 | server | Authorization logic scattered between middleware, `rbac.service`, and per-service checks                                                    | 🟡       |
| S12 | server | Repositories duplicate pagination/mapping boilerplate → base repository                                                                     | 🟡       |
| S13 | ui     | Duplicated position-swap reorder logic in status & task-type managers                                                                       | 🟡       |
| S14 | ui     | Silent failures: `console.error` instead of toasts, optimistic-concurrency conflicts swallowed, 401-on-login triggers global logout         | 🟡       |
| S15 | server | Minor: CORS options rebuilt per request; stringly-typed statuses; optional `AuditService`; mixed `node:crypto`/WebCrypto; bcryptjs CPU cost | 🟢       |
| S16 | ui     | Minor: hardcoded `limit: 200`; `setTimeout` form-reset hack; JWT decode inline in store; missing browser error listener                     | 🟢       |
| S17 | shared | `ErrorCode` union not enforced end-to-end; consider branded ID types                                                                        | 🟢       |
| S18 | server | Inline `user_settings` collection access in `routes/user-preferences.ts` (same bypass class as S9)                                          | 🟡       |
| S19 | ui     | Flaky `milkdown-editor.spec.ts` — races `setTimeout(0)` against `afterNextRender`                                                           | 🟢       |
| S20 | ui     | Milkdown WYSIWYG not wired into comments; no toolbar / raw-markdown toggle in the editor component                                          | 🟡       |

---

## Server (`server/`)

### S1 — Per-request DI composition duplicated in every route file 🔴

Every route file contains its own `createXService()` factory that manually instantiates the entire repository/service
graph **inside each request handler**, with `as never` casts to silence type errors:

- [`server/src/routes/tasks.ts`](../server/src/routes/tasks.ts) — `createTaskService()` builds 10 repositories + 2
  services
- Same pattern in [`boards.ts`](../server/src/routes/boards.ts), [`comments.ts`](../server/src/routes/comments.ts),
  [`statuses.ts`](../server/src/routes/statuses.ts), [`tenants.ts`](../server/src/routes/tenants.ts),
  [`projects.ts`](../server/src/routes/projects.ts), [`sprints.ts`](../server/src/routes/sprints.ts),
  [`labels.ts`](../server/src/routes/labels.ts), [`task-types.ts`](../server/src/routes/task-types.ts),
  [`filters.ts`](../server/src/routes/filters.ts), [`audit.ts`](../server/src/routes/audit.ts),
  [`invitations.ts`](../server/src/routes/invitations.ts),
  [`user-preferences.ts`](../server/src/routes/user-preferences.ts),
  [`task-relationships.ts`](../server/src/routes/task-relationships.ts)

Problems:

1. ~15 near-identical factory functions (~400 lines of pure boilerplate).
2. `as never` casts defeat the type system exactly where cross-aggregate dependencies exist (e.g.
   `UserRepository(...) as never` passed where the `TaskServiceUserRepo` interface is expected).
3. Adding a dependency to a service means editing every route file that constructs it.

**Proposal (Workers-safe):** ⚠️ the container must stay **request-scoped** — Cloudflare Workers reuse isolates across
requests and forbid caching request-scoped I/O handles (the per-request `MongoClient` from
[`index.ts`](../server/src/index.ts)) in module-level state. So _do not_ memoize services at module level: repositories
capture `Collection` objects bound to a client that is closed after each request.

Instead, build the graph **once per request** in a middleware and expose it via Hono's typed `Variables` (per
[Hono context generics docs](https://hono.dev/docs/api/context) and
[`createMiddleware` from `hono/factory`](https://hono.dev/docs/guides/middleware)):

```ts
// server/src/container.ts — pure function, no module state
export function buildServices(db: Db) { return { tasks: new TaskService(...), /* … */ }; }

// server/src/middleware/services.ts
export const provideServices = createMiddleware<{ Variables: { svc: Services } }>(
  async (c, next) => { c.set('svc', buildServices(getDb())); await next(); },
);

// handler: const svc = c.var.svc.tasks;
```

The `as never` casts disappear by typing constructor params against the narrow interfaces already declared in services
(e.g. [`task.service.ts:13-27`](../server/src/services/task.service.ts)). Object construction per request is negligible
compared to the Mongo handshake already being paid.

**Effort:** 1–2 days. **Risk:** low (pure restructuring; services are unit-tested directly).

### S2 — Replace hand-rolled body validation with `@hono/zod-validator` 🔴

Every POST/PATCH handler currently does:

```ts
const body = c.get('validatedBody' as never) as { ... }; // manual re-declaration of the Zod schema
```

The handler duplicates the schema shape by hand and can silently drift from [`schemas/*.ts`](../server/src/schemas);
`as never` disables all checking.

**Proposal:** adopt the official [`@hono/zod-validator`](https://hono.dev/docs/guides/validation) middleware (supports
Zod v4, which the project uses), which makes `c.req.valid('json')` fully typed with zero manual casts:

```ts
import { zValidator } from '@hono/zod-validator';

router.post('/projects/:projectId/tasks', zValidator('json', CreateTaskSchema), async (c) => {
  const body = c.req.valid('json'); // typed as z.infer<typeof CreateTaskSchema>
  // ...
});
```

Alternative: the newer
[`@hono/standard-validator`](https://github.com/honojs/middleware/tree/main/packages/standard-validator) (Standard
Schema based — works with Zod v4 natively). Either way, delete the custom
[`middleware/validation.ts`](../server/src/middleware/validation.ts) and all ~25 hand-written body type annotations.
Error formatting for `ZodError` in [`error-handler.ts`](../server/src/middleware/error-handler.ts) keeps working
unchanged.

**Effort:** 0.5–1 day.

### S3 — Hand-written JWT implementation → use `hono/jwt` 🔴

JWT signing and verification are implemented from scratch, **duplicated across two files** with different styles:

- [`services/auth.service.ts:27-48`](../server/src/services/auth.service.ts) — manual `signJwt()` (WebCrypto
  HMAC-SHA256, hand-rolled base64url)
- [`middleware/auth.ts:26-62`](../server/src/middleware/auth.ts) — separate manual `verifyJwt()`

Risks: custom cryptographic code is security-sensitive and easy to get subtly wrong (e.g. the verify side doesn't
validate the `alg` header — an attacker-controlled header is ignored rather than checked; payload parsing uses plain
`atob` without strict base64url validation). Also inconsistent crypto stacks: signing uses WebCrypto, but
[`hashToken()` at auth.service.ts:56-60](../server/src/services/auth.service.ts) dynamically imports `node:crypto`.

**Proposal:** replace both with Hono's built-in [`hono/jwt`](https://hono.dev/docs/helpers/jwt) — Workers-native,
well-tested, three functions:

```ts
import { sign, verify, decode } from 'hono/jwt';

const token = await sign(payload, secret); // replaces signJwt()
const payload = await verify(token, secret); // replaces verifyJwt() — checks alg + exp
```

This deletes ~80 lines of custom crypto and closes the alg-confusion surface. Keep the existing payload claims (`sub`,
`tenantId`, `tenantRole`, `exp`) as-is so stored tokens stay compatible.

**Effort:** 0.5 day.

### S9 — Inline route bypassing architecture in `index.ts` 🟡

[`server/src/index.ts:80-116`](../server/src/index.ts) implements `GET /api/tasks/my` inline: raw collection access, an
ad-hoc document type, and a hand-rolled mapper duplicating `toDomain()` from
[`task.repository.ts`](../server/src/repositories/task.repository.ts).

**Proposal:** add `TaskRepository.findAssignedTo(userId, limit)` + `TaskService.getMyTasks(userId)` and register the
route in [`routes/tasks.ts`](../server/src/routes/tasks.ts). Also add tenant/project scoping or pagination — currently
it dumps up to 50 tasks across _all_ tenants without scoping.

**Effort:** 0.5 day.

### S10 — `tenant.service.ts` has too many responsibilities 🟡

662 lines mixing: tenant CRUD, member management, invitations (create/revoke/accept), email sending, role changes, RBAC
checks. [`services/project.service.ts`](../server/src/services/project.service.ts) (465 lines) is similar.

**Proposal:** split into `tenant.service.ts` (CRUD), `tenant-member.service.ts`, `invitation.service.ts` (already
half-exists in routes/invitations), keeping email in [`email.service.ts`](../server/src/services/email.service.ts).

**Effort:** 1 day.

### S11 — Authorization scattered across three layers 🟡

RBAC exists as middleware ([`middleware/rbac.ts`](../server/src/middleware/rbac.ts)), a service
([`services/rbac.service.ts`](../server/src/services/rbac.service.ts)), _and_ ad-hoc private methods inside domain
services (`requireEditorOrAbove(...)` in [`task.service.ts`](../server/src/services/task.service.ts)). Rules for the
same role hierarchy live in multiple places.

**Proposal:** keep coarse route-level checks in middleware; move all fine-grained rules into `rbac.service.ts` and have
domain services call it (`this.rbac.requireEditor(userRole, projectRole)`). Single source of truth for the role matrix.

**Effort:** 1 day.

### S12 — Repository boilerplate 🟡

All ~17 repositories repeat: constructor taking a `Collection`, `toDomain()` mapping, `findById`, pagination math, ISO
date conversion. E.g. compare [`task.repository.ts:61-95`](../server/src/repositories/task.repository.ts) with other
repos.

**Proposal:** abstract base class / factory `createRepository<TDoc, TDomain>(collection, toDomain)` providing
`findById`, `findMany` (with a shared pagination helper from
[`validators/pagination.ts`](../server/src/validators/pagination.ts)), `insert/update/remove`. Keep specialized queries
in concrete repositories.

**Effort:** 1–2 days (mechanical).

### S15 — Minor server items 🟢

- **MongoDB connection strategy is correct as-is.** Creating a fresh `MongoClient` per request and closing it
  ([`index.ts:37-53`](../server/src/index.ts)) matches current Cloudflare guidance ("create clients inside handlers,
  never in global scope" — global pools go stale across invocations). Optional future optimization: hold a long-lived
  `MongoClient` inside a **Durable Object** — community benchmarks show ~10x latency reduction vs per-request connects;
  only worth it if DB latency becomes a measured problem.
- [`index.ts:20-30`](../server/src/index.ts): `cors()` options object rebuilt per request — parse `ALLOWED_ORIGINS` once
  at module init (immutable config, safe for global scope) and hoist the middleware.
- Services compare raw strings (`project.status !== 'ACTIVE'`) while `ProjectStatusValues` exists in `shared` — use the
  shared constants for consistency.
- `AuditService` is optional in some constructors (`auditService?`) — audit writes are silently skipped when absent;
  make it required or log explicitly.
- Unify hashing on WebCrypto: `hashToken()` imports `node:crypto` while JWT code uses WebCrypto —
  `crypto.subtle.digest('SHA-256', …)` works everywhere and removes the dynamic import.
- `bcryptjs` (cost 10) runs on Workers CPU budget — fine today, but watch CPU-time metrics under load; if throttling
  appears, consider PBKDF2 via WebCrypto (native, much cheaper per hash).

### S18 — Inline `user_settings` collection access in user-preferences routes 🟡

[`routes/user-preferences.ts:14-89`](../server/src/routes/user-preferences.ts) declares its own `UserSettingsDocument`
type and reads/writes the `user_settings` collection directly inside the route handlers (`GET/PUT /preferences`) — raw
Mongo access, default-value logic and upsert workarounds living at the route layer, bypassing the repository/service
architecture.

**Proposal:** add `UserSettingsRepository` + `getGlobal(userId)` / `updateGlobal(userId, patch)` methods on
`UserPreferencesService`; the route shrinks to two thin handlers like every other route.

**Effort:** 0.5 day.

---

## UI (`ui/`)

### S4 — No shared "project reference data" layer 🔴

Statuses, task types, sprints, labels, and members are fetched and converted to `Record<id, name>` maps +
`SelectOption[]` arrays independently in:

- [`features/tasks/task-table/task-table.ts`](../ui/src/app/features/tasks/task-table/task-table.ts) (5 loaders)
- [`features/tasks/task-detail/task-detail.ts:192-247`](../ui/src/app/features/tasks/task-detail/task-detail.ts) (N+1:
  separate requests for statuses, types, labels, sprint, then again for edit options)
- [`features/boards/board-view/board-view.ts:278-293`](../ui/src/app/features/boards/board-view/board-view.ts)
- [`features/statuses/status-manager/status-manager.ts`](../ui/src/app/features/statuses/status-manager/status-manager.ts),
  [`task-types/task-type-manager`](../ui/src/app/features/task-types/task-type-manager/task-type-manager.ts),
  [`labels/label-manager`](../ui/src/app/features/labels/label-manager/label-manager.ts)

Consequences: duplicated mapping code, redundant HTTP traffic (task-detail fires up to 9 requests per view), no caching
between components, stale reference data after mutations.

**Proposal:** see the dedicated section
[«Proposed data-layer architecture»](#proposed-data-layer-architecture-services--stores--subscriptions) below —
`ProjectRefStore` built on native `rxResource` + a plain `@Service()` store. No third-party state library needed.

**Effort:** 2 days. Biggest single win for the UI codebase.

### S5 — `task-table.ts` god component + polling hack 🔴

At 684 lines it handles: column definitions, 7 individual filter signals, sorting, URL sync, name↔ID resolution,
pagination, dialog wiring, and 5 data loaders.

Specific smells:

- `deferResolve()` polls with `setInterval(…, 100)` up to 50 attempts waiting for options to load — a race-prone
  workaround for the human-readable-URL design (see S6).
- 7 parallel filter signals (`filterStatus`, `filterPriority`, …) switched over by string in `onColumnFilterChange()` —
  should be one record signal (or `linkedSignal` synced from URL params).
- `onFilterApplied()` repeats the same if/set/else block 5 times.

**Proposal:**

1. Extract a `TaskTableFilterStore`: holds a single `filters = signal<TaskTableFilters>` record, owns URL sync
   (`syncToUrl`/`syncFromParams`) and sort state.
2. Apply the reactive name→ID resolution from S6 — deletes `deferResolve`, the `setInterval` poller, `resolveUrlFilters`
   and the six deferred-resolution branches (~150 lines).
3. Split the presentational table into `task-table.ts` (data) + child components if it keeps growing.

**Effort:** 2 days (after S4 + S8; see S6).

### S6 — Name↔ID resolution done by polling instead of reactively 🔴

`syncToUrl()` in [`task-table.ts`](../ui/src/app/features/tasks/task-table/task-table.ts) writes
`?status=In Progress&type=Bug` (human-readable names — keep them), and on read the component must resolve names back to
IDs against option lists that may not be loaded yet. The current fix is the `deferResolve()` + `setInterval(…, 100)`
polling hack plus duplicated filter signals.

**Requirement:** human-readable URL params stay. The problem is not the names — it is that resolution is imperative
instead of reactive.

**Proposal:** make resolution a **pure `computed()`** over two reactive sources — the raw URL value (coming in as an
input after S8) and the options (coming from `ProjectRefStore` resources after S4). No polling, no duplicate state,
nothing to clean up on destroy:

```ts
// task-table.ts — URL params arrive as inputs (S8), options come from ProjectRefStore (S4)
readonly status = input<string>(''); // "In Progress" or an id — bound from ?status=…

private readonly statuses = this.projectRefStore.refs(this.projectId, 'statuses');

/** Derived, never stored: recomputes automatically when options finish loading */
protected readonly filterStatus = computed(() =>
  resolveNameToId(this.status(), this.statuses.value() ?? []),
);
```

- When options are still loading, `filterStatus` is simply `''`; the moment `rxResource` resolves, the computed
  recalculates — the exact behaviour the 5-second poller emulated, without the timer.
- The write path (`syncToUrl`) stays a synchronous pure function: the user can only pick values from already-loaded
  option lists, so `idToName` never races.
- Deletes `deferResolve`, `setInterval`, the six `if (urlX && !this.filterX()) deferResolve(...)` blocks, and the manual
  `queryParamsSub` parsing (~150 lines together with S5/S8).
- `resolveNameToId` survives as a small tested util in `shared/utils/`.

Trade-off to document: URLs contain DB display names, so renaming an entity invalidates old deep links (acceptable —
same behaviour as today, minus the hacks).

**Effort:** 0.5 day (together with S4 + S8).

### S7 — Data loading pattern: manual `subscribe()` everywhere 🟡

~117 `.subscribe()` calls in feature components. Issues:

1. **Inconsistent error handling**: some pass `error:` handlers, many don't (e.g. all five loaders in
   [`task-table.ts`](../ui/src/app/features/tasks/task-table/task-table.ts)); failures leave the UI silently empty.
   [`board-view.ts:224`](../ui/src/app/features/boards/board-view/board-view.ts) logs drag-drop failures to
   `console.error` only — the user drags a card, nothing happens, no toast.
2. **No loading/error state discipline**: `loading` signals are managed manually with `finalize()` in some places,
   absent in others.
3. **Not reactive to input changes**: loaders run once in `ngOnInit`; changing `projectId()` doesn't refetch.

**Proposal:** migrate to the native resource APIs — see the dedicated section
[«Proposed data-layer architecture»](#proposed-data-layer-architecture-services--stores--subscriptions) for the full
decision matrix and target patterns.

**Effort:** 2–3 days incremental; can be done feature-by-feature starting with board-view.

### S8 — Query params subscribed manually although input binding is already enabled 🟡

[`app.config.ts:17`](../ui/src/app/app.config.ts) enables `withComponentInputBinding()`, which binds **query parameters
to component inputs by default** (confirmed in
[Angular docs](https://angular.dev/api/router/withComponentInputBinding)). Yet components still subscribe manually:

- [`board-view.ts:235`](../ui/src/app/features/boards/board-view/board-view.ts) — `route.queryParams.subscribe(...)`
  **without unsubscribe** (leak: ActivatedRoute observables never complete, callback keeps firing after destroy)
- [`task-table.ts:306`](../ui/src/app/features/tasks/task-table/task-table.ts),
  [`tenant-member-list.ts:250`](../ui/src/app/features/tenants/tenant-member-list/tenant-member-list.ts),
  [`project-member-list.ts:275`](../ui/src/app/features/projects/project-member-list/project-member-list.ts) — manual
  `Subscription` fields + `ngOnDestroy`

**Proposal:** declare query params as plain inputs — zero subscription management:

```ts
// board-view.ts
readonly sprintId = input<string>(null); // bound automatically from ?sprintId=…
// react via computed()/effect()/httpResource params instead of ngOnInit reloads
```

Then delete all `queryParamsSub` fields, `ngOnDestroy` blocks, and manual param parsing. Where dynamic reaction is
needed, derive with `computed()` from the bound inputs.

**Effort:** 0.5 day.

### S13 — Duplicated reorder logic 🟡

[`status-manager.ts:176-184`](../ui/src/app/features/statuses/status-manager/status-manager.ts) and
[`task-type-manager.ts:189-196`](../ui/src/app/features/task-types/task-type-manager/task-type-manager.ts) implement
identical two-request position swapping with a `checkDone()` counter. Two sequential requests can also leave positions
inconsistent if the second fails.

**Proposal:** add `PATCH /statuses/reorder` / `PATCH /task-types/reorder` accepting `{ id, position }[]` (transactional
on the server), and one shared `useReorder()` helper or move reorder into the respective stores. Alternatively use
`forkJoin` client-side as an interim fix.

**Effort:** 0.5 day backend + 0.5 day UI per entity.

### S14 — Error-handling gaps in UX-critical paths 🟡

1. **Optimistic concurrency**: tasks carry `version` and the interceptor maps `TASK_VERSION_CONFLICT` → i18n message,
   but board drag-drop swallows the conflict
   ([`board-view.ts:224`](../ui/src/app/features/boards/board-view/board-view.ts)) and task-detail offers no
   reload-and-retry flow. → On version conflict show a confirm dialog ("task was changed by someone else — reload?") and
   refetch; centralize in a `handleVersionConflict(refetch)` util.
2. **401 on login triggers global logout**:
   [`error.interceptor.ts:122-124`](../ui/src/app/interceptors/error.interceptor.ts) calls `authStore.logout()` for
   _any_ 401 — including a failed login attempt (`INVALID_CREDENTIALS`), which needlessly wipes state and fires a
   redundant navigation while already on `/auth/login`. → Skip the auto-logout for `/auth/*` request URLs (the tenant
   interceptor already uses this exclusion pattern).
3. **console.error instead of user feedback** for 403/409/422 in the interceptor switch — downstream handlers cover some
   cases, but drag-drop and loader paths don't (see S7).

**Effort:** 1–1.5 days total.

### S16 — Minor UI items 🟢

- **Hardcoded `limit: 200`** in [`board-view.ts:265`](../ui/src/app/features/boards/board-view/board-view.ts) and
  [`sprint-detail.ts:146`](../ui/src/app/features/sprints/sprint-detail/sprint-detail.ts) — large projects will silently
  truncate boards. Either paginate with virtual scrolling (CDK is already imported) or raise server-side and document
  the cap.
- **`setTimeout(() => this.createTaskDialog()?.resetForm())`** in
  [`task-table.ts:424`](../ui/src/app/features/tasks/task-table/task-table.ts) — replace with resetting the form when
  the dialog opens via the dialog's own lifecycle/state signal, avoiding timing hacks.
- **JWT decode inline in [`auth-store.ts:101-122`](../ui/src/app/stores/auth-store.ts)** — extract to
  `shared/utils/jwt.ts` (pure function, easily unit-tested); consider storing expiry and auto-refresh/logout on token
  expiration instead of waiting for a 401 round-trip.
- **Token in `localStorage`** — acceptable for the current CSR-only threat model, but note XSS exposure; guard if SSR is
  ever enabled.
- **`main.ts`** lacks `provideBrowserGlobalErrorListeners()` (standard in v20+ app scaffolds) — add for better
  uncaught-error reporting.
- Build budgets are configured ✅ (initial 500kB/1MB, anyComponentStyle 4kB/8kB in production) — consider tightening
  `anyComponentStyle` warning if large component styles appear.

### S19 — Flaky milkdown-editor spec 🟢

[`milkdown-editor.spec.ts`](../ui/src/app/shared/milkdown-editor/milkdown-editor.spec.ts) "should initialize with
loading state" waited a fixed `setTimeout(0)` for `afterNextRender` + a lazy dynamic import to settle — fails under
load, passes in isolation.

**Proposal (implemented):** poll `loading()` until it flips (bounded loop) and assert the final state
(`fallbackMode() || editorReady()`) instead of timing assumptions.

### S20 — Milkdown WYSIWYG integration for descriptions & comments 🟡

The `MilkdownEditor` component existed but was only wired into task-description editing; comments used plain textareas,
and the component had no toolbar and no way to see the raw markdown.

**Proposal (implemented):**

- [`milkdown-editor.ts`](../ui/src/app/shared/milkdown-editor/milkdown-editor.ts): toolbar (bold / italic / inline code
  / H1–H3 / lists / quote / code block) driving Milkdown commands via `callCommand` from `@milkdown/utils`; WYSIWYG ⇄
  raw toggle that tears down / recreates the editor seeded with the current markdown; textarea remains as automatic
  fallback.
- [`comment-thread.html`](../ui/src/app/features/comments/comment-thread/comment-thread.html): new-comment and
  inline-edit textareas replaced with `ui-milkdown-editor`.
- Task description editing already used the component.
- The stored value is plain markdown in both modes (`contentChange` emits markdown), so no backend change is required.

---

## Shared (`shared/`)

### S17 — Keep, minor improvements 🟢

The package is well-designed: runtime-library-free types + const-value enums via `valuesOf`. Suggestions:

1. **`ErrorCode` union** exists in [`types/common.ts`](../shared/src/types/common.ts) but
   [`errors/app-error.ts`](../server/src/errors/app-error.ts) accepts arbitrary strings — make
   `AppError.code: ErrorCode` so the compiler catches new codes missing from the UI's
   [`ERROR_CODE_MESSAGES`](../ui/src/app/interceptors/error.interceptor.ts) map.
2. **Branded ID types** (`type TaskId = string & { __brand: 'TaskId' }`) would prevent cross-entity ID mix-ups (e.g.
   passing `statusId` where `typeId` is expected) — but adds friction; recommend only if bugs of that class appear.
3. Consider exporting a `TASK_LIMITS`/pagination constants object shared by validators and UI page-size options.

---

## Proposed data-layer architecture (services / stores / subscriptions)

Design goals: **native Angular only** (no NgRx SignalStore unless a concrete trigger appears — see decision below),
minimal boilerplate, one uniform pattern per data kind, zoneless-friendly.

### Decision matrix

| Data kind                                                                 | Solution                                                                                   | Why                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component-local read (list/detail fetched from API)                       | `httpResource` (or `rxResource` over an existing client method) declared in the component  | Stable in v22; gives `value/isLoading/error` signals, auto-refetch and **auto-cancel** when reactive params change; replaces loader + loading/error signals + subscription |
| Shared reference data (statuses/types/sprints/labels/members per project) | `ProjectRefStore` — plain `@Service()` store caching `rxResource`s per `(projectId, kind)` | One source of truth, dedupes N+1 requests, invalidation after mutations                                                                                                    |
| Session/context state (auth, tenant, project, preferences)                | Existing plain `@Service()` signal stores — **keep as-is**                                 | Already uniform, zero deps, testable; exactly the "reactive service" pattern recommended as default for feature-scoped state                                               |
| Writes (create/update/delete)                                             | Client method + short explicit `.subscribe({ next, error })` with toast on error           | Resources are for reads; one-shot HttpClient observables self-complete, so no leak risk; explicitness beats abstraction for mutations                                      |
| URL state (filters, sort, page)                                           | Query params ↔ `input()` binding (S8) + single filter-record signal in a small store       | Declarative, no subscriptions                                                                                                                                              |
| Cross-cutting side effects (sync state → URL, logging)                    | `effect()`                                                                                 | Already used correctly in sidebar/preferences stores                                                                                                                       |

### Why NOT NgRx SignalStore (for now)

Native-first priority: `@ngrx/signals` adds a dependency (~4KB gz + idioms) and its value (Redux-DevTools history,
`withEntities`, composable features) pays off only with complex optimistic workflows, many teams, or large normalized
shared state. This app's global state is four small context stores; everything else is server data that fits
`httpResource`. Revisit only if a concrete trigger appears: undo/rollback requirements, state-history debugging needs,
or 5+ stores with interdependent slices.

### Target patterns

**1. Reads in components — `httpResource`:**

```ts
// task-table.ts (after S6/S8: filters live in a store, params arrive as inputs)
private readonly tasksResource = httpResource<PaginatedResponse<Task>>(() => ({
  url: `${this.apiBaseUrl}/projects/${this.projectId()}/tasks`,
  params: this.filterStore.queryParams(),          // reactive — refetches & cancels on change
  defaultValue: undefined,
}));
protected readonly tasks = computed(() => this.tasksResource.value()?.data ?? []);
// templates: @if (tasksResource.isLoading()) … @if (tasksResource.error()) …
```

**2. Shared reference data — `ProjectRefStore` (plain store + `rxResource`):**

```ts
@Service()
export class ProjectRefStore {
  private readonly injector = inject(Injector);
  private readonly cache = new Map<string, ProjectRefs>(); // `${projectId}:${kind}` → rxResource

  /** Returns a stable ResourceRef per (project, kind); created lazily, cached forever. */
  refs<K extends RefKind>(projectId: Signal<string>, kind: K): ResourceRef<RefData[K][]> {
    const key = `${untracked(projectId)}:${kind}`;
    let entry = this.cache.get(key);
    entry ??= this.create(projectId, kind); // rxResource({ params, stream, injector: this.injector })
    return entry;
  }

  invalidate(projectId: string, kind: RefKind): void {
    this.cache.get(`${projectId}:${kind}`)?.reload(); // managers call this after CUD
  }

  nameOf(kind: RefKind, id: string): string {
    /* id → name from cached value */
  }
}
```

Components drop their five `load*()` methods and ten map/options signals; managers call `invalidate()` instead of
reloading locally. `rxResource` (not `httpResource`) here because the existing typed clients stay the single place that
knows endpoint shapes.

**3. Writes — explicit, uniformly error-handled:**

```ts
// keep clients as-is; standardize the call site:
this.taskClient.update(task.id, patch).subscribe({
  next: (updated) => {
    /* update local signal / resource via .set() */
  },
  error: (err) => this.notify.error(getErrorMessage(err)), // mandatory; eslint-enforced
});
```

Add an eslint rule (or `rxjs/no-ignored-error` config) flagging `.subscribe(` without an `error` handler under
`features/`. For version conflicts, wrap with `handleVersionConflict(reload)` (S14).

**Resulting shape:** zero new dependencies, no subscription management anywhere (params bind as inputs, reads are
resources, writes self-complete), and every feature follows the same three patterns above.

---

## Verified as compliant (deliberately NOT flagged)

Checked against Angular v22 best practices, Spartan CLI healthcheck, and the style guide:

- **Change detection**: `ChangeDetectionStrategy.OnPush` is the **default since Angular v22** — omitting it explicitly
  is correct; nothing to migrate.
- **Naming conventions**: fully compliant — no type suffixes (`auth-client.ts`, `Login`, `BoardView`),
  `stores/*-store.ts`, functional guards/interceptors, `.pipe` suffix on pipes.
- **Modern syntax**: zero `*ngIf`/`*ngFor`/`ngClass`/`ngStyle`/`@HostBinding`/`@HostListener` anywhere in `ui/src`;
  native control flow and `[class]`/`[style]` bindings used throughout.
- **Standalone components**: used everywhere without explicit `standalone: true` (correct for v20+).
- **DI**: `inject()` everywhere, `@Service()` decorator, no constructor injection.
- **Signal inputs/outputs**: `input()`/`output()` used consistently; `withComponentInputBinding` wired in
  [`app.config.ts`](../ui/src/app/app.config.ts).
- **Signal Forms**: [`board-view.ts`](../ui/src/app/features/boards/board-view/board-view.ts) already uses
  `@angular/forms/signals` (`form()`, `schema()`) — extend to remaining forms gradually.
- **Signal stores**: existing `auth-store`/`tenant-store`/`project-store`/`preferences-store` follow the plain
  `@Service()` + signals pattern — the correct native default; keep.
- **Spartan UI**: `npx ng g @spartan-ng/cli:healthcheck` passes all 31 checks ("Nothing to be done"); Brain/Helm layers
  used consistently; no hand-rolled equivalents of existing Spartan components.
- **Lazy loading**: every route uses `loadComponent`; no eagerly imported feature components.
- **Build budgets**: present in production configuration of [`angular.json`](../ui/angular.json).
- **Password hashing**: `bcryptjs` (pure JS) — correct choice for Workers (native `bcrypt` would not compile); JWT
  secret handled via Workers secrets, not committed.
- **Test coverage**: specs exist for nearly every component, service, middleware, and repository (Vitest + Playwright
  configured).
- **i18n**: all 11 configured locales present in `public/assets/i18n/` including `zh-Hans`.

---

## Suggested execution order

1. **S3** — swap hand-rolled JWT for `hono/jwt` (small diff, closes a security-sensitive surface).
2. **S2** — switch to `@hono/zod-validator` (small, immediately deletes casts, unblocks S1 cleanup).
3. **S1** — request-scoped services middleware, delete all `createXService()` copies + `as never`.
4. **S4 + S8 + S6** — `ProjectRefStore`, query-param inputs, reactive name→ID resolution (human-readable URLs stay; the
   polling hack dies), then decompose `task-table.ts` (S5).
5. **S4** — `ProjectRefStore` (removes most duplication across 6+ components).
6. **S8, S14** — input binding for query params + error-handling gaps (small correctness fixes).
7. **S9, S10, S11, S12** — server structure (my-tasks route, service splits, RBAC consolidation, repo base).
8. **S7** — migrate reads to `httpResource`/`rxResource` feature-by-feature per the data-layer section.
9. Remaining 🟢 items opportunistically.
