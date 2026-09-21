# Where the editorial soul actually sits, and why

**Date:** 2026-09-21. Report only, nothing built. Measured in a real browser on
production with ads loaded.

## The finding: the block is not misplaced. A sibling is 44,183px tall.

`editorial.whyYouGo` is **already the first prose block below the hero** in DOM
order. `CfbSchoolPage.tsx:204` puts the signature-game / why-you-go grid
directly after the hero and **before** "Plan your gameday" (:248), the gameday
logistics, the schedule, the rivalry rail and the venue block. Measured
landmarks on `/cfb/penn-state` confirm the order is exactly right:

| block | top (px) |
|---|---|
| **Why you go** | **44,437** |
| Plan your gameday | 44,649 |
| Gameday at Beaver Stadium | 44,996 |
| 2026 Schedule | 45,881 |
| Rivalry Games | 47,193 |
| Beaver Stadium (venue, in their words) | 47,464 |
| Know this place? (contributor CTA) | 47,647 |

Everything is in the intended sequence. **Moving the block in the template
would change nothing**, because the 44,437 is not accumulated from content
above it. It is one element.

## The one element

```
<aside class="rounded-2xl p-6 lg:mb-1">   top: 153   height: 44,183px
```

That is the "About the venue" panel in the hero — the card showing Beaver
Stadium, University Park, capacity 106,304. Its real content is ~140px. Inside
it:

```
 24 × div.rp-sticky-sidebar @ 1,800px each  =  43,200px
 26 adthrive divs, 2 iframes, 29 direct children
```

**Raptive injects 24 sticky-sidebar ad slots into that aside and they stack
instead of sticking.** 43,200px of the 44,183px aside, and **88% of the whole
48,951px page**.

## It is pre-existing, and it is site-wide

| page | page height | sticky slots | stacked px | tallest aside |
|---|---|---|---|---|
| `/cfb/penn-state` (has editorial) | 48,951 | 24 | 43,200 | 44,183 |
| `/cfb/tennessee` (no editorial) | 48,231 | 24 | 43,200 | 44,183 |
| `/mlb/minnesota-twins` (pro team page) | 46,124 | 24 | 43,200 | 44,905 |

A school with **no editorial at all** measures the same aside. The two
contributed sections account for the 690px difference between Penn State and
Tennessee and nothing else. This is not a CFB problem and not an editorial
problem: **every team page on the site**, 169 pro + 87 CFB, is roughly 60
viewports tall because of one ad container.

## So what would it take?

**Nothing, in the template.** The answer to "what would it take to render it as
the first prose block below the hero" is: it already is, and the work is
somewhere else entirely.

Ranked:

1. **Fix the sticky-sidebar stack.** This is the whole of it. 43,200px removed
   puts "Why you go" at roughly **1,200px** — the first screen or the second —
   and every other section of every team page on the site moves up by the same
   amount. Nothing else on this list matters until this is done. It belongs
   with the existing content-viewability work, and it likely explains the
   desktop 0.18 viewability directly: an eager unit 4–6 viewports down is what
   you get when a sidebar consumes 54 viewports.
2. **Only then, consider order.** If, after the fix, the argument is that
   `whyYouGo` should precede the signature-game panel rather than share its
   grid row, that is a one-line change to the `lg:grid-cols-[1.6fr_1fr]` block
   at :205. Not worth deciding against the current measurements.
3. **`venueInTheirWords` beside the venue block: already true.** It renders at
   47,464, immediately under the Rivalry rail and directly above the
   contributor CTA, inside a `<section>` whose Eyebrow is the venue name. It is
   beside the venue *editorial* block because it *is* that block. What it is
   not beside is the venue **facts** panel — the hero aside — which is the
   44,183px element. Putting prose inside that aside today would bury it in the
   ad stack, so this should not be attempted before (1).

## Caveat on the measurement

Taken in one logged-in Chrome session at 1400×851 with ads served. Ad fill
varies by session, viewport and geography, so 24 slots is one observation, not
a constant. The DOM-order finding does not depend on it; the 43,200px does.
