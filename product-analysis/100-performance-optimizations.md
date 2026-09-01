# 100 — Performance: applied optimizations and future proposals

> Outcome of a multi-stage latency forensic investigation (Mongo/DO/Cloudflare + FE waterfall). All conclusions are
> measurement-based (driver events, `wrangler tail` wall/CPU, curl timing, browser network), not assumptions. Diagnostic
> tooling: [`tools/README.md`](../tools/README.md).

## 1. Context

Stack: Angular 22 (zoneless) → Cloudflare Worker (thin proxy) → Durable Object (Hono app + singleton MongoClient) →
MongoDB Atlas M0 (replica set, eu-central-1). Typical warm API request ~70-90ms; the investigation covered periodic
200-700ms spikes and the cold-load waterfall.

## 2. Applied optimizations (server / infrastructure)

### 2.1 Durable Object as the MongoClient holder

- **Problem:** workerd binds TCP sockets to the request context that created them (workerd#2721). A MongoClient in a
  plain Worker died with the request → error 1101.
- **Solution:** thin Worker proxy → DO owns the Hono app + singleton MongoClient (`DB_CLIENT_MODE=durable`, rollback:
  `per-request` via `--var`).
- **Result:** warm p50 ~75-90ms vs ~224ms (per-request mode measured — worse).
- **Note:** per-request mode is significantly worse and is not a solution (measured).

### 2.2 Explicit placement region (Frankfurt)

- Smart Placement never converged (INSUFFICIENT_INVOCATIONS with single-user traffic) and kept execution local (WAW).
  `region = "aws:eu-central-1"` in wrangler.toml → `cf-placement: remote-FRA`, next to Atlas.
- **Result:** DO→Atlas RTT dropped to single-digit ms.

### 2.3 Bundle minify (TOML pitfall)

- `minify = true` placed after `[placement]` in TOML silently became `placement.minify` and was ignored → bundle 3206
  KiB. Moving it above all table headers → 1860 KiB.
- **Lesson:** in TOML a bare key after a `[table]` header belongs to that table.

### 2.4 Mongo indexes for real query patterns

- Added `{projectId, title}` and `{projectId, statusId, updatedAt: -1}` — eliminate blocking SORT on /tasks as the
  collection grows (verified with explain at 500/2k/5k tasks).
- Existing indexes verified with explain("executionStats"): Mongo execution 0-3ms — never the bottleneck.

### 2.5 $lookup aggregations instead of sequential requests

- `findByTenantWithUsers` (members+users) and `findByUserWithTenants` (memberships+tenants): 2 RTT → 1 RTT. tenants
  139→114ms, members 147→121ms.

### 2.6 Parallel independent lookups in auth

- User lookup ∥ tenant membership lookup (membership depends only on the JWT sub + header). `tenantMembership` reused
  from the Hono context (`requireMembership(prechecked)`) — eliminated a duplicate query. /tasks DB phase: 47→18ms.

### 2.7 ROOT CAUSE of latency spikes: connectTimeoutMS as an idle-socket timeout

- **Symptom:** periodic 200-700ms spikes on any Mongo endpoint, at any cadence (250ms/1s/5s/10s), no correlation with
  query/sort/data size.
- **Mechanism (proven via driver events + mongodb 7.6.0 sources):** `connectTimeoutMS` is passed to
  `socket.setTimeout()` (cmap/connect.js:303) — a Node socket timeout fires after **inactivity**. A connection idle ≥5s
  (our non-default `connectTimeoutMS: 5000`) was killed with `reason='error'`; the next request paid a full TLS+auth
  handshake (~90-190ms, outliers to 2.4s). Monitor sockets (idle 10s between heartbeats) died every time →
  `serverHeartbeatFailed` ×3 → topology Unknown → `poolCleared` → reconnect.
- **Causal proof:** A/B 5000→30000→60000→120000 — the threshold moved exactly with the setting (at 30000: idle 29s
  survives/80ms, idle 31s dies/256ms; min lifetime 30283ms). With `connectTimeoutMS: 0` (`socket.setTimeout(0)` =
  timeout disabled) a connection survived 180s of idle without a single reconnect; the failure case is bounded by
  `serverSelectionTimeoutMS` (5018ms, no hang).
- **Fix:** the non-default `connectTimeoutMS` was removed (driver default 30000). See the comment in
  [`server/src/db/mongo.ts`](../server/src/db/mongo.ts).
- **Excluded hypotheses** (all experimentally): maxIdleTimeMS=30s, readPreference, replica-set member, query/sort/data
  size, app CPU, Cloudflare edge (ping clean), per-request client (worse), Atlas-side reap (not needed as an
  explanation).

### 2.8 Audit #2/#4: project_members lookup skipped for read-only requests (F3)

- `tenantContextMiddleware` resolved the caller's `project_members` role on EVERY project-scoped request — but the
  context value is consumed only by `requirePermission(action, true)` coarse gates, all of which sit on POST/PATCH
  routes; services resolve project roles themselves. For GET/HEAD the lookup is now skipped (**−1 Mongo op on every read
  request** for tenant MEMBERs). Write-route authorization unchanged; covered by 6 dedicated middleware tests.

### 2.9 /tasks/my: index + minimal projection (audit #3, 99e6b8e)

- `findAssignedTo` filtered by `{assigneeId}` alone — only the compound `{projectId, assigneeId}` index existed
  (projectId is its prefix) → **COLLSCAN**; response carried full task documents for a widget that renders
  number/title/priority.
- Index `{ assigneeId: 1, updatedAt: -1 }` in `CORE_INDEXES` (idempotent) + inclusion projection
  `{id, projectId, number, title, priority, createdAt, updatedAt}`. Explain: COLLSCAN (docsExamined = full collection) →
  IXSCAN (docsExamined = 50 for 50 returned); payload −74.6% (43 960 → 11 160 bytes for 50 tasks).

### 2.10 TOP-2: denormalized semantic sort names (306e618) and the `excludeDescription` flag (8112584, F5)

- Sorting by status/sprint ran an aggregation pipeline (`$lookup` + blocking `$sort` over all matches): measured **110
  ms** at 5k tasks for `?sort=statusId:desc`, growing linearly with the match set.
- `Task.statusName`/`Task.sprintName` denormalized (rename/delete fan-out via `setStatusNameForTasks` /
  `updateManyByStatus(name)` / `setSprintNameForTasks`; task create/update/bulk resolve names from the same batched
  reference lookups — M-14 preserved). Idempotent backfill `backfillTaskSortNames` + indexes
  `{projectId, statusName, number: -1}` / `{projectId, sprintName, number: -1}`.
- Explain after: **1 ms**, LIMIT → IXSCAN, docsExamined 50. **Deliberately NOT denormalized:** labelIds sort (fan-out of
  the alphabetically-first label was judged too expensive), assignee/reporter (their identity snapshots are already
  denormalized and stale-tolerant).

- **`excludeDescription` query flag** (same wave): omits `description` from list responses — measured **−41%** payload
  on a synthetic 400-char dataset and **−21.5%** on real data (200 tasks). Applied to the task table, overview recent
  tasks and the sprint task list; the board keeps descriptions for its card previews; server-side description search is
  unaffected.

### 2.11 TOP-3 №1+№2: bulk task updates in ONE bulkWrite + batched audit events (ae6c990, 5660171)

- `bulkUpdateTasks` used to run up to 100 sequential `findOneAndUpdate` (115.5 ms driver-side at 100 tasks, plus ~100
  Worker→Atlas RTTs) and then 100 sequential audit writes (139.7 ms, 200 ops counting actor lookups).
- `TaskRepository.bulkUpdateWithVersion`: ONE `bulkWrite` (ordered: false) with per-task optimistic-concurrency filters
  `{id, version}` + `$inc {version: 1}` — per-task semantics identical to the former loop. Audit phase:
  `AuditService.logMany` resolves the actor once and persists all events via one `insertMany`
  (`AuditEventRepository.createMany`, individual UUID/`createdAt` per event, empty batch = no-op).
- Measured (5050 tasks, bulk of 100): updates 115.5 → 7 ms; audit 139.7 → 4.5 ms; **end-to-end ~450 ms → ~40 ms** (DB
  operations ~400 → 5). Failure semantics (per-task VERSION_CONFLICT / TASK_NOT_FOUND / TASK_NOT_IN_PROJECT) preserved
  and tested.

## 3. Applied optimizations (frontend)

### 3.1 `/auth/bootstrap` — session init in one request

- Cold load: the sequential `GET /auth/me` → `GET /tenants` chain replaced by a single `GET /auth/bootstrap` (user +
  tenants, `Promise.all` over the two existing services).
- Deep-link critical path: 5 → 4 → (with the members fix) **3 RTT**.
- `TenantStore.tenantsLoaded` distinguishes "loaded and empty" from "not loaded" — guards skip a redundant `/tenants`.
- Session isolation: `logout()` clears the TenantStore; `seedFromBootstrap()` replaces the list (never merges) — fixed a
  tenant leak between sessions.

### 3.2 Members off the critical path (dd0e348)

- `loadProjectByKey()` no longer awaits `/projects/:id/members` — navigation continues immediately; `projectRole` is a
  reactive computed (OWNER/ADMIN bypass, MEMBER resolved from members when they arrive). Stale-response guard against
  cross-project races. **−1 RTT** per project/board deep-link.

### 3.3 ProjectRefStore — shared per-project reference data

- statuses/types/sprints/labels/members cached per project; M-12: members derived from the ProjectStore. Eliminated
  duplicate reference-data requests.

### 3.4 Audit #2: overview without a duplicate project fetch (F1)

- The overview re-fetched `GET /projects/:id` although `projectGuard` had just loaded the same project via
  `/projects/by-key/:key` into `ProjectStore`. The fetch is removed — the overview reads `ProjectStore.activeProject`;
  project mutations (settings update, archive/restore/delete) patch the store in place, so the read-only banner stays
  correct without a refetch. **−1 HTTP / −3 Mongo ops** per overview open.

### 3.5 ProjectRefStore: full-DTO cache (F2)

- The store now caches full DTOs (statuses/sprints/types/labels) per `${projectId}:${kind}`; the `SelectOption` layer is
  derived from the same cache (one fetch + one invalidation per kind per project session). Overview, board, sprint
  pages, board columns and the sprint list all read it — cross-page transitions (Overview ↔ Board ↔ Tasks ↔ Sprints) no
  longer re-fetch statuses/sprints (−2–3 duplicate HTTP per transition). Mutations invalidate/patch the cache; failed
  fetches stay uncached.

### 3.6 TenantHome + ProjectSwitcher share the project list (F4)

- Both used to issue an independent `GET /projects` on tenant home. A tenant-scoped cache in `ProjectStore`
  (`ensureProjectList` / `upsertProject` / `invalidateProjectList`) dedupes concurrent calls, patches the cached list on
  create/update/archive/restore/delete, isolates data per tenantId and drops everything on logout (stale-response guard
  against a late in-flight reply after logout). **−1 HTTP** per tenant home; the switcher stays consistent without
  refetching.

## 4. Future proposals (by expected value)

### 4.1 Class 2: pre-DB stall 140-320ms (edge/DO) — localized to platform level (2026-09-01)

- Keep-alive A/B across `/api/ping` (no Mongo, no DO logic) vs Mongo endpoints with `wrangler tail` worker-time
  decomposition: a **304ms spike occurred on /api/ping with Worker handler time 0ms** — the stall happens entirely
  outside our code (Cloudflare edge/DO scheduling). Baseline pre-Worker overhead: ~44ms (edge) on ping, ~70-76ms on
  DO-proxied routes (the DO hop itself ≈ 25-30ms). Frequency ~3-5% of requests. Not addressable in application code —
  effectively merged into 4.8 (platform-level).

### 4.2 Post-deploy transient hang 75-90s

- After every deploy the first/early request sometimes hangs 75-90s (does not scale with connectTimeoutMS, unrelated to
  idle). Likely DO handoff/connection storm during deploy. Investigate separately — this is worse than the regular
  spikes.

### 4.3 FE dedup: `/projects` — DONE (F4, 408658e)

- TenantHome + ProjectSwitcher now share a tenant-scoped cache in ProjectStore (dedupe/invalidation/logout clearing);
  `/projects/:id/boards` no longer exists (single-board model, doc 102).

- `/projects` is requested by TenantHome + ProjectSwitcher simultaneously; `/boards` by Sidebar + ProjectDetail. A
  shared per-tenant/per-project cache removes one duplicate per page.

### 4.4 Board projection DTO

- Board payload 199KB raw / 12.8KB gzip (200 tasks); the FE uses ~10 fields. A lightweight DTO saves ~5-15ms and
  traffic. Small gain — bundle with other API changes.

### 4.5 Semantic sort denormalization — DONE for statusName/sprintName (TOP-2, 306e618); labelIds deliberately deferred

- statusId/sprintId sorts are plain indexed sorts on denormalized names (2.10). The labelIds sort keeps its `$lookup`
  pipeline on purpose: the fan-out cost of the alphabetically-first label was judged too high for the benefit. The
  assignee/reporter sorts never needed it (identity snapshots).
- **labelIds audit (2026-09-01, benchmark on Mongo 8, 30% no-labels / 40% one / 30% two-four labels, 10 labels):** the
  `$lookup` pipeline (semantics: sort key = `$min(label names)`, no-label tasks = `\uffff` sentinel → last in ASC, first
  in DESC; blocking `$sort` over all matched docs, no index possible) measured **92 ms explain / 57 ms wall at 5k
  tasks** and **904 ms / 559 ms at 50k** (linear scaling, docsExamined = full match set). Variant B (multikey index over
  a denormalized `labelNames[]` array) is fast (<1 ms) but **semantically wrong on both ends**: multikey ASC sorts
  no-label docs first (pipeline: last) and DESC sorts by the _max_ element (pipeline: min). Variant C (scalar
  `labelSortName = min(names)` + `{projectId, labelSortName, number: -1}`) is **order-identical to the pipeline for ASC
  and DESC** (verified by exact id-order comparison) and costs <1 ms (24 ms deep-page at 50k). Deferral rationale: the
  only trigger is a manual click on the table's Labels column (default flows never sort by labels), 57-92 ms at
  realistic project sizes is acceptable, and variant C's rename/delete fan-out requires a _per-task_ min recompute (find
  affected → batched label names → bulkWrite) unlike TOP-2's constant-value `updateMany`. Revisit if label sort p95
  exceeds ~200 ms on production projects or projects >20k tasks actively sort by labels.
- Remaining candidate in the same area: a list DTO that drops `createdBySnapshot`/`createdById`/`version` from list
  responses — audited 2026-09-01, see 4.9 (DEFER).
- Dead code removed: `TaskRepository.search` / `TaskService.searchTasks` had no consumers (verified by grep, 2026-09-01)
  and were deleted in the cleanup commit (152b0ec); task search lives solely in `findByProject`'s `search` query
  parameter.

### 4.6 maxIdleTimeMS interplay

- connectTimeoutMS is now 30s and maxIdleTimeMS is 30s: the effective idle threshold is min(both) = 30s. If reconnects
  after 30-60s pauses become a complaint, raise maxIdleTimeMS (close reasons 'idle' vs 'error' are distinguishable in
  driver events).

### 4.7 Atlas M0 → M10+

- M0 shared tier: rare edge jitter ≤190ms, variable RTT. If M0 limits start to matter (connections/ops), M10 resolves it
  by definition. No evidence of hitting limits yet.

### 4.8 Accepted as-is

- Rare edge jitter ≤190ms outside Worker execution (ping probes clean on keep-alive) — platform-level; only addressable
  via Cloudflare plan/architecture.

### 4.9 Task list DTO / payload trimming — audited, DEFER (2026-09-01)

- Per-field accounting over a real 200-task page (CAP MAIN, 5 000 tasks): full response **210 395 B raw / 15 043 B gzip
  wire** (≈93% compression). Fields with zero UI consumers in any list: `createdById` + `createdBySnapshot` +
  `statusName` + `sprintName` (TOP-2 fields are server-internal sort keys; UI resolves display names via
  ProjectRefStore) → dropping them saves 15.1% raw (~1.5 KB wire). `version` is needed by board DnD and sprint mutations
  and costs 1 B/task. `labelIds` (10.3%) is used only by the task table; `reporterId`/`assigneeId` raw values are never
  rendered (snapshots are).
- Latency isolation by limit: limit=1 (+37 ms over ping) ≈ limit=20 (+43) ≪ limit=200 (+87) → payload costs ≈ **0.2
  ms/KB** (BSON transfer Atlas→Worker + JSON + gzip). Crucially, the existing `excludeDescription` flag (−43 KB raw)
  showed **no measurable latency gain** (136 vs 127 ms median — noise): payload trimming is a bytes-only optimization.
- DB side: exclusion projections do not change `docsExamined` (non-covered query, WiredTiger returns whole documents).
- Verdict DEFER: the heaviest list page is ~15 KB on the wire; the default response must stay backward-compatible, so
  the gain requires an opt-in flag + 4 client call sites for ~10% wire bytes and <1 ms. Revisit with any future task-DTO
  change, mobile/slow-network complaints, or payload monitoring showing list responses dominating. (Related: 4.4 board
  projection DTO, same conclusion.)
- Micro-inconsistency noted for a future cleanup: `toDomain` materializes `statusName ?? null` / `sprintName ?? null`,
  so even projected DTOs (`/tasks/my`) carry these two keys, unlike the absent-key pattern of `excludeDescription`.

### 4.10 Cloudflare Worker / Durable Object request-path audit — NO ACTION (2026-09-01)

- **Path (verified in code):** Browser → Worker ([`index.ts`](../server/src/index.ts): URL parse →
  `shouldProxyToDurable`, ping/health stay Worker-side) → `idFromName('mongo')` — **one global DO for everything** — →
  `get(id, { locationHint: 'weur' })` → ONE `stub.fetch` (no retries/redirects, no serial pre-work) →
  `MongoHonoDurableObject` runs the same Hono app (requestId → CORS → mongo-mode → provideServices → auth with user ∥
  membership in parallel → tenant-context (F3) → RBAC) → module-cached MongoClient singleton inside the DO isolate
  (`maxPoolSize: 5`). 135 tail events show a single `durableObjectId` — hot reuse, no pool-explosion risk.
- **Placement:** Smart Placement OFF (experiment A never converged — INSUFFICIENT_INVOCATIONS at single-user traffic);
  explicit `[placement] region = "aws:eu-central-1"` instead, **live-verified `cf-placement: remote-FRA`** on requests
  entering at WAW. DO locationHint `weur` is consistent with it. Atlas region: eu-central-1 _claimed_ in code comments —
  UNKNOWN factually (MONGODB_URI is a secret, not read); handler timings (~5 ms/op) support proximity.
- **Latency (50 keep-alive requests/endpoint):** ping p50 40 / max 46; 1-op endpoints 76-80; `limit=1` 80; `limit=200`
  p50 139 but p75 271 / p95 343 / max 761. Decomposition via `wrangler tail` (83 handler logs + client series): DO
  handler = p50 19 ms (`limit=1`) / p50 32 ms, **max 51 ms** (`limit=200`), i.e. ~5 ms per Mongo op; the `limit=200`
  tail is body transfer of 210 KB **uncompressed** (bench clients without `Accept-Encoding`; a browser receives ~15 KB
  gzip ≈ 3-5 ms — not user-facing) plus rare TTFB spikes (ping max 238, `limit=200` TTFB max 738) with handler ≤51 ms —
  platform variance, confirming 4.1.
- **Methodology note:** DO `wallTime` from `wrangler tail` (p50 265 ms) includes response-stream flush and must NOT be
  used for latency decomposition; the Hono request logs (`--> ... Xms`) are the correct handler-time source.
- **Cold vs warm:** deterministic DO eviction cannot be triggered safely; cold path from code = DO isolate start +
  mongodb dynamic import (~1.86 MB minified bundle) + client handshake ~300 ms, paid once per DO lifetime. Eviction
  frequency UNKNOWN (no restart instrumentation). Cheap future improvement: one log line in the DO constructor to count
  cold starts.

### 4.11 GET read-path / N+1 audit — NO ACTION (2026-09-01)

- Full inventory of hot GET paths (route → service → repo → Mongo ops) + keep-alive round-robin against production (15
  rounds, ping baseline 40 ms): 1-op endpoints (statuses/sprints/board/auth-me/my-tasks) sit +35-40 ms over ping;
  2-parallel-op task list +108 ms (payload, see 4.9); serial two-hop reads (task detail 86 ms, members 87 ms) +46-47.
  Effective Mongo RTT ≈ 10-18 ms per serial hop.
- **No N+1 anywhere in GET paths:** list enrichment uses `$lookup`/batched `findByIds` (project/tenant members), audit
  enrichment runs 3 dependent waves + 8 collections in `Promise.all` (R3-P7/V7-4), snapshots are denormalized, read-only
  paths run no permission lookups (F3), no duplicate fetches within a request. Auth middleware resolves user ∥
  tenant-membership in parallel and reuses the doc in tenant-context.
- Residual candidates (all small): (a) fuse the M-02 tenant-assert second hop (entity → project) into one `$lookup`
  aggregation in `getTask`/comments/`getSprint` — ~10-12 ms per task-detail open, medium complexity; (b)
  `getProjectMembers` runs `getProject` (404 gate) then the members aggregate sequentially — independent, could be
  `Promise.all`, ~10 ms on a rare admin page; (c) task-list payload — see 4.9. None passes the frequency ×
  avoidable-latency bar; the dominant costs (40 ms platform overhead, Mongo RTT) are not addressable in code (4.1, 4.7).

## 5. Tooling

Diagnostic scripts used during the investigation: [`tools/README.md`](../tools/README.md) (api-series — keep-alive
series with phases/pauses; parse-dbev — `wrangler tail` DBEV event parser correlated with client timestamps; curl-timing
— single-request decomposition).
