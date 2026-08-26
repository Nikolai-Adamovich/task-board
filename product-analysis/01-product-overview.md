# 01 — Product Overview

**Status:** Product analysis deliverable **Inputs:** `business_analysis/project-management-requirements.md`,
`business_analysis/project-management-user-flows.md`, external research (see [sources.md](sources.md))

---

## 1. What the product is

A **multi-tenant project-management web application for software/product teams**, conceptually similar to a simplified
classic Jira:

```
User → Tenant → Project → Tasks (+ Boards, Sprints, Statuses, Types, Labels, Comments, Members)
```

It is a serious, production-quality system — not a toy CRUD app — but it deliberately trades Jira-style configurability
for **opinionated defaults and low friction**, following the pattern that made Linear successful
([ideaplan.io comparison](https://www.ideaplan.io/compare/jira-vs-linear-vs-asana);
[youngju.dev deep dive](https://www.youngju.dev/blog/culture/2026-05-16-project-management-issue-tracker-2026-linear-jira-asana-clickup-height-shortcut-plane-deep-dive.en)).

## 2. Target users

| Segment             | Description                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Primary             | Small-to-mid software/product teams (roughly 3–50 people) that want issue tracking + kanban + sprints without an administrator role |
| Secondary           | Non-engineering stakeholders (PMs, QA, managers) who read boards, comment, and occasionally create tasks                            |
| Explicit non-target | 500+ person enterprises needing workflow compliance engines, cross-team dependency mapping, SSO/SCIM, audit certification           |

Personas are detailed in [04-user-personas.md](04-user-personas.md).

## 3. Core problem

Established tools fail small teams in two opposite ways:

1. **Jira**: powerful but slow, configuration-heavy, "accidental complexity" — recurring complaints across Reddit/HN
   threads include sluggish cloud performance on large backlogs, admin settings nobody understands, plugin fatigue, and
   permission schemes too complex to reason about
   ([ones.com Reddit synthesis](https://ones.com/blog/real-talk-from-reddit-jira-project-management-pros-cons/);
   [HN Ask: Jira Alternatives](https://news.ycombinator.com/item?id=27018935)).
2. **Trello/simple kanban tools**: pleasant but lack sprints, structured statuses, task types, and historical reporting.

The gap: **a tool with the backbone of Jira (statuses, types, sprints, boards, memberships, history) and the friction
profile of Linear (fast, opinionated defaults, minimal setup)**.

## 4. Product goals

| #   | Goal                                                  | Measure of success                                                                       |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| G1  | Time-to-first-task under 5 minutes from registration  | Onboarding flow (register → tenant → mock checkout → project → task) has no dead ends    |
| G2  | Zero-configuration useful defaults                    | Every new Project is immediately usable: types TASK/BUG/STORY, 5 statuses, default Board |
| G3  | History is never silently destroyed                   | User deletion, member removal, status deletion all preserve human-readable history       |
| G4  | Permissions are simple enough to explain in one table | Single permission matrix ([11-permissions-and-roles.md](11-permissions-and-roles.md))    |
| G5  | URL-addressable state                                 | Any task list view can be bookmarked/restored (`?page=&limit=&sort=`)                    |
| G6  | Safe destructive actions                              | Archive-first philosophy; hard delete requires grace period + explicit confirmation      |

## 5. Non-goals (initial release)

Carried over from the requirements doc §40 plus research-informed deferrals:

- Real file attachments (links are Markdown text).
- Custom workflow transition graphs (statuses exist; no transition rules engine).
- Sprint-owned boards; multiple simultaneously displayed boards.
- Viewer write operations (Viewer is strictly read-only — final decision).
- Automatic sprint completion when `endDate` passes (final decision).
- A full notification center.
- Real payment processing (mock checkout only).
- Epics/subtask hierarchies, custom fields, automation builders, integrations marketplace.

Rationale: these are the exact features whose _absence_ keeps the product fast and understandable; every competitor
analysis shows complexity debt accumulating from them
([apptension guide](https://apptension.com/guides/best-saas-project-management-tools-for-software-development-teams-jira-vs-linear-vs-asana):
"too many custom fields nobody uses… you end up managing Jira instead of shipping").

## 6. Core concepts

See [26-product-glossary.md](26-product-glossary.md) for authoritative definitions. Summary:

- **Tenant** — top-level organizational boundary (a company/team workspace). One Tenant Owner.
- **Project** — work container inside a Tenant; owns Tasks, Statuses, Types, Labels, Boards, Sprints, Memberships.
- **Task** — unit of work (`PROJ-123`), always inside one Project, always has Type + Status.
- **Status vs Board Column** — different concepts; a column may group several statuses.
- **Sprint** — timeboxed grouping reference; Backlog = `sprintId = null` (not an entity).
- **Board** — Project-level visual configuration; selected Board is a per-user preference.
- **Membership / Invitation** — access control at Tenant and Project level.
- **Historical identity snapshot** — display-name snapshots survive User deletion.

## 7. Product principles

1. **Defaults over configuration.** New Projects work immediately; customization (statuses, labels, boards) is available
   but optional.
2. **Speed as a feature.** Optimistic UI updates with rollback, server-side pagination, indexed queries. Research shows
   perceived speed is the #1 driver of tracker adoption for engineering teams
   ([HN discussion](https://news.ycombinator.com/item?id=48437609)).
3. **History is sacred.** Deleting a User/Member never erases readable authorship; search works against snapshots.
4. **Backend is authoritative.** UI hiding/disabling is convenience, not security.
5. **Explicit over inferred.** The app never runs behavior the user didn't ask for (no auto-completing sprints, no
   auto-deleting tasks).
6. **Archive before delete.** Destructive paths get warnings, confirmation typing, and grace periods.

## 8. Major workflows

1. **Onboarding:** Register → Create first Tenant → Mock checkout (Free plan) → Create first Project (auto-seeded) →
   Create first Task.
2. **Daily work:** Open Board/Tasks → create/edit/comment/move Tasks → filter/search.
3. **Sprint cycle:** Plan future Sprint → assign Tasks → Start Sprint → work on Sprint Board → Complete Sprint
   (incomplete tasks handled explicitly) → repeat.
4. **Team management:** Invite by email → accept → assign roles → revoke/restore/remove.
5. **Administration:** Manage statuses/types/labels/boards; archive/delete projects with grace period.

Detailed flows: [07-user-flows.md](07-user-flows.md).

## 9. Existing decisions honored by this analysis

All decisions listed in the product brief are treated as fixed (MongoDB, default types/statuses/board,
backlog-as-null-sprint, board-per-user preference, unrestricted sprint transitions, optimistic concurrency,
case-insensitive labels, snapshot-based historical identity, read-only Viewer, derived invitation expiration, page/limit
pagination, mandatory replacement on used-status deletion, archive-over-delete). Where research surfaced tension (e.g.,
Jira's "one active sprint" convention vs. our unrestricted model), it is recorded in [decision-log.md](decision-log.md)
rather than silently changed.
