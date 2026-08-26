# 25 — Open Questions

Only genuinely unresolved decisions. Everything else is settled in [decision-log.md](decision-log.md) or the fixed
product decisions.

---

## OQ-001 — Email verification at registration: on or off for MVP? — ✅ RESOLVED (DEC-024)

**Resolution:** option (a) confirmed — email verification stays out of the MVP; registration grants an immediate
session. Invitation flows prove email ownership where it matters. A verification flag can be added later without
migration.

## OQ-002 — Can Tenant Admins transfer ownership, or Owner-only?

**Why it matters:** requirements say transfer is explicit and Owner-centric ([REQ §5.2]); permission matrix currently
restricts to Owner. Some products allow admins to initiate. **Options:** (a) Owner-only (current matrix); (b) Admin may
initiate, Owner confirms. **Recommendation:** (a) for MVP — simplest accountable model. **Impact:** one permission row;
UI confirmation flow.

## OQ-003 — Multiple simultaneously ACTIVE sprints: allow freely or warn? — ✅ RESOLVED (DEC-029)

**Resolution:** multiple ACTIVE sprints are allowed silently (no warning banner). Staleness is surfaced by the **overdue
indicator** on ACTIVE sprints past their endDate (visual only). Blocking was rejected as too rigid.

## OQ-004 — Comment edit/delete rights beyond "own" for Editors?

**Why it matters:** matrix gives PAdmin+ moderation of others' comments; some teams expect Editors to be able to delete
spam in their own tasks. **Options:** (a) keep PAdmin+-only moderation; (b) task reporter may also moderate comments on
their task. **Recommendation:** (a) for MVP; revisit with real usage. **Impact:** rbac matrix row only.

## OQ-005 — Project key change after first task: hard-block or admin-gated rename with reference update?

**Why it matters:** keys appear in human communication (`PROJ-123`); immutability protects references but frustrates
early mistakes discovered late. **Options:** (a) immutable forever after first task (current); (b) Owner/TAdmin may
rename key with explicit warning that old references break. **Recommendation:** (a) MVP; (b) as roadmap item with audit
event. **Impact:** none now.

## OQ-006 — GDPR erasure vs historical snapshots tension

**Why it matters:** product guarantees historical readability of deleted users' names ([BR-014]); GDPR erasure requests
may legally require removing personal data (names can be personal data). Requirements acknowledge retention via archive
instead of delete, but an explicit policy is needed before real customers. **Options:** (a) anonymize snapshots to
pseudonym ("Removed User") on verified erasure request, keeping records; (b) treat display names as non-personal
(risky); (c) full cascade deletion (contradicts core guarantee). **Recommendation:** (a), implemented as a future "legal
erasure" flow distinct from ordinary user deletion. **Impact:** future service + audit event type; no MVP blocker for a
learning/internal product.

## OQ-007 — Session/token lifetime & refresh strategy

**Why it matters:** JWT HS256 chosen; lifetime trades security vs UX; Workers environment favors stateless tokens.
**Options:** (a) long-lived token (days) simple; (b) short access + refresh token; (c) short access + sliding cookie.
**Recommendation:** (b) if real external users are planned; (a) acceptable for internal/learning deployment. **Impact:**
auth routes + client interceptor handling.

## OQ-008 — Should Editors be able to create Projects in their Tenant?

**Why it matters:** current matrix says Owner/TAdmin only; some tools let any member create projects (with admin
approval patterns later). **Options:** (a) keep restricted; (b) allow all Tenant Members to create projects.
**Recommendation:** (a) — matches requirements matrix; avoids project sprawl. **Impact:** none unless changed.
