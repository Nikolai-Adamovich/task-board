# 02 — Market Research

**Method note:** Claims below are triangulated across official pricing pages, comparison articles, and community
discussions. Source registry: [sources.md](sources.md). "Observed fact" = directly documented; "Convention" = consistent
industry practice; "Recommendation" = our judgment.

---

## 1. Market overview

The project-management / issue-tracking market splits into four camps
([youngju.dev deep dive, 2026](https://www.youngju.dev/blog/culture/2026-05-16-project-management-issue-tracker-2026-linear-jira-asana-clickup-height-shortcut-plane-deep-dive.en)):

| Camp                    | Audience                               | Representatives                                  |
| ----------------------- | -------------------------------------- | ------------------------------------------------ |
| Developer-first         | Engineers, fast cycles, keyboard-first | Linear, Shortcut, GitHub Projects, GitLab, Plane |
| General work management | Marketing/design/ops, whole company    | Asana, ClickUp, Monday.com, Notion               |
| Enterprise / standard   | Large orgs, compliance                 | Jira, Azure DevOps, Smartsheet                   |
| Product discovery       | PMs, roadmaps                          | Productboard, Aha!, Jira Product Discovery       |

**Our product sits in the developer-first camp with light general-work-management reach** (Viewers/commenters who are
not engineers).

## 2. Market conventions (observed across products)

1. **Seat-based per-user/month pricing** is universal (Jira $7.91 Standard, Linear ~$8–10, Asana
   $10.99 Premium, ClickUp $7 Unlimited, Trello $5 Standard, Azure DevOps $6, GitHub Team $4). Sources:
   [Atlassian Jira pricing](https://www.atlassian.com/software/jira/jira/pricing),
   [Trello pricing](https://trello.com/pricing/),
   [Azure DevOps pricing](https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/),
   [GitHub pricing](https://github.com/pricing),
   [ideaplan comparisons](https://www.ideaplan.io/compare/linear-vs-asana-vs-clickup).
2. **Free tiers capped by users or usage**: Jira Free = 10 users / 2 GB; Trello Free = 10 collaborators per workspace;
   YouTrack Free = 10 users; Azure DevOps = 5 free users; Asana Free = 10 seats; Linear Free = 250 issues; ClickUp Free
   = unlimited tasks but 100 MB storage.
3. **Workspace → Project → Item hierarchy** appears in nearly every product under different names
   (Organization/Team/Site → Project → Issue/Card/Task).
4. **Kanban board + list/table views of the same data** — boards are a _view_, not a separate data store. This matches
   our Board-as-configuration model exactly.
5. **Sprints as optional timeboxing**, not mandatory process (Linear lets teams skip Cycles entirely; Asana has no
   native sprints at all).
6. **Guests/viewers as a distinct cheaper or free seat class** (Trello observers, Azure DevOps Stakeholder tier, Jira
   customers portal). Our Viewer role aligns with this convention.
7. **Archive as the safe alternative to delete** for projects/workspaces.

## 3. Recurring user problems (triangulated)

These patterns recur across multiple independent sources and should shape our requirements:

| #   | Problem                                                                                                                                                 | Evidence                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Configuration debt / complexity creep** — custom fields, schemes, workflows nobody understands; "Jira admin becomes a part-time job"                  | [ideaplan Jira vs Linear vs Asana](https://www.ideaplan.io/compare/jira-vs-linear-vs-asana); [ones.com Reddit synthesis](https://ones.com/blog/real-talk-from-reddit-jira-project-management-pros-cons/) |
| P2  | **Slowness on large datasets** — slow page loads, laggy boards with thousands of issues                                                                 | Same two sources + [HN thread on Linear speed](https://news.ycombinator.com/item?id=48437609)                                                                                                            |
| P3  | **Permission confusion** — "permissions hell", overlapping scopes (workspace/team/page in Notion), unclear effective access                             | [HN thread](https://news.ycombinator.com/item?id=48264076); youngju.dev (Notion permission complexity)                                                                                                   |
| P4  | **Status/column coupling complaints** — Jira couples workflow status to board columns; users explicitly call this out as limiting                       | [HN Ask: Jira Alternatives](https://news.ycombinator.com/item?id=27018935): "One example in Jira is the coupling between workflow status and columns on boards"                                          |
| P5  | **Bad invitation flows** — dead-end expired links, duplicate-account conflicts ("email already registered"), no feedback to inviter when invites expire | [sequenzy invitation guide](https://www.sequenzy.com/blog/how-to-create-team-invitation-emails-saas); [bentonow invite best practices](https://bentonow.com/posts/user-invitation-email-best-practices)  |
| P6  | **Silent data loss from optimistic UI without rollback** — Linear criticized for writes overwriting each other with no conflict signal                  | [HN technical breakdown thread](https://news.ycombinator.com/item?id=48437609)                                                                                                                           |
| P7  | **Notification fatigue** — automation/notification noise cited as a hidden tax                                                                          | ones.com Reddit synthesis                                                                                                                                                                                |
| P8  | **Destructive-action mistakes** — hard deletes destroying history; industry answer is archive-first + grace periods                                     | Atlassian/Trello archive semantics; our own requirements doc                                                                                                                                             |

## 4. Opportunities for our product

1. **The "middle ground" is a recognized gap.** Community discussions repeatedly ask for "80% of Jira's power without
   the config overhead" ([ones.com](https://ones.com/blog/linear-vs-jira-reddit-8-honest-takes-from-real-dev-teams/)). A
   simplified classic-Jira with opinionated defaults targets exactly this.
2. **Multi-status board columns are a differentiator.** Most tools couple column↔status 1:1; our Status ≠ Column model
   (TODO+REOPENED sharing a column) resolves pain point P4 natively.
3. **Historical identity done right.** No mainstream tool prominently advertises "search finds work after user
   deletion"; making this a first-class guarantee is cheap in MongoDB (snapshot fields) and valuable for audit-minded
   buyers.
4. **Fast path to value.** Auto-seeded Projects (types/statuses/board) remove the setup tax that kills small-team
   adoption of Jira-class tools.

## 5. Trends worth noting (not MVP requirements)

- **AI assistance** (summaries, triage, auto-labeling) is now table stakes in marketing but not required for a
  learning/production-lite system; noted for roadmap only
  ([stackbuilt 2026 comparison](https://stackbuilt.co/blog/clickup-vs-linear-vs-jira-2026)).
- **Real-time sync engines** drive perceived speed (Linear's sync engine); we adopt _optimistic updates with explicit
  rollback_ instead of full offline sync — simpler and adequate for issue-tracker write rates
  ([HN discussion](https://news.ycombinator.com/item?id=48437609)).
- **Automation rules** (Jira/Trello/ClickUp) are consistently paywalled and metered; deferred.

## 6. Conclusions relevant to our product

1. Keep the entity set small and defaults strong — complexity is the #1 documented failure mode of incumbents.
2. Treat performance (pagination, indexes, optimistic UI with rollback) as a core requirement, not an optimization.
3. Make the permission matrix legible (5 roles, one table) — permissions confusion is a top complaint.
4. Design invitation/membership edge cases (expired, revoked, existing account, resend) as first-class flows, not error
   paths.
5. Plan billing as an isolated boundary now (mock checkout), because every comparable product monetizes via seats — real
   billing will eventually be wanted.
