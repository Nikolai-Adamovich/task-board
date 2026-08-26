# 22 — Non-Functional Requirements

Targets are engineering goals with stated assumptions, not invented SLAs. Platform reality: Cloudflare Workers + MongoDB
(per-request client), Angular 22 zoneless UI.

---

## 1. Performance

| ID     | Requirement                                                                                                           | Target / assumption                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| NFR-P1 | Task list API responses are server-paginated; a page request reads only the requested page                            | p95 < 300 ms for ≤100k tasks/project with the documented indexes ([15-search-filter-pagination.md](15-search-filter-pagination.md)) |
| NFR-P2 | Board initial load renders within 1 s on broadband for boards ≤500 tasks (per-column windows of ~50)                  | Assumes indexes `{projectId,statusId,number}`                                                                                       |
| NFR-P3 | Perceived latency: field saves and board moves apply optimistically (<100 ms local feedback) with rollback on failure | Research: perceived speed drives adoption ([02-market-research.md](02-market-research.md) P2/P6)                                    |
| NFR-P4 | No unbounded queries: every list endpoint enforces limit cap (default 30, max 100)                                    | BR-043                                                                                                                              |

## 2. Scalability

- Horizontal by design (Workers stateless; MongoDB per-request clients).
- Counters use atomic `$inc` — no read-modify-write races.
- Audit events append-only; partitioning/archival deferred until volume demands.
- Assumption: single-digit-thousand tenants, ≤100k tasks per project in foreseeable horizon; Atlas Search introduced
  only beyond substring-search viability.

## 3. Availability & reliability

- Target: standard Workers availability (no custom uptime SLA claimed for MVP).
- **Deployment prerequisite (DEC-025):** MongoDB must run as a replica set in every environment — local Docker uses a
  single-node replica set, production uses Atlas Free — so transactional operations (project seed) behave identically
  everywhere.
- Graceful degradation: email failures must not fail invitation creation (queue/retry or console fallback + status
  surfaced to admin).
- Project seed atomicity: transaction where topology supports, otherwise compensating cleanup ensuring no partially
  initialized Projects are visible (BR-003).

## 4. Observability

- Structured request logs with correlation ids; error codes from the documented vocabulary ([REQ §38]).
- Audit trail doubles as business-level observability.
- Email delivery status recorded per invitation (research recommendation).

## 5. Accessibility

- WCAG 2.1 AA as target: keyboard paths for all primary actions including board moves (non-drag alternative mandatory —
  [13-board-and-kanban-analysis.md](13-board-and-kanban-analysis.md) §1.4); visible focus states; live-region
  announcements for async state changes; i18n via Transloco (11 locales already scaffolded in repo).

## 6. Responsive behavior

- Desktop-first; tablet fully usable; phones: content readable, core reads work, complex interactions (board drag)
  degrade to menus/stacked views. Full mobile optimization deferred.

## 7. Security

See [21-security-and-abuse-considerations.md](21-security-and-abuse-considerations.md). Summaries: server-side
authorization everywhere, scope predicates in all queries, rate limiting on auth/invitation endpoints, sanitized
markdown rendering, hashed tokens.

## 8. Maintainability

- Layered server (routes → services → repositories) with request-scoped DI container; no module-level caching of
  request-scoped state (Workers isolate reuse).
- Shared types in `shared/` as single source of truth.
- Naming conventions per repo rules (no type suffixes etc.).

## 9. API consistency

- Envelope `{data}` / `{error:{code,message,details?}}`; Zod-validated bodies; conventional REST shapes per [REQ §36];
  version field on concurrent entities; cursor/window pattern only where page/limit doesn't fit (board columns).

## 10. Data integrity

- Unique indexes as specified ([REQ §35]); optimistic concurrency on Tasks; atomic counter for task numbers; cascade
  semantics defined per entity deletion (docs 09/10).
- All timestamps UTC server-side.

## 11. Internationalization & localization

- All user-facing strings through Transloco; locale files for 11 languages maintained; date/number formatting
  locale-aware (repo already scaffolds this).

## 12. Compliance posture (future-facing)

No certifications claimed. Design choices that keep doors open: append-only audit, tenant isolation tests,
snapshot-based historical identity (GDPR-friendly erasure of live identity while preserving record readability is a
tension to revisit if real customers require GDPR erasure — noted in [25-open-questions.md](25-open-questions.md)).
