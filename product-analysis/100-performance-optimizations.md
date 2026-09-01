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

## 4. Future proposals (by expected value)

### 4.1 Class 2: pre-DB stall 140-320ms (edge/DO) — localize

- A measured delay class occurring **before** the first Mongo driver interaction (commands during it are 8-23ms, no new
  connections). The edge→Worker vs DO scheduling split is not observable with current tooling. Next step: a marker at
  Worker entry before the proxy + a long series capturing Class-2 episodes.

### 4.2 Post-deploy transient hang 75-90s

- After every deploy the first/early request sometimes hangs 75-90s (does not scale with connectTimeoutMS, unrelated to
  idle). Likely DO handoff/connection storm during deploy. Investigate separately — this is worse than the regular
  spikes.

### 4.3 FE dedup: `/projects` and `/projects/:id/boards`

- `/projects` is requested by TenantHome + ProjectSwitcher simultaneously; `/boards` by Sidebar + ProjectDetail. A
  shared per-tenant/per-project cache removes one duplicate per page.

### 4.4 Board projection DTO

- Board payload 199KB raw / 12.8KB gzip (200 tasks); the FE uses ~10 fields. A lightweight DTO saves ~5-15ms and
  traffic. Small gain — bundle with other API changes.

### 4.5 Semantic sort denormalization

- Sorting by name-like fields (assignee/status display) requires a join at read time; denormalizing display fields into
  the task document removes client-side sorting.

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

## 5. Tooling

Diagnostic scripts used during the investigation: [`tools/README.md`](../tools/README.md) (api-series — keep-alive
series with phases/pauses; parse-dbev — `wrangler tail` DBEV event parser correlated with client timestamps; curl-timing
— single-request decomposition).
