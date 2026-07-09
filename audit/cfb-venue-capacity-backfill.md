# CFB Venue Capacity Backfill — verify-gated (2-source)

**Generated:** 2026-07-08 · **Branch:** `cfb-phase3` (local, NOT pushed) · **Data-layer only.** Populated `cfbVenues.capacity` (+ audit trail) for corroborated venues; no page/schema change beyond capacity + its provenance fields.

## Headline

- **77** venues had null capacity (Phase-2 gap; 9 already had it → **86** total).
- **64 / 77 now populated + 2-source corroborated** → **73 / 86** venues now show capacity.
- **13 left NULL and flagged** (under-populate, never guess): **6 disagree** (Wikipedia vs official differ materially — stale-official-vs-current or seated-vs-total; never averaged), **7 single-source** (no independent official source found).

## Method — same 2-source discipline as the rest of the build

- **SOURCE 1 (deterministic):** the FOOTBALL infobox capacity from the venue's own Wikipedia page — the SAME Phase-2-resolved stadium page (via `cfbVenues.source`), so the number can't come from the wrong stadium. Extractor prefers the "present"-annotated current value (fixing a real oldest-first history bug that had mis-taken stale values for Glass Bowl 11,500→26,038 and Valley Children's 30,000→40,727), strips refs/annotations, and for multi-config domes takes the FOOTBALL config specifically (JMA Dome → 42,784, not basketball 33,000).
- **SOURCE 2 (independent official):** a per-venue research pass (10 agents) that found an official athletics/stadium/university source stating the football capacity, with a verbatim quote + URL. Wikipedia/mirrors/aggregators were forbidden as source 2. Trap checks applied (football stadium not arena/baseball/practice; stated capacity not record attendance; right city). Agents returned null rather than guess when no official source was found.
- **Gate:** store capacity ONLY when both sources agree within an expansion tolerance (≤3% or ≤1,500). A low-confidence official source counts only when it agrees TIGHTLY (≤0.5%/300). Disagreements are NOT averaged — they're flagged and left null. Stored value = the Wikipedia figure (deterministic, current), corroborated. Audit trail stored: `capacityVerified=true`, `capacitySources=[wikiUrl, officialUrl]`, `capacityVerifiedAt`.

## Spot-checks (hand-verified against reality)

| Venue | Stored | Reality | Note |
|---|---|---|---|
| Huntington Bank Stadium (Minnesota) | **50,805** | 50,805 | wiki == official, exact ✓ |
| Bryant–Denny Stadium (Alabama) | **100,077** | ~100,077 | wiki == official, exact ✓ |
| Michigan Stadium | **107,600** | ~107,601 | wiki 107,600 ≈ official 107,601 ✓ |
| Beaver Stadium (Penn State, pre-existing) | 106,304 | 106,304 (2025–present) | task said "~106,572" — that is now STALE; current is 106,304 (why we verify) |
| Autzen Stadium (Oregon) | **54,000** | 54,000 | SOURCE-1 parse bug (grabbed 60,000) caught by the disagreement; corrected to the leading infobox value 54,000, which official confirms |

Anti-hallucination: 3 verified source-2 URLs were re-fetched by hand and confirmed to contain the exact number (BC PDF 44,500; Georgia Tech 51,913; Florida 88,548). Every verified value is independently corroborated by the deterministic Wikipedia figure, so a fabricated source-2 number could not have passed the gate.

## Per-venue

| School | Venue | Capacity | Status | Source 1 | Source 2 |
|---|---|---|---|---|---|
| boise-state | Albertsons Stadium | 36,387 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Albertsons_Stadium) | [official](https://events.boisestate.edu/albertsons-stadium-stdm) |
| wake-forest | Allegacy Federal Credit Union Stadium | 31,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Allegacy_Federal_Credit_Union_Stadium) | [official](https://stadium.ljvm.com/venue-info/) |
| unlv | Allegiant Stadium | 65,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Allegiant_Stadium) | [official](https://www.allegiantstadium.com/stadium/about-allegiant-stadium) |
| boston-college | Alumni Stadium | 44,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Alumni_Stadium) | [official](https://bceagles.com/documents/download/2020/11/9/ND20.pdf) |
| tcu | Amon G. Carter Stadium | 47,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Amon_G._Carter_Stadium) | [official](https://gofrogs.com/documents/download/2024/10/21/TCU_Notes_-_Texas_Tech_Game.pdf) |
| oregon | Autzen Stadium | 54,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Autzen_Stadium) | [official](https://goducks.com/documents/download/2024/9/10/GM3_-_Oregon_State.pdf) |
| florida | Ben Hill Griffin Stadium | 88,548 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Ben_Hill_Griffin_Stadium) | [official](https://team.studentlife.ufl.edu/onboarding/uf-traditions/fun-facts/) |
| georgia-tech | Bobby Dodd Stadium | 51,913 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Bobby_Dodd_Stadium) | [official](https://ramblinwreck.com/sports/m-footbl/facilities/bobby-dodd-stadium/) |
| oklahoma-state | Boone Pickens Stadium | 52,305 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Boone_Pickens_Stadium) | [official](https://okstate.com/sports/2015/6/18/GEN_0618155302) |
| james-madison | Bridgeforth Stadium | 24,877 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Bridgeforth_Stadium_and_Zane_Showker_Field) | [official](https://jmusports.com/facilities/bridgeforth-stadium-zane-showker-field/1) |
| wisconsin | Camp Randall Stadium | 76,057 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Camp_Randall_Stadium) | [official](https://uwbadgers.com/sports/2015/8/21/GEN_2014010132) |
| nc-state | Carter–Finley Stadium | 56,919 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Carter%E2%80%93Finley_Stadium) | [official](https://gopack.com/facilities/carter-finley-stadium/3) |
| arizona | Casino Del Sol Stadium | 50,782 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Casino_Del_Sol_Stadium) | [official](https://arizonawildcats.com/sports/2019/2/21/facility-arizona-stadium.aspx) |
| texas | Darrell K Royal–Texas Memorial Stadium | 100,119 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Darrell_K_Royal%E2%80%93Texas_Memorial_Stadium) | [official](https://texaslonghorns.com/facilities/dkr-texas-memorial-stadium/1) |
| mississippi-state | Davis Wade Stadium | 60,311 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Davis_Wade_Stadium) | [official](https://static.hailstate.com/custompages/pdf/fb/fb_25mg_GeneralInfo.pdf) |
| florida-state | Doak Campbell Stadium | 67,277 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Doak_Campbell_Stadium) | [official](https://seminoles.com/sports/2026/1/16/doak-campbell-stadium) |
| air-force | Falcon Stadium | 39,441 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Falcon_Stadium) | [official](https://goairforcefalcons.com/facilities/falcon-stadium/5) |
| missouri | Faurot Field | 57,321 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Faurot_Field) | [official](https://mutigers.com/memorial-stadiumfaurot-field) |
| colorado | Folsom Field | 50,183 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Folsom_Field) | [official](https://cubuffs.com/facilities/folsom-field/1) |
| oklahoma | Gaylord Family Oklahoma Memorial Stadium | 80,126 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Gaylord_Family_Oklahoma_Memorial_Stadium) | [official](https://soonersports.com/facilities/gaylord-family---oklahoma-memorial-stadium/21) |
| smu | Gerald J. Ford Stadium | 33,200 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Gerald_J._Ford_Stadium) | [official](https://smumustangs.com/facilities/gerald-j-ford-stadium/2) |
| illinois | Gies Memorial Stadium | 60,670 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Gies_Memorial_Stadium) | [official](https://fightingillini.com/documents/download/2024/11/11/20241116_Illinois_Michigan_State.pdf) |
| toledo | Glass Bowl | 26,038 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Glass_Bowl) | [official](https://utrockets.com/documents/download/2025/8/23/01_-_Toledo_Football_Game_Notes_-_Kentucky_Game.pdf) |
| miami | Hard Rock Stadium | 64,767 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Hard_Rock_Stadium) | [official](https://storage.googleapis.com/hurricanesports-com/2025/09/ac12fa6b-game-notes-game-4-miami-vs.-florida.pdf) |
| minnesota | Huntington Bank Stadium | 50,805 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Huntington_Bank_Stadium) | [official](https://gophersports.com/documents/download/2025/11/18/25.11.22_Northwestern_Notes.pdf) |
| washington | Husky Stadium | 70,083 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Husky_Stadium) | [official](https://www.uwstadium.com/information/) |
| iowa-state | Jack Trice Stadium | 61,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Jack_Trice_Stadium) | [official](https://www.amesstadium.com/information/) |
| auburn | Jordan–Hare Stadium | 88,043 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Jordan%E2%80%93Hare_Stadium) | [official](https://auburntigers.com/jordan-hare-stadium) |
| north-carolina | Kenan Stadium | 50,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Kenan_Stadium) | [official](https://calendar.unc.edu/kenan_memorial_stadium) |
| iowa | Kinnick Stadium | 69,250 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Kinnick_Stadium) | [official](https://hawkeyesports.com/kinnick-stadium) |
| kentucky | Kroger Field | 61,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Kroger_Field) | [official](https://ukathletics.com/facilities/kroger-field/) |
| texas-am | Kyle Field | 102,733 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Kyle_Field) | [official](https://12thman.com/facilities/kyle-field) |
| virginia-tech | Lane Stadium | 65,632 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Lane_Stadium) | [official](https://hokiesports.com/lane-stadium-worsham-field) |
| byu | LaVell Edwards Stadium | 62,073 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/LaVell_Edwards_Stadium) | [official](https://byucougars.com/football-facilities) |
| louisville | L&N Federal Credit Union Stadium | 60,800 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/L%26N_Federal_Credit_Union_Stadium) | [official](https://louisvillefoundation.org/ln-federal-credit-union-inks-naming-rights-deal-to-rename-cardinal-stadium/) |
| usc | Los Angeles Memorial Coliseum | 77,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Los_Angeles_Memorial_Coliseum) | [official](https://www.lacoliseum.com/introducing-united-airlines-field-at-the-los-angeles-memorial-coliseum/) |
| northwestern | Martin Stadium | 12,023 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Martin_Stadium_(Northwestern_University)) | [official](https://news.northwestern.edu/stories/2024/august/temporary-lakeside-athletics-venue-to-be-named-northwestern-medicine-field-at-martin-stadium) |
| baylor | McLane Stadium | 45,140 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/McLane_Stadium) | [official](https://about.web.baylor.edu/campus/vibrant-baylor-campus) |
| clemson | Memorial Stadium | 81,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Memorial_Stadium_(Clemson)) | [official](https://clemsontigers.com/clemson-athletics-receives-state-approval-on-reduced-capacity-plans-for-athletic-facilities/) |
| indiana | Memorial Stadium | 53,524 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Memorial_Stadium_(Indiana_University)) | [official](https://static.iuhoosiers.com/custompages/PDF/fb/2025/25-09-12-Notes_Indiana_State.pdf) |
| michigan | Michigan Stadium | 107,600 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Michigan_Stadium) | [official](https://static.mgoblue.com/custompages/thisismichigan/index.html) |
| west-virginia | Milan Puskar Stadium | 60,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Milan_Puskar_Stadium) | [official](https://wvusports.com/facilities/milan-puskar-stadium/8) |
| arizona-state | Mountain America Stadium | 53,599 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Mountain_America_Stadium) | [official](https://thesundevils.com/news/2025/8/27/know-before-you-go-sun-devil-football-hosts-northern-arizona-university) |
| navy | Navy–Marine Corps Memorial Stadium | 34,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Navy%E2%80%93Marine_Corps_Memorial_Stadium) | [official](https://navysports.com/sports/2022/5/25/navy-marine-corps-memorial-stadium.aspx) |
| tennessee | Neyland Stadium | 101,915 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Neyland_Stadium) | [official](https://utsports.com/facilities/neyland-stadium/54) |
| cincinnati | Nippert Stadium | 38,088 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Nippert_Stadium) | [official](https://gobearcats.com/nippert-stadium-1) |
| ohio-state | Ohio Stadium | 102,780 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Ohio_Stadium) | [official](https://ohiostatebuckeyes.com/sports/2023/6/2/ohio-stadium) |
| uconn | Pratt & Whitney Stadium at Rentschler Field | 36,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Pratt_%26_Whitney_Stadium_at_Rentschler_Field) | [official](https://www.rentschlerfield.com/stadium-info) |
| ucla | Rose Bowl | 89,702 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Rose_Bowl_(stadium)) | [official](https://uclabruins.com/sports/2000/6/23/207832865) |
| purdue | Ross–Ade Stadium | 61,441 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Ross%E2%80%93Ade_Stadium) | [official](https://purduesports.com/facilities/ross-ade-stadium) |
| alabama | Saban Field at Bryant–Denny Stadium | 100,077 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Saban_Field_at_Bryant%E2%80%93Denny_Stadium) | [official](https://rolltide.com/sports/2016/6/10/facilities-bryant-denny-html) |
| georgia | Sanford Stadium | 93,033 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Sanford_Stadium) | [official](https://georgiadogs.com/sports/2023/7/11/facility-SanfordStadium) |
| virginia | Scott Stadium | 61,500 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Scott_Stadium) | [official](https://virginiasports.com/scott-stadium) |
| maryland | SECU Stadium | 46,185 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/SECU_Stadium) | [official](https://umterps.com/facilities/secu-stadium/1) |
| rutgers | SHI Stadium | 52,454 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/SHI_Stadium) | [official](https://commencement.rutgers.edu/venue) |
| houston | Space City Financial Stadium | 39,700 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Space_City_Financial_Stadium) | [official](https://www.uh.edu/tdecu-stadium/venue-information/faqs/index.php) |
| michigan-state | Spartan Stadium | 74,866 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Spartan_Stadium_(East_Lansing%2C_Michigan)) | [official](https://msuspartans.com/documents/download/2025/9/16/Game_4_vs._USC.pdf) |
| stanford | Stanford Stadium | 50,424 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Stanford_Stadium) | [official](https://gostanford.com/facilities/stanford-stadium) |
| lsu | Tiger Stadium | 102,321 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Tiger_Stadium_(Louisiana)) | [official](https://lsusports.net/facilities/tiger-stadium/) |
| fresno-state | Valley Children's Stadium | 40,727 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Valley_Children's_Stadium) | [official](https://gobulldogs.com/documents/download/2025/9/29/100425_FresnoState_GameNotes.pdf) |
| duke | Wallace Wade Stadium | 35,018 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Wallace_Wade_Stadium) | [official](https://goduke.com/documents/download/2025/12/1/Game_Notes_ACCChampionship.pdf) |
| south-carolina | Williams–Brice Stadium | 77,559 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Williams%E2%80%93Brice_Stadium) | [official](https://gamecocksonline.com/facilities/williams-brice-stadium/) |
| liberty | Williams Stadium | 25,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Williams_Stadium) | [official](https://www.liberty.edu/events/athletic-venues-2/) |
| tulane | Yulman Stadium | 30,000 | ✅ verified | [wiki](https://en.wikipedia.org/wiki/Yulman_Stadium) | [official](https://news.tulane.edu/pr/yulman-stadium-amenities) |
| coastal-carolina | Brooks Stadium | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/Brooks_Stadium) | — |
| california | California Memorial Stadium | — | ⚠️ null (disagree) | [wiki](https://en.wikipedia.org/wiki/California_Memorial_Stadium) | [official](https://calbears.com/sports/2013/4/17/208213293) |
| arkansas | Donald W. Reynolds Razorback Stadium | — | ⚠️ null (disagree) | [wiki](https://en.wikipedia.org/wiki/Donald_W._Reynolds_Razorback_Stadium) | [official](https://arkansasrazorbacks.com/donald-w-reynolds-razorback-stadium/) |
| vanderbilt | FirstBank Stadium | — | ⚠️ null (disagree) | [wiki](https://en.wikipedia.org/wiki/FirstBank_Stadium) | [official](https://vucommodores.com/firstbank-stadium) |
| northern-illinois | Huskie Stadium | — | ⚠️ null (disagree) | [wiki](https://en.wikipedia.org/wiki/Huskie_Stadium) | [official](https://ballstatesports.com/documents/download/2023/11/5/FB23_-_NIU_Game_10_Notes__Ball_St__-_ALL.pdf) |
| syracuse | JMA Wireless Dome | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/JMA_Wireless_Dome) | — |
| marshall | Joan C. Edwards Stadium | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/Joan_C._Edwards_Stadium) | — |
| texas-tech | Jones Stadium | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/Jones_Stadium) | — |
| nebraska | Memorial Stadium | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/Memorial_Stadium_(Lincoln)) | — |
| army | Michie Stadium | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/Michie_Stadium) | — |
| notre-dame | Notre Dame Stadium | — | ⚠️ null (disagree) | [wiki](https://en.wikipedia.org/wiki/Notre_Dame_Stadium) | [official](https://fightingirish.com/facilities-3/notre-dame-stadium/) |
| south-florida | Raymond James Stadium | — | ⚠️ null (1-source) | [wiki](https://en.wikipedia.org/wiki/Raymond_James_Stadium) | — |
| memphis | Simmons Bank Liberty Stadium | — | ⚠️ null (disagree) | [wiki](https://en.wikipedia.org/wiki/Simmons_Bank_Liberty_Stadium) | [official](https://gotigersgo.com/facilities/simmons-bank-liberty-stadium/8) |
## Flagged detail (why left null)

- **California Memorial** — wiki 52,428 (current) vs official 63,186 (2013 post-retrofit page, stale) — 17% apart.
- **Razorback (Arkansas)** — wiki 76,212 (2018 expansion) vs official facts-table 72,000 (stale) — 5.5%.
- **FirstBank (Vanderbilt)** — wiki 35,000 (post-2025 renovation) vs official 40,350 (pre-renovation, stale) — 13%.
- **Huskie (NIU)** — wiki 28,211 vs official game-notes 23,595 (likely the more-current reduced figure) — 16%; genuine conflict, needs human.
- **Notre Dame** — wiki 77,622 (seated) vs official 80,795 (total incl. standing) — 3.9%; counting difference.
- **Simmons Bank Liberty (Memphis)** — wiki 50,000 (2024–present) vs official 58,325 (stale) — 14%.
- **Single-source (no independent official found):** Brooks (Coastal Carolina — only a rounded/planned "20,000"), JMA Dome (no official football-config figure surfaced), Joan C. Edwards (Marshall), Jones AT&T (Texas Tech), Memorial/Lincoln (Nebraska), Michie (Army), Raymond James (South Florida). Wikipedia has a value for each, but the task requires 2 independent sources — left null by design.

## Adversarial self-check

1. **Any capacity from a single source?** No — every one of the 64 stored values has BOTH a Wikipedia infobox figure AND an independent official source that agree within tolerance; both URLs are stored. 7 venues with only Wikipedia were left null.
2. **Any capacity pulled from the wrong stadium?** No — SOURCE 1 came from each venue's own Phase-2-resolved Wikipedia page; SOURCE 2 agents confirmed the football stadium in the right city. The multi-config domes were resolved to the FOOTBALL config (JMA Dome 42,784, Hard Rock 64,767), not a basketball/hockey/baseball number.
3. **Any suspiciously round or off number?** The round values (Allegiant 65,000, Kroger 61,000, Milan Puskar 60,000, Yulman 30,000, Williams/Liberty 25,000) are round because the stadiums' official capacities ARE round — and each is corroborated by both sources agreeing on that exact figure. The one clearly-off SOURCE-1 value (Autzen 60,000) was caught by the disagreement gate and corrected to 54,000. Stale/off official figures (Razorback, Cal, Simmons, etc.) were flagged, not stored.
4. **Did the known-venue spot-checks match reality?** Yes — Beaver 106,304 (current; the task's 106,572 is stale), Bryant–Denny 100,077, Huntington 50,805, Michigan 107,600. All correct, not 50k-style errors.

---

**STOP — data-layer backfill only. No push, no merge.** Capacity populated for 64 venues (73/86 total); 13 left null + flagged for a human.
