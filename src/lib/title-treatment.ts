import type { Team } from './types';

/**
 * CTR diagnostic, team-page title treatment.
 *
 * EXPERIMENT: "ctr-diagnostic-sep2026". Started 2026-09-03 on branch
 * feature/ctr-diagnostic-sep2026. Four-week read date 2026-10-01.
 *
 * WHY: all 30 MLB team pages ship one title template,
 * `{Display Name} Promos & Giveaways 2026`. Gate 0 confirmed the word
 * "Giveaways" is in every one of those titles and "Theme Nights" is in none,
 * while "[team] theme nights" is a real, separately-ranking query family that
 * the title ignores. Ten teams get a title that names the theme nights the
 * page already covers; the other twenty are the control and stay byte-identical
 * so the read has something to compare against.
 *
 * THIS FILE IS THE SINGLE FLIP POINT. Every render surface that used to
 * hardcode the string reads from here: the <title>, og:title/twitter:title,
 * the WebPage `name` in JSON-LD, the visible hero subtitle, and the
 * validate-team-meta-2026 mirror. Rolling the treatment out to all 30, or
 * reverting it entirely, is a one-line change to TREATMENT_SLUGS below
 * (empty set reverts every team to control; adding the remaining twenty MLB
 * slugs promotes it). Do not re-hardcode either shape at a call site.
 *
 * TWO EXPERIMENTS NOW LIVE HERE, and they have different surface scopes. The
 * MLB arm above moves every surface in that list together. The NFL arm at the
 * bottom of this file moves the <title> ONLY, by way of a separate accessor
 * (teamMetaTitle) that the route calls while json-ld.tsx and
 * RedesignTeamPage.tsx keep calling teamBareTitle / teamTitleSubtitle. So
 * "every surface reads from here" is still true; "every surface reads the same
 * string" is true for MLB and deliberately false for the ten NFL clubs.
 *
 * LENGTH: four of the ten rendered titles run past the 60-character mobile
 * SERP budget (san-francisco-giants 63, los-angeles-dodgers 62,
 * pittsburgh-pirates 61, los-angeles-angels 61, and toronto-blue-jays sits
 * exactly on 60). That is accepted, not an oversight. Every query-relevant
 * token, the team name plus "Giveaways", "Theme Nights" and "2026", lands
 * inside the first 49 characters; only the " | PromoNight" brand suffix is at
 * risk of clipping. Do NOT shorten the string and do NOT drop "2026" to buy
 * length back: both remove a relevance token from one of the two query
 * families this experiment measures.
 */

// Hardcoded, never new Date().getFullYear(). Same standing rule as the title
// and description in the team route and the FAQ copy in promo-helpers: an
// auto-rolling year flips every title to the next season at midnight on Jan 1,
// months before that season's data exists. Bump deliberately when 2027 content
// is ready, and bump it in lockstep with the other hardcoded 2026 season years.
export const TITLE_SEASON_YEAR = 2026;

/**
 * The ten treatment teams, by team slug (Firestore doc id). Slugs are unique
 * across all six leagues, so membership alone decides the variant; every team
 * not listed here, MLB or otherwise, renders the control title.
 */
export const TREATMENT_SLUGS: ReadonlySet<string> = new Set([
  'los-angeles-dodgers',
  'atlanta-braves',
  'chicago-cubs',
  'pittsburgh-pirates',
  'new-york-yankees',
  'san-francisco-giants',
  'houston-astros',
  'los-angeles-angels',
  'toronto-blue-jays',
  'tampa-bay-rays',
]);

/** True when this team is in the treatment arm of the CTR diagnostic. */
export function isTitleTreatmentTeam(team: Pick<Team, 'id'>): boolean {
  return TREATMENT_SLUGS.has(team.id);
}

/**
 * The part of the title that follows the team name, and the string the visible
 * redesign hero renders under the team lockup. Returned on its own because the
 * hero already prints the team name as its <h1>, so repeating it in the
 * subtitle would read as a stutter.
 */
export function teamTitleSubtitle(team: Pick<Team, 'id'>): string {
  return isTitleTreatmentTeam(team)
    ? `Giveaways & Theme Nights ${TITLE_SEASON_YEAR}`
    : `Promos & Giveaways ${TITLE_SEASON_YEAR}`;
}

/**
 * The BARE metadata title, with no brand suffix. The root layout's
 * title.template ("%s | PromoNight") appends the brand to every string title,
 * so this value renders as `{bare} | PromoNight`. Surfaces that are NOT run
 * through that template (og:title, twitter:title, the JSON-LD WebPage name)
 * spell the suffix out themselves.
 *
 * `displayName` is passed in rather than derived so callers keep using the one
 * teamDisplayName() result they already computed, which is what handles the
 * doubled-city MLS cases.
 */
export function teamBareTitle(team: Pick<Team, 'id'>, displayName: string): string {
  return `${displayName} ${teamTitleSubtitle(team)}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * EXPERIMENT 2: "nfl-schedule-title-sep2026". Started 2026-09-05.
 * Read date 2026-09-20. Baseline: audit/nfl-title-test-baseline-2026-09-05.md
 *
 * WHY: all 32 NFL team pages ship the control title
 * `{Display Name} Promos & Giveaways 2026`, which contains no schedule token,
 * while every one of those pages carries a full 17-game regular-season
 * schedule (verified against Firestore on 2026-09-05: games === 17 on all 20
 * pages in this test). "Schedule" is therefore a claim the page delivers, not
 * a keyword bolted onto copy that does not support it.
 *
 * WHAT THIS DOES AND DOES NOT MOVE. Scope is the <title> and the og:title /
 * twitter:title mirror of it, and nothing else. It does NOT move:
 *   - the JSON-LD WebPage `name` (json-ld.tsx:146 keeps calling teamBareTitle)
 *   - the visible hero subtitle (RedesignTeamPage.tsx:243 keeps calling
 *     teamTitleSubtitle)
 *   - the meta description, which is gated on isTitleTreatmentTeam, a
 *     deliberately SEPARATE predicate. See the note on isNflScheduleTitleTeam.
 * The consequence is real and accepted: on the ten treatment pages the <title>
 * deliberately diverges from the WebPage name and from the visible subtitle.
 * That divergence is what "title only" costs, and it is the brief's ruling.
 *
 * LENGTH: every one of the ten rendered titles fits the 60-character mobile
 * SERP budget, 52 to 58 including the " | PromoNight" suffix. Unlike the MLB
 * arm above, nothing here is over budget, and that is deliberate rather than
 * lucky: 153 of this site's titles are already flagged too long and Google is
 * rewriting 52 of them, and a title Google rewrites measures nothing. The
 * brief's first-choice form, "{Display} 2026 Schedule, Promos & Giveaways",
 * ran 60 to 66 and exceeded the budget on 8 of the 10, so the shorter form
 * below was chosen instead. The word dropped against control is the standalone
 * "Promos"; the " | PromoNight" brand suffix still carries that stem, so the
 * treatment title is close to a pure ADD of "Schedule" rather than a swap.
 * ──────────────────────────────────────────────────────────────────────────── */

// Deliberately NOT TITLE_SEASON_YEAR. That constant stopped being a title-only
// value when src/lib/season-scope.ts:225 began gating the visible season claim
// on `year === TITLE_SEASON_YEAR`, so reusing it here would couple a title
// experiment to body copy. Hardcoded, never new Date().getFullYear(): the same
// standing rule as TITLE_SEASON_YEAR, and for the same reason.
export const NFL_TITLE_SEASON_YEAR = 2026;

/** The ten treatment clubs, by team slug (Firestore doc id). */
export const NFL_SCHEDULE_TITLE_SLUGS: ReadonlySet<string> = new Set([
  'chicago-bears',
  'dallas-cowboys',
  'kansas-city-chiefs',
  'philadelphia-eagles',
  'pittsburgh-steelers',
  'san-francisco-49ers',
  'new-york-giants',
  'cincinnati-bengals',
  'detroit-lions',
  'baltimore-ravens',
]);

/**
 * The ten held-out clubs. Inert at render: nothing branches on this set. It is
 * declared so the control arm is a named, reviewable thing rather than "the
 * NFL clubs nobody listed", so a later "promote to all 32" edit cannot swallow
 * it silently, and so the meta validator can label arms instead of filing
 * these ten under "no experiment".
 */
export const NFL_SCHEDULE_TITLE_CONTROL_SLUGS: ReadonlySet<string> = new Set([
  'los-angeles-rams',
  'los-angeles-chargers',
  'atlanta-falcons',
  'tampa-bay-buccaneers',
  'buffalo-bills',
  'denver-broncos',
  'seattle-seahawks',
  'minnesota-vikings',
  'new-york-jets',
  'miami-dolphins',
]);

/**
 * True when this club is in the treatment arm of nfl-schedule-title-sep2026.
 *
 * Kept separate from isTitleTreatmentTeam ON PURPOSE. That predicate does not
 * only pick a title: page.tsx:151 also uses it to decide whether to prepend
 * "Next {Display Name} theme night: {promo} on {Mon D}." to the meta
 * description. Folding the NFL set into it would move ten meta descriptions
 * the brief freezes, silently, on a surface the read measures.
 */
export function isNflScheduleTitleTeam(team: Pick<Team, 'id'>): boolean {
  return NFL_SCHEDULE_TITLE_SLUGS.has(team.id);
}

/**
 * The BARE <title> value, with no brand suffix. The ONLY export whose result
 * may differ between arms of the NFL test, and the only one generateMetadata
 * calls for the <title>.
 *
 * BYTE-IDENTITY IS STRUCTURAL, NOT INSPECTED: for every team outside
 * NFL_SCHEDULE_TITLE_SLUGS this DELEGATES to teamBareTitle and returns its
 * result verbatim. It does not re-derive the control string, so all 30 MLB
 * clubs (both ctr-diagnostic-sep2026 arms), the 10 NFL control clubs and the
 * other 12 NFL clubs cannot move even if this function is edited carelessly
 * later. There is no second copy of the control template to drift.
 */
export function teamMetaTitle(team: Pick<Team, 'id'>, displayName: string): string {
  if (isNflScheduleTitleTeam(team)) {
    return `${displayName} ${NFL_TITLE_SEASON_YEAR} Schedule & Giveaways`;
  }
  return teamBareTitle(team, displayName);
}

/** Which arm of which title experiment a team is in. REPORTING ONLY: no render
 *  surface reads this. Consumed by scripts/validate-team-meta-2026.ts. */
export type TitleArm =
  | 'mlb-ctr-treatment'
  | 'nfl-schedule-treatment'
  | 'nfl-schedule-control'
  | 'none';

export function titleExperimentArm(team: Pick<Team, 'id'>): TitleArm {
  if (isTitleTreatmentTeam(team)) return 'mlb-ctr-treatment';
  if (NFL_SCHEDULE_TITLE_SLUGS.has(team.id)) return 'nfl-schedule-treatment';
  if (NFL_SCHEDULE_TITLE_CONTROL_SLUGS.has(team.id)) return 'nfl-schedule-control';
  return 'none';
}
