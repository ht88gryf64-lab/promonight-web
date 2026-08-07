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

**Where it lives.** `src/lib/subscribers.ts:354-355`, the `coolingDown`
expression, carrying a `KNOWN ISSUE` comment at `:347-353` describing the same
behavior. `RESEND_COOLDOWN_MS` is at `:60` and `withinResendCooldown` at
`:62-67`. The suppression takes effect through `needsConfirmation` at `:420`,
consumed by `src/app/api/subscribe/route.ts:105`.

**NOT resolved by the delivery conjunct.** `coolingDown` now also requires
`hasDeliveredCurrentToken(data)` (`:334`, `:354-355`), which fixed the adjacent
case where a FAILED send blocked a prompt retry. It does not fix this one. An
unsubscribed record can carry a delivery stamp matching the token it currently
holds, left over from a send that genuinely went out earlier, so
`confirmationDelivered` stays true and the cooldown still fires. Different
cause, still open.

**Why it matters.** It is a silent dead end on a path the user explicitly chose.
It predates the confirmation-token work on `feature/confirm-token-preserve` and
was left in place there deliberately, for scope discipline, because narrowing the
cooldown to `pending` only is a separate change with its own reasoning about
confirmation-email bombing of unsubscribed addresses.

**Severity: Low.** It needs a resubscribe inside a 30-second window, which is
rare, and the user recovers by submitting again. Recorded so the code comment and
this document agree.

---

## 5. Unbounded sends on a user-facing request path

**Status: RESOLVED.** Fixed in `43cc5be`, merged to `main` in `d719ddc` on
2026-07-30. Kept here rather than deleted, per the convention at the top of this
file, because the incident and its reasoning are the durable part.

**What happened.** On 2026-07-30 at 15:04:07 UTC a first-ever signup created its
subscriber document and then sent nothing. No confirmation email, no Resend
message record, no error in the Vercel runtime logs, and no request log line for
the POST at all. The visitor saw the normal success card promising an email that
never arrived. The record sat `pending` holding a token nobody had received. It
was only noticed because the visitor happened to resubmit two and a half minutes
later, which took the resend path and mailed successfully.

**Root cause.** `sendEmail` arms an `AbortController` only when the caller passes
`timeoutMs` (`src/lib/email.ts:59-60`), and its own interface documents that
callers on a user-facing request path MUST set it (`:46-49`).
`sendConfirmationEmail` did not. The signup send was therefore unbounded, and
`POST /api/subscribe` awaits it before returning (`route.ts:107`), so a hung
Resend keeps the invocation alive until the platform kills it. A killed
invocation runs no `catch`, flushes no `console.error`, writes no request log
line and leaves no Resend record. The failure is invisible in every system at
once, which is what made it worse than an ordinary send error.

**Why it matters.** A signup that silently sends nothing is worse than one that
fails loudly: there is no signal to alert on, nothing in Resend to reconcile
against, and the only recovery is the visitor spontaneously trying again. The
`confirmationSentAt` delivery gate added the same day means such a record does
self-heal on any subsequent submit, including a teams-adding one, but nothing
prompts the visitor to make that submit.

**The fix.** Pass `timeoutMs: 8_000` from `sendConfirmationEmail`, matching
`src/lib/cfb/notify.ts:18-20`, which already bounds the contribution notice on
exactly this reasoning. A hang now surfaces as
`{ok: false, error: 'send_timeout'}`, which `route.ts` logs at error level and
which leaves `confirmationSentAt` unset so the next submit re-sends.

**Observed historical rate: zero.** On 2026-07-30 all 25 `pending` records were
cross-referenced against Resend's delivered-message list. Eighteen are
resolvable and **all eighteen received a delivered confirmation, each sent
roughly 300ms after its record was created**. They are ordinary non-clickers,
not victims. The remaining seven are **unresolvable, not undelivered**: Resend's
list only reaches back to 2026-07-10 16:08 UTC and backward pagination stopped
there, and all seven predate that boundary, so they are unknown rather than
dropped. The only observed occurrence of this bug is the one on 2026-07-30
described above, on a test address that self-rescued by resubmitting. No
re-send campaign was run, so no CAN-SPAM question arose.

The fix is still warranted. A failure mode that is invisible in every system at
once cannot be measured by waiting for reports of it, and the one time it fired
it was caught only by luck. But the measured rate is zero out of eighteen
measurable signups, so this was a latent hazard rather than an ongoing leak.

**Severity: High before the fix.** Silent and unalertable, on the first-ever
signup path, which is the least forgiving moment in the funnel. Rated on blast
radius per occurrence, not on observed frequency.

**Do NOT "fix" the digest sends.** `sendPersonalizedDigest`,
`sendGenericDigest` and `sendEmptyWindowDigest` remain deliberately unbounded.
They run only from the CRON_SECRET-gated weekly cron
(`src/app/api/cron/weekly-digest/route.ts:78-82`, `277`, `290`, `308`).

**The rule is about who is waiting, not about batch size.** Each digest message
is its own `sendEmail` call, so a timeout there would bound one message and not
the batch; batch safety is not the argument and must not be used as one. The
argument is that on a cron path nobody is waiting on the response, so a hang
costs an invocation rather than a person's signup, and the failure is
recoverable on the next weekly run. On a request path a hang costs the visitor
their signup with no trace, which is why those must be bounded. Apply that test,
not a batch-versus-single test, when deciding whether a new send needs a
timeout.

---

## 6. No render-test coverage for client components

**What it is.** The repo has no way to render a React component in a test. There
is no testing-library, jsdom, happy-dom, vitest or jest in `package.json`; the
runner is `node --test` over `src/**/*.test.ts`. So component markup, conditional
rendering and copy strings are never exercised by the suite.

**Where it shows.** Most visibly in the signup success card,
`src/components/follow/FollowForm.tsx`. It has three copy variants and the choice
between them is user-visible and easy to get wrong. The branching was therefore
extracted into the pure `successVariant()` and tested directly in
`src/components/follow/__tests__/success-variant.test.ts`; the copy strings
themselves stay inline in the JSX and are untested.

**Why it matters.** The tested part is the part that can be logically wrong, so
this is a reasonable split rather than a hole left open by accident. But nothing
catches a variant wired to the wrong copy block, a typo in a user-facing string,
or a regression in what the card renders. The same gap applies to every other
client component in the repo.

**The sharpest evidence, from this branch.** The failure variant originally
shipped with the clause "We're still sending your confirmation link", which is
false: after an 8s abort nothing is in flight. Changing that wording broke no
test, because no test asserts copy strings. **Nothing in the suite would have
caught shipping a user-facing sentence that was untrue.** The catch came entirely
from the Phase 3 adversarial review, which is a process control rather than an
automated one, and process controls are exactly what erode when a track goes
quiet. That is the strongest argument for eventually closing this gap, and it
will be far less obvious to a future reader than it is today.

**Deliberately not fixed here.** Adding a render harness means adding a test
dependency, a DOM shim and a second runner configuration. That is a tooling
decision worth making on its own merits, weighed across the whole component tree,
not smuggled in as a rider on a copy change to one card.

**Severity: Low.** No user impact today, and the highest-risk logic in the
affected component is covered by a pure unit test. Recorded so the gap is tracked
rather than rediscovered.

---

## 7. On-site stars still diverge from the emailed teams after confirming

**What it is.** Teams starred on the site live in `promonight:starred_teams`
(`src/hooks/use-starred-teams.tsx:15`) and never reach the Firestore `teams`
array on their own. Nothing in the star path writes to the subscriber record;
`toggleStar` (`:130`) writes localStorage and fires analytics, and that is all.

The confirm-time seed narrows this but does not close it. Landing on
`/preferences` unions the local stars into the picker
(`src/components/follow/PreferencesForm.tsx`), so the user can see and commit
them, but **only a deliberate Save persists anything**, and the seed only runs on
a `/preferences` visit. A subscriber who confirms, then stars three more teams
while browsing, and never returns to `/preferences`, keeps those three in
localStorage forever and receives a digest that knows nothing about them.

**Why it matters.** The two stores answer the same user-facing question, "which
teams do I follow", and give different answers indefinitely. The site UI says one
thing and the weekly email says another. Because
`setSubscriberTeamsByManageToken` REPLACES rather than merges
(`src/lib/subscribers.ts`), the divergence is also load-bearing: any future
feature that writes the teams array from one store without consulting the other
deletes data held by the other.

**Deliberately not solved.** Closing it properly means either writing to the
record whenever a star is toggled, which needs an authenticated path that an
anonymous browsing session does not have, or a background reconcile, which
reintroduces the auto-write blast radius that the seed design exists to avoid.
Both are larger decisions than the seed.

**Severity: Low.** No data is lost and nothing is silently wrong inside either
store; they are simply not the same store. The user-visible effect is a digest
that under-reflects what they follow.

---

## 8. `page_view` undercounts human traffic by roughly a third

**What it is.** Two events that both fire once per pageview, measured over the
same window, disagree about how many browsers were there. Over
2026-07-30T17:22:13Z to 2026-08-02T01:02:00Z, PostHog project 393054:

| event | distinct browsers (`uniq(person_id)`) | events |
| --- | --- | --- |
| `$web_vitals` | **1249** | 2487 |
| `page_view` | **809** | 1311 |

That is a 35% shortfall in browsers (`(1249 - 809) / 1249`). Read the browser
column, not the event column: `$web_vitals` can fire more than once per pageview
as metrics settle, so the event-level ratio is confounded and the browser-level
one is not.

`$web_vitals` is itself a floor, not a ceiling — it also needs the page to live
long enough to report metrics — so the true gap against real pageviews is at
least this large.

**Where it lives.** `src/components/analytics/PageViewTracker.tsx`. Two
independent candidate mechanisms, and this entry deliberately does not claim
which dominates, because that has not been measured:

1. **The idle deferral.** `fire()` is handed to `requestIdleCallback` (`:49-53`),
   with a 50ms `setTimeout` fallback, so `<title>` is populated before it is read.
   A browser that leaves before the callback runs emits nothing at all. The
   fallback path also clears its timeout on unmount.
2. **The PostHog load race, which may be the larger of the two.** `track()`
   reads `window.posthog` and silently skips the PostHog sink when it is not yet
   defined (`src/lib/analytics.ts`, the `if (ph && typeof ph.capture === 'function')`
   guard). PostHog is loaded by a dynamic `import('posthog-js')` in
   `AnalyticsProvider.tsx:32`. Any `page_view` that fires before that import
   resolves is dropped with no error and no retry. `$web_vitals` cannot lose this
   race, because posthog-js emits it itself and therefore only after it has
   loaded — which is exactly why the two events diverge.

**Why it matters.**

- **It bears on the GA4/PostHog reconciliation.** `docs/SITE-AUDIT.md` already
  names this deferral as a suspected cause of PostHog under-counting humans
  relative to GA4, with a measured 1.7x gap, but records it as a suspicion. This
  is a direct measurement of the same effect from a second event on the same
  page, and it is the first number that separates "PostHog sees fewer people"
  from "our `page_view` emitter loses events".
- **It bears on any traffic figure submitted to Raptive.** A pageview counter
  that drops roughly a third of its events is the wrong number to put in front of
  an ad partner. Whatever figure is eventually submitted should not come from
  `page_view` as it stands, and if a PostHog-derived number is used at all, the
  shortfall has to be quantified first.
- **It bounds the A/B assignment-balance sample.** The arm is stamped on
  `page_view` (`docs/capture-telemetry-read.md`), so the balance read sees ~350
  browsers a day rather than the full traffic. This does not bias the read —
  idle timing and import latency are both independent of which arm a browser
  holds — but it makes the sample smaller than traffic, and the runbook's sample
  sizes already account for it.

**Deliberately not solved.** Both candidate mechanisms have real fixes (queue
events until the PostHog instance exists and flush on load; fire on `pagehide`
as a backstop for early exits), and both are analytics-wide changes that would
shift every historical series' baseline the day they ship. Neither should be
bundled into a capture-telemetry branch. Measure which mechanism dominates first
— the discriminating query is `page_view` volume against
`$web_vitals` volume split by connection speed or by time-to-first-event — then
fix the one that matters.

**Severity: Medium.** Nothing user-facing is broken and no data is corrupted; the
counts that exist are real. The consequence is that a headline number is wrong by
a large factor in a known direction, and it is currently trusted as though it
were not.

---

## 9. `rd-ink-faint` fails contrast on the surface it is most used on

**What it is.** `--color-rd-ink-faint: #9a9081` (`src/app/globals.css:33`, commented
"eyebrows, captions") does not meet WCAG AA for normal-size text against either
redesign surface:

| Foreground | Surface | Ratio | AA (4.5:1 normal) |
| --- | --- | --- | --- |
| `#9a9081` | `rd-card` `#ffffff` | **3.14:1** | fails normal, passes large-text only |
| `#9a9081` | `rd-cream` `#f7f3ea` | **2.84:1** | fails both |

The other two ink tokens are fine and are not in question: `rd-ink` `#211d18` is
16.75:1 / 15.13:1 and `rd-ink-soft` `#6f665a` is 5.64:1 / 5.09:1. This is one
token, not a palette problem.

**Where it shows.** 158 occurrences across 58 files, so it is a site-wide
property of the shipped design system rather than anything one feature owns.
Most uses are the intended one: 11px uppercase eyebrows and captions, which at
that weight still fail the normal-text threshold because 11px is nowhere near
the 18.66px/14pt-bold "large text" cut-off. Three uses are
`placeholder:text-rd-ink-faint` on form inputs, including the engagement capture
sheet's email field, the `/follow` signup field and the preferences form.

**How it surfaced.** The adversarial review of the capture sheet
(`feature/engagement-capture-sheet`) raised it against that sheet's email
placeholder. The finding was refuted **as a defect of that branch** and confirmed
as a property of the tokens: the sheet uses `placeholder:text-rd-ink-faint`
exactly as `FollowForm` and `PreferencesForm` already do, so it inherits the
ratio rather than introducing it. Recorded here so the refutation does not read
as "not a problem".

**Why it is not fixed here.** Darkening the token is a one-line change with a
158-site blast radius across every redesigned surface, and eyebrows and captions
are load-bearing in that visual language: the hierarchy between `rd-ink`,
`rd-ink-soft` and `rd-ink-faint` is what makes the cream house read as calm
rather than flat. Getting `#9a9081` to 4.5:1 on cream needs roughly `#767065`,
which is close enough to `rd-ink-soft` (`#6f665a`) to collapse two tiers into
one. That is a design decision about the palette, taken across the whole tree
with eyes on it, not a rider on a capture-sheet branch.

**If it is fixed, the cheap first move** is the three placeholders, which are the
only uses that are genuinely *interactive* text rather than decoration, and which
can move to `rd-ink-soft` on their own without touching the eyebrow hierarchy at
all.

**Severity: Low.** No functional failure and no information is available only
through these strings; every one of them labels content that is also present in
full-contrast text next to it. It is a legibility tax on low-vision users and a
standing AA gap, tracked so it is a decision rather than an oversight.

---

## 10. Desktop Chrome device emulation is not sufficient verification for the capture sheet

**What it is.** On 2026-08-03 the engagement capture sheet was reported
overflowing the viewport on a real iPhone in production, with the close button
pushed off-screen to the right. Every verification pass the sheet had ever been
through measured 390x844 in desktop Chrome device emulation and reported the
panel at exactly 390px wide, full-bleed. Those measurements were arithmetically
correct and causally blind: **390px is the reading produced by both the healthy
and the broken state.**

**Where it lives.** The measurement, not the markup. The panel is
`src/components/capture/CaptureSheet.tsx:213`
(`fixed bottom-0 left-0 right-0 ... overflow-hidden`) and the close button is
`:221` (`absolute right-1.5 top-1.5 h-11 w-11`, so it occupies layout x
340..384 on a 390px panel). Nothing in `src/` reads `window.visualViewport` —
grep returns zero hits — so the divergence that produces the bug has never been
observable by any check the repo runs.

**Why it matters.** `position: fixed` with `left:0; right:0` is laid out against
the **layout** viewport. iOS Safari implements page zoom as a transform of the
**visual** viewport and does not re-run layout, so at any page scale above 1 the
panel stays 390 CSS px while only 390/scale of it is on screen. The close button
begins clipping at scale 1.016, its glyph begins clipping at 1.054, and the
glyph is gone entirely by 1.11. Focusing a sub-16px text input auto-zooms to
roughly 16/14 = 1.14 on iOS, which is past all three.

**The zoom does not have to come from the sheet.** iOS does not zoom back out on
blur, and page scale survives same-document App Router navigation, so a visitor
who taps a 14px search box on one page carries 1.14 onto every page after it.
That is what happened here: the reporter had not touched the sheet when it
arrived already broken.

The instruments the verification used — `getBoundingClientRect().width`,
`offsetWidth`, `window.innerWidth`, `documentElement.clientWidth` — are all
expressed in layout-viewport CSS px and are **unchanged by page scale**. All of
them return 390 under both hypotheses. Chrome DevTools device emulation compounds
this: it emulates screen size, DPR, touch and user-agent, but not WebKit's
viewport machinery. It has no pinch gesture, does not implement iOS focus
auto-zoom, and holds `visualViewport.scale` at 1 permanently, so the broken state
is not merely unmeasured there, it is **unreachable**.

Emulation is also blind to `env(safe-area-inset-*)` (reports 0), to Safari's
minimum-font-size setting, and to in-app WebViews. None of those explain this
incident, but each is a class of defect emulation cannot falsify.

**The rule this establishes.** Never again assert that this class of bug is
absent because a width measured 390. For any component anchored to a viewport
edge:

- The diagnostic instruments are `window.visualViewport.scale`, `.width` and
  `.offsetLeft`, read alongside the element's `getBoundingClientRect()`. A
  healthy state is `visualViewport.width === rect.width`. A divergence is the
  bug, and it is invisible to every other measurement.
- Verification must happen on a **real iPhone or a real device lab**, not
  desktop device emulation. The iOS Simulator plus Safari's Web Inspector is
  acceptable because it runs real WebKit; Chrome DevTools device mode and
  Playwright's bundled WebKit are not, because neither implements focus
  auto-zoom or pinch.
- The pass must include the focused state of every text input in the component,
  not just its resting state. The resting sheet is correct; the bug only exists
  once something has raised the page scale.

**Measured on real WebKit, 2026-08-03.** iPhone 15 Pro simulator, iOS 26.5,
driven through `initial-scale` because a pinch is not scriptable. The state under
test is "layout viewport wider than visual viewport", and `initial-scale`,
focus auto-zoom and a pinch all produce it through the same viewport machinery.

| page scale | `visualViewport.width` | panel `rect.width` | healthy | handle | X |
| --- | --- | --- | --- | --- | --- |
| 1.00 | 393 | 393 | yes | visible | visible |
| 1.14 | 344 | 393 | **no** | visible | **gone** |
| 1.23 | 320 | 393 | no | visible | gone |
| 1.50 | 262 | 393 | no | visible | gone |
| 1.75 | 225 | 393 | no | visible | gone |
| 1.80 | 218 | 393 | no | **gone** | gone |

`rect.width` is 393 in every row. That is the whole lesson in one column: the
number the original verification trusted is constant across the healthy and the
broken state, and only `visualViewport.width` moves.

Focus auto-zoom confirmed directly by tapping: a 14px field takes the page to
**scale 1.1425** (predicted 16/14 = 1.1429), a 16px field leaves it at **1.000**.
That is the 16px threshold, measured rather than assumed.

**The keyboard does NOT hide the sheet, and an earlier claim here that it did was
wrong.** Focusing the sheet's own email field on iOS 26.5 leaves `innerHeight` at
695 while `visualViewport.height` drops to 385 — the layout viewport genuinely
does not shrink — but WebKit *repositions the fixed panel into the visual
viewport*, and the whole sheet renders above the keyboard: heading, body, field,
submit, X and handle. The "fixed bottom-0 sits behind the keyboard" folklore does
not reproduce on current mobile Safari. It may still hold in in-app WebViews and
on older iOS; neither was tested.

**Severity: High.** A prompt with no reachable dismiss is the exact shape
Google's intrusive-interstitial penalty targets, and it shipped to all traffic
undetected because the verification method could not see it. The sheet was
switched off in production at `2026-08-03T02:27:15.563Z`
(`NEXT_PUBLIC_CAPTURE_TRIGGER=false`, deployment
`dpl_AE6YihV4ZCYmabTAHyt56ZfBxheK`) pending a fix. The narrower lesson is the
one-line `text-[14px]` -> `text-[16px]` change at
`src/components/capture/CaptureCard.tsx:379`; the durable lesson is this entry.

---

## 11. RESOLVED: `GET /api/confirm` opted people in without a click

**What it was.** `GET /api/confirm?token=<confirmToken>` flipped the subscriber
record to `confirmed` and stamped `confirmedAt`. Mail-security gateways
(Proofpoint, Mimecast, Defender Safe Links and the rest) prefetch every in-body
URL at delivery, so a scanner could complete a confirmation for a human who had
not clicked anything.

**Why it was worse than a bug.** It manufactured consent. The record asserted an
affirmative action that never happened, which is a different CAN-SPAM exposure
from the one the branch set out to fix. It also corrupted the confirm-rate metric
by mixing scanner behaviour with human behaviour, and it would have done so
unevenly, because the rate would drift with customer mix rather than with
anything about the product.

**WHY IT STAYED HIDDEN, which is the part worth keeping.** It was measured before
it was fixed, read-only, and the measurement came back clean: of 30 confirmed
subscribers, ZERO confirmed within 5 seconds of creation. Minimum gap 10.4s,
median 49.9s. Nothing needed remediating and no metric needed correcting.

That is not because the code was safe. It is because **19 of 30 confirmations
were on `gmail.com`**, and consumer mail does not prefetch. The subscriber base
was small and consumer-heavy, which is exactly the mix that hides this. The first
corporate signup wave is when it would have started firing.

And it would not have looked like a problem. Scanner confirmations land in the
`confirmed` bucket, so the symptom is **the confirm rate going up**. Someone
reading that number would have recorded an improvement and gone looking for what
they did right. A defect whose first symptom is a metric improving is worth more
attention than one that throws.

**Fixed on `feature/preferences-token-exchange`.** `GET` is now read-only: it
resolves the token through `getConfirmCandidateByToken`, sets an httpOnly cookie
and redirects to `/confirm`, where a button POSTs to do the write. A scanner
follows URLs; it does not press buttons and does not issue an XHR off a click
handler. That asymmetry is the entire defence, so the write must never move back
into a `GET` for convenience. The sibling route `/api/unsubscribe` had reasoned
this through already and refused to write on `GET`; the two now agree.

**The measurement is repeatable.** Compare `confirmedAt` against `createdAt` per
confirmed record and bucket the gap. Anything at or under about 5 seconds is not
a human. Split by email domain, because that is where the signal will appear
first.

**Severity: Medium, resolved.** No records were affected, so this is recorded as
a near miss rather than an incident.

---

## 12. Preseason-dated promos render with no schedule row behind them on 10 NFL team pages

**What it is.** 17 live promos across 10 NFL clubs (bears x2, seahawks x2,
texans x2, colts x2, jaguars x2, raiders x2, steelers x2, cardinals, vikings,
49ers), dated 2026-08-13..2026-08-29, sit on preseason home games. The team
page's upcoming-promos list renders all 17 as ordinary rows, but every
schedule-joined surface on the same page denies the date exists: the season
calendar renders those days as disabled cells with no category dot and no
click (August is the DEFAULT month view right now, so the current live render
is an entirely inert grid directly above a list advertising August events),
the row's modal falls back to the promo-only legacy body instead of the game
body, and the Games stat counts 17 regular-season games as if August held
nothing. The promos are real — the pipeline deliberately ingested preseason
(promo-pipeline session, 2026-08-05: 49 game docs, seasonType `preseason`,
NFL games 272 to 321) because clubs publish exactly these family promos.

**Where it lives.** The value filter is `isRegularSeasonGame`
(`src/lib/types.ts:267-268`), applied in `getGamesForTeam` at
`src/lib/data.ts:787`, so every downstream date-join is built from a game set
with the 49 preseason docs already dropped: the calendar's
`gameCtxsByDate` (`src/components/redesign/CalendarGrid.tsx:83-93`), and the
list's `homeCtxByDate` (`src/components/promo-list.tsx:182-191`, `contextsFor`
at `:191` returning null). `getTeamPromos` (`src/lib/data.ts:146-154`) has no
game awareness at all, which is why the promos sail through. The calendar's
specific denials: `hasContent = hasGamesData ? !!firstGame : hasPromos`
(`CalendarGrid.tsx:309`), dots from `firstGame?.promos` only (`:316`), the
detail area maps only `gameCtxsByDate` when `hasGamesData` (`:431-465`), and
`nextUpcomingKey` considers only game dates (`:139-151`). The modal fallback is
`UpcomingPromoModal.tsx:105-125`. The Games stat is
`RedesignTeamPage.tsx:185`. Note the filter was merged as a deliberate
pre-ingest guard (`aa677cb`, merge `7583724`); the ingest then ran from the
still-unmerged `feature/nfl-preseason-ingest` (`ccf4e54`, closeout `3ef077d`),
and the sequel — rendering preseason in some deliberate form — never landed.

**Why it matters.** The page contradicts itself: the list says an event exists
on Aug 15, the calendar four hundred pixels up says the day is empty, and
nothing explains the difference. Clicking through the calendar can never find
the promo. It also splits analytics: these rows fire `promo_card_tap` where
every game-backed row fires `game_tap`, so per-game engagement reads
undercount exactly the family-audience promos NFL clubs actually publish.
Bounded to the schedule-joined surfaces: the today board, digests, venue
hubs, aggregators and JSON-LD all render promos without a games join and are
internally consistent.

**Candidate fix shapes.**

1. **Calendar-side join to promos (web only, keep the filter).** When
   `hasGamesData`, let a promo-bearing date be a live cell: `hasContent`
   gains `|| hasPromos`, dots gain `cell.promos`, and the detail area renders
   `LegacyPromoExpand` for a selected date with promos but no game contexts
   (the component and its analytics path already exist; `CalendarGrid.tsx:309`,
   `:316`, `:431-465`, plus `nextUpcomingKey` at `:139-151`). Effort **M**.
   Cheapest consistent state; generalizes to any promo whose date lacks a
   home game (which is also this bug's detection surface). Does not give
   preseason rows a game body, opponent, or schedule presence.
2. **Thread preseason through as first-class, tagged schedule data.** Pass
   `seasonType` to the UI, render preseason cells/rows with an explicit
   Preseason badge, and keep the Games stat and ScheduleBlock's bye
   computation regular-season-only. Effort **L**. Full fidelity and matches
   the recorded pipeline decision that preseason is in scope — but the
   filter's own comment documents the trap: preseason week numbering (HOF
   clubs play 4) collides with the regular week grid, and the consumer set is
   wide (ScheduleBlock, StatScoreboard, capture chips, homepage
   `resolveCardContexts`, `away_game_expanded` volume).
3. **Suppress preseason promos on team pages until 2 lands.** Dominated:
   promo docs carry no seasonType marker (pipeline `SIGNATURE_FIELDS` has
   only `week`/`date`), so identifying them web-side needs the very games
   join being avoided, and it hides real content against the recorded
   decision in `ccf4e54`.

**Risks and couplings.** Any shape changes prerendered HTML on 10+ pages —
rebuild byte-identity baselines same-day, and revalidate the pages (ISR
86400). Shape 1 is a client-component change; SSR/client first render must
keep agreeing on the omitted lazy-mount details (the existing hydration
contract at `CalendarGrid.tsx:446-448`). Analytics dashboards reading
`game_tap` alone will see `promo_card_tap` volume appear on game-mode
calendars. Self-resolving for 2026 after Aug 29, and returns every preseason.

**Severity: Medium.** User-visible contradiction on 10 live pages today, in
the default calendar month, but the content itself renders in the list and
nothing is lost or corrupted.

---

## 13. Jets "Inspire Change" promo stores the wrong opponent (Patriots for Raiders)

**What it is.** `teams/new-york-jets/promos/20c8842bebdf87aa` ("Inspire
Change", date 2026-11-01, week 8, type theme) stores `opponent: "Patriots"`.
Three independent witnesses say Raiders: the game doc
`nfl-2026-11-01-las-vegas-raiders-at-new-york-jets` (week 8, away
`las-vegas-raiders`), the promo's own `week: 8`, and sibling promo
`7c8e5fa03534836e` ("Las Vegas Raiders Game", same date, same `sourceUrl`,
`opponent: "Raiders"`). The only Patriots visit is
`nfl-2026-12-27-new-england-patriots-at-new-york-jets`, week 16. Extraction
mis-association from the club's game-themes article
(`newyorkjets.com/news/jets-2026-game-themes-giveaways-07-22-2026`); the
pipeline's week cross-check passed because only the opponent is wrong.

**Where it shows.** Everywhere `promo.opponent` renders: the Jets team-page
row prints "vs Patriots" (`src/components/redesign/RedesignPromoRow.tsx:179-183`)
while the same row's click opens the shared game modal on the Raiders game
(`src/components/promo-list.tsx:182-191` finds the Nov 1 home context;
`UpcomingPromoModal.tsx:105-115` renders it), and the calendar's Nov 1 cell
shows "vs LV" (`CalendarGrid.tsx:348-353`) — the contradiction is one click
apart on one page. Also the SEO prose "(vs Patriots)"
(`src/components/team-content-sections.tsx:249-344`), the theme-nights
aggregator (`src/components/aggregator-paginated-groups.tsx:105-106`), the
today board on 2026-11-01 (same row component), the weekly digest email
(`src/lib/email.ts:264`, cron live in execute mode per entry 1), and the app
API (`src/app/api/my-teams/promos/route.ts:63`).

**The correction path.** One-doc hand-fix script following the
`scripts/populate-arena-venue-fixes.ts` convention: dry-run default,
`--execute` flag, idempotent (re-run prints no-op), logged before/after,
invoked via `tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs`.
One field on one doc: `opponent: "Patriots" -> "Raiders"`. Then POST
`/api/revalidate` for `/nfl/new-york-jets` (page is ISR 86400, so the wrong
string otherwise lives up to a day past the write). The fix is
rescan-stable: `opponent` is in the pipeline's HOLD bucket
(`promo-pipeline/lib/scanner/promo-diff.js:32`), so a future scan
re-extracting "Patriots" HOLDs as `field-mod:opponent` rather than reverting
— but it will keep holding on every scan until the guard below or the source
association is fixed, which is recurring review noise, not data risk.

**The pipeline guard (separate change, separate repo).** The spine join
already holds the authoritative opponent and does not check it:
`joinPromo` in `promo-pipeline/lib/scanner/season-gate.js` returns
`opponent: game.awayTeamSlug` (`:139`, `:161`) and cross-checks only `week`
(the 7.3 `WEEK_DISAGREE` HOLD at `:146-153`). Shapes:

1. **Cross-check and HOLD**, mirroring 7.3: extracted opponent display name
   vs spine away slug; mismatch HOLDs. Needs a nickname-to-slug map
   (club names live in `team-configs/nfl.js`) and tests beside
   `test/season-gate.test.js`. Effort **S-M**. Consistent with the pipeline's
   "two sources disagreeing establishes nothing" doctrine.
2. **Overwrite from the spine**: writer stamps opponent from
   `game.awayTeamSlug` regardless of extraction. Fixes the class silently but
   needs slug-to-display-name mapping for every league sharing the writer,
   and destroys exactly the disagreement signal shape 1 surfaces.
3. **Verify-only warning** in `verify-promo.js` (report, never HOLD).
   Cheapest, but this incident shows the mismatch survives to production, so
   a warning nobody gates on may just be noise.

**Risks and couplings.** The data fix itself is trivially bounded (one field,
one doc) and is warranted regardless of which guard shape is chosen — the
page currently states a falsehood and demonstrates the truth one click away.
Time matters mildly: the promo enters digest windows and the today board
around 2026-11-01. The guard touches the shared season-gate used by the
weekly autonomous scans; scope it regular-season-first (the 7.3.2 preseason
carve-out is precedent for how cross-checks get scoped). No byte-identity
concern beyond the one page's ISR re-render.

**Severity: Medium.** A factually wrong opponent is live on a team page, its
aggregators, and the digest path; blast radius is one doc, and the modal
already shows the correct game.

---

## 14. Ten TBD NFL games at non-Eastern venues store a one-day-early date

**What it is.** When ESPN has not set a kickoff (`timeValid: false`), its
API carries a placeholder time of 05:00Z — midnight Eastern on the true game
date. Ingest derives the stored `date` as the VENUE-local day of that
instant, so for Central/Mountain/Pacific venues the placeholder resolves to
23:00/22:00/21:00 the PREVIOUS local day and the stored date lands one day
early. Verified against all 24 `timeTbd` NFL docs: the 12 at Eastern venues
(including both Indianapolis games — `America/Indiana/Indianapolis` is
Eastern) are correct; the 10 at non-Eastern venues are all wrong. The 10:
`nfl-2026-12-26-washington-commanders-at-minnesota-vikings` (wk16, true
12-27), `nfl-2027-01-02-kansas-city-chiefs-at-los-angeles-chargers` (wk17,
true 01-03), and eight wk18 docs stored 2027-01-09 (true 01-10):
bears-at-vikings, lions-at-packers, raiders-at-chiefs, chargers-at-broncos,
49ers-at-cardinals, seahawks-at-rams, buccaneers-at-saints,
titans-at-texans.

**Where it lives.** `src/lib/ingest-nfl.ts:313`
(`const localDate = ymdInTz(event.date, venueInfo.tz)`), with `ymdInTz` at
`:214-228` and `timeTbd` computed only afterwards at `:322`. The ingest
already knows the time is a placeholder but derives the date from it anyway.
The display side half-knows: `ScheduleBlock.tsx:196-198` refuses to format
the placeholder TIME ("the stored 05:00 placeholder is a valid-looking UTC
time, so formatting it would print a confident wrong kickoff") but prints the
stored DATE unguarded at `:215` — the identical defect one field over.

**Where it shows.** 17 live team pages, split by template: 8 zero-promo pages
(commanders, chargers, lions, packers, broncos, buccaneers, saints, titans)
print the wrong date in the crawlable ScheduleBlock; 9 populated pages
(vikings, chiefs, bears, raiders, 49ers, cardinals, seahawks, rams, texans)
place the game on the wrong CalendarGrid cell (`CalendarGrid.tsx:83-93` keys
on `game.date`) and print the wrong day in the expand header
(`GameExpand.tsx:23-29`).

**Candidate fix shapes.**

1. **Correct at ingest.** When `timeTbd`, derive the stored date in
   `America/New_York` (the placeholder IS midnight ET on the provisional
   date) — hoist the `timeTbd` computation above `:313` and switch the zone.
   Then re-run `scripts/ingest-nfl-schedule.ts --execute` (manual, no cron)
   and **delete the 10 stale docs**: the date is baked into the doc id
   (`:328`) and writes are merge-only upserts (`:381-397`), so the corrected
   docs get NEW ids and the wrong ones are stranded, rendering as phantom
   duplicate games on every affected page. Finish with `/api/revalidate` for
   the 17 pages. Effort **M**. Within this shape, "suppress until timeValid"
   is dominated: ScheduleBlock invents "Bye week, no game" rows for missing
   weeks (`ScheduleBlock.tsx:96-105`), so suppression converts a wrong date
   into a false bye label.
2. **Correct at display.** When `timeTbd`, render the row's date as
   provisional ("Jan 10, date/time TBD" or week-only) in ScheduleBlock — and
   equivalently in the expand header; a calendar cell cannot render "date
   TBD" at all, a cell IS a date. Effort **S** for ScheduleBlock alone, **M**
   for all surfaces. Honest for wk18, where the Sat/Sun split genuinely is
   undecided — but it leaves the wrong date in Firestore, where the pipeline
   spine reads it: season-gate joins promos BY DATE and returns `game.date`
   as authoritative, so a club promo published for the true date HOLDs as
   NO_MATCH and one joined through the wrong doc inherits the wrong date (no
   current promo sits on the 10 dates — verified — but wk16-18 promos will as
   clubs publish). It also leaves the wrong doc ids, so the duplicate-doc
   hazard below still fires.
3. **Both.** Shape 1 for the data plus shape 2's provisional wording as a
   display hedge for the flex window. Effort **M**.

**The structural hazard either way.** Ingest has no delete path. ANY
correction that changes a game's date — this fix, and every future flex move
— mints a new doc id and strands the old doc, and the routine post-flex
re-ingest will therefore create duplicates from these 10 docs even if
nothing else is done. Whichever shape is chosen should ship with a stale-doc
sweep (e.g. dedupe on `espnGameId`, keep newest `ingestedAt`), because the
next flex announcement turns this Medium into a live incident on a normal
path.

**Risks and couplings.** Re-ingest is a prod Firestore write from a manual
script — dry-run first, per the script's own contract. Doc-id churn touches
anything keyed on game id (analytics `game_id` payloads change for the 10).
17 pages of prerendered HTML change: rebuild byte-identity baselines
same-day and revalidate (ISR 86400). Sequence ahead of any preseason
schedule-threading work (entry 12, shape 2) so that builds on corrected
dates.

**Severity: escalated Medium → High, 2026-08-07.** The phantom mechanism is
not a display bug, on two grounds established by the sweep scoping (session
2026-08-06/07):

- **A phantom is duplicate monetized affiliate surface on a live page.**
  CalendarGrid renders two clickable cells for one game, and each cell's
  expand carries the full CTA tray (TicketsBlock / ParkingCTA / HotelsCTA,
  `GameExpand.tsx:6-8`) — the phantom sells tickets, parking and hotels
  against a game date that does not exist. `getGamesForTeam` has no date
  bound, so a phantom persists indefinitely until deleted.
- **A phantom can corrupt promo data, not just render it.** The pipeline's
  season-gate treats its date join as authoritative
  (`promo-pipeline/lib/scanner/season-gate.js:155-165`, rewrite at
  `:186-190`): a promo whose published date matches the phantom's stale date
  gets its date/week rewritten TO the phantom's, and an either-or flex date
  matching both twins trips an `AMBIGUOUS` HOLD — both failure modes landing
  exactly when clubs publish flex-window promos, in the December–January
  window when all 24 TBD games receive dates.

By this file's own scale that is High: a real incident on a normal path —
the routine post-flex re-ingest — at a known date.

**Sweep decision (approved 2026-08-07).** The reconcile lives INSIDE the
ingest run, not in a separate script: the phantom is minted by the ingest
run itself, and a separate script on a manual January workflow is the step
that gets skipped. Shape: post-upsert tiered reconcile diffing the
triple-scoped doc set (`league` + `season` + `seasonType`) against the run's
in-memory prepared set — tier 1 auto-deletes proven re-dated twins (same
`espnGameId`, different id; `espnGameId` verified present and unique on
321/321 NFL docs, absent on all MLB docs; newest-`ingestedAt` wins is
well-defined because the upsert rewrites it every run), tier 2
(`espnGameId` matching nothing fetched) is report-only behind a separate
`--prune-unknown` flag. Hard requirements of that PR:

- The `--year` flag ships WITH the sweep, not after.
  `scripts/ingest-nfl-schedule.ts` passes no year and `ingestNflSchedule`
  defaults to the current UTC year (`ingest-nfl.ts:253`), so every January
  flex re-run silently fetches the near-empty next season — harmless under
  merge-only upserts, catastrophic under reconcile-delete.
- Snapshot-first JSON before any delete, dry-run default with `--execute`,
  and a prepared-count floor that aborts the run — the same discipline as
  the promo writer.

**Deadline.** Merged and dry-run-rehearsed BEFORE the corrective re-ingest
that fixes this entry's 10 wrong-date docs (that fix is itself the first
phantom-minting event, so the sweep is part of the same PR), and in no case
later than ~Dec 1, 2026, ahead of the first flex announcements. The wk18
Sat/Sun split lands ~Jan 3-4, 2027 — 16 simultaneous potential re-datings,
which is also exactly when the `--year` default bug fires.

Provenance correction from the scoping pass: the 49 preseason docs were
written by THIS repo's preseason ingest variant on the unmerged branch
`feature/nfl-preseason-ingest` (`ccf4e54`, run 2026-08-05), not by
promo-pipeline, which only reads `games`. The sweep must scope on
`seasonType` so a regular-season reconcile can never touch them.

---

## 15. Three live hubs claim "Schedules refreshed every 6 hours" on an ISR-only basis

**Status: RESOLVED.** Fixed in `feature/hub-freshness-truth`, merged to main
in `a182ad3` on 2026-08-07 and prod-verified on all three hubs. Verified
mechanisms before the change, per the /nfl precedent: MLB promo scan weekly
year-round (Tue 08:00 UTC) plus the weekly Monday schedule ingest; WNBA
weekly May-Sept; MLS weekly Feb-Nov; all three scan workflows revalidate on
prod writes. Lines now read "Rechecked weekly and updated as clubs announce
promotions." (MLB) and the "in season" variant (WNBA, MLS). Site-wide grep
found the 6-hour string nowhere else and no other unbacked cadence claims.

**What it is.** The /mlb, /wnba, and /mls hub heroes each render the freshness
line "Schedules refreshed every 6 hours." The 6-hour figure describes the
pages' ISR interval (`revalidate = 21600`), not any data cadence: no 6-hour
ingest exists for any league. The only scheduled schedule ingest anywhere is
`mlb-schedule` (weekly, Mon 10:00 UTC, `vercel.json`); promo freshness comes
from the weekly per-league scanner crons plus on-demand revalidation. The
line reads as a data-freshness promise and was ruled false on exactly this
basis for /nfl (2026-08-07), whose hero now says "Updated as clubs announce
promotions."

**Where it lives.** `src/app/mlb/page.tsx:118`, and the same `freshness`
prop on the WNBA and MLS hub pages (line-for-line parallel files).

**Why it matters.** Three live pages make a claim we ruled false on the
fourth. Same class as the promise scoped out of LEAGUE_COPY: copy that
describes infrastructure the site does not run.

**Fix shape and effort: S (<1h).** Replace the string on the three pages
(the /nfl wording or per-league equivalents), deploy; no data or component
work. Byte-identity note: changes prerendered HTML on three hub pages.

**Severity: Low.** No functional consequence; a truthfulness fix on live
copy, recorded so it does not sit.
