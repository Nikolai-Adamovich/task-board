# 27 — Traceability Matrix

Connects Business Goal → User Need → User Stories → Business Rules → UX Flows → Domain Entities → Implementation Area.
Story/rule IDs resolve in [05-user-stories.md](05-user-stories.md) / [10-business-rules.md](10-business-rules.md).

Implementation areas reference the existing repo layout (`server/src/routes|services|repositories`,
`ui/src/app/features`, `shared/src/types`).

---

| #   | Business goal                          | User need                  | User stories            | Business rules                                 | Flows / screens       | Domain entities                  | Implementation area                                                   |
| --- | -------------------------------------- | -------------------------- | ----------------------- | ---------------------------------------------- | --------------------- | -------------------------------- | --------------------------------------------------------------------- |
| 1   | Fast trustworthy access to the product | Secure account lifecycle   | US-AUTH-01..04          | BR-041                                         | F1–F2; S2–S4          | User                             | `routes/auth.ts`, `services/auth.service.ts`, ui auth feature         |
| 2   | Time-to-value < 5 min                  | Guided first workspace     | US-ONB-01..02           | BR-001, BR-003                                 | F3–F5; S5–S6          | Tenant, TenantMembership         | `routes/tenants.ts`, `services/tenant.service.ts`, onboarding feature |
| 3   | Zero-config useful projects            | Instant usable project     | US-PRJ-01..04           | BR-002, BR-003, BR-004, BR-005, BR-018         | F5, F22–F23; S9, S15  | Project, Status, TaskType, Board | `routes/projects.ts`, `services/project.service.ts`, project feature  |
| 4   | Capture & edit work fast               | Frictionless tasks         | US-TSK-01..07           | BR-006..BR-013                                 | F6–F7; S10–S12        | Task, TaskRelationship, Counter  | `routes/tasks.ts`, `task-relationships.ts`, task feature              |
| 5   | Honest collaboration on records        | No silent overwrites       | US-TSK-02, US-NOT-02    | BR-010                                         | F7; S12 conflict UI   | Task.version                     | task service + rbac/validation middleware                             |
| 6   | Discussion retained forever            | Durable comments           | US-CMT-01..03           | BR-014, BR-039                                 | F8; S12               | Comment, snapshots               | `routes/comments.ts`, comment.service                                 |
| 7   | Clean taxonomy                         | Non-duplicating labels     | US-LBL-01..03           | BR-019, BR-020                                 | F9; S12, S15          | Label                            | `routes/labels.ts`, label.service                                     |
| 8   | Visualize flow truthfully              | Trustworthy board          | US-BRD-01..04           | BR-021, BR-022, BR-017, BR-007                 | F10; S10              | Board, BoardColumn, Status       | board feature, `routes/boards.ts`                                     |
| 9   | Lightweight sprint process             | Flexible planning          | US-SPR-01..05           | BR-011, BR-024..BR-031                         | F11–F13; S13          | Sprint, Task.sprintId            | sprint feature, `routes/sprints.ts`                                   |
| 10  | Deliberate team growth                 | Smooth invitations         | US-MEM-01..07           | BR-032..BR-038                                 | F14–F19; S7, S14, S16 | Membership, Invitation           | `routes/invitations.ts`, email.service                                |
| 11  | Least-privilege clarity                | Understandable permissions | US-PRM-01..02           | BR-040..BR-042                                 | all screens           | roles on memberships             | `middleware/rbac.ts`, `services/rbac.service.ts`                      |
| 12  | Findable work                          | Powerful search/filter     | US-SRCH-01..04          | BR-043, BR-045, BR-014                         | S11                   | indexes, SavedFilter             | `validators/pagination.ts`, filter routes/service                     |
| 13  | Accountability                         | Know who changed what      | US-AUD-01..02           | BR-012, BR-014                                 | S18                   | AuditEvent                       | `services/audit.service.ts`, audit routes                             |
| 14  | Safe destructive operations            | No accidental loss         | US-PRJ-03/04, US-TSK-06 | BR-004, BR-005, BR-012, BR-016..BR-018, BR-030 | F20–F23; danger zones | archive/deletion states          | respective services                                                   |
| 15  | Predictable system behavior            | Clear states & errors      | US-NOT-01..02           | BR-037, BR-044                                 | doc 20 everywhere     | error envelope                   | error-handler middleware, ui states                                   |
| 16  | Future monetization path               | Billing-ready onboarding   | US-ONB-02               | —                                              | F4; S5/S8             | plan fields (future)             | isolated billing boundary                                             |

## Coverage check

- Every BR-001..BR-045 appears at least once above.
- Every user story group (A–N) maps to ≥1 row.
- Fixed product decisions trace to rules marked [DEC] in doc 10.
