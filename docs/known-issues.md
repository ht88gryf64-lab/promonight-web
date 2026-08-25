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

**Status: RESOLVED 2026-08-21 on `feature/ink-token-split`. Superseded by entry
35, which carries the fix and the shipped ramp.** Every value quoted below is a
retired one. The prediction in "Why it is not fixed here" turned out to be
almost exactly right, which is why this entry is kept rather than deleted.

**What it is.** `--color-rd-ink-faint: #9a9081` (then at `src/app/globals.css:33`, commented
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

**What actually happened.** The estimate above was close: the shipped
`ink-faint` is `#786e60`, a hair off the predicted `#767065`. The collapse it
warned about was real, and it was not avoidable by picking a better value. The
fix was to move `rd-ink-soft` too, twice, and to give the decoration uses a
token of their own so the readable tier could move without dragging drag
handles and glyph fills darker with it. Entry 35 has the shipped ramp and the
reason the two steps cannot both be widened.

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

---

## 16. `PATH_RE` is duplicated across two repos and guarded from one side only

**Status: OPEN, low urgency.** Ride it along with the next change to
`route.ts`; it does not warrant its own branch.

**What it is.** `PATH_RE` in `src/app/api/revalidate/route.ts:39` is duplicated
byte-for-byte in the pipeline at `promo-pipeline/lib/revalidate-notify.js`.
Both copies were widened from two segments to three on 2026-08-13 for
`/cfb/rivalries/<slug>`. The pipeline side now has a test asserting the
coupling (`promo-pipeline/test/revalidate-notify.test.js`, landed in
`9870eff`). **This side has no mirror, so the coupling is enforced in one
direction only.**

**Why the unguarded direction is the dangerous one.** The pipeline test catches
someone NARROWING the pipeline copy. Nothing catches someone narrowing THIS
copy. If `route.ts` is narrowed, the endpoint begins rejecting paths the
pipeline correctly sends, and the only symptom is a warn line in a scanner log
while the affected pages serve stale indefinitely. No error, no failed run, no
alert. Same silent-failure shape as the eight optional promo fields that
eroded for six weeks because the diff never loaded them.

**What to add.** Copy the pipeline test rather than writing a new one, so the
two stay comparable:

- 3-segment `/cfb/rivalries/<slug>` validates.
- 1 and 2 segments still validate; 4 segments rejected.
- The ten charset rejections: uppercase in first and last position,
  underscore, dot, query string, trailing slash, missing leading slash, empty
  segment, space, and protocol-relative `//evil.com` (which parses as two
  segments under the charset rules and must be pinned explicitly).
- A literal assertion on `PATH_RE.source` against the shipped pattern string,
  so a future narrowing fails loudly rather than silently dropping paths.
- **An assertion that the flags are empty.** An `i` flag would defeat every
  uppercase rejection without touching the pattern, so the source assertion
  alone is NOT sufficient. This was found on the pipeline side and is easy to
  omit.

`PATH_RE` is not currently exported from `route.ts`; the pipeline exported its
copy for the test with a comment restricting the export to that use.

**Prove the guard bites before calling it done.** Narrow the regex, confirm the
expected tests fail, restore. On the pipeline side, narrowing to `{0,1}` failed
2 of 5 tests. A test that cannot fail is not a guard.

**Where it lives.** `src/app/api/revalidate/route.ts:39`.

**Why it matters.** A byte-identical coupling across two repos guarded only by
a comment is the same shape as extraction rules living in conversation rather
than in a file, which has bitten this project twice.

## 17. Team-page JSON-LD stamps `dateModified = new Date()` on every ISR render

**Status: OPEN, scheduled.** Fix rides the CFB data-only content tier (scoped
2026-08-14), not its own branch.

**What it is.** `src/components/json-ld.tsx:126` builds the team-page WebPage
JSON-LD with `dateModified: new Date().toISOString()`, so all 169 team pages
assert "modified just now" on every ISR regeneration regardless of whether any
underlying data changed. That is a synthetic freshness claim on the site's
highest-traffic template, and it matters under Raptive review criteria that
name accuracy and trustworthiness. The 2026-08-14 authorship sweep found the
same synthetic pattern on the aggregator CollectionPage stamps, /promos/today,
and the league hubs (todayYMD()/new Date() at theme-nights/page.tsx:125,133,
today/page.tsx:106, mlb/page.tsx:109), while the scored pages and /playoffs
already bind real stamps (TeamScore.computedAt, PlayoffConfig.lastScanDate).

**The fix shape.** Replace synthetic stamps with real stored timestamps where
one exists, and OMIT dateModified where none does; never synthesize.
Real sources already in hand: venueHubs.updatedAt (already feeds sitemap
lastmod via lib/venue-hub.ts:318-326), CFB school/venue/game verification
stamps (cfb/types.ts:39, :78, :108), PlayoffPromo.updatedAt
(types.ts:321-322). The base Promo interface carries NO updatedAt
(types.ts:76-114), so the team-page WebPage either binds to a real per-team
signal (for example the newest playoffPromo/scan stamp if one is wired
web-visible later) or drops the field.

**Why it matters.** A freshness claim that is always "now" is
indistinguishable from no freshness signal to a careful reviewer, and worse
than none to one who checks twice.

## 18. Plan-your-visit and Tickets cards render twice in every venue hub document

**Status: OPEN.** Content duplication independent of word counting; the
corrected page-mix measurement (audit/raptive-page-mix-visible.ts) already
deduplicates it, so this is a served-bytes and semantics issue, not a
metrics one.

**What it is.** VenueHubView mounts planCard and ticketsCard twice per page:
inline for mobile inside `lg:hidden` wrappers
(src/components/venue-hub/VenueHubView.tsx:578, :584) and again in the desktop
sticky rail (`hidden lg:block`, :590-593). Every affiliate CTA, degrade line,
tailgate window and lot-map link ships twice in the HTML of all 223 hub pages;
only CSS decides which copy is visible. Screen readers and crawlers see both.

**Single DOM node or CSS-only?** A single-node version is achievable without
JS, but not by pure CSS on the current structure: the two mounts live in
different grid children (main column vs rail aside), and one element cannot
occupy both. The workable shape is flattening the two-column split so the
shared cards are direct children of one responsive grid, with lg: column and
order utilities placing them in the rail position, and `lg:sticky lg:top-5
self-start` applied to the cards themselves instead of the aside wrapper. That
is a container rework of VenueHubView's layout section (:556-593), medium
risk, and belongs in its own layout pass. Until then the duplicate mounts are
byte-identical by construction (same variables), so the duplication cannot
drift into contradiction.

## 19. venueHubs/t-mobile-park sources map has URL-as-key rows

**Status: OPEN, data hygiene, low urgency.** Found during the venue
thickening analysis (audit/venue-thickening-plan.md method note), confirmed by
direct read 2026-08-14: the `sources` map on venueHubs/t-mobile-park contains
2 rows whose KEYS are URLs (e.g.
"https://www.mlb.com/mariners/ballpark/information/guide") instead of field
names mapping to URL values. Every other doc keys sources by field name.

**Why it matters.** Any script that consumes sources maps programmatically
(per-field citation rendering, source auditing, harvest reconciliation) will
misread this doc: iterating keys as field names yields URLs, and looking up a
field name misses the rows. Nothing user-facing reads sources today (kept off
pages deliberately after the CFB quoted-source-URL incident), so the exposure
is future tooling. Fix shape when picked up: re-key the two rows to their
field names in Firestore with the usual snapshot-first protocol.

## 20. Team pages repeat promo descriptions and CTA copy per row, the largest duplication on the site

**Status: OPEN.** Measured, not fixed. MLB team pages lose a median 689
visible words to in-document repeats (audit/raptive-page-mix-visible.md, dup
delta column), the largest of any route type; a fresh single-page measurement
on /mlb/minnesota-twins found 1,317 excess words across 36 distinct repeated
4+ word segments.

**Two mechanisms, and neither is entry 18's two-mount case.**
(1) Recurring-promo descriptions repeated per date: the same stored
description renders once per date row, e.g. the Legends Landing
all-you-can-eat description 18 times (+408 words), the $5 student ticket 7
times (+192), the military half-price offer 5 times (+144). Mount: the promo
list rows render promo.title and promo.description per row
(src/components/redesign/RedesignPromoRow.tsx:175-177 via
src/components/promo-list.tsx), and recurring every-game deals plus repeated
theme nights carry identical text on every date.
(2) Per-game-row CTA copy: the "Get tickets / ticketmaster / Get Tickets"
strip renders once per schedule row, 26 times on the Twins page (+175 words).
Mount: TicketsBlock inside the calendar and schedule expands
(src/components/redesign/GameExpand.tsx:189-219, opened from
CalendarGrid.tsx:437-457 and ScheduleRow.tsx:196-203).

**Does the entry-18 single-grid approach apply? No.** Entry 18 is one card
mounted twice for two breakpoints; here each repeat is a distinct row that
legitimately exists, carrying identical text. The fix classes are different:
for (1), collapse a recurring deal into one row with its date list, or render
the full description on first occurrence and a short reference on repeats;
for (2), a row-level compact CTA (icon or single word) with one full CTA
block per page, which also touches the affiliate-click surface area and so
needs its own review. Both change visible UX and belong to a deliberate
design pass, not a cleanup commit.

## 21. Homepage visible "Last updated" line is clock-derived

**Status: OPEN, entry-17 class.** src/app/page.tsx:319 computes
`lastUpdated = formatChicagoLong(today)` from the render clock and line 364
renders "{promoCount} promos tracked · Last updated {lastUpdated}" in the
homepage hero, so every ISR regeneration asserts updated-today regardless of
whether any data changed. This is the same synthetic-freshness class as entry
17 (fixed sitewide in the 2026-08-14 data-only tier) and was deliberately
left out of that pass as out of its approved scope. Fix shape when picked up:
bind a real stored stamp if one becomes available for the homepage slate, or
drop the "Last updated" clause and keep the promo count, which is real.

## 22. Latent unbacked freshness claims that re-arm on a flag flip or data shift

**Status: OPEN.** Five claim sites assert update mechanisms that do not run,
but currently render on zero pages only because of season or gate state, not
because the copy was fixed. They re-arm without any deploy:
(1) /playoffs "refreshes within an hour of the latest scanner update"
(src/app/playoffs/page.tsx:149, FAQPage JSON-LD plus DOM when active),
"Updated hourly." (:298, Article JSON-LD), and "Updated hourly from official
team sources." (:360 and :460, DOM). The playoff scanner cron is disabled;
all four lines sit in the active-playoffs branch and return the moment
appConfig/playoffs.playoffsActive flips true.
(2) ZeroPromoFallback announcement-immediacy promises: "be notified the
moment {team} announce their promos" (src/components/zero-promo-fallback.tsx:43,
WNBA copy) and "notified as soon as the schedule is posted" (:71, MLB copy).
The current 25 zero-promo pages are NFL/NBA/NHL/MLS, so both lines render
nowhere today; any WNBA or MLB team dropping to zero promos resurfaces them.
The pipeline is cron-driven, so moment-of-announcement claims cannot be made
true by any mechanism that exists.
(3) The two dormant gate-off clock stamps, entry-21 class: src/app/page.tsx:364
and src/components/team-hero.tsx:82 both render "Last updated {new Date()}"
on the legacy paths, live again on a single NEXT_PUBLIC_REDESIGN_V2 flip.
Fix shape: correct the copy at the source even while the surfaces are dark;
none of these should wait for the surface to reappear in prod.

## 23. Freshness claims out of scope for the 2026-08-18 indexed-page pass

**Status: OPEN.** Two claims were deliberately excluded from the
feature/freshness-claims pass:
(1) src/app/privacy/page.tsx:98 "Cached data is refreshed periodically when
you are connected to the internet" describes the Flutter app's offline cache,
which this repo can neither back nor refute; verify against the app's sync
behavior before editing.
(2) src/components/my-teams-view.tsx:667 and :733 "the calendar will populate
the moment promos are announced": /my-teams is noindexed
(src/app/my-teams/page.tsx:17) and the copy is client-only behind starred
teams in localStorage, so exposure is minimal, but the immediacy claim is
false at every scope (scans are weekly at best). Soften to added-over-time
copy when the page is next touched.

## 24. Redesign fonts silently rendered DM Sans for the life of the redesign

**Status: RESOLVED 2026-08-18 (merge 18c8e36).** The @theme font tokens
referenced runtime next/font variables (`--font-rd: var(--font-archivo), ...`),
and a CSS custom property substitutes its inner var() AT ITS OWN DECLARATION
POINT: at :root, --font-archivo (set by next/font only on the redesign
wrappers) is undefined, so --font-rd computed to invalid-empty and that dead
value inherited down. `font-family: var(--font-rd)` then fell back to the
inherited body DM Sans on every rd surface, sitewide, from the redesign flip
until 2026-08-18. The Archivo faces were declared but never fetched. The four
layout fonts survived only because next/font puts their source variables on
the html element itself, and --font-outfit survived through a self-reference
cycle that the unlayered next/font class happened to beat in the cascade.

Why code reading could not catch it: every rule involved is individually
correct, the failure lives in where var() substitution happens, and the
fallback face is a plausible-looking sans. It was found only by computed-style
probes during unrelated measurement work.

The rule going forward: **any @theme font token that references a next/font
variable must use the `@theme inline` form**, and author CSS must reference
the concrete chain (see the comment block above the font tokens in
globals.css). Note that @theme inline still emits :root aliases, so a token
whose name collides with the next/font variable it references remains a
cascade-luck cycle; the fix renamed next/font's outfit variable to
--font-outfit-sans to dissolve ours. Related deliberate choice: rd-display
and rd-numerals shipped with font-stretch neutralized to normal because the
125% expanded cut had never actually rendered; activating it is a separate
visual decision.

## 25. Em dashes in two live team-page FAQ answers, inside FAQPage schema

**Status: OPEN, filed 2026-08-21 during the notification-claims pass.** Two
FAQ answers built by `generateTeamFAQs` contain em dashes and render on all
169 team pages, in the visible FAQ and inside the FAQPage structured data:

- `src/lib/promo-helpers.ts:337`, the directions and parking answer: "Check
  the official {team} site for public transit options — most major-league
  venues are served by bus or rail routes on game day."
- `src/lib/promo-helpers.ts:344`, the hotels answer: "...surfaces the best
  rates for your specific date — prices jump on marquee dates like giveaway
  nights and playoff games, so booking early helps."

The project rule is that em dashes are fine in code, comments, commits and
internal docs, but not in user-facing copy. These are user-facing and they
are also published to Google as answer text. A third instance in the same
function was removed as a side effect of the notification-claims rewrite
(the promo-day reminder answer), but these two were deliberately left alone:
that pass was scoped to truth corrections, and rewriting adjacent copy would
have widened a 169-page structured-data change beyond its stated scope.

Fix is mechanical (replace with a comma, a semicolon, or a sentence break)
but it must be a deliberate copy commit, because it changes answer text on
169 pages in schema and should be verified at render like any other.



---

## 26. A clean tsc is not evidence a nullable field is handled

**Status: RESOLVED for the instance in `dc2d6e7`, RECORDED as a standing rule.**
Filed 2026-08-21 from the promo-count derivation change.

**What happened.** `splitPromosByDate` was given an explicit sort so its
"most recent first" guarantee would stop depending on the caller passing a
date-ascending array. The full production build then failed prerendering
`/mlb/cincinnati-reds`:

```
TypeError: Cannot read properties of null (reading 'localeCompare')
Export encountered an error on /[sport]/[team]/page: /mlb/cincinnati-reds
```

Recurring deals and the date-in-image clubs store `date: null` while the
`Promo` type declares `date: string`. The previous code filtered with
`p.date >= today` and `p.date < today`, and a null compares false against a
date string in both directions, so those rows silently fell out of both
halves. Nothing depended on that, nothing documented it, and it was not
deliberate. Adding a sort turned the accident into a crash, because `past`
then contained a row whose `date` could not be compared.

**Why it is worth an entry rather than just a fix.** Every cheap check passed
while the bug was live in the working tree:

- `tsc --noEmit` was clean, because the type says `string` and the data
  disagrees. TypeScript was asserting something about the schema that
  Firestore does not enforce.
- The full test suite passed, 515 tests, including the new tests written
  specifically for this change. Every fixture had a date, because a fixture
  author writes the shape the type describes.
- Only a real production build against real data caught it, and only on one
  team out of 169.

**The rule.** A clean type check is not evidence that a nullable field is
handled. It is evidence that the declared type and the code agree, which says
nothing when the declared type is the thing that is wrong. Where a field comes
from Firestore, treat its declared non-nullability as a claim to verify, not a
guarantee to rely on. In particular, any change that moves a field from a
comparison (which coerces silently) to a method call (which throws) crosses
exactly this line.

**The corollary for tests.** Fixtures inherit the author's mental model, so a
suite written from the type will never contain the value the type forbids.
When touching a Firestore-backed field, write at least one fixture that
violates the declared type on purpose. The regression test added alongside the
fix does this, and its comment says why.

**The practical check.** For a change of this shape, run the real build. It is
the only step in this project's gate that reads all 169 teams' actual stored
values.

---

## 27. Two auth traps on the deploy endpoints, and one ordering rule

**Status: NOT DEFECTS, recorded as operator traps.** Filed 2026-08-21 after both
were hit during the promo-count derivation release. Both endpoints behave
correctly. Both will silently do nothing if called the obvious way, and neither
reports failure in a shape that looks like failure. Companion to entry 16, which
covers the `PATH_RE` half of the same endpoint.

### `/api/revalidate` authenticates on a header, not Bearer

`src/app/api/revalidate/route.ts:48` checks
`request.headers.get('x-revalidate-secret') !== secret`. A Bearer
`Authorization` header, which is the reflex for a secret-bearing POST, returns:

```
{"ok":false,"reason":"unauthorized"}
```

and revalidates nothing. That was the actual first response this session, twice,
across 171 paths.

Combined with the trap already known on this endpoint, that it answers
`ok:true` regardless of whether the supplied paths were meaningful, the rule is:

> **Never trust the response shape. Derive the expected path count first, then
> assert the returned `revalidated` total against it.**

The endpoint caps at 100 paths per request, so a full team-page sweep is at
least two calls and the counts must be summed before comparing. The correct
call shape:

```
curl -X POST https://www.getpromonight.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"paths":["/nhl/boston-bruins", ...]}'
```

### `INDEXNOW_SUBMIT_SECRET` is not the IndexNow key

It is the auth secret for this site's own `/api/indexnow/submit` route
(`src/app/api/indexnow/submit/route.ts:27`, header `x-indexnow-secret`). The
real key is `INDEXNOW_KEY`, read by `src/lib/indexnow.ts:19`, which builds
`keyLocation` as `https://{HOST}/{key}.txt`.

Treating the submit secret as the key produces a `keyLocation` that **404s**,
and submitting directly to the endpoints with it still returns **HTTP 200 from
both** `api.indexnow.org` and `www.bing.com/indexnow`. That happened here and
looked like a clean success.

> **A 200 from IndexNow means accepted, not verified.** Acceptance is
> synchronous and key verification is asynchronous, so an unverifiable key fails
> later, silently, with no artifact on this side.

Always submit through `/api/indexnow/submit`. It holds the real key and already
fans out to both endpoints (`src/lib/indexnow.ts:12-13`), so a direct call buys
nothing and risks exactly this. It answers `{"ok":true,"submitted":N}`; check N.

### Ordering: deploy Ready, then revalidate

Revalidation regenerates a page from **whatever code is currently deployed**.
Firing it while the production build is still `Building` regenerates every path
from the OLD bundle, and the result looks identical to a successful run: the
counts match, the endpoint reports `ok:true`, and the pages serve stale content
with a fresh cache entry, which is worse than not having revalidated at all.

Wait for the production deployment to report `Ready` before revalidating. When
in doubt, verify one page with a cache-busting curl and confirm it carries the
new behaviour before sweeping the rest.

---

## 28. The team score divides an unbounded window by a one-season constant

**Status: OPEN, not urgent today, becomes systemic on corpus depth.** Filed
2026-08-21 from the hub stat-bar scoping. Lives in the pipeline
(`promo-pipeline/lib/scoring/score-team.js` and
`promo-pipeline/scripts/backfill-scoring.js`), recorded here because every
surface it moves is in this repo.

**What it is.** `backfill-scoring.js` builds `scoredPromos` from the whole
`teams/{id}/promos` subcollection with only a tombstone filter and no date
predicate, then `scoreTeam` computes:

```js
const density = sumScores / homeGames;   // homeGames is a fixed constant
const teamScore = Math.round(density * DENSITY_SCALE + varietyBonus + hotBonus);
```

`HOME_GAMES` is one season (MLB 81, NBA 41, NHL 41, MLS 17, WNBA 20, NFL 8).
So an **unbounded-window numerator is divided by a fixed one-season
denominator**. The function's own header says it "aggregates a season of scored
promos", which is what it was designed to do and not what it receives.

**It is correct today only by accident of corpus depth.** Measured against
production 2026-08-21: **3,209 of 3,226** scored-league non-recurring promos are
dated 2026, with 13 in 2025 and 4 dateless. For MLB, MLS and WNBA the season is
currently a synonym for calendar 2026, so numerator and denominator happen to
describe the same window.

**Size of the error today**, from a read-only projection that reproduces the
live scorer exactly (0 mismatches across all 75 scored teams):

| team | league | stored | season-scoped | drop |
|---|---|---|---|---|
| houston-dynamo | MLS | 64 | 18 | 46 |
| cincinnati-reds | MLB | 90 | 88 | 2 |

Every other team is identical. 27 of 75 rank positions change, but 26 of those
are plus or minus one as knock-on from Houston moving 42 to 68. **The top 20 is
unchanged**, so the page a visitor sees today is effectively the same.

**Houston Dynamo is the preview, not the outlier.** It differs because MLS has
the longest window in the corpus right now, not because anything about that club
is unusual. Every team looks like Houston once its league has more than one
season of promos.

**THE TRIGGER IS CORPUS DEPTH, NOT TIME, AND NHL WILL BREAK IT.** Two things
compound:

1. A second season of any league doubles that league's numerator while the
   denominator stays fixed, inflating every score in it and, worse, unevenly by
   how long each club has been in the corpus.
2. **NHL is the first league whose season crosses the calendar year.** An
   Oct-to-April corpus cannot be expressed as "calendar 2026", which is the
   implicit season definition the current code relies on. NBA has the same
   shape, and NFL crosses into January and February. There is no code anywhere
   in the pipeline that expresses a two-calendar-year season.

**Six surfaces a recalibration moves.** All of them shift together, so this is a
measurement boundary on the whole scored layer, not a single-page change:

1. `/team-rankings` visible rows and **the sort order itself** (`teamScore` is
   the sort key, `src/lib/data.ts:1067`).
2. `/team-rankings` ItemList JSON-LD (`src/app/team-rankings/page.tsx`), which
   publishes the score to crawlers.
3. `/best-promos` (reads `getAllTeamScores`).
4. `/best-promos/bobbleheads` (reads `getAllTeamScores`, and its copy explains
   the `averagePromoScore` rollup).
5. The league hub `all-time promos per team` stat, via `getLeagueHubStats`
   (`src/components/hub/HubStatBar.tsx`).
6. PostHog `team_score` payloads (`src/components/scoring/team-ranking-row.tsx`),
   so historical analytics rows become non-comparable across the change.

**What NOT to do.** Do not redefine `teamScores.promoCount` to fix this. It is
the denominator of `averagePromoScore`, which is stored, displayed and explained
on `/best-promos/bobbleheads`. See the reasoning recorded on `getLeagueHubStats`.

**Sequencing.** The NHL scanner writing promos is safe and does not touch this.
Enabling NHL SCORING is what trips it, and `scoreTeam` will happily score NHL
today: it returns null only for NFL, and `HOME_GAMES.NHL` is already 41. Two
flags currently prevent that by accident rather than by design, `nhl.active:false`
in `league-registry.json` and `SCORED_LEAGUES` in `src/lib/types.ts`. Neither was
built as a scoring-window guard and neither should be relied on as one.
## 29. Gate-off verification silently measured the wrong page

**Status: RESOLVED as a method, recorded as a standing rule, 2026-08-21.**
`isRedesignEnabled()` is `VERCEL_ENV !== 'production' || NEXT_PUBLIC_REDESIGN_V2
=== 'true'`. `VERCEL_ENV` is undefined in a local build, so the first clause is
always true and the redesign renders locally regardless of the flag. Every
gate-off byte-identity check run on the homepage-redesign branch before this
date was therefore comparing the redesign page against itself, and reporting it
as proof about the dark fallback. It was harmless in the phases that only added
components neither page rendered, but the check never tested what it claimed.

**The rule:** any gate-off comparison must build with `VERCEL_ENV=production`.
That build also trips the affiliate prebuild guard, so it needs a well-formed
`NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP`; use the same dummy value on both sides
of the comparison so any diff is attributable to the change under test.

This is the same class as the blocked `cssRules` read during the font
diagnosis in entry 24: in both cases a tooling artifact, not the code, produced
a confident wrong reading, and in both cases the fix was to re-measure through
a different path rather than to reason harder about the first result.

**THE GATE-OFF CONSTRAINT, RESTATED.** It was written as "byte-identical
rendered DOM". It is now **no visible or semantic change to the gate-off
path**, verified as: identical FAQPage and other JSON-LD, identical visible
text, and identical HTML after removing React interpolation markers.

The wording changed because deriving the homepage counts on the dark path
costs 48 bytes and zero meaning. Replacing the literals `6 leagues` (twice)
and `169 teams` with interpolated values makes React emit `<!-- -->` markers
around each one: 6 markers, 48 bytes, on a page whose visible text is
unchanged at 945 words and whose JSON-LD is byte-identical. A hardcoded 169 on
the rollback path is a real correctness problem the moment the team count
moves, and 48 invisible bytes is the wrong thing to trade for it.

## 30. team_tile_tap dual-emit is 15 weeks past its stated window

**Status: OPEN, cutover decision still yours, filed 2026-08-21.** Every
TeamCard click fires two events from one handler
(`src/components/team-card.tsx:45-59`): the typed dual-sink `team_tile_tap`
and the legacy GA4-only `team_card_click`.

The migration note is at `src/components/team-card.tsx:46-48` ("Drop legacy in
follow-up PR after ~2 weeks once dashboards confirmed migrated") and in commit
e682197 (2026-04-25), which says it parallel-fires "for ~2 weeks". Nominal end
was around 2026-05-09. Both still fire. No cutover date, no dashboard
sign-off, no prior entry.

Two properties of the pair matter before anyone decides:

- `team_card_click` is **GA4-only**. It goes through the legacy `event()`
  helper, never reaches PostHog, and is confirmed absent from the PostHog
  taxonomy. So the comparison the dual-emit exists to enable cannot be run in
  the tool where `team_tile_tap` actually lives.
- `team_card_click` carries **no `from_tab` and no `is_homepage_sample`**. It
  therefore cannot reproduce the one breakdown that changes at the homepage
  swap, where league tab order becomes data-derived.

The ratio between the two is invariant to the homepage swap (same handler,
same body), so the swap does not break the comparison. It does move both
levels down together. Homepage volume is roughly 2 taps per day, so any level
shift will not be separable for weeks.

## 31. collection_tile_tap: giveaways and food_deals lose their only emitters

**Status: OPEN, filed 2026-08-21, triggered by the homepage swap.** Both
values have exactly one emitter in the entire repo, `buildRedesignCollectionTiles`
(`src/app/page.tsx:225` and `:229`) rendered by the live four-tile homepage
section. No league hub emits either.

**Does the new grid re-emit them? `food_deals` yes, `giveaways` no.** The
redesigned seven-tile grid maps to `today`, `this_week`, `bobbleheads`,
`theme_nights`, `jerseys`, `soccer_jerseys`, `food_deals`. So at the swap:

- `food_deals` survives, moving from the homepage four-tile set to the new
  grid, and stays a continuous series.
- **`giveaways` becomes a dead value.** The redesigned grid has no giveaways
  tile; the concept is split across bobbleheads and jerseys, which are their
  own values. A dashboard filtered on `collection_name = 'giveaways'` shows
  roughly 66 events per 30 days, then a cliff to zero on the swap date and a
  flat line after. That is not a behavior change: the tile stopped existing.
- `hot_this_week` also loses its homepage emitter and survives only on the
  league hubs, dropping roughly 79%.

The value is deliberately left in the union rather than removed, so historical
data keeps a valid type and the cliff stays legible.

## 32. The homepage cannot be revalidated on demand

**Status: OPEN, fix shape known, deliberately not applied yet. Filed
2026-08-21.** `PATH_RE` in `src/app/api/revalidate/route.ts:39` is
`/^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}$/`, which requires at least one path
segment. The bare root `/` therefore fails validation and the endpoint returns
`invalid_path` with a 400, failing the whole batch by design.

**Why it matters more here than on any other route.** The homepage is the one
indexed route whose content goes stale on a pure date rollover with no data
write: its Tonight cards are date-derived, so at midnight they are wrong even
though nothing in Firestore changed. That is why `/` carries
`revalidate = 21600` rather than a longer window. Today the only way to force
it fresh is to redeploy, which is a heavy and unrelated action.

**Fix shape, one line:** anchor an alternation that admits exactly the root and
nothing else.

```ts
const PATH_RE = /^\/$|^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}$/;
```

**Does allowing the root open anything else? Two answers, and the second is
the one to remember.**

1. At the regex level, no. `^\/$` is fully anchored and admits exactly the
   one-character string `/`. The charset, the segment cap and the rejection of
   uppercase, underscores, dots, query strings and trailing slashes are all
   unchanged.

2. At the behavior level, no TODAY, but only because of an argument the
   endpoint does not pass. Next.js `revalidatePath(path, type?)` defaults
   `type` to `'page'`, which "invalidates any path that matches the provided
   page file" and "does not invalidate pages beneath it". The endpoint calls
   `revalidatePath(p)` with no second argument, so `/` would revalidate the
   homepage alone. But `revalidatePath('/', 'layout')` is documented to purge
   the Client Cache and invalidate ALL cached data sitewide. So once `/` is an
   accepted input, the endpoint is one added argument away from a sitewide
   purge reachable by anyone holding the secret. If the root is allowed, the
   `type` parameter should be explicitly pinned to `'page'` at the call site in
   the same commit, with a comment saying why.

**The one-line fix is not one site.** The pattern is duplicated four times and
one copy asserts it as a literal string:

- `src/app/api/revalidate/route.ts:39`, the endpoint
- `promo-pipeline/lib/revalidate-notify.js:22`, the client, which silently
  drops paths the endpoint would accept if it is not widened in step
- `src/lib/__tests__/venue-bag-policies.test.ts:182`, a mirror of the endpoint
  pattern
- `promo-pipeline/test/revalidate-notify.test.js:24`, a coupling test holding
  the pattern as the string `"^\\/[a-z0-9-]+(?:\\/[a-z0-9-]+){0,2}$"`

Widening the endpoint alone leaves the pipeline unable to send the root, and
the coupling test red. This is a two-repo change.

## 33. useSearchParams silently deletes indexed content, and only served HTML shows it

**Status: RULE, with all four known instances now conforming. Filed
2026-08-21 after the fourth one shipped anyway.**

**The failure mode.** Calling `useSearchParams()` in a client component opts
that component out of static prerendering. If the nearest `Suspense` boundary
is broad enough to contain rendered content, that content is replaced by
`BAILOUT_TO_CLIENT_SIDE_RENDERING` in the served HTML and hydrated only in the
browser. Nothing errors. Nothing warns. The build succeeds, the page looks
perfect in a browser, in dev, and in a preview, because a browser runs the
hydration that a crawler does not. **The only way to see it is to count rows in
the served HTML.**

**What it cost.** `/team-rankings` served **zero** of its 75 ranked rows to
crawlers, on a page whose entire value is that ranking, while its sibling
`/best-promos` served 50. Measured 2026-08-21 with cache-busting curls:

| page | served bytes | rows in served DOM |
|---|---|---|
| `/team-rankings` before the fix | 255,556 | **0** |
| `/best-promos` | 682,809 | 50 |
| `/best-promos/bobbleheads` | 469,458 | 50 |
| `/teams` | 314,360 | present |

**THE RULE.** Any client component on an indexed route that calls
`useSearchParams` must isolate the read into a null-rendering child inside its
OWN `Suspense` boundary, so the bailout stops at a component that renders
nothing. The parent holds the value in `useState` with a default that lets the
server render the full content, and the reader corrects it after hydration.
Reading `window.location` once on mount is NOT a substitute: back and forward
and same-route client navigations never remount the tree, and the UI desyncs
from the URL.

**TWO DISTINCT FAILURE MODES, and they need different checks.**

**Mode 1, the bailout: content missing from served HTML.** The boundary is too
broad, so the rendered subtree is replaced by BAILOUT_TO_CLIENT_SIDE_RENDERING.
Detection: count rows in served HTML with a cache-busting curl. A local build
check and a browser check BOTH pass while this is live.

**Mode 2, the double render: content duplicated after hydration.** Once a
component owns its own inner boundary, a redundant boundary at the page level
re-triggers a client render of the whole subtree and leaves the server copy in
the DOM. Detection: **load the page in a browser and count what is actually
visible.** The build passes, AND the served-HTML curl passes, because the
served HTML is correct. This is the mode that bit us second: after the mode-1
fix, `/team-rankings?league=MLB` served a correct 75 rows and then hydrated
into 105 score badges, 30 visible plus a hidden zero-height copy of all 75, and
rendered two contradictory count lines, one reading 30 teams ranked in MLB and
one reading 75 teams ranked.

So the pre-merge check is BOTH, and both are runnable commands:

```bash
# mode 1: content present in served HTML
curl -s "https://www.getpromonight.com/team-rankings?cb=$RANDOM" \
  | grep -o 'Team promo score:' | wc -l

# mode 2: no hidden duplicates after hydration. Exits non-zero on failure.
node scripts/check-hydration-duplicates.js "https://www.getpromonight.com/team-rankings"
node scripts/check-hydration-duplicates.js "https://<deployment>.vercel.app/best-promos?_vercel_share=<token>"
```

The mode-2 script takes any preview or production URL, share token included,
knows the repeating element for the scored surfaces, accepts `--selector` for
anything else, and exits 1 on any hidden duplicate so it can gate rather than
merely report. It replaces the manual browser session that this entry used to
prescribe, because a check depending on a browser session staying alive is a
check that gets skipped.

**SENSITIVITY CAVEAT, because a guard nobody trusts correctly is worse than
none.** The script has NOT been shown to reproduce the one historical case.
Real Chrome reported 105 badges and three count lines on the pre-fix
deployment; the script against that same deployment reports 30 of 30 visible,
zero hidden, at every timing tried. Either headless does not reproduce that
hydration path, or the original reading was an artifact of the browser
extension's evaluation context, and those cannot be separated without a real
browser. Treat a clean run as cheap evidence rather than proof, and keep a real
browser in the loop for anything load bearing. The fix that prompted all this
stands regardless: a boundary above a component that already owns one is
redundant on its own terms.

**Three worked. One did not, and that is the point.**

- `best-promos-browser.tsx`, `ScoreParamsReader` in its own boundary. Correct,
  with a comment explaining exactly why.
- `teams-browser.tsx`, same pattern, same explanatory comment.
- `PageViewTracker` and `ScoringPageViewTracker`, safe by construction because
  they render `null` already.
- `team-rankings-list.tsx`, **the one that failed**: it called
  `useSearchParams` at its top level while the page wrapped the whole list in
  one boundary, so the bailout took the table. Fixed in `6e7472c`.

The lesson is not that people forget. Two correct instances carried comments
explaining the trap, and the fourth shipped anyway, because nothing in the
build, the type system, the test suite or a browser disagrees with it. A
convention that only lives in comments is invisible at exactly the moment a
new component is written.

**Enforced by a lockstep test** (`src/lib/__tests__/search-params-bailout.test.ts`),
in the style this repo already uses for `KNOWN_SURFACES` and the revalidate
`PATH_RE`. Read that test before assuming it covers more than it does:

- It CATCHES mode 1 for new components: any file calling `useSearchParams` that
  neither renders `null` nor owns a `Suspense fallback={null}`.
- It CATCHES the specific mode-2 shape that actually occurred: a page directly
  wrapping a self-bounded component in `Suspense`.
- It CATCHES reintroduction of the URL-synced chip mode, which reads
  `useSearchParams` and renders content.
- **It does NOT catch a boundary further up the tree**, for example `Suspense`
  around a wrapper `div` that contains the component, or a boundary added in a
  layout rather than a page. Those produce mode 2 and the test will pass.

**So mode 2 still needs a human with a browser.** The test narrows it; it does
not close it.

## 34. team-card renders raw team color as text on a tint of itself

**Status: OPEN, deferred deliberately, filed 2026-08-21 during the contrast
sweep.** `src/components/team-card.tsx:79-84` renders a league chip whose text
is the team's raw `primaryColor` on an 8.2 percent tint of that same color.
It is the same defect the category chips had, one level worse, because here
the color is DATA rather than a fixed palette.

**Scale: 38 of 134 team colors fail AA on the light variant.** The spread runs
from **1.27:1** (`#ece83a`) to 17.46:1 (`#000000`), so the same component is
unreadable for some clubs and pristine for others. Sixteen more sit in a 4.5
to 5.5 band that any token change would push under. On the dark variant the
failing set INVERTS: navies and greens fail where golds pass. No single static
rule covers both.

**Why the sweep did not fix it, and why chipInk is not the answer.**
Mechanically `chipInk()` is a one-line drop-in. Semantically it is the wrong
function: it is a binary picker that answers "does white or near-black read on
this SOLID fill", and both existing call sites (`LeagueChip`, `HubTeamGrid`)
hand it a solid. This chip is a wash, so there are two ways to apply it and
both are redesigns, not contrast patches:

1. Pass the composited tint. Every tint is near-white, so it returns near-black
   for all 134 teams: every league pill becomes identical near-black text and
   the team-color accent disappears from the top-left of every card.
2. Pass the raw color and make the pill a solid fill, matching the existing
   call sites. That puts 134 saturated blocks of team color in a five-across
   grid, competing with the card's own team-color underline.

**What the real fix looks like.** A hue-preserving darkener in
`src/lib/chip-contrast.ts`, roughly `inkOn(hex, bg, target = 4.5)`, walking HSL
lightness down until the ratio clears. It keeps the club's hue (Steelers gold
stays gold, just deeper), keeps the tinted-lozenge look, and being data-driven
it cannot regress when a team is added or rebrands. That is the opposite
direction from the same algorithm that generated the dark-context candidates
recorded in `categories.ts`.

This needs a design decision, not just an implementation, which is why it was
split out of the mechanical sweep rather than bundled into it.

## 35. The ink-faint token fails AA on its own, and a fade was hiding it

**Status: RESOLVED 2026-08-21 on `feature/ink-token-split`. Filed the same day
during the contrast sweep.** The diagnosis below describes the RETIRED value
`#9a9081`; the Resolution section at the end has what shipped and the one
finding worth carrying forward. `--color-rd-ink-faint: #9a9081` (then at
`src/app/globals.css:33`, commented "eyebrows, captions") did not clear WCAG
1.4.3 normal text on either surface it renders on, **before any opacity is
applied**:

| background | ratio | 4.5 normal text | 3.0 graphics |
|---|---|---|---|
| `--color-rd-card` #ffffff | **3.14:1** | FAIL | pass |
| `--color-rd-cream` #f7f3ea | **2.84:1** | FAIL | **FAIL** |

**CORRECTED 2026-08-21, and it is worse than first written.** The original
version of this entry said the token is "under 4.5 on white and cream", which
understates it. **White is the only surface in the codebase where ink-faint
reaches even 3.0.** On the cream page, on the #faf7f0 tint, on every tinted
calendar cell and on every rd-ink 6 percent pill, it fails the NON-TEXT bar
too. So the icon and glyph uses that would otherwise be defensible under SC
1.4.11 are defensible only on white cards, and two of them (a remove-chip
glyph on cream and a 13px clock icon on the cream page) fail outright.

**Scale: 181 uses across 70 files**, applied through the `text-rd-ink-faint`
utility.

**Why it surfaced only now, and this is the part worth remembering.** The
completed promo rows carried `opacity-60`, which composited the whole row and
put the same text at **1.89:1**. The fade was the visible, obviously wrong
number, so it took the attention. Removing it lifted the text to 3.14:1, which
looked like a fix and was actually the token's own untreated value coming into
view. **A defect that makes a second defect look like the whole problem hides
the second defect behind its own fix.** The measurement that caught it was
recomputing every element ratio AFTER the change rather than declaring victory
because the number improved.

**This was a token change with sitewide visual consequences, not a component
fix.** One value governed every eyebrow, caption, timestamp, count line and
unit label in the redesign, so moving it changed the visual weight of the
quietest tier of type on every page at once.

**Not every use needed 4.5:1.** Uses that are icons, borders or pure decoration
are judged at 3.0. Scoping which of the 181 are read as text, at what sizes and
on which background, is what the fix was built on.

### Resolution

The token was split rather than darkened, because it had been doing two jobs
under one name. Readable text kept the name and moved to a compliant value;
decoration got a token of its own and kept the old one.

| token | value | white | cream | role |
|---|---|---|---|---|
| `--color-rd-ink` | `#211d18` | 16.75:1 | 15.13:1 | headings, titles |
| `--color-rd-ink-soft` | `#50483f` | 8.98:1 | 8.10:1 | secondary body text |
| `--color-rd-ink-faint` | `#786e60` | 5.00:1 | 4.52:1 | eyebrows, captions |
| `--color-rd-ink-decor` | `#9a9081` | 3.14:1 | 2.84:1 | NOT FOR TEXT |

All three text tones clear 4.5:1 on both grounds, which no version of the old
ramp did. `ink-decor` carries the retired value and is confined to aria-hidden
glyphs and fills, enforced by `src/lib/__tests__/ink-decor-usage.test.ts`.

**THE FINDING WORTH KEEPING: the ramp's span is fixed, so its two steps trade
one for one.** Both ends are pinned. `ink` is the brand charcoal. `ink-faint`
sits exactly on the 4.5:1 floor for cream, the tighter of its two grounds, so
it cannot be lightened without failing and gains nothing by being darkened.
That locks `ink` to `ink-faint` at 3.35:1, and the two steps have to multiply
to it. Bringing `ink-faint` up to compliance therefore compressed the bottom
step to 1.32:1, and the only way to get it back was to spend the top step:
`ink-soft` went `#6f665a` to `#645c51` to `#50483f`, restoring the bottom step
to 1.79:1 and taking the top step from 2.55:1 to 1.87:1. The even split is
1.83:1 on each and past it the ramp inverts. **There is no value that makes
both steps generous**, so an edit that appears to improve one step is taking it
from the other. The guard asserts both steps, their product against the span,
and that the ramp has not inverted.

**Why the budget went downward.** The two steps are not equally supported.
`ink` and `ink-soft` are nearly always separated by weight or size as well as
tone, so tone is one signal among several. `ink-soft` and `ink-faint` meet at
the same size and weight in real copy, most visibly in the giveaway bullet list
on a team page, where tone is the only signal there is. The step with no backup
got the budget.

**Grounds were measured, not assumed, and the first measurement was wrong.**
Reading the source suggested white and cream. Instrumenting the rendered pages
found four: white `#ffffff`, cream `#f7f3ea`, and the two calendar cell tints
`#f9f9f9` and `#fdf3f2`. No ink tone renders on a dark ground anywhere. Two
mistakes in that measurement are worth not repeating. Tailwind v4 emits
alpha-modified colors as `oklab(...)`, so pulling numbers out of a color string
with a regex reads those coordinates as RGB and reports the cream sticky header
as near-black, which produced a confident 1.09:1 "failure" that did not exist.
And a hand-composited tint is not the same as asking the browser. Resolve
colors by painting them to a canvas and composite the real ancestor chain.

---

## 36. The weekly digest was shipping two sub-AA text tones to real subscribers

**Status: RESOLVED 2026-08-22 on `fix/aa-copy-and-email`. Found 2026-08-21
while surveying the ink ramp, on a surface the ramp work was not looking at.**

`src/lib/email.ts` carries its own palette, and two of its text tones did not
clear WCAG 1.4.3 normal text on the white card every one of them renders on:

| value | on `#ffffff` | 4.5 normal text | what it carried |
|---|---|---|---|
| `#8a8276` | **3.79:1** | FAIL | digest date column, team meta line, every footer and unsubscribe link |
| `#a39b8d` | **2.75:1** | FAIL | the CAN-SPAM postal address |

Ten uses of the first, one of the second. Everything else in the file passed:
`#1d1714` 17.72, `#4b463f` 9.35, `#6b6459` 5.85, `#d31145` 5.34, white on the
red CTA 5.34, and the wordmark accent 5.76 on the dark bar.

**Why this one matters more than a page.** It is sent weekly to real
subscribers, and email clients render on white by default, so the worst-case
ground is the actual ground. Unlike a web page there is no devtools pass, no
Lighthouse run, and no crawler that will ever report it.

**Why nothing caught it.** The colors were 28 inline literals spread through
template strings, because email HTML has to inline everything. There is no
rendering test for this file, only `email-timeout.test.ts`, which exercises the
send path. So there was no single place where the palette could be read, and
no check that would have failed.

### The palette decision

**Email stays a separate palette. It cannot be otherwise.** Email cannot read
CSS custom properties: Gmail strips `<style>`, Outlook renders through Word,
and `var()` is unsupported across the major clients. Every color in a mail body
has to be an inline literal hex, so there is no mechanism by which `email.ts`
could consume `--color-rd-ink-soft` at render time. The most that could be
shared is a build-time TypeScript constant, which is a different thing from a
token and would still be a second copy.

There are two further reasons not to force them together even at build time.
The grounds differ: the email card is `#ffffff` inside a `#f4f1ea` frame, not
the site's `#f7f3ea` page. And email clients mutate colors in ways the web
never does, since Gmail and Apple Mail dark mode can invert or shift a light
palette, so a change made for the site could land somewhere unintended in a
client.

**What is shared is the standard, not the token:** every tone clears 4.5:1 on
the ground it actually renders on. That is the rule that was violated, and it
is the rule the guard now holds.

**The fix.** Both failing values move to `#786e60`, which is the site's
`ink-faint`, borrowed outright because it is the same job and is already the
proven floor at 5.00:1 on white. The postal address and the footer collapse
into one tone as a result, which is correct: the postal line is legally
required text and cannot sit below the readable floor just to be quiet.

The 28 literals are now five named constants in one documented block, because
the scattering is what allowed the drift. `src/lib/__tests__/email-contrast.test.ts`
asserts each tone against the card, the two wordmark tones against the dark
bar, that no inline `color:#hex` literal reappears past the constants, and that
the quietest email tier has not drifted from the site's `ink-faint`. All four
were shown to fail before being committed.

**What the guard does not cover.** It reads declared values, so it proves the
palette is compliant, not that a given string is painted on the ground the test
assumes. And no static check reaches what a mail client does to the colors
after delivery.

---

## 37. The /about copy carries a review date, and a test holds the words to it

**Status: RULE, in force since 2026-08-22. Written up 2026-08-25; the code
had cited this entry since the guard shipped.**

`/about` publishes `ABOUT_LAST_REVIEWED` three ways: the visible "Last
reviewed" line, `AboutPage.dateModified`, and the sitemap `<lastmod>` for the
URL. A hand-maintained date goes stale the first time the copy moves and the
date does not, and that failure is silent: the page builds, the schema
validates, and the only symptom is a freshness claim that quietly stopped being
one. Entry 17 recorded the opposite mistake on 169 team pages, a synthesized
`new Date()` that claimed freshness every render.

**The rule.** `src/lib/about-copy.ts` holds the copy, the date, and
`ABOUT_COPY_FINGERPRINT`, a SHA-256 of its own contents with the fingerprint
line removed. `src/lib/__tests__/about-freshness.test.ts` recomputes the hash
and fails the suite when the words moved and the date did not, printing the
value to paste in. So a copy edit on that page is also a review-date
commitment: re-read the page, then bump `ABOUT_LAST_REVIEWED`,
`ABOUT_LAST_REVIEWED_LABEL` and the fingerprint in the same commit.

**What it does not prove.** That a human re-read the page, and anything that
lives outside the file: a count derived from Firestore changes without any edit
here, which is the intended design.

---

## 38. The shared social card still says the retired tagline

**Status: OPEN, design task. Filed 2026-08-25 by the brand-copy pass that
retired the line everywhere else. Severity: Medium (every shared link).**

`public/og-image.png` is the one static 1200x630 social card, referenced by
every route's `og:image` and `twitter:image` and by the SportsEvent images in
the scored, rivalry and champions schema. The text baked into it reads:

```
PROMONIGHT
Every promo. Every team.
Free on iOS and Android
```

Both lines are now wrong. The tagline became `Find the game, plan the night.`
(`src/lib/brand.ts`), and the app is the companion to the website, not the
product, and covers four leagues. The alt text on every route now describes
the card the site means to ship (`OG_IMAGE_ALT` in `src/lib/og.ts`:
`PromoNight: Find the game, plan the night.`), so until the image is
regenerated the alt and the pixels disagree. That is the intended interim
state: the alts had quoted a third variant of the old line that matched
nothing, and one shared constant that is right the moment the file is replaced
is better than five literals that were wrong in two spellings.

**What regenerating it needs.** A 1200x630 PNG at the same path, wordmark plus
the tagline, no app sub-line or, if one is wanted, one that names the four
leagues (`APP_LEAGUES` in `src/lib/coverage-counts.ts`). Nothing in code
changes when the file is replaced. `src/app/api/og/route.tsx`, a per-request
generator that carried a fourth wording, was removed in the same pass; nothing
referenced it and Ahrefs recorded no backlinks to it.
