# 00 — Executive Summary

Self-contained overview; details live in the numbered documents.

---

## 1. Product vision

A **multi-tenant project-management application for software/product teams** — the backbone of classic Jira (statuses,
types, sprints, boards, memberships, history) with the friction profile of Linear (opinionated defaults, speed, minimal
setup). Research shows the "80% of Jira's power without the config overhead" middle ground is a recognized, underserved
gap ([02-market-research.md](02-market-research.md) §4).

## 2. Target users

Small-to-mid software teams (3–50 people) plus non-engineering stakeholders (PMs, QA, viewers). Explicitly not targeting
500+ enterprises needing compliance workflow engines ([01-product-overview.md](01-product-overview.md) §2).

## 3. Core workflows

1. **Onboarding:** Register → first Tenant → mock checkout (Free) → Project auto-seeded (types/statuses/board) → first
   Task in minutes.
2. **Daily work:** Board/Tasks views over the same data; inline field editing with optimistic concurrency; comments;
   labels with case-insensitive reuse.
3. **Sprint cycle:** plan future sprints (dates optional) → start (fills startDate) → work on sprint-scoped board →
   complete manually (fills endDate, disposes unfinished tasks explicitly).
4. **Team management:** invitation lifecycle (PENDING/EXPIRED-derived/DECLINED/REVOKED), revoke/restore with explicit
   messaging, removal that preserves all history.
5. **Administration:** archive-first destructive model with grace periods and typed confirmations.

## 4. MVP scope

Full detail in [23-mvp-scope.md](23-mvp-scope.md). Must-have = complete daily loop + safe administration: auth &
onboarding, tenant/project CRUD with atomic seeding, tasks with optimistic concurrency, comments, labels, statuses (with
mandatory-replacement deletion), boards (multi-status columns, per-user preference), sprints (manual lifecycle), full
invitation/membership flows, 5-role permission matrix enforced server-side, URL-addressable search/filter/pagination,
saved filters, snapshot-based historical search, audit events with task history tab, transactional emails, complete
state UX spec. Notifications center, real billing, attachments, integrations are deferred.

## 5. Key domain concepts

`User → Tenant → Project → Tasks`; Backlog = `sprintId = null` (not an entity); Status ≠ Board Column (columns group
statuses); Boards are Project-level view configs; selected board is a per-user preference; historical identity snapshots
keep authorship readable/searchable after User deletion. Authoritative definitions:
[26-product-glossary.md](26-product-glossary.md); conceptual model: [09-domain-model.md](09-domain-model.md).

## 6. Major business rules

45 cataloged rules ([10-business-rules.md](10-business-rules.md)). The most consequential: atomic project seed (BR-003),
default status on creation (BR-007), optimistic concurrency (BR-010), status-deletion replacement semantics
(BR-016/017), sprint date population rules (BR-024..027 — endDate never auto-completes), explicit invitation acceptance
(BR-036), history preservation on any member/user removal (BR-014/038/039), server-side pagination caps (BR-043).

## 7. Permission model

Two scoped layers resolved per request: Tenant roles (Owner/Admin/Member) and Project roles (Project
Admin/Editor/Viewer); Tenant Owner/Admin act across Projects without memberships; Viewer strictly read-only;
archived/deletion-pending states block writes for everyone except restore/cancel. One matrix in
[11-permissions-and-roles.md](11-permissions-and-roles.md) — deliberately small because permissions confusion is a
documented top complaint about incumbents.

## 8. Recommended UX architecture

Three navigation scopes (Tenant / Project / Task) with stable deep-linkable URLs; board and table as sibling views of
one task store; per-column windowed board loading; optimistic updates with rollback everywhere; non-drag move paths for
accessibility; systematic loading/empty/error/forbidden/not-found/archived/conflict states
([06-information-architecture.md](06-information-architecture.md),
[08-screen-and-page-specification.md](08-screen-and-page-specification.md),
[20-error-empty-loading-states.md](20-error-empty-loading-states.md)).

## 9. Major risks

| Risk                                                                | Mitigation                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Complexity creep post-MVP                                           | Non-goals list enforced; roadmap tiers gated ([24-future-roadmap.md](24-future-roadmap.md)) |
| Silent data loss perception                                         | Mandatory conflict UI; rollback toasts (DEC-009)                                            |
| Sprint model confusion (unrestricted transitions vs industry norms) | Overdue indicators + multi-active warning (OQ-003), completion dialog (BR-031)              |
| GDPR tension with historical snapshots                              | Flagged as OQ-006 with pseudonymization recommendation before real customers                |
| Email deliverability undermining invitations                        | Delivery-status logging; resend flow; console fallback                                      |

## 10. Important unresolved questions

Six genuinely open items in [25-open-questions.md](25-open-questions.md): ownership-transfer rights (OQ-002), comment
moderation beyond own (OQ-004), key immutability after first task (OQ-005), GDPR erasure policy (OQ-006), session/token
strategy (OQ-007), project-creation rights for members (OQ-008). Email verification (OQ-001) and multi-active-sprint
policy (OQ-003) were resolved via the implementation gap analysis
([28-implementation-gap-analysis.md](28-implementation-gap-analysis.md), DEC-016..DEC-030).

## 11. Top 20 implementation priorities

1. Auth (register/login/logout/reset) with neutral error semantics
2. First-Tenant onboarding incl. mock checkout boundary
3. Project creation with atomic seed (types/statuses/board/defaults)
4. RBAC middleware + `ensurePermission()` service (matrix enforcement)
5. Task CRUD + atomic counter numbering
6. Optimistic concurrency + conflict resolution UI
7. Milkdown markdown description editing
8. Comments with author snapshots
9. Labels with case-insensitive reuse
10. Statuses admin incl. replacement-aware deletion
11. Boards: config, multi-status columns, drag w/ rollback + keyboard path
12. Per-user board preference
13. Sprints: lifecycle, date population, completion dialog
14. Invitations: token lifecycle, emails, acceptance edge cases
15. Membership revoke/restore/remove flows with messaging
16. Tasks table: filters/sort/pagination/URL state
17. Saved filters
18. Snapshot-based name search
19. Audit events + task History tab
20. Systematic state UX (loading/empty/error/forbidden/archived) + i18n strings

---

**Package map:** research basis [02](02-market-research.md)[03](03-competitor-analysis.md) · people
[04](04-user-personas.md) · behavior [05](05-user-stories.md)–[08](08-screen-and-page-specification.md) · model
[09](09-domain-model.md)–[14](14-sprint-analysis.md) · systems
[15](15-search-filter-pagination.md)–[22](22-non-functional-requirements.md) · scope
[23](23-mvp-scope.md)–[25](25-open-questions.md) · reference
[26](26-product-glossary.md)–[27](27-traceability-matrix.md) · governance [decision-log.md](decision-log.md) /
[sources.md](sources.md).
