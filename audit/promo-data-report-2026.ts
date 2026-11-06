/* eslint-disable no-console */
// Read-only generator for audit/promo-data-report-2026.md — the 2026 promo-data
// fact base for press outreach.
//
// CONTRACT (why this file exists rather than a hand-written markdown doc):
//
//  1. EVERY NUMBER DERIVES FROM A SINGLE SOURCE FUNCTION. Nothing in the output
//     is typed by hand. Where the site already owns a definition — visibility,
//     dedupe, "upcoming", the giveaway tally, the bobblehead predicate — this
//     file IMPORTS it from src/lib rather than restating it, so a published
//     figure cannot drift from what the site itself counts.
//  2. ABSENCE IS null, NEVER ZERO. A measured zero (NBA has promos, none of them
//     upcoming) and an absent corpus (CFB has no promo subcollection at all) are
//     different facts and are rendered differently. See `Val`.
//  3. EVERY FIGURE CARRIES ITS QUERY AND ITS DOC COUNT.
//  4. EVERY FIGURE IS LABELLED SAFE / NOT SAFE TO PUBLISH by ONE function
//     (`classify`), keyed to the per-league completeness scores parsed out of
//     docs/SITE-AUDIT.md section 3. The scores are PARSED, not transcribed.
//
// READ-ONLY. No Firestore writes, no repo mutation beyond writing the report
// itself (and only under --execute; the default prints to stdout).
//
//   # print to stdout (default)
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/promo-data-report-2026.ts
//
//   # write audit/promo-data-report-2026.md
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/promo-data-report-2026.ts --execute

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '../src/lib/firebase';
// The site's own definitions. Imported, never restated — see contract note 1.
import {
  isVisiblePromo,
  dedupePromos,
  isUpcomingPromo,
  countPromosByType,
  teamDisplayName,
} from '../src/lib/promo-helpers';
import { isBobbleheadGiveaway } from '../src/lib/ebay';
import { MATCHUP_REGISTRY } from '../src/lib/cfb/matchup-registry';
import type { Promo, Team, PromoType } from '../src/lib/types';

// ── Report parameters ────────────────────────────────────────────────────────

// The season this report describes. Hardcoded deliberately, per the house rule
// (never getFullYear() in anything published): a rollover at midnight on Jan 1
// would retitle the report before 2027 data exists.
const SEASON_YEAR = 2026;
const SEASON_PREFIX = `${SEASON_YEAR}-`;

// "Today" is stamped once, at the top of the run, and threaded everywhere. Two
// calls to new Date() inside one report can straddle midnight UTC and produce an
// upcoming/past split that disagrees with itself.
const TODAY = new Date().toISOString().split('T')[0];

const REPO_ROOT = join(__dirname, '..');
const OUT_REL = 'audit/promo-data-report-2026.md';

// The publishability thresholds. See §0 of the rendered report for the argument.
const TIER_A_OVERALL = 8.0;
const TIER_A_STRUCTURAL = 8.0;
const TIER_B_STRUCTURAL = 8.0;

/** One decimal, always. A score rendered as "8" reads as a different number from "8.0". */
const f1 = (n: number): string => n.toFixed(1);

// ── Value type: measured vs absent (contract note 2) ─────────────────────────

type Val =
  | { kind: 'measured'; n: number }
  | { kind: 'absent'; n: null; why: string };

const measured = (n: number): Val => ({ kind: 'measured', n });
const absent = (why: string): Val => ({ kind: 'absent', n: null, why });

function show(v: Val): string {
  return v.kind === 'measured' ? v.n.toLocaleString('en-US') : `null (${v.why})`;
}

// ── Figure record: value + provenance + verdict ──────────────────────────────

type FigureKind =
  | 'promo-count' // a count of promos in a league
  | 'cross-league' // a figure aggregating several leagues
  | 'venue-stored' // a stored venue value from the `venues` collection
  | 'venue-hub-sourced' // a stored venue value carrying a source URL in venueHubs
  | 'structural-inventory' // a count of pages/docs, not of promo content
  | 'scored' // anything derived from the scoring layer
  | 'coverage-claim' // any "every / all / complete" wording
  | 'harvest-artifact' // the SHAPE of the figure tracks when we scraped, not the world
  | 'no-data'; // the underlying field or corpus does not exist

interface Figure {
  id: string;
  label: string;
  value: Val | string;
  query: string;
  docCount: number | null;
  kind: FigureKind;
  league?: string; // omitted for cross-league / non-league figures
  leagues?: string[]; // contributing leagues, for cross-league figures
  notes?: string[];
}

interface Verdict {
  safe: boolean;
  reason: string;
}

// ── Loaders. Every Firestore read in this file happens here. ─────────────────

interface PromoRow {
  teamId: string;
  docId: string;
  promo: Promo;
  raw: Record<string, unknown>;
}

interface Corpus {
  teams: Team[];
  teamById: Map<string, Team>;
  rawPromoDocCount: number; // the unfiltered collectionGroup count
  rows: PromoRow[]; // every promo doc, unfiltered
}

/**
 * THE ONE PROMO READ. `collectionGroup('promos')` returns every promo doc in
 * the database; league is resolved through the parent team doc because promo
 * docs carry no league field of their own.
 */
async function loadCorpus(): Promise<Corpus> {
  const teamsSnap = await db.collection('teams').get();
  const teams: Team[] = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Team);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const countSnap = await db.collectionGroup('promos').count().get();
  const rawPromoDocCount = countSnap.data().count;

  const snap = await db.collectionGroup('promos').get();
  const rows: PromoRow[] = [];
  for (const doc of snap.docs) {
    const teamId = doc.ref.parent.parent!.id;
    rows.push({ teamId, docId: doc.id, promo: doc.data() as Promo, raw: doc.data() });
  }
  return { teams, teamById, rawPromoDocCount, rows };
}

interface Schedule {
  /** `${homeTeamSlug}|${date}` for every scheduled home date. */
  homeDates: Set<string>;
  byMonth: Map<string, number>;
  byWeekday: Map<string, number>;
  total: number;
}

/**
 * The scheduled-game spine, used ONLY as a DENOMINATOR. A promo count with no
 * games under it cannot distinguish "clubs ran more promotions this month" from
 * "we scraped this month harder", and that distinction is the whole difference
 * between a publishable figure and a misleading one.
 *
 * NOTE the case trap: `games.league` is LOWERCASE ('mlb') while `teams.league`
 * is UPPERCASE ('MLB'). Comparing them directly silently yields zero rows.
 */
async function loadSchedule(league: string, yearPrefix: string): Promise<Schedule> {
  const snap = await db.collection('games').where('league', '==', league.toLowerCase()).get();
  const homeDates = new Set<string>();
  const byMonth = new Map<string, number>();
  const byWeekday = new Map<string, number>();
  for (const d of snap.docs) {
    const g = d.data() as { date?: string; homeTeamSlug?: string };
    if (typeof g.date !== 'string' || !g.date.startsWith(yearPrefix) || !g.homeTeamSlug) continue;
    const key = `${g.homeTeamSlug}|${g.date}`;
    if (homeDates.has(key)) continue; // doubleheaders are one home DATE
    homeDates.add(key);
    const m = g.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    const w = dayOfWeek(g.date);
    if (w) byWeekday.set(w, (byWeekday.get(w) ?? 0) + 1);
  }
  return { homeDates, byMonth, byWeekday, total: homeDates.size };
}

interface CfbData {
  schools: number;
  rivalries: number;
  rivalryUniquePairs: number;
  rivalriesWithTrophy: number;
  rivalriesBarePairLabels: number;
  rivalriesDormant: number;
  rivalriesOnA2026Game: number;
  traditions: number;
  traditionsEditoriallySeeded: number;
  venues: number;
  games: number;
  gamesVisible: number;
  gamesVerified: number;
  gamesVisibleVerified: number;
  themeDesignationsTotal: number;
  themeDesignationsVerified: number;
  schoolsWithPromoSubcollection: number;
  schoolsSampledForPromos: number;
}

async function loadCfb(): Promise<CfbData> {
  const [schoolsSnap, rivalriesSnap, traditionsSnap, venuesSnap, gamesSnap] = await Promise.all([
    db.collection('cfbSchools').get(),
    db.collection('cfbRivalries').get(),
    db.collection('cfbTraditions').get(),
    db.collection('cfbVenues').get(),
    db.collection('cfbGames').get(),
  ]);

  // Candidate display labels for a school, so a "SchoolA–SchoolB" auto-generated
  // name can be recognised BY ITS SHAPE. Inferring it from trophy-absence
  // instead would miscount every named rivalry that has no trophy — of which
  // there are many, including The Game and the Backyard Brawl.
  const labelsFor = new Map<string, string[]>();
  for (const d of schoolsSnap.docs) {
    const s2 = d.data() as { name?: string; shortName?: string };
    const titled = d.id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    labelsFor.set(
      d.id,
      [s2.name, s2.shortName, titled, d.id.toUpperCase(), titled.replace(/\s+/g, '')].filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
      ),
    );
  }
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isPairLabel = (name: string, ids: string[]): boolean => {
    if (ids.length !== 2) return false;
    const [a, b] = ids;
    const la = labelsFor.get(a) ?? [];
    const lb = labelsFor.get(b) ?? [];
    const n = norm(name);
    for (const x of la) for (const y of lb) {
      if (n === norm(`${x}-${y}`) || n === norm(`${y}-${x}`)) return true;
    }
    return false;
  };

  const pairs = new Set<string>();
  let withTrophy = 0;
  let dormant = 0;
  let barePairLabels = 0;
  for (const d of rivalriesSnap.docs) {
    const data = d.data() as {
      schoolIds?: string[];
      trophy?: string | null;
      dormant?: boolean;
      name?: string;
    };
    const ids = [...(data.schoolIds ?? [])].sort();
    pairs.add(ids.join('--'));
    if (data.trophy) withTrophy++;
    if (data.dormant === true) dormant++;
    if (isPairLabel(data.name ?? '', ids)) barePairLabels++;
  }

  let gamesVisible = 0;
  let gamesVerified = 0;
  let gamesVisibleVerified = 0;
  let themeTotal = 0;
  let themeVerified = 0;
  const rivalryIdsOnGames = new Set<string>();
  for (const d of gamesSnap.docs) {
    const g = d.data() as {
      tombstoned?: boolean;
      verified?: boolean;
      themeDesignations?: unknown[];
      rivalryId?: string | null;
    };
    const visible = g.tombstoned !== true;
    if (visible) gamesVisible++;
    if (g.verified === true) gamesVerified++;
    if (visible && g.verified === true) gamesVisibleVerified++;
    const themes = Array.isArray(g.themeDesignations) ? g.themeDesignations.length : 0;
    themeTotal += themes;
    if (g.verified === true) themeVerified += themes;
    if (visible && g.rivalryId) rivalryIdsOnGames.add(g.rivalryId);
  }

  // Does ANY college program carry a promo subcollection? Sampled across the
  // whole collection rather than assumed, because "CFB has no promos" is a load-
  // bearing claim in this report.
  const sample = schoolsSnap.docs;
  let withPromos = 0;
  for (const d of sample) {
    const subs = await d.ref.listCollections();
    if (subs.some((c) => c.id === 'promos')) withPromos++;
  }

  return {
    schools: schoolsSnap.size,
    rivalries: rivalriesSnap.size,
    rivalryUniquePairs: pairs.size,
    rivalriesWithTrophy: withTrophy,
    rivalriesBarePairLabels: barePairLabels,
    rivalriesDormant: dormant,
    rivalriesOnA2026Game: rivalryIdsOnGames.size,
    traditions: traditionsSnap.size,
    traditionsEditoriallySeeded: traditionsSnap.docs.filter(
      (d) => (d.data() as { editoriallySeeded?: boolean }).editoriallySeeded === true,
    ).length,
    venues: venuesSnap.size,
    games: gamesSnap.size,
    gamesVisible,
    gamesVerified,
    gamesVisibleVerified,
    themeDesignationsTotal: themeTotal,
    themeDesignationsVerified: themeVerified,
    schoolsWithPromoSubcollection: withPromos,
    schoolsSampledForPromos: sample.length,
  };
}

interface VenueDocs {
  venue: Record<string, unknown> | null;
  hub: Record<string, unknown> | null;
  tenant: Record<string, unknown> | null;
  venueSlug: string | null;
  hubSlug: string | null;
}

/**
 * Minnesota venue resolution. The site runs TWO parallel venue systems: the
 * legacy `venues` collection (what a team page renders) and `venueHubs` (what
 * /venues/[slug] renders). This reads both, plus the per-team tenant overlay,
 * because their provenance differs sharply and the report must say so.
 */
async function loadVenueTriple(teamId: string, slug: string): Promise<VenueDocs> {
  const [venueSnap, hubSnap] = await Promise.all([
    db.collection('venues').doc(slug).get(),
    db.collection('venueHubs').doc(slug).get(),
  ]);
  let tenant: Record<string, unknown> | null = null;
  if (hubSnap.exists) {
    const t = await db.collection('venueHubs').doc(slug).collection('tenants').doc(teamId).get();
    tenant = t.exists ? (t.data() as Record<string, unknown>) : null;
  }
  return {
    venue: venueSnap.exists ? (venueSnap.data() as Record<string, unknown>) : null,
    hub: hubSnap.exists ? (hubSnap.data() as Record<string, unknown>) : null,
    tenant,
    venueSlug: venueSnap.exists ? slug : null,
    hubSlug: hubSnap.exists ? slug : null,
  };
}

// ── Section 3 basis: PARSED from docs/SITE-AUDIT.md, never transcribed ───────

interface LeagueScore {
  league: string;
  overall: number;
  structural: number;
  season: string;
}

interface Basis {
  generatedStamp: string;
  source: string;
  scores: Map<string, LeagueScore>;
}

/**
 * Reads section 3 from origin/main rather than the working tree. The tree may
 * sit on a feature branch behind main, and labelling a published document
 * against a stale copy of its own basis is the failure this guards.
 */
function loadBasis(): Basis {
  const md = execFileSync('git', ['show', 'origin/main:docs/SITE-AUDIT.md'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const header = md.match(/^## 3\. Data completeness by league \[AUTO, generated ([0-9-]+)\]/m);
  const body = md.split(/^## 3\. /m)[1]?.split(/^## 4\. /m)[0] ?? '';
  const scores = new Map<string, LeagueScore>();
  for (const line of body.split('\n')) {
    const m = line.match(/^\|\s*([A-Z]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([a-z-]+)\s*\|/);
    if (m) {
      scores.set(m[1], {
        league: m[1],
        overall: Number(m[2]),
        structural: Number(m[3]),
        season: m[4],
      });
    }
  }
  // Fail LOUDLY on a partial parse. The dangerous failure is not zero rows (which
  // throws) but SOME rows: a league silently dropped by a format change would be
  // reported as "has no row in section 3 — the rubric never measured this
  // corpus", which is an affirmative claim the code would have no basis for.
  // Cross-check the parsed set against the table's own row count.
  const tableRows = body.split('\n').filter((l) => /^\|\s*[A-Za-z]/.test(l) && !/^\|\s*-/.test(l)).length - 1;
  if (scores.size === 0) throw new Error('section 3 parse produced no rows — refusing to label');
  if (tableRows !== scores.size) {
    throw new Error(
      `section 3 parse is partial: the table has ${tableRows} data rows but ${scores.size} parsed. ` +
        `A silently dropped league would be mislabelled as "never measured". Refusing to label.`,
    );
  }
  if (!header) {
    throw new Error('section 3 header carries no generated-date stamp — refusing to label against an undated basis');
  }
  return {
    generatedStamp: header[1],
    source: 'origin/main:docs/SITE-AUDIT.md §3',
    scores,
  };
}

/**
 * Recomputes the same rubric against live Firestore, so the report can say
 * whether its own basis is still true. Read-only: collectAuto() performs no
 * writes and --summary/--json are the generator's own read-only modes.
 */
async function loadLiveScores(): Promise<Map<string, LeagueScore> | null> {
  try {
    const { collectAuto } = await import('./collect');
    // Pass the SAME today the rest of the report used. collectAuto otherwise
    // takes its own clock reading, which is exactly the midnight-UTC straddle
    // this file stamps TODAY once to avoid.
    const d = await collectAuto({ today: TODAY });
    const out = new Map<string, LeagueScore>();
    for (const l of d.dataCompletenessByLeague) {
      out.set(l.league, {
        league: l.league,
        overall: Number(l.score.toFixed(1)),
        structural: Number(l.structuralScore.toFixed(1)),
        season: l.season,
      });
    }
    return out;
  } catch (err) {
    console.error('live rubric recompute failed (report degrades to published basis only):', err);
    return null;
  }
}

// ── THE classify FUNCTION. Every SAFE / NOT SAFE label comes from here. ──────

function classify(fig: Figure, basis: Basis, live: Map<string, LeagueScore> | null): Verdict {
  // A figure with nothing behind it cannot be published in either direction.
  const absentVal =
    typeof fig.value !== 'string' && fig.value.kind === 'absent' ? fig.value : null;
  if (fig.kind === 'no-data' || absentVal !== null) {
    const why = absentVal !== null ? absentVal.why : 'the underlying field does not exist';
    return {
      safe: false,
      reason: `Nothing to publish: ${why}. Stating a figure here would invent data.`,
    };
  }

  if (fig.kind === 'coverage-claim') {
    return {
      safe: false,
      reason:
        'A completeness/recall claim has no external denominator anywhere in this system. No rubric ' +
        'dimension compares our corpus against what teams actually announced, so "every"/"all"/"complete" ' +
        'is unsupportable regardless of score.',
    };
  }

  if (fig.kind === 'harvest-artifact') {
    return {
      safe: false,
      reason:
        'Harvest artifact. The distribution is confounded by when the corpus was scraped rather than by ' +
        'anything about the world, so the shape a reader would take from it is false even though every ' +
        'individual count in it is correct.',
    };
  }

  if (fig.kind === 'scored') {
    return {
      safe: false,
      reason:
        'Scored-surface figure. The 2026-08-18 rescore is a measurement boundary, the hub tally divides an ' +
        'unbounded numerator by a one-season constant, and scored surfaces flip to retrospective mode from ' +
        'Nov 8 without a deploy. Any published number silently changes meaning.',
    };
  }

  // Cross-league aggregates inherit the WEAKEST contributing league. A sitewide
  // promo total that includes NBA/NHL/NFL is only as publishable as those are.
  if (fig.kind === 'cross-league') {
    const contributing = fig.leagues ?? [...basis.scores.keys()];
    // An EMPTY list is not unanimous consent. Without this, a figure whose
    // population emptied would report "every contributing league () clears
    // Tier A" — a vacuous truth rendered as a publication verdict.
    if (contributing.length === 0) {
      return {
        safe: false,
        reason:
          'No contributing league could be determined (the population is empty), so there is nothing to ' +
          'check a verdict against. An empty scope is not a pass.',
      };
    }
    const failing = contributing.filter((l) => {
      const v = classify({ ...fig, kind: 'promo-count', league: l, leagues: undefined }, basis, live);
      return !v.safe;
    });
    if (failing.length > 0) {
      return {
        safe: false,
        reason: `Aggregates leagues that are individually not publishable (${failing.join(', ')}). A total inherits the weakest league in it.`,
      };
    }
    return { safe: true, reason: `Every contributing league (${contributing.join(', ')}) clears Tier A.` };
  }

  // Venue values out of the legacy `venues` collection carry NO provenance at
  // all: no source URL, no verifiedAt, no updatedAt, on any of its 148 docs.
  if (fig.kind === 'venue-stored') {
    return {
      safe: false,
      reason:
        'Sourced from the legacy `venues` collection, which carries no source URL, no verifiedAt and no ' +
        'updatedAt on any document. The value may well be correct, but nothing in the record says when it ' +
        'was last checked or against what, so it cannot be published as a verified fact.',
    };
  }

  const league = fig.league;
  if (!league) {
    return {
      safe: false,
      reason:
        'Unscoped figure: it names no league, so no completeness row applies to it and section 3 — the only ' +
        'sanctioned basis — cannot speak to it.',
    };
  }

  const published = basis.scores.get(league);
  if (!published) {
    return {
      safe: false,
      reason: `${league} has no row in ${basis.source}. The rubric never measured this corpus, so there is no basis on which to call any figure from it publishable.`,
    };
  }

  // DISQUALIFIER: the basis is stale FOR THIS LEAGUE, in a dimension THIS TIER
  // ACTUALLY CONSULTS. Scoping matters: Tier B reads Structural alone, so a
  // league whose Overall moved while its Structural held still has a sound
  // basis for a venue figure. Disqualifying it on a number the tier never
  // reads would suppress a defensible figure for no reason.
  const tierReadsOverall = !(fig.kind === 'venue-hub-sourced' || fig.kind === 'structural-inventory');
  if (live) {
    const now = live.get(league);
    if (now) {
      const moved = tierReadsOverall
        ? now.overall !== published.overall ||
          now.structural !== published.structural ||
          now.season !== published.season
        : now.structural !== published.structural;
      if (moved) {
        return {
          safe: false,
          reason:
            `Basis is stale for ${league}. §3 (generated ${basis.generatedStamp}) says ` +
            `${f1(published.overall)}/${f1(published.structural)} ${published.season}; recomputing the same rubric ` +
            `against live data on ${TODAY} returns ${f1(now.overall)}/${f1(now.structural)} ${now.season}. ` +
            `Labelling against a table its own generator no longer reproduces would publish a false premise. ` +
            `(Dimensions this tier consults: ${tierReadsOverall ? 'Overall, Structural and season' : 'Structural only'}.)`,
        };
      }
    }
  }

  if (fig.kind === 'venue-hub-sourced' || fig.kind === 'structural-inventory') {
    if (published.structural >= TIER_B_STRUCTURAL) {
      return {
        safe: true,
        reason: `Tier B: ${league} Structural ${f1(published.structural)} >= ${f1(TIER_B_STRUCTURAL)}. Structural is the season-independent subset, so it survives an offseason. Publishable as a coverage/inventory figure, not as an accuracy claim.`,
      };
    }
    return {
      safe: false,
      reason: `Tier B fails: ${league} Structural ${f1(published.structural)} < ${f1(TIER_B_STRUCTURAL)}.`,
    };
  }

  // Tier A — the only tier that authorises a promo-content figure.
  if (
    published.overall >= TIER_A_OVERALL &&
    published.structural >= TIER_A_STRUCTURAL &&
    published.season === 'in-season'
  ) {
    return {
      safe: true,
      reason: `Tier A: ${league} Overall ${f1(published.overall)} >= ${f1(TIER_A_OVERALL)}, Structural ${f1(published.structural)} >= ${f1(TIER_A_STRUCTURAL)}, in-season, and the live recompute still agrees. Publishable as a count, with its as-of date and denominator attached.`,
    };
  }
  return {
    safe: false,
    reason: `Tier A fails: ${league} Overall ${f1(published.overall)} (need >= ${f1(TIER_A_OVERALL)}), Structural ${f1(published.structural)} (need >= ${f1(TIER_A_STRUCTURAL)}), season ${published.season}.`,
  };
}

// ── Derivations. One function per figure family. ─────────────────────────────

interface Enriched {
  teamId: string;
  team: Team;
  league: string;
  promo: Promo;
}

/** Visible = the site's own predicate. Deduped on the site's own key. */
/** Visible rows BEFORE dedupe, so the dedupe's contribution can be measured rather than asserted. */
function visibleBeforeDedupe(c: Corpus): Enriched[] {
  return c.rows
    .map((r) => {
      const team = c.teamById.get(r.teamId);
      return team ? { teamId: r.teamId, team, league: team.league, promo: r.promo } : null;
    })
    .filter((x): x is Enriched => x !== null)
    .filter((x) => isVisiblePromo(x.promo));
}

function visiblePromos(c: Corpus): Enriched[] {
  const withTeam = c.rows
    .map((r) => {
      const team = c.teamById.get(r.teamId);
      return team ? { teamId: r.teamId, team, league: team.league, promo: r.promo } : null;
    })
    .filter((x): x is Enriched => x !== null)
    .filter((x) => isVisiblePromo(x.promo));
  return dedupePromos(
    withTeam.map((x) => ({ ...x, date: x.promo.date, title: x.promo.title })),
    (x) => x.teamId,
  ).map(({ teamId, team, league, promo }) => ({ teamId, team, league, promo }));
}

const inSeason = (e: Enriched): boolean =>
  typeof e.promo.date === 'string' && e.promo.date.startsWith(SEASON_PREFIX);

const byLeague = <T>(rows: T[], key: (t: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k) ?? [];
    list.push(r);
    m.set(k, list);
  }
  return m;
};

/** The site's giveaway tally, via the site's own counter. */
function giveawayCount(promos: Promo[]): number {
  return countPromosByType(promos).giveaway;
}

/**
 * The bobblehead predicate the SITE PUBLISHES (/promos/bobbleheads): a case-
 * insensitive /bobblehead/ against title OR description. Two narrower predicates
 * also exist in the codebase and are reported alongside, never merged.
 */
const BOBBLEHEAD_RE = /bobblehead/i;
const isBobbleheadRow = (p: Promo): boolean =>
  BOBBLEHEAD_RE.test(p.title ?? '') || BOBBLEHEAD_RE.test(p.description ?? '');

/**
 * Rows the site's bobblehead predicate admits ONLY on a description match — the
 * title never says bobblehead. These are mostly theme nights that mention a
 * bobblehead in passing, so they inflate any "N bobblehead giveaways" sentence.
 * Reported separately rather than silently folded in either direction.
 */
const isDescriptionOnlyBobblehead = (p: Promo): boolean =>
  !BOBBLEHEAD_RE.test(p.title ?? '') && BOBBLEHEAD_RE.test(p.description ?? '');

/**
 * A row whose own description says the item requires buying something. Neither
 * counting predicate reads distribution mechanics, so a ticket-package add-on
 * counts identically to a free gate giveaway — and "giveaway" is the word the
 * report would be handing a journalist.
 */
const PURCHASE_RE =
  /ticket (?:package|offer)|special(?:ty)? ticket|package purchase|purchase of|with the purchase|add-?on|separate ticket|theme game package|voucher required/i;
const isPurchaseGated = (p: Promo): boolean => PURCHASE_RE.test(p.description ?? '');

/**
 * The bobblehead-class vocabulary the two counting predicates do NOT cover.
 * The render layer already treats these as bobbleheads — resolveIcon in
 * src/lib/promo-helpers.ts matches /bobblehead|figurine|figure|statue/ to pick
 * the bobblehead icon — so a row can render WITH the bobblehead icon on the
 * site while sitting outside every count in this report.
 */
const WIDER_BOBBLE_RE = /bobble\s?-?\s?(?:head|legs?|cards?|figurine)?|figurine/i;
const isWiderBobbleClass = (p: Promo): boolean =>
  WIDER_BOBBLE_RE.test(p.title ?? '') || WIDER_BOBBLE_RE.test(p.description ?? '');

/** "2026-09" -> "September". Avoids printing a bare "09" in prose. */
function monthName(ym: string): string {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayOfWeek(ymd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  // Noon UTC: immune to the off-by-one a local-midnight parse produces.
  return DOW[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
}

// ── Rendering helpers ────────────────────────────────────────────────────────

function verdictLine(fig: Figure, v: Verdict): string {
  const tag = v.safe ? '**SAFE TO PUBLISH**' : '**NOT SAFE TO PUBLISH**';
  return `${tag} — ${v.reason}`;
}

function figureBlock(fig: Figure, v: Verdict): string[] {
  const val = typeof fig.value === 'string' ? fig.value : show(fig.value);
  return [
    `**${fig.label}: ${val}**`,
    '',
    '```',
    fig.query.trim(),
    '```',
    '',
    `- Docs behind it: ${fig.docCount === null ? 'null (no documents exist)' : fig.docCount.toLocaleString('en-US')}`,
    ...(fig.notes ?? []).map((n) => `- ${n}`),
    `- ${verdictLine(fig, v)}`,
    '',
  ];
}

function table(headers: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
}

export { classify, loadBasis, SEASON_YEAR };

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const execute = process.argv.includes('--execute');

  console.error('Loading corpus…');
  const corpus = await loadCorpus();
  console.error('Loading CFB…');
  const cfb = await loadCfb();
  console.error('Loading MLB schedule (denominators)…');
  const mlbSchedule = await loadSchedule('MLB', SEASON_PREFIX);
  console.error('Loading basis…');
  const basis = loadBasis();
  console.error('Recomputing live rubric…');
  const live = await loadLiveScores();

  const preDedupe = visibleBeforeDedupe(corpus);
  const visible = visiblePromos(corpus);
  const dedupeCollapsed = preDedupe.length - visible.length;
  const datelessVisible = visible.filter(
    (e) => typeof e.promo.date !== 'string' || e.promo.date === '',
  );
  const tombstoned = corpus.rows.filter((r) => r.promo.tombstoned === true).length;
  const dated = visible.filter((e) => typeof e.promo.date === 'string' && e.promo.date !== '');
  const upcoming = dated.filter((e) => isUpcomingPromo(e.promo, TODAY));
  const season = visible.filter(inSeason);

  const leagues = [...new Set(corpus.teams.map((t) => t.league))].sort();
  const out: string[] = [];
  const notSafe: Array<{ id: string; label: string; reason: string }> = [];

  /** Collapses a verdict into the disqualifier that produced it, for the summary. */
  const bucket = (reason: string): string => {
    if (reason.startsWith('Nothing to publish')) return 'The data does not exist';
    if (reason.startsWith('Basis is stale')) return 'The completeness basis is stale for that league';
    if (reason.startsWith('Aggregates leagues')) return 'Cross-league total inherits a failing league';
    if (reason.startsWith('Sourced from the legacy')) return 'Venue value has no provenance';
    if (reason.includes('has no row in')) return 'No completeness row exists (CFB)';
    if (reason.startsWith('Tier A fails') || reason.startsWith('Tier B fails')) return 'League scores below threshold';
    if (reason.startsWith('A completeness/recall claim')) return 'Coverage claim, no external denominator';
    if (reason.startsWith('Scored-surface')) return 'Scored-surface boundary';
    if (reason.startsWith('Unscoped figure')) return 'Figure names no league';
    if (reason.startsWith('No contributing league')) return 'Empty population, no scope to check';
    if (reason.startsWith('Harvest artifact')) return 'Shape is an ingestion artifact';
    return 'Other';
  };

  const record = (id: string, label: string, v: Verdict) => {
    if (!v.safe) notSafe.push({ id, label, reason: bucket(v.reason) });
  };

  const emit = (fig: Figure) => {
    const v = classify(fig, basis, live);
    record(fig.id, fig.label, v);
    out.push(...figureBlock(fig, v));
    return v;
  };

  // ═══ Header ═══
  out.push(
    `# 2026 promo data report`,
    '',
    `Fact base for press outreach. **Generated ${TODAY}** by \`audit/promo-data-report-2026.ts\` — every ` +
      `number below is derived at run time; nothing is transcribed. Regenerate rather than edit.`,
    '',
    `- **Season described:** ${SEASON_YEAR} (hardcoded; the report does not roll over on Jan 1).`,
    `- **"Upcoming" means:** \`date >= ${TODAY}\`, the site's own \`isUpcomingPromo\`.`,
    `- **"Visible" means:** \`tombstoned !== true\`, the site's own \`isVisiblePromo\`, then the site's own ` +
      `\`dedupePromos\` on \`(team, date, lowercased title)\`.`,
    `- **Publishability basis:** ${basis.source}, generated ${basis.generatedStamp}.`,
    '',
    '---',
    '',
  );

  // ═══ §0 The rule ═══
  out.push('## 0. How SAFE / NOT SAFE was decided', '');
  out.push(
    'One function (`classify`) labels every figure. It reads the per-league completeness scores parsed out',
    'of section 3 and applies three tiers plus a set of disqualifiers that override them.',
    '',
    `- **Tier A** (publishable as a promo-content figure): Overall >= ${f1(TIER_A_OVERALL)} **and** Structural >= ${f1(TIER_A_STRUCTURAL)} **and** season = in-season.`,
    `- **Tier B** (publishable as coverage/inventory only): Structural >= ${f1(TIER_B_STRUCTURAL)}. Structural is the season-independent subset, so it survives an offseason.`,
    '- **Tier C**: everything else — not publishable.',
    '',
    'Why 8.0 on both. Overall is the promo half plus half of Structural, each half scored out of 5.0. Requiring',
    'Structural >= 8.0 pins the structural half at >= 4.0 of 5.0. Requiring Overall >= 8.0 on top of that forces',
    'the promo half to at least 8.0 - (Structural / 2), which for a league at the Structural floor means >= 4.0,',
    'and for a structurally strong league can be less: WNBA at 8.0 Overall / 8.9 Structural carries a promo half',
    'of 3.55, not 4.0. So the pair is not a guarantee that four clubs in five are deep — it is a floor that rises',
    'as structural quality falls, which is the property worth having. What it does reliably exclude is the case',
    'the rubric is most likely to flatter: a league where most clubs scraped a single row, since "has >= 1',
    'upcoming" alone is worth 3.0 of the promo half\'s 5.0 and cannot on its own reach the floor.',
    '',
    'Neither score measures ACCURACY. Every dimension is a field-presence test: none checks whether a promo\'s',
    'date, opponent or title is right, and none compares our corpus against what clubs actually announced.',
    'A Tier A pass authorises publishing a COUNT. It never authorises a claim of completeness.',
    '',
    'Disqualifiers that override the tiers, in the order `classify` applies them:',
    '',
    '1. **Nothing behind it.** The field or corpus does not exist. Publishing would invent data.',
    '2. **Coverage/recall claim.** No dimension of the rubric has an external denominator, so no score can',
    '   ever support "every", "all", or "complete".',
    '3. **Scored-surface figure.** Rescore boundary, an unbounded-numerator hub tally, and a Nov 8 flip to',
    '   retrospective mode that happens with no deploy.',
    '4. **Cross-league aggregate inherits its weakest league.** A sitewide total that includes a league which',
    '   fails on its own is not rescued by the leagues that pass.',
    '5. **Legacy `venues` provenance.** That collection carries no source URL, no `verifiedAt` and no',
    '   `updatedAt` on any of its documents.',
    '6. **No section-3 row.** A corpus the rubric never measured has no basis (this is what excludes CFB).',
    '7. **Stale basis for that league**, in a dimension the tier actually reads. If recomputing the rubric live',
    '   disagrees with the published table on a number the tier consults, that league is disqualified. Tier B',
    '   reads Structural alone, so a league whose Overall moved while its Structural held is not disqualified',
    '   from a venue figure by a number that figure never used.',
    '8. **Unscoped figure.** A figure naming no league has no completeness row to rest on.',
    '9. **Harvest artifact.** The counts are right but their SHAPE tracks when we scraped rather than the world.',
    '   Section 5 is the live example, and it is the most consequential single finding in this report.',
    '',
  );

  // The stale-basis check, rendered.
  out.push('### The basis is partly stale — measured, not assumed', '');
  if (live) {
    const rows: string[][] = [];
    for (const l of [...basis.scores.keys()]) {
      const p = basis.scores.get(l)!;
      const n = live.get(l);
      const moved = n && (n.overall !== p.overall || n.structural !== p.structural || n.season !== p.season);
      rows.push([
        l,
        `${f1(p.overall)} / ${f1(p.structural)} / ${p.season}`,
        n ? `${f1(n.overall)} / ${f1(n.structural)} / ${n.season}` : 'n/a',
        moved ? '**MOVED**' : 'unchanged',
      ]);
    }
    out.push(
      `Section 3 was generated **${basis.generatedStamp}**. Re-running the same collector against live data`,
      `on **${TODAY}** gives:`,
      '',
      ...table(['League', `Published (${basis.generatedStamp})`, `Live (${TODAY})`, 'Status'], rows),
      '',
      'A league whose row moved is disqualified below, because the published table its label would rest on is',
      'no longer reproducible by its own generator.',
      '',
    );
  } else {
    out.push('Live recompute unavailable this run; every label rests on the published table alone.', '');
  }

  out.push(
    '### One caveat this report cannot resolve from inside this repo',
    '',
    'A publish hold on promo-data changes is recorded in project notes as being in force since 2026-08-25,',
    'pending work on measured model-side extraction variance. The pipeline that owns it lives in a different',
    'checkout, and its branch-state doc records the branch as *nothing executed*, not as an explicit hold on',
    'reporting. **SAFE below therefore means "defensible on the data as it stands", not "cleared to ship".**',
    'Confirm the hold is lifted before any of this reaches a journalist.',
    '',
    '---',
    '',
  );

  // ═══ §1 Totals ═══
  out.push('## 1. Total promos tracked, by league', '');
  out.push(
    `Two numbers exist for "all-time". The raw figure is ${(((corpus.rawPromoDocCount - visible.length) / visible.length) * 100).toFixed(1)}% larger than the filtered one`,
    `(${corpus.rawPromoDocCount.toLocaleString('en-US')} against ${visible.length.toLocaleString('en-US')}; the ${tombstoned.toLocaleString('en-US')} tombstoned rows are ${((tombstoned / corpus.rawPromoDocCount) * 100).toFixed(1)}% of the raw total). The site's`,
    'homepage stat uses the raw one; this report uses the filtered one everywhere and shows the raw only to',
    'mark it unpublishable.',
    '',
  );

  emit({
    id: '1.1',
    label: 'All promo documents (RAW, unfiltered)',
    value: measured(corpus.rawPromoDocCount),
    query: `db.collectionGroup('promos').count().get()`,
    docCount: corpus.rawPromoDocCount,
    kind: 'cross-league',
    leagues,
    notes: [
      `Includes ${tombstoned.toLocaleString('en-US')} soft-deleted (tombstoned) documents that no site surface renders.`,
      'This is the number `getPromoCount()` returns and the homepage renders. Its own code comment concedes it over-counts.',
    ],
  });

  emit({
    id: '1.2',
    label: 'All promos, all-time (visible + deduped)',
    value: measured(visible.length),
    query: `db.collectionGroup('promos').get()\n  .filter(isVisiblePromo)          // tombstoned !== true\n  .then(dedupePromos(key = team.id + date + lowercased title))`,
    docCount: visible.length,
    kind: 'cross-league',
    leagues,
    notes: [
      `Raw ${corpus.rawPromoDocCount.toLocaleString('en-US')} minus ${tombstoned.toLocaleString('en-US')} tombstoned minus ${dedupeCollapsed.toLocaleString('en-US')} dedupe collisions` +
        (dedupeCollapsed === 0
          ? ' — the dedupe stage is measurably inert on this corpus today, so it contributes nothing to this figure.'
          : '.'),
      'Spans multiple seasons — it is an archive figure, not a claim about what a fan can attend.',
      `${datelessVisible.length} of these rows carry no usable date (${datelessVisible
        .map((e) => `${teamDisplayName(e.team)}: ${e.promo.title}`)
        .slice(0, 5)
        .join('; ')}) and belong to neither the upcoming nor the past population, per the site's own splitPromosByDate.`,
    ],
  });

  emit({
    id: '1.3',
    label: `Upcoming promos (date >= ${TODAY}), all leagues`,
    value: measured(upcoming.length),
    query: `visible+deduped promos, then .filter(p => p.date >= '${TODAY}')   // isUpcomingPromo`,
    docCount: upcoming.length,
    kind: 'cross-league',
    leagues,
  });

  // Per-league breakdown table + per-league verdicts.
  const allByLeague = byLeague(visible, (e) => e.league);
  const upByLeague = byLeague(upcoming, (e) => e.league);
  const seasonByLeague = byLeague(season, (e) => e.league);

  const leagueRows: string[][] = [];
  for (const l of leagues) {
    const teamsIn = corpus.teams.filter((t) => t.league === l);
    const up = upByLeague.get(l) ?? [];
    const teamsWithUpcoming = new Set(up.map((e) => e.teamId)).size;
    const v = classify(
      {
        id: `1.4-${l}`,
        label: l,
        value: measured((allByLeague.get(l) ?? []).length),
        query: '',
        docCount: null,
        kind: 'promo-count',
        league: l,
      },
      basis,
      live,
    );
    leagueRows.push([
      l,
      String(teamsIn.length),
      (allByLeague.get(l) ?? []).length.toLocaleString('en-US'),
      (seasonByLeague.get(l) ?? []).length.toLocaleString('en-US'),
      up.length.toLocaleString('en-US'),
      `${teamsWithUpcoming}/${teamsIn.length}`,
      v.safe ? 'SAFE' : 'NOT SAFE',
    ]);
  }
  out.push(
    '### Per-league breakdown',
    '',
    ...table(
      ['League', 'Teams', 'All-time (visible)', `${SEASON_YEAR} dated`, `Upcoming (>= ${TODAY})`, 'Teams with >=1 upcoming', 'Verdict'],
      leagueRows,
    ),
    '',
    `Query: \`db.collectionGroup('promos').get()\` → resolve league via \`doc.ref.parent.parent.id\` → \`teams/{id}.league\` (promo documents carry no league field), then \`isVisiblePromo\` → \`dedupePromos\`.`,
    '',
  );

  for (const l of leagues) {
    const v = classify(
      { id: `1.4-${l}`, label: l, value: measured(0), query: '', docCount: null, kind: 'promo-count', league: l },
      basis,
      live,
    );
    record(`1.4-${l}`, `${l} promo counts`, v);
    out.push(`- **${l}** — ${v.safe ? '**SAFE TO PUBLISH**' : '**NOT SAFE TO PUBLISH**'} — ${v.reason}`);
  }
  out.push('', '---', '');

  // ═══ §2 MLB ranking ═══
  out.push(`## 2. Teams ranked by ${SEASON_YEAR} promo count — MLB only`, '');
  const mlbTeams = corpus.teams.filter((t) => t.league === 'MLB');
  const mlbSeason = seasonByLeague.get('MLB') ?? [];
  const perTeam = new Map<string, number>();
  for (const t of mlbTeams) perTeam.set(t.id, 0);
  for (const e of mlbSeason) perTeam.set(e.teamId, (perTeam.get(e.teamId) ?? 0) + 1);
  const ranked = [...perTeam.entries()]
    .map(([id, n]) => ({ team: corpus.teamById.get(id)!, n }))
    .sort((a, b) => b.n - a.n || a.team.id.localeCompare(b.team.id));

  const mlbVerdict = classify(
    {
      id: '2.1',
      label: 'MLB ranking',
      value: measured(mlbSeason.length),
      query: '',
      docCount: mlbSeason.length,
      kind: 'promo-count',
      league: 'MLB',
    },
    basis,
    live,
  );
  out.push(
    `Query: visible+deduped promos where \`teams/{id}.league == 'MLB'\` and \`date.startsWith('${SEASON_PREFIX}')\`.`,
    `Population: **${mlbSeason.length.toLocaleString('en-US')} promos across ${mlbTeams.length} clubs**` +
      ` (${ranked.filter((r) => r.n > 0).length} clubs with >= 1).`,
    '',
    `${mlbVerdict.safe ? '**SAFE TO PUBLISH**' : '**NOT SAFE TO PUBLISH**'} — ${mlbVerdict.reason}`,
    '',
    '### Top 10',
    '',
    ...table(
      ['#', 'Team', `${SEASON_YEAR} promos`],
      ranked.slice(0, 10).map((r, i) => [String(i + 1), teamDisplayName(r.team), String(r.n)]),
    ),
    '',
    '### Bottom 10',
    '',
    ...table(
      ['#', 'Team', `${SEASON_YEAR} promos`],
      ranked
        .slice(-10)
        .map((r, i) => [String(ranked.length - 10 + i + 1), teamDisplayName(r.team), String(r.n)]),
    ),
    '',
  );
  record('2.1', `MLB ${SEASON_YEAR} ranking`, mlbVerdict);

  out.push(
    '### Every other league: excluded from the ranking',
    '',
    'Two different reasons appear below and they should not be conflated. A league that FAILS the publication',
    'rule cannot be ranked at all. A league that PASSES it is still not ranked here, because the brief asked',
    'for MLB and because a club-by-club ordering is the most fragile thing a promo corpus can support — it',
    'turns a scraping outcome into a league table.',
    '',
  );
  for (const l of leagues.filter((x) => x !== 'MLB')) {
    const p = basis.scores.get(l);
    const teamsIn = corpus.teams.filter((t) => t.league === l).length;
    const up = (upByLeague.get(l) ?? []).length;
    const withUp = new Set((upByLeague.get(l) ?? []).map((e) => e.teamId)).size;
    const n = live?.get(l);
    const lv = classify(
      { id: 'x', label: '', value: measured(0), query: '', docCount: null, kind: 'promo-count', league: l },
      basis,
      live,
    );
    out.push(
      `- **${l}** — §3 Overall ${p ? f1(p.overall) : 'n/a'} / Structural ${p ? f1(p.structural) : 'n/a'} (${p?.season ?? 'n/a'})` +
        (n && (n.overall !== p?.overall || n.season !== p?.season)
          ? `; live today ${f1(n.overall)}/${f1(n.structural)} ${n.season}`
          : '') +
        `. ${withUp} of ${teamsIn} clubs carry an upcoming promo (${up.toLocaleString('en-US')} rows). ` +
        (lv.safe
          ? `This league PASSES the publication rule, so its counts are quotable; it is simply not ranked here. ` +
            `Not excluded for data quality.`
          : `**Fails the publication rule, so a ranking would order clubs by how well we scraped them, not by how ` +
            `much they run.** Excluded.`),
    );
  }
  out.push('', '---', '');

  // ═══ §3 Bobbleheads ═══
  out.push(`## 3. Bobblehead giveaways, ${SEASON_YEAR}`, '');
  const bobble = season.filter((e) => isBobbleheadRow(e.promo));
  const bobbleStrict = season.filter((e) => isBobbleheadGiveaway(e.promo));
  const bobbleDescOnly = season.filter((e) => isDescriptionOnlyBobblehead(e.promo));
  const strictGated = bobbleStrict.filter((e) => isPurchaseGated(e.promo));
  const strictFree = bobbleStrict.filter((e) => !isPurchaseGated(e.promo));
  // Rows the WIDER vocabulary catches that the site predicate misses entirely.
  const missedByBoth = season.filter(
    (e) => !isBobbleheadRow(e.promo) && isWiderBobbleClass(e.promo) && !isPurchaseGated(e.promo),
  );
  const descOnlyGated = bobbleDescOnly.filter((e) => isPurchaseGated(e.promo)).length;
  const descOnlyFree = bobbleDescOnly.length - descOnlyGated;
  const bobbleByLeague = byLeague(bobble, (e) => e.league);

  out.push(
    'The codebase carries **four** different bobblehead predicates and they disagree. Each is reported',
    'separately below rather than merged, because the gaps between them are the finding.',
    '',
    `- **Site predicate** (\`/promos/bobbleheads\`): \`/bobblehead/i\` against **title OR description**.`,
    `- **Strict predicate** (\`isBobbleheadGiveaway\`, the eBay link gate): \`type === 'giveaway' && /bobblehead/i.test(title)\`.`,
    `- A third, scoring-based predicate (\`derivedSignals.itemType === 'bobblehead'\`) exists but is confined to scored leagues and is excluded here as a scored figure.`,
    `- A **fourth** lives in the render layer: \`resolveIcon\` matches \`/bobblehead|figurine|figure|statue/\` to pick the bobblehead icon, so a row can render on the site with a bobblehead icon while sitting outside every count below.`,
    '',
    '**Neither counting predicate is a clean floor, and the errors run in both directions.**',
    '',
    `**It over-counts, because neither predicate reads distribution mechanics.** ${strictGated.length} of the ${bobbleStrict.length} strict rows`,
    `describe an item you can only get by buying a ticket package — two are literally titled as a ticket "offer".`,
    `Those are not giveaways. Removing them leaves **${strictFree.length}** rows that are not purchase-gated by their own`,
    `description text, and that is the closest thing to a defensible "bobblehead giveaway" count. It is a text`,
    `test on prose the scraper captured, not a confirmed distribution mechanic, so it is approximate in both`,
    `directions.`,
    '',
    `**It also under-counts, because both predicates are literal substring tests.** ${missedByBoth.length} further ${SEASON_YEAR} rows describe a`,
    `bobblehead-class item in vocabulary neither predicate covers — "bobble figurine", "bobblelegs", "bobblecard"`,
    `— and several are unambiguous first-N-fans giveaways. The inconsistency is visible inside one product class:`,
    `some bobblecard rows are counted and others are not, purely because the scraper's description happened to`,
    `use the word "bobblehead".`,
    '',
    `**The description-only rows are not what they look like either.** ${bobbleDescOnly.length} rows match on description alone.`,
    `They are not passing mentions — in each the bobblehead is the named promotional item. The real split inside`,
    `them is ${descOnlyGated} purchase-gated against ${descOnlyFree} that are not, and among the latter are genuine free giveaway nights`,
    `the strict column drops entirely.`,
    '',
    `The Minnesota Twins illustrate the description-match direction: the site predicate returns 2 rows for them,`,
    `of which exactly one (Buxton Bobblehead, ${SEASON_YEAR}-06-27) is a bobblehead giveaway; the other is Star Wars Night.`,
    '',
    `**Practical guidance:** publish **approximately ${strictFree.length}** (strict, purchase-gated removed) as the ${SEASON_YEAR} bobblehead`,
    `giveaway count, always with "approximately", and do not publish ${bobble.length} or ${bobbleStrict.length} unqualified.`,
    '',
  );

  emit({
    id: '3.1',
    label: `${SEASON_YEAR} bobblehead promos, all leagues (site predicate)`,
    value: measured(bobble.length),
    query: `visible+deduped promos where date.startsWith('${SEASON_PREFIX}')\n  .filter(p => /bobblehead/i.test(p.title) || /bobblehead/i.test(p.description))`,
    docCount: bobble.length,
    kind: 'cross-league',
    leagues: [...bobbleByLeague.keys()].sort(),
    notes: [`Strict predicate over the same population returns ${bobbleStrict.length}.`],
  });

  const bobbleRows: string[][] = [];
  for (const l of leagues) {
    const rows = bobbleByLeague.get(l) ?? [];
    const strict = bobbleStrict.filter((e) => e.league === l).length;
    const descOnly = bobbleDescOnly.filter((e) => e.league === l).length;
    const free = strictFree.filter((e) => e.league === l).length;
    const missed = missedByBoth.filter((e) => e.league === l).length;
    const v = classify(
      { id: `3.2-${l}`, label: l, value: measured(rows.length), query: '', docCount: null, kind: 'promo-count', league: l },
      basis,
      live,
    );
    bobbleRows.push([
      l,
      String(rows.length),
      String(strict),
      String(free),
      String(descOnly),
      String(missed),
      String(new Set(rows.map((e) => e.teamId)).size),
      v.safe ? 'SAFE' : 'NOT SAFE',
    ]);
  }
  out.push(
    '### By league',
    '',
    ...table(
      [
        'League',
        'Site predicate',
        'Strict',
        'Strict, not gated',
        'Description-only',
        'Missed by both',
        'Teams',
        'Verdict',
      ],
      bobbleRows,
    ),
    '',
    '"Strict, not gated" is the column to quote. "Missed by both" counts rows using bobblehead-class vocabulary',
    'neither predicate matches, so the true giveaway figure sits somewhere above that column, not below it.',
    '',
  );

  const bobbleByTeam = new Map<string, number>();
  for (const e of bobble) bobbleByTeam.set(e.teamId, (bobbleByTeam.get(e.teamId) ?? 0) + 1);
  const teamRows = [...bobbleByTeam.entries()]
    .map(([id, n]) => ({ team: corpus.teamById.get(id)!, n }))
    .sort((a, b) => b.n - a.n || a.team.id.localeCompare(b.team.id));
  out.push(
    '### By team',
    '',
    `${teamRows.length} of ${corpus.teams.length} teams have at least one ${SEASON_YEAR} bobblehead row.`,
    '',
    ...table(
      ['Team', 'League', `${SEASON_YEAR} (site predicate)`, `${SEASON_YEAR} (strict)`, `${SEASON_YEAR} (strict, not gated)`, 'Verdict'],
      teamRows.map((r) => {
        const v = classify(
          { id: 'x', label: '', value: measured(r.n), query: '', docCount: null, kind: 'promo-count', league: r.team.league },
          basis,
          live,
        );
        const strict = bobbleStrict.filter((e) => e.teamId === r.team.id).length;
        const free = strictFree.filter((e) => e.teamId === r.team.id).length;
        return [
          teamDisplayName(r.team),
          r.team.league,
          String(r.n),
          String(strict),
          String(free),
          v.safe ? 'SAFE' : 'NOT SAFE',
        ];
      }),
    ),
    '',
  );

  // Busiest bobblehead date. Computed on BOTH predicates; the strict one leads,
  // because it is the only one an outside reader could check against a schedule.
  // "Nights", not rows. Two rows for the same club on the same date are one
  // night, and a purchase-gated add-on is not a bobblehead night at all.
  const peakOf = (rows: Enriched[]) => {
    const m = new Map<string, Enriched[]>();
    for (const e of rows) {
      const list = m.get(e.promo.date) ?? [];
      list.push(e);
      m.set(e.promo.date, list);
    }
    const nightsOn = (list: Enriched[]) => new Set(list.map((e) => e.teamId)).size;
    const sorted = [...m.entries()].sort(
      (a, b) => nightsOn(b[1]) - nightsOn(a[1]) || a[0].localeCompare(b[0]),
    );
    const n = sorted.length > 0 ? nightsOn(sorted[0][1]) : 0;
    return { sorted, n, tied: sorted.filter(([, v]) => nightsOn(v) === n), nightsOn };
  };
  // Free-only is the population a "bobblehead night" superlative can describe.
  const strictPeak = peakOf(strictFree);
  const sitePeak = peakOf(bobble);
  const mlbPeak = peakOf(strictFree.filter((e) => e.league === 'MLB'));
  /** Runners-up as WHOLE tie groups — a slice(0,3) would break the ties the query line promises never to break. */
  const runnersUp = (pk: ReturnType<typeof peakOf>, skip: number): string => {
    const rest = pk.sorted.slice(skip);
    if (rest.length === 0) return 'none';
    const nextN = pk.nightsOn(rest[0][1]);
    const group = rest.filter(([, v]) => pk.nightsOn(v) === nextN);
    return `${group.map(([d]) => d).join(', ')} (${nextN} each)`;
  };
  const peak = strictPeak.sorted;
  const peakN = strictPeak.n;
  const tied = strictPeak.tied;
  emit({
    id: '3.3',
    label: 'Single date carrying the most bobblehead nights league-wide',
    value:
      peak.length === 0
        ? absent(`no ${SEASON_YEAR} free bobblehead giveaway rows exist`)
        : `${tied.map(([d]) => d).join(', ')} — ${peakN} bobblehead nights${tied.length > 1 ? ` (${tied.length}-way tie)` : ''}`,
    query: `${SEASON_YEAR} bobblehead rows, STRICT predicate (type === 'giveaway' && /bobblehead/i.test(title))\n  MINUS purchase-gated rows (description names a ticket package)\n  grouped by exact date, counted as DISTINCT CLUBS (nights, not rows); whole tie groups reported`,
    docCount: peakN * tied.length,
    kind: 'cross-league',
    // Every league in the RANKED POPULATION, not just the winning dates. A
    // "busiest date league-wide" claim is only as sound as the corpora it
    // ranked against — a league we under-scraped could hold the real peak.
    leagues: [...new Set(bobbleStrict.map((e) => e.league))].sort(),
    notes:
      peak.length > 0
        ? [
            `Clubs on that date: ${tied.map(([d, v]) => `${d}: ${v.map((e) => teamDisplayName(e.team)).join(', ')}`).join(' | ')}`,
            `Runners-up: ${runnersUp(strictPeak, tied.length)}`,
            `Counting ROWS instead of nights, and without removing purchase-gated add-ons, the answer differs — ` +
              `which is why the unit matters: the looser site predicate peaks at ${sitePeak.tied.map(([d]) => d).join(', ')} with ${sitePeak.n}.`,
            `A "league-wide" superlative is only as sound as the weakest corpus it ranked against, which is why ` +
              `this one is not publishable: an under-scraped league could hold the real peak. The MLB-only ` +
              `version below is.`,
          ]
        : [],
  });

  emit({
    id: '3.4',
    label: `Single date carrying the most bobblehead nights — MLB only`,
    value:
      mlbPeak.sorted.length === 0
        ? absent(`no ${SEASON_YEAR} MLB free bobblehead giveaway rows exist`)
        : `${mlbPeak.tied.map(([d]) => d).join(', ')} — ${mlbPeak.n} bobblehead nights${mlbPeak.tied.length > 1 ? ` (${mlbPeak.tied.length}-way tie)` : ''}`,
    query: `${SEASON_YEAR} MLB bobblehead rows, STRICT predicate minus purchase-gated, grouped by exact date,\n  counted as distinct clubs (nights, not rows); whole tie groups reported`,
    docCount: mlbPeak.n * mlbPeak.tied.length,
    kind: 'promo-count',
    league: 'MLB',
    notes:
      mlbPeak.sorted.length > 0
        ? [
            `Clubs: ${mlbPeak.tied.map(([d, v]) => `${d}: ${v.map((e) => teamDisplayName(e.team)).join(', ')}`).join(' | ')}`,
            `Runners-up: ${runnersUp(mlbPeak, mlbPeak.tied.length)}`,
          ]
        : [],
  });
  out.push('---', '');

  // ═══ §4 Day of week ═══
  out.push(`## 4. Day-of-week distribution — ${SEASON_YEAR} MLB giveaways`, '');
  const mlbSeasonPromos = mlbSeason.map((e) => e.promo);
  const mlbGiveaways = mlbSeason.filter((e) => e.promo.type === 'giveaway');
  const dowCounts = new Map<string, number>(DOW.map((d) => [d, 0]));
  let undated = 0;
  for (const e of mlbGiveaways) {
    const d = dayOfWeek(e.promo.date);
    if (d === null) undated++;
    else dowCounts.set(d, (dowCounts.get(d) ?? 0) + 1);
  }
  const dowTotal = [...dowCounts.values()].reduce((a, b) => a + b, 0);
  const dowVerdict = classify(
    { id: '4.1', label: 'MLB DOW', value: measured(dowTotal), query: '', docCount: dowTotal, kind: 'promo-count', league: 'MLB' },
    basis,
    live,
  );
  record('4.1', 'MLB day-of-week distribution', dowVerdict);
  // A raw share is not publishable on its own: the supply of home dates varies
  // by weekday, so a low share can be a schedule fact rather than a promo fact.
  // Every row therefore carries the denominator that makes it interpretable.
  const dowRows = DOW.map((d) => {
    const n = dowCounts.get(d) ?? 0;
    const games = mlbSchedule.byWeekday.get(d) ?? 0;
    const perGame = games > 0 ? n / games : null;
    return { d, n, games, perGame };
  });
  const perGameTotal = dowRows.reduce((a, r) => a + (r.perGame ?? 0), 0);
  const byPerGame = [...dowRows].filter((r) => r.perGame !== null).sort((a, b) => b.perGame! - a.perGame!);
  const byShare = [...dowRows].sort((a, b) => b.n - a.n);

  out.push(
    '```',
    `visible+deduped promos where league == 'MLB' and date.startsWith('${SEASON_PREFIX}') and type == 'giveaway'`,
    `  grouped by new Date(date + 'T12:00:00Z').getUTCDay()`,
    `denominator: distinct scheduled home dates per weekday, from the games collection`,
    `  db.collection('games').where('league','==','mlb')   // NOTE: lowercase in games, uppercase in teams`,
    '```',
    '',
    `Population: **${dowTotal.toLocaleString('en-US')} MLB giveaway rows** in ${SEASON_YEAR}` +
      (undated > 0 ? `; ${undated} excluded for a malformed date.` : '.') +
      ` Denominator: **${mlbSchedule.total.toLocaleString('en-US')} scheduled home dates**.`,
    '',
    ...table(
      ['Day', 'Giveaways', 'Share of promos', 'Scheduled home dates', 'Giveaways per home date', 'Share, supply-adjusted'],
      dowRows.map((r) => [
        r.d,
        String(r.n),
        dowTotal ? `${((r.n / dowTotal) * 100).toFixed(1)}%` : 'n/a',
        String(r.games),
        r.perGame === null ? 'n/a' : r.perGame.toFixed(3),
        r.perGame === null || perGameTotal === 0 ? 'n/a' : `${((r.perGame / perGameTotal) * 100).toFixed(1)}%`,
      ]),
    ),
    '',
    `**The denominator changes the story at the bottom of the table, and not at the top.** Ranked by raw`,
    `share the busiest days are ${byShare.slice(0, 2).map((r) => r.d).join(' and ')}; ranked per available home date they are still`,
    `${byPerGame.slice(0, 2).map((r) => r.d).join(' and ')}, so the weekend peak is a real behaviour and is safe to state. The quiet end is not:`,
    `${byShare[byShare.length - 1].d} looks like the quietest day on raw share (${((byShare[byShare.length - 1].n / dowTotal) * 100).toFixed(1)}%) largely because it carries the`,
    `fewest home dates (${byShare[byShare.length - 1].games}, the league travel day). Per home date the quietest day is`,
    `**${byPerGame[byPerGame.length - 1].d}** (${byPerGame[byPerGame.length - 1].perGame!.toFixed(3)}), not ${byShare[byShare.length - 1].d} (${byShare[byShare.length - 1].perGame!.toFixed(3)}).`,
    `Publish the per-home-date column, or say explicitly that the share is a share of promotions and not of games.`,
    '',
    `Note: the giveaway tally uses the site's \`countPromosByType\`, whose cross-count term for the secondary`,
    `\`isGiveaway\` flag is currently inert — that field is carried by 0 of ${corpus.rawPromoDocCount.toLocaleString('en-US')} promo documents, so`,
    `\`type === 'giveaway'\` and the site's tally agree exactly today.`,
    '',
    `${dowVerdict.safe ? '**SAFE TO PUBLISH**' : '**NOT SAFE TO PUBLISH**'} — ${dowVerdict.reason} ` +
      `Publish the per-home-date column; the raw share column alone is not publishable, for the reason above.`,
    '',
    '---',
    '',
  );

  // ═══ §5 Month density ═══
  out.push(`## 5. Month-by-month promo density — ${SEASON_YEAR} MLB`, '');
  const monthCounts = new Map<string, { total: number; giveaway: number }>();
  for (const e of mlbSeason) {
    if (typeof e.promo.date !== 'string' || e.promo.date.length < 7) continue;
    const k = e.promo.date.slice(0, 7);
    const cur = monthCounts.get(k) ?? { total: 0, giveaway: 0 };
    cur.total++;
    if (e.promo.type === 'giveaway') cur.giveaway++;
    monthCounts.set(k, cur);
  }
  const months = [...monthCounts.entries()].sort(([a], [b]) => a.localeCompare(b));

  // THE DENOMINATOR TEST. A rising raw count is only a statement about clubs if
  // the number of opportunities held roughly still. Compute promos per scheduled
  // home date; if THAT rises steeply too, the curve is tracking harvest recency
  // rather than anything a club did.
  const monthRates = months.map(([m, c]) => {
    const games = mlbSchedule.byMonth.get(m) ?? 0;
    return { m, total: c.total, giveaway: c.giveaway, games, rate: games > 0 ? c.total / games : null };
  });
  const rated = monthRates.filter((r) => r.rate !== null && r.games >= 100);
  const minRate = rated.length ? Math.min(...rated.map((r) => r.rate!)) : 0;
  const maxRate = rated.length ? Math.max(...rated.map((r) => r.rate!)) : 0;
  // Games supply is roughly flat month to month; a >2x swing in the per-game
  // rate across a season cannot be a scheduling effect.
  const rateSpread = minRate > 0 ? maxRate / minRate : Infinity;
  const isHarvestArtifact = rateSpread >= 2;
  const worst = rated.length ? rated.reduce((a, b) => (a.rate! < b.rate! ? a : b)) : null;
  const best = rated.length ? rated.reduce((a, b) => (a.rate! > b.rate! ? a : b)) : null;
  // What the season would hold at the best-covered month's rate — i.e. the size
  // of the hole, if the best month is what full coverage looks like.
  const impliedTotal = best
    ? monthRates.reduce((acc, r) => acc + (r.games > 0 ? r.games * best.rate! : r.total), 0)
    : null;

  const monthVerdict = classify(
    {
      id: '5.1',
      label: 'MLB months',
      value: measured(mlbSeason.length),
      query: '',
      docCount: mlbSeason.length,
      kind: isHarvestArtifact ? 'harvest-artifact' : 'promo-count',
      league: 'MLB',
    },
    basis,
    live,
  );
  record('5.1', 'MLB month-by-month density', monthVerdict);
  const presentMonths = new Set(months.map(([m]) => m));
  const absentMonths = Array.from({ length: 12 }, (_, i) => `${SEASON_YEAR}-${String(i + 1).padStart(2, '0')}`)
    .filter((m) => !presentMonths.has(m));

  out.push(
    '```',
    `visible+deduped promos where league == 'MLB' and date.startsWith('${SEASON_PREFIX}')`,
    `  grouped by date.slice(0, 7)`,
    `denominator: distinct scheduled home dates per month, from the games collection`,
    '```',
    '',
    ...table(
      ['Month', 'Promos', 'of which giveaways', 'Scheduled home dates', 'Promos per home date'],
      monthRates.map((r) => [
        r.m,
        String(r.total),
        String(r.giveaway),
        String(r.games),
        r.rate === null ? 'n/a' : r.rate.toFixed(2),
      ]),
    ),
    '',
    `Total ${SEASON_YEAR} MLB rows: **${mlbSeason.length.toLocaleString('en-US')}** against **${mlbSchedule.total.toLocaleString('en-US')}** scheduled home dates.`,
    `Months absent from the table (${absentMonths.join(', ')}) hold no ${SEASON_YEAR} MLB rows at all. They sit`,
    `outside the season, and they are rendered as absent rather than as a zero because "no data" and`,
    `"measured none" are different claims.`,
    '',
    '### The rise is an ingestion artifact, and this is the most important caveat in the report',
    '',
    ...(isHarvestArtifact && worst && best
      ? [
          `The raw column climbs steeply across the season. **It should not be read as seasonality, and a`,
          `journalist's plain reading of it would be false.** The denominator settles it: the number of scheduled`,
          `home dates is close to flat month to month (${Math.min(...monthRates.filter((r) => r.games >= 100).map((r) => r.games))}–${Math.max(...monthRates.map((r) => r.games))}), while promos per home date runs from`,
          `**${worst.rate!.toFixed(2)} in ${worst.m}** to **${best.rate!.toFixed(2)} in ${best.m}** — a ${rateSpread.toFixed(1)}x swing in a quantity that has no`,
          `reason to move with the calendar. Clubs publish their promotional schedules before the season starts;`,
          `they do not add promotions as the year goes on.`,
          '',
          `What the curve actually tracks is when the corpus was harvested. At ${best.m}'s rate the season would`,
          `hold roughly **${Math.round(impliedTotal ?? 0).toLocaleString('en-US')}** rows against the **${mlbSeason.length.toLocaleString('en-US')}** we store, so on the order of`,
          `**${Math.max(0, Math.round(((impliedTotal ?? 0) - mlbSeason.length) / (impliedTotal || 1) * 100))}%** of the season's inventory is missing, concentrated in the early months.`,
          '',
          `**Consequence for this section:** the per-month totals are individually correct and the per-home-date`,
          `column is the honest one, but the SHAPE is not publishable. Any sentence of the form "clubs run N times`,
          `more promotions in ${monthName(best.m)} than in ${monthName(worst.m)}" is an artifact of our own scraping and must not be offered.`,
        ]
      : [
          `Promos per scheduled home date is close to flat across the season (spread ${rateSpread.toFixed(1)}x), so the`,
          `month totals track the schedule rather than harvest recency.`,
        ]),
    '',
    `${monthVerdict.safe ? '**SAFE TO PUBLISH**' : '**NOT SAFE TO PUBLISH**'} — ${monthVerdict.reason}`,
    '',
    '---',
    '',
  );

  // ═══ §6 CFB ═══
  out.push('## 6. College football', '');
  const cfbFigures: Figure[] = [
    {
      id: '6.1',
      label: 'School documents',
      value: measured(cfb.schools),
      query: `db.collection('cfbSchools').get().size`,
      docCount: cfb.schools,
      kind: 'structural-inventory',
      league: 'CFB',
      notes: [
        'Every document generates a route (generateStaticParams maps the school ids with no filter).',
        `The site publishes this same derived number in its own copy — it comes from the cfbSchools count, not from a typed literal.`,
      ],
    },
    {
      id: '6.2',
      label: 'Rivalry records',
      value: measured(cfb.rivalries),
      query: `db.collection('cfbRivalries').get().size`,
      docCount: cfb.rivalries,
      kind: 'structural-inventory',
      league: 'CFB',
      notes: [
        `Unique unordered school pairs among them: ${cfb.rivalryUniquePairs} — so these are NOT bidirectional duplicates.`,
        `${cfb.rivalriesWithTrophy} carry a named trophy and ${cfb.rivalries - cfb.rivalriesWithTrophy} do not — but trophy-absence is NOT the same as being an auto-generated label. Measuring the NAME SHAPE directly: ${cfb.rivalriesBarePairLabels} are bare "SchoolA–SchoolB" pair labels, leaving ${cfb.rivalries - cfb.rivalriesBarePairLabels} with a real name (The Game, the Backyard Brawl, Farmageddon and the rest carry no trophy field yet are plainly named rivalries).`,
        `${cfb.rivalriesDormant} are marked dormant; only ${cfb.rivalriesOnA2026Game} are attached to a ${SEASON_YEAR} game.`,
        `The site itself publishes ${MATCHUP_REGISTRY.length} rivalry pages (derived from the matchup registry). Publishing the raw document count would not survive scrutiny.`,
      ],
    },
    {
      id: '6.3',
      label: 'Theme designations carrying verified:true',
      value:
        cfb.themeDesignationsTotal === 0
          ? absent(`themeDesignations is an empty array on all ${cfb.games} cfbGames documents — no theme designation has ever been written`)
          : measured(cfb.themeDesignationsVerified),
      query: `db.collection('cfbGames').get() → sum(doc.themeDesignations.length) where doc.verified === true`,
      docCount: cfb.themeDesignationsTotal === 0 ? null : cfb.themeDesignationsVerified,
      kind: cfb.themeDesignationsTotal === 0 ? 'no-data' : 'structural-inventory',
      notes: [
        `cfbGames documents with verified === true: ${cfb.gamesVerified} of ${cfb.games} (${cfb.gamesVisibleVerified} of ${cfb.gamesVisible} after the tombstone filter).`,
        `That flag means only that a KICKOFF TIME was corroborated on a second source — not that the game record is correct.`,
        `The only theme content anywhere is ${cfb.traditions} cfbTraditions documents, ${cfb.traditionsEditoriallySeeded} of them editorially seeded, referenced by no school and no game.`,
      ],
    },
    {
      id: '6.4',
      label: 'College programs carrying any promo data',
      value: absent(
        `0 of ${cfb.schoolsSampledForPromos} cfbSchools documents have a promos subcollection — the college corpus holds schedules, venues and rivalries, and no promotions at all`,
      ),
      query: `for each cfbSchools doc: doc.ref.listCollections() → none contains 'promos'`,
      docCount: null,
      kind: 'no-data',
    },
  ];
  for (const f of cfbFigures) emit(f);
  out.push(
    'Two different disqualifiers are at work above, and they are not interchangeable. **6.1 and 6.2 fail',
    'because section 3 has no CFB row** — the completeness rubric groups by `teams.league` and the college',
    'programs live in a separate collection it never reads, so there is no sanctioned basis on which to call',
    'those numbers publishable, even though they are true and the site already states them. **6.3 and 6.4 fail',
    'for a stronger reason: the data does not exist at all**, so no rubric could rescue them.',
    '',
    'The practical read: the college structural counts are quotable in a general description of the product',
    "(they are already on the site), but no college figure has a completeness basis, and the answer to \"how",
    'many verified theme designations" is zero, not a small number.',
    '',
    '---',
    '',
  );

  // ═══ §7 Minnesota ═══
  out.push('## 7. Minnesota cut', '');
  const MN: Array<{ teamId: string; venueSlug: string }> = [
    { teamId: 'minnesota-twins', venueSlug: 'target-field' },
    { teamId: 'minnesota-wild', venueSlug: 'xcel-energy-center' },
    { teamId: 'minnesota-timberwolves', venueSlug: 'target-center' },
    { teamId: 'minnesota-vikings', venueSlug: 'us-bank-stadium' },
    { teamId: 'minnesota-lynx', venueSlug: 'target-center' },
    { teamId: 'minnesota-united', venueSlug: 'allianz-field' },
  ];

  const mnRows: string[][] = [];
  const mnPassing: string[] = [];
  for (const m of MN) {
    const team = corpus.teamById.get(m.teamId)!;
    const all = visible.filter((e) => e.teamId === m.teamId);
    const seasonRows = all.filter(inSeason);
    const gv = giveawayCount(seasonRows.map((e) => e.promo));
    const bb = seasonRows.filter((e) => isBobbleheadRow(e.promo)).length;
    const bbStrict = seasonRows.filter((e) => isBobbleheadGiveaway(e.promo)).length;
    const up = all.filter((e) => isUpcomingPromo(e.promo, TODAY)).length;
    const v = classify(
      { id: 'x', label: '', value: measured(seasonRows.length), query: '', docCount: null, kind: 'promo-count', league: team.league },
      basis,
      live,
    );
    if (v.safe) mnPassing.push(teamDisplayName(team));
    mnRows.push([
      teamDisplayName(team),
      team.league,
      String(all.length),
      String(seasonRows.length),
      String(up),
      String(gv),
      `${bbStrict}${bb !== bbStrict ? ` (${bb} incl. description matches)` : ''}`,
      v.safe ? 'SAFE' : 'NOT SAFE',
    ]);
  }
  out.push(
    '```',
    `visible+deduped promos where teamId in (the six Minnesota clubs)`,
    `  ${SEASON_YEAR} = date.startsWith('${SEASON_PREFIX}')`,
    `  giveaways = countPromosByType(rows).giveaway     // the site's own tally`,
    `  bobbleheads = /bobblehead/i on title or description   // the site's own predicate`,
    '```',
    '',
    ...table(
      [
        'Club',
        'League',
        'All-time',
        `${SEASON_YEAR}`,
        'Upcoming',
        `${SEASON_YEAR} giveaways`,
        `${SEASON_YEAR} bobbleheads (strict)`,
        'Verdict',
      ],
      mnRows,
    ),
    '',
    '**Read this table with its shape in mind.** The Wild carry 1 promo for the whole of 2026 and none',
    'upcoming, which is a scraping outcome and not a statement about the club; the Timberwolves have nothing',
    'upcoming because the NBA corpus is entirely in the past; and the Vikings\' rows sit in a league that fails',
    'the publication rule on its own score.',
    '',
    `Clubs whose league clears the rule: **${mnPassing.length > 0 ? mnPassing.join(', ') : 'none'}**. Of those, only the Twins have a corpus deep`,
    'enough to carry a story on its own; Minnesota United passes the rule but on single-digit counts, so quote',
    'it only with the number attached.',
    '',
  );

  // Target Field detail.
  out.push('### Target Field — gate times and transit, as stored', '');
  const tf = await loadVenueTriple('minnesota-twins', 'target-field');
  const tfVenue = tf.venue ?? {};
  const tfHub = tf.hub ?? {};
  const tfTenant = tf.tenant ?? {};
  const transit = tfHub.publicTransit as { lines?: string[]; notes?: string } | undefined;
  const gatesOpenTenant = tfTenant.gatesOpen as { minutesBefore?: number | null; ruleText?: string } | undefined;
  const hubSources = (tfHub.sources ?? {}) as Record<string, string>;
  const tenantSources = (tfTenant.sources ?? {}) as Record<string, string>;
  const verifiedAt = (tfHub.verifiedAt as string | undefined) ?? null;
  const ageDays =
    verifiedAt !== null
      ? Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(verifiedAt)) / 86_400_000)
      : null;

  emit({
    id: '7.1',
    label: 'Target Field gate times (team page — `venues/target-field.gatesOpen`)',
    value: String(tfVenue.gatesOpen ?? 'ABSENT'),
    query: `db.collection('venues').doc('target-field').get() → .gatesOpen`,
    docCount: 1,
    kind: 'venue-stored',
    league: 'MLB',
    notes: [
      'This is the string /mlb/minnesota-twins renders.',
      'The `venues` document carries no source URL, no verifiedAt and no updatedAt — verified across all 148 documents in that collection.',
    ],
  });

  emit({
    id: '7.2',
    label: 'Target Field gate times (venue hub — `venueHubs/target-field/tenants/minnesota-twins.gatesOpen.ruleText`)',
    value: String(gatesOpenTenant?.ruleText ?? 'ABSENT'),
    query: `db.collection('venueHubs').doc('target-field').collection('tenants').doc('minnesota-twins').get() → .gatesOpen.ruleText`,
    docCount: 1,
    kind: 'venue-hub-sourced',
    league: 'MLB',
    notes: [
      `Source recorded: ${tenantSources.gatesOpen ?? 'NONE'}`,
      `minutesBefore: ${gatesOpenTenant?.minutesBefore === null || gatesOpenTenant?.minutesBefore === undefined ? 'null (deliberate — the rule is day-type-variable, so no single number is true)' : String(gatesOpenTenant.minutesBefore)}`,
      `Tenant document carries verified=${String(tfTenant.verified)} but NO verifiedAt field (true of all 255 tenant documents).`,
    ],
  });

  emit({
    id: '7.3',
    label: 'Target Field public transit (team page — `venues/target-field.publicTransit`)',
    value: String(tfVenue.publicTransit ?? 'ABSENT'),
    query: `db.collection('venues').doc('target-field').get() → .publicTransit`,
    docCount: 1,
    kind: 'venue-stored',
    league: 'MLB',
  });

  emit({
    id: '7.4',
    label: 'Target Field public transit (venue hub — `venueHubs/target-field.publicTransit`)',
    value: `lines = [${(transit?.lines ?? []).join(', ')}]; notes = "${transit?.notes ?? 'ABSENT'}"`,
    query: `db.collection('venueHubs').doc('target-field').get() → .publicTransit`,
    docCount: 1,
    kind: 'venue-hub-sourced',
    league: 'MLB',
    notes: [
      `Source recorded: ${hubSources.publicTransit ?? 'NONE'}`,
      `Document verified=${String(tfHub.verified)}, verifiedAt=${verifiedAt ?? 'null'}${ageDays !== null ? ` (${ageDays} days old as of ${TODAY})` : ''}.`,
    ],
  });

  // Staleness / verification sweep across the six Minnesota buildings.
  out.push('### Minnesota venue fields that are stale or unverified', '');
  const mnVenueSlugs = [...new Set(MN.map((m) => m.venueSlug))];
  const staleRows: string[][] = [];
  for (const slug of mnVenueSlugs) {
    const t = await loadVenueTriple(MN.find((m) => m.venueSlug === slug)!.teamId, slug);
    const hub = t.hub ?? {};
    const va = (hub.verifiedAt as string | undefined) ?? null;
    const ua = hub.updatedAt as { toDate?: () => Date } | undefined;
    const uaIso = ua && typeof ua.toDate === 'function' ? ua.toDate().toISOString() : null;
    const srcKeys = Object.keys((hub.sources ?? {}) as Record<string, string>).length;
    // The gap between verifiedAt and updatedAt. A LARGE gap means the doc was
    // edited after it was verified, so `verified: true` attests to content that
    // no longer exists. Report the measured delta rather than a bare flag, so a
    // threshold that never fires cannot masquerade as an all-clear.
    const deltaMs = va !== null && uaIso !== null ? Date.parse(uaIso) - Date.parse(va) : null;
    const editedAfterVerify = deltaMs !== null && deltaMs > 60_000;
    staleRows.push([
      slug,
      t.venue ? 'yes' : 'no',
      String(hub.verified ?? 'n/a'),
      va === null ? 'null' : `${va.slice(0, 10)} (${Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(va)) / 86_400_000)}d)`,
      String(srcKeys),
      deltaMs === null
        ? 'never verified'
        : editedAfterVerify
          ? `**edited ${Math.round(deltaMs / 86_400_000)}d after verify**`
          : `same write (+${deltaMs} ms)`,
    ]);
  }
  const wildTriple = await loadVenueTriple('minnesota-wild', 'xcel-energy-center');
  const wildHubSlug = 'xcel-energy-center';
  const wildHubName = String((wildTriple.hub ?? {}).name ?? 'unknown');
  const hubsSnap = await db.collection('venueHubs').get();
  const hubTotal = hubsSnap.size;
  const hubVerifiedCount = hubsSnap.docs.filter((d) => typeof d.data().verifiedAt === 'string').length;
  const verifiedAges = staleRows
    .map((r) => r[3])
    .filter((x) => x !== 'null')
    .map((x) => Number(/\((\d+)d\)/.exec(x)?.[1] ?? NaN))
    .filter((n) => Number.isFinite(n));

  out.push(
    `${mnVenueSlugs.length} buildings for ${MN.length} clubs — Target Center hosts both the Timberwolves and the Lynx.`,
    '',
    ...table(
      ['Venue', 'legacy `venues` doc', 'hub verified', 'hub verifiedAt (age)', 'sourced fields', 'verifiedAt → updatedAt gap'],
      staleRows,
    ),
    '',
    '**Findings.**',
    '',
    `1. **No fact on any Minnesota team page carries a last-verified date.** The \`venues\` collection has no`,
    `   \`verifiedAt\`, no \`updatedAt\`, and no source URL on any of its 148 documents. Every gate time, parking`,
    `   paragraph, transit sentence and bag link a visitor reads on a team page is undated and unsourced.`,
    `2. **The hub layer has provenance but never renders it.** \`verifiedAt\` and the per-field \`sources\` map`,
    `   exist on the hub documents and are not projected into the view model, so no reader can see them.`,
    `3. **The Wild's building is unverified.** Its hub doc (\`${wildHubSlug}\`, stored name "${wildHubName}") has`,
    `   verified=false, verifiedAt null and an empty sources map. Its identity fields (name, city, coordinates,`,
    `   tenant) are populated; every LOGISTICS field — transit, parking, bag policy, gates, food, accessibility —`,
    `   is null. Nothing about that venue's game-day detail is publishable. Note the stored name: the building`,
    `   was renamed, which is itself an instance of the staleness this section is about.`,
    `4. **Nothing has been re-verified in weeks.** ${hubVerifiedCount} of the ${hubTotal} hub documents carry a verifiedAt at all;`,
    `   the ${verifiedAges.length} verified Minnesota buildings range from ${Math.min(...verifiedAges)} to ${Math.max(...verifiedAges)} days old, and nothing re-checks`,
    `   them on a schedule.`,
    '',
  );

  // Northstar.
  out.push('### The Northstar transit issue', '');
  const northstarInStore = [tfVenue.publicTransit, transit?.notes, ...(transit?.lines ?? [])]
    .filter((x): x is string => typeof x === 'string')
    .some((s) => /northstar/i.test(s));
  let northstarInScript = false;
  try {
    const script = execFileSync('git', ['show', 'origin/main:scripts/populate-plan-your-visit.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    northstarInScript = /northstar/i.test(script);
  } catch {
    northstarInScript = false;
  }
  out.push(
    `Northstar was the commuter rail line terminating at Target Field. It ceased service **2026-01-04**, and`,
    `\`docs/SITE-AUDIT.md\` carries it as an open known bug ("Stale transit-data pass outstanding").`,
    '',
    `- **Is a Northstar claim live in stored data today? ${northstarInStore ? 'YES' : 'NO'}.** A scan of the Target Field`,
    `  \`venues\` document and the hub's transit lines and notes finds no mention. The stored copy names only the`,
    `  METRO Blue and Green lines and Metro Transit bus.`,
    `- **Is it still armed in the repo? ${northstarInScript ? 'YES' : 'NO'}.** \`scripts/populate-plan-your-visit.ts\` on`,
    `  origin/main still holds the sentence "Northstar commuter rail also terminates at the stadium." in its`,
    `  Target Field payload, and \`publicTransit\` is a managed field it writes with \`{merge: true}\`. One`,
    `  \`--execute\` re-run of that script republishes a false claim to the Twins page.`,
    '',
    `**The honest framing for press:** this is a near-miss, not a live error, and it should not be offered as a`,
    `data-quality win. What it exposes is the real finding — nothing in this system watches a venue fact for`,
    `staleness. A transit sentence does not change when a line shuts down, the scanners re-check promotions and`,
    `not logistics prose, and the \`verified\` flag records that a human once believed a fact, not that the fact`,
    `is still true.`,
    '',
    '---',
    '',
  );

  // ═══ §8 Resale ═══
  out.push('## 8. Resale cut', '');
  const pastBobbleStrict = visible.filter(
    (e) =>
      isBobbleheadGiveaway(e.promo) &&
      typeof e.promo.date === 'string' &&
      e.promo.date !== '' &&
      !isUpcomingPromo(e.promo, TODAY),
  );
  const resaleFieldNames = new Set<string>();
  for (const r of corpus.rows) {
    for (const k of Object.keys(r.raw)) {
      if (/resale|ebay|sold|valuation|worth|price|market/i.test(k)) resaleFieldNames.add(k);
    }
  }

  emit({
    id: '8.1',
    label: 'Past bobblehead promos carrying stored eBay resale figures',
    value: absent(
      'no resale field exists on any promo document, or anywhere else in the database. The complete field ' +
        'union across every promo document contains no resale, price, sold or valuation key',
    ),
    query:
      `db.collectionGroup('promos').get() → union of every top-level field name\n` +
      `  → filter(/resale|ebay|sold|valuation|worth|price|market/i)\n` +
      `  → matches: ${resaleFieldNames.size === 0 ? '(none)' : [...resaleFieldNames].join(', ')}`,
    docCount: null,
    kind: 'no-data',
  });

  emit({
    id: '8.2',
    label: 'Past bobblehead giveaways eligible to carry an eBay link',
    value: measured(pastBobbleStrict.length),
    query:
      `visible+deduped promos\n` +
      `  .filter(isBobbleheadGiveaway)      // type === 'giveaway' && /bobblehead/i.test(title)\n` +
      `  .filter(p => p.date < '${TODAY}')`,
    docCount: pastBobbleStrict.length,
    kind: 'cross-league',
    leagues: [...new Set(pastBobbleStrict.map((e) => e.league))].sort(),
    notes: [
      `Across ${new Set(pastBobbleStrict.map((e) => e.teamId)).size} teams.`,
      'These are promos that COULD carry an outbound eBay search link. They carry no price data of any kind.',
      'Far fewer links actually ship: the render caps are 3 rows per team page and 3 on the bobblehead hub.',
    ],
  });

  out.push(
    '### Does the sample support a public claim about which giveaways hold value?',
    '',
    '**No, and not marginally — the sample size is zero.**',
    '',
    'The eBay integration stores nothing. `src/lib/ebay.ts` is 75 lines of pure string construction: it takes a',
    "promo's own year, team nickname and title, builds an affiliate-tagged `ebay.com/sch/i.html` **search URL**,",
    'and returns it. It makes no network call, receives no response, and persists no field. Its only consumer',
    'renders one line of text — "Missed it? Check resale on eBay" — with no price, no range, and no sale record.',
    '',
    'This was checked four independent ways and all four agree: no eBay API endpoint or credential exists',
    'anywhere in the repo; no ingestion script was ever written (git history shows only two eBay files ever',
    'created); the complete field union across all promo documents has no resale-shaped key; and a sweep of',
    'every collection and subcollection in the database finds only concession prices, stadium parking prices',
    'and menu-item prices — nothing about secondary-market value.',
    '',
    `The line in \`docs/SITE-AUDIT.md\` section 5 that reads "eBay Partner Network: live, past-bobblehead resale`,
    `rows" is a **monetization-surface** statement, not a data statement: "rows" are completed-promo UI rows`,
    `that carry an affiliate link. It reads like stored data and is worth rewording.`,
    '',
    '**Therefore no ranking is produced here.** A "which bobbleheads hold their value" story is a green-field',
    'build, not a query: it needs eBay Browse/marketplace-insights credentials (none exist), an ingestion job',
    '(none exists), and a new stored field (the schema has no slot). The only honest cut available today is a',
    `link inventory — the ${pastBobbleStrict.length} past bobblehead giveaways above, each with the search URL the site would`,
    'construct for it — and it must be labelled as constructed search links, never as observed resale prices.',
    '',
    '---',
    '',
  );

  // ═══ Summary ═══
  // Derived, never typed: which leagues actually clear each tier under `classify`.
  const tierA = leagues.filter(
    (l) =>
      classify(
        { id: 't', label: '', value: measured(0), query: '', docCount: null, kind: 'promo-count', league: l },
        basis,
        live,
      ).safe,
  );
  const tierB = leagues.filter(
    (l) =>
      classify(
        { id: 't', label: '', value: measured(0), query: '', docCount: null, kind: 'structural-inventory', league: l },
        basis,
        live,
      ).safe,
  );

  // What regenerating the basis would actually unlock: classify every league
  // against the LIVE table as if it were published, and diff the passing set.
  const liveAsBasis: Basis | null = live
    ? { generatedStamp: TODAY, source: `live recompute ${TODAY}`, scores: live }
    : null;
  const passesNow = new Set(
    leagues.filter((l) =>
      ['promo-count', 'structural-inventory'].some(
        (k) =>
          classify(
            { id: 't', label: '', value: measured(0), query: '', docCount: null, kind: k as FigureKind, league: l },
            basis,
            live,
          ).safe,
      ),
    ),
  );
  const unlocked = liveAsBasis
    ? leagues.filter(
        (l) =>
          !passesNow.has(l) &&
          ['promo-count', 'structural-inventory'].some(
            (k) =>
              classify(
                { id: 't', label: '', value: measured(0), query: '', docCount: null, kind: k as FigureKind, league: l },
                liveAsBasis,
                live,
              ).safe,
          ),
      )
    : [];

  const seen = new Set<string>();
  const uniqueNotSafe = notSafe.filter((n) => {
    const k = `${n.id}|${n.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const grouped = new Map<string, Array<{ id: string; label: string }>>();
  for (const n of uniqueNotSafe) {
    const list = grouped.get(n.reason) ?? [];
    list.push({ id: n.id, label: n.label });
    grouped.set(n.reason, list);
  }
  out.push(
    '## Summary — what came back NOT SAFE',
    '',
    `${uniqueNotSafe.length} figures or figure groups are marked NOT SAFE TO PUBLISH, in ${grouped.size} distinct`,
    'categories. The category matters far more than the count — most of these are structural and will not be',
    'cleared by a regeneration.',
    '',
    ...[...grouped.entries()].flatMap(([reason, items]) => [
      `**${reason}** (${items.length})`,
      '',
      ...items.map((i) => `- \`${i.id}\` ${i.label}`),
      '',
    ]),
    '### What IS publishable',
    '',
    `Tier A (promo-content figures): **${tierA.length > 0 ? tierA.join(', ') : 'none'}**.`,
    `Tier B (venue / inventory figures only): **${tierB.length > 0 ? tierB.join(', ') : 'none'}**.`,
    '',
    'Both lists are derived by running `classify` over every league, not typed here.',
    '',
    `In practice the defensible press figures are the ${tierA[0] ?? 'passing-league'} ones, and the list is shorter than the tier`,
    'membership suggests, because two cuts fail on grounds the league score does not capture:',
    '',
    `- **The ${SEASON_YEAR} ${tierA[0] ?? ''} season count and the club ranking** — quotable with their as-of date and denominator.`,
    '- **The day-of-week cut** — quotable as the per-home-date column. The weekend peak survives normalisation;',
    '  the "quietest day" claim does not, and inverts.',
    `- **The bobblehead count** — quotable only as "approximately ${strictFree.length}", the strict count with purchase-gated rows`,
    '  removed, and only for the leagues that pass.',
    `- **NOT the month-density curve.** It is the one cut in this report whose individual numbers are all correct`,
    '  and whose shape is still false. See section 5.',
    '',
    'None of these may be dressed as completeness in any wording.',
    '',
    'What the quick fixes would and would not unlock — measured, not assumed:',
    '',
    `1. **Regenerate section 3.** Three leagues moved in the seven days since it was generated. Re-running`,
    `   \`classify\` with the live table as the basis moves **${unlocked.length > 0 ? unlocked.join(', ') : 'no league'}** into a passing tier and`,
    `   changes nothing else — the cross-league totals stay blocked because NBA fails on merit, not on staleness.`,
    `   Worth doing, but it is not the difference between having a story and not having one.`,
    '2. **Split the all-time promo bullet.** One line currently carries a tombstone-filtered upcoming count and',
    '   an unfiltered all-time count with no marking between them.',
    '3. **Reword the eBay line in section 5.** "past-bobblehead resale rows" reads as stored pricing data. It is',
    '   an affiliate link on a completed-promo row.',
    '',
    'The rest are structural and no amount of regeneration touches them: no external denominator exists for a',
    'coverage claim, the legacy `venues` collection has no provenance to attach, the college corpus has no',
    'completeness rubric at all, and the month curve is an artifact of our own ingestion history.',
    '',
    '### The one thing to fix before pitching anything',
    '',
    'The early-season promo hole in section 5 is the highest-value finding here, and it is not a reporting',
    'problem. If roughly a third of the MLB season\'s inventory is genuinely missing from April to mid-June,',
    'that is a live product gap on the most-trafficked pages, not merely a caveat on a press figure. It should',
    'be diagnosed before any outreach that describes the corpus as thorough.',
    '',
  );

  const md = out.join('\n');
  if (execute) {
    writeFileSync(join(REPO_ROOT, OUT_REL), md, 'utf8');
    console.error(`wrote ${OUT_REL} (${md.length} bytes)`);
  } else {
    console.log(md);
    console.error(`\n[dry run] ${md.length} bytes; pass --execute to write ${OUT_REL}`);
  }
}

// Guarded so importing `classify` / `loadBasis` for a test does not run the
// whole generator and then exit the process.
if (require.main === module) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
