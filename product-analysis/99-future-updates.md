# 99 — Future Updates (Deferred Work)

> Long-lived parking lot for improvements that were analyzed during the 2026 audit remediation but deliberately
> deferred. Each entry records **why it matters**, **what problem it solves**, and **what it would cost**, so a future
> session can pick it up without re-doing the analysis.

---

## 1. Branded `Id` types (S-02) — DEFERRED

**Status:** deferred by decision (2026 audit follow-up).

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

This is exactly the class of mistake behind the IDOR findings fixed in the 2026 security pass (M-01/M-02/S-04):
cross-tenant and cross-entity reads happened because nothing in the type system distinguished "an id of the right
entity, resolved inside the right tenant" from "any string the client sent".

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
2. **Removes the remaining unsafe casts** that exist only because types are too loose.
3. **Self-documenting signatures**: `getTaskByKey(tenantId: TenantId, key: ProjectKey, number: number)` states its trust
   requirements in the signature.

### Why it was deferred

- **Blast radius**: every `id: string` field in `shared/src/types/*.ts` (~18 type files), every repository method
  signature, every service, every route handler that reads `c.req.param(...)`, and a large share of the UI
  (`*-client.ts` services, stores, components) — realistically **hundreds of touch points** across all three workspaces.
- **Boundary noise**: raw strings enter at many edges (HTTP params, JWT claims, MongoDB `_id`s, localStorage). Each
  needs an explicit `asX()` conversion, or the brands get erased with a cast — which defeats the purpose. Doing this
  half-way (brands in shared, casts at the edges) gives little value.
- **Low marginal payoff right now**: the actual IDOR holes were fixed structurally (tenant-assert helper, tenant-scoped
  lookups, tests). Brands prevent _future_ mistakes of this class; they don't fix an existing bug.
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

Recommended execution: as a standalone branch with the standard gate (`npm run typecheck && npm test && npm run lint`)
after each workspace conversion.

### Related leftover from S-02 (done separately, without brands)

The cast cleanup that does **not** require brands was already handled:

- `as never` in [`server/src/services/task.service.ts`](../server/src/services/task.service.ts) (bulk update payload),
- production `as unknown as` in [`server/src/db/mongo.ts`](../server/src/db/mongo.ts) (topology introspection),
  [`server/src/middleware/auth.ts`](../server/src/middleware/auth.ts) (JWT payload),
  [`server/src/repositories/task.repository.ts`](../server/src/repositories/task.repository.ts) (BSON projection).

These are localized type-safety fixes; brands would only make them structurally impossible, not more correct.

---

## 2. Other deferred items

| Item                                                                         | Source                  | Why deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Revisit when                                                                                                      |
| ---------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Production deploy checklist: email secrets**                               | Pre-deploy reminder     | Without `RESEND_API_KEY` the server falls back to `ConsoleEmailService` ([`server/src/container.ts:119-130`](../server/src/container.ts:119)) — emails are NOT delivered, invitation/reset tokens are only logged (masked). CD (`.github/workflows/cd.yml`) now handles this automatically: it sets `FRONTEND_URL` as a deploy-time var and uploads `RESEND_API_KEY` as a Worker secret whenever the repo secret of that name exists. If the repo secret is absent, emails fall back to `ConsoleEmailService` — invitation/reset tokens are only logged (masked). The `[container] RESEND_API_KEY is not configured` warning in the server console is the reminder firing                                                                                                                                                                                                                                 | Immediately before the first production deploy of the Workers backend                                             |
| **Bundle size — optional further reductions**                                | Bundle audit 2026-08    | The initial bundle was reduced 857.14 → 684.48 kB raw / 201.93 → 164.76 kB gzip and the budget re-based (`maximumWarning: 750kB`, `maximumError: 1MB` in [`ui/angular.json`](../ui/angular.json)). The remaining initial is the irreducible framework floor (~523 kB with zero app code: @angular/core+rxjs 180.8, router 77.5, CDK 124.5 — required eagerly by the header's Helm menus — styles.css 121.5, common 37.7, transloco 16.1). The lazy-chunk graph is clean (no duplication, no dead deps). Two **optional** reductions remain, both with product trade-offs: (1) trim highlight.js grammars `css` + `sql` + `yaml` + `diff` (~22 kB raw / ~5 kB transfer) if those languages never appear in task code fences; (2) drop GFM tables (`prosemirror-tables` 47.3 kB + `micromark-extension-gfm-table` ~9 kB) if markdown tables are not a supported editor feature — **editor behavior change** | If first-load metrics become a priority, or the product confirms code fences / markdown tables are unused         |
| Renovate config for automated dependency updates                             | Dependency refresh 2026 | Removed by decision after the one-off manual dependency update (all deps refreshed, `npm audit` 18 → 0). Renovate would re-automate this: grouped minor/patch PRs, separate major PRs, lockfile maintenance. Setup = install the Renovate GitHub App; the config itself is ~10 lines (`config:recommended`, grouped minor+patch, lockfile maintenance)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | After the current wave of changes is merged and CI is stable — so Renovate PRs don't pile on unreviewed refactors |
| S-13 — per-isolate auth/membership cache                                     | 2026 audit              | Adds statefulness on Workers; needs a design for invalidation (logout, role change) and TTLs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Measurable latency pain in auth/tenant-context waterfall                                                          |
| S-20 — `Idempotency-Key` on `/register`, `/login`, `/invitations/:id/accept` | 2026 audit              | Needs a KV/collection design and replay semantics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Duplicate-submission bugs or mobile-client retries become real                                                    |
| N-16 — `tenant-redirect.guard` → `CanMatchFn`                                | 2026 audit              | `CanMatch` runs before `paramMap` is populated; conversion would require hand-parsing URL segments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | If the legacy `/tenants/:id` route is reworked anyway                                                             |
| N-08 — `docs/{auth,observability,runbook,db-indexes,testing,data-model}.md`  | 2026 audit              | Documentation effort, no runtime impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | After the architecture stabilizes post-refactor                                                                   |
| N-12 — benchmark `bcryptjs` vs WebCrypto PBKDF2                              | 2026 audit              | Current CPU cost is acceptable; benchmark needs a Workers environment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | If auth latency or CPU limits become an issue                                                                     |
| Status/TaskType/Label id-addressed **write** methods tenant assertion        | Security pass 2026      | Their `getX` methods are project-scoped; write methods rely on project-membership RBAC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Next security pass — apply `assertTenantEntity` to update/delete paths                                            |
