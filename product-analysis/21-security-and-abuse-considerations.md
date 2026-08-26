# 21 — Security & Abuse Considerations

Defensive analysis only. Stack context: Hono on Cloudflare Workers, MongoDB driver 7 (per-request client), JWT HS256 via
`hono/jwt`, bcryptjs, Zod v4 validation.

---

## 1. Authorization architecture

- **Coarse middleware** (authentication, tenant context) then **fine-grained `ensurePermission()`** service checks per
  action — repo standard; mirrors recommended two-layer RBAC enforcement
  ([WorkOS RBAC guide](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas)).
- Every check answers three questions in order: does the resource belong to the active scope? is the user a member? does
  their role grant the action? ([11-permissions-and-roles.md](11-permissions-and-roles.md) §1).
- Fail-closed: missing membership/context ⇒ deny.

## 2. Tenant & project isolation

- All repository queries must include scope predicates (`tenantId`/`projectId`) — never fetch by bare `_id`.
- Cross-scope references rejected (BR-045): status/type/label/sprint/board/replacement must belong to the same Project.
- Tests must include explicit cross-tenant access attempts that must fail (isolation as continuous practice, per
  research).

## 3. IDOR

Direct object references (`/tasks/:taskId`) are authorized by resolving the Task → Project → Tenant chain and checking
membership/role before any read/write. Existence-hiding: out-of-scope ⇒ NOT_FOUND (doc 20 §5). Predictable sequential
task numbers are fine — they're scoped inside projects and carry no cross-tenant information.

## 4. Invitations & tokens

- Tokens: CSPRNG, single-use, stored hashed (SHA-256), TTL ~7 days derived from invitedOn.
- Acceptance validates token→membership→state; race-safe idempotent acceptance (double-accept no-ops).
- Rate-limit invitation creation/resend per admin and per target email (invitation bombing abuse).
- Expired/revoked pages reveal nothing about the tenant beyond what the invitee already knew.

## 5. Enumeration

- Login/reset/registration responses uniform for known-vs-unknown identities.
- Invitation validity endpoints return generic invalid-link copy.

## 6. Rate limiting & abuse

Apply limits (Workers-native or middleware) at minimum on: login, registration, password reset request, invitation
send/resend, task creation bursts. Rationale: credential stuffing and invite-spam are the realistic abuse vectors for
this product class.

## 7. Input handling

- All bodies through `zValidator` schemas — no hand-written types ([conventions]).
- Markdown descriptions/comments: rendered client-side with sanitization; stored raw markdown; server stores strings but
  never trusts them for rendering decisions. Milkdown output treated as untrusted HTML after conversion — sanitize on
  render (XSS defense-in-depth).
- Length caps everywhere (title ≤255; description/comment reasonable maxima enforced by Zod).
- Project key regex-validated (BR-002).

## 8. XSS / CSRF

- Angular escapes interpolations by default; markdown renderer must be configured with sanitization; no `innerHTML` of
  unsanitized content.
- Auth via JWT bearer tokens (Authorization header) rather than cookies ⇒ classic CSRF largely N/A; if cookie-based
  sessions are ever introduced, add CSRF tokens + SameSite.

## 9. Destructive actions

Grace periods + typed confirmation + audit-before-delete ([BR-004], [BR-012]); cancellation paths; archive-first
defaults. These are abuse-mitigation against both attackers-with-accounts and honest mistakes.

## 10. Auditability

Append-only audit events with actor snapshots ([19-audit-and-history.md](19-audit-and-history.md)); security-relevant
denials logged; retention follows aggregate deletion rules.

## 11. Secrets & configuration

`MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY` live in wrangler vars/env — never printed, logged, or committed (repo
boundary rules). JWT secrets rotated via operational process; tokens short-lived (recommendation: hours, refresh
strategy an implementation decision).
