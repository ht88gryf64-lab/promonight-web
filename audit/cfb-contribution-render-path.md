# CFB contribution render path — read-only finding + wiring scope

**Date:** 2026-09-20
**Trigger:** contributor submission `xjbIK9nfmh4zP7AotIJz`, penn-state, pending-review.
**Verdict: THE RENDER PATH DOES NOT EXIST. The submission was NOT approved.**
Nothing was written to any collection. This document is the scope, not the build.

---

## 1. What approval mechanically means today: nothing

There is no path from `cfbContributions` to a rendered page. Flipping this
doc's `status` to anything at all changes zero bytes of `/cfb/penn-state`.

**The write half is built. The read half does not exist.**

| link in the chain | state |
|---|---|
| Public form POSTs to `cfbContributions` | BUILT — `src/app/api/cfb/contribute/route.ts:25` |
| Owner email notification | BUILT — `src/lib/cfb/notify.ts` |
| Anything reads `cfbContributions` | **DOES NOT EXIST** — the string appears in exactly 3 files, all of them writers or their comments |
| `cfbSchools` carries editorial prose | **DOES NOT EXIST** — `CfbSchool` (`src/lib/cfb/types.ts:25-41`) has no prose field. Its only editorial members are `editorialStatus` and `traditionIds` |
| Page data layer emits editorial | **HARDCODED NULL** — `src/lib/cfb/data.ts:303` |
| Template renders editorial | BUILT — `src/components/cfb/CfbSchoolPage.tsx:204, 233, 329, 414, 436` |

The line the brief cited as `data.ts:311` is now **`data.ts:303`**, unchanged in
substance:

```ts
editorial: { signatureGameId: null, traditions: [], gamedayCulture: null,
             whyYouGo: null, venueInTheirWords: null, contributor: null },
```

Its own comment states the design: *"Phase 3 auto pages: editorial blocks are
all empty; the ONE template hides them. Phase 4 populates these as a DATA
change (no template change)."* Phase 4 was never built. The template is
waiting on a producer that does not exist.

**So, precisely:** approval today is neither a status flip that publishes, nor
a copy into `cfbSchools.editorial` (no such field), nor anything else. It is a
no-op. The queue is a holding pen with no exit.

### 1a. A second no-op worth naming

`editorialStatus` is computed at `data.ts:300` and consumed by **nothing**.
`CfbSchoolPage.tsx:49` destructures `{ school, venue, games, editorial }` — it
never reads `editorialStatus`. The template gates every editorial section
solely on the presence of the `editorial.*` value it paints. `metadata.ts:2`
records that the title/description tier was *removed* from `editorialStatus`.

Therefore "flip `editorialStatus` to destination" is, today, also cosmetic. It
would be a data-truth marker with no rendered consequence. That is fine, but it
must not be mistaken for the thing that publishes.

---

## 2. The submission, verified present and intact

Read-only fetch, 2026-09-20. Queue size: **1**. This is the first and only
contribution the site has ever received.

```
schoolId     penn-state
name         Andrew
status       pending-review
autoPublished false
submittedAt  2026-09-20T15:56:20.204Z
userAgent    iPhone / iOS 18.7 / Safari
```

Content keys as stored: `whyYouGo`, `traditions`, `gameday` (empty),
`venueInWords`, `signatureGame`.

`cfbSchools/penn-state` confirms the receiving end: `editorialStatus: "auto"`,
`traditionIds: []`, `venueId: "beaver-stadium"`, and **no prose field of any
kind**.

---

## 3. Two field-shape gaps between the form and the template

These are not cosmetic renames. They block two of the five sections
independently of the missing read.

**`signatureGame` cannot ever reach `signatureGameId`.** The form stores free
text — here, `"The Whiteout"`. The template resolves it as a game id:
`games.find((g) => g.id === editorial.signatureGameId)`
(`CfbSchoolPage.tsx:72`). A phrase can never match a
`2026-w{n}-{home}-{away}` id. The correct destination for this content is a
`themeDesignation` on the game doc, which is exactly what the review ruling
below calls for. That route also inherits the right gate: themes render only
when `g.verified === true` (`data.ts:286`), per types.ts LOCKED DECISION 5.

**`traditions` has no renderable shape.** The type is `unknown[]`
(`data.ts:65`) and the template carries an explicit Phase 4 TODO
(`CfbSchoolPage.tsx:327`): traditions are not rendered at all, at any value.
Holding this section costs nothing, because publishing it is currently
impossible.

`gameday` → `gamedayCulture` and `venueInWords` → `venueInTheirWords` are
plain renames and are fine.

---

## 4. The review decisions, DECIDED but NOT EXECUTED

Recorded here so the editorial judgment survives; none of this is written to
Firestore.

| section | ruling |
|---|---|
| `whyYouGo` | **publish**, with one fix: *"and a there is no experience"* → *"and there is no experience"*. Nothing else changed. |
| `venueInWords` | **publish as written.** |
| `traditions` | **hold.** Two names, no narrative. (Also unrenderable — §3.) |
| `signatureGame` | **hold** pending the 2026 White Out date confirmed from gopsusports.com. When confirmed it becomes the first `themeDesignation`, not an editorial field. |
| `gameday` | not answered. Beaver Stadium's venue hub already carries the logistics. |

Attribution when this does publish: **"Andrew"**, first name only. The `contact`
value is an email address and **never leaves the contribution doc** — see §5.2.

---

## 5. Scope to wire it

### 5.1 Recommended shape: copy-on-approve onto `cfbSchools`

Not a render-time read of `cfbContributions`. Four reasons:

1. **Blast radius.** `cfbContributions` is the landing collection of an
   unauthenticated public POST. A render-time read puts that endpoint one
   boolean away from 87 indexed pages.
2. **PII.** The doc carries `contact`, an email address. A direct read pulls
   the whole document into the render process, where one careless spread puts
   it in served HTML. The FollowForm email exposure is the precedent; keep the
   email out of the render process entirely rather than out of the JSX.
3. **Cost.** A fifth loader in `getCfbCorpus()` (`data.ts:180`) is a full extra
   collection read per build for a collection that is empty for 86 of 87
   schools.
4. **Stated design.** The contribute route's own header already says it:
   *"Graduating a school (review -> publish -> auto->destination) is an
   operational human step, not an automated path."*

### 5.2 The six pieces

**A. Type.** Add an `editorial` block to `CfbSchool` (`types.ts:25`):
`whyYouGo`, `venueInTheirWords`, `gamedayCulture`, `contributor { name, credit }`,
plus per-section provenance (`contributionId`, `approvedAt`, `approvedBy`).
Omit `traditions` (no shape) and `signatureGameId` (§3).

**B. Reader.** `data.ts:303` reads `school.editorial` field by field,
absent-means-null. **No new Firestore call** — `loadSchools()` already has it.

**C. Writer.** `scripts/cfb/approve-contribution.ts`, `--execute` gated: takes
a contribution id and an explicit section allowlist, copies only the approved
sections to `cfbSchools/{id}.editorial` with `set({ merge: true })`, and stamps
`reviewedBy` / `reviewedAt` / `approvedSections` / `heldSections` back on the
contribution doc. **Never copies `contact`.** An allowlist, not a spread.

**D. Overwrite guard — the piece with real risk.**
`cfbSchools` is machine-owned and sits in `WIPE_COLLECTIONS`
(`run-phase2.ts:240`). Both writers use a bare `set()` that hardcodes
`editorialStatus: 'auto'` and `traditionIds: []` and carries no unknown field
forward (`run-phase1.ts:188`, `run-phase2.ts:219`). Editorial prose stored
there is erased by a full Phase 2 run, and `editorialStatus` is reset to
`auto` — silently, since nothing reads it.

This needs the treatment `cfbGames` already has: a `HUMAN_OWNED_FIELDS`-style
allowlist carry-forward covering `editorial` and `editorialStatus`, and
`editorial` added to the `assertWipeSafe` protected set.

*Live risk today is contained:* the Phase 2 writer is quarantined — every
`--execute` is refused without `FORCE_UNSAFE_WRITE` (`run-phase2.ts:269`). The
hazard is latent, not active. **The guard must land in the same commit as the
field, not after it.**

**E. The `editorialStatus` flip.** Keep it as a data-truth marker, and state
plainly that it moves no pixel (§1a). Do not let it stand in for publishing.

**F. Verify.** Revalidate `/cfb/penn-state`, then check entry 33 **both modes**
against served HTML with a cache-busting curl — the prose must be countable in
the served bytes, not just visible in a browser.

### 5.3 Sequence

A+B in one commit (type + reader, still renders nothing — no data exists yet).
D next, before any data is written. C last, then approve this doc for real.

---

## 6. Byline copy: no change needed

`CfbSchoolPage.tsx:427` reads: *"A person reads every submission before
anything publishes, and a published section credits its contributor."*

That is forward-looking and true. It does not claim contributors exist and does
not imply they do not. Nothing published, so nothing to amend. When Andrew's
sections go live, `editorial.contributor` renders *"Gameday section by
{credit}"* at `:436` and the claim becomes demonstrated rather than promised.

---

## 7. State at close

- Nothing written. `cfbContributions/xjbIK9nfmh4zP7AotIJz` is untouched, still
  `pending-review`, still the only doc in the queue.
- Nothing published. `/cfb/penn-state` is unchanged; no verify was run because
  there was nothing to verify.
- `contact` was read once in this audit and appears nowhere in this document.
