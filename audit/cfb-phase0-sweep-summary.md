# CFB Phase 0 sweep, surviving findings

Generated 2026-08-25 from audit/cfb-phase0-sweep.md (workflow wf_1d1aa4ec-bcd, 4 finders, 68 flagged findings, one adversarial verifier each). This file lists the 61 findings whose verifier returned refuted=false. The 7 refuted findings, all verifier reasoning, and the finders' inventory notes are in the sweep file and are deliberately not repeated here.

Severity is assigned by rule, not by the verifiers: high = a false or unbacked claim on an indexed surface, a live font fallback, or readable text under 3.0:1; medium = readable text between 3.0 and 4.45:1, an unconditional heading over missing data, a noindexed surface, or editorial content maintained in code; low = text on the 4.5:1 line, a hover or wash-dependent case, a latent path with no live instance, or a comment inaccuracy. Ratios quoted are the finders' computed values; the browser-measured values in the Phase 0 report agree with them.

Counts: 61 surviving (high 19, medium 24, low 18). Per dimension: traditions 18/18, counts 1/1, fonts 5/5, tokens 37/44.

Phase 0 item key: "Item 6" is the sitewide-passes item (fonts, tokens, contrast); "Also-report" items are the two extra asks (tradition claims without backing data, hardcoded counts in DOM or schema).

## Also-report: tradition and unbacked claims (18)

| # | sev | file:line | renders in | finding |
|---|---|---|---|---|
| 1 | high | `src/app/cfb/page.tsx:120` | visible DOM | The hub renders a 'THEME GAMES ACROSS THE COUNTRY' section heading plus subhead promising theme-game content, but no theme-game data exists on any page it links to. |
| 2 | high | `src/components/cfb/CfbSchoolPage.tsx:389` | visible DOM | Contributor CTA on all 87 school pages states 'Written by people who actually go' as a standing fact, but no contributor-written content exists on any page; the sentence also uses an em dash in user-facing copy. |
| 3 | high | `src/components/cfb/hub/blocks.tsx:116` | visible DOM | Each hub theme card labels a school '· THEME NIGHT' and links to a school page that carries no theme-night content. |
| 4 | high | `src/components/cfb/hub/CfbTodaySlot.tsx:19` | visible DOM | Asserts 'theme Saturdays' as a class of content the site carries, followed by 'This week’s games are below' (line 21); no theme Saturday has a date anywhere in the data. |
| 5 | high | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:280` | visible DOM | The 'The trophy' section heading renders unconditionally, so on the 7 of 32 matchup pages whose rivalry doc has trophy: null the section is titled 'The trophy' and contains no trophy. |
| 6 | high | `src/lib/cfb/hub-data.ts:63` | visible DOM | Founding years are hardcoded string literals rendered as 'EST. {year}' instead of being derived from cfbRivalries.seriesStartYear, which exists on all 212 docs. |
| 7 | high | `src/lib/cfb/hub-data.ts:63` | visible DOM | Four editorial rivalry narratives and host descriptors are hardcoded in code and rendered as page copy; no rivalry doc carries a narrative field to back them. |
| 8 | high | `src/lib/cfb/hub-data.ts:65` | visible DOM | Red River trophy name is a hardcoded literal on the hub block rather than cfbRivalries.trophy; the other three curated blocks omit the trophy the data does carry. |
| 9 | high | `src/lib/cfb/hub-data.ts:66` | visible DOM | Hardcoded 'EST. 1904' on the Florida vs Georgia hub block contradicts the live cfbRivalries.seriesStartYear (1915) that the linked matchup page renders as 'Series began 1915'. |
| 10 | high | `src/lib/cfb/hub-data.ts:74` | visible DOM | Four theme-night identities are hardcoded in code rather than derived from cfbTraditions; three of the four have no tradition doc at all. |
| 11 | high | `src/lib/cfb/metadata.ts:266` | meta description and JSON-LD | The /cfb/rivalries description promises 'the kickoff' for every rivalry on a page that renders no kickoff at all, and 'Every major ... rivalry' for a curated 32-slug registry. |
| 12 | high | `src/lib/cfb/rivalry-index.ts:78` | visible DOM and JSON-LD | FAQ answer promises 'Series history' and 'trophy details ... on each rivalry page'; the rivalry page has no series history (one start year only) and 7 of 32 pages have no trophy. |
| 13 | medium | `src/app/cfb/contribute/page.tsx:37` | visible DOM | Contribute page repeats 'Written by people who actually go' as a present-tense fact with zero published contributor content; em dash in user-facing copy. |
| 14 | medium | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:23` | visible DOM | Generic factual assertions ('Rivalry games sell out', 'Rooms near campus go early') render on all 32 matchup pages with no data behind them. |
| 15 | medium | `src/lib/cfb/page-extras.ts:130` | visible DOM | A hardcoded 56-entry chant/entrance map renders as the hero kicker on school pages; it is tradition content maintained in code rather than in cfbTraditions, which has a kind: 'entrance' slot for exactly this. |
| 16 | low | `src/lib/cfb/hub-data.ts:63` | visible DOM | Hardcoded fallback game dates render as a real date on the national block whenever the pair's game is absent from cfbGames, with no visual distinction from a data-backed date. |
| 17 | low | `src/lib/cfb/matchup-description.ts:99` | meta description and visible DOM | The dormant-rivalry description tier promises 'Series history, past results' that no field in the corpus can supply. |
| 18 | low | `src/lib/cfb/metadata.ts:155` | meta description | The destination-tier meta description promises 'a gameday guide and tailgating' (also lines 156-157) that the template cannot render because the read layer never loads editorial content regardless of editorialStatus. |

## Also-report: hardcoded counts (1)

| # | sev | file:line | renders in | finding |
|---|---|---|---|---|
| 19 | high | `src/lib/cfb/hub-data.ts:66` | visible DOM | The /cfb hub renders a hardcoded 'EST. 1904' for Florida vs Georgia while the live cfbRivalries doc florida--georgia carries seriesStartYear 1915, which /cfb/rivalries/florida-georgia renders as 'Series began 1915'; the two surfaces contradict each other and the hub value has no data backing. |

## Item 6: font dependence (5)

| # | sev | file:line | renders in | finding |
|---|---|---|---|---|
| 20 | high | `src/app/cfb/page.tsx:140` | visible DOM | This is the only HubVenueLinks mount on the site whose wrapper does not carry archivoHouse.variable, so its font-rd classes cannot resolve here (see HubVenueLinks.tsx:58 finding). |
| 21 | high | `src/components/hub/HubVenueLinks.tsx:58` | visible DOM | The /cfb hub's STADIUM GUIDES section uses font-rd (compiled: .font-rd{font-family:var(--font-archivo),system-ui,sans-serif}) but no ancestor on /cfb defines --font-archivo, so the declaration is invalid at computed-value time and the block inherits Outfit from <main>; it has never rendered Archivo on this page. |
| 22 | medium | `src/app/venues/bag-policies/page.tsx:148` | visible DOM | The bag-policies wrapper applies rd-root (compiled .rd-root{font-family:var(--font-archivo),system-ui,sans-serif}) but attaches only barlowCondensed.variable, never archivoHouse.variable, so the rd-root font-family declaration is invalid at computed-value time and the entire page body except the CONDENSED sites inherits DM Sans from <body>; this is the entry-24 failure mode recurring on a page that consumes the CFB condensed font module. |
| 23 | low | `src/app/globals.css:109` | not rendered | This comment (and the matching one at globals.css:329-330, 'var(--font-rd) is no longer emitted at :root') is false: the compiled CSS emits every @theme inline font token as a :root alias, which agrees with docs/known-issues.md:1140 ('@theme inline still emits :root aliases') and contradicts the code comment. |
| 24 | low | `src/components/cfb/cfb-bits.tsx:13` | visible DOM | CFB's mono chain references the @theme token --font-mono instead of the concrete next/font chain var(--font-dm-mono), monospace that the entry-24 rule requires; it resolves today only because the :root alias is still emitted and --font-dm-mono sits on <html> (the same element as :root), so the substitution succeeds at declaration point. |

## Item 6: contrast and color tokens (37)

| # | sev | file:line | renders in | finding |
|---|---|---|---|---|
| 25 | high | `src/components/cfb/CfbSchedule.tsx:37` | visible DOM | 10px week number at white/30 fails 4.5:1. |
| 26 | high | `src/components/cfb/hub/blocks.tsx:116` | visible DOM | 9px opacity-modified text over the raw school primaryColor with only a partial scrim; ThemeCard has no too-light guard (line 109 falls back only when the color is missing), so a light primary fails. |
| 27 | high | `src/components/cfb/hub/CfbHubBrowse.tsx:77` | visible DOM | 10px readable note at white/30 fails 4.5:1 (the count itself is derived from the total prop = data.totalTeams, not hardcoded). |
| 28 | high | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:198` | visible DOM | Separator glyph at white/25 is far under 4.5:1 and is not marked decorative. |
| 29 | medium | `src/app/cfb/page.tsx:36` | visible DOM | 10px readable freshness/week meta at white/35 fails 4.5:1. |
| 30 | medium | `src/app/cfb/rivalries/page.tsx:70` | visible DOM | 13.5px 'vs' connector at white/35 fails 4.5:1 on both card grounds. |
| 31 | medium | `src/app/cfb/rivalries/page.tsx:76` | visible DOM | 12px venue name (meaningful fact text) at white/40 fails 4.5:1; only the trophy child overrides to GOLD. |
| 32 | medium | `src/app/cfb/rivalries/page.tsx:107` | visible DOM | 15px derived game count at white/35 fails 4.5:1. |
| 33 | medium | `src/app/cfb/rivalries/page.tsx:124` | visible DOM | 13px derived count at white/35 fails 4.5:1. |
| 34 | medium | `src/app/cfb/rivalries/page.tsx:195` | visible DOM | 13px readable definition sentence at white/40 fails 4.5:1. |
| 35 | medium | `src/components/cfb/cfb-bits.tsx:97` | visible DOM | 10px readable meta text at white/35 fails 4.5:1. |
| 36 | medium | `src/components/cfb/CfbConferenceSubRow.tsx:26` | visible DOM | 11px white text on the legacy --color-accent-red fill fails 4.5:1, and the element also carries hover:opacity-90. |
| 37 | medium | `src/components/cfb/CfbSchedule.tsx:40` | visible DOM | 10px home/away/conference marker at white/35 fails 4.5:1. |
| 38 | medium | `src/components/cfb/CfbSchedule.tsx:78` | visible DOM | 10px broadcast network at white/40 fails 4.5:1. |
| 39 | medium | `src/components/cfb/CfbSchedule.tsx:81` | visible DOM | 12px 'Kickoff TBA' at white/40 fails 4.5:1; this is the state most rows are in. |
| 40 | medium | `src/components/cfb/CfbSchoolPage.tsx:365` | visible DOM | 9px readable caption at white/40 fails 4.5:1 on every plausible ground of the rivalry card. |
| 41 | medium | `src/components/cfb/ContributeForm.tsx:49` | visible DOM | 16px placeholder text at white/30 fails 4.5:1 on all seven fields. |
| 42 | medium | `src/components/cfb/ContributeForm.tsx:56` | visible DOM | 14px label hint at white/40 fails 4.5:1. |
| 43 | medium | `src/components/cfb/ContributeForm.tsx:59` | visible DOM | 14px label hint at white/40 fails 4.5:1. |
| 44 | medium | `src/components/cfb/ContributeForm.tsx:87` | visible DOM | 12px readable note at white/40 fails 4.5:1. |
| 45 | medium | `src/components/cfb/hub/blocks.tsx:98` | visible DOM | 8px white text on the raw-hex red badge fails 4.5:1. |
| 46 | medium | `src/components/cfb/hub/CfbHubBrowse.tsx:70` | visible DOM | 16px placeholder at white/35 fails 4.5:1. |
| 47 | medium | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:218` | visible DOM | 'vs' at white/40 fails 4.5:1; 18px/600 is below the 18.66px-bold large-text threshold so the 3:1 bar does not apply. |
| 48 | medium | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:301` | visible DOM | 11px source citation text and its hostname links at white/40 fail 4.5:1 (links inherit the color; hover raises it only to /70). |
| 49 | low | `src/app/cfb/rivalries/page.tsx:64` | visible DOM | 15px row date at white/45 sits on the 4.5:1 line on both card variants. |
| 50 | low | `src/app/cfb/rivalries/page.tsx:159` | visible DOM | 13px breadcrumb link at white/45 sits exactly on the 4.5:1 line. |
| 51 | low | `src/app/cfb/rivalries/page.tsx:189` | visible DOM | 14px derived count at white/45 sits on the 4.5:1 line. |
| 52 | low | `src/components/cfb/cfb-bits.tsx:67` | visible DOM | Whole-element opacity modifier applied to a 9-10px bold text pill at hover; lowers the accent-ink/accent-fill ratio below its construction floor. |
| 53 | low | `src/components/cfb/CfbSchedule.tsx:137` | visible DOM | --cfb-accent's 4.5:1 floor is proven against #111111 (L 0.0056), but this box composites to #181a20 (L 0.0104), a lighter ground the guarantee does not cover. |
| 54 | low | `src/components/cfb/CfbSchoolPage.tsx:104` | visible DOM | Opacity-modified white text over the hero wash; contrast depends on wash. |
| 55 | low | `src/components/cfb/CfbSchoolPage.tsx:178` | visible DOM | 10px opacity-modified date text sits exactly on the 4.5:1 line and drops below it on hover. |
| 56 | low | `src/components/cfb/hub/blocks.tsx:21` | visible DOM | 10-11px white school-name links sit at the TOP of the diagonal block where the scrim is only 0.14 black over the raw team primary; contrast depends on fill and fails for light primaries. |
| 57 | low | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:85` | visible DOM | 11px stat labels at white/45 sit on the 4.5:1 line. |
| 58 | low | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:196` | visible DOM | 12px breadcrumb links at white/45 sit exactly on the 4.5:1 line. |
| 59 | low | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:257` | visible DOM | Three 13px section headings at white/45 sit exactly on the 4.5:1 line. |
| 60 | low | `src/components/cfb/rivalry/RivalryMatchupPage.tsx:336` | visible DOM | 14px sibling date at white/45 sits on the 4.5:1 line. |
| 61 | low | `src/components/hub/HubVenueLinks.tsx:67` | visible DOM | Shared component, but on the CFB hub its 12.5px secondary line at white/45 sits exactly on the 4.5:1 line. |

