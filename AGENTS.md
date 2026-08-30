# AGENTS.md — Agent Entry Point

> Read this file first. It gives you the mental model of the repo in ~2 minutes. Deep details live in
> [`docs/architecture.md`](docs/architecture.md) — load sections on demand.

## What this is

**Task Board** — a mini-Jira: multi-tenant workspaces → projects → kanban boards / task tables / sprints, with comments,
labels, saved filters and an audit log. Monorepo with three npm workspaces.

## Stack

| Layer      | Tech                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| UI         | Angular 22 (zoneless, OnPush by default, Signal Forms, signals-first)                       |
| UI kit     | Spartan UI (`@spartan-ng/brain` headless + `helm` styled), Tailwind v4                      |
| i18n       | Transloco (11 locales in `ui/public/assets/i18n/`)                                          |
| Rich text  | Milkdown (`ui/src/app/shared/milkdown-editor/`)                                             |
| Server     | Hono on Cloudflare Workers (`nodejs_compat`)                                                |
| DB         | MongoDB (driver 7, **new MongoClient per request** — Workers kill sockets between requests) |
| Validation | Zod v4 via `@hono/zod-validator`                                                            |
| Auth       | JWT HS256 (`hono/jwt`), bcryptjs password hashing                                           |
| Email      | Resend (falls back to console logger without `RESEND_API_KEY`)                              |
| Tests      | Vitest (server + ui unit), Playwright (e2e in `ui/e2e/`)                                    |

Shared types/constants live in `shared/` (`@task-board/shared`) — runtime-library-free, single source of truth for both
server and UI.

## Commands

```bash
npm run build            # shared → server → ui
npm run typecheck        # shared + server tsc
npm test                 # vitest: run both server and ui suites
npm run lint             # eslint across repo
npm run dev --workspace=server   # wrangler dev (needs MONGODB_URI/JWT_SECRET in server/.dev.vars, gitignored)
npm start --workspace=ui         # ng serve
npm run test:e2e                 # playwright
```

Always verify with `typecheck` + `test` + `lint` before finishing a task.

## Boundaries (agent safety)

- Allowed by default: read/search files, run tests, typecheck, lint, build, local dev servers.
- Ask first: installing dependencies, changing `package.json`/lockfiles, schema or RBAC-matrix changes, destructive
  database operations (drop/delete of collections or data).
- Only when explicitly asked: `git commit`, `git push`. Never force-push or rewrite history.
- Never run automatically: `npm run deploy:server` / `deploy:ui` (production deploys) — prefer that a human runs them.
- Secrets (`server/.dev.vars` for local dev; Worker secrets + GitHub repo secrets for production): read only when
  genuinely necessary, never print, copy into reports, logs, or commits.

## Layout

```
server/src/   routes/ (thin handlers) · services/ · repositories/ · schemas/ (Zod)
              middleware/ · container.ts (DI composition root) · errors/
ui/src/app/   features/<domain>/<component>/ · services/ (*-client.ts) · stores/ · guards/
              interceptors/ · shell/ · shared/
shared/src/   types/ · constants/ · utils/
```

## Hard rules (must / must-not)

Full rationale in [`docs/architecture.md`](docs/architecture.md) §Decisions.

### Server

- **NEVER** access `getCollection()` inline in route handlers — go through a service.
- **NEVER** cache services/repositories/collections at module level — the MongoClient is per-request; use
  `container.ts` + `provideServices` middleware (`c.get('svc')`).
- Body validation: `zValidator('json', Schema)` + `c.req.valid('json')`. No hand-written body types.
- JWT: only `hono/jwt` (`sign`/`verify`). No custom crypto.
- Authorization: coarse checks in `middleware/rbac.ts`, fine-grained via `ensurePermission()` from
  `services/rbac.service.ts`. No ad-hoc role string comparisons.
- New repositories extend `BaseRepository` (`repositories/base.repository.ts`).
- Response envelope: `{ data }` on success, `{ error: { code, message, details? } }` on failure.

### UI

- Reads: `rxResource`/`httpResource` over a `*-client.ts` service, `hasValue()`-guarded computed reads, `defaultValue`
  set. Never read `.value()` of an errored resource without the guard (it throws).
- Query params: bound automatically to `input()` (`withComponentInputBinding` is enabled) — no manual
  `queryParams.subscribe`.
- Shared per-project reference data (statuses/types/sprints/labels/members): `ProjectRefStore` (`ensure()` /
  `invalidate()`), never re-fetch locally.
- Writes: explicit `.subscribe({ next, error })` with toast on error (`injectToasts()` + `getErrorMessage`).
  Mutation-heavy managers may keep manual loading signals.
- Stores: plain `@Service()` classes with signals. No NgRx.
- Forms: Signal Forms (`form()`/`schema()` from `@angular/forms/signals`).
- Rich text: `ui-milkdown-editor` (WYSIWYG ⇄ raw markdown toggle built in). Value is always markdown.
- UI kit: Spartan Helm components only — do not hand-roll buttons/dialogs/selects/etc.

### Both

- Naming: no type suffixes (`auth-client.ts`, class `AuthClient`; stores keep `-store` suffix; guards/interceptors/pipes
  keep theirs). Components in own folders with separate `.html`.
- Use `@Service()` decorator + `inject()`, never constructor injection.
- Never commit/push unless explicitly asked.

## Testing notes

- Server tests mock repos/services with `vi.mock`; route tests inject a fake `svc` via middleware — see any
  `routes/*.test.ts` `createTestApp()`.
- **UI tests are zoneless (Angular 22): `fixture.detectChanges()` is an ANTI-PATTERN — never use it.** It forces CD
  off-schedule and races the zoneless scheduler (intermittent "click didn't emit" / "translated text is empty" flakes).
  Canonical pattern (see `ui/src/app/shared/testing/zoneless.ts` and any migrated spec):
  1. In setup: `TranslocoTestingModule.forRoot({ ..., preloadLangs: true })`, then
     `await firstValueFrom(TestBed.inject(TranslocoService).load('en'))` (warms the cache before first render).
  2. After `createComponent` / `setInput` / simulated events: `await settle(fixture)` (helper = `whenStable()` +
     `TestBed.tick()`, bounded at 250 ms — some specs intentionally keep pending work).
  3. For native `.click()` on Angular-bound elements use `await clickUntil(() => el.click(), () => expect(effect))` —
     the listener attachment itself is racy, so retry the interaction until the effect is observed.
  4. Never select elements by translated text; use structural selectors (CSS/attributes/element order).
  5. Install `vi.useFakeTimers()` only AFTER setup/settle; `ui/test-setup.ts` resets to real timers after every test.
- UI resource-based components resolve asynchronously: poll the signal state
  (`for (… && !component.task()) await setTimeout(10)`) instead of fixed timeouts.
- **E2E/Playwright policy**: do NOT run Playwright/e2e after every iteration (too slow). When e2e or live-browser
  verification is needed, the ORCHESTRATING agent must delegate it to a subagent — never run it in the main agent's
  context (it bloats context with screenshots/snapshots). Unit tests (`npm test`) are fine to run directly.

## Where to dig deeper

- [`docs/architecture.md`](docs/architecture.md) — layers, request lifecycle, DI, RBAC matrix, data model summary,
  design decisions (must/must-not with rationale).
