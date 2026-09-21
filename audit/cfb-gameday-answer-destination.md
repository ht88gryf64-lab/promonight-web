# The `gameday` answer has no destination. Where it should go.

**Date:** 2026-09-21. Report only, nothing built.

## The gap

`ContributeForm.tsx:71` collects it:

> **placeholder:** "Where to park, when lots open, how to get in."

`/api/cfb/contribute` stores it as `content.gameday`. And then nothing. It is
the one contribution field with no route to a page:

- `SECTION_MAP` (`src/lib/cfb/editorial.ts`) deliberately omits it, so
  `approve-contribution.ts --approve=gameday` is rejected as an unknown section.
- The template's `editorial.gamedayCulture` (`CfbSchoolPage.tsx:329`) is
  hardcoded null in `flattenEditorial`.

A contributor can write the answer, a human can read it in the review queue,
and there is no command that publishes it. Andrew left it blank, so it has not
cost anything yet.

## Recommendation: `cfbSchools.editorial`, not a venue-hub overlay

**The question the form asks is not the question the hub answers.**

The venue hub is **building truth**: one `venueHubs` doc per stadium, every
claim carrying a source URL, a verification date and a four-state row, gated by
`publishedView` and re-derived by `buildCondensedLogistics`. Beaver Stadium's
hub already carries gates, bag policy, parking and transit — sourced, dated,
and shared across every tenant of the building.

The contributor's answer is **a person's experience of a Saturday**. "Where to
park, when lots open, how to get in" read in first person is not a second
opinion on the operator's gate time; it is the thing the operator never
publishes — which lot actually fills, which entrance is quicker, whether to
arrive Friday.

Three reasons the hub is the wrong home:

1. **It would put unsourced prose into a sourced corpus.** Every hub field
   carries provenance and a date; that discipline is the point of the venueHubs
   build and of the two fabricated gate-time claims that had to be removed from
   `venues` in August. A contributor's recollection has no source URL and can
   have none. Mixing it in either corrupts the provenance contract or forces a
   second, weaker tier inside the same doc.
2. **The hub is shared; the contribution is not.** `VenueHubTenantOverlay`
   exists because buildings have several tenants. Beaver Stadium has one, but
   Lincoln Financial Field, SoFi and MetLife do not, and the overlay is keyed
   by `teamId` precisely so one tenant's facts never speak for another's. A
   contributor writes about *their* program's Saturday. Parking it on the
   building and scoping it back to a team reproduces `cfbSchools` with extra
   steps.
3. **The suppression machinery does not fit.** Hub claims are withheld when the
   operator source rots — a 404'd VTA page, a Caltrain station that will not
   open. There is no equivalent failure mode for "the tailgate scene is world
   class", and no evidence that would retire it. It would sit permanently
   outside every gate the corpus applies.

**So: `cfbSchools.editorial.gameday`**, a fifth section beside `whyYouGo` and
`venueInTheirWords`, same `CfbEditorialSection` shape, rendered into the
existing `editorial.gamedayCulture` slot the template already has at :329.

## The guard, either way

The `whyYouGo` guard is not sufficient here, because this section makes
**operational claims a reader will act on** — when to arrive, where to park.
Wrong prose about a lot opening time costs someone their first quarter. Three
additions on top of the existing allowlist:

1. **A conflict check at approve time, not at render.** If the school's venue
   hub carries a sourced `gatesOpen`, `parkingLots` or `tailgateWindow`, the
   approver prints the hub's value next to the submitted sentence and refuses
   `--execute` without an explicit `--acknowledge-hub-conflict`. Contributor
   prose must never silently contradict a sourced operator claim on the same
   page. This is the one guard that does not exist in any form today.
2. **Attribution that states the tier.** The hub block reads as fact because it
   is sourced. This block must read as one person's account: the existing
   `Byline` is the mechanism, and the section heading should carry the voice
   ("A local's gameday" rather than "Gameday"), so the two blocks are not
   mistaken for the same kind of claim at a glance.
3. **Recency, because logistics rot.** Unlike `whyYouGo`, this decays — lots
   close, shuttles change, a stadium renovates. `approvedAt` is already stored
   per section. Either surface it ("as of September 2026") or expire the
   section after a season and return it to the queue. **This is the field
   [[dated-claims-have-no-home]] was about**: 340 venue strings already carry a
   clock with no expiry field in either corpus. Adding a fifth section that
   dates faster than the other four, without deciding this first, repeats that
   mistake on a new surface.

**If the hub route is chosen anyway**, the guard is heavier, not lighter: a new
`provenance: 'contributor'` tier on the overlay, `publishedView` taught to gate
it separately from sourced claims, `buildCondensedLogistics` taught not to mix
tiers in one line, and a per-claim visual distinction in the four-state row.
That is a corpus change, not a feature.

## Smallest honest alternative

If neither is wanted soon: **stop collecting it.** A form field whose answer
can never publish spends a contributor's goodwill for nothing, and the CTA
promises "a person reads every submission before anything publishes". Removing
the textarea is two lines and is more honest than banking answers with no exit.
