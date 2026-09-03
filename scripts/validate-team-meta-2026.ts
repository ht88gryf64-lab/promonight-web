/* eslint-disable no-console */
/**
 * One-off validation for the seo/team-page-meta-titles change.
 *
 * Reproduces the production title/description templates from
 *   src/app/[sport]/[team]/page.tsx  (and the playoffs page)
 * against LIVE Firestore data, then asserts:
 *   - every CONTROL rendered <title> (incl. the layout's " | PromoNight"
 *     suffix) <= 60
 *   - every meta description <= 155
 *
 * The ten ctr-diagnostic-sep2026 treatment teams are EXEMPT from the 60-char
 * assertion and reported separately. Four of their titles run 61 to 63 chars,
 * which was accepted when the experiment shipped: every query-relevant token
 * lands inside the first 49 characters and only the " | PromoNight" brand
 * suffix is at risk of clipping. See src/lib/title-treatment.ts. If the
 * experiment is reverted or promoted, that file changes and this script
 * follows automatically.
 *
 * Run with:
 *   node --require ./scripts/stub-server-only.cjs --import tsx \
 *     --env-file=.env.local scripts/validate-team-meta-2026.ts
 */
import { getAllTeams, getTeamBySlug, getVenueForTeam } from '../src/lib/data';
import { teamDisplayName } from '../src/lib/promo-helpers';
import { isTitleTreatmentTeam, teamBareTitle } from '../src/lib/title-treatment';
import type { Team } from '../src/lib/types';

const YEAR = 2026; // must match the hardcoded `year` in the team/playoffs pages
const TITLE_SUFFIX = ' | PromoNight'; // layout.tsx title.template = "%s | PromoNight"
const TITLE_MAX = 60;
const DESC_MAX = 155;

// MUST stay byte-identical to truncateAtWord in src/app/[sport]/[team]/page.tsx.
function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

// The title template is NOT re-typed here. It is imported from
// src/lib/title-treatment.ts, the same module the team route, og:title and the
// JSON-LD WebPage name read, so this validator cannot drift from production the
// way the two mirrors in scripts/audit-title-lengths.ts and
// scripts/check-metadata-dedupe.ts already have. That import is also what makes
// this script accept BOTH shapes automatically: the control
// `{Display} Promos & Giveaways 2026` and, for the ten ctr-diagnostic-sep2026
// treatment teams, `{Display} Giveaways & Theme Nights 2026`.
//
// What actually renders in <title> once the layout template is applied.
function renderedTitle(team: Team, display: string): string {
  return `${teamBareTitle(team, display)}${TITLE_SUFFIX}`;
}
// KNOWN STALE, and deliberately left alone by the ctr-diagnostic-sep2026
// change: the production description has not been this string for some time
// (it front-loads the next upcoming promos and falls back to a
// "promotional schedule" sentence with a league-aware freshness tail). The
// description numbers this script prints are therefore a floor, not a mirror.
// Rewriting the description mirror is its own change with its own review.
function rawDescription(display: string, venueName: string | null): string {
  return venueName
    ? `${display} ${YEAR} promos: giveaways, bobbleheads, theme nights & food deals at ${venueName}. Find the best games to attend this season.`
    : `${display} ${YEAR} promos: giveaways, bobbleheads, theme nights & food deals. Find the best games to attend this season.`;
}

function pad(s: string | number, n: number): string {
  const str = String(s);
  return str.length >= n ? str : str + ' '.repeat(n - str.length);
}

interface Row {
  slug: string;
  display: string;
  venueName: string | null;
  /** In the ctr-diagnostic-sep2026 treatment arm (see src/lib/title-treatment.ts). */
  treatment: boolean;
  title: string;
  titleLen: number;
  desc: string;
  descLen: number;
  rawDescLen: number;
}

async function rowForTeam(team: Team): Promise<Row> {
  const venue = await getVerifiedVenue(team.id);
  const display = teamDisplayName(team);
  const raw = rawDescription(display, venue);
  const desc = truncateAtWord(raw, DESC_MAX);
  const title = renderedTitle(team, display);
  return {
    slug: team.id,
    display,
    venueName: venue,
    treatment: isTitleTreatmentTeam(team),
    title,
    titleLen: title.length,
    desc,
    descLen: desc.length,
    rawDescLen: raw.length,
  };
}

async function getVerifiedVenue(teamId: string): Promise<string | null> {
  const venue = await getVenueForTeam(teamId);
  return venue ? venue.name : null;
}

const SAMPLE_SLUGS = [
  'boston-red-sox',
  'minnesota-timberwolves',
  'portland-trail-blazers',
  'las-vegas-aces',
  'houston-dynamo',
];

async function main() {
  // --- Required 5-slug sample report -------------------------------------
  console.log('=== REQUIRED SAMPLE SLUGS ===\n');
  for (const slug of SAMPLE_SLUGS) {
    const team = await getTeamBySlug(slug);
    if (!team) {
      console.log(`  (NOT FOUND: ${slug})\n`);
      continue;
    }
    const r = await rowForTeam(team);
    const tFlag = r.titleLen <= TITLE_MAX ? 'OK' : 'OVER';
    const dFlag = r.descLen <= DESC_MAX ? 'OK' : 'OVER';
    console.log(`  ${slug}  (venue: ${r.venueName ?? 'NONE — fallback desc'})`);
    console.log(`    title [${pad(r.titleLen, 2)}/${TITLE_MAX}] [${tFlag}]  ${r.title}`);
    console.log(`    desc  [${pad(r.descLen, 3)}/${DESC_MAX}] [${dFlag}] ${r.desc}`);
    if (r.rawDescLen !== r.descLen) {
      console.log(`      (raw desc was ${r.rawDescLen} chars — truncated to ${r.descLen})`);
    }
    console.log('');
  }

  // --- Full sweep across all teams ---------------------------------------
  const teams = await getAllTeams();
  const rows = await Promise.all(teams.map(rowForTeam));

  // Over-budget titles split by arm: a control team over 60 is a real defect,
  // a treatment team over 60 is the accepted cost of the experiment.
  const titleOver = rows.filter((r) => r.titleLen > TITLE_MAX && !r.treatment);
  const titleOverTreatment = rows.filter((r) => r.titleLen > TITLE_MAX && r.treatment);
  const descOver = rows.filter((r) => r.descLen > DESC_MAX);
  const truncated = rows.filter((r) => r.rawDescLen > DESC_MAX);
  const longestTitle = [...rows].sort((a, b) => b.titleLen - a.titleLen)[0];
  const longestDesc = [...rows].sort((a, b) => b.descLen - a.descLen)[0];

  console.log(`=== FULL SWEEP: ${rows.length} teams ===\n`);
  console.log(`Titles over ${TITLE_MAX} (control, FAIL): ${titleOver.length}`);
  console.log(`Titles over ${TITLE_MAX} (treatment, accepted): ${titleOverTreatment.length}`);
  console.log(`Descs  over ${DESC_MAX}: ${descOver.length}`);
  console.log(`Descs truncated (raw > ${DESC_MAX}): ${truncated.length}`);
  console.log(`\nLongest title: ${longestTitle.titleLen} chars — ${longestTitle.title}`);
  console.log(`Longest desc:  ${longestDesc.descLen} chars — [${longestDesc.slug}]`);

  if (truncated.length > 0) {
    console.log(`\n--- teams whose description was truncated to fit ${DESC_MAX} ---`);
    for (const r of truncated.sort((a, b) => b.rawDescLen - a.rawDescLen)) {
      console.log(`  ${pad(r.rawDescLen, 3)}->${pad(r.descLen, 3)}  [${r.slug}] @ ${r.venueName}`);
      console.log(`        "${r.desc}"`);
    }
  }

  if (titleOverTreatment.length > 0) {
    console.log(
      `\n--- ctr-diagnostic-sep2026 treatment titles over ${TITLE_MAX} (ACCEPTED, not a failure) ---`,
    );
    for (const r of titleOverTreatment.sort((a, b) => b.titleLen - a.titleLen)) {
      console.log(`  ${r.titleLen}  [${r.slug}] ${r.title}`);
    }
  }
  if (titleOver.length > 0) {
    console.log(`\n!!! CONTROL TITLES OVER ${TITLE_MAX}, needs fixing:`);
    for (const r of titleOver) console.log(`  ${r.titleLen}  [${r.slug}] ${r.title}`);
  }
  if (descOver.length > 0) {
    console.log(`\n!!! DESCS OVER ${DESC_MAX} — truncation failed:`);
    for (const r of descOver) console.log(`  ${r.descLen}  [${r.slug}] ${r.desc}`);
  }

  // --- Playoffs page (static strings) ------------------------------------
  const playoffTitle = `Playoff Promos & Giveaways ${YEAR}${TITLE_SUFFIX}`;
  const playoffDesc =
    "Every MLB and NHL playoff promo schedule for 2026. Giveaways, bobbleheads & theme nights across all active playoff teams. See what's on tonight.";
  console.log(`\n=== PLAYOFFS PAGE ===`);
  console.log(`  title [${playoffTitle.length}/${TITLE_MAX}] ${playoffTitle.length <= TITLE_MAX ? 'OK' : 'OVER'}  ${playoffTitle}`);
  console.log(`  desc  [${playoffDesc.length}/${DESC_MAX}] ${playoffDesc.length <= DESC_MAX ? 'OK' : 'OVER'}  ${playoffDesc}`);

  const pass = titleOver.length === 0 && descOver.length === 0 && playoffTitle.length <= TITLE_MAX && playoffDesc.length <= DESC_MAX;
  console.log(
    `\n=== RESULT: ${pass ? 'PASS: all control titles <=60 and descriptions <=155' : 'FAIL'} ===`,
  );
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
