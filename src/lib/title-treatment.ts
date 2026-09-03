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
