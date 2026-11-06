# Firecrawl cache: bounded across waves 1 to 4. 2026-09-04. Report only, nothing re-fetched.

## 1. MERGED

promo-pipeline main:
  380f666  Merge fix/firecrawl-maxage (maxAge passthrough). Pushed. 827/827.
  fb51318  fix(harvest): every capture-writing fetch passes maxAge 0.
           On branch fix/harvest-maxage-callers, NOT merged.

CONFIRMATION ASKED FOR, AND IT FAILED FIRST TIME. The passthrough merged in 380f666
was UNUSED. All six in-repo callers still took Firecrawl's default, so the fix existed
and changed nothing. All six write capture checkpoints that later serve as the
evidence base for dated claims, so all six are observation fetches and all six now
pass maxAge 0: sweep-venue-facts, sweep-cfb-evergreen, fetch-cfb-pdf-gaps,
nhl-refresh-captures, verify-sibling-split, diag-wnba-fold. nhl-refresh-captures is
the sharpest, since its stated purpose is to "carry today's page".

The carve-out in the passthrough's own commit message, that ordinary sweeps keep the
cheap cached path, was written before I looked at the callers. No current caller
qualifies. The default stays undefined for a future one.

The scratchpad harvester honours FC_MAXAGE and DEFAULTS TO CACHED. It is a scratchpad
tool, so it is noted rather than fixed: any wave 5 harvest must set FC_MAXAGE=0.

## 2. THE BOUND

METHOD. Group every capture by URL, order by mtime. The first capture of a URL has no
earlier copy to compare against, so its age is UNMEASURED. A later capture that DIFFERS
proves a real fetch happened at that time. A later capture that is byte-identical is
CACHE-CONSISTENT and cannot claim observation at its recorded time.

Byte identity is an UPPER BOUND on cache-serving, not proof per capture: a genuinely
static page also returns identical bytes. It is decisive only where the page is known
to be volatile, which is why the WMATA arrivals board carrying "Updated:8seconds ago"
settled wave 4.

  wave          total  unmeasured  cache-consistent  demonstrably-observed
  pre-wave 1       29          27                 0                      2
  wave 1           35          35                 0                      0
  wave 2            4           4                 0                      0
  wave 3           34          34                 0                      0
  wave 4           27          11                16                      0
  WAVES 1 TO 4    100          84                16                      0

NOT ONE CAPTURE IN WAVES 1 THROUGH 4 CAN BE DEMONSTRATED TO BE A REAL OBSERVATION AT
ITS RECORDED TIME. 84 are unmeasured and 16 are provably identical to bytes read
earlier. The only two demonstrably-observed captures in the entire corpus predate
wave 1.

WHY SO MANY ARE UNMEASURED, PLAINLY. 18 of 111 distinct URLs were captured more than
once. For the other 93 there is nothing to compare against. Unmeasured is not a
softer version of fresh: it means the question was never asked, and with no maxAge
set the honest reading is that any of them could have been served from cache.

The 16 cache-consistent captures are all wave 4: 6 delta-center, 7 lenovo-center,
and the 3 rechecks. Every one is a page wave 3 had already read, re-fetched during a
gate billed as a full cold re-derive.

## 3. CONSEQUENCE FOR observedAtByField

A capture whose age is unmeasured cannot supply an honest observation time. Joining
the 55 stamped fields on the live documents against the classification above:

  unmeasured               51 fields
  demonstrably-observed     4 fields

51 OF THE 55 MUST BE RE-HARVESTED WITH maxAge 0 BEFORE ANY DATE CAN RENDER BESIDE
THEM, across all 11 documents (8 buildings and 3 tenant overlays).

The 4 exceptions are all little-caesars-arena, all resting on one capture of
313presents.com/venue/little-caesars-arena/directions-parking, which differs from an
earlier capture of the same URL and is therefore proven to have been observed at
2026-09-03T01:16:35Z: parkingLots, parkingLotMapUrl, rideshareDropoff and
officialParkingUrls. Those four could honestly carry 2026-09-03. They are stamped
2026-09-04T01:07:18Z, so even the one date the corpus can support is not the date
that was stored.

This is why the render change shipped first. All 55 currently show no date at all,
which is the correct state for 51 of them and an understatement for 4.

## 4. RULINGS, 2026-09-04

RULING 1: NO BACK-HARVEST. The 84 unmeasured captures stay as they are. Their VALUES
are verified against page text and that verification stands; it is only the
observation TIME that is unestablished, and the two are separate claims. Dates return
per building as waves re-harvest with maxAge 0. FRESHNESS IS REBUILT FORWARD, not
retrofitted. The practical effect is that a building carries no date until its next
harvest, which is the honest state and also the one that creates pressure to
re-harvest rather than to paper over.

RULING 2: LITTLE CAESARS' FOUR PROVABLE FIELDS DO NOT GET A HAND-ENTERED DATE. The
corpus can support 2026-09-03T01:16:35Z for parkingLots, parkingLotMapUrl,
rideshareDropoff and officialParkingUrls, and they will not receive it. A timestamp
typed by hand into a system whose entire point is harvest-recorded timestamps is the
defect, not the fix: it would be indistinguishable in the document from a real one,
and the guard cannot tell them apart. They re-harvest with the rest.

Both rulings follow the same line the guard already enforces. An observation time is
something a harvest RECORDS, never something a person or a writer SUPPLIES.

## 5. WHAT IS NOT CLAIMED

Nothing was re-fetched. No venueHubs write. The 16 cache-consistent captures are not
proof that Firecrawl served cache in each individual case, only that those bytes
cannot be claimed as a new observation. The 84 unmeasured captures are not evidence
of staleness either; they are evidence of absence of evidence, which is the point.


## APPENDIX: THE CARVE-OUT RETRACTION

The passthrough commit 1d9cc48 said: "Default stays undefined, so ordinary sweeps keep
the cheap cached path; a caller that needs a real observation passes maxAge 0."

RETRACTED. It reads as a design in which some callers legitimately harvest from cache.
No current caller qualifies. The retraction is carried in 053cad3, merged as 707f5a6,
because 1d9cc48 was already pushed and could not be amended. The same claim in the
code comment in lib/extract/firecrawl-fetch.js is corrected in that commit rather than
left standing.
