# CFB Metadata v2 — titles + descriptions + rivalry body content — Gate

**Generated:** 2026-07-16 · **Branch:** `feature/cfb-metadata-v2` (off `main`, local, NOT pushed) · **Spec:** Ahrefs-grounded re-optimization (Jul 12). **No push, no merge — stop-and-report gate.**

## Verdict

**PASS.** All 86 team titles now lead with **"Schedule"** (the head term with real volume), every rivalry description **names the rival school** and carries **"[Stadium] parking"**, and the team template renders **generated "rivalry" prose** that closes Google's "Missing: rivalry" gap. Verified two ways: (1) the real builders (`buildCfbTeamMetadata`/`buildCfbHubMetadata`/`buildRivalrySentences`) char-counted against live Firestore for all 86 + hub; (2) a full `next build` — the rendered HTML was grepped for the prose, titles, JSON-LD, and OG.

## What changed

| | Before (live) | After (v2) |
|---|---|---|
| Title (Ohio State) | `Ohio State Football 2026: The Game & Gameday` — **no "Schedule"** | `Ohio State Football Schedule 2026: The Game` — **Schedule + trophy** |
| Title (Penn State) | `Penn State Football 2026: Governor's Victory Bell` — no "Schedule" | `Penn State Football Schedule 2026: Rivalries` — Schedule (trophy → description) |
| Desc (Ohio State) | `…2026 schedule, The Game and rivalry games, plus tickets, parking and hotels…` — **rival not named** | `…2026 football schedule, The Game vs Michigan, plus tickets, Ohio Stadium parking and hotels…` — **names Michigan + stadium parking** |
| Body copy | word "rivalry" absent; section eyebrow "Rivalries" | **"Rivalry Games"** eyebrow + one generated sentence per tagged game, each using "rivalry" and naming the rival |
| `DESC_MAX` | 160 | **155** |
| Hub description | contained em dashes (`—`) | em-dash-free (colon + commas) |

**Files:** `src/lib/cfb/metadata.ts` (title/desc templates, rival resolution, `DESC_MAX`, hub), `src/lib/cfb/page-extras.ts` (`buildRivalrySentences`, pure/testable), `src/components/cfb/CfbSchoolPage.tsx` (renamed eyebrow + prose render).

## Limits — how the ceiling is measured

Unchanged from the launch pass: the root layout appends **` | PromoNight`** (13 chars) to every title, so the title **FIELD budget = 47** → rendered `<title>` **≤60**. Descriptions get no suffix → field = rendered value (**≤155**, tightened from 160).

- **Titles (rendered, incl. brand): 0 of 86 over 60 — max 60** (18 at exactly 60, all clean full candidates, none truncated).
- **Descriptions: 0 of 86 over 155 — max 155** (4 at exactly 155: Arizona, James Madison, Penn State, South Carolina).

## Compliance summary — the adversarial self-check

| # | Check | Result |
|---|---|---|
| — | Title rendered > 60 (hard) | **0 / 86** |
| 1 | Title missing "Schedule" (hard — the 10k term) | **0 / 86** → 86/86 carry "Schedule" |
| 2 | Title > 60 or description > 155 (hard) | **0 / 86** and **0 / 86** |
| 3 | Has-rivalry description does NOT name the rival | **0 / 80** → 80/80 name the rival |
| 3b | Description missing "[Stadium] parking" | **0 / 86** |
| 4 | Body prose missing the word "rivalry" (schools with rivalry games) | **0 / 80** |
| 5 | No-rivalry school over-claims "Rivalries" | **0 / 6** (Air Force, Northern Illinois, SMU, UCF, UNLV, USF → `& Gameday`, no prose) |
| 6 | Invented rivalry/trophy data | **none** — every ident is `cfbRivalries.name`/`.trophy`; dates from the schedule |
| — | Em dash in title / description / body prose | **0 / 0 / 0** |
| — | Raw slug in any rendered rival name (all 86 descriptions + prose) | **0** |
| — | OG image ≠ `/og-image.png` · twitter image · canonical `/cfb/{id}` | **0 / 0 / 0** |
| — | SportsTeam JSON-LD | intact + valid, undisturbed |

**Featured split (unchanged — selection priority not touched):** 26 marquee, 54 trophy, 6 none. **Trophy token kept in title: 41/80** rivalry schools; 39 drop the token (long names) to keep "Schedule" — the approved trade (trophy + rival survive in the description). **206 rivalry sentences** generated across the 80 rivalry schools.

## Rendered-HTML verification (full `next build`, exit 0)

Grepped the prerendered `.next/server/app/cfb/*.html`:

- **Actual prose sentences in body text** (6 spot-checks, across tiers):
  - `The Ohio State vs Illinois rivalry, known as Illibuck, is played on Saturday, September 26 at Ohio Stadium.`
  - `The Penn State vs Michigan rivalry is played on Saturday, October 17 at Michigan Stadium.`
  - `The Coastal Carolina vs Liberty rivalry is played on Thursday, September 24 at Brooks Stadium.`
  - `The Notre Dame vs Michigan State rivalry, known as Megaphone Trophy, is played on Saturday, September 19 at Notre Dame Stadium.`
  - `The Toledo vs Bowling Green rivalry, known as Battle of I-75 Trophy, is played on Friday, November 20 at Glass Bowl.` (slug-rival prettified)
- **UNLV (no rivalry):** no prose sentence, no "Rivalry Games" heading — correctly omitted.
- **All 86 rendered meta descriptions: 0 contain a raw slug.**
- **JSON-LD** (ohio-state): `{"@type":"SportsTeam","name":"Ohio State","sport":"American Football","location":{"@type":"StadiumOrArena","name":"Ohio Stadium","address":"Columbus, Ohio"}}` — intact.
- **OG:** every page `og:image` = `/og-image.png` (no blanked-OG regression).

### The 6 slug-resolution targets — all prettified (not raw slugs)

| School | Featured rival (rendered) |
|---|---|
| App State | Georgia Southern |
| Cincinnati | Miami Oh¹ |
| James Madison | Old Dominion |
| Toledo | Bowling Green |
| Tulane | Southern Miss |
| Washington | Washington State |

¹ `prettifySlug("miami-oh") → "Miami Oh"` — a pre-existing display nit (matches what the schedule/cards already render for Miami (OH)); out of this task's scope.

## Spot-check rendered strings

| School | Rendered `<title>` (len) | Desc len |
|---|---|---|
| Ohio State | `Ohio State Football Schedule 2026: The Game \| PromoNight` (56) | 132 |
| Alabama | `Alabama Football Schedule 2026: Iron Bowl \| PromoNight` (54) | 139 |
| Michigan | `Michigan Football Schedule 2026: The Game \| PromoNight` (54) | 138 |
| Penn State | `Penn State Football Schedule 2026: Rivalries \| PromoNight` (57) | 155 |
| Notre Dame | `Notre Dame Football Schedule 2026: Rivalries \| PromoNight` (57) | 138 |
| Toledo | `Toledo Football Schedule 2026: Rivalries \| PromoNight` (53) | 143 |
| Coastal Carolina | `Coastal Carolina Football Schedule 2026 \| PromoNight` (52) | 143 |
| Minnesota | `Minnesota Football Schedule 2026: the Axe \| PromoNight` (54) | 138 |
| UNLV (no rivalry) | `UNLV Football Schedule 2026 & Gameday \| PromoNight` (50) | 107 |
| Air Force (no rivalry) | `Air Force Football Schedule 2026 & Gameday \| PromoNight` (55) | 110 |
| **/cfb hub** | `College Football Rivalries & Gameday 2026 \| PromoNight` (54) | 150 |

## Hub (/cfb)

Kept rivalry-first (correct — "college football rivalries" 1,200/mo KD 0). Title 54 rendered ✓, description **150** ✓, **em-dash-free** (was `— … —`, now `: … ,`).

## Notes / out of scope

- **Pre-existing em dashes (2 per page), NOT introduced by v2 and NOT touched:** the site-wide OG-image `alt` (`PromoNight — Every giveaway, every team`, also in `layout.tsx`) and the Wikipedia-link `title=` hover tooltips (`cfb-bits.tsx`). My generated prose and all titles/descriptions are em-dash-free. Flagging for a possible follow-up; left alone to keep this task scoped.
- **Destination tier is dormant** (all 86 are `auto`). The `destination` description branch was re-verified on a synthetic worst case (≤155, names rival, keeps stadium parking) but has no live pages — re-verify at first graduation.
- **Prose dates** follow the same display policy as the visible schedule: the game date always shows (only the kickoff *time* is verify-gated), so a flagged date-error game would show its stored date in both places consistently.

## Per-school compliance (rendered title len / desc len / featured / trophy in title / #rivalry sentences)

| School | Title | Desc | Featured | Trophy in title | Sentences |
|---|---|---|---|---|---|
| Air Force | 55 | 110 | none | — | 0 |
| Alabama | 54 | 139 | marquee | yes | 5 |
| App State | 56 | 138 | trophy | no | 2 |
| Arizona | 60 | 155 | marquee | yes | 1 |
| Arizona State | 60 | 139 | marquee | no | 1 |
| Arkansas | 55 | 153 | trophy | no | 4 |
| Army | 56 | 129 | trophy | yes | 1 |
| Auburn | 53 | 137 | marquee | yes | 7 |
| Baylor | 53 | 131 | trophy | no | 3 |
| Boise State | 57 | 142 | trophy | yes | 1 |
| Boston College | 60 | 144 | trophy | no | 2 |
| BYU | 59 | 134 | marquee | yes | 1 |
| California | 55 | 150 | trophy | yes | 2 |
| Cincinnati | 60 | 139 | trophy | yes | 2 |
| Clemson | 58 | 146 | marquee | yes | 3 |
| Coastal Carolina | 52 | 143 | trophy | no | 1 |
| Colorado | 55 | 140 | trophy | no | 2 |
| Duke | 54 | 147 | trophy | yes | 4 |
| Florida | 59 | 144 | trophy | yes | 4 |
| Florida State | 60 | 139 | trophy | no | 4 |
| Fresno State | 58 | 150 | trophy | yes | 2 |
| Georgia | 53 | 153 | marquee | yes | 6 |
| Georgia Tech | 58 | 142 | marquee | yes | 5 |
| Houston | 54 | 146 | trophy | no | 2 |
| Illinois | 54 | 148 | trophy | yes | 4 |
| Indiana | 54 | 143 | marquee | no | 1 |
| Iowa | 59 | 139 | marquee | yes | 5 |
| Iowa State | 57 | 140 | trophy | no | 2 |
| James Madison | 60 | 155 | trophy | no | 2 |
| Kansas | 54 | 137 | marquee | yes | 2 |
| Kansas State | 59 | 141 | trophy | no | 3 |
| Kentucky | 60 | 138 | trophy | yes | 4 |
| Liberty | 54 | 152 | trophy | no | 2 |
| Louisville | 57 | 139 | trophy | no | 1 |
| LSU | 60 | 136 | trophy | no | 6 |
| Marshall | 55 | 142 | trophy | no | 1 |
| Maryland | 55 | 130 | trophy | no | 2 |
| Memphis | 54 | 139 | trophy | yes | 2 |
| Miami | 54 | 142 | trophy | yes | 2 |
| Michigan | 54 | 138 | marquee | yes | 4 |
| Michigan State | 60 | 153 | marquee | no | 2 |
| Minnesota | 54 | 138 | marquee | yes | 4 |
| Mississippi State | 53 | 149 | marquee | no | 4 |
| Missouri | 56 | 132 | marquee | yes | 3 |
| Navy | 59 | 141 | trophy | yes | 2 |
| NC State | 55 | 142 | trophy | no | 2 |
| Nebraska | 59 | 138 | trophy | yes | 1 |
| North Carolina | 60 | 138 | trophy | no | 3 |
| Northern Illinois | 53 | 118 | none | — | 0 |
| Northwestern | 59 | 150 | trophy | no | 1 |
| Notre Dame | 57 | 138 | trophy | no | 5 |
| Ohio State | 56 | 132 | marquee | yes | 2 |
| Oklahoma | 55 | 147 | marquee | yes | 2 |
| Oklahoma State | 60 | 141 | trophy | no | 1 |
| Ole Miss | 54 | 153 | marquee | yes | 4 |
| Oregon | 54 | 122 | trophy | yes | 2 |
| Penn State | 57 | 155 | trophy | no | 3 |
| Pittsburgh | 57 | 136 | trophy | no | 1 |
| Purdue | 60 | 147 | marquee | yes | 3 |
| Rutgers | 54 | 135 | trophy | no | 1 |
| San Diego State | 60 | 144 | trophy | yes | 1 |
| SMU | 49 | 113 | none | — | 0 |
| South Carolina | 60 | 155 | marquee | no | 2 |
| Stanford | 60 | 142 | trophy | yes | 2 |
| Syracuse | 55 | 135 | trophy | no | 2 |
| TCU | 58 | 146 | trophy | yes | 2 |
| Tennessee | 56 | 136 | marquee | no | 5 |
| Texas | 52 | 147 | marquee | yes | 3 |
| Texas A&M | 56 | 143 | trophy | no | 3 |
| Texas Tech | 57 | 136 | trophy | no | 3 |
| Toledo | 53 | 143 | trophy | no | 1 |
| Tulane | 52 | 137 | trophy | yes | 1 |
| UCF | 49 | 111 | none | — | 0 |
| UCLA | 54 | 120 | trophy | yes | 2 |
| UConn | 57 | 137 | trophy | yes | 1 |
| UNLV | 50 | 107 | none | — | 0 |
| USC | 53 | 141 | trophy | yes | 2 |
| USF | 49 | 109 | none | — | 0 |
| Utah | 60 | 128 | marquee | yes | 3 |
| Vanderbilt | 57 | 138 | trophy | no | 4 |
| Virginia | 55 | 151 | trophy | no | 4 |
| Virginia Tech | 60 | 141 | trophy | no | 4 |
| Wake Forest | 58 | 143 | trophy | no | 2 |
| Washington | 57 | 145 | marquee | yes | 2 |
| West Virginia | 60 | 149 | trophy | no | 1 |
| Wisconsin | 54 | 148 | marquee | yes | 2 |

---

**STOP — metadata + rivalry-content gate only. Branch `feature/cfb-metadata-v2`, local, no push, no merge.**
