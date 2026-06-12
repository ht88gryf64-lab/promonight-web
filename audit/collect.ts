// Read-only collector for the [AUTO] sections of docs/SITE-AUDIT.md.
//
// collectAuto() reads Firestore (via the existing src/lib/data data layer, so
// it reuses the exact FIREBASE_SERVICE_ACCOUNT_KEY credential path — no new
// auth mechanism) and inspects the repo on disk, then returns a single plain
// structured object. It performs NO writes and NO PostHog/GSC/Bing calls; it
// never touches [LIVE] data. Phase 2's assembler renders this object into the
// [AUTO] section bodies; the dashboard cron can call collectAuto() directly.
//
// Pure-ish + unit-testable: every external dependency (the four data-layer
// reads, the recurring-deals repo map, the repo root, and "today") is
// injectable through the optional `deps` argument; the defaults wire up the
// real implementations for zero-config production use.
//
// Run from the repo root (matches every other script in this repo):
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/generate-site-audit.ts

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  getAllTeams as defaultGetAllTeams,
  getPromosFromDate as defaultGetPromosFromDate,
  getPromoCount as defaultGetPromoCount,
  getVenueForTeam as defaultGetVenueForTeam,
} from '../src/lib/data';
import {
  RECURRING_DEALS,
  getRecurringDealsForTeam as defaultGetRecurringDealsForTeam,
  type RecurringDeal,
} from '../src/lib/recurring-deals';
import { LEAGUE_ORDER } from '../src/lib/types';
import type { Team, PromoWithTeam, Venue } from '../src/lib/types';

// ── Constants ────────────────────────────────────────────────────────────────

// Canonical host. www is canonical; the apex (no-www) is the deindex-risk
// variant we assert never appears in metadataBase / sitemap / robots.
export const CANONICAL_HOST = 'https://www.getpromonight.com';
const APEX_HOST = 'https://getpromonight.com';

// Promo-depth threshold for the "deep coverage" rubric dimension.
export const DEPTH_THRESHOLD = 5;

// The per-team data-completeness rubric (sign-off 2026-06-12). Each team earns
// the listed points for each dimension it satisfies; a league's /10 score is
// the MEAN of its teams' totals. Affiliate-readiness is intentionally NOT in
// the score — it is reported separately as a coverage line. This is a NEW
// standard: it does not reproduce the older April editorial scores.
export const RUBRIC = {
  upcoming1: { label: 'Has upcoming promos (>=1)', points: 3.0 },
  upcoming5: { label: `Promo depth (>=${DEPTH_THRESHOLD} upcoming)`, points: 2.0 },
  venueResolved: { label: 'Venue resolved (address + coords)', points: 2.0 },
  pyvDetail: { label: 'Venue PYV detail (parking+transit+bag)', points: 2.0 },
  gates: { label: 'Gate times (gatesOpen)', points: 0.5 },
  recurring: { label: 'Recurring every-game deals', points: 0.5 },
} as const;

const RUBRIC_MAX = Object.values(RUBRIC).reduce((s, d) => s + d.points, 0); // 10.0

// AI/search crawler user-agents robots.ts must allow (explicitly or by not
// disallowing). These are the bots whose access we assert in section 6.
export const REQUIRED_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'ChatGPT-User',
  'Applebot-Extended',
] as const;

// Page-level JSON-LD @type values we track for the schema-presence audit.
// Nested/support types (Question, Answer, ListItem, Place, PostalAddress,
// Offer, Organization, ImageObject, SportsTeam, SportsEvent, WebSite,
// SocialEvent) are ignored — we only assert the page/collection-level schema.
export const TRACKED_SCHEMA_TYPES = [
  'WebPage',
  'CollectionPage',
  'ItemList',
  'FAQPage',
  'Article',
  'Event',
] as const;

// Per-template schema registry: which source files emit a template's JSON-LD,
// and the EXPECTED tracked types. For `aggregator`, `expected` is the target
// pattern from the audit doc / task brief (CollectionPage+ItemList+FAQPage);
// the actual emission is Article+FAQPage, so this template surfaces a gap by
// design (decision 5: record actual-vs-expected, do not fix the schema here).
export const SCHEMA_TEMPLATES: Array<{
  template: string;
  pageGlob: string;
  sourceFiles: string[];
  expected: string[];
}> = [
  {
    template: 'team',
    pageGlob: 'src/app/[sport]/[team]/page.tsx',
    sourceFiles: ['src/app/[sport]/[team]/page.tsx', 'src/components/json-ld.tsx'],
    expected: ['WebPage', 'Event', 'FAQPage'],
  },
  {
    template: 'aggregator (/promos/*)',
    pageGlob: 'src/app/promos/*/page.tsx',
    sourceFiles: ['src/components/aggregator-layout.tsx'],
    expected: ['CollectionPage', 'ItemList', 'FAQPage'],
  },
  {
    template: 'best-promos',
    pageGlob: 'src/app/best-promos/**/page.tsx',
    sourceFiles: ['src/components/scoring/scored-jsonld.tsx'],
    expected: ['Article', 'ItemList', 'FAQPage'],
  },
  {
    template: 'world-cup',
    pageGlob: 'src/app/world-cup/page.tsx',
    sourceFiles: ['src/app/world-cup/page.tsx'],
    expected: ['CollectionPage', 'FAQPage'],
  },
  {
    template: 'playoffs',
    pageGlob: 'src/app/playoffs/page.tsx',
    sourceFiles: ['src/app/playoffs/page.tsx'],
    expected: ['Article', 'FAQPage'],
  },
];

// ── Returned-object types ────────────────────────────────────────────────────

export interface LeagueCompleteness {
  league: string;
  teamCount: number;
  /** Mean of per-team rubric totals, 0..10, rounded to 1 decimal. */
  score: number;
  /** Fraction (0..1) of the league's teams satisfying each rubric dimension. */
  dimensionCoverage: Record<keyof typeof RUBRIC, number>;
}

export interface CoverageCount {
  covered: number;
  total: number;
}

export interface AuditData {
  meta: {
    today: string;
    rubricMax: number;
    totalTeams: number;
    leagues: string[];
    generatedNote: string;
  };
  dataCompletenessByLeague: LeagueCompleteness[];
  rubric: typeof RUBRIC;
  coverage: {
    recurringDeals: CoverageCount & { teamSlugs: string[] };
    venueDetail: CoverageCount & {
      definition: string;
      byField: { parking: number; transit: number; bagPolicy: number; gates: number };
    };
    affiliate: {
      ticketmasterReady: CoverageCount & { definition: string };
      fanaticsReady: CoverageCount & { definition: string };
    };
  };
  promoCounts: {
    upcomingTotal: number;
    upcomingByLeague: Record<string, number>;
    allTimeTotal: number;
  };
  pageInventory: {
    totalRoutes: number;
    dynamicTeamPages: number;
    byRouteType: Array<{ routeType: string; count: number; dynamic: boolean; examplePath: string }>;
  };
  aggregatorPages: string[];
  schemaPresence: Array<{
    template: string;
    pageGlob: string;
    expected: string[];
    actual: string[];
    missing: string[];
    extra: string[];
    ok: boolean;
    missingSourceFiles: string[];
  }>;
  technical: {
    robots: { file: string; allBotsAllowed: boolean; rootDisallowed: boolean; bots: Record<string, boolean> };
    llmsTxt: { present: boolean; path: string };
    sitemap: { singleCanonical: boolean; canonicalUrl: string; sources: string[]; nonWwwDuplicate: boolean };
    wwwCanonical: { consistent: boolean; metadataBase: string; sitemapBase: string; robotsSitemap: string };
  };
  knownBugs: Array<{ id: string; description: string; status: 'resolved' | 'open' | 'not-auto-verified'; evidence: string }>;
  findings: string[];
}

export interface CollectDeps {
  repoRoot?: string;
  today?: string;
  getAllTeams?: () => Promise<Team[]>;
  getPromosFromDate?: (startDate: string) => Promise<PromoWithTeam[]>;
  getPromoCount?: () => Promise<number>;
  getVenueForTeam?: (teamId: string) => Promise<Venue | null>;
  getRecurringDealsForTeam?: (teamId: string) => RecurringDeal[];
  recurringDealsKeys?: string[];
}

// ── Pure helpers (exported for unit tests) ───────────────────────────────────

export function nonEmpty(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Extract the set of JSON-LD `@type` string-literal values from source text. */
export function extractSchemaTypes(source: string): string[] {
  const types = new Set<string>();
  const re = /['"]@type['"]\s*:\s*['"]([A-Za-z]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) types.add(m[1]);
  return [...types];
}

/** Map an app-router route path to a coarse route-type bucket. */
export function classifyRoute(route: string): string {
  if (route === '/') return 'home';
  if (route.startsWith('/[sport]/[team]')) return 'team (dynamic)';
  if (/^\/promos\//.test(route)) return 'promo-aggregator';
  if (/^\/best-promos/.test(route)) return 'best-promos';
  if (route === '/world-cup') return 'world-cup';
  if (route === '/playoffs') return 'playoffs (conditional)';
  if (/^\/dev\//.test(route)) return 'dev-utility';
  if (['/teams', '/team-rankings', '/my-teams'].includes(route)) return 'hub';
  if (['/about', '/privacy', '/terms', '/follow', '/download', '/preferences'].includes(route)) {
    return 'static-content';
  }
  return 'other';
}

/** Per-team rubric booleans. */
export interface TeamDims {
  upcoming1: boolean;
  upcoming5: boolean;
  venueResolved: boolean;
  pyvDetail: boolean;
  gates: boolean;
  recurring: boolean;
}

export function scoreTeam(dims: TeamDims): number {
  return (
    (dims.upcoming1 ? RUBRIC.upcoming1.points : 0) +
    (dims.upcoming5 ? RUBRIC.upcoming5.points : 0) +
    (dims.venueResolved ? RUBRIC.venueResolved.points : 0) +
    (dims.pyvDetail ? RUBRIC.pyvDetail.points : 0) +
    (dims.gates ? RUBRIC.gates.points : 0) +
    (dims.recurring ? RUBRIC.recurring.points : 0)
  );
}

function venueResolved(v: Venue | null): boolean {
  return (
    v != null &&
    nonEmpty(v.address) &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    !(v.lat === 0 && v.lng === 0)
  );
}

// ── Repo inspection (sync fs reads, all relative to repoRoot) ─────────────────

function readFileSafe(repoRoot: string, rel: string): string {
  const full = join(repoRoot, rel);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/** Recursively find every page.tsx under src/app. */
function findPageFiles(repoRoot: string): string[] {
  const root = join(repoRoot, 'src', 'app');
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'page.tsx') out.push(relative(repoRoot, full));
    }
  };
  walk(root);
  return out.sort();
}

/** Convert a `src/app/.../page.tsx` repo-relative path to a route path. */
export function fileToRoute(relPath: string): string {
  const parts = relPath.split(sep);
  const appIdx = parts.indexOf('app');
  const segs = parts.slice(appIdx + 1, -1); // drop "page.tsx"
  return segs.length === 0 ? '/' : '/' + segs.join('/');
}

function inspectPageInventory(repoRoot: string, teamCount: number): AuditData['pageInventory'] {
  const files = findPageFiles(repoRoot);
  const routes = files.map(fileToRoute);

  const buckets = new Map<string, { count: number; dynamic: boolean; examplePath: string }>();
  for (const route of routes) {
    const type = classifyRoute(route);
    const dynamic = type === 'team (dynamic)';
    // Dynamic team template is one file but `teamCount` real routes.
    const inc = dynamic ? teamCount : 1;
    const existing = buckets.get(type);
    if (existing) existing.count += inc;
    else buckets.set(type, { count: inc, dynamic, examplePath: route });
  }

  const byRouteType = [...buckets.entries()]
    .map(([routeType, v]) => ({ routeType, ...v }))
    .sort((a, b) => b.count - a.count);
  const totalRoutes = byRouteType.reduce((s, b) => s + b.count, 0);

  return { totalRoutes, dynamicTeamPages: teamCount, byRouteType };
}

function inspectAggregatorPages(repoRoot: string): string[] {
  const routes = findPageFiles(repoRoot).map(fileToRoute);
  return routes
    .filter((r) => /^\/promos\//.test(r) || /^\/best-promos/.test(r) || r === '/world-cup')
    .sort();
}

function inspectSchema(repoRoot: string): AuditData['schemaPresence'] {
  const tracked = new Set<string>(TRACKED_SCHEMA_TYPES);
  return SCHEMA_TEMPLATES.map((t) => {
    const missingSourceFiles = t.sourceFiles.filter((f) => !existsSync(join(repoRoot, f)));
    const source = t.sourceFiles.map((f) => readFileSafe(repoRoot, f)).join('\n');
    const actual = extractSchemaTypes(source).filter((ty) => tracked.has(ty)).sort();
    const actualSet = new Set(actual);
    const expectedSet = new Set(t.expected);
    const missing = t.expected.filter((e) => !actualSet.has(e));
    const extra = actual.filter((a) => !expectedSet.has(a));
    return {
      template: t.template,
      pageGlob: t.pageGlob,
      expected: t.expected,
      actual,
      missing,
      extra,
      ok: missing.length === 0 && missingSourceFiles.length === 0,
      missingSourceFiles,
    };
  });
}

function inspectTechnical(repoRoot: string): AuditData['technical'] {
  // robots
  const robotsSrc = readFileSafe(repoRoot, 'src/app/robots.ts');
  const bots: Record<string, boolean> = {};
  for (const b of REQUIRED_BOTS) {
    bots[b] = new RegExp(`userAgent:\\s*['"]${b}['"]`).test(robotsSrc);
  }
  const allBotsAllowed = REQUIRED_BOTS.every((b) => bots[b]);
  // Root disallow = a rule that disallows "/" (the deindex risk). The expected
  // global rule disallows only "/api/".
  const rootDisallowed = /disallow:\s*['"]\/['"]/.test(robotsSrc);

  // llms.txt
  const llmsPath = 'src/app/llms.txt/route.ts';
  const llmsPresent = existsSync(join(repoRoot, llmsPath));

  // sitemap sources: the app-router sitemap, any public/ xml, any alt route.
  const sitemapSources: string[] = [];
  if (existsSync(join(repoRoot, 'src/app/sitemap.ts'))) sitemapSources.push('src/app/sitemap.ts');
  if (existsSync(join(repoRoot, 'src/app/sitemap.xml/route.ts'))) sitemapSources.push('src/app/sitemap.xml/route.ts');
  const publicDir = join(repoRoot, 'public');
  if (existsSync(publicDir)) {
    for (const f of readdirSync(publicDir)) {
      if (/sitemap.*\.xml$/i.test(f)) sitemapSources.push(`public/${f}`);
    }
  }
  const sitemapSrc = readFileSafe(repoRoot, 'src/app/sitemap.ts');
  const sitemapBase = sitemapSrc.match(/BASE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? '';
  const robotsSitemap = robotsSrc.match(/sitemap:\s*['"]([^'"]+)['"]/)?.[1] ?? '';
  // A non-www duplicate would be an apex sitemap reference anywhere.
  const nonWwwDuplicate =
    new RegExp(`${APEX_HOST.replace(/[.]/g, '\\.')}/sitemap`).test(`${sitemapSrc}\n${robotsSrc}`) ||
    sitemapBase.startsWith(APEX_HOST + '/') ||
    sitemapBase === APEX_HOST;
  const canonicalUrl = (sitemapBase || CANONICAL_HOST) + '/sitemap.xml';

  // www-canonical consistency across the three sources of truth.
  const layoutSrc = readFileSafe(repoRoot, 'src/app/layout.tsx');
  const metadataBase = layoutSrc.match(/metadataBase:\s*new URL\(\s*['"]([^'"]+)['"]/)?.[1] ?? '';
  const isWww = (u: string) => u.startsWith(CANONICAL_HOST);
  const consistent = isWww(metadataBase) && isWww(sitemapBase) && isWww(robotsSitemap);

  return {
    robots: { file: 'src/app/robots.ts', allBotsAllowed, rootDisallowed, bots },
    llmsTxt: { present: llmsPresent, path: llmsPath },
    sitemap: {
      singleCanonical: sitemapSources.length === 1,
      canonicalUrl,
      sources: sitemapSources,
      nonWwwDuplicate,
    },
    wwwCanonical: { consistent, metadataBase, sitemapBase, robotsSitemap },
  };
}

function inspectKnownBugs(repoRoot: string): { bugs: AuditData['knownBugs']; ogScanFindings: string[] } {
  const bugs: AuditData['knownBugs'] = [];

  // Bug: /playoffs openGraph defined without an images array (blanks the
  // inherited og-image). Assert the images array is present → resolved.
  const playoffsSrc = readFileSafe(repoRoot, 'src/app/playoffs/page.tsx');
  const playoffsHasOgImages = /openGraph:\s*\{[\s\S]*?images:\s*\[/.test(playoffsSrc);
  bugs.push({
    id: 'playoffs-og-image',
    description: '/playoffs openGraph defined without images array (blanks inherited og-image)',
    status: playoffsHasOgImages ? 'resolved' : 'open',
    evidence: playoffsHasOgImages
      ? 'src/app/playoffs/page.tsx openGraph.images array present'
      : 'src/app/playoffs/page.tsx openGraph block has no images array',
  });

  // Repo-undetectable data-quality bugs from section 6 — reported as
  // not-auto-verified so the assembler can preserve them as manual follow-ups.
  bugs.push({
    id: 'world-cup-duplicate-row',
    description: '/world-cup Boston Red Sox card lists "Fri 17 Jul vs Rays" twice (duplicate row)',
    status: 'not-auto-verified',
    evidence: 'Render-time data dedup issue; not statically detectable from repo source',
  });
  bugs.push({
    id: 'stale-transit-data',
    description: 'Stale transit-data pass outstanding (e.g. Northstar/Target Field; Northstar shut down 2026-01-04)',
    status: 'not-auto-verified',
    evidence: 'Per-venue factual freshness; requires manual/external verification',
  });

  // Supplementary: scan every page that DEFINES an openGraph block for a
  // missing images array (the same bug class as playoffs-og-image).
  const ogScanFindings: string[] = [];
  for (const file of findPageFiles(repoRoot)) {
    const src = readFileSafe(repoRoot, file);
    const definesOg = /openGraph:\s*\{/.test(src);
    const hasImages = /openGraph:\s*\{[\s\S]*?images:\s*\[/.test(src);
    if (definesOg && !hasImages) {
      ogScanFindings.push(`${fileToRoute(file)} defines openGraph without an images array (og-image blank risk)`);
    }
  }

  return { bugs, ogScanFindings };
}

// ── Main collector ───────────────────────────────────────────────────────────

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const cur = idx++;
      ret[cur] = await fn(items[cur], cur);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return ret;
}

export async function collectAuto(deps: CollectDeps = {}): Promise<AuditData> {
  const repoRoot = deps.repoRoot ?? process.cwd();
  const today = deps.today ?? new Date().toISOString().slice(0, 10);
  const getAllTeams = deps.getAllTeams ?? defaultGetAllTeams;
  const getPromosFromDate = deps.getPromosFromDate ?? defaultGetPromosFromDate;
  const getPromoCount = deps.getPromoCount ?? defaultGetPromoCount;
  const getVenueForTeam = deps.getVenueForTeam ?? defaultGetVenueForTeam;
  const getRecurringDealsForTeam = deps.getRecurringDealsForTeam ?? defaultGetRecurringDealsForTeam;
  const recurringDealsKeys = deps.recurringDealsKeys ?? Object.keys(RECURRING_DEALS);

  // ── Firestore reads ──
  const teams = await getAllTeams();
  const totalTeams = teams.length;

  // Upcoming promos (date >= today), with team attached. One collection-group
  // query (per-team fallback inside the data layer). Group by team + league.
  const upcoming = await getPromosFromDate(today);
  const upcomingByTeam = new Map<string, number>();
  const upcomingByLeague: Record<string, number> = {};
  for (const p of upcoming) {
    upcomingByTeam.set(p.team.id, (upcomingByTeam.get(p.team.id) ?? 0) + 1);
    upcomingByLeague[p.team.league] = (upcomingByLeague[p.team.league] ?? 0) + 1;
  }

  const allTimeTotal = await getPromoCount();

  // Resolve each team's effective venue (Firestore + venue-overrides merge),
  // bounded concurrency to stay gentle on Firestore.
  const venues = await mapLimit(teams, 25, (t) => getVenueForTeam(t.id));

  // ── Per-team rubric + coverage tallies ──
  const recurringSlugs = new Set(recurringDealsKeys.filter((id) => getRecurringDealsForTeam(id).length > 0));

  const byLeague = new Map<string, { teams: number; sum: number; dims: Record<keyof typeof RUBRIC, number> }>();
  const ensureLeague = (lg: string) => {
    let e = byLeague.get(lg);
    if (!e) {
      e = { teams: 0, sum: 0, dims: { upcoming1: 0, upcoming5: 0, venueResolved: 0, pyvDetail: 0, gates: 0, recurring: 0 } };
      byLeague.set(lg, e);
    }
    return e;
  };

  let venueDetailCovered = 0;
  const venueByField = { parking: 0, transit: 0, bagPolicy: 0, gates: 0 };
  let tmReady = 0;
  let fanaticsReady = 0;
  const affiliateByLeagueTm: Record<string, number> = {};

  teams.forEach((team, i) => {
    const v = venues[i];
    const upCount = upcomingByTeam.get(team.id) ?? 0;
    const hasPark = !!v && nonEmpty(v.parkingInfo);
    const hasTransit = !!v && nonEmpty(v.publicTransit);
    const hasBag = !!v && nonEmpty(v.bagPolicyUrl);
    const hasGates = !!v && nonEmpty(v.gatesOpen);

    const dims: TeamDims = {
      upcoming1: upCount >= 1,
      upcoming5: upCount >= DEPTH_THRESHOLD,
      venueResolved: venueResolved(v),
      pyvDetail: hasPark && hasTransit && hasBag,
      gates: hasGates,
      recurring: recurringSlugs.has(team.id),
    };

    const e = ensureLeague(team.league);
    e.teams += 1;
    e.sum += scoreTeam(dims);
    (Object.keys(dims) as Array<keyof TeamDims>).forEach((k) => {
      if (dims[k]) e.dims[k] += 1;
    });

    if (dims.pyvDetail) venueDetailCovered += 1;
    if (hasPark) venueByField.parking += 1;
    if (hasTransit) venueByField.transit += 1;
    if (hasBag) venueByField.bagPolicy += 1;
    if (hasGates) venueByField.gates += 1;

    // Affiliate readiness (reported separately, NOT in the score).
    // TM-ready = has the numeric Ticketmaster artist id (the field that
    // enables redirect-free /artist/{id} URLs; the slug always resolves).
    if (nonEmpty(team.ticketmasterAttractionId)) {
      tmReady += 1;
      affiliateByLeagueTm[team.league] = (affiliateByLeagueTm[team.league] ?? 0) + 1;
    }
    // Fanatics-ready = has the fully-qualified fanaticsUrl the CTA gates on.
    if (nonEmpty(team.fanaticsUrl)) fanaticsReady += 1;
  });

  // Order leagues by LEAGUE_ORDER, then any extras alphabetically.
  const leagueKeys = [
    ...LEAGUE_ORDER.filter((l) => byLeague.has(l)),
    ...[...byLeague.keys()].filter((l) => !LEAGUE_ORDER.includes(l as (typeof LEAGUE_ORDER)[number])).sort(),
  ];

  const dataCompletenessByLeague: LeagueCompleteness[] = leagueKeys.map((league) => {
    const e = byLeague.get(league)!;
    const cov = {} as Record<keyof typeof RUBRIC, number>;
    (Object.keys(RUBRIC) as Array<keyof typeof RUBRIC>).forEach((k) => {
      cov[k] = e.teams ? round1((e.dims[k] / e.teams) * 100) / 100 : 0;
    });
    return {
      league,
      teamCount: e.teams,
      score: e.teams ? round1(e.sum / e.teams) : 0,
      dimensionCoverage: cov,
    };
  });

  // ── Repo inspection ──
  const pageInventory = inspectPageInventory(repoRoot, totalTeams);
  const aggregatorPages = inspectAggregatorPages(repoRoot);
  const schemaPresence = inspectSchema(repoRoot);
  const technical = inspectTechnical(repoRoot);
  const { bugs, ogScanFindings } = inspectKnownBugs(repoRoot);

  // ── Findings (surfaced gaps) ──
  const findings: string[] = [];
  for (const s of schemaPresence) {
    if (s.missingSourceFiles.length) {
      findings.push(`Schema source missing for ${s.template}: ${s.missingSourceFiles.join(', ')}`);
    } else if (!s.ok) {
      findings.push(
        `Schema gap: ${s.template} expected [${s.expected.join(', ')}] but emits [${s.actual.join(', ')}]` +
          (s.missing.length ? ` (missing ${s.missing.join(', ')})` : ''),
      );
    }
  }
  if (!technical.robots.allBotsAllowed) {
    const missing = REQUIRED_BOTS.filter((b) => !technical.robots.bots[b]);
    findings.push(`robots.ts missing allow rules for: ${missing.join(', ')}`);
  }
  if (technical.robots.rootDisallowed) findings.push('robots.ts contains a root "/" disallow rule');
  if (!technical.llmsTxt.present) findings.push('llms.txt route missing');
  if (!technical.sitemap.singleCanonical) {
    findings.push(`Multiple sitemap sources: ${technical.sitemap.sources.join(', ')}`);
  }
  if (technical.sitemap.nonWwwDuplicate) findings.push('Non-www (apex) sitemap reference detected');
  if (!technical.wwwCanonical.consistent) {
    findings.push(
      `www-canonical mismatch: metadataBase=${technical.wwwCanonical.metadataBase}, sitemap=${technical.wwwCanonical.sitemapBase}, robots=${technical.wwwCanonical.robotsSitemap}`,
    );
  }
  for (const b of bugs) {
    if (b.status === 'open') findings.push(`Open bug: ${b.description}`);
  }
  findings.push(...ogScanFindings);
  findings.push(
    'Rubric note: this /10 is a NEW field-presence standard (signed off 2026-06-12); it does not reproduce the April editorial scores.',
  );

  return {
    meta: {
      today,
      rubricMax: RUBRIC_MAX,
      totalTeams,
      leagues: leagueKeys,
      generatedNote: 'Generated by audit/generate-site-audit.ts from repo + Firestore (no [LIVE] data).',
    },
    dataCompletenessByLeague,
    rubric: RUBRIC,
    coverage: {
      recurringDeals: {
        covered: recurringSlugs.size,
        total: totalTeams,
        teamSlugs: [...recurringSlugs].sort(),
      },
      venueDetail: {
        covered: venueDetailCovered,
        total: totalTeams,
        definition: 'Effective venue (Firestore + venue-overrides) has parkingInfo AND publicTransit AND bagPolicyUrl',
        byField: venueByField,
      },
      affiliate: {
        ticketmasterReady: {
          covered: tmReady,
          total: totalTeams,
          definition: 'Team has ticketmasterAttractionId (numeric artist id for redirect-free URLs)',
        },
        fanaticsReady: {
          covered: fanaticsReady,
          total: totalTeams,
          definition: 'Team has fanaticsUrl (the field FanaticsCTA gates render on)',
        },
      },
    },
    promoCounts: {
      upcomingTotal: upcoming.length,
      upcomingByLeague,
      allTimeTotal,
    },
    pageInventory,
    aggregatorPages,
    schemaPresence,
    technical,
    knownBugs: bugs,
    findings,
  };
}
