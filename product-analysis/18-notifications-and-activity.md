# 18 — Notifications & Activity

Research on what users expect, then a deliberately small MVP scope.

---

## 1. Concept separation

| Concept                    | Definition                                                                           | Channel                      | MVP?            |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- | --------------- |
| **Transactional messages** | System-initiated emails tied to an action the user must react to (invitation, reset) | Email                        | ✅              |
| **Notifications**          | User-targeted signals about events (assigned, mentioned, status changed)             | In-app center, email digests | ❌ deferred     |
| **Activity feed**          | Per-entity history of what changed (task page tab)                                   | In-app read-only list        | ✅ (task-level) |
| **Audit log**              | Compliance-grade record of mutations incl. administrative ones                       | Admin-facing views/export    | ✅ minimal      |

Rationale for separating: research shows notification fatigue is a top complaint when trackers over-notify
([ones.com synthesis](https://ones.com/blog/real-talk-from-reddit-jira-project-management-pros-cons/)); a
learning-oriented product should earn trust with quiet defaults.

## 2. What users expect (research summary)

1. Invitations must arrive instantly and contain inviter/target/role/expiry
   ([bentonow](https://bentonow.com/posts/user-invitation-email-best-practices)).
2. Access changes must never be mysterious — expired/revoked/restored states need explicit messaging in-product ([UF
   §47]).
3. Assignees eventually expect to be told they were assigned; mention/comment notifications are the most-missed features
   after adoption grows (community consensus across comparison threads).
4. Activity feeds answer "what happened here?" locally on the entity — cheaper and less noisy than global notification
   centers.

## 3. MVP scope (recommendation)

**In product:**

- Toast feedback for all CRUD success/error (`injectToasts()` + `getErrorMessage` per repo conventions).
- Persistent in-app banners for access state: expired / restored / archived / deletion-pending.
- Task-level activity feed (from audit events).
- Transactional emails: invitation (+resend), password reset. Optional: invitation-expired notice to inviter (SHOULD).

**Explicitly out of MVP:**

- Notification center, watchers/subscriptions, @mentions, email digests, push, Slack integration. All roadmap
  ([24-future-roadmap.md](24-future-roadmap.md)).

## 4. Email inventory (MVP)

| Email                              | Trigger                                                | Recipient                              |
| ---------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Invitation                         | invite created / resent                                | Invitee                                |
| Invitation expired → inviter nudge | derived expiry noticed + SHOULD-have job or lazy check | Inviter                                |
| Password reset                     | reset requested                                        | Requester                              |
| Access revoked/restored notice     | membership change                                      | Affected user (SHOULD; banner is MUST) |

Sending via Resend with console fallback (repo standard); no-reply sender address avoided per deliverability research.
