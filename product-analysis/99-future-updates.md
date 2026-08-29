# 99 — Future Updates (Deferred Work)

> Long-lived parking lot for improvements that were analyzed during the `report-1.md` audit ([`plan.md`](../plan.md))
> but deliberately deferred. Each entry records **why it matters**, **what problem it solves**, and **what it would
> cost**, so a future session can pick it up without re-doing the analysis.

---

## 1. Branded `Id` types (S-02) — DEFERRED

**Status:** deferred by decision (2026 audit follow-up). Source finding: `report-1.md` §4.2 S-02, `audit-typescript.md`
"Branded types: none — high IDOR-by-mistake risk".

### The problem

Every entity id in the codebase is a plain `string`:

- [`shared/src/types/common.ts`](../shared/src/types/common.ts) — `id: string` on `Task`, `Project`, `User`, `Status`,
  `Sprint`, `Label`, `Board`, `Comment`, `Filter`, …
- Route params: `c.req.param('taskId')` → `string`.
- Context variables: `c.get('userId')`, `c.get('tenantId')` → `string`.

The compiler therefore cannot tell a `taskId` from a `userId` from a random string. Any of these compiles fine:

```ts
taskRepo.findById(comment.id); // wrong id, right type
statusRepo.findById(input.assigneeId); // swapped refs, right type
```

This is exactly the class of mistake behind the IDOR findings fixed in Block 1 (M-01/M-02/S-04): cross-tenant and
cross-entity reads happened because nothing in the type system distinguished "an id of the right entity, resolved inside
the right tenant" from "any string the client sent".

### The proposed solution

Nominal typing via brands in `shared/src/types/common.ts`:

```ts
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type TaskId = Brand<string, 'TaskId'>;
export type UserId = Brand<string, 'UserId'>;
export type TenantId = Brand<string, 'TenantId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
// … SprintId, StatusId, TaskTypeId, LabelId, CommentId, BoardId, FilterId

/** Only place raw strings become ids — call at trust boundaries (route params, JWT payload, DB docs). */
export const asTaskId = (value: string): TaskId => value as TaskId;
```

With that in place:

- `findById(id: TaskId)` refuses a `UserId` or a raw `string` — the swapped-id bug above becomes a compile error.
- `c.get('userId')` can be typed `UserId` in [`server/src/types/context.ts`](../server/src/types/context.ts), so a
  handler cannot pass an unvalidated param where the authenticated user id is required.
- Tenant-scoped helpers (e.g. [`server/src/services/tenant-assert.ts`](../server/src/services/tenant-assert.ts)) can
  take `TenantId` and can never be fed a project id by accident.

### What it solves

1. **IDOR-by-mistake**: makes "wrong id passed to a lookup" a compile-time failure instead of a runtime 200/404.
2. **Removes the remaining unsafe casts** that exist only because types are too loose (see inventory below).
3. **Self-documenting signatures**: `getTaskByKey(tenantId: TenantId, key: ProjectKey, number: number)` states its trust
   requirements in the signature.

### Why it was deferred

- **Blast radius**: every `id: string` field in `shared/src/types/*.ts` (~18 type files), every repository method
  signature, every service, every route handler that reads `c.req.param(...)`, and a large share of the UI
  (`*-client.ts` services, stores, components) — realistically **hundreds of touch points** across all three workspaces.
- **Boundary noise**: raw strings enter at many edges (HTTP params, JWT claims, MongoDB `_id`s, localStorage,
  Transloco-free template data). Each needs an explicit `asX()` conversion, or the brands get erased with a cast — which
  defeats the purpose. Doing this half-way (brands in shared, casts at the edges) gives little value.
- **Low marginal payoff right now**: the actual IDOR holes were fixed structurally in Block 1 (tenant-assert helper,
  tenant-scoped lookups, tests). Brands prevent _future_ mistakes of this class; they don't fix an existing bug.
- **Conflict surface**: it touches the same files as every feature branch; best done as a dedicated, quiet period of
  work (see effort estimate).

### Effort estimate

| Phase                                                                                | Effort           |
| ------------------------------------------------------------------------------------ | ---------------- |
| Brand definitions + `asX()` constructors in `shared/src/types/common.ts`             | 0.5 day          |
| Server: context types, route params (`parseUuid` middleware), repositories, services | 2–3 days         |
| UI: `*-client.ts` services, stores, component models                                 | 2–3 days         |
| Test fixtures / mocks fallout                                                        | 1–2 days         |
| Type-test scaffolding (`expect-type`) to lock the invariants                         | 1 day            |
| **Total**                                                                            | **~1.5–2 weeks** |

Recommended execution: after the dependency baseline stabilizes (Renovate running, `npm audit` clean), as a standalone
branch with the standard gate (`npm run typecheck && npm test && npm run lint`) after each workspace conversion.

### Related leftover from S-02 (done separately, without brands)

The cast cleanup that does **not** require brands was handled in the dependency/cleanup pass:

- `as never` in [`server/src/services/task.service.ts`](../server/src/services/task.service.ts) (bulk update payload),
- production `as unknown as` in [`server/src/db/mongo.ts`](../server/src/db/mongo.ts) (topology introspection),
  [`server/src/middleware/auth.ts`](../server/src/middleware/auth.ts) (JWT payload),
  [`server/src/repositories/task.repository.ts`](../server/src/repositories/task.repository.ts) (BSON projection),
  [`server/src/services/tenant-member.service.ts`](../server/src/services/tenant-member.service.ts) — the last one was
  already removed in Block 5 step 5.1.

These are localized type-safety fixes; brands would only make them structurally impossible, not more correct.

---

## 2. Other deferred items

| Item                                                                         | Source                  | Why deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Revisit when                                                                                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production deploy checklist: email secrets**                               | Pre-deploy reminder     | Without `RESEND_API_KEY` the server falls back to `ConsoleEmailService` ([`server/src/container.ts:119-130`](../server/src/container.ts:119)) — emails are NOT delivered, invitation/reset tokens are only logged (masked). Before deploying to production, add the secrets: `wrangler secret put RESEND_API_KEY` and `wrangler secret put FRONTEND_URL` (needed for correct links in invitation/reset emails). The `[container] RESEND_API_KEY is not configured` warning in the server console is the reminder firing | Immediately before the first production deploy of the Workers backend                                                                                          |
| `@angular/build` pinned to exact **22.1.3** (regression 22.1.4+)             | Bundle analysis 2026-08 | `@angular/build` 22.1.4–22.1.6 changed esbuild chunk assignment: shared library chunks (rxjs + Angular common, ~483 kB) became **statically imported from `main.js`** → initial bundle 374 kB → 857 kB, breaching the 500 kB budget. Verified by bisect (22.1.3 = 374.53 kB, 22.1.4 = 857.15 kB). `ui/package.json` pins `"@angular/build": "22.1.3"` (exact, no caret)                                                                                                                                                 | When a `@angular/build` release ≥ 22.1.4 restores lazy chunking (test: `npm run build --workspace=ui`, initial must stay ≈ 374 kB) — then unpin and re-measure |
| Renovate config (`renovate.json`) for automated dependency updates           | `plan.md` Block 6.4     | Removed by decision after the one-off manual dependency update (all deps refreshed, `npm audit` 18 → 0). Renovate would re-automate this: grouped minor/patch PRs, separate major PRs, lockfile maintenance. Setup = install the Renovate GitHub App; the config itself is ~10 lines (`config:recommended`, grouped minor+patch, lockfile maintenance)                                                                                                                                                                  | After the current wave of changes is merged and CI is stable — so Renovate PRs don't pile on top of unreviewed refactors                                       |
| S-13 — per-isolate auth/membership cache                                     | `report-1.md` §4.2      | Adds statefulness on Workers; needs a design for invalidation (logout, role change) and TTLs                                                                                                                                                                                                                                                                                                                                                                                                                            | Measurable latency pain in auth/tenant-context waterfall                                                                                                       |
| S-20 — `Idempotency-Key` on `/register`, `/login`, `/invitations/:id/accept` | `report-1.md` §4.2      | Needs a KV/collection design and replay semantics                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Duplicate-submission bugs or mobile-client retries become real                                                                                                 |
| N-16 — `tenant-redirect.guard` → `CanMatchFn`                                | `plan.md` Block 7.7     | `CanMatch` runs before `paramMap` is populated; conversion would require hand-parsing URL segments                                                                                                                                                                                                                                                                                                                                                                                                                      | If the legacy `/tenants/:id` route is reworked anyway                                                                                                          |
| N-08 — `docs/{auth,observability,runbook,db-indexes,testing,data-model}.md`  | `report-1.md` §4.3      | Documentation effort, no runtime impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | After the architecture stabilizes post-refactor                                                                                                                |
| N-12 — benchmark `bcryptjs` vs WebCrypto PBKDF2                              | `report-1.md` §4.3      | Current CPU cost is acceptable; benchmark needs a Workers environment                                                                                                                                                                                                                                                                                                                                                                                                                                                   | If auth latency or CPU limits become an issue                                                                                                                  |
| Status/TaskType/Label id-addressed **write** methods tenant assertion        | Block 1 subagent report | Their `getX` methods are project-scoped; write methods rely on project-membership RBAC                                                                                                                                                                                                                                                                                                                                                                                                                                  | Next security pass — apply `assertTenantEntity` to update/delete paths                                                                                         |
