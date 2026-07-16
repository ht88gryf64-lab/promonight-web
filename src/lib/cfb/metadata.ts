// CFB metadata (decision record §12 + §13; re-optimized on Ahrefs data, Jul 2026).
// Templated, TIER-DERIVED (reads editorialStatus, so a school's description auto-
// enriches on graduation — no hand edit). "Schedule" is MANDATORY in every title:
// "[school] football schedule 2026" is the head term with real volume (Ohio State
// 10k, Alabama 8.3k, Notre Dame 7.8k), so it never gets dropped for a trophy token —
// the token is featured only when it also fits. Descriptions NAME THE RIVAL SCHOOL
// (where the rivalry volume actually is — "ohio state michigan rivalry" 900/mo, not
// the generic "rivalry games" 10/mo) and carry "[stadium] parking" (a KD-1 logistics
// term). Within engine limits (rendered title ≤60, description ≤155). OG uses the
// house /og-image.png so no CFB page ships a blanked image.

import type { Metadata } from 'next';
import type { CfbSchoolPage } from '@/lib/cfb/data';

// The root layout title template appends ' | PromoNight' (13 chars) to every
// page title. The house standard keeps the RENDERED <title> (field + brand) ≤60
// (pro pages verified 44–58). So the FIELD budget must leave room for the brand.
const BRAND_SUFFIX = ' | PromoNight';
const TITLE_MAX = 60 - BRAND_SUFFIX.length; // 47 → rendered ≤60
const DESC_MAX = 155; // hard cap (Google truncates ~155); every school verified ≤155
const YEAR = 2026;
const BASE = 'https://www.getpromonight.com';
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'PromoNight: Every giveaway, every team' };

// §13 rivalry traffic priority. `token` = the short form for the (char-tight)
// title; `name` = the full trophy/rivalry name for the description. Higher rank =
// higher traffic potential — the best-ranked of a school's rivalry games is featured.
interface Marquee { re: RegExp; token: string; name: string; rank: number }
const MARQUEE: Marquee[] = [
  { re: /\bthe game\b/i, token: 'The Game', name: 'The Game', rank: 100 },
  { re: /red river/i, token: 'Red River', name: 'the Red River Rivalry', rank: 95 },
  { re: /cocktail party|world'?s largest/i, token: 'Cocktail Party', name: 'the Cocktail Party', rank: 90 },
  { re: /iron bowl/i, token: 'Iron Bowl', name: 'the Iron Bowl', rank: 85 },
  { re: /third saturday/i, token: 'Third Saturday', name: 'the Third Saturday in October', rank: 80 },
  { re: /egg bowl/i, token: 'Egg Bowl', name: 'the Egg Bowl', rank: 78 },
  { re: /apple cup/i, token: 'Apple Cup', name: 'the Apple Cup', rank: 76 },
  { re: /bedlam/i, token: 'Bedlam', name: 'Bedlam', rank: 74 },
  // MUST require "axe" — "Paul Bunyan's Axe" is Minnesota–Wisconsin; the bare
  // "Paul Bunyan Trophy" is MSU–Michigan, a DIFFERENT rivalry (§5 collision trap).
  { re: /paul bunyan'?s axe/i, token: 'the Axe', name: "Paul Bunyan's Axe", rank: 72 },
  // MSU–Michigan Paul Bunyan Trophy — negative lookahead keeps it off the Axe.
  { re: /paul bunyan(?!'?s axe)/i, token: 'Paul Bunyan', name: 'the Paul Bunyan Trophy', rank: 50 },
  { re: /holy war/i, token: 'Holy War', name: 'the Holy War', rank: 70 },
  { re: /backyard brawl/i, token: 'Backyard Brawl', name: 'the Backyard Brawl', rank: 68 },
  { re: /palmetto bowl/i, token: 'Palmetto Bowl', name: 'the Palmetto Bowl', rank: 66 },
  { re: /iron skillet/i, token: 'Iron Skillet', name: 'the Battle for the Iron Skillet', rank: 64 },
  { re: /border war/i, token: 'Border War', name: 'the Border War', rank: 62 },
  { re: /territorial cup/i, token: 'Territorial Cup', name: 'the Territorial Cup', rank: 60 },
  { re: /clean.*hate/i, token: 'the Hate', name: 'Clean, Old-Fashioned Hate', rank: 58 },
  { re: /floyd of rosedale/i, token: 'Floyd of Rosedale', name: 'Floyd of Rosedale', rank: 45 },
  { re: /little brown jug/i, token: 'Little Brown Jug', name: 'the Little Brown Jug', rank: 45 },
  { re: /old oaken bucket/i, token: 'Old Oaken Bucket', name: 'the Old Oaken Bucket', rank: 44 },
  { re: /keg of nails/i, token: 'Keg of Nails', name: 'the Keg of Nails', rank: 40 },
];

// `rival` = the featured rivalry's OPPONENT school (resolved, display-name form).
// It is what the description leads with ("The Game vs Michigan") — the §13 volume
// term names BOTH schools. Null only when a school has no 2026 rivalry game.
export interface FeaturedRivalry { token: string | null; name: string | null; source: 'marquee' | 'trophy' | 'none'; rival: string | null }

/** Select the featured rivalry from a school's 2026 rivalry games (§13 priority:
 *  best marquee, else the most recognizable trophy, else none). Tracks the winning
 *  tag so the RIVAL SCHOOL rides along (the description names it). */
export function selectFeaturedRivalry(data: CfbSchoolPage): FeaturedRivalry {
  const tags = data.games
    .filter((g) => g.rivalry)
    .map((g) => ({ trophy: g.rivalry!.trophy, name: g.rivalry!.name, rival: g.opponentName }));
  if (tags.length === 0) return { token: null, name: null, source: 'none', rival: null };
  // best marquee across all this school's rivalry tags — track the winning tag so we
  // can surface the rival (opponentName is already resolved: nameById || prettifySlug).
  let best: Marquee | null = null;
  let bestTag: (typeof tags)[number] | null = null;
  for (const t of tags) {
    const hay = `${t.trophy ?? ''} ${t.name}`;
    for (const m of MARQUEE) if (m.re.test(hay) && (!best || m.rank > best.rank)) { best = m; bestTag = t; }
  }
  if (best && bestTag) return { token: best.token, name: best.name, source: 'marquee', rival: bestTag.rival };
  // no marquee → most recognizable trophy (prefer a tag that carries a trophy name).
  // No length cap: the title fallback chain drops the token when it won't fit, so a
  // short-named school still gets its trophy featured (Toledo → "Battle of I-75 Trophy").
  const pickTag = tags.find((t) => t.trophy) ?? tags[0];
  const pick = pickTag.trophy ?? pickTag.name;
  return { token: pick, name: pick, source: 'trophy', rival: pickTag.rival };
}

function firstFit(cands: string[], max: number): string {
  for (const c of cands) if (c.length <= max) return c;
  // all too long → hard-trim the last candidate at a word boundary
  const s = cands[cands.length - 1];
  const slice = s.slice(0, max);
  const sp = slice.lastIndexOf(' ');
  return (sp > 0 ? slice.slice(0, sp) : slice).trimEnd();
}

export function buildCfbTeamMetadata(data: CfbSchoolPage): Metadata {
  const s = data.school;
  const venue = data.venue;
  const isDestination = data.editorialStatus === 'destination';
  const fullName = `${s.name} ${s.mascot}`.trim();
  const feat = selectFeaturedRivalry(data);
  const hasRivalry = feat.source !== 'none';
  const stadium = venue?.name ?? null;
  const rival = feat.rival;

  // ── TITLE (field ≤47 → rendered ≤60 after the ' | PromoNight' template). "Schedule"
  //    is MANDATORY in every candidate — it is the head term with real volume. The
  //    trophy token is featured only when it FITS alongside "Schedule"; when it will
  //    not, we drop the TOKEN (never "Schedule"), keeping a truthful "Rivalries" hook,
  //    then "& Gameday", then bare. A school with NO 2026 rivalry game never claims
  //    "Rivalries" (no over-claim) — it takes the no-rivalry chain. ──
  const titleCands = hasRivalry
    ? [
        `${s.name} Football Schedule ${YEAR}: ${feat.token} & Gameday`,
        `${s.name} Football Schedule ${YEAR}: ${feat.token}`,
        `${s.name} Football Schedule ${YEAR}: Rivalries & Gameday`,
        `${s.name} Football Schedule ${YEAR}: Rivalries`,
        `${s.name} Football Schedule ${YEAR} & Gameday`,
        `${s.name} Football Schedule ${YEAR}`,
      ]
    : [
        `${s.name} Football Schedule ${YEAR} & Gameday`,
        `${s.name} Football Schedule ${YEAR}`,
      ];
  const title = firstFit(titleCands, TITLE_MAX);

  // ── DESCRIPTION (≤155), TIER-DERIVED, and NAMES THE RIVAL SCHOOL (that is where the
  //    volume is — "ohio state michigan rivalry" 900/mo, not the generic "rivalry
  //    games" 10/mo). Carries "[stadium] parking" (a KD-1 logistics term). A generic
  //    "SchoolA–SchoolB" rivalry label collapses to "the {rival} rivalry" (no redundant
  //    echo, and it still lands the word "rivalry"). AUTO promises only what the page
  //    has (schedule, the rivalry, venue, tickets/parking/hotels); DESTINATION (dormant)
  //    may add a gameday guide + tailgating. ──
  const stadClause = stadium ? `${stadium} parking` : 'parking';
  const genericLabel = hasRivalry && rival != null && feat.name != null
    && /–/.test(feat.name) && (feat.name.includes(rival) || feat.name.includes(s.name));
  const rivalClause = !hasRivalry || rival == null
    ? ''
    : genericLabel
      ? `the ${rival} rivalry, `
      : `${feat.name} vs ${rival}, `;
  const descCands = isDestination
    ? [
        `${fullName} ${YEAR} football schedule, ${rivalClause}a gameday guide and tailgating, plus tickets, ${stadClause} and hotels.`,
        `${fullName} ${YEAR} football schedule, ${rivalClause}gameday guide, tickets, ${stadClause} and hotels.`,
        `${s.name} ${YEAR} football schedule, ${rivalClause}gameday guide, tailgating, tickets and travel.`,
        `${s.name} ${YEAR} football schedule, gameday guide, tickets, ${stadClause} and hotels.`,
        `${s.name} ${YEAR} football schedule, gameday guide, tickets, parking and hotels.`,
      ]
    : [
        `${fullName} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels for every home game.`,
        `${fullName} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels.`,
        `${s.name} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels.`,
        `${s.name} ${YEAR} football schedule, ${rivalClause}plus tickets, parking and hotels.`,
        `${s.name} ${YEAR} football schedule, plus tickets, ${stadClause} and hotels for every home game.`,
        `${s.name} ${YEAR} football schedule, plus tickets, parking and hotels.`,
      ];
  const description = firstFit(descCands, DESC_MAX);

  const socialTitle = `${title} | PromoNight`;
  const url = `${BASE}/cfb/${s.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, siteName: 'PromoNight', url, type: 'website', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@promo_night_app', creator: '@promo_night_app', title: socialTitle, description, images: [OG_IMAGE.url] },
  };
}

// ── HUB (/cfb) metadata (§13: target "college football rivalries" KD 10, NOT the
//    unwinnable schedule head terms). ──
export function buildCfbHubMetadata(): Metadata {
  // Lead with the exact §13 winnable phrase "college football rivalries"; ≤47 so
  // the rendered <title> (+ ' | PromoNight') stays ≤60. Avoids the schedule head term.
  const title = 'College Football Rivalries & Gameday 2026'; // 41 field → 54 rendered
  // Em-dash-free (house rule: avoid em dashes in user-facing copy); colon + commas.
  const description =
    'College football rivalries, trophy games and theme nights for 2026: The Game, Iron Bowl, Red River, plus schedules and gameday plans for all 86 teams.';
  const socialTitle = `${title} | PromoNight`;
  const url = `${BASE}/cfb`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, siteName: 'PromoNight', url, type: 'website', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@promo_night_app', creator: '@promo_night_app', title: socialTitle, description, images: [OG_IMAGE.url] },
  };
}
