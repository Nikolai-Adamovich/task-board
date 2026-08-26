# 24 — Future Roadmap

Prioritized by research evidence (user demand × model fit × implementation cost). Nothing here blocks or distorts the
MVP model ([REQ §42]: additions must not break the core Tenant→Project→Task model).

---

## Tier 1 — immediately after MVP (high demand, low risk)

| Capability                                                          | Why                                                                                                                     | Model impact                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Notification center (in-app)** + assignment/mention notifications | Most-missed feature once teams grow; research shows fatigue only when noisy — start minimal (assigned/commented/status) | New Notification collection keyed by userId; no changes to core entities |
| **Real billing** replacing mock checkout                            | Seat-based pricing is the universal market model; boundary already isolated                                             | Billing provider adapter; plan/seat fields on Tenant                     |
| **Board card ordering** (fractional rank/LexoRank)                  | Drag order persistence; known upgrade path documented in doc 13                                                         | Add `rank` to Task per board column context                              |
| **WIP limits** (guidance mode)                                      | Standard kanban expectation; Atlassian-documented value                                                                 | Optional column metadata                                                 |
| **Custom Task Types UI**                                            | Model already supports it ([REQ §11]); only admin UI missing                                                            | None                                                                     |

## Tier 2 — growth phase

- **Advanced full-text search** (Atlas Search) when substring search degrades.
- **Saved views** beyond filters (column sets, groupings).
- **Bulk task operations** (multi-select edit/move) with parent+child audit events pattern.
- **Project templates** (seed variants).
- **Reporting**: carry-over %, cycle time, status distribution — cheapest metrics first
  ([14-sprint-analysis.md](14-sprint-analysis.md) §7).
- **File attachments** with storage limits (per-seat storage is a proven monetization lever).
- **Email digests** (daily/weekly) as the quiet notification layer.

## Tier 3 — platform expansion

- **Integrations**: GitHub/GitLab link-aware tasks, Slack notifications, webhooks. Research shows integration depth
  drives engineering adoption more than feature count.
- **Automation rules** (trigger-action builder) — metered like incumbents.
- **Custom workflow transition graphs** (constraints on status changes per type).
- **Dashboards** (tenant/project level widgets).
- **SSO/SCIM** for enterprise readiness.
- **AI features**: summaries, triage suggestions, duplicate detection — market table-stakes direction but explicitly not
  MVP ([02-market-research.md](02-market-research.md) §5).

## Deliberately never planned

- Multi-project task homing (Asana-style) — rejected: doubles data-model complexity for non-target use case.
- Sprint-owned boards / simultaneous multi-board display — contradicts fixed decisions.
- Viewer write operations — final decision.

## Sequencing rationale

Tier 1 items either complete an existing loop (notifications close the collaboration loop; billing completes onboarding)
or fill documented gaps at low architectural cost. Tier 2 scales usage depth; Tier 3 broadens surface. Each tier assumes
the previous one's data model landed without rework — which the domain model was designed to permit
([09-domain-model.md](09-domain-model.md)).
