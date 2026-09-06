/* eslint-disable no-console */
/**
 * nfl-schedule-title-sep2026: ingest Google Search Console exports and make them
 * the baseline of record, then compute the per-page read against them.
 *
 * WHY THIS SCRIPT EXISTS. The baseline cannot come from Ahrefs. Its GSC
 * connector holds no URL-attributed data after 2026-07-15 (gsc-page-history,
 * gsc-keywords and gsc-pages all return empty for any window starting later),
 * and even inside its window it is a keyword-capped sample that
 * audit/ctr-diagnostic-gate0-gate1.md measured at roughly 7x low at page level.
 * Windsor.ai has only a GA4 connector on this account, and GA4 carries no
 * impressions, CTR or position. So the numbers come out of Search Console by
 * hand, and this script turns those exports into frozen, reviewable artifacts.
 *
 * TWO EXPORTS PER WINDOW, because the experiment is scored on the second one.
 *
 *   --tab pages    the Pages tab. Per-URL totals across ALL queries on the URL.
 *                  This is what the decision rule's per-page deltas are built
 *                  from.
 *   --tab queries  the Queries tab, exported with a "Page contains /nfl/"
 *                  filter applied. Split into the promo-schedule family (the
 *                  actual hypothesis) and bare schedule intent (the head terms,
 *                  expected to stay near zero). Without this a Pages-only read
 *                  dilutes the family the test is about with every other query
 *                  on the URL.
 *
 * WINDOWS ARE DERIVED FROM THE SHIP DATE, never hardcoded, because the merge is
 * held on a manual export and may slip. docs/SITE-AUDIT.md carries the house
 * rule from the sibling experiment: no window may cross the start timestamp,
 * because a straddling window mixes both titles in the treatment arm and is
 * invalid. This script refuses to build one.
 *
 *   baseline = [ship - 14, ship - 1]      read = [ship + 1, ship + 14]
 *
 * A page absent from a Search Console export had no impressions in the window.
 * That is a real reading, recorded as null rather than coerced to 0 so the read
 * cannot divide by it. But a WHOLESALE absence is not a reading, it is a broken
 * export, so a low match rate refuses to write without --force.
 *
 * USAGE
 *   R="node --require ./scripts/stub-server-only.cjs --import tsx scripts/nfl-title-baseline.ts"
 *
 *   $R --window baseline --tab pages   --dir ~/Downloads/getpromonight-9 --export-date 2026-09-08
 *   $R --window baseline --tab queries --dir ~/Downloads/getpromonight-10 --export-date 2026-09-08
 *
 * PREFER --dir, the whole unzipped export folder, over --csv. Chart.csv proves
 * the range the export actually covers and Filters.csv proves which filters were
 * applied; Pages.csv and Queries.csv carry neither, so a bare --csv cannot tell
 * a 14-day filtered export from a 28-day unfiltered one. Add --execute to write,
 * --ship-date if the merge slipped, and --from/--to to file an export under the
 * range it really covers.
 *
 * Reads and writes audit/nfl-title-test-baseline-2026-09-05.json only. No
 * network, no Firestore, no title is ever edited by this file.
 */
import fs from 'node:fs';
import path from 'node:path';

function die(msg: string): never {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

/**
 * tsx runs this file as CJS in this repo (scripts load through
 * scripts/stub-server-only.cjs), so import.meta.dirname is unavailable. Walk up
 * to the package.json instead, which also lets the script run from a subdir.
 */
function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) die('could not find the repo root (no package.json above the working directory)');
    dir = up;
  }
}

const REPO = findRepoRoot(process.cwd());
const JSON_PATH = path.join(REPO, 'audit', 'nfl-title-test-baseline-2026-09-05.json');
const HOST = 'https://www.getpromonight.com';
const DEFAULT_SHIP_DATE = '2026-09-05';

/** Below this many of the 20 URLs matched, an export is treated as broken. */
const MIN_MATCHES = 10;
/** The Search Console UI caps a dimension export at this many rows. */
const UI_ROW_CAP = 1000;
/**
 * Search Console Performance data for the most recent days is incomplete. An
 * export taken fewer than this many days after the window closes undercounts
 * the tail of the window, which biases every click and impression delta
 * downward, in exactly the direction that reads as "the title did nothing".
 */
const MIN_SETTLE_DAYS = 3;

type WindowName = 'baseline' | 'read';
type TabName = 'pages' | 'queries';

interface Metrics {
  clicks: number;
  impressions: number;
  ctrPct: number;
  position: number;
}
/** null means the URL was absent from the export: no impressions in the window. */
type MetricsOrAbsent = Metrics | null;

interface FamilyBucket extends Metrics {
  queries: number;
}
interface FamilyTotals {
  promoSchedule: FamilyBucket;
  bareSchedule: FamilyBucket;
}

interface PageRow {
  slug: string;
  arm: 'treatment' | 'control';
  gsc?: Partial<Record<WindowName, MetricsOrAbsent>>;
  queryFamily?: Partial<Record<WindowName, FamilyTotals>>;
  [k: string]: unknown;
}

interface WindowStamp {
  from: string;
  to: string;
  shipDate: string;
  tab: TabName;
  sourceFile: string;
  exportDate: string;
  rowsInExport: number;
  rowsMatched: number;
  rowsAbsent: number;
  suspect: boolean;
  suspectReasons: string[];
}

interface BaselineDoc {
  experiment: string;
  pages: PageRow[];
  shipDate?: string;
  baselineOfRecord?: {
    status: 'pending' | 'captured';
    window: string;
    pagesFile: string | null;
    queriesFile: string | null;
  };
  gscWindows?: Record<string, WindowStamp>;
  [k: string]: unknown;
}

// ── dates ──────────────────────────────────────────────────────────────────

const DAY = 86400000;
function parseDate(s: string, what: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) die(`${what} must be YYYY-MM-DD, got "${s}"`);
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(t)) die(`${what} is not a real date: "${s}"`);
  return t;
}
function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
function windowFor(shipDate: string, w: WindowName): { from: string; to: string } {
  const ship = parseDate(shipDate, 'ship date');
  return w === 'baseline'
    ? { from: iso(ship - 14 * DAY), to: iso(ship - DAY) }
    : { from: iso(ship + DAY), to: iso(ship + 14 * DAY) };
}

// ── csv ────────────────────────────────────────────────────────────────────

/**
 * Minimal RFC4180 split. Search Console quotes any field containing a comma,
 * and query exports routinely do.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNum(raw: string): number {
  return Number((raw ?? '').replace(/[,\s]/g, ''));
}

/**
 * CTR is NOT inferred from magnitude. The UI exports "26.11%", the API exports
 * "0.2611", and a spreadsheet round-trip can produce a bare "0.5" that means
 * half a percent. Guessing from magnitude turns that 0.5% into 50%, silently,
 * on exactly the low-CTR rows this experiment lives among. So: take the percent
 * form when the "%" is present, otherwise DERIVE it from clicks and impressions,
 * which are unambiguous integers, and ignore the column.
 */
function resolveCtrPct(raw: string, clicks: number, impressions: number): number {
  const s = (raw ?? '').replace(/\s/g, '');
  if (s.endsWith('%')) {
    const n = Number(s.slice(0, -1).replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

function normalizeUrl(raw: string): string {
  let u = (raw ?? '').trim();
  u = u.split('#')[0].split('?')[0];
  u = u.replace(/\/+$/, '');
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  // A domain (sc-domain) or apex-host property would otherwise match nothing at
  // all and read as "every page absent".
  u = u.replace(/^https:\/\/getpromonight\.com/, HOST);
  return u;
}

interface ParsedExport {
  rows: number;
  hitRowCap: boolean;
  byUrl: Map<string, Metrics>;
  queries: Array<{ query: string } & Metrics>;
}

/**
 * A Search Console export is a FOLDER, and the folder is what carries the
 * provenance the CSVs themselves do not: Chart.csv has one row per day, so it
 * states the range actually covered, and Filters.csv states which filters were
 * applied. Pages.csv and Queries.csv carry neither.
 *
 * This matters because the first real export handed to this script was a
 * "Last 28 days" range with no page filter, and nothing in a bare Pages.csv
 * could have revealed that. Prefer --dir over --csv for exactly that reason.
 */
interface ExportMeta {
  from: string | null;
  to: string | null;
  days: number;
  filters: Array<[string, string]>;
}

function readExportMeta(dir: string): ExportMeta {
  const meta: ExportMeta = { from: null, to: null, days: 0, filters: [] };
  const chart = path.join(dir, 'Chart.csv');
  if (fs.existsSync(chart)) {
    const dates = fs
      .readFileSync(chart, 'utf8')
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => splitCsvLine(l)[0])
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (dates.length > 0) {
      meta.from = dates[0];
      meta.to = dates[dates.length - 1];
      meta.days = dates.length;
    }
  }
  const filters = path.join(dir, 'Filters.csv');
  if (fs.existsSync(filters)) {
    for (const l of fs.readFileSync(filters, 'utf8').trim().split(/\r?\n/).slice(1)) {
      const c = splitCsvLine(l);
      if (c.length >= 2) meta.filters.push([c[0], c[1]]);
    }
  }
  return meta;
}

function parseExport(csvPath: string, tab: TabName): ParsedExport {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) die(`${csvPath} has no data rows`);

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n));
  const iClicks = find('clicks', 'url clicks');
  const iImpr = find('impressions');
  const iCtr = find('ctr', 'site ctr', 'url ctr');
  const iPos = find('position', 'average position', 'site position', 'url position');
  const iUrl = find('top pages', 'page', 'url', 'pages', 'landing page');
  const iQuery = find('top queries', 'query', 'queries', 'search query');

  const need = tab === 'pages' ? iUrl : iQuery;
  const label = tab === 'pages' ? 'a page column ("Top pages")' : 'a query column ("Top queries")';
  if (need < 0 || iClicks < 0 || iImpr < 0 || iCtr < 0 || iPos < 0) {
    const otherTab: TabName = tab === 'pages' ? 'queries' : 'pages';
    const looksLikeOther = tab === 'pages' ? iQuery >= 0 : iUrl >= 0;
    die(
      `could not find the expected columns in ${csvPath}.\n` +
        `  header seen: ${header.join(' | ')}\n` +
        `  --tab ${tab} needs ${label} plus Clicks, Impressions, CTR, Position.\n` +
        (looksLikeOther
          ? `  This looks like the ${otherTab.toUpperCase()} export. Re-run with --tab ${otherTab}.`
          : `  Export the ${tab === 'pages' ? 'PAGES' : 'QUERIES'} tab from Performance > Search results.`),
    );
  }

  const byUrl = new Map<string, Metrics>();
  const queries: Array<{ query: string } & Metrics> = [];
  let rows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const clicks = parseNum(cells[iClicks]);
    const impressions = parseNum(cells[iImpr]);
    if (!Number.isFinite(clicks) || !Number.isFinite(impressions)) continue;
    const m: Metrics = {
      clicks,
      impressions,
      ctrPct: resolveCtrPct(cells[iCtr], clicks, impressions),
      position: parseNum(cells[iPos]),
    };
    rows++;
    if (tab === 'pages') {
      const url = normalizeUrl(cells[iUrl]);
      if (!url.startsWith('http')) continue;
      byUrl.set(url, m);
    } else {
      const q = (cells[iQuery] ?? '').toLowerCase().trim();
      if (!q) continue;
      queries.push({ query: q, ...m });
    }
  }
  return { rows, hitRowCap: rows >= UI_ROW_CAP, byUrl, queries };
}

// ── query-family classification ────────────────────────────────────────────

/**
 * Team tokens, matched against a Queries export the operator has already
 * filtered to "Page contains /nfl/". That page filter is what makes bare last
 * names safe: "giants" is ambiguous site-wide (the San Francisco Giants are an
 * MLB ctr-diagnostic treatment club) but unambiguous once MLB pages are out.
 * A query matching more than one team is counted as ambiguous and dropped from
 * per-team totals rather than guessed at.
 */
const TEAM_TOKENS: Record<string, string[]> = {
  'chicago-bears': ['bears'],
  'dallas-cowboys': ['cowboys'],
  'kansas-city-chiefs': ['chiefs'],
  'philadelphia-eagles': ['eagles'],
  'pittsburgh-steelers': ['steelers'],
  'san-francisco-49ers': ['49ers', 'niners'],
  'new-york-giants': ['giants'],
  'cincinnati-bengals': ['bengals'],
  'detroit-lions': ['lions'],
  'baltimore-ravens': ['ravens'],
  'los-angeles-rams': ['rams'],
  'los-angeles-chargers': ['chargers'],
  'atlanta-falcons': ['falcons'],
  'tampa-bay-buccaneers': ['buccaneers', 'bucs'],
  'buffalo-bills': ['bills'],
  'denver-broncos': ['broncos'],
  'seattle-seahawks': ['seahawks'],
  'minnesota-vikings': ['vikings'],
  'new-york-jets': ['jets'],
  'miami-dolphins': ['dolphins'],
};

/** The words that turn "schedule" into the family this experiment is about. */
const PROMO_WORDS =
  /(^|[^a-z])(promo|promos|promotion|promotions|promotional|giveaway|giveaways)([^a-z]|$)/;

function classifyQuery(q: string): 'promoSchedule' | 'bareSchedule' | 'other' {
  if (!/(^|[^a-z])schedule([^a-z]|$)/.test(q)) return 'other';
  return PROMO_WORDS.test(q) ? 'promoSchedule' : 'bareSchedule';
}

function teamsFor(q: string): string[] {
  const hits: string[] = [];
  for (const [slug, tokens] of Object.entries(TEAM_TOKENS)) {
    if (tokens.some((t) => new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(q))) hits.push(slug);
  }
  return hits;
}

function emptyFamily(): FamilyTotals {
  const zero = (): FamilyBucket => ({
    clicks: 0,
    impressions: 0,
    ctrPct: 0,
    position: 0,
    queries: 0,
  });
  return { promoSchedule: zero(), bareSchedule: zero() };
}

// ── formatting ─────────────────────────────────────────────────────────────

function fmt(n: number, dp = 2): string {
  return Number.isFinite(n) ? n.toFixed(dp) : 'n/a';
}
function pad(s: string | number, n: number): string {
  const str = String(s);
  return str.length >= n ? str : str + ' '.repeat(n - str.length);
}
function signed(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return 'n/a';
  return (n > 0 ? '+' : '') + n.toFixed(dp);
}

// ── main ───────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const argv = process.argv.slice(2);
  const execute = argv.includes('--execute');
  const force = argv.includes('--force');
  const windowArg = arg('--window') as WindowName | undefined;
  const tab = (arg('--tab') ?? 'pages') as TabName;
  const csvArg = arg('--csv');
  const dirArg = arg('--dir');
  const exportDate = arg('--export-date');
  const fromArg = arg('--from');
  const toArg = arg('--to');

  if (windowArg !== 'baseline' && windowArg !== 'read') {
    die('pass --window baseline  or  --window read');
  }
  if (tab !== 'pages' && tab !== 'queries') die('pass --tab pages  or  --tab queries');
  if (!csvArg && !dirArg) {
    die(
      'pass --dir <the unzipped Search Console export folder>, which is preferred because it\n' +
        '  carries Chart.csv and Filters.csv and so proves the range and the filters, or\n' +
        '  --csv <a single file> if you only have the one CSV.',
    );
  }
  if (dirArg && !fs.existsSync(dirArg)) die(`no such directory: ${dirArg}`);
  const resolvedCsv = csvArg ?? path.join(dirArg!, tab === 'pages' ? 'Pages.csv' : 'Queries.csv');
  if (!fs.existsSync(resolvedCsv)) die(`no such file: ${resolvedCsv}`);

  const doc: BaselineDoc = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  // Ship date: the flag wins, then whatever a previous run recorded, then the
  // planned date. Recorded so every later run derives the same windows.
  const shipDate = arg('--ship-date') ?? doc.shipDate ?? DEFAULT_SHIP_DATE;
  const ship = parseDate(shipDate, 'ship date');
  // --from/--to override the derived window. Needed because Search Console runs
  // about two days behind, so "the 14 days ending the day before ship" may not
  // exist yet on the day the baseline is captured. A GAP between the baseline
  // window and the ship date is fine; an OVERLAP is not, and is refused below.
  const derived = windowFor(shipDate, windowArg);
  const win =
    fromArg || toArg
      ? { from: fromArg ?? derived.from, to: toArg ?? derived.to }
      : derived;
  parseDate(win.from, '--from');
  parseDate(win.to, '--to');
  if (parseDate(win.from, '--from') > parseDate(win.to, '--to')) {
    die(`--from ${win.from} is after --to ${win.to}`);
  }

  // The house rule from the sibling experiment: no window may cross the start
  // timestamp. Derivation makes that structural, but check anyway so a
  // hand-edited shipDate cannot produce a straddling window.
  if (parseDate(win.from, 'window start') <= ship && ship <= parseDate(win.to, 'window end')) {
    die(
      `the ${windowArg} window ${win.from}..${win.to} contains the ship date ${shipDate}.\n` +
        `  A straddling window mixes both titles in the treatment arm and is invalid.`,
    );
  }

  const parsed = parseExport(resolvedCsv, tab);

  console.log(`\n=== ${doc.experiment} ===`);
  console.log(
    `window   ${windowArg}  ${win.from} to ${win.to}   (derived from ship date ${shipDate})`,
  );
  console.log(`tab      ${tab}`);
  console.log(`export   ${resolvedCsv}`);
  console.log(`rows     ${parsed.rows}\n`);

  const suspectReasons: string[] = [];

  // The check that would have caught the first real export handed to this
  // script: a "Last 28 days" range with no page filter, which no bare
  // Pages.csv can reveal because it carries neither.
  if (dirArg) {
    const meta = readExportMeta(dirArg);
    if (meta.from && meta.to) {
      console.log(`export covers ${meta.from} to ${meta.to} (${meta.days} days), per Chart.csv`);
      if (meta.from !== win.from || meta.to !== win.to) {
        suspectReasons.push(
          `RANGE MISMATCH. The export covers ${meta.from}..${meta.to} (${meta.days} days) but this ` +
            `window is ${win.from}..${win.to}. Per-page rows are totals over whatever range was ` +
            `exported, so these numbers do not describe the window they would be filed under. ` +
            `Re-export with a custom range, or pass --from/--to to file it under the range it ` +
            `actually covers`,
        );
      }
    } else {
      suspectReasons.push('no Chart.csv in the export folder, so the covered range could not be verified');
    }
    if (meta.filters.length > 0) {
      console.log(`filters applied: ${meta.filters.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    const hasPageFilter = meta.filters.some(
      ([k, v]) => /page/i.test(k) || /\/nfl\//.test(v),
    );
    if (tab === 'queries' && !hasPageFilter) {
      suspectReasons.push(
        'the Queries export carries no page filter. Without "Page contains /nfl/" the rows are ' +
          'site-wide, so team attribution crosses leagues ("giants" also matches the MLB San ' +
          'Francisco Giants, a ctr-diagnostic treatment club) and the row cap bites',
      );
    }
  } else {
    suspectReasons.push(
      'ran on a bare --csv, so the covered date range and the applied filters could not be ' +
        'verified. Prefer --dir with the whole unzipped export folder',
    );
  }

  if (exportDate) {
    const settle = (parseDate(exportDate, '--export-date') - parseDate(win.to, 'window end')) / DAY;
    if (settle < MIN_SETTLE_DAYS) {
      suspectReasons.push(
        `exported ${settle} day(s) after the window closed. Search Console data for the last ` +
          `${MIN_SETTLE_DAYS} days is incomplete, so the window tail is undercounted and every ` +
          `click and impression delta is biased downward`,
      );
    }
  } else {
    suspectReasons.push('no --export-date given, so reporting lag could not be checked');
  }
  if (parsed.hitRowCap) {
    suspectReasons.push(
      `export has ${parsed.rows} rows and the Search Console UI caps a dimension export at ` +
        `${UI_ROW_CAP}, so low-click test URLs may have fallen off the bottom. Re-export with a ` +
        `"Page contains /nfl/" filter applied`,
    );
  }

  let matched = 0;
  let absent = 0;

  if (tab === 'pages') {
    for (const p of doc.pages) {
      const m = parsed.byUrl.get(`${HOST}/nfl/${p.slug}`) ?? null;
      p.gsc = { ...(p.gsc ?? {}), [windowArg]: m };
      if (m) matched++;
      else absent++;
    }

    console.log(
      pad('slug', 22) + pad('arm', 11) + pad('clicks', 8) + pad('impr', 8) + pad('CTR%', 8) + 'pos',
    );
    for (const p of doc.pages) {
      const m = p.gsc?.[windowArg] ?? null;
      console.log(
        pad(p.slug, 22) +
          pad(p.arm, 11) +
          (m
            ? pad(m.clicks, 8) + pad(m.impressions, 8) + pad(fmt(m.ctrPct), 8) + fmt(m.position)
            : 'absent from export (no impressions in window)'),
      );
    }
    console.log(`\nmatched ${matched} of ${doc.pages.length}, absent ${absent}`);
    if (matched < MIN_MATCHES) {
      suspectReasons.push(
        `only ${matched} of ${doc.pages.length} test URLs matched. That is far more likely a wrong ` +
          `property, a domain-property export, or the row cap than twenty pages with no impressions`,
      );
    }
  } else {
    const per = new Map<string, FamilyTotals>();
    let ambiguous = 0;
    let unattributed = 0;
    let offFamily = 0;
    for (const q of parsed.queries) {
      const fam = classifyQuery(q.query);
      if (fam === 'other') {
        offFamily++;
        continue;
      }
      const teams = teamsFor(q.query);
      if (teams.length === 0) {
        unattributed++;
        continue;
      }
      if (teams.length > 1) {
        ambiguous++;
        continue;
      }
      const t = per.get(teams[0]) ?? emptyFamily();
      const bucket = t[fam];
      // Position is impression-weighted: accumulate the weighted sum here and
      // divide at the end. Ratio of sums, never the mean of ratios, which is
      // the house method from audit/ctr-diagnostic-gate0-gate1.md.
      bucket.position += q.position * q.impressions;
      bucket.clicks += q.clicks;
      bucket.impressions += q.impressions;
      bucket.queries += 1;
      per.set(teams[0], t);
    }
    for (const t of per.values()) {
      for (const fam of ['promoSchedule', 'bareSchedule'] as const) {
        const b = t[fam];
        b.position = b.impressions > 0 ? b.position / b.impressions : 0;
        b.ctrPct = b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0;
      }
    }
    for (const p of doc.pages) {
      const t = per.get(p.slug) ?? emptyFamily();
      p.queryFamily = { ...(p.queryFamily ?? {}), [windowArg]: t };
      if (t.promoSchedule.queries + t.bareSchedule.queries > 0) matched++;
      else absent++;
    }

    console.log('THE HYPOTHESIS FAMILY. promo-schedule is the target. bare schedule is the');
    console.log(
      'head-term family the repo already measured as unwinnable (src/lib/cfb/metadata.ts).\n',
    );
    console.log(
      pad('slug', 22) +
        pad('arm', 11) +
        pad('promoSch impr', 15) +
        pad('clicks', 8) +
        pad('CTR%', 8) +
        pad('pos', 8) +
        'bareSch impr',
    );
    for (const p of doc.pages) {
      const t = p.queryFamily?.[windowArg];
      if (!t) continue;
      console.log(
        pad(p.slug, 22) +
          pad(p.arm, 11) +
          pad(t.promoSchedule.impressions, 15) +
          pad(t.promoSchedule.clicks, 8) +
          pad(fmt(t.promoSchedule.ctrPct), 8) +
          pad(fmt(t.promoSchedule.position), 8) +
          t.bareSchedule.impressions,
      );
    }
    console.log(
      `\nqueries classified: ${parsed.queries.length} total, ${offFamily} with no "schedule" token, ` +
        `${unattributed} naming no test team, ${ambiguous} naming more than one (dropped).`,
    );
    console.log(`teams with any schedule-family query: ${matched} of ${doc.pages.length}`);
    if (parsed.queries.length > 0 && unattributed > parsed.queries.length / 2) {
      suspectReasons.push(
        `${unattributed} of ${parsed.queries.length} queries named no test team. If this export was ` +
          `not filtered to "Page contains /nfl/", the attribution is unsafe: "giants" also matches ` +
          `the MLB San Francisco Giants, a ctr-diagnostic treatment club`,
      );
    }
  }

  if (suspectReasons.length > 0) {
    console.log('\n!!! SUSPECT EXPORT:');
    for (const r of suspectReasons) console.log(`  - ${r}`);
  }

  // Per-page deltas, once both windows exist. Per page, never pooled:
  // los-angeles-rams was 785 of 816 control impressions in the July sample, so
  // an arm-level ratio is that one page against noise.
  if (tab === 'pages' && doc.pages.every((p) => p.gsc && 'baseline' in p.gsc && 'read' in p.gsc)) {
    console.log('\n=== PER-PAGE DELTAS, read minus baseline ===');
    console.log(
      pad('slug', 22) +
        pad('arm', 11) +
        pad('d clicks', 10) +
        pad('d impr', 10) +
        pad('d CTR pp', 10) +
        'd pos (negative is better)',
    );
    for (const p of doc.pages) {
      const b = p.gsc?.baseline ?? null;
      const r = p.gsc?.read ?? null;
      if (!b || !r) {
        console.log(pad(p.slug, 22) + pad(p.arm, 11) + 'not comparable (absent in one window)');
        continue;
      }
      console.log(
        pad(p.slug, 22) +
          pad(p.arm, 11) +
          pad(signed(r.clicks - b.clicks, 0), 10) +
          pad(signed(r.impressions - b.impressions, 0), 10) +
          pad(signed(r.ctrPct - b.ctrPct), 10) +
          signed(r.position - b.position),
      );
    }
    console.log(
      '\nRead these as twenty numbers, not two averages. los-angeles-rams is its\n' +
        'own line and stays its own line. Ten pages against ten over fourteen days,\n' +
        'with an unknown share of the window still serving the old title to Google,\n' +
        'is a DIRECTIONAL SIGNAL and not a result. Do not pool an arm CTR.',
    );
  }

  if (tab === 'queries' && doc.pages.every((p) => p.queryFamily?.baseline && p.queryFamily?.read)) {
    console.log('\n=== PER-PAGE PROMO-SCHEDULE FAMILY DELTAS, read minus baseline ===');
    console.log('This is the table the decision rule is scored on. bareSch is reported so a');
    console.log('null on the head terms is visible as the expected outcome, not a surprise.\n');
    console.log(
      pad('slug', 22) +
        pad('arm', 11) +
        pad('d impr', 10) +
        pad('d clicks', 10) +
        pad('d CTR pp', 10) +
        'd bareSch impr',
    );
    for (const p of doc.pages) {
      const b = p.queryFamily!.baseline!;
      const r = p.queryFamily!.read!;
      console.log(
        pad(p.slug, 22) +
          pad(p.arm, 11) +
          pad(signed(r.promoSchedule.impressions - b.promoSchedule.impressions, 0), 10) +
          pad(signed(r.promoSchedule.clicks - b.promoSchedule.clicks, 0), 10) +
          pad(signed(r.promoSchedule.ctrPct - b.promoSchedule.ctrPct), 10) +
          signed(r.bareSchedule.impressions - b.bareSchedule.impressions, 0),
      );
    }
  }

  if (!execute) {
    console.log('\nDRY RUN. Nothing written. Re-run with --execute to record it.');
    return;
  }

  // A degenerate export must never become the artifact of record, because the
  // runbook's merge gate is satisfied by that file existing.
  const blocking = suspectReasons.filter(
    (r) =>
      r.startsWith('only ') ||
      r.includes('naming no test team') ||
      r.startsWith('RANGE MISMATCH') ||
      r.includes('no page filter'),
  );
  if (blocking.length > 0 && !force) {
    die(
      `refusing to write a suspect export as the baseline of record:\n` +
        blocking.map((r) => `  - ${r}`).join('\n') +
        `\n  Fix the export, or pass --force if you have checked it and it really is this sparse.`,
    );
  }

  const copied = path.join(
    REPO,
    'audit',
    `nfl-title-test-gsc-${windowArg}-${tab}-${win.from}_${win.to}.csv`,
  );
  fs.copyFileSync(resolvedCsv, copied);

  const stamp: WindowStamp = {
    from: win.from,
    to: win.to,
    shipDate,
    tab,
    sourceFile: path.relative(REPO, copied),
    exportDate: exportDate ?? 'unrecorded',
    rowsInExport: parsed.rows,
    rowsMatched: matched,
    rowsAbsent: absent,
    suspect: suspectReasons.length > 0,
    suspectReasons,
  };

  doc.shipDate = shipDate;
  doc.gscWindows = { ...(doc.gscWindows ?? {}), [`${windowArg}:${tab}`]: stamp };

  const bp = doc.gscWindows['baseline:pages'];
  const bq = doc.gscWindows['baseline:queries'];
  // The window REPORTED here is the one actually captured, read back off the
  // stamps, never re-derived from shipDate. Those differ whenever --from/--to
  // were used, which is the normal case: Search Console runs about two days
  // behind, so the baseline usually ends before ship rather than the day before
  // it. Re-deriving would print a window no export covers.
  const bw = bp ?? bq ?? null;
  doc.baselineOfRecord = {
    status: bp && bq ? 'captured' : 'pending',
    window: bw ? `${bw.from}..${bw.to}` : windowFor(shipDate, 'baseline').from + '..pending',
    pagesFile: bp ? bp.sourceFile : null,
    queriesFile: bq ? bq.sourceFile : null,
  };
  if (bp && bq && (bp.from !== bq.from || bp.to !== bq.to)) {
    console.log(
      `\n!!! The two baseline exports cover DIFFERENT windows: pages ${bp.from}..${bp.to}, ` +
        `queries ${bq.from}..${bq.to}. Re-export so they match.`,
    );
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\nWROTE ${path.relative(REPO, JSON_PATH)}`);
  console.log(`WROTE ${stamp.sourceFile}  (the raw export, kept as the artifact of record)`);
  console.log(`baselineOfRecord.status = ${doc.baselineOfRecord.status}`);
  if (doc.baselineOfRecord.status === 'pending') {
    console.log('  still pending: the merge gate needs BOTH baseline:pages and baseline:queries.');
  }
  if (stamp.suspect) {
    console.log('  stamp.suspect = true. The reasons are recorded in the JSON, not just here.');
  }
}

main();
