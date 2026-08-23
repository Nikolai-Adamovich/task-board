# Project Management Application --- User Flows & Application Behavior

**Companion document to:** `project-management-requirements.md`\
**Purpose:** Explain how the product works from the user's perspective: onboarding, authentication, navigation, screens,
workflows, permissions in the UI, and end-to-end scenarios. This document intentionally does not duplicate MongoDB
schemas and API contracts from the main requirements document.

---

## 1. Product Mental Model

The application is a multi-tenant project management system:

```text
User
  ↓
Tenant
  ↓
Project
  ├── Tasks
  ├── Board
  ├── Sprints
  ├── Statuses
  ├── Task Types
  ├── Labels
  ├── Comments
  └── Members
```

A User may exist without any Tenant. A Tenant may contain multiple Projects. A Project is the primary workspace in which
actual work is performed.

The normal first-time journey is:

```text
Landing
  → Register
  → Authenticate / verify
  → Create first Tenant
  → Mock plan / checkout
  → Tenant dashboard
  → Create Project
  → Project automatically initialized
  → Create first Task
```

---

# 2. Authentication and Account Lifecycle

## 2.1 Landing page

A logged-out user sees a public landing page with:

- Sign Up
- Log In

No Tenant or Project is required.

## 2.2 Registration

Minimum fields:

- Email
- Password
- Confirm Password
- Display Name

Client and server validation are both required.

Creating a User does **not** automatically create a Tenant.

After registration, the user completes the authentication/verification step if email verification is enabled, then
enters onboarding.

## 2.3 Login

The login form contains:

- Email
- Password
- Forgot password
- Register

After successful login:

Account state Destination

---

No Tenant First-time onboarding One accessible Tenant That Tenant Multiple accessible Tenants Tenant selector / last
selected Tenant

Login is global to the User. Switching Tenant or Project does not require logging in again.

## 2.4 Session failure

If a protected API returns an authentication failure:

1.  Clear local authentication state.
2.  Preserve a safe return URL if possible.
3.  Redirect to Login.
4.  Do not retry indefinitely.

## 2.5 Logout

Logout ends the current session and returns the user to the public/authentication area. Private Project data must not
remain accessible through stale application state.

---

# 3. First Tenant Onboarding

A new User with no Tenant sees an onboarding screen such as:

```text
Welcome!

Create your first workspace
[ Workspace name ]
[ Continue ]
```

The first Tenant is free.

The onboarding nevertheless contains a mock plan/checkout step so that a future real billing system can replace it
without redesigning the entire onboarding journey.

## 3.1 Mock purchase flow

```text
Create Workspace
      ↓
Choose Plan
      ↓
Mock Checkout
      ↓
Confirmation
      ↓
Tenant Created
```

The initial plan may be displayed as:

```text
Free
$0
```

No real payment provider is required.

The mock checkout must not require real financial data.

The billing boundary should remain isolated from Project/Task logic so a real provider can be introduced later.

## 3.2 Result

After checkout succeeds:

- Tenant is created.
- User becomes Tenant Owner.
- User is immediately active.
- Tenant dashboard opens.
- No Project is created unless the user explicitly creates one.

---

# 4. Tenant Home

The Tenant dashboard is the organizational entry point.

It should expose:

- Tenant name
- Projects
- Create Project
- Members
- Tenant Settings
- Plan/Billing
- Profile/logout

If there are no Projects:

```text
No projects yet.

Create your first project.
```

The main CTA is `Create Project`.

---

# 5. Creating a Project

Minimum fields:

- Project Name
- Project Key
- Description (optional)

Example:

```text
Name: Website Redesign
Key: WEB
```

The key must be:

- 2--10 characters;
- start with a letter;
- contain only `A-Z` and `0-9`.

Examples:

```text
PROJ
WEB
APP2
```

Invalid examples:

```text
123
web-project
A_B
```

The key becomes immutable after the first Task is created.

## 5.1 Automatic Project initialization

The user does not manually build the initial workflow.

The system automatically creates:

### Task Types

```text
TASK
BUG
STORY
```

### Statuses

```text
TODO
IN_PROGRESS
IN_REVIEW
REOPENED
DONE
```

### Default Status

```text
TODO
```

### Default Board

```text
┌──────────────────┬─────────────┬─────────────┬──────┐
│ TODO + REOPENED  │ IN_PROGRESS │ IN_REVIEW   │ DONE │
└──────────────────┴─────────────┴─────────────┴──────┘
```

`TODO` and `REOPENED` are separate statuses even though they share a Board column.

Immediately after creation, the user can create a Task.

---

# 6. Main Navigation

A sensible Project navigation is:

```text
Project
├── Overview
├── Board
├── Tasks
├── Sprints
├── Members
└── Settings
```

Project Settings can contain:

```text
General
Members
Task Types
Statuses
Labels
Boards
Danger Zone
```

The exact visual arrangement may change, but the domain boundaries should remain stable.

---

# 7. Tenant and Project Switching

The global UI should make the current context obvious:

```text
Tenant → Project → Current feature
```

If a User belongs to multiple Tenants, a Tenant switcher is available.

Switching Tenant:

- keeps the user authenticated;
- loads the selected Tenant;
- loads that Tenant's Projects;
- clears incompatible Project context.

Switching Project loads that Project's:

- permissions;
- Tasks;
- Boards;
- Sprints;
- Statuses;
- Task Types;
- Labels;
- user-specific Board preference.

Project-specific settings must never leak into another Project.

---

# 8. Project Overview

The Overview is a useful landing page, not a duplicate of every other feature.

It may show:

- Project name/key;
- description;
- active Sprint;
- task summary;
- recent Tasks;
- members;
- shortcuts to Board and Tasks.

---

# 9. Tasks Page

The Tasks page is the searchable table view.

Typical columns:

```text
Key
Title
Type
Status
Priority
Assignee
Reporter
Sprint
Labels
Created
Updated
```

The user can:

- search;
- filter;
- sort;
- paginate;
- open a Task.

## 9.1 URL state

Table state must be URL-addressable.

Example:

```text
/tasks?page=345&limit=30&sort=createdAt:desc
```

Filters should also be represented in the URL where practical.

This allows users to bookmark/copy an exact table state.

If a requested page becomes invalid because records were deleted, move to the nearest valid page instead of showing a
broken table.

---

# 10. Creating a Task

The Create Task UI contains:

```text
Title
Description
Type
Status
Priority
Assignee
Sprint
Labels
```

Not every field is necessarily required.

## 10.1 Default Status

The Status selector is already populated with the Project default:

```text
TODO
```

The user may select another Status before creating the Task.

This intentionally allows a Task to be created directly in a different workflow state.

## 10.2 Task Type

Initial options:

```text
TASK
BUG
STORY
```

## 10.3 Assignee

The user can select an eligible Project member.

## 10.4 Sprint

No Sprint means:

```text
Backlog
```

Selecting a Sprint sets the Task's Sprint assignment.

---

# 11. Task Editing

Task editing follows a Jira-like inline model.

Each field is normally changed and saved independently:

```text
Edit title → Save
Edit description → Save
Change status → Save
Change assignee → Save
```

The UI should not require one giant form for ordinary Task edits.

After a successful save, the UI leaves edit mode and displays the server result.

If the backend reports an optimistic-concurrency conflict, the UI must not silently overwrite another user's change.

---

# 12. Task Description

The Task description is Markdown.

The UI uses:

**Milkdown WYSIWYG editor**

The user works with a rich visual editor while the application stores a Markdown string.

```text
Milkdown WYSIWYG
       ↓
Markdown
       ↓
API
       ↓
MongoDB
```

Ordinary external URLs are just text/Markdown links.

Real file attachments are intentionally deferred.

---

# 13. Task Detail

The Task page should make these areas easy to find:

```text
Task key
Title
Type
Status
Priority
Assignee
Reporter
Sprint
Labels
Description
Relationships
Comments
History/audit where exposed
```

The title should be prominent. Supported fields can be edited directly from the page.

---

# 14. Labels

The Label control behaves like an autocomplete/tag selector.

Existing Project Labels are suggested while typing.

If `Bug` already exists:

```text
Bug
bug
BUG
```

must all resolve to the same existing Label.

The system must not create case-only duplicates.

If no matching Label exists, the UI may offer creation of a new Project Label.

---

# 15. Comments

The Task page contains a comment area.

Eligible users can add comments and, subject to authorization, edit/delete comments.

Viewer is strictly read-only and cannot write comments.

Every comment displays its author.

If the author is later deleted, the historical display name remains visible.

Example:

```text
John Doe
This task should move to review.
```

The UI must not turn the author into an unexplained blank user.

---

# 16. Task Relationships

Supported relationships:

```text
BLOCKS
RELATES_TO
DUPLICATES
```

The Task page can create/remove relationships to another Task in the same Project.

Ordinary external URLs are not relationships and remain in the description.

---

# 17. Boards

A Board is a Project-level visual workflow.

Only one Board is displayed at a time.

The default Board is:

```text
TODO + REOPENED | IN_PROGRESS | IN_REVIEW | DONE
```

A Board column can contain multiple statuses.

This is important:

```text
Status != Board Column
```

A Task's Status is the actual workflow state. A Board column is only a visual grouping.

## 17.1 Board selection

A Project may have multiple Boards.

For example:

```text
Default Board
Engineering Board
QA Board
```

The selected Board is a **User + Project preference**.

Example:

```text
Alice → QA Board
Bob   → Default Board
```

Changing Alice's selection does not affect Bob.

It also does not change the Sprint.

---

# 18. Board Task Movement

If drag-and-drop is supported, moving a Task between columns ultimately changes its Status.

If a destination column contains exactly one Status, that Status can be applied directly.

If a destination column contains multiple statuses, the UI must not guess. It should ask the user to select the intended
Status.

Example:

```text
Destination column:
TODO + REOPENED

Choose status:
[ TODO ▼ ]
```

The backend stores the Status, not the visual column.

---

# 19. Sprint Boards

A Sprint Board is still a Project Board.

It does not belong to a Sprint.

When the user opens a Sprint Board for a selected Sprint, only Tasks belonging to that Sprint are shown:

```text
task.sprintId == selectedSprintId
```

The application displays one Board at a time.

The UI does not show unrelated Sprint Tasks on the current Sprint Board.

Changing a Task's Sprint is performed through an appropriate Sprint control or a view that supports selecting Sprint
membership.

---

# 20. Sprints

The Sprints page groups Sprints into:

```text
Future
Active
Completed
```

Future Sprints can be created in advance.

Example:

```text
Sprint 10 → ACTIVE
Sprint 11 → FUTURE
Sprint 12 → FUTURE
Sprint 13 → FUTURE
```

A Future Sprint can have no dates.

It may also have a start date, end date, or both.

---

# 21. Starting a Sprint

Authorized users select:

```text
Start Sprint
```

The Sprint becomes:

```text
ACTIVE
```

If no `startDate` exists:

```text
startDate = now
```

If a start date was already planned, it is preserved.

If the operation's configured rules require a missing end date to be populated on start, the UI/API applies that
established rule consistently.

Date validation remains:

```text
endDate >= startDate
```

when both exist.

---

# 22. Completing a Sprint

Selecting:

```text
Complete Sprint
```

changes:

```text
status = COMPLETED
```

If there is no end date:

```text
endDate = now
```

If an end date was already set, preserve it.

An end date does **not** automatically complete an Active Sprint.

The application must not silently run an "end date reached → completed" job.

---

# 23. Reopening a Sprint

An authorized administrator may move:

```text
COMPLETED → ACTIVE
```

Status order is not treated as a one-way state machine.

Dates are preserved unless the operation explicitly changes them.

---

# 24. Sprint Date UX

When dates are invalid:

```text
End date must be greater than or equal to start date.
```

The UI should prevent submission, but the backend must also enforce the rule.

---

# 25. Members

The Members screen shows:

```text
User
Email
Role
Access status
Invitation status
```

Authorized administrators can:

- invite;
- change roles;
- remove Project access;
- restore access where permitted.

Removing a Project member does not delete the person's historical work.

---

# 26. Invitations

## 26.1 Send

Admin enters an email and sends an invitation.

If there is no existing invitation:

```text
PENDING
invitedBy = current admin
invitedOn = now
```

An email is sent.

## 26.2 Re-send

If an invitation is already pending:

- replace the old invitation;
- generate a new link;
- update `invitedBy`;
- update `invitedOn`;
- set status to `PENDING`;
- invalidate the old link;
- send a new email.

There is no need for multiple simultaneous pending invitation records.

## 26.3 Already accepted

If the user already accepted:

- do not send another invitation;
- do not create a new invitation;
- the existing active membership is used.

---

# 27. Invitation Acceptance

The invitation email contains an opaque secure link.

The user opens it.

The system validates:

- token;
- expiration;
- revocation;
- target membership.

If valid:

```text
invitation accepted
membership = ACTIVE
invitation data removed
```

If the user is logged out, they must log in or register using the invited identity.

The invitation must not silently attach access to the wrong account.

After acceptance, take the user directly to the relevant Tenant/Project context.

---

# 28. Invitation Expiration / Revocation / Decline

Expired:

```text
This invitation has expired.
Ask an administrator to send a new invitation.
```

Revoked:

```text
This invitation is no longer valid.
```

Declined:

```text
The invitation was declined.
```

A new invitation can be issued according to the normal invitation rules.

---

# 29. Access Revocation and Restoration

If access expires and there was an invitation, the invitation also becomes expired and is removed.

The user sees:

> Your access to `<resource>` has expired.

If there was no invitation, only membership access is revoked.

When restored:

```text
ACCESS_REVOKED → ACTIVE
```

the user sees:

> Your access to `<resource>` has been restored.

Important exception:

A pending invitation cannot be bypassed by an administrator changing it directly to Active. The user must explicitly
accept the invitation.

---

# 30. Removing a User from a Project

When a Project member is removed:

```text
Project Membership removed/revoked
```

but:

```text
Tenant membership remains
Tasks remain
Comments remain
Historical identity remains
```

The user can later be added to the Project again.

When re-added, their existing Tasks and Comments are still associated with that User. If they receive an
Editor-or-higher role, they can again edit the content permitted by that role.

---

# 31. User Deletion

Deleting a User removes live access/membership.

It does **not** erase historical work.

The application preserves snapshots such as:

```text
John Doe
```

for:

- Task creator;
- Reporter;
- Assignee;
- Comment author;
- audit actor.

Search must still find Tasks by historical user name even after the User is deleted.

---

# 32. Role-Based UI

## Viewer

Viewer is strictly read-only.

Viewer can:

- read Projects;
- read Tasks;
- read descriptions;
- read Comments;
- read Boards;
- read Sprints;
- search/filter where available.

Viewer cannot:

- create Tasks;
- edit Tasks;
- move Tasks;
- change Status;
- comment;
- edit comments;
- delete Tasks;
- manage Labels;
- manage Sprints;
- manage Boards;
- manage Project settings.

The UI should simply hide or disable write controls.

## Editor

Editor can work with normal Project content according to the established Task/content permissions, including creating
and editing Tasks and comments where permitted.

Editor does not become a Project administrator.

## Project Admin

Project Admin can additionally manage:

- Project members;
- Statuses;
- Task Types;
- Labels;
- Boards;
- Sprints;
- Project settings.

## Tenant Owner/Admin

Tenant Owner/Admin can administer Tenant-level resources and Projects. Tenant-level authority is not dependent on an
individual Project Membership.

---

# 33. Archived Project UX

An archived Project remains readable.

The UI should visibly show:

```text
ARCHIVED
```

Write controls are disabled except for appropriate administrative restore operations.

Users can still inspect historical Tasks, Comments, Boards, and Sprints.

If history must be retained, archive rather than permanently delete the Project.

---

# 34. Project Deletion UX

Permanent deletion is destructive.

Recommended flow:

```text
Project Settings
  → Danger Zone
  → Delete Project
  → Warning
  → Explicit confirmation
  → DELETION_PENDING
  → Grace period
  → Permanent deletion
```

The warning should explain that Tasks, Comments, Sprints, Boards, Labels, Statuses, Task Types, relationships,
memberships, and Project-specific history are included.

Typing the Project name/key for confirmation is recommended.

If deletion is cancelled during the grace period, the Project returns to its normal state.

---

# 35. Tenant Administration

Tenant Settings may contain:

```text
General
Members
Invitations
Projects
Plan / Billing
Danger Zone
```

Tenant Owner/Admin can manage Tenant membership and Tenant-level administration.

---

# 36. Project Administration

Project Settings may contain:

```text
General
Members
Task Types
Statuses
Labels
Boards
Danger Zone
```

Only authorized roles see administrative controls.

---

# 37. Status Deletion UX

When deleting a Status, the UI must first determine whether it is used.

### Used by Tasks

Show:

```text
IN_PROGRESS is used by 23 Tasks.

Replacement:
[ IN_REVIEW ▼ ]

Deleting this Status will update all affected Tasks
and Board references.

[Cancel] [Replace and Delete]
```

Replacement is mandatory.

The selected replacement is applied to:

- all affected Tasks;
- all Board references.

### Not used by Tasks, but used by Boards

Show the affected Boards:

```text
This status is used by:
- Engineering Board
- QA Board
```

Offer:

```text
Replace
Delete anyway
Cancel
```

If deleted without replacement:

- Board view does not render a normal column for the missing Status;
- Board editor shows the invalid reference in red so it can be repaired.

---

# 38. Task Type Administration

Each Project starts with:

```text
TASK
BUG
STORY
```

Project Admin can rename or delete these types and create custom types in the future.

Task Type keys are immutable.

Names are editable.

The UI should treat the key as a stable technical identifier and the name as the user-facing label.

---

# 39. Empty States

Major screens need explicit empty states.

Examples:

### No Projects

```text
No projects yet.
Create your first project.
```

### No Tasks

```text
No tasks found.
Create a task or change your filters.
```

### No Sprints

```text
No sprints yet.
Create a future sprint to start planning.
```

### No Comments

```text
No comments yet.
Start the discussion.
```

### No Members

```text
No additional members yet.
Invite someone to collaborate.
```

Empty, loading, forbidden, not-found, and error states must be visually distinct.

---

# 40. Loading and Error Behavior

The frontend should distinguish:

```text
Loading
Empty
Error
Forbidden
Not Found
Archived / Read-only
```

Do not display "No Tasks" while a Task request is still loading.

Do not show raw database/API exceptions to users.

Examples of useful messages:

```text
The task was modified by another user.
Reload it and try again.
```

```text
You no longer have access to this Project.
```

```text
This Project is archived and is read-only.
```

---

# 41. Direct URLs

Important resources should have stable URLs:

```text
/tenants/:tenantId
/projects/:projectId
/projects/:projectId/tasks
/tasks/:taskId
/projects/:projectId/boards/:boardId
/projects/:projectId/sprints/:sprintId
```

On direct navigation:

1.  authenticate;
2.  load context;
3.  verify authorization;
4.  load resource;
5.  show the resource or a correct error state.

A URL containing an old/deleted/inaccessible ID must not expose private information.

---

# 42. Search and Filters

Task filters should support at least:

```text
Status
Type
Priority
Assignee
Reporter
Sprint
Label
```

Free-text search should cover the supported Task fields, including historical user snapshots.

Filters can be combined.

Search/filter state should be URL-addressable where practical.

---

# 43. Saved Filters

A user may save a frequently used Project filter.

Example:

```text
My Open Bugs
```

with:

```text
Type = BUG
Assignee = me
Status != DONE
```

Saved Filters are user/project-specific.

Opening one restores its query state.

---

# 44. Pagination UX

The Tasks table should support:

```text
Previous
1 2 3 ... N
Next
```

and a page-size selector such as:

```text
30 / page
```

Page, limit, sort, and filters should remain reproducible from the URL.

The backend remains authoritative for totals and available pages.

---

# 45. Task Deletion UX

Deleting a Task requires confirmation:

```text
Delete PROJ-123?

This permanently deletes the task,
its comments, and its relationships.

[Cancel] [Delete]
```

After successful deletion:

- remove it from the current list/Board;
- show confirmation;
- adjust pagination if necessary.

---

# 46. Board Invalid-Configuration UX

A deleted Status may leave an invalid Board reference if the administrator explicitly chose deletion without
replacement.

Board view:

```text
Do not render a normal column for the nonexistent Status.
```

Board editor:

```text
⚠ Missing status
```

The user should be able to repair the Board.

---

# 47. Notifications and Messages

The initial product should provide user-facing feedback for important access events:

```text
Invitation sent
Invitation accepted
Invitation expired
Access revoked
Access restored
```

Normal CRUD operations should also provide lightweight success/error feedback.

A full notification center is not required for the initial implementation.

---

# 48. What Happens Automatically vs Manually

The application should **not** infer unspecified behavior.

### Automatic

- Project seed data is created.
- New Tasks default to the Project default Status.
- Case-insensitive existing Labels are reused.
- Missing Sprint end date is populated on completion.
- Missing Sprint start date is populated when starting.
- Invitation replacement invalidates the old link.
- Historical user snapshots remain after User deletion.

### Manual / explicit

- Completing a Sprint.
- Restoring a Sprint.
- Archiving a Project.
- Deleting a Project.
- Changing Status.
- Changing Sprint assignment.
- Selecting a personal Board.
- Accepting an invitation.

### Explicitly not automatic

- Active Sprint does not auto-complete when `endDate` is reached.
- Removing a Project member does not delete their Tasks.
- Deleting a User does not delete their work.
- Selecting a Board does not change it for other users.
- Deleting a Sprint does not delete Tasks.
- Deleting a Board does not delete Tasks.

---

# 49. End-to-End: First User

```text
1. Open landing page.
2. Sign Up.
3. Enter email/password/display name.
4. Complete verification if required.
5. Application detects no Tenant.
6. Open onboarding.
7. Create workspace.
8. Choose Free plan.
9. Complete mock checkout.
10. Tenant is created.
11. User becomes Tenant Owner.
12. Tenant dashboard opens.
13. Create Project.
14. Enter Project name/key.
15. Project initializes automatically.
16. Open Project.
17. Create first Task.
18. TODO is already selected.
19. Start working.
```

---

# 50. End-to-End: Invite Collaborator

```text
1. Admin opens Members.
2. Select Invite.
3. Enter email.
4. Invitation becomes PENDING.
5. Email is sent.
6. Collaborator opens link.
7. Collaborator logs in/registers.
8. Invitation is validated.
9. Collaborator accepts.
10. Membership becomes ACTIVE.
11. Invitation data is removed.
12. Collaborator lands in the relevant workspace.
```

---

# 51. End-to-End: Re-invite

```text
1. Admin sends invitation.
2. User does not accept.
3. Admin sends invitation again.
4. Existing invitation is replaced.
5. New token/link is generated.
6. invitedBy and invitedOn are updated.
7. Old link becomes invalid.
8. New email is sent.
9. User accepts the new invitation.
```

---

# 52. End-to-End: Project Work

```text
1. User opens Project.
2. User opens Tasks or Board.
3. User creates Task.
4. TODO is selected automatically.
5. User optionally chooses another Status.
6. User writes Markdown through Milkdown.
7. User assigns a Type, Priority, Assignee, Sprint, and Labels.
8. Task is created.
9. User opens Task.
10. User edits fields independently.
11. User comments.
12. User changes Status.
13. Board reflects the new Status.
14. User can later assign the Task to a Sprint.
```

---

# 53. End-to-End: Sprint Workflow

```text
1. Admin creates Sprint 12.
2. Sprint is FUTURE.
3. Dates may be empty.
4. Admin creates future Sprints ahead of time.
5. Current Sprint is completed.
6. Admin starts Sprint 12.
7. startDate is preserved or set to now.
8. Sprint becomes ACTIVE.
9. Sprint Board displays only Sprint 12 Tasks.
10. Admin completes Sprint 12.
11. Missing endDate becomes now.
12. Sprint becomes COMPLETED.
```

---

# 54. End-to-End: Remove and Restore Project Access

```text
1. Admin removes User from Project.
2. User loses Project access.
3. User remains in Tenant.
4. Existing Tasks/Comments remain.
5. User is later added again.
6. Existing work remains associated with the User.
7. With Editor+ access, permitted historical content can be edited again.
```

---

# 55. End-to-End: Delete User

```text
1. User is deleted.
2. Live membership/access disappears.
3. Tasks remain.
4. Comments remain.
5. Historical snapshots remain.
6. Audit identity remains.
7. Search still finds historical Tasks by the stored display name.
```

---

# 56. End-to-End: Delete Status

```text
1. Admin selects Status deletion.
2. System checks Task usage.
3. If Tasks use it, replacement is mandatory.
4. Replacement is applied to all affected Tasks.
5. Replacement is applied to Board references.
6. Old Status is deleted.

If no Tasks use it but Boards do:
7. Show affected Boards.
8. Admin chooses Replace or Delete Anyway.
9. Missing references are handled as invalid Board configuration.
10. Board view hides the nonexistent column.
11. Board editor marks it red.
```

---

# 57. End-to-End: Archive Project

```text
1. Admin selects Archive.
2. Project becomes ARCHIVED.
3. Project remains readable.
4. Editing controls are disabled.
5. Historical data remains available.
6. Admin may restore the Project.
```

---

# 58. End-to-End: Delete Project

```text
1. Admin opens Danger Zone.
2. Selects Delete Project.
3. UI explains permanent consequences.
4. Admin explicitly confirms.
5. Project enters DELETION_PENDING.
6. Grace period begins.
7. Admin may cancel.
8. If not cancelled, Project is permanently deleted.
9. Direct Project URLs no longer resolve.
```

---

# 59. Implementation Guidance

When implementing any user-facing feature, the agent should reason in this order:

```text
1. Determine current Tenant.
2. Determine current Project.
3. Determine effective role.
4. Determine Project state (active/archived/deletion pending).
5. Determine whether the target entity belongs to the current scope.
6. Apply business rules.
7. Validate the request.
8. Perform the mutation.
9. Update audit/history where required.
10. Return authoritative server state.
11. Update the UI from the confirmed result.
```

A hidden/disabled UI control is not a security mechanism. The backend must enforce authorization.

---

# 60. Product Invariants the UI Must Respect

```text
Every Project belongs to one Tenant.
Every Project has a default Status.
Every Project has a default Board.

Every Task belongs to one Project.
Every Task has a Type.
Every Task has a Status.
A Task may have no Sprint.

A Sprint belongs to a Project.
A Sprint does not own a Board.

A Board belongs to a Project.
A Board may group multiple Statuses in one column.

Labels are Project-level and case-insensitive.

Deleting a User does not erase readable historical authorship.

Viewer is read-only.

An endDate does not automatically complete an Active Sprint.
```

---

# 61. Deliberately Deferred Product Areas

The following are not part of the initial user experience:

- real file uploads;
- real attachment storage/limits;
- separate TaskLink entity for ordinary URLs;
- separate Backlog entity;
- Sprint-owned Boards;
- simultaneous multi-Board display;
- automatic Sprint completion by endDate;
- custom workflow transition graphs;
- a full notification center;
- real payment processing;
- advanced custom Task Type workflows.

The application should remain extensible for these features without changing the fundamental Tenant → Project → Task
model.

---

# 62. What an Implementation Agent Should Understand

This application is not merely a collection of CRUD endpoints.

The user experience is organized around a clear hierarchy:

```text
Account
  ↓
Tenant
  ↓
Project
  ↓
Work
```

The first major goal for a new User is to reach a usable Project with working defaults, not to configure dozens of
entities manually.

The Project is deliberately initialized with useful defaults.

Tasks are the central work item.

Boards visualize Task Status.

Sprints group Tasks temporarily.

Labels, Task Types, and Statuses are reusable Project configuration.

Membership controls access.

Historical snapshots preserve human-readable history after User deletion.

The UI should expose these concepts in a simple, predictable workflow while the backend remains the authoritative source
of permissions, state, and data integrity.

---

# 63. Companion-Document Rule

Use the two documents together:

### `project-management-requirements.md`

Use for:

- MongoDB schemas;
- indexes;
- API contracts;
- authorization;
- persistence;
- validation;
- concurrency;
- domain constraints;
- state rules.

### `project-management-user-flows.md`

Use for:

- onboarding;
- registration;
- login;
- Tenant creation;
- mock billing;
- navigation;
- screens;
- UI behavior;
- user journeys;
- empty/error states;
- end-to-end scenarios;
- product semantics.

Neither document should be interpreted in isolation when implementing a feature.
