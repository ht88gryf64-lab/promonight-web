# CFB Metadata Pass — titles + descriptions (86 team pages + /cfb hub) — Gate

**Generated:** 2026-07-08 · **Branch:** cfb-phase3 (local, NOT pushed) · **Preview:** deployed (protection ON). Spec: §12 (limits, tier-awareness, OG sanity) + §13 (rivalry keyword priority). **No push, no merge.**

## Verdict

**PASS.** Templated, TIER-DERIVED, rivalry/travel-angled metadata for all 86 team pages + the hub, within engine limits. `src/lib/cfb/metadata.ts` (`buildCfbTeamMetadata` + `buildCfbHubMetadata`), wired into both routes' `generateMetadata`/`metadata`. Verified against the built/served HTML.

## Limits — how the ceiling is measured (the key correction)

The root layout title template appends **` | PromoNight`** (13 chars) to every page title. The house standard keeps the **RENDERED** `<title>` (field + brand) ≤60 — pro pages measured at 44–58. So the CFB **title FIELD budget = 60 − 13 = 47**, giving a rendered `<title>` ≤60. Descriptions get no template suffix → the field is the rendered value (≤160).

- **Titles (rendered, incl. brand): 0 of 86 over 60 — max 60.**
- **Descriptions: 0 of 86 over 160 — max 160.**
- Compliance guaranteed by a candidate fallback chain (`firstFit`): richest template first, drop to shorter forms until one fits.

## Template logic

**Title** (field ≤47 → rendered ≤60): leads with the featured trophy (the wedge), NOT "Schedule" (budget-eating; the schedule head term is unwinnable, §13). Chain: `{School} Football 2026: {trophy} & Gameday` → `…: {trophy}` → `…: Rivalries & Gameday` → `…: Rivalries` → `… Schedule`. No-rivalry schools skip "Rivalries" entirely.

**Description** (≤160), TIER-DERIVED: AUTO promises only what the page has — schedule, the featured rivalry + rivalry games, tickets/parking/hotels, venue. DESTINATION (dormant; none exist) adds "gameday guide, tailgating." A school with **no** rivalry games drops all rivalry language.

**Rivalry selection (§13):** best MARQUEE match by traffic rank (The Game > Red River > Cocktail Party > Iron Bowl > Third Saturday > Egg Bowl > Apple Cup > Bedlam > Paul Bunyan's Axe > …), else the most recognizable trophy on the 2026 schedule. Collision-guarded: "Paul Bunyan's **Axe**" (Minnesota–Wisconsin) is regex-separated from the bare "Paul Bunyan **Trophy**" (MSU–Michigan) so they never mislabel each other (§5 trap).

## Compliance summary

- Featured: **26 marquee**, **54 trophy**, **6 none** (schools with no 2026 rivalry game).
- **80/86 titles feature a trophy**; 6 generic = exactly the no-rivalry schools.
- "the Axe" resolves to **only** Minnesota + Wisconsin (collision fix verified).
- OG image: **86/86 use `/og-image.png`** (1200×630) — no CFB page ships a blanked image (the /playoffs bug class). JSON-LD (SportsTeam/SportsEvent) intact, undisturbed.

## OG / structured-data sanity (§12)

Every CFB page (team + hub) sets `openGraph` **with** a valid `images: [/og-image.png]` array + a matching `twitter` card — so none inherits a blanked OG image. The SportsTeam/SportsEvent JSON-LD on team pages is unchanged by the metadata edit (present + valid).

## Hub (/cfb)

- Title (rendered 54): **"College Football Rivalries & Gameday 2026 | PromoNight"** — leads with the exact §13 winnable phrase "college football rivalries" (KD 10); avoids the unwinnable schedule head term.
- Description (152): "College football rivalries, trophy games and theme nights for 2026 — The Game, Iron Bowl, Red River — plus schedules and gameday plans for all 86 teams."
- OG image valid.

## 6-school + hub spot-check (served HTML)

| Page | Rendered `<title>` | len | Description len |
|---|---|---|---|
| minnesota (marquee) | Minnesota Football 2026: the Axe & Gameday \| PromoNight | 55 | 157 |
| ohio-state (marquee) | Ohio State Football 2026: The Game & Gameday \| PromoNight | 57 | 132 |
| ole-miss (marquee) | Ole Miss Football 2026: Egg Bowl & Gameday \| PromoNight | 55 | 144 |
| toledo (trophy) | Toledo Football 2026: Battle of I-75 Trophy \| PromoNight | 56 | 138 |
| michigan-state (multi-rivalry) | Michigan State Football 2026: Paul Bunyan \| PromoNight | 54 | ≤160 |
| unlv (no rivalry) | UNLV Football 2026: Schedule & Gameday \| PromoNight | 51 | 90 |
| /cfb hub | College Football Rivalries & Gameday 2026 \| PromoNight | 54 | 152 |

All og:image = `https://www.getpromonight.com/og-image.png`.

## Per-school compliance table (rendered title len / desc len / featured rivalry / source)

| School | Title len | Desc len | Featured rivalry | Source |
|---|---|---|---|---|
| Air Force | 56 | 104 | — | none |
| Alabama | 55 | 122 | the Iron Bowl | marquee |
| App State | 54 | 150 | Deeper than Hate | trophy |
| Arizona | 51 | 150 | the Territorial Cup | marquee |
| Arizona State | 57 | 160 | the Territorial Cup | marquee |
| Arkansas | 56 | 132 | Southwest Classic Trophy | trophy |
| Army | 57 | 139 | Army–Navy Game | trophy |
| Auburn | 54 | 138 | the Iron Bowl | marquee |
| Baylor | 52 | 136 | Bluebonnet Shield | trophy |
| Boise State | 58 | 138 | Milk Can | trophy |
| Boston College | 57 | 142 | Ireland Trophy | trophy |
| BYU | 50 | 138 | the Holy War | marquee |
| California | 56 | 150 | The Axe | trophy |
| Cincinnati | 51 | 139 | Victory Bell | trophy |
| Clemson | 59 | 140 | the Palmetto Bowl | marquee |
| Coastal Carolina | 54 | 160 | Coastal Carolina–Liberty | trophy |
| Colorado | 58 | 144 | Rumble in the Rockies | trophy |
| Duke | 55 | 141 | Victory Bell | trophy |
| Florida | 60 | 145 | Okefenokee Oar | trophy |
| Florida State | 51 | 159 | Jefferson–Eppes Trophy | trophy |
| Fresno State | 59 | 147 | Milk Can | trophy |
| Georgia | 54 | 149 | Clean, Old-Fashioned Hate | marquee |
| Georgia Tech | 59 | 141 | Clean, Old-Fashioned Hate | marquee |
| Houston | 54 | 154 | Houston–Texas Tech | trophy |
| Illinois | 55 | 146 | Illibuck | trophy |
| Indiana | 52 | 145 | the Old Oaken Bucket | marquee |
| Iowa | 60 | 138 | Floyd of Rosedale | marquee |
| Iowa State | 53 | 144 | Cy-Hawk Trophy | trophy |
| James Madison | 51 | 151 | Royal Rivalry Trophy | trophy |
| Kansas | 55 | 157 | the Border War | marquee |
| Kansas State | 55 | 124 | Governor's Cup | trophy |
| Kentucky | 51 | 136 | Governor's Cup | trophy |
| Liberty | 60 | 147 | Battle of the Blue Ridge | trophy |
| Louisville | 53 | 159 | Governor's Cup | trophy |
| LSU | 52 | 136 | Magnolia Bowl Trophy | trophy |
| Marshall | 58 | 134 | The Old Mountain Feud | trophy |
| Maryland | 53 | 139 | Maryland–Rutgers | trophy |
| Memphis | 55 | 144 | The Bones | trophy |
| Miami | 55 | 137 | Florida Cup | trophy |
| Michigan | 55 | 136 | The Game | marquee |
| Michigan State | 54 | 153 | the Paul Bunyan Trophy | marquee |
| Minnesota | 55 | 157 | Paul Bunyan's Axe | marquee |
| Mississippi State | 54 | 149 | the Egg Bowl | marquee |
| Missouri | 57 | 134 | the Border War | marquee |
| Navy | 60 | 159 | Rip Miller Trophy | trophy |
| NC State | 57 | 151 | NC State–Wake Forest | trophy |
| Nebraska | 60 | 142 | Heroes Trophy | trophy |
| North Carolina | 55 | 142 | Victory Bell | trophy |
| Northern Illinois | 53 | 112 | — | none |
| Northwestern | 60 | 150 | Land of Lincoln Trophy | trophy |
| Notre Dame | 55 | 152 | Megaphone Trophy | trophy |
| Ohio State | 57 | 132 | The Game | marquee |
| Oklahoma | 56 | 126 | the Red River Rivalry | marquee |
| Oklahoma State | 52 | 156 | Oklahoma State–Tulsa | trophy |
| Ole Miss | 55 | 144 | the Egg Bowl | marquee |
| Oregon | 55 | 129 | Oregon–USC | trophy |
| Penn State | 58 | 154 | Governor's Victory Bell | trophy |
| Pittsburgh | 58 | 147 | Pittsburgh–Syracuse | trophy |
| Purdue | 51 | 148 | the Old Oaken Bucket | marquee |
| Rutgers | 52 | 143 | Maryland–Rutgers | trophy |
| San Diego State | 51 | 140 | Oil Can | trophy |
| SMU | 50 | 107 | — | none |
| South Carolina | 56 | 156 | the Palmetto Bowl | marquee |
| USF | 50 | 103 | — | none |
| Stanford | 51 | 140 | Legends Trophy | trophy |
| Syracuse | 56 | 144 | Pittsburgh–Syracuse | trophy |
| TCU | 59 | 148 | Bluebonnet Shield | trophy |
| Tennessee | 52 | 157 | the Third Saturday in October | marquee |
| Texas | 53 | 125 | the Red River Rivalry | marquee |
| Texas A&M | 57 | 143 | Southwest Classic Trophy | trophy |
| Texas Tech | 52 | 141 | Saddle Trophy | trophy |
| Toledo | 56 | 138 | Battle of I-75 Trophy | trophy |
| Tulane | 53 | 132 | The Bell | trophy |
| UCF | 50 | 105 | — | none |
| UCLA | 55 | 125 | Victory Bell | trophy |
| UConn | 58 | 116 | Syracuse–UConn | trophy |
| UNLV | 51 | 101 | — | none |
| USC | 54 | 145 | Victory Bell | trophy |
| Utah | 51 | 133 | the Holy War | marquee |
| Vanderbilt | 57 | 149 | Georgia–Vanderbilt | trophy |
| Virginia | 59 | 146 | Jefferson–Eppes Trophy | trophy |
| Virginia Tech | 58 | 141 | Commonwealth Cup | trophy |
| Wake Forest | 60 | 134 | NC State–Wake Forest | trophy |
| Washington | 58 | 137 | the Apple Cup | marquee |
| West Virginia | 51 | 139 | Cincinnati–West Virginia | trophy |
| Wisconsin | 55 | 147 | Paul Bunyan's Axe | marquee |
## Adversarial self-check

1. **Any title >60 or description >160?** No — measured on the RENDERED `<title>` (field + ` | PromoNight`): 0/86 over 60 (max 60); descriptions 0/86 over 160 (max 160). The field budget is 47 precisely to leave room for the brand template.
2. **Any AUTO page promising editorial/gameday it doesn't have?** No — auto descriptions promise only schedule, rivalry games, venue, tickets/parking/hotels (all present). "Gameday" in titles = the gameday-planning cluster the page carries (per the §12 example). Editorial claims (gameday guide, tailgating) are gated to the destination branch (dormant).
3. **Any generic "[School] 2026 Schedule" that wastes the wedge?** No — 80/86 feature the trophy in the title; the 6 generics are exactly the schools with no 2026 rivalry game (a trophy claim there would be false). Long-trophy schools whose title can't fit the trophy still carry it in the description.
4. **Any CFB page with a blanked/missing OG image?** No — 86/86 team pages + the hub set `openGraph.images: [/og-image.png]` explicitly (+ twitter). None inherits a blank.
5. **Tier-DERIVED or hand-set?** Tier-derived — the description template branches on `data.editorialStatus`; a school graduating to `destination` auto-upgrades its description (gameday guide + tailgating) with no manual edit, same data-flip principle as the page template.
6. **Hub on rivalry terms or the unwinnable schedule head?** Rivalry — title + description both lead with "college football rivalries" (§13 KD 10) and name The Game / Iron Bowl / Red River; the schedule head term is deliberately not the lead.

## Preview

`https://promonight-nh3y9b1ym-btj8tk69dk-7318s-projects.vercel.app/cfb` (+ `/cfb/{school}`) — Deployment Protection ON. Verified via built/served HTML (byte-identical).

---

**STOP — metadata gate only. Preview deployed, no push, no merge.**
