# Weekly digest redesign spec

Decided 2026-11-05. Direction: schedule layout with a conditional hero. One template renders all three variants (personalized, generic, empty-window). This file is the build reference; `digest-final-mockup.html` beside it is the visual reference and is NOT production markup (it uses flex and web fonts; production is table-based with a system font stack).

## Principles

- Reads like a schedule from a fan, not a storefront.
- No direct partner links in the email. The promo page owns all affiliate routing. Rows carry no buttons.
- Every promo links to its per-promo page through `promoPageHref`. Never build a path by hand.
- No superlatives anywhere in the copy (no "cheapest", "lowest", "best deal"). Partner terms forbid them near their links and the rule is simpler applied everywhere.

## Container

- 600px centered inside the existing full-width wrapper pattern.
- Table-based HTML, inline styles only, no web fonts.
- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- Colors: ink `#141413`, muted `#6B6861`, body `#3D3B37`, rule `#E6E3DC`, panel `#F3F2EE`, white `#FFFFFF`. Accent is one constant: `#1D4ED8`.
- Dark mode: explicit `bgcolor` and `color` on every cell that carries text.
- Buttons are padded table cells wrapping an anchor. Minimum tap height 44px.
- Total HTML under 102KB so Gmail does not clip. Plain-text part generated from the same data.

## Sections, top to bottom

### 1. Header
Left: `PROMONIGHT` wordmark, 18px bold, letter-spacing 0.08em. Right: `Manage teams` link, 12px muted. Padding 26px 32px 0.

### 2. Title block
- Personalized: `This week for your teams`
- Generic: `Hot promos this week`
- Empty-window: existing named line (`Nothing on the calendar for the X this week`)
H1 34px bold, line-height 1.05. Subline 15px muted: window dates and team names.

### 3. Hero (conditional)
Render when EITHER: the window contains exactly one promo for the subscriber's teams, OR any promo in the window has a tier 1 photo. If several promos have tier 1 photos, pick the earliest date. The hero promo is removed from the rows below.

Card: 1px rule border, radius 12px, overflow hidden.
- Image 552x290, the promo card from the same endpoint og:image uses, generated card as fallback. Alt text = promo title + team + date.
- Over the image the generated card already carries team name, type badge, title and date. Do not overlay text on tier 1 photos; put the title block below instead.
- Below image, one row: `See this game` button (accent fill, white text, 15px semibold, 13px 22px padding, radius 8px) left, linking to the promo page; `Parking` and `Remind me` as 13px muted underlined links right, linking to the promo page (anchors if they exist, else the page).
- NO ticket CTA and NO direct partner link anywhere in the email. Decided 2026-11-05: TicketNetwork's program terms require prior written approval for email marketing, which is pending. The promo page carries the ticket link. Zero `lusg.net`, `evyy.net`, `spothero.com`, `expedia.com` URLs in the output.
- When approval lands, the hero button becomes `Get tickets` with the direct Impact link, gated by env `TICKETNETWORK_EMAIL_APPROVED=true`. Build the gate now, default off, so the switch is an env var and not a deploy.

### 4. Rows, grouped by date
One 1px ink rule above the first row. Each row is one promo, 22px vertical padding, 1px `#E6E3DC` rule below. Whole row is one anchor to the promo page.
- Left rail 54px: weekday label 11px semibold muted letter-spaced, over day number 36px bold.
- Middle: team + type label 11px semibold uppercase accent (`Panthers · Theme night`), promo title 19px semibold, game line 13px muted (`vs Hornets · 7:30 PM · Kaseya Center` plus quantity when known, e.g. `First 5,000 fans`).
- Right: 96x60 thumbnail of the promo card, radius 6px.
- No buttons on rows.

### 5. Coming up
Panel `#F3F2EE`, radius 10px. Label 11px uppercase muted. Next two promos for the subscriber's teams beyond the window: `Nov 12 · Military Appreciation Night` left, team name right muted, 14px. Each links to its promo page. Omit the section if none.

### 6. Same promo at other clubs
Only when a hero rendered and its themeKey cascade returns at least two siblings. Label 11px uppercase muted (`Star Wars at other clubs`). Up to three rows: team name left, date right. Omit otherwise.

### 7. App band
1px rule above. Copy 14px body: `Want a reminder the day before each game instead of once a week?` Right: `Get the app` as an outlined button (1px `#D6D3CC`, radius 6px), linking to /download with the existing src param.

### 8. Footer
Unchanged content: Manage teams, Unsubscribe, affiliate disclosure, CAN-SPAM address. 12px muted.

## Empty-window variant
Same renderer over the existing team-proxy / national-fallback content. Title block uses the named-team empty line. Footer keeps the personalized manage link. Two additions:

- A muted lead-in line (13px, `#6B6861`) directly above the first row, matching the cascade level: `Nearby this week` for team-proxy, `Around the league this week` for national-fallback. This tells the reader the rows are not their teams, so a "Heat · Giveaway" row under a Panthers subline reads as intended rather than as a mistake.
- Hero fires on team-proxy content only. Never on national-fallback. A subscriber whose team is dark should not get a big hero card for a club across the country.

"Coming up" still shows the subscriber's OWN teams' next two promos beyond the window. That section is what keeps this email personal.

## Generic variant
Title "Hot promos this week". Same rows over the national hot-promos set. Hero rule as in section 3. No "Coming up" section, since there are no followed teams. Footer uses the existing generic star-your-teams CTA.

## Analytics
Email subId surfaces unchanged: `web_email_personalized`, `web_email_generic`, `web_email_empty`. Promo links carry the surface exactly as today.

## Tests
- Snapshot of all three variants with and without a hero.
- Every promo link passes through `promoPageHref`.
- Zero partner-domain links in the output for all variants (lusg.net, evyy.net, spothero.com, expedia.com) when `TICKETNETWORK_EMAIL_APPROVED` is unset; exactly one `lusg.net` link, on the hero only, when it is true and a hero renders.
- HTML under 102KB with 12 promos.
- Plain-text part lists every promo.

## Do not change
Window logic, dedupe, digestRuns idempotency, the send ceiling and alerting from 7aa7b97, unsubscribe handling, List-Unsubscribe-Post headers, cron schedule, subject line logic.

## Open decision
Whether the hero should also fire on a score-based pick when several promos qualify. Deferred until the first test sends are reviewed. Current rule is deterministic on purpose.
