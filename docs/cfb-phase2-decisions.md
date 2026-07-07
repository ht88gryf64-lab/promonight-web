# CFB Phase 2 — Decision Record (pre-build)

**Created:** 2026-06-29 · **Status:** decisions captured, Phase 2 prompt to be drafted against this
**Carries:** the source-map findings + the editorial/indexing decisions made after the sweep
**Reads alongside:** cfb-stream-build-spec.md (locked spec), docs/cfb-source-map.md (the 86-school sweep), cfb-editorial-template.md (the fill-in brief)

---

## 1. What the source map settled

- **Source-independence is solved.** 82 of 86 schools get >=2 independent render-confirmed 2026 schedule sources under Firecrawl (official + Wikipedia). All 86 official athletics sites render. The Phase-1 corroboration residue (Kansas State crawler-blocked to plain fetch) collapses.
- **The 4 stranded G5 schools** (JMU, Marshall, Toledo, NIU) are publish-timing strands, NOT coverage holes: Wikipedia 2026 page not yet created + SR 2026 unpublished. Each already has a fully-rendering official schedule. DEFER, re-probe closer to season. Not a fix.
- **Sports-Reference is 0/86 for 2026** (publish gap, not a block; 2025 renders 86/86). SR is a corroborator that ACTIVATES when it publishes later in summer, not one to rely on now. Current second source = Wikipedia.

---

## 2. The three tiers (locked, do not blur)

1. **Destination pages** — the 25 editorial schools. Full human-written editorial (the template), alum/fan-verified, flips `editorialStatus: destination`. Pushed for indexing + citations. This is the wedge.
2. **Auto pages** — the other ~61. Verified hard data only (schedule, venue, colors, confirmed rivalry facts). NO editorial soul. Stays `auto` until graduated.
3. **The trap to avoid:** do NOT generate AI/research-drafted editorial for the 61. Machine-written "why you go" prose is the commodity content the wedge beats, carries confident-wrong risk (the Minnesota Iowa-vs-Wisconsin waffle x61 with no fan to catch it), and dilutes the "by people who actually go" claim. Soft layer is human-only, full stop.

**Draft-as-scaffold is allowed ONLY for the 25**, as a starting point an alum corrects, never as the shipped product. A real fan makes it true before any destination flip. (The "PromoNight draft" Minnesota pass is a scaffold, not a ship artifact.)

---

## 3. Contributor CTA — the 61 recruit their own editors

The auto pages carry an "is this your school?" contribute hook that turns each thin page into a recruiting surface for the one person who can fill it: a fan of that school, caught at the moment they notice the soul is missing.

- **Framing:** invite depth, don't apologize for thinness. "Know this place? Help us tell the story of a [School] Saturday." NOT "this page is incomplete."
- **Routes to a structured form**, not a raw mailto or personal inbox. The form IS the editorial template fields. Captures name + contact (email or LinkedIn) for credit + follow-up.
- **Everything inbound is a DRAFT, never auto-published.** Same human-confirm gate as the 25: review, fact-check rivalry + transit claims, confirm original (not lifted), then go live. Open door = spam / false claims / copyright risk if not gated.
- **Credit the contributor visibly:** "Gameday section by [name], [School] 'YY." Rewards the writer, adds reader credibility, feeds the AI-citation authority signal (named human author).
- **Effect:** converts the 61 from a backlog Matt owes into a self-expanding pipeline. Any auto page graduates to destination when a fan submission clears review.

---

## 4. Indexing decision (resolved by the CTA)

- **Index the auto pages** as honest verified stubs WITH the contributor CTA. Rationale: a noindexed page can't recruit anyone. A stub with verified schedule + venue + real rivalry facts + a contribute hook is a legitimate stub with a purpose, not a doorway-page shell.
- **Quality floor required:** an auto page only indexes if it carries enough verified hard data to be genuinely useful without editorial. Below the floor, hold noindex.
- **Watch:** if graduation rates stay low and many stubs sit un-graduated for months, re-evaluate the thin-content SEO exposure.

---

## 5. Map-surfaced fields that are VERIFY-GATED, not trusted

The sweep's mis-resolutions are the anti-hallucination spec showing up in the map. Treat as pipeline-PROPOSED, human-CONFIRMED before destination flip (draft-as-scaffold model):

- **Venue resolution** — ~13 mis-resolved (picked Arrowhead for Kansas State). Fix: resolve from the infobox stadium hyperlink, not text-frequency guess. A wrong stadium books a hotel in the wrong city. Verify-gate it.
- **Rivalry pairings** — stale/secondary pulls (Texas Tech->Texas, dormant since Texas left for SEC; Cincinnati->Louisville instead of the Victory Bell). Wikipedia is a CANDIDATE GENERATOR (assembles the menu reliably) but cannot make the live-in-2026 + which-one-leads call (realignment timing + multi-rivalry ranking are fan judgments). Pipeline proposes candidates, human confirms.
- **Signature-game call** — one human line per editorial school on which game leads the page. LOCKED so far: **Minnesota -> Paul Bunyan's Axe (vs Wisconsin).**

---

## 6. The four decisions — RESOLVED 2026-06-29

1. **Fold the source-independence fix into the front of Phase 2** (not re-gate Phase 1 a 4th time). RESOLVED: FOLD IN. The map already proved Firecrawl solves it (82/86, zero deterministic-vs-agent disagreements); a 4th 4-school re-gate tests less than building the fix and watching the no-2nd-source bucket collapse across all 86. Phase 2's own per-school gate is the safety net.

2. **Corroboration floor — REASON-AWARE, not a flat percentage.** RESOLVED: a school flags for human review only when its non-verified games fail for a reason OTHER than honest-unannounced-TBD. Honest TBDs (kickoff genuinely not published in June) do NOT count against a school. A school can be 30% verified and healthy if the rest is just unannounced kickoffs. Backstop rule: flag any school with (a) >=1 non-TBD/non-conflict failure, OR (b) any no-2nd-source count >0 after the Firecrawl fix. A flat percentage floor is the WRONG tool here, it trips on June TBD noise everywhere and buries the real problems.

3. **Rivalry + venue on DESTINATION pages: pipeline-proposed, human-confirmed.** RESOLVED: proposed-then-confirmed. Map gets most right; human fixes the ~15% wrong, faster than blank. The Axe set the precedent. Applies ONLY to destination pages, auto pages tag all corroborated rivalries / crown none (section 8) and display venue as verified-or-flagged; the human-confirm exists only where editorial lands.

4. **Weekly rail rollover cutover.** RESOLVED: overnight CT-anchored, ~3-4am CT Monday (after late West-Coast Sunday, before East-Coast Monday AM). REUSE the existing home-page hot-promos rollover + ISR safety window, do not build a new one.

---

## 7. Operational carry-forward

- **Batch schools per agent on large fan-outs.** The map's 86-agent verification tripped the session limit at ~58 schools and needed a follow-up to finish. Phase 2 is a bigger run, bake batching in so the build doesn't stall halfway.
- **SR corroborator activates on publish**, don't architect around it being available now.
- **Verify stage runs on every write** (unchanged from the spec). No CFB data live before we love it.

---

## 8. Rivalry highlighting on auto pages (resolved)

Auto pages (the ~61 without editorial) DO highlight rivalry games, as verified hard data, not soft editorial. Tagging that a game is a rivalry is a fact; narrating what the rivalry means stays human-only.

**The rule:**
- Tag a 2026 game as a rivalry game when the SCHEDULE shows the matchup AND Wikipedia corroborates it as a named rivalry (with or without a trophy). Two-source corroboration, same gate as the rest of the pipeline.
- Show the trophy name as a FACT/tag (e.g. "Paul Bunyan's Axe"), no "what it means" prose.
- **No active-series filter.** A dormant-but-scheduled rivalry counts. If Texas and Texas Tech play in 2026, the schedule presence is the proof it's live this season, tag it. The rivalry being non-annual is irrelevant once the game is on the calendar. ("Is this a rivalry" does not expire; "is it on the 2026 schedule" is what the schedule check answers.)
- **Highlight ALL corroborated rivalry games equally. Crown nothing.** Auto pages have no human, so they must NOT imply which rivalry matters most to a fanbase they have no fan for. No signature, no ordering-by-importance, no "the big one." All rivalry tags weighted the same.

**The one human-gated piece:** the SIGNATURE designation (which rivalry leads the page) only appears once a human makes the call, which means it only ever appears on a DESTINATION page. **Auto pages tag; destination pages rank.** The auto page literally cannot tell a fan something a non-fan decided.

**Bonus:** a corroborated rivalry game with a trophy name is citable structured data (rich results + AI citation), so this gives auto stubs citable content even pre-editorial, strengthening the index-with-CTA case in section 4.

**Resolution note:** corrects an earlier over-strict "stale pairing" filter. The Cincinnati->Louisville map error was a multi-rivalry mis-pick (grabbed a secondary over the Keg of Nails), not a dormant-pairing problem; both are solved by "tag every schedule+Wikipedia-corroborated rivalry game, rank none."

---

## 9. League hub page (resolved) — /cfb landing surface

A league homepage at /cfb: a browseable landing tier where a user searches/selects their team or browses others, with national rivalry games and cross-school content surfaced. (This is the hub mockup from the design thread: team search, theme-games rail, road-trips rail, rivalry watch, this-Saturday slate.)

**Universal pattern, CFB-first.** The league hub is a tier that applies to ALL six leagues (/cfb, /mlb, /nba, /nhl, /mls, /wnba), not a CFB one-off. Design the pattern once, build CFB first as the template, backfill the other five as a fast-follow (mostly data-population once the template exists). Do NOT build CFB's hub bespoke in a way the others would have to retrofit.

**Why it earns its place:**
- Captures league-level search the team pages structurally cannot ("college football theme games 2026", "best CFB road trips", "rivalry week schedule"). Aggregator pages already convert ~3.21% vs MLB team ~0.84%; cross-team queries are the winnable SERPs.
- The natural home for cross-team content that has no home today (national rivalries, theme games across schools, the weekly slate).
- The discovery entry point for sport-fans who haven't picked a team, underserved today (team pages assume you already picked).

**Formalizes Phase 5 of the build spec** ("Hub homepage + rails"), not net-new scope. The hub is the payoff surface on top of the Phase 2 data + team pages.

**Two-tier, same split as the pages:**
- **Automated spine:** this-week slate, scores, tagged rivalry games (schedule + Wikipedia corroboration, same pipeline as the auto pages).
- **Curated layer:** "national rivalry games that matter", "best road trips this fall". This is league-level EDITORIAL judgment by Matt, and it is LEGITIMATE to rank here, because a human curates the hub. (Contrast section 8: auto TEAM pages crown nothing because no human; the HUB is human-curated, so ranking national rivalries is a deliberate editorial call, not a machine guess.)

### 9a. Weekly rivalry-games rail — auto-rotating, same mechanic as homepage hot promos

The upcoming-week rivalry games on the hub behave EXACTLY like the "hot promos" strip on the main homepage:
- **Auto-populate** the current week's rivalry games (schedule + Wikipedia corroborated, per section 8).
- **Roll over to "next week" early Monday morning**, so anyone checking Monday AM sees the upcoming week's slate, not the one that just finished. Same date-rollover behavior already proven on the home page.
- **Implementation note:** reuse the existing home-page hot-promos rollover pattern + ISR revalidation. Mind the existing date-rollover safety window already used on home/playoffs (home ISR 21600s for date-rollover safety). The Monday-AM cutover must land before a typical user's Monday morning check, account for timezone (CT default) so the switch happens overnight, not midday.
- This makes the hub a reason to return weekly, a returning-visitor hook the site currently lacks (DAU/MAU ~3.5%, near-zero return visitation).

**Decision still implied:** confirm the rollover cutover time/timezone (lean: overnight US, CT-anchored, so it's switched before East Coast Monday morning). Verify against the existing hot-promos rollover so CFB reuses it rather than reinventing.

---

## 10. Cron cadence (resolved) — weekly + in-season near-term sweep

Yes, a recurring scrape, but the cadence is two-layered, not a single weekly pass, because CFB has two different freshness clocks.

**The Wednesday weekly sweep (Matt's instinct, confirmed):** full-slate refresh across covered schools to catch newly-announced theme designations (white outs, stripe outs, throwbacks) and promo/giveaway announcements. Wednesday is a good anchor: far enough past the prior weekend that schools have posted the next batch, early enough in the week to surface before the upcoming Saturday and before the hub's Monday rail rollover has gone stale. This is the "did a school just announce a white out" sweep.

**The near-term in-season sweep (the second layer the build spec already specified):** 2-3x/week over just the NEXT 2-3 weeks' games, because kickoff times + TV reveal on a rolling ~12-day window and theme designations firm up close to gameday. Scanning only the near-term games keeps Firecrawl spend bounded (don't re-scrape November in September).

**Offseason / structural:** weekly full-schedule refresh only (schedule changes are rare; no theme announcements yet).

### Key design points
- **Theme designation is a PIPELINE-attached field on the game (themeDesignations[]), separate from the editorial tradition narrative.** The sweep ATTACHES "this 2026 game is a white out" when a school announces it (with source + confidence + announcedAt). It does NOT write the tradition prose (what a white out feels like) — that stays editorial/human. The sweep populates the WHICH-GAME, the human wrote the WHAT-IT-MEANS once. (Same split as build spec section 3: cfbTradition = durable editorial; themeDesignations[] = volatile pipeline.)
- **A new theme designation still goes through the verify contract.** "Wisconsin announced a white out for the Oregon game" needs the same corroboration discipline — confirm against the school's official source, default to NF (not-found) rather than inventing. Theme announcements are exactly the kind of thing the context-extractor (Sonnet) handles with the announcedFor2026 ∈ {yes, no-historical-only, NF} disambiguation (build spec section 7). Trap cases already named: ND "The Shirt" (apparel not gameday), Boise basketball white-out (wrong sport), K-State "Senior Day" (roster ceremony not a fan theme).
- **The sweep feeds BOTH tiers.** A newly-announced theme on an AUTO-page school still gets the designation tag (it's hard-ish data: the school announced it). The auto page can show "White Out announced" as a fact without the editorial narrative — same as rivalry tags showing without the rivalry story.
- **Reuses the promo-pipeline Firecrawl fetch layer** (the rework Matt just did), concurrency-5 hobby tier, plain markdown scrape (1 credit, preserves verify), hash-skip to avoid re-processing unchanged pages, IndexNow dual-endpoint on any page that changes.
- **This is a Phase 5-era / post-launch cron**, not Phase 2. Phase 2 is the one-time hard-data backfill. The recurring theme/promo sweep is wired when the pages are live and there are designations worth catching. Note it now so the stream is designed to accept rolling designation updates from the start.

**Per the multi-league architecture note:** this CFB sweep is a per-league scanner with its own season-gated active flag (CFB ~late-Aug through early-Jan + the pre-season announcement window). Out-of-season, it idles so it doesn't burn Firecrawl credits on empty pages. Eventually folds into the shared multi-league runner (CFB as another league descriptor), not a parallel system.
