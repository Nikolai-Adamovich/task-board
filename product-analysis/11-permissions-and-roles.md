# 11 — Permissions & Roles

Model: two scoped role layers (Tenant-level, Project-level) resolved into effective permissions per request. This
follows multi-tenant RBAC best practice: roles are always evaluated _within_ an organizational context, never globally
([WorkOS multi-tenant RBAC](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas)).

---

## 1. Roles

| Role              | Scope   | Notes                                                                                                                      |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Tenant Owner**  | Tenant  | Exactly one (BR-001). Highest authority incl. billing/danger zone.                                                         |
| **Tenant Admin**  | Tenant  | Delegated administrator; same authority as Owner except ownership transfer (recommended restriction — see Open Questions). |
| **Tenant Member** | Tenant  | Base membership; no administrative rights.                                                                                 |
| **Project Admin** | Project | Full administration of one Project.                                                                                        |
| **Editor**        | Project | Create/edit permitted content; no administration.                                                                          |
| **Viewer**        | Project | Strictly read-only (final decision BR-040).                                                                                |

Effective permission resolution order:

1. Is the user authenticated?
2. Does the target resource belong to the active Tenant/Project scope? (BR-045)
3. Tenant role: Owner/Admin grant tenant-wide authority (incl. projects) without Project Membership (BR-033).
4. Otherwise Project Membership role decides.
5. Entity state gates: ARCHIVED / DELETION_PENDING blocks writes for everyone except restore/cancel ops (BR-042).

## 2. Permission matrix

Legend: ✅ allowed · ❌ forbidden · ⚠️ limited (see notes).

| Action / Resource                                                    | Owner | TAdmin | PAdmin |                  Editor                  |      Viewer       |
| -------------------------------------------------------------------- | :---: | :----: | :----: | :--------------------------------------: | :---------------: |
| Manage Tenant settings / archive / delete                            |  ✅   |   ✅   |   ❌   |                    ❌                    |        ❌         |
| Transfer ownership                                                   |  ✅   |   ❌   |   ❌   |                    ❌                    |        ❌         |
| Manage Tenant members (invite/roles/revoke/restore/remove)           |  ✅   |   ✅   |   ❌   |                    ❌                    |        ❌         |
| View Tenant members                                                  |  ✅   |   ✅   |   ✅   |                    ✅                    |        ✅         |
| Create Project                                                       |  ✅   |   ✅   |  ❌*   |                    ❌                    |        ❌         |
| View Projects (of tenant)                                            |  ✅   |   ✅   |   ✅   |                    ✅                    |        ✅         |
| Edit Project general settings                                        |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Archive / restore / delete Project                                   |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Manage Project members (invite/roles/remove)                         |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Manage Statuses / Task Types / Boards                                |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Manage Labels (create/rename/delete project-wide)                    |  ✅   |   ✅   |   ✅   | ⚠️ create-on-the-fly while editing tasks |        ❌         |
| Create Sprint / change Sprint status                                 |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Edit Sprint name/dates                                               |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Create Task                                                          |  ✅   |   ✅   |   ✅   |                    ✅                    |        ❌         |
| Edit Task fields (title/desc/status/priority/assignee/sprint/labels) |  ✅   |   ✅   |   ✅   |                    ✅                    |        ❌         |
| Move Task on Board (= status change)                                 |  ✅   |   ✅   |   ✅   |                    ✅                    |        ❌         |
| Delete Task                                                          |  ✅   |   ✅   |   ✅   |                    ❌                    |        ❌         |
| Comment (create/edit/delete own; moderate others)                    |  ✅   |   ✅   |   ✅   |               ✅ own only                |        ❌         |
| Read Tasks / Comments / Boards / Sprints                             |  ✅   |   ✅   |   ✅   |                    ✅                    |        ✅         |
| Search / filter / saved filters                                      |  ✅   |   ✅   |   ✅   |                    ✅                    |        ✅         |
| View audit/activity (project scope)                                  |  ✅   |   ✅   |   ✅   |            ✅ (task history)             | ✅ (task history) |
| View audit (tenant scope)                                            |  ✅   |   ✅   |   ❌   |                    ❌                    |        ❌         |

\* Only Owner/TAdmin create Projects inside the Tenant (requirements matrix: "Manage Project: Owner/TAdmin yes"). If
product later wants PAdmins to spawn projects, amend this row.

Notes:

- **Editor label limit (⚠️):** Editors may attach existing labels and create new ones inline from the task editor
  (BR-019 flow), but cannot rename/delete project labels.
- **Comment moderation:** editing/deleting _others'_ comments reserved to PAdmin+; Editors manage their own.

## 3. Scope rules

### Tenant vs Project

Tenant authority flows down; Project roles never grant anything outside their Project. A user may be Viewer in Project A
and Editor in Project B of the same Tenant — checks are always per-scope (cache keys must include scope ids; see WorkOS
guidance on tenant-scoped permission caching).

### Revoked membership

`ACCESS_REVOKED` at Tenant level blocks all Tenant-scoped reads/writes; UI shows the expired-access message (BR-037).
Restoration flips to ACTIVE with the restored message. Pending invitations bypass neither acceptance (BR-036).

### Archived projects

Read-only for everyone including admins, except archive/restore/delete-cancel administration. Tenant-admin overrides do
not reopen writes into an archived Project.

### Deleted users

Deleted Users hold no roles anywhere (memberships removed). Their historical content remains visible via snapshots;
nobody "inherits" their records.

### Invitations

Only Owner/TAdmin manage Tenant invitations; PAdmin+ manage Project invitations. Invitee role is fixed at invitation
time and shown in email + acceptance page (research best practice: state role before acceptance).

## 4. Enforcement architecture (recommendation)

- Coarse middleware check (authenticated + tenant context) then fine-grained `ensurePermission()`-style service calls
  per action — matching the repo's established pattern (`middleware/rbac.ts` + `services/rbac.service.ts`).
- Every authorization denial of a _write_ on an existing resource is audit-logged at least in aggregate (security
  stream) — see [21-security-and-abuse-considerations.md](21-security-and-abuse-considerations.md).
- The UI mirrors permissions for usability only; never as the boundary (BR-041).
