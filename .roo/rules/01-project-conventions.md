# Task Board — project conventions (always-on)

Read `AGENTS.md` first for the full mental model; read `docs/architecture.md` sections on demand.

## Stack facts (do not fight them)

- Angular 22, zoneless, OnPush default. Signals-first: `input()`/`output()`, `computed()`, native control flow
  (`@if/@for/@switch`). No NgRx, no `*ngIf`, no `ngClass`.
- Server: Hono on Cloudflare Workers + MongoDB driver 7 + Zod v4.
- UI kit: Spartan Helm only (`@spartan-ng/helm/*`). Never hand-roll buttons/dialogs/selects.
- Rich text: `ui-milkdown-editor` (value is always markdown).

## MUST

- Server DI: services come from the request-scoped container — `c.get('svc').x` (`container.ts` + `provideServices`
  middleware). Never call `getCollection()` in routes, never cache services/collections at module level. The
  `MongoClient` itself is cached per isolate (singleton experiment, `db/mongo.ts`; rollback via
  `DB_CLIENT_MODE=per-request`).
- Migrations never run in the request path — `server/scripts/migrate.ts` runs them from CD before the Worker deploy.
- Body validation: `zValidator('json', Schema)` + `c.req.valid('json')`.
- JWT: `hono/jwt` only. Authorization: `ensurePermission()` from `services/rbac.service.ts`.
- New repositories extend `BaseRepository`. Response envelope `{ data }` / `{ error: { code, message } }`.
- UI reads: `rxResource` over a `*-client.ts` service with reactive `params`, `defaultValue`, and `hasValue()` guards
  before reading/updating `.value` (throws in error state otherwise).
- Query params: bind to `input()` (`withComponentInputBinding` is on) — no manual subscriptions.
- Per-project reference data (statuses/types/sprints/labels/members): `ProjectRefStore`.
- Errors: `getErrorMessage(err)` + toast via `injectToasts()`; never swallow or console-only.
- Naming: no type suffixes (`auth-client.ts`/`AuthClient`; stores keep `-store`; guards/interceptors/pipes keep theirs).
  Components in own folders with separate `.html`.

## MUST NOT

- No module-level caching of request-scoped state on the server (Workers reuse isolates).
- No hand-written body types next to Zod schemas; no `as never` around validated bodies.
- No custom JWT/crypto — `hono/jwt` only.
- No ad-hoc role string comparisons — use rbac matrices / `ensurePermission()`.
- No NgRx / BehaviorSubject stores; no constructor injection; no `@HostBinding/@HostListener`.
- Do not commit/push unless the user explicitly asks.

## Verification before finishing any task

```bash
npm run typecheck && npm test && npm run lint
```

Both suites must stay green.

## E2E / Playwright policy

- Do NOT run Playwright/e2e after every iteration — it is too slow.
- When e2e or live-browser verification is needed, delegate it to a subagent. The orchestrating/main agent must not run
  Playwright itself (screenshots/snapshots bloat the main context).
- Unit tests (`npm test`) are fine to run directly.
