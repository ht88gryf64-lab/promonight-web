# CFB Kickoff-Time Bug — Diagnosis (READ-ONLY, no fix)

**Generated:** 2026-07-07 · **Branch:** cfb-phase3 (display code) · Firestore data shared. **Nothing was written, fixed, or changed.**

## Verdict up front

**DISPLAY bug, not storage.** The stored kickoff values are correct and Wikipedia-confirmed; the render function `to12h` in `src/lib/cfb/data.ts` silently drops the AM/PM meridiem from the stored 12-hour time string and re-derives AM/PM from the hour number — turning every stored PM time (1–11 PM) into AM. **The 86-school pipeline data is fine; only the render + a display-side guard need fixing. No re-run needed.**

## STEP 1 — Raw stored values (literal `JSON.stringify`, not formatted)

| Game | docId | `kickoff` (raw) | broadcast | verified |
|---|---|---|---|---|
| minnesota / eastern-illinois | `2026-2026-09-03-minnesota-eastern-illinois` | `{"time":"7:00 PM","tz":"CT","tbd":false,"windowFlex":null}` | Peacock, confirmed | **true** |
| minnesota / mississippi-state | `2026-2026-09-12-minnesota-mississippi-state` | `{"time":"2:30 PM","tz":"CT","tbd":false,"windowFlex":null}` | CBS, confirmed | **true** |
| alabama / kentucky (KY home) | `2026-2026-09-12-kentucky-alabama` | `{"time":"3:30 PM","tz":"ET","tbd":false,"windowFlex":null}` | ABC, confirmed | **true** |

**Storage format:** `kickoff.time` is a **12-hour clock string WITH a meridiem** ("7:00 PM"), NOT a 24-hour value, NOT a UTC instant, NOT an ISO offset. `kickoff.tz` is a short abbreviation ("CT"/"ET"). The parser stored the official page's displayed time verbatim (12-hour). Every stored value is a sensible PM kickoff. `verification.flags` on all three: `kickoff "<value>" independently confirmed on en.wikipedia.org`, domains `[official, en.wikipedia.org]` — a genuine 2-source match on the CORRECT value.

## STEP 2 — Ground truth (fresh Wikipedia fetch, independent of the stored data)

Re-fetched the schools' 2026 Wikipedia season pages live (not read from cfbGames):
- Minnesota vs Eastern Illinois (Sep 3): **7:00 p.m.** — matches stored `7:00 PM` ✓
- Minnesota vs Mississippi State (Sep 12): **2:30 p.m.** — matches stored `2:30 PM` ✓
- Kentucky vs Alabama (Sep 12): **3:30 p.m.** — matches stored `3:30 PM` ✓

The real, announced kickoffs are all PM and identical to the stored values. There is no wrong data in Firestore.

## STEP 3 — The bug, with the offset math

`src/lib/cfb/data.ts`, the stored-value formatter:

```ts
function to12h(time: string, tz: string): string | null {
  const m = time.match(/^(\d{1,2}):(\d{2})/);   // "7:00 PM" → captures ["7","00"] and DROPS " PM"
  if (!m) return null;
  let h = parseInt(m[1], 10);                    // h = 7
  const min = m[2];                              // "00"
  const ap = h >= 12 ? 'PM' : 'AM';              // 7 >= 12 → false → 'AM'   ← THE BUG
  if (h === 0) h = 12; else if (h > 12) h -= 12; // h stays 7
  const abbr = TZ_ABBR[tz] || tz;                // "CT"
  return `${h}:${min} ${ap} ${abbr}`;            // "7:00 AM CT"  ← WRONG
}
```

The regex matches only the `H:MM` prefix and **ignores the ` PM`/` AM` already in the string**. It then re-derives AM/PM from the hour number as if the input were 24-hour. Trace:

- `"7:00 PM"` → h=7 → `7 >= 12` false → **AM** → **"7:00 AM CT"** (should be 7:00 PM)
- `"2:30 PM"` → h=2 → AM → **"2:30 AM CT"**
- `"3:30 PM"` → h=3 → AM → **"3:30 AM ET"**

**This is not a timezone offset error and not a double offset.** The hour digits are preserved; only the meridiem is wrong. It is a fixed **PM→AM mislabel (a 12-hour swing)** for any afternoon/evening time stored in `H:MM PM` form. That is exactly the "impossible early-AM" pattern reported (7 PM→7 AM, 2:30 PM→2:30 AM, 3:30 PM→3:30 AM). (Stored AM times like "11:00 AM" coincidentally survive because h=11→AM; noon "12:00 PM" survives because h=12→PM. So only PM 1–11 corrupts.)

Where the hours get mangled: **format only.** parse = fine (digits kept), store = fine ("7:00 PM" is correct), convert = N/A (no conversion happens), **format = broken** (meridiem dropped, re-derived wrong).

## STEP 4 — Why the verify stage did not catch it

The timezone guard (`guardTimezone` in `scripts/cfb/lib/guards.ts`, and the fact-match in `corroborate.ts`) lives entirely in the **storage/verify stage**. It reduces the stored kickoff and Wikipedia's kickoff to an absolute UTC instant and diffs them. For these games the stored `7:00 PM CT` matched Wikipedia's `7:00 PM` → **verified — correctly**, because the stored value IS right.

The display bug is in a **different layer** — `src/lib/cfb/data.ts`'s `to12h`, run at page-render time — which the verify stage never touches. So:

**The guard is verify-stage-only. A display-layer bug bypasses it entirely.** The guard did not "miss" a bad value; it verified a good value, and the corruption is introduced downstream at render, where no guard exists. This is the opposite of the Phase-1 Boise case (there the STORED value was +2h wrong and the guard flagged it; here the stored value is right and the render breaks it).

## STEP 5 — Recommendation (NOT implemented)

**Fix the DISPLAY layer only:**
- In `to12h`, **honor the meridiem** present in the stored string: read ` AM`/` PM` from `time` and use it, instead of re-deriving AM/PM from the hour. (Equivalently: reuse the pipeline's existing `normTime`/`toUtcMinutes` logic in `guards.ts`, which already parses meridiem correctly, rather than a second ad-hoc parser.) Handle both input shapes — 12-hour-with-meridiem ("7:00 PM", the current stored form) and bare 24-hour ("19:00"), since the parser could emit either.
- **No 86-school pipeline re-run is needed.** The stored data is correct and 2-source-verified; only the render function is wrong. This is confirmed by the round-trip proof below.

**Sanity guard — add it at the DISPLAY layer (that is where the bug is):**
- A "no CFB game kicks off 1:00–6:00 AM local" check belongs at **render**, because it would have caught "7:00 AM"/"2:30 AM" as impossible and fallen back to "Kickoff TBA" (or logged). Placing it only at storage-verify would NOT have helped — the stored value is 7:00 PM and passes any AM check.
- Optional defense-in-depth: the same range check could also sit at storage-verify to catch a future *storage-side* AM corruption, but it is not required for this bug.

## Adversarial self-check

1. **Raw stored value, or a formatted read?** Raw — `JSON.stringify(g.kickoff)` returned `{"time":"7:00 PM",...}` (literal bytes). A formatted read would have shown "7:00 AM" and hidden the truth; the raw read exposed the correct "7:00 PM".
2. **Ground truth from the source, not the stored data?** Yes — a fresh live fetch of the schools' 2026 Wikipedia pages (independent re-fetch), returning 7:00 p.m. / 2:30 p.m. / 3:30 p.m. — not read from cfbGames.
3. **Prove "display bug, storage fine" via round-trip.** Stored `"7:00 PM"` + tz `CT`. Converting **correctly** (honor the meridiem): 7:00 PM CT → displays "7:00 PM CT" = the real announced kickoff (Wikipedia + official agree). The *only* transformation that produces "7:00 AM" is `to12h` discarding the ` PM`. Therefore the stored value round-trips to the correct kickoff under proper conversion — storage is correct, the render is the sole defect.

---

**STOP — diagnosis only. No fix, no writes, no page change, no push.** Fix is a separate go.
