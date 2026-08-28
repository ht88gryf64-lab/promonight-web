# CFB venue sourcing report

Read-only research pass, 2026-08-27, branch `feature/cfb-venue-sources` (off `origin/main` b899f22). No Firestore writes, no code changes. Input: `audit/cfb-venue-wiring-check.md` section 8, the 23 populated-but-unsourced venueHubs fields on 20 hubs (17 tailgating, 2 parking, 1 transit, 3 gates). The write pass, if any, comes after review of the verdicts below.

## 0. Headline

1. **19 of the 23 fields already carry sources in Firestore, under dotted sub-keys.** All 17 tailgating hubs have `sources["tailgating.rules"]`, `sources["tailgating.timeWindow"]`, and so on; Maryland has `sources["publicTransit.notes"]` and `sources["publicTransit.lines"]`; Michigan State's CFB tenant overlay has `sources["gatesOpen.ruleText"]`. Section 8 counted them unsourced because it looked for the flat keys `tailgating`, `publicTransit`, `gatesOpen`, and the school-page renderer (`src/lib/venue-hub-condensed.ts`, `prov(s, 'tailgating')` at line 82, `prov(s, 'publicTransit')` at line 95, `prov(overlay.sources, 'gatesOpen')` at line 54) looks for the same flat keys. The silence on the school pages is a key-convention mismatch, not missing provenance. Only four fields are truly unsourced: Boise State gates, Wake Forest gates, Appalachian State `officialParkingUrls`, Pittsburgh `officialParkingUrls`.

2. **Field-level verdicts: 16 confirmed, 1 partial, 6 conflicting, 0 fields with no official source at all.** The partial is Texas A&M (rules, timeWindow, grillRules confirmed; rvPolicy not found on any 12thman.com tailgating page). The six conflicts are Coastal Carolina tailgating (stored rules and time window come from a 2020 COVID-season guide that current official pages contradict), Kansas tailgating (a lot list the campus policy library has since superseded), Maryland transit (the athletics page supports the stored text in full, the operating shuttle office's page states a different window), Miami tailgating (one clause, "blue/orange" passes, where both official pages say orange only), Tulane tailgating (a 2025 capture; the live page was rewritten for 2026), and Appalachian State's parking link (the stored URL returns 403).

3. **The four truly unsourced fields: official sources found for three.** Boise State's gate rule is verbatim on the 2025 Albertsons Stadium fan guide; Wake Forest's gate rule is verbatim on the godeacs.com gameday page; Pittsburgh's two parking links are live pages on the stadium operator and the parking operator. Appalachian State's link is dead (see conflicts).

4. **Sub-minimum schools: all four are unextracted, not unavailable.** Appalachian State, Kansas, and Oregon each have an official gameday guide or venue page that carries gates, parking, transit, tailgating, accessibility, bag policy, and concessions, none of it harvested. Army, whose hub carries the verifyNotes "athletics source too thin", has an operator-run gameday site (armygameday.com, Army West Point Athletic Association) plus goarmywestpoint.com and westpoint.edu pages covering parking, transit, tailgating, accessibility, bag policy, gates, and outside food. **Oregon's Autzen logistics are simply unextracted**: eight of the nine missing fields are on the official Autzen Stadium page, the 2026 gameday hub, and the Game Day Parking page on goducks.com; only a football rideshare zone is genuinely unpublished. Section 8 has the detail.

5. **Stored text was never edited and no source was attached.** Every verdict below is a recommendation for the write pass, not an action taken.

## 1. Method and evidence tiers

Sources of truth: fresh read-only dumps of `venueHubs` and each hub's `tenants` subcollection taken 2026-08-27 (scratchpad `hubs-dump3.json`, `tenants-dump3.json`), and `audit/cfb-venue-wiring-check.md` section 8 for the field list.

Three layers of checking, all read-only:

- **Automated citation match.** For every populated sub-key, fetch the URL stored under its dotted key (or, for the four truly unsourced fields, the candidate official URLs) and record HTTP status, how many stored sentences appear verbatim on the page, and the token coverage of the stored text on the page (share of the stored text's content words present on the page). Ohio State's page refuses non-browser fetches (status -1), so it was read through headless Chrome instead.
- **Agent read with adversarial re-check.** A verifier read the page(s) for each render-bearing sub-key (rules and timeWindow for tailgating, notes for transit, ruleText for gates, the link itself for parking) and a second agent re-fetched everything and tried to refute the verdict. 29 sub-key checks, 40 agents.
- **Headless DOM probes** where facts live on sub-pages the stored URL only links to (Texas A&M `/tailgating/rules` and `/tailgating/faq`) or where curl is blocked (Ohio State).

Evidence tiers used in the tables:

| Tier | Meaning |
| --- | --- |
| VERBATIM | at least one full stored sentence appears exactly on the cited official page |
| SUBSTANCE (read) | an agent or a DOM probe found the fact on the page; wording differs |
| SUBSTANCE (auto)* | 0.75 or more token coverage of the stored text on the cited page; no agent read. Weaker; the asterisk carries into the tables |
| IMPLIED | the `allowed: true` boolean; the cited page describes permitted tailgating without saying "allowed" |
| NOT-FOUND | the value is on none of the official pages checked |
| CONFLICT | an official page contradicts the stored text, or the stored link is dead |

Official means the athletics site, the campus office (parking, transportation, event services), or the stadium/parking operator. Nothing else was counted; fan sites, aggregators, and Wikipedia were not consulted.

Grain: section 8 counts fields, Firestore stores sub-keys, and the school-page block renders only some sub-keys (tailgating: first sentence of `rules` plus first sentence of `timeWindow`; transit: first sentence of `notes` plus `lines`; gates: `ruleText`; parking: `officialParkingUrls[0]` as the link when no lot map exists). `grillRules` and `rvPolicy` never render on the school page; they render on the venue page. A field's verdict is the worst verdict among its populated sub-keys; render-bearing sub-keys are marked in the appendix.

## 2. The key-convention finding

| Hub | Flat key the wiring check and renderer look for | Dotted keys actually present in `sources` |
| --- | --- | --- |
| all 17 tailgating hubs | `tailgating` | `tailgating.allowed`, `tailgating.rules`, and whichever of `tailgating.timeWindow`, `tailgating.grillRules`, `tailgating.rvPolicy` are populated (every populated sub-key has one) |
| secu-stadium (Maryland) | `publicTransit` | `publicTransit.notes`, `publicTransit.lines` |
| spartan-stadium-east-lansing-michigan tenant `michigan-state` | overlay `gatesOpen` | overlay `gatesOpen.ruleText` |
| albertsons-stadium tenant `boise-state` | overlay `gatesOpen` | none |
| allegacy-federal-credit-union-stadium tenant `wake-forest` | overlay `gatesOpen` | none |
| kidd-brewer-stadium (App State) | `officialParkingUrls` | none |
| acrisure-stadium (Pittsburgh) | `officialParkingUrls` | none |

Consequence, reported and not decided: the silence can be closed either by teaching the renderer to honor the dotted sub-keys (a code change with zero data writes, which would light up every dotted-sourced field at once, including the six conflicting ones, unless the renderer is also taught which ones to withhold) or by writing a flat alias in the write pass only for the fields whose verdict is confirmed (a data write that leaves conflicts silent by omission, which matches the rule that conflicts stay unsourced). Section 8 of the wiring check should be amended either way; its "no sources.tailgating (17)" line is literally true and materially misleading.

## 3. Field-level verdicts (23 fields)

| # | School | Hub | Field | Source stored in Firestore today | Confirming official URL(s) | Sub-keys (tier) | Field verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | alabama | saban-field-at-bryant-denny-stadium | tailgating | dotted sub-keys (rolltide.com) | rolltide.com/sports/2016/7/15/clear-bag-policy<br>rolltide.com/news/2022/8/25/football-new-in-2022 | tailgating.allowed: SUBSTANCE (read)<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 2 | coastal-carolina | brooks-stadium | tailgating | dotted sub-keys (goccusports.com) | goccusports.com/sports/2018/5/24/clearbag<br>goccusports.com/sports/2020/9/17/CAFgameday | tailgating.allowed: IMPLIED<br>tailgating.rules (R): CONFLICT<br>tailgating.timeWindow (R): CONFLICT<br>tailgating.grillRules: SUBSTANCE (auto)* | **conflicting** |
| 3 | colorado | folsom-field | tailgating | dotted sub-keys (cubuffs.com) | cubuffs.com/sports/2025/8/15/folsom-field-a-z<br>cubuffs.com/sports/2016/7/30/franklin-field-aluminum-can-tailgate-zone-how-it-works<br>cubuffs.com/sports/2016/7/30/franklin-field-aluminum-can-tailgate-zone-gameday-guide | tailgating.allowed: SUBSTANCE (read)<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (auto)*<br>tailgating.grillRules: SUBSTANCE (auto)*<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 4 | georgia | sanford-stadium | tailgating | dotted sub-keys (georgiadogs.com) | georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01 | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (auto)*<br>tailgating.grillRules: SUBSTANCE (auto)*<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 5 | indiana | memorial-stadium-indiana-university | tailgating | dotted sub-keys (iuhoosiers.com) | iuhoosiers.com/sports/2017/8/14/bag-policies<br>iuhoosiers.com/news/2024/8/15/b-town-boulevard-added-to-football-gameday-experience<br>iuhoosiers.com/news/2017/8/21/general-glass-meets-with-media-on-excellence-academy-construction-fan-experience-enhancements-security-traffic-and-parking-and-special-elements-for-ohio-state-game | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (read) | **confirmed** |
| 6 | kansas | david-booth-kansas-memorial-stadium | tailgating | dotted sub-keys (kuathletics.com) | kuathletics.com/sports/2024/5/17/policies-and-procedures-704g-athletic-events-alcohol-consumption-tailgating | tailgating.allowed: IMPLIED<br>tailgating.rules (R): CONFLICT<br>tailgating.timeWindow (R): SUBSTANCE (auto)*<br>tailgating.grillRules: VERBATIM | **conflicting** |
| 7 | kansas-state | bill-snyder-family-football-stadium | tailgating | dotted sub-keys (www.kstatesports.com) | kstatesports.com/sports/2015/6/14/_131476205627337354 | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.grillRules: VERBATIM<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 8 | maryland | secu-stadium | tailgating | dotted sub-keys (umterps.com) | umterps.com/sports/2018/8/17/football-game-day-info-guide<br>umterps.com/sports/2023/6/30/football-parking | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): VERBATIM<br>tailgating.grillRules: VERBATIM<br>tailgating.rvPolicy: VERBATIM | **confirmed** |
| 9 | memphis | simmons-bank-liberty-stadium | tailgating | dotted sub-keys (gotigersgo.com) | gotigersgo.com/news/2022/8/31/memphis-athletics-announces-football-gameday-information<br>gotigersgo.com/news/2024/8/22/fan-information-released-for-2024-memphis-football-season<br>gotigersgo.com/news/2019/10/29/football-game-day-information-smu | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (read)<br>tailgating.grillRules: SUBSTANCE (auto)* | **confirmed** |
| 10 | miami | hard-rock-stadium | tailgating | dotted sub-keys (www.hardrockstadium.com) | hardrockstadium.com/stadium-policy<br>hardrockstadium.com/faq-items/parking | tailgating.allowed: IMPLIED<br>tailgating.rules (R): CONFLICT<br>tailgating.timeWindow (R): SUBSTANCE (read)<br>tailgating.grillRules: SUBSTANCE (auto)*<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **conflicting** |
| 11 | michigan-state | spartan-stadium-east-lansing-michigan | tailgating | dotted sub-keys (msuspartans.com) | msuspartans.com/news/2025/8/21/parking-construction-and-stadium-information-for-football-season-opener-vs-western-michigan<br>msuspartans.com/sports/2022/8/24/football-gameday-stadium-services | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): VERBATIM<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 12 | ohio-state | ohio-stadium | tailgating | dotted sub-keys (ohiostatebuckeyes.com) | ohiostatebuckeyes.com/sports/2022/8/17/tailgating | tailgating.allowed: SUBSTANCE (read)<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (read)<br>tailgating.grillRules: SUBSTANCE (read)<br>tailgating.rvPolicy: SUBSTANCE (read) | **confirmed** |
| 13 | oklahoma-state | boone-pickens-stadium | tailgating | dotted sub-keys (okstate.com) | okstate.com/sports/2015/3/17/GEN_2014010169 | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (auto)*<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 14 | texas-am | kyle-field | tailgating | dotted sub-keys (12thman.com) | 12thman.com/tailgating-in-aggieland | tailgating.allowed: SUBSTANCE (read)<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (read)<br>tailgating.grillRules: SUBSTANCE (read)<br>tailgating.rvPolicy: NOT-FOUND | **partial (4 confirmed, tailgating.rvPolicy not-found)** |
| 15 | tulane | yulman-stadium | tailgating | dotted sub-keys (tulanegreenwave.com) | tulanegreenwave.com/sports/2019/7/29/tailgating-2019<br>tulanegreenwave.com/sports/2020/9/25/gameday-central-20201 | tailgating.allowed: IMPLIED<br>tailgating.rules (R): CONFLICT<br>tailgating.timeWindow (R): SUBSTANCE (read)<br>tailgating.grillRules: SUBSTANCE (auto)*<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **conflicting** |
| 16 | ucla | rose-bowl-stadium | tailgating | dotted sub-keys (uclabruins.com) | uclabruins.com/tailgating<br>uclabruins.com/gameday-information | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.timeWindow (R): SUBSTANCE (auto)*<br>tailgating.grillRules: VERBATIM<br>tailgating.rvPolicy: VERBATIM | **confirmed** |
| 17 | wake-forest | allegacy-federal-credit-union-stadium | tailgating | dotted sub-keys (godeacs.com) | godeacs.com/sports/2018/7/27/gameday | tailgating.allowed: IMPLIED<br>tailgating.rules (R): SUBSTANCE (read)<br>tailgating.grillRules: SUBSTANCE (auto)*<br>tailgating.rvPolicy: SUBSTANCE (auto)* | **confirmed** |
| 18 | appalachian-state | kidd-brewer-stadium | parking | none | appstatesports.com/news/2025/9/4/2025-app-state-football-fan-guide.aspx (links the stored URL verbatim) | officialParkingUrls (R): CONFLICT | **conflicting** |
| 19 | pittsburgh | acrisure-stadium | parking | none | the stored URLs themselves (both 200) | officialParkingUrls (R): VERBATIM (link)<br>officialParkingUrls (R): VERBATIM (link) | **confirmed** |
| 20 | maryland | secu-stadium | transit | dotted sub-keys (umterps.com) | umterps.com/sports/2023/6/30/football-parking | publicTransit.notes (R): CONFLICT<br>publicTransit.lines (R): SUBSTANCE (auto)* | **conflicting** |
| 21 | boise-state | albertsons-stadium | gates | none | broncosports.com/sports/2025/8/12/albertsons-stadium-fan-guide | gatesOpen.ruleText (R): VERBATIM | **confirmed** |
| 22 | michigan-state | spartan-stadium-east-lansing-michigan | gates | dotted sub-keys (msuspartans.com) | msuspartans.com/sports/2022/8/24/football-gameday-stadium-services | gatesOpen.ruleText (R): VERBATIM | **confirmed** |
| 23 | wake-forest | allegacy-federal-credit-union-stadium | gates | none | godeacs.com/sports/2018/7/27/gameday | gatesOpen.ruleText (R): VERBATIM | **confirmed** |

Tally: 16 confirmed, 1 partial, 6 conflicting, 0 fields with no official source.

## 4. Conflicts in detail (6)

**Coastal Carolina, tailgating.rules and tailgating.timeWindow (brooks-stadium; hub `verified: false`).** Both sub-keys cite `goccusports.com/sports/2020/9/17/CAFgameday`, a COVID-season document (face coverings, social distancing, "this is only temporary"). The stored rules say tailgating is "at the individual's discretion but must stay within" the purchased space with green-space and tent clauses; the current official parking page (`goccusports.com/sports/2026/8/17/2025-football-parking`, titled "2026 Football Parking", reached from the site's Gameday > Parking nav) says "Tailgate in your space or adjacent green space; do not block traffic", "One vehicle per pass, one space per vehicle", "Gas grills only, charcoal prohibited", and adds a 2-foot platform limit; the 2020 green-space and tent clauses are absent or contradicted. The stored time window, "Parking lots open two hours prior to kickoff", is the 2020 figure; the 2025 Know Before You Go articles on the same domain give roughly six hours on two separate dates. The stored text's "per 2020 gameday guide" hedge is accurate to its source and still wrong for fans. `grillRules` ("No charcoal grills permitted; no glass bottles") is consistent with the current page. No 2026 per-game guide exists yet (opener not played as of 2026-08-27).

**Kansas, tailgating.rules (david-booth-kansas-memorial-stadium).** The cited page, `kuathletics.com/sports/2024/5/17/policies-and-procedures-704g-athletic-events-alcohol-consumption-tailgating`, is live, official, and plainly where the stored lot list came from, but it is stamped "Updated 5/15" and enumerates lots 1, 2, 3, 33, 34, 36, 39, 50, 52 through 62, 65, 72, 90, 91, 94, 96, 130 and the Mississippi Street garage. The campus policy library (policy.ku.edu, 704G, revised 10/30/2025) no longer enumerates lots and records the 03/03/2016 removal of lots 33 and 50; KU Parking's current football page says tailgating is prohibited in lots 34 and 61 (though it still names lot 50 among the Williams Fund game-permit lots, so the 2016 note may itself be stale for lot 50). (The verifier reported the stored text as truncated at "96, and ..."; that was the ~275-character preview its prompt carried, not the record. The stored text is complete, 851 characters, ending at Campanile Hill and the war memorials; see the appendix.) `timeWindow` (three hours before kickoff, during the game) and `grillRules` (no cooking in garages, verbatim) are consistent with the cited page.

**Maryland, publicTransit.notes (secu-stadium).** The cited page `umterps.com/sports/2023/6/30/football-parking` is current-season (title "2026 Football Parking Information", parking-map asset dated 2026/8/4) and supports the stored text in full: Quickbus runs "Three hours prior to kickoff until 30 minutes after kickoff" and "Halftime until one hour after the final whistle". The operating office's page, transportation.umd.edu (DOTS, which runs Shuttle-UM), states a continuous window from three hours before kickoff through one hour after the final whistle, no mid-game gap, and "Buses are available at this location during the game"; its only dated asset is a 2025-08 map, so it may be an unrefreshed copy. The endpoints agree on both pages; only the mid-game suspension and a Metro Station origin differ. This is a two-official-sources disagreement rather than a stored-text error; flagged for the user's call.

**Ruling, 2026-08-27 (Matt, Pass 1 brief):** DOTS is authoritative over the athletics page because DOTS operates Shuttle-UM. The stored text is therefore stale rather than disputed, which is not a rendering decision: it is held in code (`CONDENSED_HOLDS`, not the conflicts list) until Pass 2 rewrites `publicTransit.notes` to the DOTS window and re-sources the field to transportation.umd.edu, at which point the hold entry is deleted. Sections 0, 3 and 7 keep the research-time verdict (conflicting) as the record of what was found; this ruling is what resolves it. `publicTransit.lines` ("Quickbus (Shuttle-UM free gameday shuttle)") is consistent with both.

**Miami, tailgating.rules (hard-rock-stadium).** Cited page `hardrockstadium.com/stadium-policy/` (stadium operator, tailgating section dated 2026-08-11) confirms everything in the stored rules except one clause. Stored: fans with "blue/orange" parking passes may park where they wish during the first hour of Dolphins games. Both official pages (stadium-policy and `faq-items/tailgating-guidelines`) say orange passes only and do not mention blue anywhere in visible text. The conflicting clause is not in the first sentence, so it would not render on the school page, but the field as stored conflicts. Not resolved here; the verifier notes the practical fix is a one-word edit or a re-harvest from the 2026-08-11 text. `timeWindow`, `grillRules`, `rvPolicy` are consistent.

**Tulane, tailgating.rules (yulman-stadium).** Cited page `tulanegreenwave.com/sports/2019/7/29/tailgating-2019` is live and official but has been rewritten for 2026. Stored: "The Berger Family Lawn is the only tailgating location for the 2025 season" plus a package list including Lagniappe/Beaucoup tiers with prices (the verifier saw a truncated preview; the stored text is complete, 961 characters, and includes the Beaucoup price). Live page: "The Berger Family Lawn is the tailgating destination for the 2026 season", a different season statement and a shorter package list with no Lagniappe/Beaucoup tiers. The stored wording survives only in a search-engine cache of the prior version. Campus event services and the alumni homecoming page (both official) carry no package names or prices. `timeWindow` (four hours before kickoff, ends 30 minutes before, none during the game) is on the live page and confirmed; `grillRules` and `rvPolicy` are consistent with their cited pages.

**Appalachian State, officialParkingUrls (kidd-brewer-stadium).** Stored link `https://mountaineersathleticfund.com/yosef-club/renewals/index.html` returns 403 (S3 AccessDenied). The link is verbatim in the appstatesports.com sitewide nav and Story Links of the 2025 fan guide ("Football Donor Parking Information"), so the harvest was faithful, but the fan guide's own body links `https://mountaineersathleticfund.com/yosef-club/index.html#season-tickets-parking`, which is live, carries the 2026 lot map (lots A through R with prices) and the 2026 parking request form. Two official pointers disagree on where donor parking lives; as published, the stored link sends fans to a 403. Reported as a conflict rather than swapped.

## 5. The four truly unsourced fields

| Field | Stored text | Official source found | Match |
| --- | --- | --- | --- |
| boise-state `gatesOpen.ruleText` (albertsons-stadium tenant overlay) | "For Boise State football games, all gates, including Stueckle Sky Center and regular admission gates, will open two (2) hours prior to kickoff." | `https://broncosports.com/sports/2025/8/12/albertsons-stadium-fan-guide` | VERBATIM 1/1 |
| wake-forest `gatesOpen.ruleText` (allegacy-federal-credit-union-stadium tenant overlay) | "Gates open 90 minutes prior to kickoff, McCreary Tower and Bridger Field House open 2 hours prior to kickoff." | `https://godeacs.com/sports/2018/7/27/gameday` (2018 URL, page maintained; the same page carries the tailgating rules) | VERBATIM 1/1 |
| pittsburgh `officialParkingUrls` (acrisure-stadium) | `https://acrisurestadium.com/stadium/parking-directions/`, `https://alcoparking.com/acrisure-stadium-pnc-park/` | the stored values are themselves the official pages: stadium operator and ALCO Parking (operator of the North Shore lots). Both live, 200. ALCO's Panthers-specific page is `.../acrisure-stadium-pnc-park/panthers-parking/` | VERBATIM (link) |
| appalachian-state `officialParkingUrls` (kidd-brewer-stadium) | `https://mountaineersathleticfund.com/yosef-club/renewals/index.html` | 403; live alternate on the same official fund site (section 4) | CONFLICT |

## 6. Source-quality caveats for the write pass

- **Dated pages.** Several cited URLs are old articles that the athletics sites still maintain: Oklahoma State 2015 (`GEN_2014010169`), Kansas State 2015, Georgia 2017 (a 2016 gameday central), Colorado 2016, Indiana 2017, Maryland 2018, Michigan State 2018/2022, Wake Forest 2018, Coastal Carolina 2018/2020, Tulane 2019 (content rewritten for 2026). The verifiers found current-season official pages that agree with the stored text and named them as stronger citations; they are listed per school in the appendix under "stronger URL". Repointing is a write-pass option, not done here.
- **Hubs still `verified: false`:** brooks-stadium (Coastal Carolina), sanford-stadium (Georgia), simmons-bank-liberty-stadium (Memphis). Attaching a field source does not flip the doc-level flag; those venue pages stay non-indexable regardless.
- **Ohio State** (`ohiostatebuckeyes.com/sports/2022/8/17/tailgating`) refuses non-browser fetches. The headless DOM carries every stored fact checked: the 8.5' x 15' space, one entrance, no saving spaces, tent setup from 5:00 pm Thursday, charcoal prohibited, RVs in the Gray and Buckeye Lots. Any future automated check needs a real browser.
- **Texas A&M** stores `https://12thman.com/tailgating-in-aggieland` (a landing page) for every sub-key; the facts sit on `/tailgating/rules` (time window, grills, coals, the 15-feet greenspace rule) and `/tailgating/faq` (9 a.m. day-before first-come, noon air horn, trailer-mounted grills). `rvPolicy` (Lot 95 oversized sites, the 979-862-7943 Transportation Services line, "must separately purchase a public parking space") is on none of the three; it may live on transport.tamu.edu, which was not checked, so it is reported not-found rather than guessed.
- **Michigan State** stores `msuspartans.com/news/2025/8/21/parking-construction-and-stadium-...` for `tailgating.rules`; that page carries only the first sentence verbatim (token coverage 0.44). The full text is on `msuspartans.com/sports/2018/9/13/football-tailgating-information`. The first sentence is the one that renders.
- **Alabama** `tailgating.rules` is a composite: no single rolltide.com page carries it; it is confirmed across `rolltide.com/news/2022/8/25/football-new-in-2022` and `rolltide.com/sports/2016/7/15/clear-bag-policy`. The campus gameday office's `https://uagameday.com/tailgating/` carries it whole and is current-season.
- **`allowed: true` booleans** are sourced to the same page as the rules and are confirmed only by implication. Indiana (`iuhoosiers.com/sports/2017/8/14/bag-policies`) and Coastal Carolina (`goccusports.com/sports/2018/5/24/clearbag`) cite bag-policy pages for `allowed`; weak citations, not independently checked.

## 7. Sub-key appendix

Every populated sub-key on the 23 fields, with the full stored text, the URL stored under its dotted key (or the candidate for the four truly unsourced), the automated match (verbatim sentences / token coverage), the evidence tier, and the sub-key verdict. Render-bearing sub-keys are marked (R).

### alabama / saban-field-at-bryant-denny-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://rolltide.com/sports/2016/7/15/clear-bag-policy
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: implied by the rules pages; uagameday.com/tailgating is the current-season anchor

### alabama / saban-field-at-bryant-denny-stadium / tailgating.rules (R)

- Stored: Tailgating is permitted in the Quad, on campus, and in parking lots; the clear bag policy does not restrict tailgating. Both reserved and free tailgating are offered; rules and regulations are posted at uagameday.com/tailgating.
- Cited (dotted key): https://rolltide.com/news/2022/8/25/football-new-in-2022
- Automated match: HTTP 200; verbatim 0/4; coverage 0.79
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: composite: confirmed across the cited 2022 article and rolltide.com/sports/2016/7/15/clear-bag-policy; whole on https://uagameday.com/tailgating/

### alabama / saban-field-at-bryant-denny-stadium / tailgating.rvPolicy

- Stored: An East Campus RV lot is available and is serviced by the free Crimson Ride shuttle to the Quad.
- Cited (dotted key): https://rolltide.com/news/2022/8/25/football-new-in-2022
- Automated match: HTTP 200; verbatim 0/1; coverage 0.89
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### coastal-carolina / brooks-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://goccusports.com/sports/2018/5/24/clearbag
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**
- Note: cited page is a clear-bag page; weak citation

### coastal-carolina / brooks-stadium / tailgating.rules (R)

- Stored: Per 2020 gameday guide: tailgating allowed at the individual's discretion but must stay within your individual parking space and may not be in or around public green spaces; no tailgating once the game starts or after the contest ends (tents/large-group items were prohibited under 2020 COVID protocols). Clear bag policy FAQ: no glass bottles or charcoal grills permitted.
- Cited (dotted key): https://goccusports.com/sports/2020/9/17/CAFgameday
- Automated match: HTTP 200; verbatim 0/3; coverage 0.84
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: 2020 COVID-season guide; current 2026 parking page differs (section 4)

### coastal-carolina / brooks-stadium / tailgating.timeWindow (R)

- Stored: Parking lots open two hours prior to kickoff; no tailgating once the game starts (per 2020 gameday guide).
- Cited (dotted key): https://goccusports.com/sports/2020/9/17/CAFgameday
- Automated match: HTTP 200; verbatim 0/2; coverage 1
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: 2-hour lot opening is the 2020 value; 2025 KBYG articles say ~6 hours (section 4)

### coastal-carolina / brooks-stadium / tailgating.grillRules

- Stored: No charcoal grills permitted; no glass bottles.
- Cited (dotted key): https://goccusports.com/sports/2018/5/24/clearbag
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**
- Note: consistent with the current page ("Gas grills only, charcoal prohibited")

### colorado / folsom-field / tailgating.allowed

- Stored: true
- Cited (dotted key): https://cubuffs.com/sports/2025/8/15/folsom-field-a-z
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: Folsom Field A-Z (2025); campus PTS football page agrees

### colorado / folsom-field / tailgating.rules (R)

- Stored: Designated tailgate zones at Folsom Field: Fan Fest Tailgate and Chip's Kids Club at Duane Field, Franklin Field Tailgate Zone at Franklin Field, and Benson Tailgate Zone at Benson Field. The Franklin Field Tailgate Zone is an 'Aluminum Only' zone (no glass beverage containers allowed); fans may bring and prepare their own food and beverages, with approximately 110 pre-reserved spaces around Franklin Field, each defined by a 10ft x 10ft CU tent.
- Cited (dotted key): https://cubuffs.com/sports/2016/7/30/franklin-field-aluminum-can-tailgate-zone-how-it-works
- Automated match: HTTP 200; verbatim 0/3; coverage 0.8
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: aluminum-only / no-glass clause verbatim on the cited page; stronger: https://cubuffs.com/sports/2025/8/15/folsom-field-a-z

### colorado / folsom-field / tailgating.timeWindow (R)

- Stored: Franklin Field Tailgate Zone parking on Level P1 of Lot 391 is first-come, first-served beginning six (6) hours prior to kickoff, but no earlier than 8AM (subject to change for non-Saturday home games).
- Cited (dotted key): https://cubuffs.com/sports/2016/7/30/franklin-field-aluminum-can-tailgate-zone-gameday-guide
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**
- Note: 2016 article

### colorado / folsom-field / tailgating.grillRules

- Stored: Fans may bring and prepare their own food; if using a grill for food preparation, SevenSouth coordinates the best arrangement for transportation and storage.
- Cited (dotted key): https://cubuffs.com/sports/2016/7/30/franklin-field-aluminum-can-tailgate-zone-how-it-works
- Automated match: HTTP 200; verbatim 0/2; coverage 0.85
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**
- Note: 2016 article

### colorado / folsom-field / tailgating.rvPolicy

- Stored: RV parking available in Lot 544 (east campus); $120 (credit card) paid on game day; not available for pre-purchase; overnight parking not allowed on campus.
- Cited (dotted key): https://cubuffs.com/sports/2025/8/15/folsom-field-a-z
- Automated match: HTTP 200; verbatim 0/4; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### georgia / sanford-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### georgia / sanford-stadium / tailgating.rules (R)

- Stored: Designated tailgating is permitted across campus, with a designated area for corporate tailgates. On North Campus: tents and tables up to six feet long are allowed; kegs, generators, TVs, amplified music, grills or cookers of any type, and household furniture (folding chairs excepted) are not allowed at any time. Golf carts and ATVs are prohibited on campus on gamedays. Fans must provide their own power/video sources and are asked to bag their trash.
- Cited (dotted key): https://georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01
- Automated match: HTTP 200; verbatim 0/5; coverage 0.91
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: stronger: https://georgiadogs.com/sports/2018/8/6/football-gameday-tailgating (evergreen tailgating page)

### georgia / sanford-stadium / tailgating.timeWindow (R)

- Stored: Tailgating on North Campus is allowed beginning five hours before kickoff.
- Cited (dotted key): https://georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### georgia / sanford-stadium / tailgating.grillRules

- Stored: Grills are not allowed to be used inside of or on top of parking decks, nor on North Campus. Deep fryers and low country boils are NOT permitted anywhere on campus (unsafe cooking method around large crowds).
- Cited (dotted key): https://georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01
- Automated match: HTTP 200; verbatim 0/2; coverage 0.88
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### georgia / sanford-stadium / tailgating.rvPolicy

- Stored: RV parking options: Georgia Bulldog RV Club at the UGA Rec Sports Complex (full-season parking only; contact UGA Parking Services, 706-542-7275); Prestige Parking of Athens (season and single-game RV permits, three designated lots); and Bulldog Park (upscale RV facility with full hookups, party pavilion, onsite security and shuttle service to and from Sanford Stadium).
- Cited (dotted key): https://georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01
- Automated match: HTTP 200; verbatim 0/4; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### indiana / memorial-stadium-indiana-university / tailgating.allowed

- Stored: true
- Cited (dotted key): https://iuhoosiers.com/sports/2017/8/14/bag-policies
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**
- Note: cited page is a bag-policy page; weak citation

### indiana / memorial-stadium-indiana-university / tailgating.rules (R)

- Stored: B-Town Boulevard on the south lawn of Memorial Stadium opens two-and-one-half hours prior to kickoff with a festival-like pregame atmosphere (concert stage for live bands, food trucks, outdoor bar, and family-friendly games and attractions) and closes just prior to kickoff; all-inclusive B-Town Boulevard tailgate packages and customizable group tailgate tents are available.
- Cited (dotted key): https://iuhoosiers.com/news/2024/8/15/b-town-boulevard-added-to-football-gameday-experience
- Automated match: HTTP 200; verbatim 0/2; coverage 1
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: cross-checked to the 2025-08-25 gameday article and https://iuhoosiers.com/sports/2024/7/10/b-town-boulevard

### indiana / memorial-stadium-indiana-university / tailgating.timeWindow (R)

- Stored: Parking lots open a minimum of five hours prior to kickoff for each home game.
- Cited (dotted key): https://iuhoosiers.com/news/2017/8/21/general-glass-meets-with-media-on-excellence-academy-construction-fan-experience-enhancements-security-traffic-and-parking-and-special-elements-for-ohio-state-game
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: 2017 article; stronger: https://iuhoosiers.com/sports/2023/5/18/football-parking and the 2025 FB_Game_Day_Parking_Guidelines.pdf

### kansas / david-booth-kansas-memorial-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://kuathletics.com/sports/2024/5/17/policies-and-procedures-704g-athletic-events-alcohol-consumption-tailgating
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### kansas / david-booth-kansas-memorial-stadium / tailgating.rules (R)

- Stored: Alcohol consumption in conjunction with tailgating at home football games is permitted only in designated parking lots (lots 1, 2, 3 [excluding the canopy and other designated areas], 33, 34, 36, 39, 50, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 65, 72, 90, 91, 94, 96, and 130), the Mississippi Street Parking Garage, and in designated areas on Campanile Hill. Sale of alcoholic beverages is prohibited; containers over one gallon are not permitted; the legal drinking age of 21 is enforced; food and non-alcoholic beverages must be available at any location where alcohol is consumed. Alcohol consumption is not permitted on city streets (Mississippi, Fambrough Drive, Maine, and 11th Streets). No tailgating is permitted in the war memorials (Korean War Memorial, Vietnam Veterans Memorial, and the WWII Memorial Campanile and surrounding plaza).
- Cited (dotted key): https://kuathletics.com/sports/2024/5/17/policies-and-procedures-704g-athletic-events-alcohol-consumption-tailgating
- Automated match: HTTP 200; verbatim 0/7; coverage 0.97
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: lot list superseded by the campus policy library and KU Parking (section 4)

### kansas / david-booth-kansas-memorial-stadium / tailgating.timeWindow (R)

- Stored: Alcohol may be consumed during tailgating for the three hours preceding kickoff and during halftime; consumption ends no later than 30 minutes after kickoff, and halftime consumption ends 15 minutes after the second-half kickoff.
- Cited (dotted key): https://kuathletics.com/sports/2024/5/17/policies-and-procedures-704g-athletic-events-alcohol-consumption-tailgating
- Automated match: HTTP 200; verbatim 0/2; coverage 0.85
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### kansas / david-booth-kansas-memorial-stadium / tailgating.grillRules

- Stored: No cooking is permitted in the parking garages.
- Cited (dotted key): https://kuathletics.com/sports/2024/5/17/policies-and-procedures-704g-athletic-events-alcohol-consumption-tailgating
- Automated match: HTTP 200; verbatim 1/1; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### kansas-state / bill-snyder-family-football-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://www.kstatesports.com/sports/2015/6/14/_131476205627337354
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### kansas-state / bill-snyder-family-football-stadium / tailgating.rules (R)

- Stored: Tailgating is a traditional part of K-State game day. Guests must arrive together to park and tailgate together; saving stalls (including in VIP areas) is prohibited. Tailgates with excessive attendees interfering with adjacent tailgates may be asked to shut down. No objects (vehicles, canopies, tables, chairs, grills, etc.) may encroach on the Emergency Access Lane. Portable generators limited to quiet or soundproofed units; sound-system volume must not disturb neighboring tailgates. Long-toss ball/Frisbee games prohibited. Pop-up canopies may be erected immediately in front of or behind a vehicle in a reserved stall but may not be anchored into asphalt or to walls/barricades and should be taken down in windy conditions. Alcohol is for personal consumption only, from cups or cans (no glass), containers no larger than one gallon. Personal portable porta-potties are prohibited.
- Cited (dotted key): https://www.kstatesports.com/sports/2015/6/14/_131476205627337354
- Automated match: HTTP 200; verbatim 0/11; coverage 0.96
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: 2015 page, still maintained; campus parking page agrees

### kansas-state / bill-snyder-family-football-stadium / tailgating.grillRules

- Stored: Open wood fires and campfires are prohibited. After use, coals should be extinguished and disposed of in the red "Hot Coals" barrels.
- Cited (dotted key): https://www.kstatesports.com/sports/2015/6/14/_131476205627337354
- Automated match: HTTP 200; verbatim 2/2; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### kansas-state / bill-snyder-family-football-stadium / tailgating.rvPolicy

- Stored: Overnight parking is restricted to reserved RV parking with a purchased overnight pass.
- Cited (dotted key): https://www.kstatesports.com/sports/2015/6/14/_131476205627337354
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### maryland / secu-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://umterps.com/sports/2018/8/17/football-game-day-info-guide
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### maryland / secu-stadium / tailgating.rules (R)

- Stored: Tailgating is limited to the number of parking spaces for which one has a permit, and parking permits must be displayed at all times. Individuals not complying are subject to a fine from the Department of Transportation Services and/or revocation of Terrapin Club parking privileges. Tailgate restrooms are available at Ludwig, XFINITY and portable locations throughout the parking lots.
- Cited (dotted key): https://umterps.com/sports/2018/8/17/football-game-day-info-guide
- Automated match: HTTP 200; verbatim 0/3; coverage 1
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: 2018 guide

### maryland / secu-stadium / tailgating.timeWindow (R)

- Stored: All parking lots open six (6) hours prior to kickoff.
- Cited (dotted key): https://umterps.com/sports/2018/8/17/football-game-day-info-guide
- Automated match: HTTP 200; verbatim 1/1; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### maryland / secu-stadium / tailgating.grillRules

- Stored: You may not grill with an open flame when tailgating in parking garages.
- Cited (dotted key): https://umterps.com/sports/2018/8/17/football-game-day-info-guide
- Automated match: HTTP 200; verbatim 1/1; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### maryland / secu-stadium / tailgating.rvPolicy

- Stored: Parking on campus for buses and RVs on football game days is no longer available. Alternate RV/bus parking is at Cherry Hill Park, about 10 minutes from campus (unaffiliated with the University; reservations required online). Buses can use the bus depot at Regents Drive Garage to drop fans off and stage off campus in Lot V.
- Cited (dotted key): https://umterps.com/sports/2023/6/30/football-parking
- Automated match: HTTP 200; verbatim 2/4; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**
- Note: cited page now titled 2026 Football Parking Information

### memphis / simmons-bank-liberty-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://gotigersgo.com/news/2022/8/31/memphis-athletics-announces-football-gameday-information
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### memphis / simmons-bank-liberty-stadium / tailgating.rules (R)

- Stored: Tailgating is permitted in season and gameday parking lots. Premium turnkey tailgate packages are available through RevelXP (groups from 10 to 1,000+, including tent, tables and chairs). A Tiger Tailgate area on Tiger Lane features a large-screen TV, food trucks, beer sales, seating and tables.
- Cited (dotted key): https://gotigersgo.com/news/2022/8/31/memphis-athletics-announces-football-gameday-information
- Automated match: HTTP 200; verbatim 1/3; coverage 0.78
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: one of three sentences verbatim; stronger: the evergreen Gameday Information section on gotigersgo.com

### memphis / simmons-bank-liberty-stadium / tailgating.timeWindow (R)

- Stored: Parking (tailgate) lots open based on kickoff time: 6 a.m. for 11 a.m.-1 p.m. kickoffs, 8 a.m. for 2-5 p.m. kickoffs, and 10 a.m. for 6 p.m. or later kickoffs.
- Cited (dotted key): https://gotigersgo.com/news/2024/8/22/fan-information-released-for-2024-memphis-football-season
- Automated match: HTTP 200; verbatim 0/2; coverage 0.8
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: 2024 article

### memphis / simmons-bank-liberty-stadium / tailgating.grillRules

- Stored: No grills are allowed on any grass area around the stadium (including the Purple Lot grass); grilling is permitted on pavement only.
- Cited (dotted key): https://gotigersgo.com/news/2019/10/29/football-game-day-information-smu
- Automated match: HTTP 200; verbatim 0/2; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**
- Note: 2019 article

### miami / hard-rock-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://www.hardrockstadium.com/stadium-policy
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### miami / hard-rock-stadium / tailgating.rules (R)

- Stored: Tailgate directly behind your vehicle in the marked 8'x10' space; one space per vehicle, no saving/obstructing/reserving spaces; no kegs; drink responsibly (no funnels or drinking games); no box trucks or anything in-tow (grills/trailers); no commercial catering, vending, or solicitation; no professional DJ setups; music at reasonable volume without explicit lyrics; do not block fire lanes; clean up before entering. During Dolphins games the first hour is open parking for blue/orange pass holders, then directive parking begins (yellow lots directive from opening); for Hurricanes games and other events directive parking is in effect for all lots from opening.
- Cited (dotted key): https://www.hardrockstadium.com/stadium-policy
- Automated match: HTTP 200; verbatim 0/11; coverage 0.82
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: "blue/orange" pass clause; both official pages say orange only (section 4); the rest confirmed

### miami / hard-rock-stadium / tailgating.timeWindow (R)

- Stored: Parking lots close 1.5 hours after the event ends
- Cited (dotted key): https://www.hardrockstadium.com/faq-items/parking
- Automated match: HTTP 200; verbatim 0/1; coverage 0.75
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: same fact, wording differs

### miami / hard-rock-stadium / tailgating.grillRules

- Stored: Gas and charcoal barbecue grills permitted; open fires (bonfires/pit fires) prohibited; extinguish hot coals promptly, bag cooled briquettes and place in a trash bin, do not dump on the ground
- Cited (dotted key): https://www.hardrockstadium.com/stadium-policy
- Automated match: HTTP 200; verbatim 0/3; coverage 0.87
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### miami / hard-rock-stadium / tailgating.rvPolicy

- Stored: Box trucks prohibited; vehicles may not enter with anything in tow (e.g., grills, trailers)
- Cited (dotted key): https://www.hardrockstadium.com/stadium-policy
- Automated match: HTTP 200; verbatim 0/2; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### michigan-state / spartan-stadium-east-lansing-michigan / tailgating.allowed

- Stored: true
- Cited (dotted key): https://msuspartans.com/news/2025/8/21/parking-construction-and-stadium-information-for-football-season-opener-vs-western-michigan
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### michigan-state / spartan-stadium-east-lansing-michigan / tailgating.rules (R)

- Stored: Tailgating is permitted in all public parking areas on campus. Park in designated areas only, dispose of trash properly and follow campus ordinances. MSU's campus is tobacco free; no tobacco products can be used on campus at any time, including game days.
- Cited (dotted key): https://msuspartans.com/news/2025/8/21/parking-construction-and-stadium-information-for-football-season-opener-vs-western-michigan
- Automated match: HTTP 200; verbatim 1/4; coverage 0.44
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: cited 2025 page carries only the first sentence (coverage 0.44); full text on https://msuspartans.com/sports/2018/9/13/football-tailgating-information

### michigan-state / spartan-stadium-east-lansing-michigan / tailgating.timeWindow (R)

- Stored: All parking locations open at 7 a.m. for games that kick off before 6 p.m., and 11 a.m. for kickoffs at or after 6 p.m.
- Cited (dotted key): https://msuspartans.com/sports/2022/8/24/football-gameday-stadium-services
- Automated match: HTTP 200; verbatim 2/3; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### michigan-state / spartan-stadium-east-lansing-michigan / tailgating.rvPolicy

- Stored: RV parking ($60) is available at Lot 203 (MSU Pavilion) on a first-come, first-served basis.
- Cited (dotted key): https://msuspartans.com/news/2025/8/21/parking-construction-and-stadium-information-for-football-season-opener-vs-western-michigan
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### ohio-state / ohio-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://ohiostatebuckeyes.com/sports/2022/8/17/tailgating
- Automated match: curl blocked; verbatim n/a; coverage n/a
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: page blocks curl; headless DOM

### ohio-state / ohio-stadium / tailgating.rules (R)

- Stored: Vehicles and all tailgate activities/equipment must fit within the 8.5'x15' space provided in surface lots and garages; vehicles larger than the space must purchase an RV permit. There are no in-and-out privileges (one entrance per permit), saving of parking spaces is not permitted, and spaces are first-come, first-served. Tailgate equipment (trailers, tents, porta-johns, food & beverage, etc.) may not occupy vacant spaces, crosswalks, pedestrian thoroughfares, or drive lanes, or interfere with traffic flow. Freestanding signs must be no larger than 4x4 feet; ground-penetrating signs are not allowed without approval; canvassing, solicitation, and product sales are prohibited.
- Cited (dotted key): https://ohiostatebuckeyes.com/sports/2022/8/17/tailgating
- Automated match: curl blocked; verbatim 0/7; coverage 0
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: headless DOM: 8.5' x 15' space, one entrance, no saving spaces

### ohio-state / ohio-stadium / tailgating.timeWindow (R)

- Stored: Tents may be set up no earlier than 5:00pm on the Thursday before a home game in grass areas, and may not be erected inside parking lots until after 5:00am on gameday; all tents must be removed by noon the Sunday after the game. Personal port-a-johns may be delivered no sooner than Thursday 4:00pm. On game day, football parking lots and garages open at 5 a.m.
- Cited (dotted key): https://ohiostatebuckeyes.com/sports/2022/8/17/tailgating
- Automated match: curl blocked; verbatim 0/4; coverage 0
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: headless DOM: Thursday 5:00 pm tent setup

### ohio-state / ohio-stadium / tailgating.grillRules

- Stored: Charcoal grilling is NOT permitted anywhere on the Ohio State campus (including tailgating lots, garages, and grass areas). Liquid propane grills ARE permitted following OSU fire-prevention safety protocols, and must be placed at least 10 feet from any structure. Open burning (fire pits, fire rings, stoves, or chimneys) is not allowed.
- Cited (dotted key): https://ohiostatebuckeyes.com/sports/2022/8/17/tailgating
- Automated match: curl blocked; verbatim 0/3; coverage 0
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: headless DOM: charcoal prohibited

### ohio-state / ohio-stadium / tailgating.rvPolicy

- Stored: RV parking is available in the Gray Lots and Buckeye Lots near the Schottenstein Center and requires an RV permit (generally sold on a season basis, with some single-game permits possibly available). RVs plus tailgate equipment and any towing/towed vehicles must fit within an assigned space of approximately 40'x60'; no in-and-out privileges. RVs must exit the parking facilities no later than 10:00am the Sunday following a game day.
- Cited (dotted key): https://ohiostatebuckeyes.com/sports/2022/8/17/tailgating
- Automated match: curl blocked; verbatim 0/4; coverage 0
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: headless DOM: Gray Lots and Buckeye Lots

### oklahoma-state / boone-pickens-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://okstate.com/sports/2015/3/17/GEN_2014010169
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### oklahoma-state / boone-pickens-stadium / tailgating.rules (R)

- Stored: Tailgating is a cherished tradition and an important part of the game day experience at Oklahoma State University. To ensure a safe, family-friendly atmosphere, tailgating is limited to designated areas on campus; consult Oklahoma State's tailgating maps for publicly available and prohibited areas and tailgating guidelines. Full-service tailgates can be booked through REVELxp.
- Cited (dotted key): https://okstate.com/sports/2015/3/17/GEN_2014010169
- Automated match: HTTP 200; verbatim 1/4; coverage 0.79
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: 2015 page, still maintained; one of four sentences verbatim

### oklahoma-state / boone-pickens-stadium / tailgating.timeWindow (R)

- Stored: POSSE passenger-vehicle parking lots open 8:00 a.m. for Saturday home football games; all RV lots on University property open the evening prior to each home game at 5:30 p.m.
- Cited (dotted key): https://okstate.com/sports/2015/3/17/GEN_2014010169
- Automated match: HTTP 200; verbatim 0/3; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### oklahoma-state / boone-pickens-stadium / tailgating.rvPolicy

- Stored: Reserved POSSE RV parking is in lot #74 (Hall of Fame and Walnut) with a State Ranger permit required, and in lot #81 (McDonald, north of Hall of Fame) with a specific POSSE permit required. Limited parking for visitors and non-POSSE permitted RVs not requiring hook-ups is available at lots #84 and #112 (north of Hall of Fame, east of Willis), about 0.5 mile to the game-day shuttle. All RV lots on University property open at 5:30 p.m. the evening prior to each home game. Additional visitor/non-POSSE RV parking info via visitstillwaterok.org or (800) 991-6717.
- Cited (dotted key): https://okstate.com/sports/2015/3/17/GEN_2014010169
- Automated match: HTTP 200; verbatim 0/5; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### texas-am / kyle-field / tailgating.allowed

- Stored: true
- Cited (dotted key): https://12thman.com/tailgating-in-aggieland
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**

### texas-am / kyle-field / tailgating.rules (R)

- Stored: Tailgating on campus is a privilege governed by general rules plus site-specific rules. Open-access sites (outside 15 ft of parking lots) are first-come, first-served and need no reservation; Aggie Park and West Campus areas use a Virtual Land Rush online reservation system. No overnight occupancy/camping. Tents/canopies must be secured with stakes penetrating no more than 12 inches. Only recreational generators (max 80 decibels) are allowed. Motorized recreational vehicles (golf carts, ATVs, scooters, etc.) are prohibited. Pets must be leashed; livestock is not permitted. Amplified bands/loud music are not permitted. Trash must be bagged and hot coals doused in designated receptacles. Greenspace within 15 ft of a lot is reserved for fans parked in that lot.
- Cited (dotted key): https://12thman.com/tailgating-in-aggieland
- Automated match: HTTP 200; verbatim 0/12; coverage 0.31
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: facts on https://12thman.com/tailgating/rules (privilege; greenspaces within 15 feet) and /tailgating/faq (9 a.m. day-before, no reservation); landing page coverage 0.31

### texas-am / kyle-field / tailgating.timeWindow (R)

- Stored: On game day, tailgating begins at 7:00 AM and all sites must be cleared and cleaned by midnight. Setup on West Campus begins at noon the day before the game; setup in Aggie Park begins at 7:00 AM on game day. No overnight camping.
- Cited (dotted key): https://12thman.com/tailgating-in-aggieland
- Automated match: HTTP 200; verbatim 0/4; coverage 0.38
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: /tailgating/rules: "Tailgating sites open at 7a.m. on gameday and must be cleared and cleaned by midnight", "No overnight occupancy"; noon air horn on /faq

### texas-am / kyle-field / tailgating.grillRules

- Stored: All BBQ grills (propane or otherwise) must be attended at all times; fires built on the ground and open fire pits are prohibited, and all devices must have a cover. Hot coals must be doused and disposed of in designated coal receptacles. In Aggie Park, grills must be propane or electric (no coals or wood) and trailer-mounted grills are not permitted; trailer-mounted grills/smokers are allowed in West Campus/Reed Arena greenspaces.
- Cited (dotted key): https://12thman.com/tailgating-in-aggieland
- Automated match: HTTP 200; verbatim 0/5; coverage 0.19
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: /tailgating/rules: attended grills, ground fires and fire pits prohibited, covers, coal dumpsters; /faq: trailer-mounted grills in greenspaces. Aggie Park propane/electric clause not located

### texas-am / kyle-field / tailgating.rvPolicy

- Stored: Oversized vehicle sites near Lot 95 accommodate buses, vans and trailers used for tailgating that do not meet RV-lot requirements; these spaces are reserved through Transportation Services (979-862-7943). No parking accommodation is provided at these sites — guests must separately purchase a public parking space.
- Cited (dotted key): https://12thman.com/tailgating-in-aggieland
- Automated match: HTTP 200; verbatim 0/3; coverage 0.17
- Tier: NOT-FOUND
- Sub-key verdict: **not-found**
- Note: Lot 95 oversized sites, 979-862-7943, "separately purchase a public parking space" on none of landing, /rules, /faq; transport.tamu.edu not checked

### tulane / yulman-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://tulanegreenwave.com/sports/2019/7/29/tailgating-2019
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### tulane / yulman-stadium / tailgating.rules (R)

- Stored: The Berger Family Lawn is the only tailgating location for the 2025 season. Two options: tailgate on your own (free, first come first served) or full-service tailgating packages via Event Services at Tulane (Parish $350, Main Event $750, Krewe $1350, Lagniappe $2500, Beaucoup $4500). Tents may not exceed 10'x10' (larger tents require City of New Orleans permits and must be rented from the university's authorized vendor); tents may not be staked and must be anchored with sandbags/weights, may not block sidewalks/travel lanes/fire lanes, and must be taken down before departing for the game. No tailgating at vehicles or truck beds within Tailgate Village. Beer and wine permitted on campus; NO common containers (kegs, party balls), NO glass bottles/containers. No personal amplified sound on the Berger Family Lawn. Groups must clean and bag/sort all trash before entering the stadium. Portable generators permitted but discouraged (must be under 60 dBA).
- Cited (dotted key): https://tulanegreenwave.com/sports/2019/7/29/tailgating-2019
- Automated match: HTTP 200; verbatim 0/10; coverage 0.77
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: stale 2025 capture; live page rewritten for 2026 (section 4)

### tulane / yulman-stadium / tailgating.timeWindow (R)

- Stored: Tailgating begins four hours before kickoff and ends 30 minutes before kickoff; no tailgating during the game. Weeknight games have different hours. Designated roads onto campus open eight hours prior to kickoff and close five hours prior; campus re-opens ~90 minutes after the game ends.
- Cited (dotted key): https://tulanegreenwave.com/sports/2019/7/29/tailgating-2019
- Automated match: HTTP 200; verbatim 1/5; coverage 0.69
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: live page: starts 4 hours before kickoff, ends 30 minutes before, none during the game

### tulane / yulman-stadium / tailgating.grillRules

- Stored: Grilling with charcoal and propane is permitted on the Berger Family Lawn tailgate area. All grills must be elevated. Cookers/grills on trailers are not allowed and no cooker/grill may be larger than 36 inches in diameter or 36 inches in length. Grills may not be placed in travel lanes, parking spaces, inside buildings, or under tents. Extinguish all fires and dispose of charcoal in the designated receptacles.
- Cited (dotted key): https://tulanegreenwave.com/sports/2019/7/29/tailgating-2019
- Automated match: HTTP 200; verbatim 0/5; coverage 0.75
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### tulane / yulman-stadium / tailgating.rvPolicy

- Stored: For RV access questions, call the Tulane Ticket Office at (504) 861-WAVE. Per New Orleans city ordinance Sec. 154-1037, vehicles equipped with living accommodations over 22 feet in length may not park on any street between 7 p.m. and 7 a.m.
- Cited (dotted key): https://tulanegreenwave.com/sports/2020/9/25/gameday-central-20201
- Automated match: HTTP 200; verbatim 0/3; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**
- Note: 2020 gameday central page

### ucla / rose-bowl-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://uclabruins.com/tailgating
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### ucla / rose-bowl-stadium / tailgating.rules (R)

- Stored: No in-and-out privileges for vehicles. Parking is first come, first served; no saving of spaces (groups should caravan in together). Guests must tailgate only in front of or behind their vehicle. Tents 10'x10' or smaller may be pitched in front of or behind the vehicle, and tent setup is only allowed in grass lots. Roadways, aisles and parking areas must be kept clear for vehicles and emergency personnel. No selling of items or soliciting/marketing. No box trucks, trailers, grill-in-tow, or outside catering services in parking lots. No glass containers. No consumption of alcohol in tailgating areas after kickoff. No drinking games or alcohol-related paraphernalia (e.g., beer bongs, beer pong). No amplified music and no music with inappropriate language. Report problems by texting (626) 400-5119.
- Cited (dotted key): https://uclabruins.com/tailgating
- Automated match: HTTP 200; verbatim 0/12; coverage 0.93
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: page refreshed for 2026

### ucla / rose-bowl-stadium / tailgating.timeWindow (R)

- Stored: All parking lots open 6 hours prior to game time and close 90 minutes following the conclusion of the game.
- Cited (dotted key): https://uclabruins.com/tailgating
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### ucla / rose-bowl-stadium / tailgating.grillRules

- Stored: No open flames permitted in any tailgate or parking area. No charcoal grills in the RV parking area (West Drive). All barbecue grills must be raised off the ground. Dispose of charcoal in designated bins. Charcoal grills are permitted in most tailgate areas.
- Cited (dotted key): https://uclabruins.com/tailgating
- Automated match: HTTP 200; verbatim 2/5; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### ucla / rose-bowl-stadium / tailgating.rvPolicy

- Stored: RV / oversized-vehicle parking is located on West Drive and all RV/oversized vehicles must enter from the west side of the bowl; RV parking is $128 in advance and $154 day of. No overnight RV parking is available.
- Cited (dotted key): https://uclabruins.com/gameday-information
- Automated match: HTTP 200; verbatim 1/3; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**

### wake-forest / allegacy-federal-credit-union-stadium / tailgating.allowed

- Stored: true
- Cited (dotted key): https://godeacs.com/sports/2018/7/27/gameday
- Automated match: HTTP 200; verbatim n/a; coverage n/a
- Tier: IMPLIED
- Sub-key verdict: **confirmed**

### wake-forest / allegacy-federal-credit-union-stadium / tailgating.rules (R)

- Stored: Tailgating is only permitted in parking spaces you have purchased; to occupy more than one space you must purchase the extra spaces and show the same number of parking passes as spaces occupied. Kegs are permitted. No glass containers. No tents in parking spaces unless an additional pass is purchased; spiking/staking tents is prohibited. No music amplifiers, subwoofers or bass systems (Athletics may require excessive speakers be turned down/off/removed). Gasoline-powered generators are prohibited. Persons providing alcohol are responsible for preventing excessive/underage consumption.
- Cited (dotted key): https://godeacs.com/sports/2018/7/27/gameday
- Automated match: HTTP 200; verbatim 0/7; coverage 0.89
- Tier: SUBSTANCE (read)
- Sub-key verdict: **confirmed**
- Note: 2018 URL, page maintained as the current gameday guide

### wake-forest / allegacy-federal-credit-union-stadium / tailgating.grillRules

- Stored: Only propane grills may be used; charcoal grills are prohibited. Open flames (except propane grills) are prohibited.
- Cited (dotted key): https://godeacs.com/sports/2018/7/27/gameday
- Automated match: HTTP 200; verbatim 0/3; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### wake-forest / allegacy-federal-credit-union-stadium / tailgating.rvPolicy

- Stored: All buses and RVs are charged for three (3) spaces at the game rate and are given three (3) ticket stubs.
- Cited (dotted key): https://godeacs.com/sports/2018/7/27/gameday
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**

### appalachian-state / kidd-brewer-stadium / officialParkingUrls (R)

- Stored: https://mountaineersathleticfund.com/yosef-club/renewals/index.html
- Cited (dotted key): (none stored)
- Official source found: https://appstatesports.com/news/2025/9/4/2025-app-state-football-fan-guide.aspx (links the stored URL verbatim)
- Automated match: candidate (no stored source)
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: stored link returns 403; live alternate on the same fund site (section 4)

### pittsburgh / acrisure-stadium / officialParkingUrls (R)

- Stored: https://acrisurestadium.com/stadium/parking-directions/
- Cited (dotted key): (none stored)
- Official source found: the stored URLs themselves (both 200)
- Automated match: candidate (no stored source)
- Tier: VERBATIM (link)
- Sub-key verdict: **confirmed**
- Note: both links live; stadium operator and ALCO Parking

### pittsburgh / acrisure-stadium / officialParkingUrls (R)

- Stored: https://alcoparking.com/acrisure-stadium-pnc-park/
- Cited (dotted key): (none stored)
- Official source found: the stored URLs themselves (both 200)
- Automated match: candidate (no stored source)
- Tier: VERBATIM (link)
- Sub-key verdict: **confirmed**
- Note: both links live; stadium operator and ALCO Parking

### maryland / secu-stadium / publicTransit.notes (R)

- Stored: Quickbus is Shuttle-UM's free service that transports fans from their parking lot to Maryland Stadium. It runs three hours prior to kickoff until 30 minutes after kickoff, and again from halftime until one hour after the final whistle. Buses are a mixture of ADA accessible and non-ADA vehicles, with paratransit service available.
- Cited (dotted key): https://umterps.com/sports/2023/6/30/football-parking
- Automated match: HTTP 200; verbatim 0/3; coverage 0.96
- Tier: CONFLICT
- Sub-key verdict: **conflicting**
- Note: stored text fully on the cited 2026 athletics page; DOTS operator page states a continuous window with no mid-game gap (section 4)

### maryland / secu-stadium / publicTransit.lines (R)

- Stored: Quickbus (Shuttle-UM free gameday shuttle)
- Cited (dotted key): https://umterps.com/sports/2023/6/30/football-parking
- Automated match: HTTP 200; verbatim 0/1; coverage 1
- Tier: SUBSTANCE (auto)*
- Sub-key verdict: **confirmed**
- Note: consistent with both pages

### boise-state / albertsons-stadium / gatesOpen.ruleText (R)

- Stored: For Boise State football games, all gates, including Stueckle Sky Center and regular admission gates, will open two (2) hours prior to kickoff.
- Cited (dotted key): (none stored)
- Official source found: https://broncosports.com/sports/2025/8/12/albertsons-stadium-fan-guide
- Automated match: candidate (no stored source)
- Tier: VERBATIM
- Sub-key verdict: **confirmed**
- Note: no source stored today

### michigan-state / spartan-stadium-east-lansing-michigan / gatesOpen.ruleText (R)

- Stored: Spartan Stadium gates open 1.5 hours prior to kickoff. Suites, MSUFCU Club, and Student entrance open 2 hours prior to kickoff.
- Cited (dotted key): https://msuspartans.com/sports/2022/8/24/football-gameday-stadium-services
- Automated match: HTTP 200; verbatim 2/2; coverage 1
- Tier: VERBATIM
- Sub-key verdict: **confirmed**
- Note: already sourced on the tenant overlay under gatesOpen.ruleText; also in substance on https://msuspartans.com/feature/football-gameday

### wake-forest / allegacy-federal-credit-union-stadium / gatesOpen.ruleText (R)

- Stored: Gates open 90 minutes prior to kickoff, McCreary Tower and Bridger Field House open 2 hours prior to kickoff.
- Cited (dotted key): (none stored)
- Official source found: https://godeacs.com/sports/2018/7/27/gameday
- Automated match: candidate (no stored source)
- Tier: VERBATIM
- Sub-key verdict: **confirmed**
- Note: no source stored today


## 8. Sub-minimum schools

The condensed block needs three sourced fields; these four hubs sit below it and render link-only. What each hub holds today, what it lacks, and whether official pages carry the missing fields (all URLs fetched 2026-08-27 with a browser UA and re-verified by a second agent; excerpts matched against served text).

### Appalachian State, kidd-brewer-stadium (`verified: true`)

Holds: `clearBagRequired`, `bagMaxDimensions` 12x6x12, `venueAccessRestrictions` (all sourced to the 2025 fan guide), `officialParkingUrls` (dead, section 4), `pdfSources` FootballMap23.pdf (returns a Sidearm HTML shell, not a PDF). Missing: gates, parking lots and lot map, transit, tailgating, rideshare, accessibility, bag policy URL, bag notes, outside food, concessions, neighborhood.

Verdict: **UNEXTRACTED** for gates, parking lots, lot map, transit, tailgating, accessibility, bag policy URL, bag notes, outside food, concessions. **UNAVAILABLE** for rideshare and neighborhood.

- `https://appstatesports.com/news/2025/9/4/2025-app-state-football-fan-guide.aspx` (A-to-Z fan guide, still the guide linked from the global nav; no 2026 guide exists as of 2026-08-27): gates ("gates will open two hours before kickoff"; five named entrances with walk-through metal detectors), tailgating (Yosef Club lots open 8 a.m. for 2:30/3:30 kickoffs; malt beverages and unfortified wine in designated locations; no liquor, kegs, glass), parking (single-game $50 at the Watauga County deck, 140 N. Water Street; free Levine College of Health Sciences lot, 75 spaces, with AppalCART to campus), transit (AppalCART shuttle from Hill Street ADA parking), accessibility (ticket office 828-262-7733; customer service booths outside the North End Zone), outside food (none; one unopened water bottle), concessions (cash and card, beer $10 to $14), clear bag.
- `https://appstatesports.com/news/2017/5/30/app-state-athletics-institutes-clear-bag-policy.aspx`: the page the nav and the facility page link as the clear bag policy (bag policy URL, bag notes).
- `https://mountaineersathleticfund.com/yosef-club/index.html#season-tickets-parking`: 2026 lot map (lots A through R with prices), parking request form; wheelchair icon on the Hill Street lot.
- `https://parking.appstate.edu/event-football-parking/home-football-game-days` and `https://parking.appstate.edu/about/accessible-parking` (campus parking office): student lots, game-day permit restrictions from 7 a.m., disability parking in the Hill Street lot with a direct AppalCART shuttle.
- `https://www.appalcart.com/game-day-routes` (Boone transit authority, linked by both athletics and campus parking): four extra routes from four hours before kickoff to two hours after; paratransit shuttles between the stadium and the Hill Street lots.
- Rideshare: no drop-off text on any official page. Neighborhood: official pages give only the address and a traffic-flow paragraph; the fan guide hands off to exploreboone.com (tourism org, not usable).

### Army, michie-stadium (`verified: false`, `sources: {}`)

Holds: nothing (every logistics field null; verifyNotes "athletics source too thin (access-restricted academy / sparse site)"). Missing: everything.

Verdict: **UNEXTRACTED** for parking, transit, tailgating, accessibility, bag policy, outside food, gates. **PARTIAL** for concessions (the operator page is image-only). **UNAVAILABLE** for rideshare and neighborhood. The "too thin" note is wrong about the operator layer: the Army West Point Athletic Association runs `armygameday.com` (footer attribution; live nav links from goarmywestpoint.com) and it is text-rich.

- `https://www.armygameday.com/parking` (parking, tailgating, accessibility, transit, gates) and `https://www.armygameday.com/direction` (directions, cab guidance; no Uber/Lyft zone).
- `https://goarmywestpoint.com/news/2026/8/25/athletics-michie-stadium-preserved-by-usaa-to-implement-clear-bag-policy-enhanced-security-screening-for-ticketed-events` (dated 2026-08-25: clear bag policy, screening, outside food, gates, concessions) and `https://www.armygameday.com/bagpolicy`.
- `https://goarmywestpoint.com/news/2016/6/15/game-day-tailgating` (tailgating rules), `https://goarmywestpoint.com/news/2015/7/20/gameday_0720152116` (accessible parking, shuttles; pricing stale), `https://goarmywestpoint.com/news/2010/8/1/Security` (gates; bag rules superseded by the 2026 article).
- `https://westpoint.edu/gateway-for-visitors` and the westpoint.edu force-protection alert (gates, parking, accessibility, vehicle access rules).
- `https://westpointpremium.com/tailgates` (AWPAA hospitality: paid tailgates, shuttle).
- Caveat: the 2026-02-24 section renumbering and the 2026 clear-bag change mean the 2010/2015/2016 pages are partly superseded; a harvest should prefer armygameday.com and the 2026-08-25 article.

### Kansas, david-booth-kansas-memorial-stadium (`verified: true`)

Holds: bag notes and access restrictions (sourced to the prohibited-items page), tailgating (all sub-keys, dotted sources; rules conflicting, section 4), `officialParkingUrls` `https://parking.ku.edu/parking-lots` with source `https://kuathletics.com` (a root URL, not a citation). Missing: gates, parking lots and lot map, transit, rideshare, accessibility, bag dimensions, clear-bag flag, bag policy URL, outside food, concessions, neighborhood.

Verdict: **UNEXTRACTED** for gates, parking lots and lot map, rideshare, accessibility, bag dimensions, clear-bag flag, bag policy URL, outside food, concessions. **UNAVAILABLE** for neighborhood. **PARTIAL** for transit (KU publishes only its own game shuttles and a garage footer "Bus Routes: 8, 38, 42"; city service to the stadium is published by Lawrence Transit, whose latest post is the 2025 season).

- `https://kuathletics.com/feature/the-booth` (the 2026 football fan guide; `/sports/2024/4/9/football-fan-guide` redirects here): gates ("Gate 13 ... which will open two hours prior to kickoff"), lots and 2026-06-24 gate and tailgating map PDFs, rideshare, accessibility, bag dimensions, clear-bag flag, outside food, concessions, gameday zones on 11th Street and The Hill.
- `https://parking.ku.edu/football-game-day` (campus parking office): lots, accessible parking, KU shuttles; its "Game Day Parking Map" image is a 2025 asset that 404s.
- `https://kuathletics.com/sports/2024/4/9/the-accessible-jayhawk-fan-experience` (accessibility, accessible drop-off).
- `https://kuathletics.com/documents/2024/11/1/Clear_Bag_Policy.pdf` (12x6x12 in the rendered graphic; 6x9 clutch as text; the PDF's own footer URL 404s).
- `https://lawrencetransit.org/catch-the-bus-to-ku-football-games/` (transit operator, 2025 season only).

### Oregon, autzen-stadium (`verified: false`, anchor school)

Holds: `clearBagRequired`, `bagMaxDimensions` 12x6x12, `bagPolicyNotes`, `bagPolicyUrl`, `outsideFoodAllowed`, `outsideFoodRules`, all sourced to `goducks.com/sports/2018/7/2/clear-bag-policy`; verifyNotes "HELD verified=false: facts sourced from a prior-season dated Sidearm article (2018); re-sweep when the 2026 gameday guide publishes". Missing: gates, parking lots and lot map, official parking links, transit, tailgating, rideshare, accessibility, concessions, neighborhood.

Verdict: **UNEXTRACTED** for eight of nine: gates, parking lots and lot map, official parking, transit, tailgating, accessibility, concessions, neighborhood. **UNAVAILABLE** for a football rideshare zone (the only official mention is the 2026-07-20 Zach Bryan concert Know Before You Go page, which names a drop-off near the Eugene Science Center across from the South Gate; concert-only, not usable for football). The 2026 gameday guide the verifyNotes wait for has published: `goducks.com/feature/gameday26`.

- `https://goducks.com/sports/2011/6/21/205174790` (the official Autzen Stadium page, About / Gameday Info): gates, lots and lot map links, official parking, transit, tailgating, accessibility, concessions, neighborhood.
- `https://goducks.com/feature/gameday26` ("2026 Oregon Football Game Day"): gates, official parking, transit, concessions, parking map; links the clear-bag handout (byte-identical to the 2018 file; metadata dated 2018-08-21).
- `https://goducks.com/sports/2025/9/5/game-day-parking`: official parking, tailgating, accessibility, lot map; single-game parking sells through ticketmaster.com.
- `https://goducks.com/documents/download/2025/8/18/autzen_tailgate_parking_25.pdf` (2025 gameday map: lots, gates, tailgate areas) and `.../2023/9/14/Autzen_Parking_Lot_and_Traffic_Maps_2023_-_Combined.pdf` (four-page lot and traffic maps; lot names HDC, MO, East Lot, PK Park, RVA/RVB/RVC, ADA are extractable text). The gameday26 "Parking Map" PDF is a raster with no text.

## 9. What a write pass would touch, by verdict class (inventory only)

- 16 confirmed fields (12 tailgating, Michigan State gates, Wake Forest gates, Boise State gates, Pittsburgh parking). Of these, the 12 tailgating hubs and Michigan State gates already carry the source under a dotted key; the write is a flat alias or a renderer change, not new provenance. Boise State gates, Wake Forest gates, and Pittsburgh parking need a new source URL written (overlay `sources.gatesOpen` for the two gates, `sources.officialParkingUrls` for Pittsburgh).
- 1 partial (Texas A&M): three sub-keys confirmed, `rvPolicy` not found; `rvPolicy` does not render on the school page.
- 6 conflicting fields: nothing to write under the stated rule; the stored text stays, the flat source stays absent, and the field stays silent on the school page. Note that on the venue page these fields render today regardless.
- Section 8 of the wiring check needs a one-paragraph amendment about the dotted keys.
- Four sub-minimum hubs: a separate extraction task with the URLs in section 8, not part of this sourcing write.

Stop. No writes were made on this pass.

## 10. Pass 1 (renderer sub-key fix), before and after, 2026-08-27

Code only, zero Firestore writes. `src/lib/venue-hub-condensed.ts` now treats a sub-field as sourced when its own dotted key OR its field's flat key is present, and carries two explicit exclusion lists: `CONDENSED_CONFLICTS` (brooks-stadium, david-booth-kansas-memorial-stadium, hard-rock-stadium, yulman-stadium tailgating; kidd-brewer-stadium parking) and `CONDENSED_HOLDS` (secu-stadium transit: stale, not disputed; DOTS is authoritative; corrected and re-sourced in Pass 2, entry deleted with that write). The block still renders only the rules and timeWindow sentences for tailgating and notes plus lines for transit; grillRules and rvPolicy remain venue-page depth, so Texas A&M's unconfirmed rvPolicy needs no entry.

Measured by running the HEAD renderer and the new renderer over the 2026-08-27 read-only dump for all 86 CFB school/hub pairs:

| School | Hub | Lines before | Lines after | Gained |
| --- | --- | --- | --- | --- |
| alabama | saban-field-at-bryant-denny-stadium | 8 | 9 | tailgating |
| colorado | folsom-field | 6 | 7 | tailgating |
| georgia | sanford-stadium | 8 | 9 | tailgating |
| indiana | memorial-stadium-indiana-university | 3 | 4 | tailgating |
| kansas-state | bill-snyder-family-football-stadium | 5 | 6 | tailgating |
| maryland | secu-stadium | 6 | 7 | tailgating (transit held) |
| memphis | simmons-bank-liberty-stadium | 8 | 9 | tailgating |
| michigan-state | spartan-stadium-east-lansing-michigan | 5 | 7 | gates, tailgating |
| ohio-state | ohio-stadium | 7 | 8 | tailgating |
| oklahoma-state | boone-pickens-stadium | 7 | 8 | tailgating |
| texas-am | kyle-field | 8 | 9 | tailgating |
| ucla | rose-bowl-stadium | 8 | 9 | tailgating |
| wake-forest | allegacy-federal-credit-union-stadium | 6 | 7 | tailgating |

Unchanged by design: coastal-carolina (4), kansas (2), miami (5), tulane (6), appalachian-state (1) on the conflicts list; maryland transit on hold (section 4 ruling). The App State entry is at sub-field grain (`sub: 'officialParkingUrls'`): only the dead link is withheld, so lots or a lot map written with their own sources in Pass 2 render without touching the list. The other four conflict entries withhold the whole tailgating line even though only the rules sub-key conflicts, on purpose: the line reads as one statement. Boise State and Wake Forest gates stay silent until a source is written (truly unsourced, section 5). No school lost a line.

Above / below the three-line minimum: 82 / 4 before, 82 / 4 after. Kansas stays below (bag, parking) because its tailgating line is on the conflicts list; the other three below are appalachian-state (bag), army (none), oregon (bag, outsideFood), the sub-minimum set of section 8.
## 11. Stale-transit sweep, read-only, 2026-08-27

Reporting pass only, per the Pass 2 brief: no fix, no Firestore write, no data change. Every venueHubs doc carrying a populated `publicTransit` field was swept: the stored source's evident date against the current season, and every named line, route and shuttle against the operator's own site. 131 hubs of the 131 with a transit field. Each hub that raised a concern was then handed to a second agent that re-established the answer independently, preferring the operator over any encyclopedia; the verdicts below are the second agent's.

Current season means 2026 for MLB, MLS, WNBA, NFL and CFB hubs, and 2025-26 for NBA and NHL. A hub is stale-dated when its source page's most specific evident date falls before that season.

### Headline

- **39 hubs cite a transit source that predates the current season**, and 37 more carry a source whose date could not be established at all (a copyright year is not a date). Only 55 are demonstrably current.
- **84 hubs raised at least one concern.** After independent verification: 11 carry a service that is **discontinued**, 49 carry one that is **renamed, rerouted or unconfirmed for this season**, 20 came back fully intact, 4 could not be settled either way.
- **Northstar does not appear anywhere in our transit data.** Target Field stores METRO Blue Line, METRO Green Line and Metro Transit bus, sourced to a 2026-dated MLB page, and the sweep confirmed all three against Metro Transit. The known case is real in the world and absent from the record, so it cost us nothing here. That is luck, not a control: nothing in the pipeline would have caught it.
- The oldest source still in service is **Levi's Stadium, a Super Bowl 50 guide from February 2016**, whose own text says the shuttles it describes do not run for regular-season games.

### Discontinued services (verified)

These hubs name a service a fan cannot use. Each was confirmed against the operator, not merely suspected.

| Hub | League | Source date | The service that does not run |
| --- | --- | --- | --- |
| audi-field (Audi Field) | MLS | 2026 | All three flags confirmed against WMATA's own site (fetched live 2026-08-27). METROBUS 74: discontinued. WMATA's live timetable roster (/ride/maps.html) lists 117 current routes and contains ZERO bare-numeric routes — no "74", no "70", no "71". WMATA's Better Bus page states the naming rule explicitly ("Routes begin w… |
| bmo-field (BMO Field) | MLS | unknown | Checked all three flagged services against the operators' own sites on 2026-08-27; no repo or Firestore writes, scratch only under scratchpad/transit/. 1) TTC 509/511 REPLACEMENT BUS — DISCONTINUED. TTC's own notice (ttc.ca/riding-the-ttc/Updates/509-and-511-Bathurst-impacted-Bathurst-and-Fleet-streets-intersection-co… |
| husky-stadium (Husky Stadium) | CFB | 2018-06-23 | Independently verified both flagged services against operator sources; the two flags do not resolve the same way. 1) King County Metro bus (park-and-ride buses) — DISCONTINUED IN PART, flag upheld. The UW athletics 2026 news page (URL-path evident date 2026/8/25) states: "UW's South Kirkland, Eastgate and Redondo Heig… |
| levis-stadium (Levi's Stadium) | NFL | 2016-02-06 | Both flagged items check out; verdict is driven by the source page. SOURCE PAGE — flag CONFIRMED, and the service it documents does not run. https://levisstadium.com/super-bowl-50/a-z-gameday-guide/ returns 200 but is the Super Bowl 50 (Feb 7, 2016) gameday guide: its own meta stamps read datePublished 2016-01-25T22:2… |
| los-angeles-memorial-coliseum (Los Angeles Memorial Coliseum) | CFB | 2018-08-14 | All four sweep flags are confirmed against operator-owned pages fetched today (2026-08-27). Verdict is "no" because one flagged item is discontinued outright, not merely renamed. 1) Metro Expo Line — CHANGED (renamed, still running). LA Metro's own venue page for this hub, https://www.metro.net/destinations/la-coliseu… |
| mountain-america-stadium (Mountain America Stadium) | CFB | unknown | CONFIRMED — the sweep agent's flag is correct, and I established it from the operator's own site rather than the Wikipedia page it cited (curl and WebFetch both hit Valley Metro's 403 WAF; I reached valleymetro.org through a text proxy, and separately pulled Valley Metro's own timetable PDF direct from its CDN at HTTP… |
| stanford-stadium (Stanford Stadium) | CFB | 2026-08 | Flagged service "Caltrain game-day stops at Stanford (Stanford Stadium) station": DISCONTINUED for the 2026 season, confirmed from the operator's own site. Caltrain's dated event page for Stanford vs Hawaii (Sat, Aug 29, 2026, Stanford Stadium) states: "Caltrain will operate regular service for Stanford football games… |
| dodger-stadium (Dodger Stadium) | MLB | 2026 | Independently verified all five flagged services against LA Metro's own site (curl, Chrome UA, 2026-08-27). Verdict "no" because one entry names a line that no longer exists and another no longer serves the stop the hub gives it. 1) Metro Rail Gold Line (via Union Station) — CONFIRMED DISCONTINUED. Metro's current ros… |
| gerald-j-ford-stadium (Gerald J. Ford Stadium) | CFB | 2026-06-15 | Verified each flagged service against the operator's own site (DART) and the school's current-season page; scratch only, no repo/Firestore writes. 1) DART Red Line at SMU/Mockingbird Station — DISCONTINUED ON WEEKENDS. Confirmed independently at DART's service-change page, Rail Lines section, Red Line entry: "Starting… |
| loandepot-park (loanDepot Park) | MLB | 2024-04-24 | Verified independently against Miami-Dade DTPW's own data, not Wikipedia: the live roster behind the agency's bus/trolley routes page (its component calls /apps/dtpw/transitapps/api/bus/routes?routeID=0&track=YES, returning 118 bus/trolley routes), the live station list behind the agency's Metrorail stations page (/ap… |
| providence-park (Providence Park) | MLS | 2026-08-12 | Fetched 2026-08-27 with a Chrome UA. All four flags confirmed against the operator; one is a hard discontinuation, so the hub verdict is "no". 1) 58-Canyon Rd — DISCONTINUED. CONFIRMED. TriMet's own route page (https://trimet.org/schedules/r058.htm, HTTP 200) reads verbatim: "This route is discontinued with replacemen… |

### Renamed, rerouted, or unconfirmed for this season (verified)

The service runs, but the hub names it wrongly or cannot be confirmed for the current season. A rider searching the stored name may not find it.

| Hub | League | Source date | Concern |
| --- | --- | --- | --- |
| acrisure-stadium | NFL/CFB | 2025-11-14 | Port Authority 'T' light rail (LRT): Operator renamed: the agency has been Pittsburgh Regional Transit (PRT) since June 2022; both the source page and the hub line still say 'Port Authority'. Service itself to Allegheny and North Side stations is running (2026 cut proposal averted for two years). |
| albertsons-stadium | CFB | 2023-11-11 | Downtown Bronco Shuttle: Renamed and rerouted. The 20-minute, 7-stop 'Downtown Bronco Shuttle' in the hub notes is the 2023 VRT pilot, which VRT discontinued after that season; it returned in 2025 as VRT's 'Game Day Bus' with 13 stops every ~15 minutes, and VRT's page (updated 2026-07-27) confirms i |
| alumni-stadium | CFB | 2025-08-27 | Green Line B / C / D: BC's Sept 19 home game vs Maine falls on the MBTA's Sept 19-20 Green Line suspension: no trains between North Station and Babcock St (B) or Kenmore (C, D). B trains still serve Boston College west of Babcock and C/D still run west of Kenmore, but riders from downtown must use s |
| amon-g-carter-stadium | CFB | 2020-06-01 | Free remote-lot shuttle (Saint Stephen's Presbyterian Church lot): TCU's 2026-season parking page says the St. Stephen's shuttle will not run for the Sept 12, Nov 14 and Nov 21 home games; the hub presents it as available every game. Free remote-lot shuttle (Hyatt Place Fort Worth/TCU): The hub list |
| arrowhead-stadium | NFL | unknown | RideKC 47 Broadway: Renamed: RideKC's roster no longer has a '47 Broadway'; the route is '47 - Martin Luther King Jr.' and still stops on Blue Ridge Cutoff at the Truman Sports Complex. Both the stadium's page and the hub line use the retired name. |
| bank-of-america-stadium | MLS/NFL | unknown | Source page (panthers.com/traffic-parking): Dead source: 404. Content moved to /schedule/traffic-parking; hub source URL should be repointed. |
| barclays-center | NBA/WNBA | unknown | B41 / B45 bus: Flatbush Avenue reconstruction (center bus lanes) is under way through fall 2026 with temporary stop relocations and reroutes at Flatbush & Atlantic, right at the arena; stop locations in the hub notes may not match on match days. Separately, the pending Brooklyn Bus Network Redesign |
| boone-pickens-stadium | CFB | 2025 | Downtown Stillwater stadium shuttle: Hours differ from the operator-side 2026 description: hub says 2 hours before kickoff and continuous through postgame; Visit Stillwater says 3 hours before, pauses 30 minutes after kickoff, resumes in the 3rd quarter, minimum 30 minutes postgame. ADA shuttle (Mon |
| camp-randall-stadium | CFB | 2025-04-21 | Bucky Shuttle (GO Riteway): Not confirmed for 2026. Every UW page found still carries 2024-season pricing text ('for each game of the 2024 season'); the evenue pass page (uwbadgers.evenue.net/events/BSB, last titled '2025 Football \| Bucky Shuttle Bus Passes') now 404s and no 2026 announcement was fo |
| carter-finley-stadium | CFB | 2017 | Wolfpack Express game-day shuttle: Hub describes a 2017-era lot shuttle (Westchase, Practice Field, Trinity/TX, IPF, Stadium West stops; all drop-offs/pick-ups at Gate 11). NC State's 2026 stadium guide now frames Wolfpack Express as four roaming golf carts for fans needing assistance (IPF lots, eas |
| casino-del-sol-stadium | CFB | 2022-08-30 | Source page (A-Z Fan Guide): Stored source URL redirects to a broken double-encoded path that renders an empty '@title' template with no guide content; the hub's transit facts can no longer be re-verified against it. Replace with the 2026 stadium page. |
| citizens-bank-park | MLB | 2026-01-01 | SEPTA Bus Route 17: As of SEPTA New Bus Network Phase 1 (effective 2026-08-23) Route 17 is truncated to 20th-Johnston and no longer serves NRG Station, Packer Park or the Navy Yard; the Phillies source page and the hub still list Route 17 as a way to reach the park. Route 45 now covers Broad-Pattiso |
| coca-cola-coliseum | WNBA | unknown | TTC 509 Harbourfront / 511 Bathurst replacement bus: The hub note (and the venue source) route riders onto a '509/511 replacement bus toward Lake Shore and Bathurst'. That was the 2025 Bathurst/Fleet construction arrangement; as of August 2026 both 509 and 511 streetcars run through to Exhibition Lo |
| crypto-com-arena | NHL/NBA/WNBA | unknown | DASH Route F: Southbound direction on detour Aug 5 to Nov 5, 2026 (6 a.m. to 5 p.m.) due to construction; Figueroa stops adjacent to L.A. LIVE may be affected during that window. Service continues daily. |
| darrell-k-royal-texas-memorial-stadium | CFB | 2022-03-22 | MetroRail Route 18: Mislabel carried from the 2022 source: CapMetro's rail service is Route 550 (Red Line); Route 18 is a bus route. Rail game-day service for UT football is not confirmed on CapMetro's current gameday page, and Red Line Saturday service starts at 10 a.m. with no Sunday hours listed, |
| davis-wade-stadium | CFB | 2019-01-01 | Old Main SMART Route: No current SMART route carries this name; the Avenue of Patriots/Whitfield/Greensboro/Downtown/Midtown to Old Main pattern is now the Starkville Central route. The hub's name is the 2019-era designation. Hwy 12 SMART Route: No current SMART route carries this name; Walmart/Krog |
| donald-w-reynolds-razorback-stadium | CFB | 2023-08-24 | Silver Route / Gold Route game-day shuttles: Route names, pickup points and Gate 1/10/16 drop-offs come from a 2022 fan guide (modified 2023-08-24) and a shuttle page last modified 2017-09-25; the two official pages disagree on drop-off gates, and no 2026-dated official page confirms the Silver/Gold |
| empower-field | NFL | 2025-10-27 | RTD D Line (transfer to E): Suspended since 2026-06-07 for the Downtown Rail Reconstruction Project and proposed for permanent discontinuation effective 2026-09-27; the reinstated C Line (Littleton-Mineral to Union Station) replaces it. Not running for the 2026 NFL season. RTD H Line (transfer to E) |
| everbank-stadium | NFL | 2026 | JTA Gameday Xpress: Service runs for 2026, but the hub notes' drop-off detail is stale: neither the cited source nor JTA's 2026 page mentions Lot Z, Parker St, or Lot C / Connexion drop-offs (the A-Z page now says Lot B for everyone; JTA says one lot adjacent to the East gates), and JTB Park-n-Ride |
| exploria-stadium | MLS | unknown | Source URL: The stored source URL no longer resolves: it 301-redirects to a malformed doubled-slash path on intercostadium.com that returns 403. The page exists at https://intercostadium.com/arrival. Lymmo: LYMMO was cut back effective 2026-01-11. Only the Grapefruit Line (Link 62) still serves Inte |
| great-american-ball-park | MLB | unknown | Cincinnati Bell Connector (streetcar): Renamed: the operator now calls it 'The Connector' (Cincinnati Bell rebranded to altafiber in March 2022 and the 'Cincinnati Bell' prefix was dropped). The Reds' own transportation page still uses the old name, which is where the hub label came from; the line l |
| hard-rock-stadium | NFL/CFB | 2024-09-03 | Brightline (Aventura Station round-trip shuttle): Stadium-side shuttle stop moved: hub notes say the return shuttle boards at the Lot 18 pedestrian bridge; the current stadium FAQ and Brightline's 2026 page put the Brightline shuttle pick-up/drop-off on the South side at NW 199th St near the Gate 3 |
| huntington-bank-field | NFL | unknown | GCRTA Waterfront Line: Not regular service: since 2025-12-07 the Waterfront Line runs only on Browns home-game dates and select major events (Tower City East Portals project, until further notice). The hub's game-day description is still accurate, but listing it as a line alongside Blue/Green implie |
| jones-stadium | CFB | 2026-07-15 | Citibus Park & Ride (gameday shuttle): Hub notes name pickup lots north of John Walker Soccer Complex (Texas Tech Pkwy & 10th) and an ADA lot NW of HSC, with drop-off at the Gate 3-4 area; the 2026 Citibus page lists four lots (USA Red Park & Pay, S1 Park & Pay, North HSC, North HSC ADA) and drop-of |
| kauffman-stadium | MLB | 2026-01-01 | 47 Broadway (RideKC bus): Route has been renamed '47 Martin Luther King Jr.' on ridekc.org; it still serves the stadium area daily, but the hub line label and the Royals guide use the legacy '47 Broadway' name, which no longer appears in RideKC's route list. |
| kenan-stadium | CFB | 2024-01-01 | Tar Heel Express: Service runs in 2026 but the hub's details are stale: fare is $10 round-trip (hub: $5); Carolina Coffee Shop pickup is no longer listed and Jones Ferry Park and Ride has been added; Southern Village starts 2.5 hours before kickoff (hub: 1.5 hours). Source page: 2023 article last to |
| kyle-field | CFB | 2025-01-01 | Source page: 12thman.com gameday feature still carries 2025-season copy; the shuttle links it points to are current for 2026, so the source is stale but the services are confirmed. On-Campus & Off-Campus Gameday Shuttles: TAMU Transportation Services says shuttle routes changed for this year; hub ha |
| lane-stadium | CFB | unknown | Blacksburg Transit (BT) game-day expanded schedule: BT has not yet posted 2026 football game-day details (page says they will be posted before the first game); the expanded schedule, Transit Center drop-off pattern and post-game CAS routing are therefore unconfirmed for 2026 as of 2026-08-27. Two To |
| martin-stadium-northwestern-university | CFB | 2025 | Hub venue for 2026 (all transit directions): Northwestern plays only two 2026 home games at Martin Stadium (South Dakota State Sep 5, Colorado Sep 19); the remaining five home games from Oct 2 move to the new Ryan Field, so this hub's transit directions apply to two dates only and Ryan Field (Centra |
| memorial-stadium-clemson | CFB | 2016-09-26 | Source page: The transit source is a single-game 2016 gameday guide (Louisville at Clemson); it contains no route or service detail, only a link to CATbus updates ten seasons old. CATBus: Game-day CATbus service for 2026 is not confirmed by any current official source; the present clemsontigers.com |
| memorial-stadium-lincoln | CFB | unknown | StarTran game-day shuttle service (Big Red Express): StarTran no longer operates the Husker shuttle: iPronto (Pronto Corporation, San Jose) replaces StarTran beginning September 2026 (first home game Sep 5) because federal charter rules bar the public agency from competing with private carriers. Rou |
| mercedes-benz-stadium | NFL/MLS | 2026-04-18 | MARTA Rapid A-Line BRT (South Downtown stop): The A-Line is in phase-1 service only: temporary stops are in effect and most platforms are closed during construction until fall 2026 (alert runs to 2026-12-31). A named 'South Downtown' BRT platform is not confirmed open; riders board at posted tempora |
| moda-center | NBA/WNBA | unknown | MAX Green Line: Effective 2026-08-23 TriMet shortened the Green Line to run only between Clackamas Town Center and Gateway Transit Center — it no longer runs downtown and no longer serves Rose Quarter Transit Center. Hub lines[] and notes still say Green stops at Rose Quarter next to Moda Center. Bu |
| mt-bank-stadium | NFL | unknown | RavensRide Park & Ride charter buses: The Ravens page lists the five pickup locations and prices with no season/year stated, and 2026-season operation of the private charter consortium (Academy, Woodlawn, Huber's, AS Midway) could not be independently confirmed in this pass — unknown, not a confirme |
| neyland-stadium | CFB | 2019-07-29 | KAT game-day shuttle from Civic Coliseum: For the 2026 season the Civic Coliseum operates as a $30-flat-rate-per-vehicle park-and-ride (parking + round-trip ride from Coliseum Garage A/B, cashless), not the $10-round-trip-per-person shuttle the hub notes and the 2019-dated source describe. The Marke |
| nrg-stadium | NFL | 2026-08-25 | NRG Stadium / NRG Park naming: The complex has reverted to Reliant branding: the source page is now titled 'Plan Your Visit \| Reliant Park Guest Information' and METRO's attraction page (its /nrg-park URL 301s to /reliant-park) says 'Reliant Park includes Reliant Stadium, Reliant Arena and Reliant C |
| paycor-stadium | NFL | 2025-09-15 | TANK Bengals game-day shuttle drop-off (Riverfront Transit Center): TANK's current page says the Riverfront Transit Center is closed for repairs and the game-day stop is temporarily moved to 2nd Street at the Freedom Center; the hub note's 'dropping you off right inside the Riverfront Transit Center |
| rose-bowl-stadium | CFB | 2026 | Metro Gold Line: Renamed: the line serving Memorial Park Station has been the Metro A Line since the 2023 Regional Connector opening; Metro's current line list has no Gold Line. Both the source page and the hub's lines[]/notes use the retired name. |
| saban-field-at-bryant-denny-stadium | CFB | 2022-08-25 | Crimson Ride gameday shuttle: Detail drift from the 2022 source: hub says service to the Quad begins at 7 a.m. on game days; the current UA Gameday page says it begins at 6 a.m. (for 11 a.m. kickoffs) and concludes 1.5 hours postgame. Service itself still runs. |
| sanford-stadium | CFB | 2017-06-16 | UGA Campus Transit gameday shuttle (East Campus Deck/Ramsey to Gate 6): Timing drift from the 2016-era source: hub says shuttles run continuously for 5.5 hours before game time; UGA TPS's 2026 page says S–Stadium Loop service begins 3.5 hours before kickoff. Service itself confirmed for 2026. |
| simmons-bank-liberty-stadium | CFB | 2024-08-22 | U of M campus Park & Ride shuttle ($10, card only): Shuttle is announced only for the 2024 season in the sourced article; no 2025 or 2026 confirmation found anywhere on gotigersgo.com or in news search — a stadium shuttle announced only for a prior season. All 2024 gameday logistics (gates, lots, sh |
| sofi-stadium | NFL | 2026 | Torrance Transit SoFi Special Service: Game-day special not confirmed with the operator for the 2026 season (operator site blocks automated fetch); only evidence is the stadium's own undated (c)2026 page. Culver CityBus Line 99 Express: Game-day express not confirmed with the operator for the 2026 s |
| soldier-field | MLS/NFL | unknown | Source page (soldierfield.com directions-parking): Unverifiable by automated fetch: curl 406, fetch-service 404. Still present in the site's own nav, so likely alive for browsers, but the hub's facts cannot be re-verified against it without a real browser. CTA Bus 146 Inner Drive/Michigan Express: C |
| space-city-financial-stadium | CFB | 2025 | UH game-day shuttle buses (east campus + north end routes): Shuttle service is described in a guide last updated for the 2025 season; no 2026 confirmation found — stadium shuttle announced only for a prior season. (stadium naming): Hub is named 'Space City Financial Stadium' but UH's own site still |
| target-center | WNBA/NBA | unknown | SW Shuttle (SouthWest Transit): SouthWest Transit's 2026 events menu lists shuttles for Timberwolves, Wild, Twins, Vikings, Gophers, and concerts, but no Minnesota Lynx shuttle; this hub is tagged WNBA+NBA, and 'runs to events' is only confirmed for NBA games and concerts, not Lynx (WNBA) games. |
| jack-trice-stadium | CFB | 2026-08-19 | CyRide #3 Blue (Campus - S. 5th): The hub asserts "the closest stop to the stadium is Lincoln Way/Beach", but CyRide's own live Saturday timetable for #3 Blue, stamped for the current season (August 17, 2026 to May 14, 2027), lists a timepoint literally named "Jack Trice Stadium" three stops past Li |
| milan-puskar-stadium | CFB | 2025-09-23 | PRT (Personal Rapid Transit): The hub's "free of charge" game-day claim is not confirmed by the operator and rests only on the stale 2025 athletics article. The PRT's own current fare page lists WVU students/faculty/staff FREE and "Everyone Else... 50 cents" for visitors and community members, with |
| subaru-park | MLS | 2024-09-08 | SEPTA Wilmington/Newark Regional Rail Line (timetable linked from the cited page): The schedule the page hands riders is the September 8, 2024 edition and no longer matches operations. Today's live northbound Chester TC departures were 4:16, 5:13, 5:48, 6:54, 7:12, 7:57, 8:37, 9:38 and 10:30 PM, whi |
| wrigley-field | MLB | 2026-06-29 | CTA Orange Line (from Midway): The line itself is fine (Normal Service), but the transfer instruction in the northsidebaseball source is broken. That page routes Midway riders "eastbound train on the 'Orange' rapid transit line to the Lake/State stop" and then down to the State Street subway for the |

### Unsettled

- **nippert-stadium**: Both flagged services remain described by the operator, but neither is confirmed for the 2026 season, and neither is shown suspended or discontinued — honestly unknown, matching the sweep's concern. (1) Eden Garage game-day bus shuttle: still described on the live gobearcats.com/nippert-gameday-gui…
- **rice-eccles-stadium**: Flagged service: "Postgame bus, stadium to Court House TRAX station" (Rice-Eccles Stadium). Verdict: UNKNOWN for the 2026 season — not confirmed, and not shown discontinued. What I established independently: 1) The stored source is live and correctly dated. https://utahutes.com/news/2025/9/1/genera…
- **valley-childrens-stadium**: Flagged service: the free Green Lot game-day shuttle at Valley Children's Stadium (Fresno State), described as free buses for Green Lot parkers from Barstow Ave, Woodrow Ave and Maple Roundabout, starting 3 hours pre-kick through the 1st quarter, plus a wheelchair-accessible bus from the Maple Roun…
- **bridgeforth-stadium-and-zane-showker-field**: Verified 2026-08-27 by curl (Chrome UA) against operator sources; no writes made. CISAT Bus Stop game-day shuttle — UNRESOLVED, and the sweep's concern is real but its "stale entry" theory is weaker than it looks. No current-season source lists CISAT: JMU's Game Day Shuttles page says campus shuttl…

### Dead or wrong source pages

Separate from service changes: the cited page itself 404s, redirects to a different document, is blocked, or documents a different event. These break re-verification regardless of whether the service still runs.

- **acrisure-stadium**: Operator renamed: the agency has been Pittsburgh Regional Transit (PRT) since June 2022; both the source page and the hub line still say 'Port Authority'. Service itself to Allegheny and North Side stations is running (2026 cut proposal averted for two years).
- **allegiant-stadium**: Service is confirmed running for 2026-27 with the same six routes, but the cited source page never mentions Game Day Express; the hub line has no supporting citation. Attach an RTC or 2026 news citation (RTC's own page blocks fetchers).
- **audi-field**: Operator confirmation that the whole network was renamed June 29, 2025; any bus route number sourced before that date is suspect.
- **bank-of-america-stadium**: Dead source: 404. Content moved to /schedule/traffic-parking; hub source URL should be repointed.
- **barclays-center**: Claim comes from source text that still references NY Islanders event trains (pre-2021); not confirmed against a current LIRR timetable for 2025-26 events.
- **boone-pickens-stadium**: Source's 'latest information' link (okstate.com/parking) now redirects to the POSSE donor parking page, which has no ADA shuttle details; 2026 operation unverified.
- **camden-yards**: Hub and source say MTA provides MARC 'on a daily basis'; the MARC Camden Line that serves Camden Station runs weekdays only with no weekend service in 2026 (MTA: 'there is no weekend service on the Camden or Brunswick Lines'). Weekend Orioles games have no MA…
- **camp-randall-stadium**: Not confirmed for 2026. Every UW page found still carries 2024-season pricing text ('for each game of the 2024 season'); the evenue pass page (uwbadgers.evenue.net/events/BSB, last titled '2025 Football \| Bucky Shuttle Bus Passes') now 404s and no 2026 announ…
- **camp-randall-stadium**: Could not establish whether a Metro route still serves the Observatory Drive stop across from Lot 64 in 2026 (Metro's Badger football page 404s); unknown, not a confirmed problem.
- **casino-del-sol-stadium**: Stored source URL redirects to a broken double-encoded path that renders an empty '@title' template with no guide content; the hub's transit facts can no longer be re-verified against it. Replace with the 2026 stadium page.
- **chase-stadium**: Hub notes state 'No specific rail/bus line names are given' because the stored source is an app-list page; the club now publishes a dedicated Nu Stadium transit page naming Metrorail Orange Line to Miami International Airport station, Metrobus routes, Tri-Rai…
- **citizens-bank-park**: As of SEPTA New Bus Network Phase 1 (effective 2026-08-23) Route 17 is truncated to 20th-Johnston and no longer serves NRG Station, Packer Park or the Navy Yard; the Phillies source page and the hub still list Route 17 as a way to reach the park. Route 45 now…
- **coca-cola-coliseum**: The hub note (and the venue source) route riders onto a '509/511 replacement bus toward Lake Shore and Bathurst'. That was the 2025 Bathurst/Fleet construction arrangement; as of August 2026 both 509 and 511 streetcars run through to Exhibition Loop, so the r…
- **coors-field**: The C Line only exists again because RTD temporarily reinstated it on 2026-06-07 for the Downtown Rail Reconstruction Project (it was discontinued Jan 2023 to June 2026, when the source text was wrong). Its status is tied to the project and should be re-check…
- **darrell-k-royal-texas-memorial-stadium**: Mislabel carried from the 2022 source: CapMetro's rail service is Route 550 (Red Line); Route 18 is a bus route. Rail game-day service for UT football is not confirmed on CapMetro's current gameday page, and Red Line Saturday service starts at 10 a.m. with no…
- **darrell-k-royal-texas-memorial-stadium**: Hub list is drawn from the 2022 page; CapMetro's current UT football page lists seven gameday routes including Route 837, and notes Routes 7 and 10 run detoured routings on gamedays. Routes still operate; the list is incomplete and the source is four seasons …
- **donald-w-reynolds-razorback-stadium**: Not stated on the cited source or on the athletics shuttle-service page; the only page found carrying this claim (nwahomepage) is inaccessible (403), so whether it applies to the 2026 season is unknown.
- **empower-field**: Service confirmed for all 2026 home games, but the fare is now $15 roundtrip only (no one-way ticket); the hub notes and the cited source still say $10 roundtrip / $7 one-way.
- **everbank-stadium**: Service runs for 2026, but the hub notes' drop-off detail is stale: neither the cited source nor JTA's 2026 page mentions Lot Z, Parker St, or Lot C / Connexion drop-offs (the A-Z page now says Lot B for everyone; JTA says one lot adjacent to the East gates),…
- **exploria-stadium**: The stored source URL no longer resolves: it 301-redirects to a malformed doubled-slash path on intercostadium.com that returns 403. The page exists at https://intercostadium.com/arrival.
- **huntington-bank-field**: Not regular service: since 2025-12-07 the Waterfront Line runs only on Browns home-game dates and select major events (Tower City East Portals project, until further notice). The hub's game-day description is still accurate, but listing it as a line alongside…
- **huntington-bank-field**: Automated fetch is blocked by a Cloudflare challenge (403), so the live page's date and 2026 copy could not be verified; the only readable version is a 2025-08-20 archive. Needs a browser check to confirm the transit paragraph and season references are curren…
- **huntington-bank-stadium**: Dead URL in the hub notes: metrotransit.org/gopher-sports is a 404 (the Gophers FAQ also cites it, as metrotransit.com). Metro Transit's current Gopher/stadium page is /stadiums/huntington-bank-stadium/. Service itself is unaffected.
- **huntington-bank-stadium**: The stored source URL redirects to a new 2026/8/25 slug; update the source to the redirect target so future verification hits the live FAQ directly.
- **husky-stadium**: Not confirmed for 2026: absent from both the 2026 'What's New' page and the current gohuskies Public Transportation page; only the 2017-18 source describes it.
- **jma-wireless-dome**: Source is a 2018 Sidearm article with no update stamp; the shuttle facts are confirmed for 2026 only by Centro's event page, which the hub does not cite. Consider adding https://www.centro.org/local-event-service and https://parking.syr.edu/event-parking/ as …
- **jones-stadium**: Stored 2016 URL redirects to a 2026 page; should be replaced with the redirect target.
- **kenan-stadium**: 2023 article last touched in 2024; a 2026 source (move.unc.edu athletics page or the Town's Tar Heel Express page) should replace it.
- **kyle-field**: 12thman.com gameday feature still carries 2025-season copy; the shuttle links it points to are current for 2026, so the source is stale but the services are confirmed.
- **kyle-field**: TAMU Transportation Services says shuttle routes changed for this year; hub has no route-level detail so nothing contradicts, but any future route names should be re-sourced from the TAMU page.
- **lane-stadium**: Route exists on ridebt.org, but the hub's 'all BT routes except the Two Town Trolley drop at the Transit Center' and the Orange Loop closure claim are not on the cited source page; they need a source.
- **levis-stadium**: Cited source is the 2016 Super Bowl 50 guide, which explicitly says regular-season shuttles do not apply to it and points to an SB50-specific VTA page; replace with https://levisstadium.com/getting-here/public-transportation/ (lists VTA, ACE, Caltrain, Capito…
- **los-angeles-memorial-coliseum**: The only transit source is a 2018 single-season gameday article; every transit fact on the hub inherits its 2018 date.
- **martin-stadium-northwestern-university**: The guide is still labeled '2025 Gameday Information'; no 2026 update visible.
- **memorial-stadium-clemson**: The transit source is a single-game 2016 gameday guide (Louisville at Clemson); it contains no route or service detail, only a link to CATbus updates ten seasons old.
- **memorial-stadium-clemson**: Game-day CATbus service for 2026 is not confirmed by any current official source; the present clemsontigers.com gameday guide lists no public transit at all. Marking unknown, not discontinued.
- **memorial-stadium-lincoln**: The cited huskers.com page no longer carries the shuttle schedule, loading location, or pickup points the hub quotes; the hub text cannot be re-verified against its source.
- **moda-center**: Combined with Line 19 and renamed 4-Fessenden/Woodstock effective 2026-08-23; the source page still shows the old '4-Fessenden' name. Rose Quarter stop not shown as removed, but the route changed.
- **moda-center**: Shortened (to PCC Sylvania–Downtown–St. Johns) and renamed 44-Capitol Hwy/N Rosa Parks effective 2026-08-23; source still shows old '44-Capitol Hwy/Mocks Crest' name. Rose Quarter TC stop should be re-verified post-change.
- **mohegan-sun-arena**: The source page says 'the ferry shuttle is not running at this time. Check back in May 2027 for updates' while still displaying a 2026 (May 21–Oct 11) schedule — the casino's own last-mile shuttle from New London is suspended for 2026, so the hub's 'Amtrak/SL…
- **neyland-stadium**: For the 2026 season the Civic Coliseum operates as a $30-flat-rate-per-vehicle park-and-ride (parking + round-trip ride from Coliseum Garage A/B, cashless), not the $10-round-trip-per-person shuttle the hub notes and the 2019-dated source describe. The Market…
- **nrg-stadium**: The complex has reverted to Reliant branding: the source page is now titled 'Plan Your Visit \| Reliant Park Guest Information' and METRO's attraction page (its /nrg-park URL 301s to /reliant-park) says 'Reliant Park includes Reliant Stadium, Reliant Arena and…
- **nrg-stadium**: Route renamed/restructured: METRO's old '500 IAH Downtown Direct' URL redirects to '500 Downtown Direct', now serving both Bush IAH and Hobby airports; the hub note's 'METRO 500 IAH Express' name is stale. (METRO customer service is 713-635-4000; the hub's 71…
- **progressive-field**: Not a service outage: the second source's transit section predates 2019 (it still directs guests via 'Quicken Loans Arena', two arena names ago), so that page should not be relied on for current walkway details; the main guide's Rocket Arena-era paragraph is …
- **rose-bowl-stadium**: Renamed: the line serving Memorial Park Station has been the Metro A Line since the 2023 Regional Connector opening; Metro's current line list has no Gold Line. Both the source page and the hub's lines[]/notes use the retired name.
- **saban-field-at-bryant-denny-stadium**: Detail drift from the 2022 source: hub says service to the Quad begins at 7 a.m. on game days; the current UA Gameday page says it begins at 6 a.m. (for 11 a.m. kickoffs) and concludes 1.5 hours postgame. Service itself still runs.
- **sanford-stadium**: Timing drift from the 2016-era source: hub says shuttles run continuously for 5.5 hours before game time; UGA TPS's 2026 page says S–Stadium Loop service begins 3.5 hours before kickoff. Service itself confirmed for 2026.
- **shi-stadium**: The cited source page no longer contains any NJ Transit / train / New Brunswick shuttle content (0 matches in fetched HTML); the facts now live on the 2026-08-17 Shuttle Bus Services/NJ Transit page — hub source should be repointed. The service itself is conf…
- **simmons-bank-liberty-stadium**: Shuttle is announced only for the 2024 season in the sourced article; no 2025 or 2026 confirmation found anywhere on gotigersgo.com or in news search — a stadium shuttle announced only for a prior season.
- **sofi-stadium**: Service itself is confirmed for 2026 at ridegtrans.com, but GTrans's old domain gtrans.org now redirects to a GoDaddy for-sale lander — any hub copy or link pointing at gtrans.org is dead.
- **soldier-field**: Unverifiable by automated fetch: curl 406, fetch-service 404. Still present in the site's own nav, so likely alive for browsers, but the hub's facts cannot be re-verified against it without a real browser.
- **bridgeforth-stadium-and-zane-showker-field**: Listed as a shuttle origin ONLY on the hub's chosen source page, and contradicted by JMU's two other current game-day pages. The dedicated Game Day Shuttles page says 'Campus shuttles will run from the Festival Bus Stop (C12, D3, R4 and Ballard Parking Deck),…
- **citi-field**: The stops nearest the ballpark are still provisional. The route-change appendix carried inside the current (Effective June 28, 2026) timetable footnotes both Seaver Way stops: "*Proposed stops on Seaver Way are subject to change in collaboration with NYC EDC …
- **dodger-stadium**: RUNNING for 2026 — no suspension — but the hub's timing is stale. The hub says service begins '2.5 hours before typical games'; Metro publishes THREE hours before game time for both branches ('Buses run every five to 10 minutes starting three hours before gam…
- **gerald-j-ford-stadium**: Weekend Red Line service is being discontinued during the 2026 football season. DART's service-change page states: 'Starting September 14, 2026, the RED Line will change on weekdays and will not run in either direction on weekends' and, under Rail Changes, 'R…
- **gerald-j-ford-stadium**: The shuttle still runs in 2026 (the 2026 parking map's legend shows shuttle bus drop-off/pickup and prices East Campus and Energy Square at $20), but the hub's stop list comes only from the unrefreshed source paragraph and is out of step with SMU's current-se…
- **notre-dame-stadium**: The "Shuttle Routes" link in the Shuttles section of the source page serves last season's map: it resolves to storage.googleapis.com/fightingirish-com/2025/06/ParkingMap_2025_Gameday-v3.pdf, first page "UNIVERSITY OF NOTRE DAME 2025 FOOTBALL GAMEDAY PARKING M…
- **providence-park**: TriMet's own event page is itself stale on line 58 and is almost certainly the true provenance of this hub's notes — its wording is near-verbatim ('6-ML King Jr and 58-Canyon Rd buses stop three blocks south of Providence Park on SW 18th Ave'). Four days afte…
- **providence-park**: The notes assert 'TriMet runs increased service for matches and concerts.' I could not verify this anywhere on the operator's current pages: TriMet's Providence Park page contains no wording about extra, additional, or increased service (it says only 'Expect …
- **providence-park**: The hub's only transit source cannot be verified by fetch and cannot be date-stamped. It is a JavaScript-only single-page app: curl with a Chrome UA gets HTTP 200 and a 1.7 KB shell with no transit text, its canonical points at the site root rather than this …
- **secu-stadium**: Stale route map behind the source. The Quickbus paragraph on our source page links its "football parking map" to the prior-season file (PDF metadata: Title "FootballMap_2025", CreationDate 2025-08-01), and the operator's own gameday page links the same 2025 f…
- **subaru-park**: The schedule the page hands riders is the September 8, 2024 edition and no longer matches operations. Today's live northbound Chester TC departures were 4:16, 5:13, 5:48, 6:54, 7:12, 7:57, 8:37, 9:38 and 10:30 PM, while the linked PDF's weekday northbound Che…
- **subaru-park**: Not confirmed for the 2026 season by any dated source. The cited transportation page's shuttle wording is unchanged since at least September 2024 per Wayback, and no club news item, SEPTA timetable note or SEPTA alert mentions it. The nearest support is the c…
- **wrigley-field**: The line itself is fine (Normal Service), but the transfer instruction in the northsidebaseball source is broken. That page routes Midway riders "eastbound train on the 'Orange' rapid transit line to the Lake/State stop" and then down to the State Street subw…
- **wrigley-field**: Stale shuttle detail on a cited source. northsidebaseball, despite a 2026-06-29 dateModified, still says "The Cubs offer free remote parking at 3900 N. Rockwell St., just east of the Chicago River and accessed from Irving Park Road" and that return shuttles r…

### Every stale-dated hub, oldest first

| Source date | Hub | League | Verified verdict |
| --- | --- | --- | --- |
| 2016-02-06 | levis-stadium | NFL | no |
| 2016-09-26 | memorial-stadium-clemson | CFB | changed |
| 2017 | carter-finley-stadium | CFB | changed |
| 2017-06-16 | sanford-stadium | CFB | changed |
| 2018-06-23 | husky-stadium | CFB | no |
| 2018-08-08 | jma-wireless-dome | CFB | yes |
| 2018-08-14 | los-angeles-memorial-coliseum | CFB | no |
| 2019-01-01 | davis-wade-stadium | CFB | changed |
| 2019-07-29 | neyland-stadium | CFB | changed |
| 2020-06-01 | amon-g-carter-stadium | CFB | changed |
| 2020-07-07 | bridgeforth-stadium-and-zane-showker-field | CFB | unknown |
| 2022-03-22 | darrell-k-royal-texas-memorial-stadium | CFB | changed |
| 2022-08-25 | saban-field-at-bryant-denny-stadium | CFB | changed |
| 2022-08-30 | casino-del-sol-stadium | CFB | changed |
| 2023-08-24 | donald-w-reynolds-razorback-stadium | CFB | changed |
| 2023-09-14 | huskie-stadium | CFB | yes |
| 2023-11-11 | albertsons-stadium | CFB | changed |
| 2024-01-01 | kenan-stadium | CFB | changed |
| 2024-04-24 | loandepot-park | MLB | no |
| 2024-08-22 | simmons-bank-liberty-stadium | CFB | changed |
| 2024-09-03 | hard-rock-stadium | NFL/CFB | changed |
| 2024-09-08 | subaru-park | MLS | changed |
| 2025 | boone-pickens-stadium | CFB | changed |
| 2025 | fenway-park | MLB | no concern raised |
| 2025 | martin-stadium-northwestern-university | CFB | changed |
| 2025 | space-city-financial-stadium | CFB | changed |
| 2025-01-01 | kyle-field | CFB | changed |
| 2025-04-21 | camp-randall-stadium | CFB | changed |
| 2025-06-29 | citi-field | MLB | yes |
| 2025-08-14 | valley-childrens-stadium | CFB | unknown |
| 2025-08-15 | folsom-field | CFB | no concern raised |
| 2025-08-21 | ohio-stadium | CFB | yes |
| 2025-08-27 | alumni-stadium | CFB | changed |
| 2025-09-01 | rice-eccles-stadium | CFB | unknown |
| 2025-09-15 | paycor-stadium | NFL | changed |
| 2025-09-23 | milan-puskar-stadium | CFB | changed |
| 2025-10-27 | empower-field | NFL | changed |
| 2025-11-14 | acrisure-stadium | NFL/CFB | changed |
| unknown | pratt-whitney-stadium-at-rentschler-field | CFB | yes |

### What this says about the pipeline

Transit is the field most likely to go stale without anyone noticing, because nothing about a stored sentence changes when a route is renumbered or a shuttle is cancelled. The venue scanners re-check promos, not logistics prose, and the doc-level `verified` flag records that a human once believed the fact, not that the fact is still true. There is no watcher on any of it. That is the gap the Northstar case pointed at, and this sweep measures it: at least a third of our transit copy is sourced to a page older than the season it describes, and roughly two in five hubs that name a specific service name one that has since changed. A fix is out of scope here; the cheapest first control would be a scheduled re-check of the source URL alone (dead link, redirect, or an evident date older than the current season), which would have flagged most of the rows above without reading a word of the page.
## 12. The eleven silenced transit fields

Shipped on `feature/cfb-venue-data`, not merged. The stored text was not edited, not deleted and not replaced with a guess; it is withheld at render the way an unsourced field is withheld, with the operator evidence recorded per entry in `src/lib/venue-transit-suppression.ts`. Deleting an entry restores the text.

| Hub | League | Tenant | The service a fan cannot use |
| --- | --- | --- | --- |
| levis-stadium | NFL | san-francisco-49ers (NFL) | The only transit source is the Super Bowl 50 guide (Feb 2016), which states on its face that regular-season shuttles do not apply to it and points at a VTA page that now 404s. |
| stanford-stadium | CFB | stanford (CFB) | Caltrain publishes on every dated 2026 home-game page that Stanford Station will not be open and riders should use Palo Alto and walk. |
| dodger-stadium | MLB | los-angeles-dodgers (MLB) | The Metro Gold Line no longer exists after the Regional Connector merged it into the A and E lines; the Red and Purple labels are also off Metro’s current roster. |
| loandepot-park | MLB | miami-marlins (MLB) | Metrobus 6 and 51 are absent from Miami-Dade DTPW’s live roster and current GTFS; route 21 now runs about 1.7 km away; Civic Center is published as UHealth \| Jackson. |
| providence-park | MLS | portland-timbers (MLS) | TriMet’s route page reads "This route is discontinued with replacement service on line 19-Glisan/Canyon Rd" for the 58-Canyon Rd our lines still name. |
| gerald-j-ford-stadium | CFB | smu (CFB) | DART publishes that from 14 September 2026 the Red Line does not run in either direction on weekends. SMU plays Saturdays. |
| audi-field | MLS | dc-united (MLS) | Metrobus 74 and P6 do not exist in WMATA’s post-redesign network, whose 117 routes carry no bare-numeric names; the Buzzard Point service is now C55 and C11. |
| bmo-field | MLS | toronto-fc (MLS) | The stored routing sends riders to a TTC 509/511 replacement bus that TTC scoped to February through Summer 2025. |
| husky-stadium | CFB | washington (CFB) | UW Athletics states the South Kirkland, Eastgate and Redondo Heights park-and-ride express buses no longer operate in 2026. |
| los-angeles-memorial-coliseum | CFB | usc (CFB) | The Metro Silver Line was discontinued in the busway restructure and the Expo Line was renamed the E Line. |
| mountain-america-stadium | CFB | arizona-state (CFB) | Valley Metro announced the Dorsey/Apache Blvd park-and-ride, which our text routes riders to, closed permanently on 29 May 2026. |

### Verified at render, preview of the suppression commit

The venue page and the CFB block gate transit on different things, and two further surfaces gated on nothing, so one shared list feeds six call sites. Checked on served HTML with a cache-busting fetch:

- **All eleven venue pages**: the "Getting in" Transit row is absent and the TRANSIT fact-band chip is absent. Every one keeps its other Getting-in rows, so no card empties and no heading dangles.
- **Controls** (target-field, ohio-stadium, secu-stadium): the Transit row still renders, so the check discriminates.
- **The five CFB school pages**: stanford 6 lines, smu 6, washington 8, usc 5, arizona-state 7, none carrying a Transit line, all above the three-line minimum.
- **/nfl**: no bare "VTA" anywhere in the served body. This surface had no gate at all before and would have printed the string for a Levi's primetime card.
- **Meta descriptions**: none of the eleven promises transit.
- **robots**: none of the eleven flipped to noindex.

### Two things this deliberately does not do

**The indexing floor is untouched.** `venueHubIsIndexable` and `readIndexFloorFields` read the raw doc, which is exactly how an unsourced field already behaves: it counts toward the floor while staying off the page. This matters for one building. `providence-park` clears the floor on geo + bag + transit and has no parking, so folding suppression into the floor would drop it from the sitemap and `/venues`, flip its page to `noindex`, and remove the venue card from `/mls/portland-timbers`. That is an indexing decision rather than a copy decision and is left open.

**No pro team page renders this field.** Team pages carry a different corpus, `venues.publicTransit`, a plain string on the `venues` collection rendered by `VenueInfoBlock`. Six of the eleven buildings have such a doc. Scanned against the same operator findings, only one carries a flagged fact: `venues/loandepot-park` names "Civic Center Station", which Miami-Dade now publishes as UHealth | Jackson. The rest name services that are current (the Dodger Stadium Express, MAX at Providence Park, the Navy Yard Green Line, GO Transit at Exhibition). Left alone: silencing a mostly-correct paragraph over one renamed station is disproportionate, and it is a separate corpus with its own provenance.

### Second pass, 2026-08-27: the 21 would-strand fields join the list

Ruling: the sweep's "changed" versus "discontinued" grading was the verifier's, not a difference in what happens to a fan. Every field the classification judged **would-strand**, meaning a reader acting on our sentence waits for something that will not serve them, is silenced on the same mechanism as the eleven. The list is now 32 buildings.

| Hub | Tenants | Class | What the fan would act on |
| --- | --- | --- | --- |
| albertsons-stadium | boise-state (CFB) | stale-description | Our 'Downtown Bronco Shuttle' text describes VRT's 2023 pilot, which VRT discontinued after that season; the downtown ride that actually runs in 2026 is VRT's 'Game Day Bus', every 15 minutes from 13 stops, so our name, our 20-minute frequency and our entire 7-stop pickup list have no current operat |
| amon-g-carter-stadium | tcu (CFB) | partly-withdrawn | TCU's current 2026 parking page states verbatim that the Saint Stephen's Presbyterian shuttle will not run for the Sept 12, Nov 14 and Nov 21 home games (3 of 8 dates) and that the Hyatt Place Fort Worth/TCU shuttle is 'HOTEL GUESTS ONLY', while our sentence offers both to any fan on any game day. B |
| barclays-center | brooklyn-nets (NBA), new-york-liberty (WNBA) | partly-withdrawn | The load-bearing doubt is the LIRR late-night promise: MTA's own published timetable (feed GO201_26, Aug 26 to Nov 8 2026) has no Atlantic Terminal event at or after 00:30 on any of 75 service days, with the last weeknight departure at 23:31, so 'generally provided up to 2 AM for late events' descri |
| carter-finley-stadium | nc-state (CFB) | partly-withdrawn | NC State's 2026 stadium guide redefines Wolfpack Express as four roaming golf carts for fans needing assistance and retains only the Indoor Practice Facility lots; our Practice Field, Trinity/TX and Stadium West stops are omitted rather than explicitly cancelled, so whether any shuttle still serves  |
| citizens-bank-park | philadelphia-phillies (MLB) | partly-withdrawn | SEPTA's dated August 23, 2026 timetable shows Route 17 shortened to 2nd-Market to 20th-Johnston, with Pattison Av, NRG and Packer Park absent from every weekday, Saturday and Sunday table, so our 'Routes 4 and 17' clause strands anyone who boards the 17; Route 45 now carries Broad-Pattison/Navy Yard |
| darrell-k-royal-texas-memorial-stadium | texas (CFB) | stale-description | CapMetro's rail is Route 550 (Red Line) and does not serve DKR at all, so the stored "MetroRail Route 18" names a service that does not exist — Route 18 is the MLK local bus, already listed. All six bus routes are confirmed running on CapMetro's current gameday page, but that page adds Route 837, sa |
| davis-wade-stadium | mississippi-state (CFB) | partly-withdrawn | SMART has no "Old Main" or "Hwy 12" route in its current roster, system map or GTFS feed — those patterns are now Starkville Central and Starkville Central/North — and the Davis Wade Express (GTFS route TL-22, confirmed for 2026 Fri/Sat service) now terminates at Old Main Academic Center, with Giles |
| donald-w-reynolds-razorback-stadium | arkansas (CFB) | partly-withdrawn | Razorback Transit now runs these as Route 88/89 (Silver/Gold survive only as legend aliases), starting 3 hours before kickoff not 4, with Dickson St/Road Hog/Baum East loading at Gate 1 ONLY and Lot 320 at Gate 16 ONLY — so our Gate 10 drop-off, our Lot 56 pickup and the Arkansas Union pickup are al |
| empower-field | denver-broncos (NFL) | partly-withdrawn | RTD's D and H Lines have been suspended since 2026-06-07 for the Downtown Rail Reconstruction (D is additionally proposed for permanent discontinuation once the project finishes in 2027), so neither runs at any point in the 2026 NFL season and our "transfer to E" framing sends fans to trains that do |
| exploria-stadium | orlando-city (MLS) | partly-withdrawn | LYNX cut LYMMO back on 2026-01-11: the Lime Line (Link 61) was realigned east of I-4 and no longer reaches Inter&Co Stadium or Parramore at all, leaving only the Grapefruit Line (Link 62), which now ends around 8:25 p.m. daily with 30-minute Sunday headways and carries a standing "Inter&Co Stadium D |
| hard-rock-stadium | miami-dolphins (NFL), miami (CFB) | partly-withdrawn | Brightline's stadium-side boarding point is settled against us (two current hardrockstadium.com pages, one stamped 2026-08-18, put shuttle pick-up/drop-off at NW 199th by the Gate 3 pedestrian bridge, not the Lot 18 bridge our text names), so the live doubt is the Uber Shuttle: the sweep called it d |
| jones-stadium | texas-tech (CFB) | partly-withdrawn | Citibus's 2026 page confirms the gameday Park & Ride, the $6 fare and the pregame/postgame hours, but names four lots (USA Red Park & Pay, S1 Park & Pay, North HSC, North HSC ADA) and none of ours: 'Texas Tech Pkwy & 10th' appears nowhere on the site and 'John Walker Soccer Complex' only in the site |
| kenan-stadium | north-carolina (CFB) | partly-withdrawn | Chapel Hill Transit and move.unc.edu (dateModified 2026-08-21, season-anchored to UNC's six 2026 home games) agree the Tar Heel Express is $10 round-trip, Friday Center 3 hours out and Southern Village 2.5 hours out, so our $5 fare and 1.5-hour Southern Village time are flatly wrong. The real doubt  |
| martin-stadium-northwestern-university | northwestern (CFB) | partly-withdrawn | Northwestern's own 2026 schedule keeps only Sep 5 (South Dakota State) and Sep 19 (Colorado) at Martin Stadium; the five home games from Oct 2 onward move to the new Ryan Field on the Central Street side, so the CTA 201 / Purple Line-to-Noyes / Metra Evanston-Central directions are correct for two d |
| memorial-stadium-lincoln | nebraska (CFB) | stale-description | StarTran confirmed on the record it will not operate the Big Red Express in 2026; iPronto (Pronto Corporation) takes over from the Sep 5 opener serving the same four lots, but with advance ticket purchase required instead of walk-up boarding, and the 402-476-1234 number in our notes now reaches the  |
| moda-center | portland-trail-blazers (NBA), portland-fire (WNBA) | partly-withdrawn | TriMet truncated the MAX Green Line to Clackamas Town Center to Gateway Transit Center on 2026-08-23, so it no longer reaches Rose Quarter Transit Center at all, yet our line list and note still tell riders the Green Line stops there next to Moda Center; TriMet's own Rose Quarter page now lists only |
| mt-bank-stadium | baltimore-ravens (NFL) | partly-withdrawn | RavensRide is confirmed running in 2026 (live per-game schedule and matching prices on ravensride.net), but the Owings Mills pickup we name is in doubt: our cited Ravens directions page carries no year and still lists "Hyatt Place, Owings Mills", while the operator's own 2026 pages list "Metro Centr |
| paycor-stadium | cincinnati-bengals (NFL) | temporary-disruption | TANK's Bengals game-day Southbank Shuttle still runs for every home game, but TANK's own special-event page says the Riverfront Transit Center is closed for repairs and the stop is "temporarily moved to 2nd street at the Freedom Center" with no stated end date, so we cannot tell whether the closure  |
| sofi-stadium | los-angeles-rams (NFL), los-angeles-chargers (NFL) | partly-withdrawn | GTrans confirms Line 7X survives into 2026-27 but, from Sept 13, runs only on Sundays with a scheduled SoFi game and explicitly not on Monday or Thursday night games, while our only source (sofistadium.com) still says it runs every Sunday. Torrance Transit's SoFi Special Service and Culver CityBus L |
| space-city-financial-stadium | houston (CFB) | unconfirmed-this-season | The UH game-day shuttle (east-campus and north-end routes) has no 2026-dated confirmation: the cited guide is the 2025 edition and UH Parking's own current 2026 football page still links the 2025 map and tells fans to check back closer to the season, so the two-hours-before/one-hour-after window is  |
| target-center | minnesota-lynx (WNBA), minnesota-timberwolves (NBA) | partly-withdrawn | SouthWest Transit's SW Shuttle still runs to Target Center for Timberwolves games and concerts, but its Lynx page now returns 404 and Lynx/WNBA appears nowhere in the operator's 2026 events index, navigation or sitemap, despite the WNBA season being in progress: the Lynx leg was removed, not merely  |

The sharpest of them: RTD's D and H Lines have been suspended since 7 June 2026 with the D proposed for permanent discontinuation, and the stored Empower Field text routes fans to both as transfers. SEPTA shortened Route 17 away from Citizens Bank Park on 23 August 2026. TriMet truncated MAX Green off Rose Quarter the same day. SMART carries no Old Main or Hwy 12 route at all. MTA's timetable shows no Atlantic Terminal departure after 23:31 against a stored promise of service to 2 AM.

### Verified at render, second pass

Preview of the suppression commit, served HTML, cache-busting fetch, all six surfaces:

- **21 venue pages**: Transit row absent, TRANSIT chip absent, meta description promises no transit, every page still 200.
- **Getting-in cards**: none empties. `martin-stadium-northwestern-university` shows no card, but it is `verified: false` so its card was already empty and nothing changed. The other 20 keep between 5 and 16 rows.
- **Controls** (target-field, ohio-stadium, secu-stadium, lambeau-field): the Transit row still renders, so the check discriminates.
- **17 CFB school pages** lose a Transit line. **None falls below the three-line minimum**: the lowest is `/cfb/miami` at 4, the rest sit at 5 to 8.
- **/nfl**: no bare "VTA", "RavensRide", "RTD" or "TANK" anywhere in the served body.
- **Homepage transit tile**: reads **95 venues**, exactly 126 verified buildings with a transit field minus the 31 suppressed-and-verified. The count is honest rather than overstated by a third.

**One cosmetic consequence, reported not fixed.** Three venue pages drop from two fact-band chips to one and therefore lose the whole dark fact band, which is self-gating at two chips: `davis-wade-stadium`, `mt-bank-stadium`, `space-city-financial-stadium`. Levi's Stadium had the same effect in the first pass. No heading dangles and no card empties; the band simply does not mount.

**One overlap worth knowing about.** `hard-rock-stadium` now sits on two lists for two different fields: a tailgating conflict from the sourcing pass and a suppressed transit field from the sweep. Its CFB page (`/cfb/miami`) therefore withholds both, which is why it is the lowest of the 17 at 4 lines. The condensed-block test was changed to assert the exact withheld set rather than a bare line count, since a bare count cannot express a hub on two lists.

## 13. The 49 renamed, rerouted or unconfirmed transit fields, for a decision

Report only, nothing changed. Each row was classified from the verifying agent’s account by an independent pass, then the returned identifiers were diffed against the input list (that diff caught a silent 43-of-49 return; see `docs/scanner-framework.md` §6b.3 in the pipeline repo).

**The headline for the decision: 21 of the 49 would strand a fan**, which is the same standard that put the eleven in section 12. They are separated here only because the sweep’s verifier graded the service "changed" rather than "discontinued"; on rider impact many belong with the eleven.

| Rider impact | Count |
| --- | --- |
| would-strand | 21 |
| would-mislead | 17 |
| cosmetic | 10 |
| none | 1 |

Classes: name-only 7, stale-description 16, temporary-disruption 5, partly-withdrawn 17, source-broken-only 2, unconfirmed-this-season 2. Suggested actions: edit-label 20, silence 21, leave 3, re-source 5.

### would-strand (21)

| Hub | League | Source date | Class | What is uncertain | Suggested |
| --- | --- | --- | --- | --- | --- |
| albertsons-stadium | CFB | 2023-11-11 | stale-description | Our 'Downtown Bronco Shuttle' text describes VRT's 2023 pilot, which VRT discontinued after that season; the downtown ride that actually runs in 2026 is VRT's 'Game Day Bus', every 15 minutes from 13 stops, so our name, our 20-minute frequency and our entire 7-stop pickup list have no current operator backing. Separately, Boise State's own Lincoln/Brady garage shuttle is confirmed only through the 2025 fan guide (no 2026 guide has been published as of 2026-08-27), so whether it runs at all this season is unknown. | **silence** |
| amon-g-carter-stadium | CFB | 2020-06-01 | partly-withdrawn | TCU's current 2026 parking page states verbatim that the Saint Stephen's Presbyterian shuttle will not run for the Sept 12, Nov 14 and Nov 21 home games (3 of 8 dates) and that the Hyatt Place Fort Worth/TCU shuttle is 'HOTEL GUESTS ONLY', while our sentence offers both to any fan on any game day. Both shuttles do exist, so the doubt is narrowly which dates and which riders; our 2020 A-Z source still lists them flat with neither restriction. | **silence** |
| barclays-center | NBA/WNBA | unknown | partly-withdrawn | The load-bearing doubt is the LIRR late-night promise: MTA's own published timetable (feed GO201_26, Aug 26 to Nov 8 2026) has no Atlantic Terminal event at or after 00:30 on any of 75 service days, with the last weeknight departure at 23:31, so 'generally provided up to 2 AM for late events' describes a pre-2021 Islanders-era arrangement, though unscheduled event extras cannot be ruled out from a static feed. Secondary and lower stakes: B41 and B45 both still serve the Flatbush/Atlantic corner, but NYC DOT's Flatbush Avenue reconstruction is relocating stops there into fall 2026, so the stop wording may drift on match days. | **silence** |
| carter-finley-stadium | CFB | 2017 | partly-withdrawn | NC State's 2026 stadium guide redefines Wolfpack Express as four roaming golf carts for fans needing assistance and retains only the Indoor Practice Facility lots; our Practice Field, Trinity/TX and Stadium West stops are omitted rather than explicitly cancelled, so whether any shuttle still serves those lots is unknown. Gate 11 is now the terminus of a separate ADA bus reserved for Westchase handicap-lot parkers with a placard, not the general pre-game drop-off and post-game pick-up our sentence promises to every shuttle rider. | **silence** |
| citizens-bank-park | MLB | 2026-01-01 | partly-withdrawn | SEPTA's dated August 23, 2026 timetable shows Route 17 shortened to 2nd-Market to 20th-Johnston, with Pattison Av, NRG and Packer Park absent from every weekday, Saturday and Sunday table, so our 'Routes 4 and 17' clause strands anyone who boards the 17; Route 45 now carries Broad-Pattison/Navy Yard and Route 4 survives at reduced frequency. Beware that SEPTA's own Phillies bulletin still repeats stale 'routes 4 and 17 (weekends only)' boilerplate, so a re-check against that page will appear to confirm us; the Sports Express itself is only a rename ([B] Broad Street Line, B2 Express). | **edit-label** |
| darrell-k-royal-texas-memorial-stadium | CFB | 2022-03-22 | stale-description | CapMetro's rail is Route 550 (Red Line) and does not serve DKR at all, so the stored "MetroRail Route 18" names a service that does not exist — Route 18 is the MLK local bus, already listed. All six bus routes are confirmed running on CapMetro's current gameday page, but that page adds Route 837, says Routes 7 and 10 run detoured on gamedays, and the $2.50 roundtrip fare is unverified since the 2022 source. | **edit-label** |
| davis-wade-stadium | CFB | 2019-01-01 | partly-withdrawn | SMART has no "Old Main" or "Hwy 12" route in its current roster, system map or GTFS feed — those patterns are now Starkville Central and Starkville Central/North — and the Davis Wade Express (GTFS route TL-22, confirmed for 2026 Fri/Sat service) now terminates at Old Main Academic Center, with Giles Hall, one of our three promised drop-offs, absent from the feed's stops entirely. The Mon-Sat 7 a.m.-8 p.m. hours and the cooler rule come from the 2019 source and are unconfirmed for 2026. | **silence** |
| donald-w-reynolds-razorback-stadium | CFB | 2023-08-24 | partly-withdrawn | Razorback Transit now runs these as Route 88/89 (Silver/Gold survive only as legend aliases), starting 3 hours before kickoff not 4, with Dickson St/Road Hog/Baum East loading at Gate 1 ONLY and Lot 320 at Gate 16 ONLY — so our Gate 10 drop-off, our Lot 56 pickup and the Arkansas Union pickup are all gone. The operator contradicts itself on the lot: its maintained HTML and the 2025 athletics page say Lot 320 while its own Routes88_89.pdf (stamped 08/30/23) still says Lot 56, so which lot is served this season is genuinely unresolved. | **silence** |
| empower-field | NFL | 2025-10-27 | partly-withdrawn | RTD's D and H Lines have been suspended since 2026-06-07 for the Downtown Rail Reconstruction (D is additionally proposed for permanent discontinuation once the project finishes in 2027), so neither runs at any point in the 2026 NFL season and our "transfer to E" framing sends fans to trains that do not exist; the E and W lines and the stadium station are unaffected. The Denver Trolley shuttle is confirmed for all nine 2026 home dates but now sells a single $15 roundtrip ticket with no one-way, not the stored $10/$7. | **silence** |
| exploria-stadium | MLS | unknown | partly-withdrawn | LYNX cut LYMMO back on 2026-01-11: the Lime Line (Link 61) was realigned east of I-4 and no longer reaches Inter&Co Stadium or Parramore at all, leaving only the Grapefruit Line (Link 62), which now ends around 8:25 p.m. daily with 30-minute Sunday headways and carries a standing "Inter&Co Stadium Detour: Orlando Soccer Games" reroute — so after an evening kickoff there is no LYMMO ride home. Separately the stored source 301-redirects to a doubled-slash path that 403s; the live page is intercostadium.com/arrival and is itself undated. | **silence** |
| hard-rock-stadium | NFL/CFB | 2024-09-03 | partly-withdrawn | Brightline's stadium-side boarding point is settled against us (two current hardrockstadium.com pages, one stamped 2026-08-18, put shuttle pick-up/drop-off at NW 199th by the Gate 3 pedestrian bridge, not the Lot 18 bridge our text names), so the live doubt is the Uber Shuttle: the sweep called it dead, but the stadium still publishes a self-canonical Uber Shuttle page (sitemap lastmod 2026-07-27) while the 2026 rideshare page routes departing riders onto the GEICO HRS Express instead. The stadium's own two Brightline pages also disagree on the booking product name (End Zone Express vs Hard Rock Stadium Connect), and the stored source is a Dolphins release bylined 2024-09-03 that says '2024 season'. | **silence** |
| jones-stadium | CFB | 2026-07-15 | partly-withdrawn | Citibus's 2026 page confirms the gameday Park & Ride, the $6 fare and the pregame/postgame hours, but names four lots (USA Red Park & Pay, S1 Park & Pay, North HSC, North HSC ADA) and none of ours: 'Texas Tech Pkwy & 10th' appears nowhere on the site and 'John Walker Soccer Complex' only in the site-wide facilities nav, so it is unclear whether that pickup was dropped outright or folded into a renamed lot, and postgame boarding is now stated as 'the north entrance' rather than our Gate 3-4 area. Two side issues for the same edit: our stored 2016 URL 302s to texastech.com/sports/2026/7/15/gameday-in-raiderland, and the venue was renamed Galaxy Stadium on 2026-07-17. | **silence** |
| kenan-stadium | CFB | 2024-01-01 | partly-withdrawn | Chapel Hill Transit and move.unc.edu (dateModified 2026-08-21, season-anchored to UNC's six 2026 home games) agree the Tar Heel Express is $10 round-trip, Friday Center 3 hours out and Southern Village 2.5 hours out, so our $5 fare and 1.5-hour Southern Village time are flatly wrong. The real doubt is the downtown Carolina Coffee Shop pickup: it appears on no current starting-location list but survives as a vestigial 'downtown Chapel Hill' phrase in the Town page intro, whose 2026 football detail still reads 'coming soon', and the replacement Jones Ferry Park and Ride is confirmed by UNC's page alone. | **silence** |
| martin-stadium-northwestern-university | CFB | 2025 | partly-withdrawn | Northwestern's own 2026 schedule keeps only Sep 5 (South Dakota State) and Sep 19 (Colorado) at Martin Stadium; the five home games from Oct 2 onward move to the new Ryan Field on the Central Street side, so the CTA 201 / Purple Line-to-Noyes / Metra Evanston-Central directions are correct for two dates and point at the wrong building for the rest of the season. The cited Northwestern guide is also still the 2025 gameday page and the three operators (CTA, Metra) were never re-checked directly, so even the two good dates rest on a stale source. | **silence** |
| memorial-stadium-lincoln | CFB | unknown | stale-description | StarTran confirmed on the record it will not operate the Big Red Express in 2026; iPronto (Pronto Corporation) takes over from the Sep 5 opener serving the same four lots, but with advance ticket purchase required instead of walk-up boarding, and the 402-476-1234 number in our notes now reaches the wrong agency. Fares are not yet consistent between sources (KLIN reports $25/$30 round trip, iPronto's own table says $10 inbound plus $15-$20 return), and the two-hours-before / last-bus-45-minutes-before timings have not been reconfirmed under the new operator. | **silence** |
| moda-center | NBA/WNBA | unknown | partly-withdrawn | TriMet truncated the MAX Green Line to Clackamas Town Center to Gateway Transit Center on 2026-08-23, so it no longer reaches Rose Quarter Transit Center at all, yet our line list and note still tell riders the Green Line stops there next to Moda Center; TriMet's own Rose Quarter page now lists only Blue, Red and Yellow. Buses 4 and 44 still serve Rose Quarter but under retired names in our text, and Line 77 moved from NE 9th Ave to Grand/MLK, so its stop location near the arena is unverified. | **silence** |
| mt-bank-stadium | NFL | unknown | partly-withdrawn | RavensRide is confirmed running in 2026 (live per-game schedule and matching prices on ravensride.net), but the Owings Mills pickup we name is in doubt: our cited Ravens directions page carries no year and still lists "Hyatt Place, Owings Mills", while the operator's own 2026 pages list "Metro Centre - Owings Mills", a different site about 590 m away, and the string "Hyatt" appears nowhere on ravensride.net. The other four stops (White Marsh, Carney, Southwest, Westminster Target) and all prices agree across both sources, so the doubt is confined to which Owings Mills curb the bus actually uses. | **edit-label** |
| paycor-stadium | NFL | 2025-09-15 | temporary-disruption | TANK's Bengals game-day Southbank Shuttle still runs for every home game, but TANK's own special-event page says the Riverfront Transit Center is closed for repairs and the stop is "temporarily moved to 2nd street at the Freedom Center" with no stated end date, so we cannot tell whether the closure outlasts the 2026 season. Two further details in our note are wrong against TANK's standing service page and were not flagged: post-game service ends 30 minutes after the game, not the hour we promise, and the game-day product is a $4 round-trip pass rather than our "$2.00 per ride" (our cited news post even contradicts itself, saying "$1 a ride" in the body). | **silence** |
| sofi-stadium | NFL | 2026 | partly-withdrawn | GTrans confirms Line 7X survives into 2026-27 but, from Sept 13, runs only on Sundays with a scheduled SoFi game and explicitly not on Monday or Thursday night games, while our only source (sofistadium.com) still says it runs every Sunday. Torrance Transit's SoFi Special Service and Culver CityBus Line 99 Express could not be confirmed for 2026 at all: both operator sites 403 every automated path and the Internet Archive is blocked or offline for them, so their game-day status is genuinely unknown rather than verified. | **silence** |
| space-city-financial-stadium | CFB | 2025 | unconfirmed-this-season | The UH game-day shuttle (east-campus and north-end routes) has no 2026-dated confirmation: the cited guide is the 2025 edition and UH Parking's own current 2026 football page still links the 2025 map and tells fans to check back closer to the season, so the two-hours-before/one-hour-after window is unverified for 2026. The Cougar Line tracker still lists both stadium routes (Elgin/Stadium, University/Stadium) in its live roster, so it probably runs; note also that UH's own site still calls the venue TDECU Stadium rather than Space City Financial Stadium. | **leave** |
| target-center | WNBA/NBA | unknown | partly-withdrawn | SouthWest Transit's SW Shuttle still runs to Target Center for Timberwolves games and concerts, but its Lynx page now returns 404 and Lynx/WNBA appears nowhere in the operator's 2026 events index, navigation or sitemap, despite the WNBA season being in progress: the Lynx leg was removed, not merely unannounced. Our sentence says the shuttle 'runs to events' with no league scope, so on the WNBA-tagged page it reads as a Lynx option and needs scoping to Timberwolves/NBA games. | **edit-label** |

### would-mislead (17)

| Hub | League | Source date | Class | What is uncertain | Suggested |
| --- | --- | --- | --- | --- | --- |
| alumni-stadium | CFB | 2025-08-27 | temporary-disruption | All three MBTA branches run to BC, Cleveland Circle and Reservoir/Riverside as described; what is in doubt is downtown access on two home dates, since alert 1028281 suspends Green Line service between North Station and Babcock St (B) or Kenmore (C, D) on Sept 19-20, the Maine game, and the alert text says the work repeats Sept 26 to Oct 4, covering the Virginia Tech game. That second window is only asserted inside the first alert's text and is not yet posted as its own alert, so it needs a re-check before Sept 26 rather than a rewrite of year-round copy. | **leave** |
| boone-pickens-stadium | CFB | 2025 | stale-description | The downtown Stillwater shuttle (7th and Lewis to Hall of Fame/Knoblock) is confirmed running for 2026 but on different hours than we publish: 3 hours pre-game, then a real pause from 30 minutes after kickoff until the 3rd quarter, where our sentence promises continuous service through postgame. Genuinely in doubt is the ADA shuttle: the okstate.com/parking citation now redirects to the POSSE donor parking page, and the 2026 parking map shows only an ADA/mobility shuttle legend key, never naming the OSU Multimodal Transportation Terminal south of the Monroe Street garage that our text sends riders to. | **edit-label** |
| camp-randall-stadium | CFB | 2025-04-21 | stale-description | Bucky Shuttle (GO Riteway) is confirmed still running from Lots 60/64/76 at $10 round-trip, but two UW pages disagree on where Lot 64 riders board: the athletics shuttle page we cite says the metro bus stop on Observatory Drive, while UW's newer 2025 Football Parking & Transportation Map says the metro bus stop on Walnut Street across from Lot 64. The corners are adjacent (Metro's timepoint is 'Walnut & Observatory'), and 2026-specific artifacts (pass sales, the 2026 map) do not publish until the week before the Sept 6 opener, so the conflict cannot be settled right now. | **leave** |
| coca-cola-coliseum | WNBA | unknown | stale-description | TTC's current page routes riders on the 509 Harbourfront and 511 Bathurst streetcars straight through to Exhibition Loop, so our instruction to transfer to a '509/511 replacement bus toward Lake Shore and Bathurst' (the 2025 Bathurst/Fleet construction arrangement) points at a bus that no longer operates; live alerts show no such replacement. Two things stay unsettled: the TTC page covers only the Aug 21 to Sept 7, 2026 CNE window, in which the Manitoba Dr and Strachan Ave stops are themselves out of service, and Metrolinx's notice closing the Atlantic Ave sidewalk to the Exhibition GO platform is still stamped August 2025. | **edit-label** |
| crypto-com-arena | NHL/NBA/WNBA | unknown | temporary-disruption | LADOT's DASH Route F is on a dated southbound detour from Aug 5 to Nov 5, 2026, 6 a.m. to 5 p.m., that skips Figueroa St. & Pico Blvd. (#6144), the very L.A. LIVE stop our sentence promises, while northbound service and anything after 5 p.m. is untouched and the nearest retained stop (Figueroa & 12th) is about a block away. Route F's actual service days were never confirmed from an operator source, so the sweep's 'service continues daily' claim is unverified, and the flagged evidence URL is 403-blocked behind Cloudflare. | **edit-label** |
| everbank-stadium | NFL | 2026 | stale-description | JTA's Gameday Xpress is confirmed running the 2026 Jaguars season, but JTA's 2026 page and its 2026-stamped maps contain no Lot Z, Parker St, Lot C or Connexion at all — every pickup lot now unloads at one lot adjacent to the East gates, with all ADA pickup/drop-off at Lot B — and JTB Park-n-Ride is no longer a JTA origin even though the venue A-Z guide we cite still lists it. The ADA detail is the sharpest doubt: our sentence sends Connexion riders to Lot C when the operator says Lot B. | **silence** |
| huntington-bank-field | NFL | unknown | partly-withdrawn | GCRTA is settled: the live /routes/blueline and /routes/greenline pages both say riders continuing to the Waterfront Line must change trains at Tower City, and the Waterfront Line's permanent route description now limits it to Browns home games and select events (in-force alert lists the exact 2026-27 dates), so our 'W. 3rd St. Station (Blue, Green and Waterfront Lines)' clause is false. What nobody could verify is the venue's own copy — huntingtonbankfield.com/directions-parking/ returns 403 to curl, WebFetch and even the Wayback crawler, newest readable capture 2025-08-23 — so any rewrite should follow riderta.com rather than the stadium page. | **edit-label** |
| jack-trice-stadium | CFB | 2026-08-19 | stale-description | CyRide #3 Blue runs unchanged, but its current Saturday timetable (season-stamped Aug 17 2026 to May 14 2027) publishes a timepoint literally named 'Jack Trice Stadium' three stops past Lincoln Way & Beach, which sits about 1.5 miles away at the north edge of campus, so the operator contradicts our 'closest stop' sentence. Unresolved: whether #3 Blue actually serves that stadium timepoint on home football Saturdays — Iowa State's page says 'closest GAMEDAY stop' (a qualifier we dropped) yet CyRide publishes no football detour, and this needs a direct answer from CyRide before any replacement stop is named. | **silence** |
| lane-stadium | CFB | unknown | stale-description | Blacksburg Transit's 2026 football page still says game-day details "will be posted before the first game" (last updated 1/23/26), so the expanded schedule and postgame CAS routing in our notes are unconfirmed for 2026; meanwhile BT's Fall 2026 schedules contradict two stored claims outright, since TTH (the renamed Two Town Trolley, split into TTH/TTS on 2026-08-17) does terminate at the Maroon Loop at the Transit Center and the Orange Loop is in active service, not closed two hours after kickoff. What nobody established is where the CAS actually picks up postgame, so the one boarding instruction a fan would act on after the game is the least supported sentence in the block. | **silence** |
| memorial-stadium-clemson | CFB | 2016-09-26 | unconfirmed-this-season | No 2026 source confirms CATbus game-day service: Clemson's current gameday guide lists no transit at all, and Clemson Area Transit's new home (catbus.com now 301s to clemsoncity.org) names no football route despite being actively maintained in August 2026; the only description of game-day service is a Clemson Parking and Transportation page still stamped with the 2025 home schedule, saying the ordinary Red Route detours to Cherry Rd and Bryan Circle. The two dedicated football routes in the CATbus tracker both report IsRunning=false, but that registry retains plainly dead routes, so their status is genuinely unknown rather than evidence of withdrawal. | **re-source** |
| mercedes-benz-stadium | NFL/MLS | 2026-04-18 | temporary-disruption | MARTA's Rapid A-Line runs and South Downtown is a real named stop on the 04-18-2026 timetable, but Downtown Loop construction resumed 2026-07-22 and MARTA's site-wide alert (running to 2026-12-31) says temporary stops are in effect with most platforms closed, so for the whole 2026 Falcons/United season riders board at posted signs rather than the finished platform until final revenue service in Fall 2026. Where the temporary South Downtown boarding point actually sits is not published, and A-Line fare is not being collected at all, which the $2.50 note does not reflect. | **edit-label** |
| milan-puskar-stadium | CFB | 2025-09-23 | stale-description | The PRT's "free of charge" game-day claim appears on no WVU operator page for 2026 (prt.wvu.edu/how-to-ride lists visitors and community members at 50 cents with no game-day exception) and traces only to a 2025 athletics article, and the fixed "9:30 a.m. until one hour after the game" over-generalizes, since the opener posts adjusted 8:30 a.m.-5 p.m. hours and the postgame extension applies only when a game runs past the 5 p.m. Saturday close. MountainLine's Mountaineer Mall shuttle matches on route, pickup point and timing, but the operator says children 5 and under ride free, not 3, and the $3.00 cash fare omits the Token Transit $3.25 pass and two free-ride categories. | **edit-label** |
| neyland-stadium | CFB | 2019-07-29 | stale-description | KAT still runs buses from the Civic Coliseum garages to Neyland in 2026, but not on the terms we publish: KAT's current football page reclassifies it as a $30-per-vehicle park-and-ride that includes the ride and tells riders "Do not purchase a mobile football shuttle pass", so our "$10 round trip per person, tickets only through the Transit app" is wrong for that service. Separately, and unflagged in the sweep, the drop-off for both the Coliseum and Market Square services moved from the Stokely Garage (G16) on Volunteer Boulevard to the Walters Life Sciences Building, and KAT added an Old City shuttle on five SEC dates that we omit; our cited utsports.com/2019 page still resolves but describes none of this. | **silence** |
| saban-field-at-bryant-denny-stadium | CFB | 2022-08-25 | stale-description | The free Crimson Ride gameday shuttle to the Quad runs in 2026 under the same name, fare, east-campus coverage and 1.5-hours-postgame end time; only the start time is in doubt. Two independently modified UA Gameday pages (2026-08-06 and 2026-08-21) say service "begins at 6am (11am kickoff only)" and publish no start time for any other kickoff window, so our unqualified "begins at 7 a.m. on game days", which traces to a 2022 rolltide.com post, is uncorroborated for every window rather than merely an hour off. | **edit-label** |
| sanford-stadium | CFB | 2017-06-16 | stale-description | UGA Transportation & Parking Services' 2026 page says the East Campus Deck to Gate 6 shuttle (now the named 'S - Stadium Loop') begins 3.5 hours before kickoff and returns for 'at least 1 hour' after, while our 2016-sourced text promises 5.5 hours pre-game and two hours post-game. The shuttle itself, the Gate 6 destination and the Intramural Fields overflow pickup are all confirmed for 2026; only the timing numbers and the route's name are wrong. | **edit-label** |
| simmons-bank-liberty-stadium | CFB | 2024-08-22 | stale-description | The $10 University of Memphis Park & Ride shuttle still runs, but Memphis Athletics' Oct 2, 2025 traffic release gives it a named operator (Blue City Tours), moves the stadium-end drop-off to outside Gate 6 on Glenn Rogers, Sr. Street, and adds a free MATA shuttle to Early Maxwell/Central, which flatly contradicts our opening sentence that no MATA shuttle serves the stadium. Campus-side pickup and the $10 fare are unchanged, but 'card only' has not been restated since 2024 and nothing in the block carries a 2026 confirmation. | **silence** |
| subaru-park | MLS | 2024-09-08 | stale-description | The SEPTA Wilmington/Newark line runs unchanged, but our linked timetable is the Sept 8, 2024 edition and nearly every evening Chester TC departure has since moved; the current release is 'Effective July 5, 2026' at schedules.septa.org/current/WIL.pdf. The copy problem is the free Chester TC shuttle: its return staging point was relocated and the club's guide and directions pages now disagree (Front Street vs Seaport Drive) with our note carrying both, while the '20 minutes', 'four hours prior' and Union-matches-only specifics have no 2026-dated source. | **edit-label** |

### cosmetic (10)

| Hub | League | Source date | Class | What is uncertain | Suggested |
| --- | --- | --- | --- | --- | --- |
| acrisure-stadium | NFL/CFB | 2025-11-14 | name-only | Nothing about the service is in doubt for 2026: PRT still runs Red, Blue and Silver to Allegheny and North Side (several frequencies improved on the June 28 2026 adjustment, and the proposed 35 percent cut was averted for two years). Only the operator's name is wrong, confirmed by PRT itself ('In June 2022, Port Authority was rebranded to Pittsburgh Regional Transit'); the smaller open detail is that PRT spells the stop 'North Side' where our text says 'Northside'. | **edit-label** |
| arrowhead-stadium | NFL | unknown | name-only | The bus still serves the Truman Sports Complex, with timepoints on Blue Ridge Cutoff at 38th Terr and no active alerts, but RideKC's name for it is '47 - Martin Luther King Jr.' and no route on its 49-route roster carries 'Broadway' any more (the legacy /47-broadway/ page 404s), so a fan searching that name on RideKC.org finds nothing. Two citation defects to handle in the same edit: the stored source URL now redirects to arrowheadstadiumkc.com, and that stadium page is itself the origin of the retired name, so RideKC should be the naming authority. | **edit-label** |
| bank-of-america-stadium | MLS/NFL | unknown | source-broken-only | Nothing in the LYNX Blue Line copy is contradicted; panthers.com/traffic-parking is a hard 404 (served as a 296 KB branded soft-404 shell, so only the status code catches it) and the identical guidance, including Brooklyn Village/Carson/Convention Center and the $4.40 round trip, now sits at panthers.com/schedule/traffic-parking. Residual doubt worth flagging: CATS itself could not be reached (charlottenc.gov returns 403), so 2026 Blue Line operation rests entirely on that Panthers page, which carries only a 2026 copyright and no revision date. | **re-source** |
| casino-del-sol-stadium | CFB | 2022-08-30 | source-broken-only | Only the citation is broken: the stored A-Z Fan Guide URL double-encodes on redirect (%20 to %2520) into an empty Sidearm template with literal '@title'/'@description' placeholders, while the same guide is live at arizonawildcats.com/sports/2022/8/30/AZFanGuide with the Sun Link Streetcar, Cat Tran and Cat Cruiser facts intact. That live guide carries no update stamp and its path still reads 2022, so the Cat Cruiser timing (arrive about 2 hours before, depart 30 minutes after) is current-as-published only on the strength of the 2026 venue names inside it; do not repoint to the /2026/7/14/Casino-Del-Sol-Stadium page, which has no Sun Link or Cat Tran content. | **re-source** |
| great-american-ball-park | MLB | unknown | name-only | The operator (City of Cincinnati) brands the streetcar 'The Connector'; only the 'Cincinnati Bell' prefix in our label is out of date, inherited from the Reds' own transportation page, which still uses the retired sponsor name. Route, 3.6-mile loop, free fare, 365-day hours and Station 1 at The Banks were all confirmed unchanged on the operator site for 2026, so nothing but the name is in doubt. | **edit-label** |
| kauffman-stadium | MLB | 2026-01-01 | name-only | RideKC route 47 still runs daily past the Truman Sports Complex with no active service alerts; only the label is stale, and the legacy slug /routes-in-service/47-broadway/ 404s with no redirect, so a fan searching the operator's site by our name finds nothing. Note the bad name originates upstream in the Royals' own ballpark guide, so a re-scrape will reintroduce it, and KCATA's planned September 2026 service reductions were cancelled only by a late council funding vote worth re-checking next sweep. | **edit-label** |
| nrg-stadium | NFL | 2026-08-25 | name-only | Every service still runs (Red Line every 6-12 min with extra Texans game-day trains, plus the airport express), but three names in our text are retired: the complex is now Reliant Park / Reliant Stadium (nrgpark.com 301s to reliantpark.com and METRO's /nrg-park 301s to /reliant-park), METRO's station is officially "Stadium Park / Astrodome" rather than our "NRG Park Station", and route "500 IAH Express" is now "500 Downtown Direct" serving both Bush and Hobby. What remains unknown is when the rebrand happened and how far it has propagated: houstontexans.com still titles the building NRG Stadium and METRO still shows a legacy "Kirby @ NRG" street stop, so a rider may see both names in the wild. | **edit-label** |
| rose-bowl-stadium | CFB | 2026 | name-only | Nothing about the service is in doubt: the train to Memorial Park Station runs on Metro's June 7 2026 timetable, and the Union Station transfer from Metrolink still works. Only the name "Metro Gold Line" is retired (it became the A Line with the 2023 Regional Connector, and metro.net's line list returns zero hits for "gold"). Note that re-pointing the citation will not fix this: our source, UCLA's own current-season gameday page, still tells fans to take the Gold Line, so the correction has to be made in our copy against metro.net. | **edit-label** |
| soldier-field | MLS/NFL | unknown | name-only | CTA's live routes API and current GTFS both name route 146 'Inner Lake Shore/Michigan Express'; we store the retired 'Inner Drive' name inherited from the venue page, and the flagged 'Planned Reroute' alerts are Loop construction north of Roosevelt that leaves the Roosevelt-to-stadium leg intact. Separately our cited URL /plan-your-visit/directions-parking is a genuine 404 (the venue split it into /directions and /parking), so the citation needs repointing alongside the name fix, and the replacement page's 2026-08-06 lastmod would resolve evidentDate=unknown. | **edit-label** |
| wrigley-field | MLB | 2026-06-29 | temporary-disruption | Everything our note renders is Normal Service per CTA's API (Red Line at Addison, buses 152 and 22 at Clark & Addison); the only live change touching a service we list is a dated Blue Line O'Hare-branch schedule change, Aug 10 to Oct 9, 2026, adding 3-4 minutes between non-rush and weekend trips. The real doubt is the citation: the northsidebaseball source still routes Midway riders through the State/Lake elevated station, closed since 2026-01-05 and not reopening until 2029, and still gives the pre-2026 Cubs remote parking lot, so it should not be trusted for any further extraction. | **re-source** |

### none (1)

| Hub | League | Source date | Class | What is uncertain | Suggested |
| --- | --- | --- | --- | --- | --- |
| kyle-field | CFB | 2025-01-01 | stale-description | TAMU Transportation Services states outright that 'shuttle routes have changed this year' for 2026 (on-campus Agronomy/Bush Library/Stotzer/Bonfire/Reed-Olsen/WR, off-campus 22/26/31/35, plus a new Lot Y accessible pickup), while our text carries a 2025-01-01 stamp, but our text names no routes or times, so nothing rendered is actually contradicted. The free Bryan gameday shuttle was never independently re-checked for 2026, and no 2025-vs-2026 route diff was possible because the Internet Archive was offline. | **re-source** |

### If you want a default

Silence the 21 would-strand rows on the same mechanism as the eleven, since by the standard already applied they qualify. Re-point the 5 broken citations, which changes no user-facing copy. Take the 20 label edits as a batch when someone is next in the data. Leave the 3 temporary disruptions and re-check after the season settles. A scheduled source-URL check (dead, redirected, or dated before the current season) would stop this list regrowing without reading a word of any page.
## 14. Proposed copy changes for the remaining transit fields, for review before anything ships

**Nothing here has been applied.** Every row is a proposal. Each was drafted from the stored text, then handed to a second agent that re-fetched the proposed source and checked three things: that the page is live and carries the fact, that the change is minimal rather than a rewrite, and that no name or number appears that the source does not contain. 21 rows in, 21 out, identity diff clean.

**Scope correction.** The earlier count of 20 label edits assumed all 49 rows were still open. Four of them (citizens-bank-park, darrell-k-royal-texas-memorial-stadium, mt-bank-stadium, target-center) were judged would-strand and are now silenced in section 12, so they are no longer copy edits. That leaves 16 label edits and 5 re-sources, the 21 below.

Of the 21: 6 label-edit, 12 both, 3 re-source. Confidence: 12 high, 9 medium, none low. No proposal came back as "no change needed".

### A. Citation only, no user-facing copy changes (3)

Safe to apply without reading the prose: the facts were confirmed correct, only the URL behind them moves.

| Hub | League | Current source | Proposed source | Why |
| --- | --- | --- | --- | --- |
| bank-of-america-stadium | MLS/NFL | https://www.panthers.com/traffic-parking | https://www.panthers.com/schedule/traffic-parking | Prose and lines need no change: I fetched the relocated Panthers page myself (HTTP 200, canonical and og:url both self-referencing that path) and it carries every asserted fact verbatim, "Blue Line: Park at any Park and Ride station along t |
| casino-del-sol-stadium | CFB | https://arizonawildcats.com/sports/2022/8/30/A-Z%20Fan%20Guide.aspx | https://arizonawildcats.com/sports/2022/8/30/AZFanGuide | Verified independently: the proposed URL returns HTTP 200 with no redirect, is self-canonical, and carries every asserted fact on one page, its Phoenix Transport block reads "the Cat Cruiser transportation program for our fans in Phoenix... |
| kyle-field | CFB | https://12thman.com/feature/football-gameday | https://transport.tamu.edu/Parking/events/football.aspx | Verified independently today: the TAMU Transportation Services page returns HTTP 200 and carries every fact the prose and both labels assert, in the operator's own words, "Shuttle routes have changed this year but still take fans to Kyle Fi |

### B. Copy changes, one entry each

Ordered by rider impact: the ones that change a fact a fan acts on come first. Each shows the stored text and the proposal, with the operator evidence.

#### boone-pickens-stadium (CFB) — would-mislead, both, confidence medium

Stored text:

> Courtesy shuttle service from downtown Stillwater (7th and Lewis) to the stadium (Hall of Fame and Knoblock) begins 2 hours prior to kickoff and continues throughout post-game, with pick-up/drop-off approximately every 15 minutes. ADA shuttle picks up/drops off at the OSU Multimodal Transportation Terminal south of the Monroe Street Parking Garage.

Proposed:

> Courtesy shuttle service from downtown Stillwater (7th and Lewis) to the stadium (Hall of Fame and Knoblock) begins 3 hours prior to kickoff and runs until 30 minutes after kickoff, then resumes in the 3rd quarter and continues for a minimum of 30 minutes post-game, with pick-up/drop-off approximately every 15 minutes. ADA shuttle picks up/drops off at the OSU Multimodal Transportation Terminal south of the Monroe Street Parking Garage.

Source: https://okstate.com/sports/2015/3/17/GEN_2014010169 becomes https://okstate.com/documents/2025/11/18/Football-Parking-map-F26.pdf

Evidence: Hours change CONFIRMED, source claim CORRECTED. OSU's 2026 map, titled "2026 FOOTBALL CAMPUS TRANSIT" and stamped "MAP SUBJECT TO CHANGE - UPDATED 7/24/26", carries a GAMEDAY SHUTTLES panel reading "Shuttle service will begin three hours prior to game and will continue until 30 minutes after kickoff ... shuttles will resume in 3rd Quarter and continue for a minimum of 30 minutes post-game or until lines are gone", so the stored "2 hours ... throughout post-game" understates the pre-game window and denies a real mid-game gap; Visit Stillwater's 2026 guide attaches those same hours to "the shuttle at 7th and Lewis", confirming the panel describes this service and not the ADA shuttle, whose own hours differ. Two corrections to the draft I checked. First, the proposed URL is NOT application/pdf: fetched 2026-08-27 with a Chrome UA it returns HTTP 200 text/html, the okstate.com document landing page (title "Football Parking map F26 - Oklahoma State University Athletics", reached by redirect from okstate.com/FB-Parking) whose own HTML contains no shuttle text; the panel text lives in the PDF bytes at https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/okstate.com/documents/2025/11/18/Football-Parking-map-F26.pdf (HTTP 200, application/pdf). I keep the okstate.com landing page as the citation because it is on the operator domain and renders the map, but the reviewer should know the fact is in the embedded document. Second, the map does not support the whole paragraph: it has no "15 minutes" cadence, no "Multimodal" (zero hits), and never names 7th and Lewis or Hall of Fame and Knoblock as the endpoints, so the stored A-Z guide URL must be KEPT alongside the map rather than replaced (it is live, current-season, verbatim on those three facts, and stale only on the hours), and the ADA sentence is best cited to https://okstateposse.com/parking/ada-parking/, which states "pick-up and drop off point will be located at the OSU Multimodal Transportation Terminal located directly South of the Monroe Street Parking Garage". I also tightened the draft's wording: it read "pauses from 30 minutes after kickoff until the 3rd quarter, then runs for", which drops the stored verb "continues" and uses "pauses", a word no source uses; the version here follows the operator's own clause order and changes only the hours clause, leaving every other word and the entire second sentence untouched.

#### coca-cola-coliseum (WNBA) — would-mislead, both, confidence medium

Stored text:

> Exhibition GO station serves the venue at Exhibition Place. TTC directions route via a 509/511 replacement bus toward Lake Shore and Bathurst. GO Transit: 1-888-GET-ON-GO; TTC: 416-393-INFO.

Proposed:

> Exhibition GO station serves the venue at Exhibition Place. TTC directions route via the 509 Harbourfront or 511 Bathurst streetcar to Exhibition Loop. GO Transit: 1-888-GET-ON-GO; TTC: 416-393-INFO.

Source: https://www.coca-colacoliseum.com/plan-your-visit/directions-parking becomes https://www.ttc.ca/routes-and-schedules/509

Evidence: The text change stands and is verified: the venue page still literally reads "Transfer to 509/511 REPLACEMENT BUS towards LAKE SHORE and BATHURST," while TTC's own route data (ttcapi/routedetail id=509 and id=511, fetched 2026-08-27) says the 509 Harbourfront streetcar route "operates between Union Station on Line 1 Yonge-University and Exhibition Loop" and the 511 Bathurst streetcar route "operates between Bathurst Station on Line 2 Bloor-Danforth and Exhibition Loop," both inService with an in-service "TO Exhibition" branch, and the live-alerts feed (lastUpdated 2026-08-27T18:03:46Z, 19 route alerts) carries none on 509, 511 or 29. I corrected the proposed source: the CNE page it named is live and does state both routings, but it is headed "Friday, August 21 - Monday, September 7, 2026" and describes CNE-window-only conditions (the 509/511 stops at Manitoba Dr and Strachan Ave are out of service for that window), so citing it on a venue whose season runs October to April would replace one dated source with one that expires in eleven days; the year-round route page is the durable operator citation. Confidence is medium, not high, on four counts: the cited URL carries the 509 half only (the 511 half is verified on the parallel https://www.ttc.ca/routes-and-schedules/511), that page renders client-side so a curl returns an SPA shell and the facts come from its own ttc.ca route-detail endpoint, both route pages' directional prose says "buses" while their headers and the CNE page say streetcar, and the GO Transit line entry is not sourced by this TTC URL at all (the original proposal's claim that all four lines re-confirm on the TTC page is wrong for that entry) and still rests on the stale venue page, where "Lakeshore East-West line" mirrors the venue's own wording though Exhibition GO sits on Lakeshore West. That GO wording is not the flagged defect, so all four lines are left unchanged.

#### crypto-com-arena (NHL/NBA/WNBA) — would-mislead, label-edit, confidence medium

Stored text:

> Crypto.com Arena is blocks from the Metro A and B Lines. Nearest Metro Rail stop is Pico Station (A and E Lines); 7th St/Metro Center Station is also nearby for transfers. Metro Bus lines 28, 30, 81, 460 and the J Line stop near L.A. LIVE. DASH Bus Route F has several stops on Figueroa St. adjacent to L.A. LIVE. Metrolink and Amtrak connect to Downtown LA where riders transfer to Metro Rail.

Proposed:

> Crypto.com Arena is blocks from the Metro A and B Lines. Nearest Metro Rail stop is Pico Station (A and E Lines); 7th St/Metro Center Station is also nearby for transfers. Metro Bus lines 28, 30, 81, 460 and the J Line stop near L.A. LIVE. DASH Bus Route F has several stops on Figueroa St. adjacent to L.A. LIVE, though from August 5 to November 5, 2026, southbound buses are on detour between 6 a.m. and 5 p.m. and skip the stop at Figueroa St. and Pico Blvd., with the nearest listed alternative at Figueroa St. and 12th St. Metrolink and Amtrak connect to Downtown LA where riders transfer to Metro Rail.

Evidence: LADOT Transit's alerts feed (https://www.ladotbus.com/alerts, HTTP 200 fetched today) carries the alert verbatim, including dropped stop Figueroa St. & Pico Blvd. (#6144), which is the L.A. LIVE stop this sentence promises, and "DASH F" is still a live route entity on that feed alongside A/B/D/E with zero discontinue/suspend/rename hits, so the lines array stands unchanged. I reverted the proposed source swap: the LADOT feed carries none of the paragraph's other facts (zero hits for Pico Station, Metro Center, Metrolink, Amtrak, L.A. LIVE) and its alert record self-expires 2026-11-06T07:59:59Z, so LADOT belongs as a SECOND source on this field, not as a replacement for the arena page that sources the other four sentences.

#### huntington-bank-field (NFL) — would-mislead, both, confidence medium

Stored text:

> Closest station is W. 3rd St. Station (Blue, Green and Waterfront Lines), across the street from the stadium. Tower City Center Station is served by all four GCRTA rail lines (Red Line riders transfer there) and is about a 15-minute walk via W. 3rd Street. On Browns gamedays the Waterfront Line runs Tower City to South Harbor Station in the Municipal Parking Lot, and postgame service runs until all passengers have cleared W. 3rd St. Station. Free parking at GCRTA rail stations.

Proposed:

> Closest station is W. 3rd St. Station (Waterfront Line), across the street from the stadium. Tower City Center Station is served by all four GCRTA rail lines (Red Line riders transfer there) and is about a 15-minute walk via W. 3rd Street. On Browns gamedays the Waterfront Line runs Tower City to South Harbor Station in the Municipal Parking Lot, and postgame service runs until all passengers have cleared W. 3rd St. Station. Free parking at GCRTA rail stations.

Lines: `["GCRTA Waterfront Line","GCRTA Blue Line","GCRTA Green Line"]`

becomes `["GCRTA Waterfront Line (Browns home games and select major events only)","GCRTA Blue Line","GCRTA Green Line"]`

Source: https://huntingtonbankfield.com/directions-parking/ becomes https://www.riderta.com/routes/waterfrontline

Evidence: Verified on GCRTA's own site 2026-08-27: /routes/blueline and /routes/greenline both read "Customers continuing to the Waterfront Line will need to change trains at Tower City" and both describe service terminating at Tower City Rapid Station, so W. 3rd St. is reached by the Waterfront Line alone and the stored "Blue, Green and" is false; /routes/waterfrontline (HTTP 200) carries the permanent event-only description verbatim, "operates between Tower City and South Harbor Station in the Municipal Parking Lot during Cleveland Browns home games and select major events," which both justifies the line qualifier and confirms sentence three. Re-sourcing is forced because the stadium page returns HTTP 403 to a Chrome UA. I corrected the draft under review on two counts: it substituted a transfer clause ("Blue and Green Line riders change trains at Tower City") that is not on the cited waterfrontline page and that, compressed out of GCRTA's conditional phrasing, tells a rider they can reach W. 3rd St. via Tower City on any day, when the Waterfront Line runs only on the dates the in-force alert lists; deleting "Blue, Green and" is the smaller change, removes no correct information, and leaves sentences two and three to carry the Tower City walk and the gameday operation. Three reviewer notes, all left unedited under minimum change: GCRTA's own station label is "W. 3 (Stadium) Station" (riders-alerts/waterfront-line-service, which also lists the ten 2026-27 operating dates); the postgame "until all passengers have cleared" clause is unverifiable against GCRTA, which publishes fixed per-date end times such as 6:15 pm; and riderta.com/parking/ says free parking at "many" Rapid stations, not all, so the last sentence generalizes slightly.

#### memorial-stadium-clemson (CFB) — would-mislead, both, confidence medium

Prose unchanged.

Lines: `["CATBus"]`

becomes `["CATbus Red Route (home football games, drop-off and pickup on Cherry Rd and Bryan Circle)"]`

Source: https://clemsontigers.com/news/2016/09/26/gameday-guide-louisville-at-clemson becomes https://www.clemson.edu/campus-life/parking/parking-permits/permits/football-permits.html

Evidence: Verified today (HTTP 200, no Last-Modified header): Clemson Parking and Transportation Services states "Clemson Area Transit (CATBus) operates the Red Route during home football games. Due to road closures, the route drop offs and picks up on campus on Cherry Rd and Bryan Circle", so the bare "CATBus" label is replaced by the actual arrangement, a rerouted regular route rather than dedicated game-day service, and the 2016 single-game guide is dropped. Corrected against the reviewed draft on three points: the draft dropped the "picks up" half of the operator sentence (restored, since riders need the return leg), wrote "gamedays" where the operator writes "home football games", and its note that catbus.com redirects to clemsoncity.org/313/Routes-Services was wrong (it 301s to /310/Clemson-Area-Transit-CATbus; /313 lists Red - Central/Clemson under a Route Detours nav, not a roster of four live routes). Casing follows the operator, whose own site uses "CATbus" four times and "CATBus" never, though the cited campus page writes "CATBus". Confidence is medium, not high: the fact is verbatim on a live official page but that page is stamped to the 2025 season (Aug 30 LSU through Nov 22 Furman), no 2026 replacement is published, and the current clemsontigers.com gameday guide mentions no transit at all, so this row should ship flagged as awaiting 2026 confirmation.

#### mercedes-benz-stadium (NFL/MLS) — would-mislead, both, confidence medium

Stored text:

> $2.50 each way; SEC District Station is the preferred arrival/departure stop.

Proposed:

> $2.50 each way, though A-Line fares are not being collected until further notice; SEC District Station is the preferred arrival/departure stop.

Lines: `["MARTA rail — SEC District Station (formerly GWCC/CNN Center; preferred, at stadium doorstep)","MARTA rail — Vine City Station","MARTA Rapid A-Line BRT — South Downtown stop"]`

becomes `["MARTA rail, SEC District Station (formerly GWCC/CNN Center; preferred, at stadium doorstep)","MARTA rail, Vine City Station","MARTA Rapid A-Line BRT, South Downtown stop (A-Line in phase one service, no fare collected, board at posted signs)"]`

Source: https://www.mercedesbenzstadium.com/parking-and-transportation becomes https://itsmarta.com/Aline.aspx

Evidence: Corrects the submitted proposal on three verified points. (1) Scoping the fare to "MARTA rail" is backwards: MARTA's fare page (fare-programs.aspx 301s to itsmarta.com/ride/how-to-pay/fares-and-transfers, fetched today) prices the $2.50 standard one-way for "Rail, Bus, Rapid, and MARTA Reach", so Rapid is also $2.50 and the real corrective fact is Aline.aspx's "Fare will not be collected until further notice." (2) Aline.aspx contains zero occurrences of "South Downtown", and MARTA's explicit shifted-stop list is City Hall, Five Points, Convocation Center, Summerhill, Ormond Street, Peoplestown and Carver, so "(temporary posted stop during construction)" is an inference about that stop rather than an operator statement; the Route A timetable marked EFFECTIVE: 04-18-2026 confirms South Downtown as a named stop and contains no instance of "temporar". (3) The added paragraph is cut back to one clause because the stored $2.50 and the SEC District preference are both still verbatim on the venue page today; the retained qualifiers are operator-verbatim ("The Rapid A-Line is in service", "Fare will not be collected until further notice", "Look for posted signs nearby to board and exit"). Note for the reviewer: Aline.aspx is cited because it carries the corrective fare-waiver fact, but it does not carry $2.50, SEC District or South Downtown, so keeping the venue URL is a defensible alternative if the corrective clause is dropped.

#### milan-puskar-stadium (CFB) — would-mislead, both, confidence medium

Stored text:

> MountainLine stadium shuttle service begins two hours before kickoff and runs at least one hour after the game; cost is $3.00 round trip and children 3 and under ride free. The PRT runs on game days from 9:30 a.m. until one hour after the game and is free of charge.

Proposed:

> MountainLine stadium shuttle service begins two hours before kickoff and runs at least one hour after the game; cost is $3.00 round trip and children 5 and under ride free. The PRT runs on game days from 9:30 a.m. to 5 p.m., plus one hour after any game that ends past 5 p.m., and costs 50 cents for visitors.

Source: https://wvusports.com/news/2025/9/23/football-utah-game-information becomes https://prt.wvu.edu/how-to-ride

Evidence: Verified live today with a Chrome UA: busride.org/Football says "Cost per passenger is $3.00 round trip, children 5 and under ride free" and confirms the unchanged two-hours-before and one-hour-after shuttle timings, so only the number 3 moves to 5; prt.wvu.edu/how-to-ride prices "Everyone Else... visitors, community members" at 50 cents with no game-day exception anywhere on the page, so "free of charge" cannot stand; prt.wvu.edu/hours-of-operation (stamped August 6, 2026) gives Saturday 9:30 a.m. to 5 p.m. and extends service only "one hour after the conclusion of any home football or men's basketball game that extends past normal operating hours," which is load-bearing because the Sept. 12 1 p.m. kickoff ends near the 5 p.m. close and gets no extension. Against the reviewed draft I trimmed two non-minimal additions, the "adjusted hours posted for some dates" clause and the WVU students/faculty/staff free tier (the operator limits that tier to the Morgantown campus, so it misstates Tech, Potomac State and online students), and kept the stored "on game days" rather than "Saturdays" because all seven 2026 home games are Saturdays and the frame change is not needed for truth. Confidence is medium for the citation, not the facts: one source slot cannot carry a two-operator note, so busride.org/Football and prt.wvu.edu/hours-of-operation must join how-to-ride in sources, and note that how-to-ride carries a 2025-09-10 footer stamp that a staleness sweep will re-flag while the hours page is stamped 2026.

#### saban-field-at-bryant-denny-stadium (CFB) — would-mislead, both, confidence high

Stored text:

> Free Crimson Ride shuttle service to the Quad begins at 7 a.m. on game days and concludes 1.5 hours postgame, servicing east campus parking areas (East Campus RV lot, Lot A, Peter Bryce Blvd lots). Off-campus shuttles run from downtown, University Mall and Birmingham (uagameday.com/shuttles).

Proposed:

> Free Crimson Ride shuttle service to the Quad begins at 6 a.m. (11 a.m. kickoff only) on game days and concludes 1.5 hours postgame, servicing east campus parking areas (East Campus RV lot, Lot A, Peter Bryce Blvd lots). Off-campus shuttles run from downtown, University Mall and Birmingham (uagameday.com/shuttles).

Source: https://rolltide.com/news/2022/8/25/football-new-in-2022 becomes https://uagameday.com/shuttles/

Evidence: I fetched https://uagameday.com/shuttles/ today (HTTP 200, article:modified_time 2026-08-06): "The Crimson Ride is FREE for all fans on Gameday, servicing east campus public parking areas... East Campus RV lots, Lot A and parking lots located along Peter Bryce Blvd. Shuttle service to the Quad begins at 6am (11am kickoff only) on gameday and concludes 1.5 hours postgame", and the same page still carries the downtown, University Mall and Birmingham off-campus shuttles the second sentence names; uagameday.com/parking/ (modified 2026-08-21) independently repeats "Shuttles begin at 6 a.m. (11 a.m. kickoff only) on Gameday", and crimsonride.ua.edu points its own Gameday Information link at uagameday.com, making it the operator's authority rather than a team page. The 7 a.m. claim survives only in the 2022 rolltide.com post, so the number changes and the citation moves; against the draft I kept "on game days" (a correct fact the draft deleted) and used UA's verbatim "11 a.m. kickoff only" instead of "for 11 a.m. kickoffs", since dropping "only" lets a rider with a later kickoff read 6 a.m. as a general start time that UA publishes for no other window.

#### sanford-stadium (CFB) — would-mislead, both, confidence medium

Stored text:

> Complimentary shuttle from the Ramsey Center/Rec Sports Complex (East Campus Parking Deck bus area) to Gate 6 of Sanford Stadium before and after games. If overflow parking is used, shuttles also pick up at the Intramural Fields lot off College Station Road. Shuttles run continuously for 5.5 hours before the scheduled game time; return service runs continuously for two hours after the game ends.

Proposed:

> Complimentary S - Stadium Loop shuttle from the Ramsey Center/Rec Sports Complex (East Campus Parking Deck bus area) to Gate 6 of Sanford Stadium before and after games. If overflow parking is used, shuttles also pick up at the Intramural Fields lot off College Station Road. Shuttles begin 3.5 hours before the scheduled game time; return service runs continuously after the game until traffic patterns return to normal, at least one hour.

Lines: `["UGA Campus Transit complimentary gameday shuttle (East Campus Parking Deck/Ramsey Center to Gate 6)"]`

becomes `["UGA Campus Transit S - Stadium Loop complimentary gameday shuttle (East Campus Parking Deck/Ramsey Center to Gate 6)"]`

Source: https://georgiadogs.com/sports/2017/6/16/football-2016gamedaycentral-01 becomes https://tps.uga.edu/parking/football/

Evidence: Verified independently: tps.uga.edu/parking/football/ (Chrome UA, HTTP 200, no redirect, schema dateModified 2026-06-18) reads verbatim "via the S - Stadium Loop bus beginning 3.5 hours before kickoff" and "buses operate continuously after the game until traffic patterns return to normal, at least 1 hour", while the cited georgiadogs URL is confirmed 2016 season ("Football - 2016 Gameday Central", Sept 3 2016 vs UNC) and is the verbatim origin of the false 5.5-hour and two-hour figures; I kept the stored "before the scheduled game time" rather than the drafter's "kickoff" since it denotes the same instant and is the smaller edit, and I kept the drafter's removal of pre-game "continuously", which the 2026 page does not claim. Confidence is medium, not high, because the proposed URL does not carry three retained clauses: "Complimentary" (zero hits there, supported only indirectly by tps.uga.edu/transit/, "fare free and open to the public"), "Ramsey Center/Rec Sports Complex", and "off College Station Road" (found on no live UGA page I could fetch, only the 2016 source), so a reviewer may want to keep the georgiadogs URL as a secondary citation or drop the street name; note also the operator spells the route with an en dash, rendered here as a hyphen per the house dash rule.

#### subaru-park (MLS) — would-mislead, label-edit, confidence high

Stored text:

> Take the SEPTA Wilmington/Newark Regional Rail line to the Chester Transportation Center. A free shuttle runs to Subaru Park every 20 minutes, picking up at the corner of Seaport Drive and Reaney Street (across from Lot D). Additional details in the packet (service beginning four hours prior to game time, Philadelphia Union matches only, show a SEPTA ticket to board, returning shuttles along Front Street / Seaport Drive by the Subaru Gate) appear on the guide and directions pages rather than the cited transportation page.

Proposed:

> Take the SEPTA Wilmington/Newark Regional Rail line to the Chester Transportation Center. A free shuttle runs to Subaru Park every 20 minutes, picking up at the corner of Seaport Drive and Reaney Street (across from Lot D). Additional details in the packet (service beginning four hours prior to game time, Philadelphia Union matches only, show a SEPTA ticket to board, returning shuttles along Seaport Drive on the north side of the stadium) appear on the guide and directions pages rather than the cited transportation page.

Evidence: The club's directions page, fetched today (HTTP 200), states that shuttles returning to the Chester Transportation Center "will be parked along Seaport Drive on the north side of Subaru Park (just west of the intersection of Seaport and Reaney Streets)", and Wayback shows that page replaced its older Front Street wording between 2025-03-22 and 2025-07-30 while only the lagging guide page still carries it, so the Front Street half and its Subaru Gate locator are the stale instruction and drop out. The citation stays on the transportation page because that is the only page carrying this sentence's "every 20 minutes" and "across from Lot D" pickup facts (the directions page contains zero occurrences of either, or of "SEPTA ticket"), and the closing clause names it as the cited page.

#### acrisure-stadium (NFL/CFB) — cosmetic, label-edit, confidence high

Stored text:

> Take the 'T' to Allegheny Station (Allegheny Ave & Reedsdale St) or Northside Station (base of West General Robinson Street Garage); North Shore parking is reserved and pre-sold, downtown parking encouraged.

Proposed:

> Take the 'T' to Allegheny Station (Allegheny Ave & Reedsdale St) or North Side Station (base of West General Robinson Street Garage); North Shore parking is reserved and pre-sold, downtown parking encouraged.

Lines: `["Port Authority 'T' light rail (LRT)"]`

becomes `["Pittsburgh Regional Transit (PRT) 'T' light rail"]`

Evidence: Verified on PRT's own site today: the About Us history states verbatim "In June 2022, Port Authority was rebranded to Pittsburgh Regional Transit", and the How to Ride the Light Rail System page (HTTP 200) lists "Allegheny" and "North Side" as separate stations with zero occurrences of "Northside", so the agency label and that one spelling are the only changes. I reverted the drafter's source swap to PRT: the stored notes never name the operator (the stale name is only in lines[]), and PRT's page carries none of the paragraph's other facts (the 'T' name, Allegheny Ave and Reedsdale St, the West General Robinson Street Garage, the reserved and pre-sold North Shore parking), all of which the live Acrisure A-Z guide does carry, so the citation stays with the venue while PRT stands as the evidence for the line label.

#### arrowhead-stadium (NFL) — cosmetic, both, confidence high

Stored text:

> Bus transportation available through RideKC on the 47 Broadway line; see RideKC.org

Proposed:

> Bus transportation available through RideKC on the 47 Martin Luther King Jr. line; see RideKC.org

Lines: `["RideKC 47 Broadway"]`

becomes `["RideKC 47 Martin Luther King Jr."]`

Source: https://www.gehafieldatarrowhead.com/plan-your-visit/parking-transportation/game-plan becomes https://ridekc.org/getting-around/routes-in-service/47-martin-luther-king-jr/

Evidence: Verified independently today: the RideKC route page returns HTTP 200 with title and H1 "47 - Martin Luther King Jr.", contains zero occurrences of "Broadway", lists no Broadway route anywhere on its 49-route system roster, and the legacy slug /47-broadway/ returns 404, so the stored name sends a fan searching RideKC.org to nothing. The same page carries the venue relevance in the operator's own words, "daily service from KU Medical Center, to the Country Club Plaza, along Martin Luther King to the stadium area", plus timetable timepoints "ON BLUE RIDGE CUT OFF AT 38TH TERR NB/SB" and a route-specific point of interest for Kauffman Stadium at the Truman Sports Complex, and the stored stadium URL 301s to arrowheadstadiumkc.com where the page still prints the retired "47 Broadway", making it the origin of the error and the operator the naming authority. Reviewer caveat: RideKC's own points-of-interest page shows "No nearby routes available." for "Kansas City Chiefs and GEHA Stadium, 1 Arrowhead Dr" while listing the 47 for Kauffman at 1 Royal Way, though that same entry's prose says RideKC connections help fans access the Truman Sports Complex, so the empty widget contradicts its own page and does not contradict any word of the proposed text.

#### great-american-ball-park (MLB) — cosmetic, both, confidence high

Stored text:

> The Cincinnati Bell Connector streetcar runs a 3.6-mile loop connecting The Banks, Downtown and Over-the-Rhine; it is free to ride and Station 1 at The Banks is just steps from the ballpark. Cincinnati Metro buses serve Hamilton County; the Transit Authority of Northern Kentucky (TANK) provides bus service to and from Northern Kentucky; ACCESS provides transportation for guests with disabilities.

Proposed:

> The Connector streetcar runs a 3.6-mile loop connecting The Banks, Downtown and Over-the-Rhine; it is free to ride and Station 1 at The Banks is just steps from the ballpark. Cincinnati Metro buses serve Hamilton County; the Transit Authority of Northern Kentucky (TANK) provides bus service to and from Northern Kentucky; ACCESS provides transportation for guests with disabilities.

Lines: `["Cincinnati Bell Connector (streetcar)","Cincinnati Metro (bus)","Transit Authority of Northern Kentucky (TANK)"]`

becomes `["The Connector (streetcar)","Cincinnati Metro (bus)","Transit Authority of Northern Kentucky (TANK)"]`

Source: https://www.mlb.com/reds/ballpark/transportation becomes https://www.cincinnati-oh.gov/streetcar/

Evidence: Verified live 2026-08-27 (HTTP 200, Chrome UA): the operator brands it "The Connector" in the page title, H1, breadcrumb schema, nav and body prose ("The Connector is an electric-powered streetcar that operates along a 3.6-mile loop... It is free to ride"), and the hub's other stored source, mlb.com/reds/ballpark/information/guide, has already dropped the sponsor name itself ("The Connector is an electric mode of streetcar transportation operating on a 3.6-mile loop"), so operator and club now agree and the edit is a single 16-character deletion of "Cincinnati Bell" with no other fact touched. The loop wording "The Banks, Downtown and Over-the-Rhine" re-confirms verbatim on the operator's route page, https://www.cincinnati-oh.gov/streetcar/how-to-ride/hours-route-and-station-stops/, which also lists Great American Ball Park as a popular destination. IMPORTANT, the operator URL must be ADDED to sources, not substituted for the current one: mlb.com/reds/ballpark/transportation is the only page anywhere that supports the "Station 1 at The Banks" clause (the operator says "There are 18 stations" and never numbers them) and only the guide page supports Metro, TANK and ACCESS (the transportation page carries none of the three), so both Reds URLs must stay; the operator homepage's head metadata still reads "Cincinnati Bell ... 4-mile loop", unmaintained boilerplate contradicted by its own visible 3.6-mile copy, and a stale 2020 flyer image on the fares page keeps the old name in an alt attribute.

#### kauffman-stadium (MLB) — cosmetic, label-edit, confidence high

Stored text:

> The 47 Broadway serves Kauffman Stadium 7 days a week to Royals games and back; schedules at ridekc.org or 816-221-0660.

Proposed:

> The 47 Martin Luther King Jr. serves Kauffman Stadium 7 days a week to Royals games and back; schedules at ridekc.org or 816-221-0660.

Lines: `["47 Broadway (RideKC bus)"]`

becomes `["47 Martin Luther King Jr. (RideKC bus)"]`

Source: https://www.mlb.com/royals/ballpark/information/guide becomes https://ridekc.org/getting-around/routes-in-service/47-martin-luther-king-jr/

Evidence: Verified on the operator page (HTTP 200): RideKC names the route "47 - Martin Luther King Jr.", its prose reads "a bi-state route with daily service ... along Martin Luther King to the stadium area", it lists "Kansas City Royals and Kauffman Stadium" under its points of interest, and the footer prints Customer Service 816.221.0660; the ?service=saturday and ?service=sunday tabs return real timetables carrying the same Truman Sports Complex timepoints (BLUE RIDGE CUT OFF AT 38TH TERR, NB and SB, plus US 40 nearside Sterling) in both directions, so "7 days a week ... and back" is confirmed for all seven days, not just inferred from the word daily. The citation moves off the Royals ballpark guide because that page is where the retired name originates (it still reads "The 47 Broadway serves Kauffman Stadium 7 days a week") and RideKC's legacy slug /routes-in-service/47-broadway/ returns 404 with no redirect; the edit is a single token substitution, with the frequency, the phone number and every other clause byte-identical.

#### nrg-stadium (NFL) — cosmetic, label-edit, confidence high

Stored text:

> Exit at NRG Park Station off Fannin and enter Gate 2. From IAH airport take METRO 500 IAH Express to downtown then transfer to Red Line. METRO info 713-225-0119; 100% accessible with METROLift paratransit.

Proposed:

> Exit at Stadium Park / Astrodome Station off Fannin and enter Gate 2. From IAH airport take METRO 500 Downtown Direct to downtown then transfer to Red Line. METRO info 713-225-0119; 100% accessible with METROLift paratransit.

Source: https://www.nrgpark.com/plan-your-visit/ becomes https://www.ridemetro.org/riding-metro/houston-attractions/reliant-park

Evidence: METRO's attraction page for the venue (fetched today, HTTP 200; its /nrg-park URL now resolves to /reliant-park) names the stop "Stadium Park / Astrodome Station" and the "METRORail Red Line" at every 6-12 min with extra Texans game-day trains, and METRO's /transit-services/metrorail page independently lists it as "R2 - Stadium Park / Astrodome"; the route rename is verified on METRO's own live route page /park-and-ride-bus/route-details/500-downtown-direct, branded "500 DOWNTOWN DIRECT" and still serving IAH, since the cited attraction page carries zero occurrences of "IAH" or "Downtown Direct". I rejected the proposed 713-635-4000 phone swap: ridemetro.org/contact lists 713-225-0119 as METRO's own "METROLift Customer Service and Eligibility" line, so the stored number is correct and service-appropriate for this METROLift sentence, and "Gate 2" and "off Fannin" appear on no METRO page and stay sourced to the venue.

#### rose-bowl-stadium (CFB) — cosmetic, label-edit, confidence high

Stored text:

> Take the Metro Gold Line and exit at Memorial Park Station in Pasadena; from there walk approximately 2.4 miles to the stadium or purchase a Rose Bowl Shuttle pass. Metrolink trains arrive into Union Station where passengers transfer to the Metro Gold Line.

Proposed:

> Take the Metro A Line and exit at Memorial Park Station in Pasadena; from there walk approximately 2.4 miles to the stadium or purchase a Rose Bowl Shuttle pass. Metrolink trains arrive into Union Station where passengers transfer to the Metro A Line.

Lines: `["Metro Gold Line (exit at Memorial Park Station, Pasadena)","Metrolink (arrives Union Station; transfer to Metro Gold Line)"]`

becomes `["Metro A Line (exit at Memorial Park Station, Pasadena)","Metrolink (arrives Union Station; transfer to Metro A Line)"]`

Source: https://uclabruins.com/gameday-information becomes https://www.metro.net/destinations/rose-bowl/

Evidence: Rename verified, citation corrected: the submitted source, metro.net/riding/schedules/, contains zero occurrences of "Memorial Park" and so does not carry the station or transfer facts this copy asserts (those counts came from the linked timetable PDF, whose dated CDN filename rotates each service change), whereas Metro's own venue page at metro.net/destinations/rose-bowl/ (HTTP 200, no redirect, fetched today) states "Ride the Metro A Line. Exit Memorial Park Station.", names Memorial Park Station five times, lists "A Line Union Station $8" under park and ride, and says "Gold" nowhere. Reviewer note on two clauses left unchanged under the minimal-change rule: the same Metro page says "Walk 1.5 miles through the scenic Arroyo Seco trail" against the retained 2.4 miles, and calls the shuttle the "Foothill Transit Rose Bowl Shuttle" that "is free" against the retained "purchase a Rose Bowl Shuttle pass", so the UCLA gameday page should stay as a secondary citation for those two, or they should be resolved separately.

#### soldier-field (MLS/NFL) — cosmetic, both, confidence medium

Prose unchanged.

Lines: `["CTA Red Line","CTA Green Line","CTA Orange Line (Roosevelt Station)","CTA Bus 146 Inner Drive/Michigan Express","CTA Bus 130 Museum Campus (Memorial Day-Labor Day)","Metra (18th Street Station)"]`

becomes `["CTA Red Line","CTA Green Line","CTA Orange Line (Roosevelt Station)","CTA Bus 146 Inner Lake Shore/Michigan Express","CTA Bus 130 Museum Campus (Memorial Day-Labor Day)","Metra (18th Street Station)"]`

Source: https://www.soldierfield.com/plan-your-visit/directions-parking becomes https://www.soldierfield.com/plan-your-visit/directions

Evidence: Verified today: the venue's live Directions page (HTTP 200, sitemap lastmod 2026-08-06) carries every fact in the unchanged prose, namely Red/Green/Orange at Roosevelt with a "3/4 mile walk to stadium entrance", the 146 connection from Roosevelt Station to the stadium entrance on McFetridge Drive, "From Memorial Day to Labor Day, CTA bus route #130 Museum Campus", and "Metra's Soldier Field stop is the 18th Street Station, a short walking distance", while the stored directions-parking URL is retired (404 titled "Page Not Found | Soldier Field" under a Googlebot UA, HTTP 406 with an empty body under a Chrome UA, and absent from the sitemap). The lines label is the only change: CTA's live routes API (HTTP 200, TimeStamp 2026-08-27T17:02:57) returns ServiceId 146 as "Inner Lake Shore/Michigan Express", and CTA's ridership dataset shows that name replacing "Inner Drive" from December 2021 onward through June 2026. Reviewer caveat, and the reason confidence is not high: this proposed source does not itself support the renamed label, because the venue page still prints the retired "Inner Drive", and CTA's own route page at transitchicago.com/bus/146/ returns HTTP 403 to automated fetch, so the label edit needs the CTA routes-API citation carried alongside the venue URL rather than in place of it (repointing wholly to CTA would leave all five prose facts uncited).

#### wrigley-field (MLB) — cosmetic, both, confidence high

Prose unchanged.

Lines: `["CTA Red Line (Addison station)","CTA Bus #152 (Addison)","CTA Bus #22 (Clark)","CTA Blue Line (from O'Hare, transfer to #152 bus)","CTA Orange Line (from Midway)","CTA Yellow Line / Skokie Swift (from northern suburbs)","CTA Purple Line (from Wilmette)","CTA Brown Line (from LaSalle/downtown)"]`

becomes `["CTA Red Line (Addison station)","CTA Bus #152 (Addison)","CTA Bus #22 (Clark)","CTA Blue Line (from O'Hare, transfer to #152 bus)","CTA Orange Line (from Midway)","CTA Yellow Line / Skokie Swift (from northern suburbs)","CTA Purple Line (from Wilmette)"]`

Source: https://northsidebaseball.com/chicago-cubs-guides-resources/ultimate-fan-guide-wrigley-field-chicago/ becomes https://www.mlb.com/cubs/ballpark/information/guide

Evidence: I fetched the Cubs guide (HTTP 200) and it carries all three stored notes sentences verbatim, so the prose needs no change, and it independently carries seven of the eight lines (Red Line at Addison, buses 152 and 22 at Clark & Addison, Blue Line toward Forest Park to Addison then eastbound 152, Orange Line to a Roosevelt Red Line transfer, and Skokie Swift/Yellow plus Purple from Linden, Wilmette). The original proposal's claim that nothing in the lines moves is wrong: the guide contains no occurrence of "brown", "LaSalle", "Van Buren" or "Fullerton" in any case, so "CTA Brown Line (from LaSalle/downtown)" survives only on the northsidebaseball page being retired, and the City of Chicago CTA "L" stops dataset places Addison (Brown Line) 1.08 miles west of the Addison (Red Line) stop at Wrigley, making a bare Brown Line label under "Addison station" a wrong-platform hazard. Dropping that one entry is the minimum that leaves every remaining line carried by the sole cited source; the retirement itself is sound, since my own fetch of northsidebaseball still routes Midway riders to Lake/State (closed since 2026-01-05, reopening 2029) and still gives the pre-2026 remote lot at 3900 N. Rockwell with a one-hour return shuttle against the guide's 4650 N. Clarendon Ave. and 90 minutes. If a reviewer wants a downtown option back, it should be re-added naming the Fullerton transfer to the Red Line and cited to CTA directly, not to the Cubs guide.

### C. 7 rows still unassigned

These fall outside both sets. They were graded would-mislead rather than would-strand, so they were not silenced, and their classification recommended silencing or leaving rather than an edit, so no copy proposal was drafted for them. They need a call: silence them, commission a copy proposal like the ones above, or leave them and re-check after the season settles.

| Hub | League | Class | Recommended | What is uncertain |
| --- | --- | --- | --- | --- |
| alumni-stadium | CFB | temporary-disruption | leave | All three MBTA branches run to BC, Cleveland Circle and Reservoir/Riverside as described; what is in doubt is downtown access on two home dates, since alert 1028281 suspends Green Line service between North Station and Babcock St (B) or Kenmore (C, D) on Sept 19-20, the Maine game, and the alert tex |
| camp-randall-stadium | CFB | stale-description | leave | Bucky Shuttle (GO Riteway) is confirmed still running from Lots 60/64/76 at $10 round-trip, but two UW pages disagree on where Lot 64 riders board: the athletics shuttle page we cite says the metro bus stop on Observatory Drive, while UW's newer 2025 Football Parking & Transportation Map says the me |
| everbank-stadium | NFL | stale-description | silence | JTA's Gameday Xpress is confirmed running the 2026 Jaguars season, but JTA's 2026 page and its 2026-stamped maps contain no Lot Z, Parker St, Lot C or Connexion at all — every pickup lot now unloads at one lot adjacent to the East gates, with all ADA pickup/drop-off at Lot B — and JTB Park-n-Ride is |
| jack-trice-stadium | CFB | stale-description | silence | CyRide #3 Blue runs unchanged, but its current Saturday timetable (season-stamped Aug 17 2026 to May 14 2027) publishes a timepoint literally named 'Jack Trice Stadium' three stops past Lincoln Way & Beach, which sits about 1.5 miles away at the north edge of campus, so the operator contradicts our  |
| lane-stadium | CFB | stale-description | silence | Blacksburg Transit's 2026 football page still says game-day details "will be posted before the first game" (last updated 1/23/26), so the expanded schedule and postgame CAS routing in our notes are unconfirmed for 2026; meanwhile BT's Fall 2026 schedules contradict two stored claims outright, since  |
| neyland-stadium | CFB | stale-description | silence | KAT still runs buses from the Civic Coliseum garages to Neyland in 2026, but not on the terms we publish: KAT's current football page reclassifies it as a $30-per-vehicle park-and-ride that includes the ride and tells riders "Do not purchase a mobile football shuttle pass", so our "$10 round trip pe |
| simmons-bank-liberty-stadium | CFB | stale-description | silence | The $10 University of Memphis Park & Ride shuttle still runs, but Memphis Athletics' Oct 2, 2025 traffic release gives it a named operator (Blue City Tours), moves the stadium-end drop-off to outside Gate 6 on Glenn Rogers, Sr. Street, and adds a free MATA shuttle to Early Maxwell/Central, which fla |

### What to watch when applying

Nine of the 21 move the citation off a team or venue page and onto the transit operator. That is the right direction, since the operator is the naming authority and several of these venue pages are themselves the origin of the retired name (the Royals guide still prints "47 Broadway", the Arrowhead page the same). It does mean the source no longer carries the venue-specific clauses in the same paragraph, so the per-field provenance rule is satisfied for the transit fact while the surrounding detail traces to the venue page. Two proposals kept the venue citation for exactly that reason (acrisure-stadium, where only the line label was wrong).

## 15. Section 14 applied, six more silenced, verified at render

Executed 2026-08-27. Restore point for this write: `scripts/snapshots/cfb-venue-data-pre-2026-08-27T22-22-38-067Z.json`. Dry run before executing read 35 fields, 24 overwrites, 2 identical, 0 refused; all 20 hubs wrote in one pass with no partial failure; the closing dry run reads 0 to write, 37 identical.

**Applied: 20 of the 21 proposals.** Six renames (47 Broadway to 47 Martin Luther King Jr. at Arrowhead and Kauffman, Metro Gold Line to Metro A Line at the Rose Bowl, Cincinnati Bell Connector to The Connector, Port Authority to Pittsburgh Regional Transit, NRG Park Station to Stadium Park / Astrodome with 500 IAH Express to 500 Downtown Direct). Five substantive corrections (Boone Pickens shuttle window, Milan Puskar PRT hours and fare, Sanford shuttle timing and route name, Alabama Crimson Ride start time, Subaru Park return-shuttle location). Three citation-only re-sources, plus line-array corrections at Soldier Field, Clemson, Wrigley, Coca-Cola Coliseum and Mercedes-Benz.

**Huntington Bank Field was silenced instead of relabelled.** GCRTA publishes the Waterfront Line as event-only, running Tower City to South Harbor for Browns home games and select major events, and its Blue and Green Line pages both say riders continuing to the Waterfront Line change trains at Tower City. The proposed copy corrected the station list but carried the event-only qualifier **only in the lines array**, and the condensed block renders a first sentence, so a surface could show the service name without the restriction that makes it true. The ruling was silence unless every surface can carry the qualifier; it cannot, so it is silenced.

**Six more silenced, 38 in total**: huntington-bank-field plus everbank-stadium, jack-trice-stadium, lane-stadium, neyland-stadium and simmons-bank-liberty-stadium. alumni-stadium and camp-randall-stadium are left as recommended, to be re-checked after the season settles.

### Verified at render, entry 33 both modes

**Mode 1, served HTML, cache-busting fetch.**

- The six newly silenced venue pages: Transit row absent, TRANSIT chip absent, all 200. Getting-in cards keep 5 to 17 rows. `simmons-bank-liberty-stadium` shows no card at all, but it is `verified: false` and every Getting-in row gates on that flag, so its card was already empty and nothing changed.
- The 20 edited venue pages serve the corrected text: 19 of 20 matched on the first check. The exception is `sanford-stadium`, which serves no transit row because the building is `verified: false` and the venue page gates transit on it. Its corrected copy renders where it actually reaches readers, `/cfb/georgia`, which serves "Complimentary S - Stadium Loop shuttle from the Ramsey Center/Rec Sports Complex". No stale string survives on any edited page.
- CFB pages carrying edited copy all serve it: georgia 9 lines, alabama 9, oklahoma-state 8, west-virginia 10, texas-am 9, clemson 8, ucla 9, arizona 9.
- CFB pages on the newly silenced hubs: tennessee 8, iowa-state 6, virginia-tech 7, memphis 8, none carrying a Transit line, **none below the three-line minimum**. Across all 38 suppressed buildings, 21 CFB pages lose a Transit line and the lowest is `/cfb/miami` at 4.

**Mode 2, hydration.** Zero hidden duplicates everywhere: cfb/tennessee 8 of 8, cfb/georgia 9 of 9, cfb/alabama 9 of 9, cfb/memphis 8 of 8, venues/neyland-stadium 8 of 8, venues/kauffman-stadium 10 of 10, venues/rose-bowl-stadium 11 of 11, venues/huntington-bank-field 7 of 7, /nfl 81 of 81.

**A verification trap worth recording.** The first hydration run reported `total=0 visible=0 hidden=0` with exit code 0 on every page, which reads as a clean pass. The pages had not loaded at all: the preview share token was missing from the URL, so Puppeteer was measuring the SSO login page. **A zero-element result and a no-duplicates result are indistinguishable in that output.** Any hydration check whose element count is zero has proved nothing; assert a non-zero count before believing the hidden count, the same way the `<strong>Transit.</strong>` row check earlier needed a control page to show it could match at all.

### Two script defects the plan forced out

**A shared provenance key, the same shape as the failure in section 12's write.** `publicTransit.notes` and `publicTransit.lines` both derive their provenance to the single flat `sources.publicTransit`, so a naive plan would have submitted that path twice and been rejected exactly as `sources.gatesOpen` was. The fix is an explicit `sourceKey` override in the plan format: the collapse is now deliberate rather than incidental, and it also avoids writing dotted keys that would leave the flat key pointing at the superseded URL.

**A TLD whitelist rejecting a real operator.** The source validator required a `.edu`, `.com`, `.org`, `.gov` or `.net` host and refused `ttc.ca`, the Toronto Transit Commission. Whether a host is authoritative is a research judgment recorded in this report, not something a regex can decide, so the validator now only checks that a source is an http(s) URL with a real host.

## 16. The two consumers gate differently, measured

Report only, nothing changed. The same `venueHubs` document feeds two renderers with different admission rules, and this section measures the gap on all 86 buildings that have a CFB tenant, the only ones where both consumers run.

### The two models

**The venue page** (`/venues/[slug]`, via `venue-logistics.tsx` and `VenueHubView.tsx`) gates every fact card on the **doc-level `verified` flag** and nothing else. The file says so in its own header: "every fact card sits behind hub.verified exactly as it did inside the view." It does not read `sources` at all. One flag admits or withholds the whole page's facts.

**The CFB condensed block** (`/cfb/[school]`, via `venue-hub-condensed.ts`) gates each field on **its own provenance**, plus the conflicts and holds lists, and deliberately ignores `verified`. Its header is equally explicit: "Not the index floor, not the doc-level verified flag, not the tenant's verified flag."

Neither is wrong on its own terms. They answer different questions: "did a human vouch for this building?" versus "can this specific sentence be traced to a source?" The consequence is that the same stored value can render on one surface and not the other, in both directions.

### Measured, 86 CFB-tenant buildings

| Field | Venue page only | CFB block only | Both | Neither |
| --- | --- | --- | --- | --- |
| gates | 2 | 30 | 47 | 7 |
| bag | 0 | 13 | 70 | 3 |
| parking | 1 | 15 | 70 | 0 |
| tailgating | 3 | 12 | 66 | 5 |
| transit | 0 | 6 | 30 | 50 |
| rideshare | 0 | 3 | 35 | 48 |
| accessibility | 0 | 11 | 68 | 7 |
| outsideFood | 0 | 21 | 52 | 13 |
| food | 0 | 10 | 58 | 18 |
| nearby | 0 | 3 | 11 | 72 |

### Direction 1: the CFB block renders what the venue page withholds

**Cause: 13 CFB buildings carry `verified: false`**, so their venue pages render no fact cards at all while their school pages render every sourced field. They are: acrisure-bounce-house, autzen-stadium, bridgeforth-stadium-and-zane-showker-field, brooks-stadium, doak-campbell-stadium, huskie-stadium, ln-federal-credit-union-stadium, martin-stadium-northwestern-university, michie-stadium, michigan-stadium, navy-marine-corps-memorial-stadium, sanford-stadium, simmons-bank-liberty-stadium.

**This is deliberate and documented.** It is also the whole point of the per-field rule: a building nobody has signed off wholesale can still carry individually sourced facts, and the school page shows them. The gates column is the largest single case at 30, because gate rules live on tenant overlays whose own `verified` flag the venue page also requires.

**Sanford Stadium is the live case the last pass surfaced.** Its corrected transit copy, written in this session, renders on `/cfb/georgia` and nowhere else, because `sanford-stadium` is `verified: false`. Nothing is broken; the fact simply reaches readers on one of its two surfaces. The same is true of Michie Stadium's entire Army extraction and Autzen's entire Oregon extraction, both written this session, both `verified: false`, both visible only on the school page.

### Direction 2: the venue page renders what the CFB block withholds

Six buildings, three fields, and this is the direction that carries risk, because the withheld ones are withheld **for cause**.

| Field | Buildings | Why the CFB block withholds it | Still rendering on the venue page? |
| --- | --- | --- | --- |
| tailgating | david-booth-kansas-memorial-stadium, hard-rock-stadium, yulman-stadium | On `CONDENSED_CONFLICTS`: an official source contradicts the stored text | **Yes, verified on the preview** |
| gates | albertsons-stadium, allegacy-federal-credit-union-stadium | Truly unsourced; no provenance for the gate rule | **Yes, verified on the preview** |
| parking | acrisure-stadium | `officialParkingUrls` populated with no `sources.officialParkingUrls` | **Yes, verified on the preview** |

Fetched from the preview to confirm rather than infer:

- `/venues/yulman-stadium` serves "The Berger Family Lawn is the only tailgating location for the 2025 season", the stale 2025 capture that report section 4 records as conflicting with the club's rewritten 2026 page.
- `/venues/david-booth-kansas-memorial-stadium` serves the superseded permitted-lot list.
- `/venues/hard-rock-stadium` serves the tailgating rules whose pass-colour clause no official page supports.
- `/venues/albertsons-stadium` and `/venues/allegacy-federal-credit-union-stadium` serve gate rules that carry no provenance at all.

Coastal Carolina is the exception that proves the mechanism: `brooks-stadium` is also on the conflicts list, and its tailgating row is **absent** from its venue page, but only because the building is `verified: false`. The conflicts list played no part.

### Is the divergence deliberate?

**Direction 1: yes, by design, and the design is right.** Both files state the rule in their headers, and a test pins the condensed block's independence from `verified`.

**Direction 2: the mechanism is deliberate, the outcome is not.** The wiring check flagged this asymmetry when the block shipped, calling it "deliberate and this list is what closes it" for the CFB surface only. Nothing ever closed it for the venue page. So a conflict discovered by the sourcing pass is currently withheld from the school page and published on the venue page, which is the higher-traffic of the two for these buildings. That is not a considered position, it is an unclosed edge.

**Transit is the one field where the gap is already closed**, because `transitSuppressed` was wired into both consumers rather than into the condensed block alone. That is the shape a fix would take for the other two lists: a suppression consulted by every renderer, not a rule that lives inside one of them. The transit column above shows the effect, 0 in the venue-only column.

### What a fix would cost, if you want one

`CONDENSED_CONFLICTS` and the per-field provenance rule are both currently private to `venue-hub-condensed.ts`, which is CFB-scoped. Honouring them on the venue page means either lifting the conflicts list into a shared module the way `venue-transit-suppression.ts` already is (small, and it would silence 6 fields on 6 venue pages), or moving the venue page to per-field provenance wholesale (large: 13 buildings would lose every card they currently show, since `verified: false` and unsourced are not the same condition and many of those fields have no source recorded). The first is the proportionate one. Neither is done here.
## 17. Pre-merge adversarial review of the whole branch

Five lenses over the full diff against main, read as one change rather than as the sequence of passes that produced it: unprovenanced claims on any surface, consumers not covered by the wiring, guards that report success while measuring nothing, the Firestore write path, and copy correctness. 56 findings raised, each verified independently against the real code and the 223-hub dump, with a pre-existing condition counted as refuted unless this branch made it worse. **42 confirmed, 14 refuted, 0 left unverified** (verdicts reconciled against the raised list by identity, not by count).

**The branch is not ready to merge.** The confirmed set includes claims rendering without provenance on surfaces the wiring never reached, copy this pass wrote that renders false, and two suppression reasons that misdescribe the data they withhold.

### Verified by hand, because they are the ones that would ship something wrong

| # | What | Checked |
| --- | --- | --- |
| 1 | **/cfb/alabama renders a false sentence written by this pass.** Stored notes read "Free Crimson Ride shuttle service to the Quad begins at 6 a.m. (11 a.m. kickoff only) on game days...". The condensed block renders the first sentence, which the abbreviation split cuts at "begins at 6 a.m." | Reproduced: the qualifier does not survive. This is the huntington-bank-field failure mode recurring inside copy that was applied rather than withheld |
| 2 | **Autzen transit contradicts itself.** `lines` names "Lane Transit District (LTD)" while sentence 4 of the notes reads "Lane Transit District (LTD) is not running an Autzen shuttle this season" | Reproduced against Firestore; both were written by the Pass 2 execute |
| 3 | **52 verified venue pages lose their official-parking link row.** 166 verified hubs, 154 carry officialParkingUrls, only 102 carry `sources.officialParkingUrls` | Reproduced exactly. My sweep measured cards appearing and disappearing, not rows inside a surviving card, and it measured the 86-building CFB slice rather than all 166 |
| 4 | **The App State parking exclusion is now stale.** Pass 2 replaced the dead /renewals/ URL with the live Yosef Club page, so the entry withholds a link that is no longer dead | Reproduced: stored value is the corrected URL |
| 5 | **The bmo-field suppression reason describes another building.** It says "the stored routing sends riders to a TTC 509/511 replacement bus"; bmo-field's stored notes never mention one. That text belongs to coca-cola-coliseum and to bmo-field's source page | Reproduced against the stored notes |

### All 42 confirmed findings

| Severity | Location | Finding |
| --- | --- | --- |
| high | src/components/venue-hub/VenueHubView.tsx:187 | The bag fact-band chip renders raw dimensions and clear-bag state that the capsule beside it now withholds |
| high | src/lib/venue-bag-policies-data.ts:36 | /venues/bag-policies reads venueHubs bag values directly and consults neither exclusions nor provenance |
| high | src/lib/venue-hub.ts:914 | venueHubDescription still derives its meta description from raw fields, so the head promises facts the body withholds |
| high | scripts/cfb-transit-copy-plan.json:237 | Copy written this pass renders a false first sentence on /cfb/alabama: the "11 a.m. kickoff only" qualifier is dropped |
| high | scripts/populate-cfb-venue-data.ts:130 | Provenance writes bypass the overwrite guard entirely when the stored value already matches the plan |
| high | src/components/venue-hub/venue-logistics.tsx:147 | Provenance test cannot tell a malformed sources map from an absent key, so t-mobile-park silently loses six sections |
| high | src/components/venue-hub/venue-logistics.tsx:177 | 52 verified venue pages silently lose their official-parking links; the change was measured on 86 buildings and shipped to 166 |
| high | src/components/venue-hub/VenueHubView.tsx:109 | New per-field provenance gate strips seven cards from /venues/t-mobile-park, whose sources map is key/value inverted |
| high | src/lib/venue-hub.ts:122 | An inverted sources map (URL keys, title values) silently strips every field's provenance, blanking T-Mobile Park's page while its chips, FAQs, description and the MLB bag aggregator keep publishing the same facts |
| high | src/lib/venue-hub.ts:914 | venueHubDescription reads no provenance and no exclusion list, so the meta description and StadiumOrArena JSON-LD promise facts the page now withholds |
| high | src/lib/venue-transit-suppression.ts:69 | bmo-field is silenced on a reason that quotes a different building's stored text |
| high | src/lib/venue-transit-suppression.ts:170 | Three suppression reasons contradict the report's own verified findings, and two name neither a service nor an operator |
| medium | src/components/venue-hub/venue-logistics.tsx:177 | The venue page's per-field provenance gate is materially wider than the audit predicted and the widening was not measured |
| medium | src/components/venue-hub/venue-logistics.tsx:119 | The venue page's transit row consults suppression but never the exclusion list or transit provenance |
| medium | src/components/venue-hub/VenueHubView.tsx:291 | Plan-your-visit still serves tailgating-window prose and the lot-map link for buildings whose fields are excluded |
| medium | src/lib/venue-field-exclusions.ts:18 | Seven of the nine declared exclusion sub-keys are consulted nowhere, so a sub-field entry silently does nothing |
| medium | audit/cfb-venue-sourcing-report.md:1705 | Report section 16 is stale and now contradicts the code it describes, and contradicts itself |
| medium | audit/cfb-venue-wiring-check.md:192 | The wiring check's "only one building" measurement is both stale and wrong: barclays-center is a second case |
| medium | scripts/cfb-venue-data-plan.json:173 | Army `food` value is more specific than the report says its cited page can support |
| medium | scripts/cfb-venue-data-plan.json:511 | Autzen transit copy written by this pass names LTD as a line while its own text says LTD is not running |
| medium | scripts/populate-cfb-venue-data.ts:150 | After the partial failure the newest snapshot is not a restore point, and nothing in the script or the report says so |
| medium | scripts/populate-cfb-venue-data.ts:151 | The documented snapshot restore (`set()` of the JSON) converts Firestore Timestamps into plain maps |
| medium | src/components/venue-hub/venue-logistics.tsx:110 | The venue page's Transit row is the one field still rendered with no provenance test at all, and it does not consult the exclusion list either |
| medium | src/components/venue-hub/venue-logistics.tsx:110 | The venue page transit row is the only Getting-in row that got neither the provenance nor the exclusion gate |
| medium | src/components/venue-hub/VenueHubView.tsx:151 | The Plan-your-visit card renders an overlay tailgate window and the lot-map link with no exclusion check, so a hub whose tailgating field is withheld for conflict still serves a tailgating claim |
| medium | src/lib/__tests__/venue-field-exclusions.test.ts:57 | The test named for the array-provenance fix never touches the code it fixed |
| medium | src/lib/__tests__/venue-transit-suppression.test.ts:75 | The test that "pins" suppression away from the indexing floor cannot fail |
| medium | src/lib/venue-field-exclusions.ts:49 | App State parking-link exclusion was not lifted after the Pass 2 write corrected the dead link |
| medium | src/lib/venue-hub-condensed.ts:84 | The abbreviation split drops qualifiers or truncates mid-address on seven more school pages, so the huntington ruling is applied to one entry and not to the class |
| medium | src/lib/venue-hub.ts:914 | venueHubDescription and getVenueUtilityCounts were updated for suppression but not for the new provenance gate |
| low | src/app/nfl/page.tsx:146 | The NFL hub's primetime logistics render gate and lot text with no provenance or exclusion test |
| low | src/lib/venue-hub.ts:466 | The homepage utility counts no longer mirror the venue-page render gates the function is documented to mirror |
| low | audit/cfb-venue-sourcing-report.md:1207 | Homepage transit tile count in the report no longer matches what the tile will serve |
| low | scripts/check-hydration-duplicates.js:113 | Two NOT_THE_PAGE patterns can never match, because the haystack always starts with the URL |
| low | scripts/populate-cfb-venue-data.ts:81 | `sourceKey` override is free text and is never validated against the path or against any key a renderer reads |
| low | scripts/populate-cfb-venue-data.ts:83 | A plan entry with a missing `value` crashes with a TypeError instead of the designed PLAN ERROR listing |
| low | scripts/populate-cfb-venue-data.ts:144 | The write script announces "fields written: N" before writing anything, and a dry run with refusals exits 0 |
| low | src/components/venue-hub/venue-logistics.tsx:102 | The gate-variance sentence rides on the gatesOpen provenance key, so an unsourced variance renders alongside a sourced rule |
| low | src/lib/__tests__/venue-field-exclusions.test.ts:59 | The test that claims to cover array-valued provenance asserts nothing about arrays, and stringMap itself is unexported and untested |
| low | src/lib/venue-hub.ts:464 | The homepage utility-grid counts got the suppression fix but not the provenance fix, so its documented invariant is now false for three of four tiles |
| low | src/lib/venue-transit-suppression.ts:12 | "Silences the transit field ... at every surface that renders it" is not true of the team-page block, and the scan behind it covered only the first eleven |
| low | src/lib/venue-transit-suppression.ts:21 | "It matters for exactly one building, providence-park" is wrong by one after the list grew to 38 |

### The themes

**Surfaces the wiring never reached.** `venueHubDescription` still derives the meta description and the StadiumOrArena JSON-LD from raw fields, so the head promises what the body now withholds, and its own docstring says "Never promises a fact the page does not render". `/venues/bag-policies` reads bag values directly and consults neither list. The NFL hub still builds gate and lot text from raw overlays. The Plan-your-visit card renders overlay tailgate windows and the lot-map link ungated, so yulman-stadium still serves tailgating prose after its tailgating field was withheld. And the venue page's Transit row is the one Getting-in row that got neither the provenance test nor the exclusion test.

**Guards that measure nothing.** The test pinning suppression away from the indexing floor cannot fail: `IndexFloorFields` has no slug, so the floor could not consult suppression even if it wanted to. The test named for the array-provenance fix never exercises an array. Seven of the nine declared exclusion sub-keys reach no call site, so a sub-field entry naming one would silently do nothing.

**The write path.** A provenance write bypasses the overwrite guard when the stored value already matches the plan. The documented snapshot restore, a `set()` of the JSON, converts Firestore Timestamps into plain maps. And the post-partial-failure snapshot trap is real but recorded only in scanner-framework 6b.4, not in the script that produces it.

**Stale claims in my own audit.** Section 16 now contradicts the code it describes. The wiring check still says 32 suppressed buildings when the list holds 38, and its "only providence-park" floor measurement misses barclays-center. The homepage transit count in section 12 no longer matches what the tile serves.

### Recommendation

Do not merge. The five hand-verified items are user-facing and three of them were introduced by this branch rather than found by it. The proportionate order is: fix the two bad copy values in Firestore (Alabama, Autzen), lift the stale App State exclusion, correct the bmo-field reason, decide the 52 parking links deliberately rather than by omission, then close the four ungated surfaces, then correct the audit sections. The vacuous tests should be fixed in the same pass, since each one is currently evidence of nothing.

## 18. The abbreviation split, fixed on main and verified on production

Cherry-picked to main alone as `b7b59fe`: `leadSentences` plus its test, two files, no other change from the branch. Deployed, 41 affected paths revalidated, verified on production with cache-busting fetches.

**26 rendered leads change** (the earlier count of 23 used a narrower detector). Every one is text the split had cut; the column shows what each lead gained.

| # | Building | League | Field | Before (truncated) | After (complete) |
|---|---|---|---|---|---|
| 1 | allianz-field | MLS | accessibility | t side of the stadium near Simpson Street and can be accessed from St. | Anthony Avenue. |
| 2 | bmo-field | MLS | accessibility | ble seating sections marked with an 'A' after the section number (e.g. | 105A); sections 124A, 321A and 325A enter through Gate 5. |
| 3 | bridgeforth-stadium-and-zane-showker-field | CFB | publicTransit.notes | tival Conference Center Bus Stop, Convocation Center (University Blvd. | Bus Stop), Lot C3 (ADA Shuttle), Lot R10, and select area hotels and o |
| 4 | busch-stadium | MLB | rideshareDropoff | r on the east side of the building on Broadway just south of Clark St. | Taxi and rideshare pickups are located on the east side of the stadium |
| 5 | camp-randall-stadium | CFB | tailgating.timeWindow | a.m. for all other kickoff times; for Friday games lots open at 2 p.m. | Friends Meetinghouse parking begins three hours prior to kickoff. |
| 6 | davis-wade-stadium | CFB | tailgating.timeWindow | Tailgate tents may be dropped off in designated areas starting 5 a.m. | Friday. |
| 7 | donald-w-reynolds-razorback-stadium | CFB | tailgating.timeWindow | Tents, awnings and similar equipment may be set up starting at 5 p.m. | Friday before a game and must be taken down and removed by 12 noon the |
| 8 | everbank-stadium | NFL | nearby | ypress Parking, Sports Complex Garage, Arena Garage, Yates Garage; St. | Johns River Taxi also available |
| 9 | faurot-field | CFB | tailgating.timeWindow | no earlier than 8 a.m. on game day; tailgating sites open at 8:00 a.m. | (subject to change) and must be cleared and cleaned by midnight or 3 h |
| 10 | firstbank-stadium | CFB | accessibility | ADA drive-up parking available on game day in the 25th Ave. | Garage (near elevators/corners) and West Garage (both open 4 p.m.); Lo |
| 11 | gaylord-family-oklahoma-memorial-stadium | CFB | accessibility | ndow at the Athletics Ticket Office on the plaza level of the Asp Ave. | Parking Facility immediately west of the stadium (limited, first-come; |
| 12 | huntington-bank-stadium | CFB | tailgating.timeWindow | kends: lots open 6 hours prior to game time but no earlier than 7 a.m. | Weekdays: lots open 6 hours prior to game time but no earlier than 2 p |
| 13 | lambeau-field | NFL | tailgating.rules | itted in Lambeau Field-operated lots only, not in Titletown lots (e.g. | Lot 15). |
| 14 | lane-stadium | CFB | tailgating.timeWindow | Donor/public parking lots open 7 a.m. | Saturday for Saturday games (after 3 p.m. game day for non-Saturday ga |
| 15 | memorial-stadium-lincoln | CFB | tailgating.timeWindow | m. for kickoffs before 6 p.m. and at 11 a.m. for kickoffs after 6 p.m. | (exceptions: Lots 19, 20 and 21 open at 6 a.m. for 11 a.m. kickoffs an |
| 16 | michelob-ultra-arena | WNBA | nearby | Located inside Mandalay Bay Resort & Casino at 3950 Las Vegas Blvd. | South, Las Vegas, NV 89119. |
| 17 | milan-puskar-stadium | CFB | tailgating.timeWindow | aturday) unless otherwise noted, and tents may be erected after 7 a.m. | The adjacent Almost Heaven Village fan area is open from 3 1/2 hours b |
| 18 | q2-stadium | MLS | food | Concessions are operated by 512 Food Co. | Club menus are available in the Lexus Club, East Club, and Q2 Stadium  |
| 19 | rice-eccles-stadium | CFB | tailgating.timeWindow | Tailgate lots open at 6 a.m. | (other parking lots open five hours before kickoff) |
| 20 | rogers-centre | MLB | publicTransit.notes | nd is accessible on foot, by personal vehicle via major highways (e.g. | Highway 407 ETR), by bike, or by public transit including TTC, GO Trai |
| 21 | ross-ade-stadium | CFB | tailgating.timeWindow | Lots open eight (8) hours prior to kickoff but not earlier than 8 a.m. | (subject to change on weekday/Friday games); lots close two (2) hours  |
| 22 | saban-field-at-bryant-denny-stadium | CFB | publicTransit.notes | Free Crimson Ride shuttle service to the Quad begins at 6 a.m. | (11 a.m. kickoff only) on game days and concludes 1.5 hours postgame,  |
| 23 | snapdragon-stadium | MLS/CFB | outsideFoodRules | od is not permitted (stated for certain matches including the SDFC vs. | LA Galaxy match). |
| 24 | tropicana-field | MLB | food | er field, an open-air patio featuring local favorites from popular St. | Pete restaurants with a full-service bar serving Budweiser and local B |
| 25 | us-bank-stadium | NFL | publicTransit.notes | Light rail runs directly to the U.S. | Bank Stadium Station; 123+ Metro Transit bus routes serve downtown Min |
| 26 | yankee-stadium | MLS/MLB | publicTransit.notes | The No. | 4 and D trains make stops at the 161st Street/Yankee Stadium subway st |

Production checks: `/cfb/alabama` now serves the full Crimson Ride sentence including "(11 a.m. kickoff only)"; Davis-Wade and Arkansas both carry "Friday"; 25 of 26 confirmed on their venue page and the 26th (bridgeforth) on `/cfb/james-madison`, which is where it renders because that building is `verified: false`.

## 19. T-Mobile Park's inverted sources map, and the description audit

### The inversion (fixed, verified at render)

`venueHubs/t-mobile-park` stored `sources` as `{url: page title}` instead of `{field: url}`. Both values were strings, so `stringMap` accepted them and returned a map whose only keys were URLs. `hasProvenance` was therefore false for every field name, and the per-field rule withheld the whole page: a verified MLB ballpark reduced to a single card. Nothing errored, because **an absent key and a malformed key are indistinguishable downstream** \- the same shape as the array-valued-provenance defect and as `leadSentences`, where the failure is invisible at the point it happens.

Thirteen fields were re-pointed at the page that carries each value, each verified by fetching the page and matching a distinctive phrase. The mapping was not obvious: the bag facts are on neither cited page but on the `gate-bag-policy-faq` the doc already stored as `bagPolicyUrl` ("Clear plastic bags no larger than 12\" x 6\" x 12\" are permitted" is verbatim there), and `publicTransit` and `accessibility` belong to the disability access guide, which is what their stored text describes. Values were not touched.

At render, on the preview: the page goes from 2 rows and 2 cards to **6 Getting-in rows (Gates, Transit, Rideshare, Accessibility, Entry, plus the lot row) and 4 cards**, with 5 fact-band chips. Controls unchanged (target-field 8 rows, wrigley-field 11). Hydration clean, non-zero counts.

### Corpus scan

| Shape | Count | Hubs |
| --- | --- | --- |
| fully inverted (every key a URL) | 1 | t-mobile-park, now fixed |
| partially inverted | 0 | none |
| field key whose value is not a URL | 0 | none |
| unrecognised key | 3 | cotton-bowl-stadium `capacity`, darrell-k-royal `parkingLots:East Campus Garage`, mountain-america-stadium `tailgatingGrillRules` |

The three unrecognised keys are inert: each hub also carries the correct key for that field, so no provenance is lost and nothing renders differently. `stringMap` now warns when every key in a map is URL-shaped, and a test pins that an inverted map yields no field provenance.

### venueHubDescription and StadiumOrArena JSON-LD (reported, not changed)

The function builds a lead sentence plus a "Plus ..." topic list from six predicates that test raw field presence behind `verified` alone. Only `hasTransit` consults suppression; none consults the exclusion list or per-field provenance. The lead's bag sentence is **manufactured** by `bagAnswer` from `bagsProhibited` / `clearBagRequired` / `bagMaxDimensions`, and the same string is passed to `VenueHubJsonLd` as the `StadiumOrArena` description, so it reaches machines identically. This is the `leadSentences` class: the render step composes the claim, so provenance on the underlying records does not constrain what is asserted.

Measured across all 223 buildings:

| Problem | Count | Hubs |
| --- | --- | --- |
| "Plus ..." promises **parking** the page withholds | 3 | acrisure-stadium, fenway-park, lincoln-financial-field |
| "Plus ..." promises **gate times** the page withholds | 2 | albertsons-stadium, allegacy-federal-credit-union-stadium |
| lead asserts a bag fact from an **unsourced** field | 1 | hard-rock-stadium |
| lead that is factually false | 0 | none |

The first two are overstated coverage, not false facts. The third is the one that matters: `/venues/hard-rock-stadium` serves "A clear bag up to 12\" x 6\" x 12\" is **required**" in its meta description and in `StadiumOrArena` JSON-LD, while the page's own capsule reads "**MAX BAG SIZE** 12\" x 6\" x 12\"" because `clearBagRequired` carries no source and the capsule withholds it. One document, two answers about the same policy, and the machine-readable copy makes the stronger claim.

Stated precisely, because the distinction decides the fix: that claim is not demonstrably **false** \- Hard Rock's recorded conflict was about tailgating pass colours, not bags \- it is **unverifiable by this project's own standard**, asserted on a surface that no longer asks for provenance. Nothing was changed.
## 20. Re-triage of the 42 findings against the suite

Every finding re-checked against HEAD by RUNNING something rather than reading: a throwaway test that fails on current code for a live defect, or passes and would have failed before for a fixed one. All throwaway files deleted; the worktree is clean. 41 of 42 came back from the batch and the identity diff caught the drop; id 11 was triaged by hand.

| | Count |
| --- | --- |
| fixed since the review | 8 |
| still open, LIVE (has instances now) | 23 |
| still open, LATENT (wrong code path, 0 instances) | 11 |

**Test reach: 5 of 34 open findings would be caught by an existing test. 28 are newly provable but uncovered, 1 is not testable here.** The glob fix made them *provable*; it did not make them *covered*. That gap is the honest state of the suite.

### Fixed, each demonstrated by a run

- An inverted sources map (URL keys, title values) silently strips every field's provenance, blanking T-Mobile Park's page while its chips, FAQs, description and the MLB bag aggregator keep publishing the same facts
- The venue page's Transit row is the one field still rendered with no provenance test at all, and it does not consult the exclusion list either
- The venue page's per-field provenance gate is materially wider than the audit predicted and the widening was not measured
- Provenance test cannot tell a malformed sources map from an absent key, so t-mobile-park silently loses six sections
- The venue page's transit row consults suppression but never the exclusion list or transit provenance
- The venue page transit row is the only Getting-in row that got neither the provenance nor the exclusion gate
- Copy written this pass renders a false first sentence on /cfb/alabama: the "11 a.m. kickoff only" qualifier is dropped
- New per-field provenance gate strips seven cards from /venues/t-mobile-park, whose sources map is key/value inverted

### Merge blockers

| Severity | Where | What |
| --- | --- | --- |
| high | src/components/venue-hub/venue-logistics.tsx:186 | 51 verified venue pages silently lose the official-parking link row, and 4 lose the whole Parking lots card |
| high | src/lib/venue-hub.ts:945 | venueHubDescription and getVenueUtilityCounts never got the provenance gate, so meta, JSON-LD and the homepage tile advertise facts the page withholds |
| high | src/components/venue-hub/VenueHubView.tsx:167 | The Plan-your-visit card publishes the overlay tailgate window on the same page whose Tailgating row is withheld for conflict |
| high | scripts/populate-cfb-venue-data.ts:126 | populate-cfb-venue-data.ts rewrites existing provenance with no overwrite:true and reports it as a new field |
| medium | src/lib/venue-bag-policies-data.ts:44 | /venues/bag-policies is a second venueHubs consumer with its own conflict list and no shared per-field rule |
| medium | src/lib/venue-field-exclusions.ts:50 | The App State parking exclusion is stale: it withholds a corrected, sourced, live link, and a green test pins the defect |
| medium | src/components/venue-hub/venue-logistics.tsx:113 | An unsourced gate variance rides into the Gates row on the rule's provenance key |
| medium | src/app/nfl/page.tsx:145 | The /nfl primetime card quotes building prose with no provenance, no exclusion and no doc-level verified gate |

**The largest is a regression this branch introduces.** On main, `officialParkingUrls` renders on `verified` alone; on the branch it needs `sources.officialParkingUrls`. Re-measured: 166 verified buildings, 154 carry the URLs, 103 carry the source key, so **51 pages lose the "Official parking:" row** and three of them (acrisure-stadium, chase-field, fenway-park) lose the whole Parking lots card. Only one of the 51, kidd-brewer-stadium, is a deliberate sub-exclusion. That was measured on the 86-building CFB slice and shipped to all 166.

### Every still-open finding, live first

| Live | Inst | Finding | Surfaces | Test |
| --- | --- | --- | --- | --- |
| live | 52 | 52 verified venue pages silently lose their official-parking links; the change was measured on 86 buildings and shipped to 166 | /venues/{slug} (ParkingLotsCard, mounted only by VenueHubView via src/app/venues/[slug]/page.tsx; VenueLogisti | uncovered |
| live | 10 | "Silences the transit field ... at every surface that renders it" is not true of the team-page block, and the scan behind it covered only the first el | The team-page venue block (VenueInfoBlock, dark variant at :39 and light variant at :62 inside AffiliateRail)  | uncovered |
| live | 6 | venueHubDescription reads no provenance and no exclusion list, so the meta description and StadiumOrArena JSON-LD promise facts the page now withholds | /venues/<slug> — the <meta name="description"> (src/app/venues/[slug]/page.tsx:46) and the StadiumOrArena `des | uncovered |
| live | 6 | Report section 16 is stale and now contradicts the code it describes, and contradicts itself | None user-facing; audit/cfb-venue-sourcing-report.md section 16 (lines 1641-1705). | uncovered |
| live | 5 | Provenance writes bypass the overwrite guard entirely when the stored value already matches the plan | none rendered (no surface prints a source URL); the damage is to the Firestore provenance record and to the dr | uncovered |
| live | 5 | The abbreviation split drops qualifiers or truncates mid-address on seven more school pages, so the huntington ruling is applied to one entry and not  | /cfb/[school] condensed logistics block only — buildCondensedLogistics has exactly one consumer (src/component | uncovered |
| live | 4 | After the partial failure the newest snapshot is not a restore point, and nothing in the script or the report says so | none user-facing; the operator restore path (scripts/snapshots/*.json, gitignored) — the misleading artifacts  | uncovered |
| live | 3 | The homepage utility-grid counts got the suppression fix but not the provenance fix, so its documented invariant is now false for three of four tiles | homepage 'Going to the Game?' grid — the visible '{n} venues' line in GamedayUtilityGrid.tsx:88 and the gameda | uncovered |
| live | 3 | venueHubDescription still derives its meta description from raw fields, so the head promises facts the body withholds | <meta name="description"> via generateMetadata in src/app/venues/[slug]/page.tsx:46, and the same string as th | uncovered |
| live | 3 | Three suppression reasons contradict the report's own verified findings, and two name neither a service nor an operator | The reason strings are internal (module data, not rendered). The consequence reaches /venues/target-center and | uncovered |
| live | 2 | Plan-your-visit still serves tailgating-window prose and the lot-map link for buildings whose fields are excluded | /venues/{slug}, the Plan-your-visit card (VenueHubView.tsx lotOpenLines built 166-171, printed 317-324; the lo | uncovered |
| live | 2 | The homepage utility counts no longer mirror the venue-page render gates the function is documented to mirror | Homepage / (GamedayUtilityGrid "Going to the Game?" -> "Gate Times" card, which prints "{count} venues") vs /v | uncovered |
| live | 2 | venueHubDescription and getVenueUtilityCounts were updated for suppression but not for the new provenance gate | /venues/{slug} meta description (app/venues/[slug]/page.tsx:46) and the same string as the Place JSON-LD descr | uncovered |
| live | 2 | The Plan-your-visit card renders an overlay tailgate window and the lot-map link with no exclusion check, so a hub whose tailgating field is withheld  | /venues/yulman-stadium and /venues/hard-rock-stadium — the Plan-your-visit card, on the same page whose Gettin | uncovered |
| live | 2 | "It matters for exactly one building, providence-park" is wrong by one after the list grew to 38 | None user-facing today; the wrong claim is in the venue-transit-suppression.ts module header (lines 7 and 21)  | uncovered |
| live | 1 | Army `food` value is more specific than the report says its cited page can support | /cfb/army - the condensed "Gameday at Michie Stadium" block's Concessions line (buildCondensedLogistics ignore | uncovered |
| live | 1 | Autzen transit copy written by this pass names LTD as a line while its own text says LTD is not running | /cfb/oregon condensed logistics block, Transit line (the venue page is silent: autzen-stadium is verified:fals | uncovered |
| live | 1 | App State parking-link exclusion was not lifted after the Pass 2 write corrected the dead link | /venues/kidd-brewer-stadium Parking lots card (the 'Official parking:' row never renders). The /cfb/appalachia | uncovered |
| live | 1 | The gate-variance sentence rides on the gatesOpen provenance key, so an unsourced variance renders alongside a sourced rule | The "Gates" row of the Getting-in card on /venues/notre-dame-stadium. Not the gates FAQ or FAQPage JSON-LD (ga | uncovered |
| live | 1 | /venues/bag-policies reads venueHubs bag values directly and consults neither exclusions nor provenance | /venues/bag-policies (rows, glance stats, group headers, FAQ and the ItemList JSON-LD) versus /venues/[slug].  | uncovered |
| live | 1 | The bag fact-band chip renders raw dimensions and clear-bag state that the capsule beside it now withholds | The fact band on /venues/hard-rock-stadium, directly contradicting the bag capsule on the same page. The dimen | uncovered |
| live | 1 | Homepage transit tile count in the report no longer matches what the tile will serve | None user-facing. The defect is in audit/cfb-venue-sourcing-report.md line 1207 (section 15). The homepage til | uncovered |
| live | 1 | bmo-field is silenced on a reason that quotes a different building's stored text | /venues/bmo-field: the Getting-in Transit row (proven absent), plus the TRANSIT fact-band chip (VenueHubView.t | uncovered |
| latent | 0 | The NFL hub's primetime logistics render gate and lot text with no provenance or exclusion test | /nfl — the primetime game cards (src/app/nfl/page.tsx:143-149 → src/components/hub/NflWeekContainer.tsx:171, r | uncovered |
| latent | 0 | The test that "pins" suppression away from the indexing floor cannot fail | none (test-quality defect: src/lib/__tests__/venue-transit-suppression.test.ts:75-82) | uncovered |
| latent | 0 | The wiring check's "only one building" measurement is both stale and wrong: barclays-center is a second case | none (internal doc audit/cfb-venue-wiring-check.md section 9, line 192 and the table at 195-197) | uncovered |
| latent | 0 | `sourceKey` override is free text and is never validated against the path or against any key a renderer reads | none today (all 37 overrides in scripts/cfb-transit-copy-plan.json are the correct "publicTransit"; zero in th | uncovered |
| latent | 0 | A plan entry with a missing `value` crashes with a TypeError instead of the designed PLAN ERROR listing | none (developer-facing: the dry-run validation loop in scripts/populate-cfb-venue-data.ts) | uncovered |
| latent | 0 | The documented snapshot restore (`set()` of the JSON) converts Firestore Timestamps into plain maps | none today; on any restore, /sitemap.xml lastmod for every restored building (getIndexableVenueHubSitemapEntri | uncovered |
| latent | 0 | The test named for the array-provenance fix never touches the code it fixed | none directly (test suite only) — but the untested branch feeds every per-field provenance gate on /venues/{sl | uncovered |
| latent | 0 | Two NOT_THE_PAGE patterns can never match, because the haystack always starts with the URL | none user-facing — scripts/check-hydration-duplicates.js, a dev/CI verification script | uncovered |
| latent | 0 | The write script announces "fields written: N" before writing anything, and a dry run with refusals exits 0 | none user-facing — scripts/populate-cfb-venue-data.ts operator transcript and its exit code | uncovered |
| latent | 0 | The test that claims to cover array-valued provenance asserts nothing about arrays, and stringMap itself is unexported and untested | none directly (a test-suite coverage hole). A regression in the Array branch would silently blank sourced bag/ | not-testable-here |
| latent | 0 | Seven of the nine declared exclusion sub-keys are consulted nowhere, so a sub-field entry silently does nothing | none | uncovered |

### Two things the re-triage found that the first review did not

**A new live instance on /nfl.** The primetime card reads `hub.parkingLots` and `hub.publicTransit` without testing `hub.verified` at all, which is the first gate every `/venues` renderer applies. `highmark-stadium` is `verified: false` and not suppressed, so a Bills primetime card publishes `NFTA Game Day Express` transit prose that `/venues/highmark-stadium` renders nowhere.

**The inverted-map guard is narrower than it reads.** `stringMap` warns only when EVERY key is URL-shaped. t-mobile-park's repaired map still holds its two leftover URL keys beside the field keys, so a partial inversion would pass silently, and re-inverting the Firestore data would fail no test. The code-shape reintroduction is covered; the data shape is not.
