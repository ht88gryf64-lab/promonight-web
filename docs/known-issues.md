# Known Issues

Defects and structural hazards that are understood, deliberately not fixed yet,
and should not disappear quietly. Each entry states what it is, where it lives,
why it matters, and a severity.

Severity scale:

- **High**: will cause a real incident on a normal path, not an exotic one.
- **Medium**: real consequence, but needs an uncommon sequence or has a bounded
  blast radius.
- **Low**: correctness or hygiene issue with no user-visible effect today.

Add new entries at the bottom. When one is fixed, keep the entry and mark it
resolved with the commit, rather than deleting it.

---

## 1. Preview deployments write to production Firestore

**What it is.** Vercel Preview has `FIREBASE_SERVICE_ACCOUNT_KEY` set, and the
repo references a single Firebase project. Any preview deployment therefore
reads and writes the same Firestore that production serves from. Exercising a
preview is not a sandboxed activity: a signup on a preview creates a real
`subscribers` document, and because even a rejected request runs the rate limiter
before parsing the body, any POST at all creates a real `rateLimits` document.

**Where it lives.** Not a code defect, so there is no single line to point at.
The wiring is `vercel env ls preview`, which lists `FIREBASE_SERVICE_ACCOUNT_KEY`
against the Preview environment. The client it produces is
`src/lib/firebase.ts:5-11`. The earliest write on the subscribe path is
`checkSubscribeRateLimit` at `src/app/api/subscribe/route.ts:73`, which runs
ahead of the JSON parse at `:83`, and the subscriber writes are
`src/lib/subscribers.ts:248` (create) and `:386` (update).

**Why it matters.** It silently contradicts the standing convention that web
branches perform no Firestore writes, and it means preview testing pollutes the
production dataset. The sharpest edge: the weekly digest cron is live in execute
mode (`vercel.json:8-11`, `"0 17 * * 2"` with `?execute=true`), so a test
subscriber created on a preview and then confirmed will receive real mail, and
counts against the 100/day free-tier ceiling (`FREE_TIER_DAILY` at
`src/app/api/cron/weekly-digest/route.ts:59`, enforced with a 409 at `:237` and
`:251`). It also makes destructive preview experiments genuinely dangerous
rather than merely untidy.

**Severity: High.** This is structural, it applies to every preview deploy
forever, and the failure is silent. A separate Firebase project for preview, or
removing the credential from Preview entirely, is the real fix.

---

## 2. `rateLimits` has no TTL policy in version control

**What it is.** `checkSubscribeRateLimit` creates one Firestore document per
distinct client IP and nothing ever deletes them. The code writes an `expiresAt`
field intended for a Firestore TTL policy, but that policy is not declared
anywhere in the repo: there is no `firebase.json`, no `firestore.rules`, and no
`firestore.indexes.json`. Whether the policy was ever enabled in the Firebase
console cannot be determined from the code.

**Where it lives.** `src/lib/rate-limit.ts:57-62` writes the doc, with the
`expiresAt` field at `:61` and the comment describing it as "an optional
Firestore TTL policy" at `:60`. The collection name is at `:12`.

**Why it matters.** If the policy is not enabled, the collection grows without
bound, one permanent document per IP ever seen. It is a storage leak, not a
memory leak, so there is no crash to alert on; it simply accumulates cost and
document count. Because the config is not in version control, a project restore
or a migration to a new Firebase project would silently lose the policy even if
it exists today.

**Severity: Medium.** Slow, cheap at current traffic, and invisible until it is
not. Two actions: confirm the TTL policy exists on `rateLimits.expiresAt` in the
console, and commit the Firestore configuration so it is reproducible.

---

## 3. The subscribe rate limiter is shared with the CFB contribute endpoint

**What it is.** The rate-limit counter key is built from a hardcoded `subscribe:`
prefix plus the client IP, and two different routes call the same function. One
IP therefore drains a single 5-per-10-minute budget across both endpoints: a
CFB contribution consumes a newsletter-signup slot and vice versa.

**Where it lives.** The key is `sha256('subscribe:' + ip)` at
`src/lib/rate-limit.ts:45`, with `LIMIT = 5` at `:14` and
`WINDOW_MS = 10 * 60 * 1000` at `:13`. The two callers are
`src/app/api/subscribe/route.ts:73` and
`src/app/api/cfb/contribute/route.ts:43`.

**Why it matters.** The coupling is invisible from either call site, so the
budget is not what a reader of either route would assume. It also makes the limit
un-tunable: raising the ceiling for a chattier signup flow silently loosens abuse
protection on the CFB contribution endpoint at the same time. The window is fixed
rather than sliding (`:56-58`), so a user who exhausts it waits out the remainder
of the original ten minutes. Note also that NAT'd office, campus and carrier IPs
already share one bucket across all users behind them.

**Severity: Medium.** No user impact at current volume, but it is a trap for the
next person who changes `LIMIT`. The fix is to parameterize the key prefix so
each route gets its own namespace, and to do that before touching the ceiling.

---

## 4. An unsubscribe followed by a resubscribe within 30 seconds sends no confirmation email

**What it is.** The per-email resend cooldown suppresses the confirmation email
for any non-confirmed record re-submitted within 30 seconds, and that includes
records in `unsubscribed` status, not just `pending` ones. So a user who
unsubscribes and immediately resubscribes has their record resurrected to
`pending` but receives no confirmation link. They see a success state, no email
arrives, and they stay unconfirmed until they submit again outside the window.

**Where it lives.** `src/lib/subscribers.ts:340`, the `coolingDown` expression,
carrying a `KNOWN ISSUE` comment at `:332-339` describing the same behavior.
`RESEND_COOLDOWN_MS` is at `:60` and `withinResendCooldown` at `:62-67`. The
suppression takes effect through `needsConfirmation` at `:405`, consumed by
`src/app/api/subscribe/route.ts:105`.

**Why it matters.** It is a silent dead end on a path the user explicitly chose.
It predates the confirmation-token work on `feature/confirm-token-preserve` and
was left in place there deliberately, for scope discipline, because narrowing the
cooldown to `pending` only is a separate change with its own reasoning about
confirmation-email bombing of unsubscribed addresses.

**Severity: Low.** It needs a resubscribe inside a 30-second window, which is
rare, and the user recovers by submitting again. Recorded so the code comment and
this document agree.
