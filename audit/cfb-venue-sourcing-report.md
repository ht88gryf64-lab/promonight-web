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
