/* eslint-disable no-console */
// Served-HTML verification for the playoffs pages.
//
// Every claim is derived here from the RAW bracket documents, with this
// file's own formatting, and then looked for in the bytes the server sent.
// Nothing is read through the mapper or the view: a check that renders the
// expected page with the page's own code proves only that the code repeats
// itself.
//
// Run:
//   BASE=https://<host> node --require ./scripts/stub-server-only.cjs \
//     --import tsx --env-file=.env.local scripts/playoffs/verify-served.ts
//
//   BASE    origin to fetch from. Default http://localhost:3468.
//   BYPASS  Vercel protection bypass secret. Sent as a header, never printed.
//   SHARE   a share link for a protected preview. Opened once for its access
//           cookie, which is held in memory and never printed.
//   CASE=1  also request /playoffs/MLB and expect a 404. NOT for a local
//           `next start` on a case-insensitive disk, where the 404 overwrites
//           the prerendered lowercase entry.
//   OUT     directory to save the fetched pages in.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../../src/lib/firebase';
import { getAllTeams, getVenueForTeam } from '../../src/lib/data';
import { getTeamVenueHubMap } from '../../src/lib/venue-hub';
import { OG_IMAGE_ALT } from '../../src/lib/og';
import { METHODOLOGY_SECTION_ID, fingerprintPlacement, operatorText } from './flight';

const BASE = (process.env.BASE || 'http://localhost:3468').replace(/\/$/, '');
const BYPASS = process.env.BYPASS || '';
const SHARE = process.env.SHARE || '';
let cookie = '';
const OUT = process.env.OUT || '';
// Leagues the deployment under test was built with PREDICTIONS_DISABLED for:
// their pages must carry no trace of the predictions, and nothing about why.
const DISABLED = new Set((process.env.EXPECT_DISABLED || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
const SITE = 'https://www.getpromonight.com';
const SEASON = 2026;
const LEAGUES = ['MLB', 'WNBA'] as const;
type League = (typeof LEAGUES)[number];

// ---- Reporting ----
const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}
function same(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  check(name, ok, ok ? String(expected).slice(0, 120) : `served ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
}

// ---- Fetching ----
async function get(path: string): Promise<{ status: number; body: string; headers: Headers; fetchedAt: Date }> {
  const headers: Record<string, string> = { 'user-agent': 'Mozilla/5.0 (playoffs served-HTML check)' };
  if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { headers, redirect: 'manual' });
  return { status: res.status, body: await res.text(), headers: res.headers, fetchedAt: new Date() };
}
/** When the served page was rendered: between the fetch minus the cache's
 *  `age` and the fetch. Every instant a page-time value may change at inside
 *  that window is a candidate; with no age header, only the fetch time. */
function renderWindow(headers: Headers, fetchedAt: Date): Date[] {
  const age = Number(headers.get('age'));
  return Number.isFinite(age) && age > 0 ? [new Date(fetchedAt.getTime() - age * 1000), fetchedAt] : [fetchedAt];
}
/** Each distinct value `f` takes at the window's ends and at every game start
 *  inside it (the only instants the page-time values change at). */
function valuesIn<T>(window: Date[], docs: RawDoc[], f: (at: Date) => T): T[] {
  const lo = window[0].getTime();
  const hi = window[window.length - 1].getTime();
  const at = new Set<number>([lo, hi]);
  for (const d of docs) for (const s of d.series) for (const g of s.games) {
    const t = typeof g.start === 'string' ? Date.parse(g.start) : NaN;
    if (t > lo && t <= hi) { at.add(t - 1); at.add(t); }
  }
  const out: T[] = [];
  for (const t of [...at].sort()) { const v = f(new Date(t)); if (!out.some((o) => JSON.stringify(o) === JSON.stringify(v))) out.push(v); }
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Reading HTML ----
const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");

/** The markup with every script and style removed: what becomes the DOM. */
const domOf = (html: string) => html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');

/** Visible text: comments gone, tags turned to spaces, whitespace collapsed. */
function textOf(markup: string): string {
  return decode(
    domOf(markup)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<svg\b[\s\S]*?<\/svg>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/ ([.,:])/g, '$1')
    .trim();
}

/** The whole element whose opening tag holds `marker`, or null. */
function element(markup: string, marker: string, from = 0): string | null {
  const at = markup.indexOf(marker, from);
  if (at < 0) return null;
  const start = markup.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(markup.slice(start))?.[1];
  if (!tag) return null;
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(markup); m; m = re.exec(markup)) {
    if (m[0].startsWith('</')) depth -= 1;
    else if (!m[0].endsWith('/>')) depth += 1;
    if (depth === 0) return markup.slice(start, m.index + m[0].length);
  }
  return null;
}
function elements(markup: string, marker: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = markup.indexOf(marker, from);
    if (at < 0) return out;
    const el = element(markup, marker, from);
    if (!el) return out;
    out.push(el);
    from = markup.lastIndexOf('<', at) + el.length;
  }
}
const count = (s: string, needle: string) => s.split(needle).length - 1;
const meta = (html: string, attr: 'name' | 'property', key: string) => {
  const m = new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`).exec(html);
  return m ? decode(m[1]) : null;
};

// ---- The raw document, read by this file's own rules ----
type RawSlot = { slug?: string; seed?: number | null; placeholder?: string; feederSeriesKey?: string; candidates?: string[] | null };
type RawGame = {
  gameNumber: number;
  gameId?: string;
  date: string | null;
  start: string | null;
  startTimeTBD: boolean;
  home?: string | null;
  away?: string | null;
  homeSide: 'higher' | 'lower' | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  ifNecessary: boolean;
};
type RawSeries = {
  round: string;
  roundLabel: string;
  seriesKey: string;
  conference: string | null;
  bestOf: number;
  higher: RawSlot;
  lower: RawSlot;
  wins: { higher: number; lower: number };
  status: string;
  winner: string | null;
  games: RawGame[];
};
type RawDoc = { league: string; season: number; series: RawSeries[]; lastChangedAt?: unknown; [k: string]: unknown };

const ET = 'America/New_York';
const parts = (d: Date, opts: Intl.DateTimeFormatOptions, tz = ET) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(d).map((p) => [p.type, p.value]));
function etDay(d: Date, tz = ET): string {
  const p = parts(d, { weekday: 'short', month: 'short', day: 'numeric' }, tz);
  return `${p.weekday}, ${p.month} ${p.day}`;
}
function etTime(d: Date): string {
  const p = parts(d, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${p.dayPeriod} ET`;
}
function etYmd(d: Date): string {
  const p = parts(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}
function etStamp(d: Date): string {
  const p = parts(d, { month: 'short', day: 'numeric' });
  return `${p.month} ${p.day}, ${etTime(d)}`;
}
function whenOf(g: RawGame): string {
  if (!g.startTimeTBD && g.start) return `${etDay(new Date(g.start))} · ${etTime(new Date(g.start))}`;
  if (g.date) return `${etDay(new Date(`${g.date}T12:00:00Z`), 'UTC')} · Time TBD`;
  return 'Date TBD';
}
function instantOf(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'string') return new Date(v);
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return null;
}

// The forms a series key takes in the bracket documents, and no others.
const KEY_SHAPES = [/\b(?:AL|NL)-(?:WC|DS)-[A-Z]\b/, /\b(?:AL|NL)-CS\b/, /\bR\d-\dv\d\b/, /\bSF-[A-Z]\b/];
const keyIn = (text: string) => {
  for (const re of KEY_SHAPES) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
};

// The locked PromoNight Predicts bracket, as stored. Read raw; the page's mapper is not used.
type RawPick = {
  seriesKey: string;
  round: string;
  higher: string;
  lower: string;
  pick: string;
  pickProbability: number;
  modalSeriesLength: number;
  coinFlip: boolean;
};
type RawPred = {
  lockedAt?: unknown;
  rounds: RawPick[];
  titleOdds: { slug: string; odds: number }[];
  champion: string;
  simRuns: number;
  computedAt: string;
  reviewedSha256: string;
  computedBy?: string;
  provenance: Record<string, unknown>;
};
const longEt = (d: Date) => {
  const p = parts(d, { year: 'numeric', month: 'long', day: 'numeric' });
  return `${p.month} ${p.day}, ${p.year}`;
};
const BACKTEST: Record<League, string> = {
  WNBA: 'Run on the 2025 WNBA postseason with the same settings, the simulation called 5 of 7 series and got the champion right.',
  MLB: 'Run on the 2025 MLB postseason with the same settings, the simulation called 5 of 11 series and got the champion wrong.',
};

interface Club {
  name: string;
  full: string;
  abbr: string | null;
  park: string | null;
  venuePath: string | null;
}

async function main() {
  if (SHARE) {
    // The share link answers with a redirect and the access cookie.
    const res = await fetch(SHARE, { redirect: 'manual' });
    cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    if (!cookie) throw new Error(`the share link set no cookie (status ${res.status})`);
  }
  console.log(`BASE ${BASE}${BYPASS ? '  (protection bypass header sent)' : ''}${SHARE ? '  (access cookie from the share link)' : ''}`);
  if (OUT) mkdirSync(OUT, { recursive: true });

  // ---- What the documents say ----
  const docs = new Map<League, RawDoc>();
  for (const league of LEAGUES) {
    const snap = await db.collection('postseasonBrackets').doc(`${league}_${SEASON}`).get();
    if (snap.exists) docs.set(league, snap.data() as RawDoc);
  }
  const preds = new Map<League, RawPred>();
  for (const league of LEAGUES) {
    const snap = await db.collection('predictedBrackets').doc(`${league}_${SEASON}`).get();
    if (snap.exists) preds.set(league, snap.data() as RawPred);
  }
  const teams = await getAllTeams();
  const hubs = await getTeamVenueHubMap();
  const clubs = new Map<string, Club>();
  const wanted = new Set<string>();
  for (const d of docs.values()) {
    for (const s of d.series) {
      for (const slot of [s.higher, s.lower]) {
        if (slot.slug) wanted.add(slot.slug);
        for (const c of slot.candidates ?? []) wanted.add(c);
      }
    }
  }
  for (const id of wanted) {
    const t = teams.find((x) => x.id === id);
    if (!t) continue;
    const v = await getVenueForTeam(id);
    const hub = hubs.get(id);
    clubs.set(id, {
      name: t.name,
      full: `${t.city} ${t.name}`,
      abbr: (t as { abbreviation?: string }).abbreviation ?? null,
      park: v && v.name ? v.name : null,
      venuePath: hub ? `/venues/${hub.slug}` : null,
    });
  }
  check('documents read', docs.size === LEAGUES.length, [...docs.keys()].join(' '));
  check('locked predictions read', preds.size === LEAGUES.length, [...preds.keys()].join(' '));
  for (const p of preds.values()) {
    for (const id of [...p.rounds.flatMap((r) => [r.higher, r.lower]), ...p.titleOdds.map((o) => o.slug)]) {
      if (clubs.has(id)) continue;
      const t = teams.find((x) => x.id === id);
      if (t) clubs.set(id, { name: t.name, full: `${t.city} ${t.name}`, abbr: (t as { abbreviation?: string }).abbreviation ?? null, park: null, venuePath: null });
    }
  }
  /** The five fingerprints the contract lets a league page show. */
  const fingerprints = (p: RawPred): string[] => [
    p.provenance.corpusSha256 as string,
    p.provenance.paramsSha256 as string,
    p.provenance.descriptorSha256 as string,
    p.provenance.slugMapSha256 as string,
    p.reviewedSha256,
  ];
  /** Values of the predicted documents no page may carry. */
  const predBanned = (p: RawPred): string[] => {
    const v = p.provenance;
    const out = [v.seedFileSha256, v.canonicalDescriptorSha256, v.seedFileAuthoredBy, v.frozenBy, v.engineCommitAtFreeze, v.engineCommitAtCompute, p.computedBy];
    for (const f of [...((v.coreFiles as Record<string, unknown>[]) ?? []), ...((v.engineFiles as Record<string, unknown>[]) ?? [])]) out.push(f.path, f.blobAtFreeze, f.blobAtCompute);
    return out.filter((x): x is string => typeof x === 'string' && x.length >= 6);
  };
  check('every club in the documents has a team record', [...wanted].every((w) => clubs.has(w)), `${clubs.size} of ${wanted.size}`);

  /** What a slot is called on the page. */
  function slotName(doc: RawDoc, slot: RawSlot): { name: string; club: Club | null; slug: string | null } {
    if (slot.slug) {
      const c = clubs.get(slot.slug) ?? null;
      return { name: c ? c.name : slot.slug, club: c, slug: slot.slug };
    }
    // The winner, only from the feeder FIELD and only when that series is
    // final in this same document.
    if (slot.feederSeriesKey) {
      const feeder = doc.series.find((s) => s.seriesKey === slot.feederSeriesKey);
      if (feeder && feeder.status === 'final' && feeder.winner) {
        const side = feeder.winner === 'higher' || feeder.winner === 'lower' ? feeder[feeder.winner] : [feeder.higher, feeder.lower].find((x) => x.slug === feeder.winner);
        if (side && side.slug && clubs.has(side.slug)) {
          const c = clubs.get(side.slug) as Club;
          return { name: c.name, club: c, slug: side.slug };
        }
      }
    }
    if (slot.candidates && slot.candidates.length === 2) {
      const [a, b] = slot.candidates.map((c) => clubs.get(c));
      if (a && b) return { name: `${a.name} / ${b.name} winner`, club: null, slug: null };
    }
    const label = slot.placeholder ?? '';
    if (!label || keyIn(label)) return { name: 'To be decided', club: null, slug: null };
    return { name: label, club: null, slug: null };
  }

  const ids = (doc: RawDoc) => {
    const seen = new Map<string, number>();
    return doc.series.map((s) => {
      const n = (seen.get(s.round) ?? 0) + 1;
      seen.set(s.round, n);
      return `${s.round}-${n}`;
    });
  };
  const currentRound = (doc: RawDoc) => doc.series.find((s) => s.status !== 'final') ?? null;

  function scoreLine(doc: RawDoc, s: RawSeries): string | null {
    const hi = s.wins.higher;
    const lo = s.wins.lower;
    if (hi === 0 && lo === 0) return null;
    const a = slotName(doc, s.higher);
    const b = slotName(doc, s.lower);
    const call = (x: typeof a) => (x.club && x.club.abbr ? x.club.abbr : x.name);
    const top = `${Math.max(hi, lo)}-${Math.min(hi, lo)}`;
    if (s.status === 'final') return `${call(hi > lo ? a : b)} won ${top}`;
    if (hi === lo) return `Series tied ${hi}-${lo}`;
    return `${call(hi > lo ? a : b)} leads ${top}`;
  }

  /**
   * Is a scheduled game played only if the series is still undecided when it
   * comes up? Not the document's flag, which is the format's: a game is
   * conditional while the side ahead could clinch before it, even by winning
   * every game in between. A game in a decided series is never conditional.
   */
  function conditional(s: RawSeries, g: RawGame): boolean {
    if (g.status !== 'scheduled' || s.status === 'final') return false;
    const needed = Math.floor(s.bestOf / 2) + 1;
    const decided = s.wins.higher + s.wins.lower;
    const ahead = Math.max(s.wins.higher, s.wins.lower);
    const stillBefore = Math.max(0, g.gameNumber - 1 - decided);
    return ahead + stillBefore >= needed;
  }

  /** The text of one game row in a series panel, whole. */
  function gameRow(doc: RawDoc, s: RawSeries, g: RawGame): string {
    const home = g.homeSide ? slotName(doc, s[g.homeSide]) : null;
    const away = g.homeSide ? slotName(doc, s[g.homeSide === 'higher' ? 'lower' : 'higher']) : null;
    const out = [`G${g.gameNumber}`, whenOf(g)];
    if (home && home.club) out.push(home.club.park ? `Host: ${home.name} · ${home.club.park}` : `Host: ${home.name}`);
    if (g.status === 'final' && home && away && g.homeScore !== null && g.awayScore !== null) {
      const h = home.club?.abbr ?? home.name;
      const a = away.club?.abbr ?? away.name;
      out.push(`Final: ${g.homeScore >= g.awayScore ? `${h} ${g.homeScore}, ${a} ${g.awayScore}` : `${a} ${g.awayScore}, ${h} ${g.homeScore}`}`);
    } else if (g.status === 'live') out.push('Live');
    else if (g.status === 'scheduled') {
      if (conditional(s, g)) out.push('If necessary');
    } else if (g.status !== 'final') out.push(g.status[0].toUpperCase() + g.status.slice(1));
    return out.join(' ');
  }

  // ---- The page, and the version of the document it was built from ----
  //
  // The document changes about every ten minutes while games are played and
  // the pages regenerate every ten minutes, so a page is often one version
  // behind. Comparing it with the newest document would fail for a reason
  // that is not a defect. Instead every version of each document is kept as
  // it appears, and a page is compared with the version it names: the exact
  // change time in its JSON-LD, or the stamp on each card of the hub.
  const versions = new Map<League, Map<string, RawDoc>>(LEAGUES.map((l) => [l, new Map<string, RawDoc>()]));
  async function capture() {
    for (const l of LEAGUES) {
      const snap = await db.collection('postseasonBrackets').doc(`${l}_${SEASON}`).get();
      if (!snap.exists) continue;
      const d = snap.data() as RawDoc;
      const at = instantOf(d.lastChangedAt);
      if (at) (versions.get(l) as Map<string, RawDoc>).set(at.toISOString(), d);
      docs.set(l, d);
    }
  }
  function versionOf(league: League, html: string, where: 'league' | 'hub'): RawDoc | null {
    const seen = versions.get(league) as Map<string, RawDoc>;
    if (where === 'league') {
      const block = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Record<string, unknown>)[0];
      const iso = block && typeof block.dateModified === 'string' ? block.dateModified : null;
      return iso ? seen.get(iso) ?? null : null;
    }
    const card = textOf(element(domOf(html), `data-league-card="${league}"`) ?? '');
    for (const [iso, d] of seen) if (card.includes(`Bracket updated ${etStamp(new Date(iso))}`)) return d;
    return null;
  }
  let waited = 0;
  async function fresh(path: string, league: League | null): Promise<{ html: string; status: number; headers: Headers; fetchedAt: Date; built: Map<League, RawDoc>; lag: string }> {
    const want = league ? [league] : [...LEAGUES];
    let last = await get(path);
    for (let attempt = 0; attempt < 45; attempt++) {
      await capture();
      const built = new Map<League, RawDoc>();
      for (const l of want) {
        const d = versionOf(l, last.body, league ? 'league' : 'hub');
        if (d) built.set(l, d);
      }
      if (last.status !== 200 || built.size === want.length) {
        const lag = want
          .map((l) => {
            const page = instantOf(built.get(l)?.lastChangedAt);
            const now = instantOf(docs.get(l)?.lastChangedAt);
            return page && now ? `${l} ${page.getTime() === now.getTime() ? 'current' : `${Math.round((now.getTime() - page.getTime()) / 60000)} min behind the document`}` : `${l} unknown`;
          })
          .join(', ');
        return { html: last.body, status: last.status, headers: last.headers, fetchedAt: last.fetchedAt, built, lag };
      }
      if (attempt === 0) console.log(`      ${path}: built from a version of the document older than any read in this run; asking again until it regenerates`);
      await sleep(20000);
      waited += 20;
      last = await get(path);
    }
    return { html: last.body, status: last.status, headers: last.headers, fetchedAt: last.fetchedAt, built: new Map(), lag: 'never matched' };
  }

  function save(path: string, html: string) {
    if (OUT) writeFileSync(join(OUT, `${path.replace(/^\//, '').replace(/\//g, '_') || 'home'}.html`), html);
  }

  // ---- What no page may carry ----
  function leaks(where: string, html: string) {
    const shape = keyIn(html);
    check(`${where}: no series key by shape, anywhere in the response`, shape === null, shape ?? `${html.length} bytes scanned`);
    const literal: string[] = [];
    const values: string[] = [];
    for (const d of docs.values()) {
      for (const s of d.series) {
        if (new RegExp(`(?<![A-Za-z0-9-])${s.seriesKey}(?![A-Za-z0-9-])`).test(html)) literal.push(s.seriesKey);
        for (const g of s.games) if (g.gameId && new RegExp(`(?<![0-9])${g.gameId}(?![0-9])`).test(html)) values.push(`gameId ${g.gameId}`);
      }
      for (const k of ['runId', 'bracketSha256', 'validatedSeedSha256', 'lastRevalidatedSha256']) {
        const v = d[k];
        if (typeof v === 'string' && v.length >= 8 && html.includes(v)) values.push(k);
      }
    }
    check(`${where}: no series key of either document, literally`, literal.length === 0, literal.join(' '));
    check(`${where}: no game id, run id or hash from either document`, values.length === 0, values.join(' '));
    const predLeaks: string[] = [];
    for (const p of preds.values()) for (const v of predBanned(p)) if (html.includes(v)) predLeaks.push(v.slice(0, 16));
    check(`${where}: no operator value, path, blob, commit or other hash from either predicted document`, predLeaks.length === 0, predLeaks.join(' '));
    const predFields = ['pickProbability', 'modalSeriesLength', 'runsSupporting', 'coreFiles', 'engineFiles', 'seedFile', 'computedBy', 'frozenBy', 'reviewedSha256', 'corpusSha256', 'simSeed'].filter((f) => html.includes(f));
    check(`${where}: no predicted-document field name`, predFields.length === 0, predFields.join(' '));
    const fields = ['operatorLog', 'runId', 'validatedSeedSha256', 'bracketSha256', 'lastRevalidatedSha256', 'writerVersion', 'feederSeriesKey', 'lastFetchedAt', 'unplaced', 'ticketmasterAttractionId', 'ticketmasterSlug', 'fanaticsUrl', 'fanaticsPath'].filter((f) => html.includes(f));
    check(`${where}: no operator or team-record field name`, fields.length === 0, fields.join(' '));
  }

  function head(where: string, html: string, want: { title: string; description: string; canonical: string }) {
    same(`${where}: <title>`, decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? ''), `${want.title} | PromoNight`);
    same(`${where}: titles in the document`, count(html, '<title>'), 1);
    same(`${where}: meta description`, meta(html, 'name', 'description'), want.description);
    same(`${where}: canonical`, /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null, want.canonical);
    same(`${where}: canonical links in the document`, count(html, 'rel="canonical"'), 1);
    same(`${where}: og:url`, meta(html, 'property', 'og:url'), want.canonical);
    same(`${where}: og:title`, meta(html, 'property', 'og:title'), `${want.title} | PromoNight`);
    same(`${where}: og:description`, meta(html, 'property', 'og:description'), want.description);
    same(`${where}: og:image`, meta(html, 'property', 'og:image'), `${SITE}/og-image.png`);
    same(`${where}: og:image:alt`, meta(html, 'property', 'og:image:alt'), OG_IMAGE_ALT);
    same(`${where}: og:image tags`, count(html, 'property="og:image"'), 1);
    const robots = meta(html, 'name', 'robots');
    check(`${where}: no noindex in the markup`, !robots || !/noindex/i.test(robots), robots ?? 'no robots meta');
  }

  function jsonLd(where: string, html: string, want: { title: string; description: string; canonical: string; crumbs: string[]; modified: string | null }) {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
    same(`${where}: JSON-LD types`, blocks.map((b) => b['@type']).join(' '), 'WebPage BreadcrumbList');
    const page = blocks[0] ?? {};
    same(`${where}: JSON-LD WebPage url`, page.url, want.canonical);
    same(`${where}: JSON-LD WebPage name`, page.name, want.title);
    same(`${where}: JSON-LD WebPage description`, page.description, want.description);
    same(`${where}: JSON-LD dateModified is the document's change time`, page.dateModified ?? null, want.modified);
    const items = ((blocks[1] ?? {}).itemListElement ?? []) as { name: string; item: string; position: number }[];
    same(`${where}: breadcrumb`, items.map((i) => `${i.position} ${i.name} ${i.item}`).join(' | '), want.crumbs.map((c, i) => `${i + 1} ${c}`).join(' | '));
    const all = JSON.stringify(blocks);
    check(`${where}: no Event markup`, !/"@type":"[A-Za-z]*Event"/.test(html) && !/startDate|"location"|"offers"/.test(all));
  }

  function article(where: string, html: string, kind: 'league' | 'hub'): string {
    const dom = domOf(html);
    same(`${where}: <article> elements`, count(dom, '<article'), 1);
    same(`${where}: the article's opening tag`, /<article[^>]*>/.exec(dom)?.[0] ?? null, `<article class="page-content" data-ad-region="content" data-playoffs-article="${kind}">`);
    same(`${where}: elements with the page-content class`, (dom.match(/class="[^"]*\bpage-content\b[^"]*"/g) ?? []).length, 1);
    same(`${where}: data-ad-region attributes`, count(dom, 'data-ad-region='), 1);
    same(`${where}: <aside> elements`, count(dom, '<aside'), 0);
    const el = element(dom, 'data-playoffs-article=') ?? '';
    same(`${where}: <h1> in the document, and it is inside the article`, `${count(dom, '<h1')} ${count(el, '<h1')}`, '1 1');
    check(`${where}: the footer notes and the disclosure are outside the article`, !el.includes('<footer') && !/may earn a commission/i.test(textOf(el)));
    const text = textOf(el);
    check(`${where}: no dash in the article`, !/[\u2014\u2013]/.test(text));
    const stale = /\b(hourly|real[- ]time|up to the minute|updated live|live scores?)\b/i.exec(text);
    check(`${where}: no freshness claim`, !stale, stale ? stale[0] : '');
    return el;
  }

  // ---- The PromoNight Predicts bracket, derived from the raw documents ----
  //
  // The NCAA rule, written again here from the brief, not imported: a pick is
  // correct when its club won the real slot, busted when the real slot went
  // the other way or its club was knocked out earlier, alive otherwise. Only
  // decided slots count. A predicted matchup that can no longer happen is
  // dimmed.
  function winnerOf(doc: RawDoc, s: RawSeries): string | null {
    if (s.status !== 'final' || !s.winner) return null;
    if (s.winner === 'higher' || s.winner === 'lower') return slotName(doc, s[s.winner]).slug;
    return s.winner;
  }
  function eliminated(doc: RawDoc): Set<string> {
    const out = new Set<string>();
    for (const s of doc.series) {
      const w = winnerOf(doc, s);
      if (!w) continue;
      for (const side of [s.higher, s.lower]) {
        const slug = slotName(doc, side).slug;
        if (slug && slug !== w) out.add(slug);
      }
    }
    return out;
  }
  type Mark = { id: string; outcome: string; decided: boolean; dimmed: boolean; pick: RawPick };
  function score(doc: RawDoc, p: RawPred): { marks: Mark[]; correct: number; decided: number; alive: number; champion: string } {
    const out = eliminated(doc);
    const pageIds = ids(doc);
    const marks: Mark[] = p.rounds.map((r) => {
      const i = doc.series.findIndex((s) => s.seriesKey === r.seriesKey);
      const s = doc.series[i];
      const w = winnerOf(doc, s);
      const decided = w !== null;
      const outcome = decided ? (w === r.pick ? 'correct' : 'busted') : out.has(r.pick) ? 'busted' : 'alive';
      const real = [slotName(doc, s.higher).slug, slotName(doc, s.lower).slug].filter((x): x is string => !!x);
      const pair = [r.higher, r.lower];
      const dimmed = decided ? !(real.length === 2 && pair.every((x) => real.includes(x))) : pair.some((x) => out.has(x)) || real.some((x) => !pair.includes(x));
      return { id: pageIds[i], outcome, decided, dimmed, pick: r };
    });
    const last = marks[marks.length - 1];
    const champion = last.decided ? (last.outcome === 'correct' && last.pick.pick === p.champion ? 'won the title' : 'eliminated') : out.has(p.champion) ? 'eliminated' : 'still alive';
    return {
      marks,
      correct: marks.filter((m) => m.decided && m.outcome === 'correct').length,
      decided: marks.filter((m) => m.decided).length,
      alive: marks.filter((m) => m.outcome === 'alive').length,
      champion,
    };
  }

  /** The upcoming playoff games lists, from the raw documents (ruling of
   *  2026-10-02): every scheduled game of an unfinished series with a club
   *  hosting and a known date, today to six days on (Eastern), a timed one
   *  only until its start; soonest first, a game with no time after the
   *  timed ones of its day; the short list is the first eight within three
   *  days, the rest is behind "Show N more games". */
  function expectedGames(docs: [League, RawDoc][], at: Date): { primary: string[]; rest: string[] } {
    const today = etYmd(at);
    const plus = (n: number) => new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + n, 12)).toISOString().slice(0, 10);
    const clock = (d: Date) => { const p = parts(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); return `${p.hour}:${p.minute}`; };
    const rows: { key: string; day: string; sort: string }[] = [];
    for (const [league, doc] of docs) {
      const pid = ids(doc);
      doc.series.forEach((s, i) => {
        if (s.status === 'final') return;
        for (const g of s.games) {
          if (g.status !== 'scheduled' || !g.homeSide || !slotName(doc, s[g.homeSide]).club) continue;
          const timed = !g.startTimeTBD && typeof g.start === 'string' && /T\d\d:\d\d/.test(g.start);
          const day = timed ? etYmd(new Date(g.start as string)) : g.date;
          if (!day || day < today || day > plus(6)) continue;
          if (timed && Date.parse(g.start as string) < at.getTime()) continue;
          rows.push({ key: `${league}-${pid[i]}-g${g.gameNumber}`, day, sort: timed ? `${day}T${clock(new Date(g.start as string))}` : `${day}T99` });
        }
      });
    }
    rows.sort((a, b) => (a.sort !== b.sort ? (a.sort < b.sort ? -1 : 1) : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const primary = rows.filter((r) => r.day <= plus(2)).slice(0, 8).map((r) => r.key);
    return { primary, rest: rows.map((r) => r.key).filter((k) => !primary.includes(k)) };
  }
  /** The served lists and button, as keys and text. */
  function servedGames(el: string): { primary: string[]; rest: string[]; button: string | null } {
    const keysIn = (m: string) => [...(element(el, m) ?? '').matchAll(/data-home-game="([^"]+)"/g)].map((x) => x[1]);
    const btn = /<button[^>]*data-show-all="[^"]*"[^>]*>([^<]*)<\/button>/.exec(element(el, 'data-home-games=') ?? '');
    return { primary: keysIn('data-home-games-list="primary"'), rest: keysIn('data-home-games-list="rest"'), button: btn ? btn[1] : null };
  }
  function gamesMatch(where: string, el: string, docs: [League, RawDoc][], window: Date[]) {
    const got = servedGames(el);
    const wants = valuesIn(window, docs.map((d) => d[1]), (at) => expectedGames(docs, at));
    const ok = wants.some((w) => JSON.stringify(w.primary) === JSON.stringify(got.primary) && JSON.stringify(w.rest) === JSON.stringify(got.rest));
    check(`${where}: the games lists are every dated upcoming game in the document, in order, eight at most in three days, the rest of the week behind the button`, ok, ok ? `${got.primary.length} + ${got.rest.length}` : `served ${got.primary.join(',')} | ${got.rest.join(',')}; expected ${wants[0].primary.join(',')} | ${wants[0].rest.join(',')}`);
    const n = got.rest.length;
    check(`${where}: the button reads "Show N more games" for the rows behind it, and is absent with none`, n === 0 ? got.button === null : got.button === `Show ${n} more ${n === 1 ? 'game' : 'games'}`, got.button ?? 'no button');
  }

  /** "Where things stand" from the raw document, independently of the page's
   *  code: the champion, the round being played, or the next round. */
  function standingWant(doc: RawDoc, now: Date): string | null {
    const order: string[] = [];
    for (const s of doc.series) if (!order.includes(s.round)) order.push(s.round);
    const of = (r: string) => doc.series.filter((s) => s.round === r);
    const label = (r: string) => of(r)[0].roundLabel;
    const winnerOf = (s: RawSeries) => (s.winner === 'higher' || s.winner === 'lower' ? s[s.winner] : [s.higher, s.lower].find((x) => x.slug === s.winner) ?? null);
    const last = order[order.length - 1];
    const open = order.find((r) => of(r).some((s) => s.status !== 'final'));
    if (!open) {
      const d = of(last);
      if (d.length !== 1) return null;
      const w = winnerOf(d[0]);
      if (!w) return null;
      const l = w === d[0].higher ? d[0].lower : d[0].higher;
      const ww = w === d[0].higher ? d[0].wins.higher : d[0].wins.lower;
      const lw = w === d[0].higher ? d[0].wins.lower : d[0].wins.higher;
      const W = slotName(doc, w).club;
      const L = slotName(doc, l).club;
      return W && L ? `The ${W.full} won the ${doc.season} ${label(last)}, beating the ${L.full} ${ww}-${lw}.` : null;
    }
    const started = (s: RawSeries) => s.status !== 'upcoming' || s.wins.higher + s.wins.lower > 0 || s.games.some((g) => g.status === 'final' || g.status === 'live');
    const at = order.indexOf(open);
    const played = order.filter((r, i) => i >= at && of(r).some(started));
    // The next game, derived differently from the page on purpose: every
    // unplayed game of an unfinished series in the rounds concerned is put in
    // one list sorted by Eastern day, then start, a game with no time first
    // on its day (an undated one first of all where the round is being
    // played; ignored in a later round). The head of the list is named only
    // when it is a scheduled game, timed and ahead of the clock, in a round
    // being played (or about to open), alone at its moment, with no
    // lower-numbered game of its series unplayed, and every unfinished
    // series of those rounds lists a game.
    const unplayed = new Set(['scheduled', 'postponed', 'suspended']);
    const sureNext = (sure: RawSeries[], later: RawSeries[]) => {
      type Item = { s: RawSeries; g: RawGame; sure: boolean; day: string; at: string };
      const list: Item[] = [];
      for (const [group, isSure] of [[sure, true], [later, false]] as const) {
        for (const s of group) {
          if (s.status === 'final') continue;
          const left = s.games.filter((g) => unplayed.has(g.status));
          if (isSure && !left.length && !s.games.some((g) => g.status === 'live')) return null;
          for (const g of left) {
            // A start is a time only when it is an instant; a bare date is untimed.
            const timed = !g.startTimeTBD && typeof g.start === 'string' && /T\d\d:\d\d/.test(g.start);
            const day = timed ? etYmd(new Date(g.start as string)) : g.date ?? (isSure ? '' : null);
            if (day === null) continue;
            list.push({ s, g, sure: isSure, day, at: timed ? new Date(g.start as string).toISOString() : '' });
          }
        }
      }
      list.sort((x, y) => (x.day + ' ' + x.at < y.day + ' ' + y.at ? -1 : x.day + ' ' + x.at > y.day + ' ' + y.at ? 1 : 0));
      const [head, second] = list;
      if (!head || !head.sure || head.g.status !== 'scheduled' || !head.at || Date.parse(head.at) < now.getTime()) return null;
      if (second && second.day === head.day && second.at === head.at) return null;
      if (head.s.games.some((g) => g.gameNumber < head.g.gameNumber && unplayed.has(g.status))) return null;
      return { s: head.s, g: head.g };
    };
    const singular = new Set(['Liberty', 'Dream', 'Fever', 'Lynx', 'Mercury', 'Sky', 'Storm', 'Sun', 'Tempo', 'Fire']);
    const gameText = (s: RawSeries, g: RawGame) => {
      const home = g.homeSide ? slotName(doc, s[g.homeSide]).name : null;
      const away = g.homeSide ? slotName(doc, s[g.homeSide === 'higher' ? 'lower' : 'higher']).name : null;
      const matchup = home && away ? `${away} at ${home}` : `${slotName(doc, s.lower).name} vs ${slotName(doc, s.higher).name}`;
      const t = new Date(g.start as string);
      return `Game ${g.gameNumber}, ${matchup}, ${etDay(t)}, ${etTime(t)}`;
    };
    const laterThan = (i: number, skip: string[]) => order.filter((r, k) => k >= i && !skip.includes(r)).flatMap(of);
    if (played.length === 0) {
      const f = sureNext(of(open), laterThan(at + 1, []));
      return f ? `Next round: ${label(open)}. It opens with ${gameText(f.s, f.g)}.` : `Next round: ${label(open)}.`;
    }
    const parts: string[] = [];
    for (const r of played) {
      const clauses: string[] = [];
      let unset = 0;
      // The page groups a round by conference, in order of first appearance.
      const confs = [...new Set(of(r).map((s) => s.conference))];
      for (const s of confs.flatMap((c) => of(r).filter((x) => x.conference === c))) {
        const a = slotName(doc, s.higher);
        const b = slotName(doc, s.lower);
        if (!a.club && !b.club) { unset++; continue; }
        if (!a.club || !b.club) {
          const c = (a.club ? a : b);
          const other = a.club ? b : a;
          if (s.wins.higher + s.wins.lower > 0 || s.status === 'final') return null;
          clauses.push(`the ${c.name} ${singular.has(c.name) ? 'awaits' : 'await'} ${other.name.endsWith(' winner') ? `the ${other.name}` : 'an opponent'}`);
          continue;
        }
        const hi = s.wins.higher;
        const lo = s.wins.lower;
        if (s.status === 'final') {
          const w = winnerOf(s);
          if (!w) return null;
          clauses.push(w === s.higher ? `the ${a.name} beat the ${b.name} ${hi}-${lo}` : `the ${b.name} beat the ${a.name} ${lo}-${hi}`);
        } else if (hi === lo) clauses.push(hi === 0 ? `the ${a.name} and the ${b.name} have not completed a game` : `the ${a.name} and the ${b.name} are tied ${hi}-${lo}`);
        else {
          const [w, l, x, y] = hi > lo ? [a.name, b.name, hi, lo] : [b.name, a.name, lo, hi];
          clauses.push(`the ${w} ${singular.has(w) ? 'leads' : 'lead'} the ${l} ${x}-${y}`);
        }
      }
      if (clauses.length === 0) return null;
      if (unset > 0) clauses.push(unset === 1 ? 'one matchup is to be set' : `${unset} matchups are to be set`);
      parts.push(`${label(r)}: ${clauses.join('; ')}.`);
    }
    const f = sureNext(played.flatMap(of), laterThan(at, played));
    return f ? `${parts.join(' ')} Next game: ${gameText(f.s, f.g)}.` : parts.join(' ');
  }

  async function predictionsOnPage(where: string, html: string, el: string, league: League, doc: RawDoc, p: RawPred) {
    const section = element(el, 'data-predictions="bracket"');
    check(`${where}: the predictions section is on the page, with its anchor`, !!section && section.includes('id="predictions"'));
    if (!section) return;
    // PROMONIGHT PREDICTS. The brand on the section and the labels, in the
    // served DOM; and no "computer" anywhere in the served bytes, the RSC
    // payload included.
    const st = textOf(section);
    check(`${where}: the section heading is "PromoNight Predicts"`, textOf(element(section, 'id="predictions-heading"') ?? '') === 'PromoNight Predicts');
    const details = elements(section, 'data-pick-detail');
    check(`${where}: every pick says "PromoNight's pick:"`, details.length === p.rounds.length && details.every((d) => textOf(d).startsWith("PromoNight's pick:")), `${details.length} picks`);
    check(`${where}: the scorecard says "Predicted champion" and "PromoNight Predicts is" or "No series decided yet"`, st.includes('Predicted champion') && /PromoNight Predicts is \d+ for \d+|No series decided yet/.test(st));
    check(`${where}: the methodology link says "How PromoNight Predicts works" and reaches the section`, section.includes(`href="#${METHODOLOGY_SECTION_ID}"`) && st.includes('How PromoNight Predicts works') && el.includes(`id="${METHODOLOGY_SECTION_ID}"`));
    const comp = /computer/i.exec(html);
    check(`${where}: no "computer" anywhere in the served bytes`, !comp, comp ? html.slice(Math.max(0, comp.index - 40), comp.index + 40) : '');
    check(`${where}: no "publish soon" placeholder`, !/publish soon/i.test(html));
    // Plain percentage labels (WEB4 addendum): no "at lock" label anywhere
    // in the section, and each pick's detail says "{n}% to win series" from
    // the stored chance (or "a coin flip").
    check(`${where}: no "at lock" label in the predictions section`, !/\bat lock\b/i.test(st), (/.{30}\bat lock\b.{10}/i.exec(st) ?? [''])[0]);
    // textOf puts a space where a tag closed ("in 2 , 58%"), so the comma is
    // normalised; each detail is matched to its pick by its own position.
    const detailText = details.map((x) => textOf(x).replace(/\s+,/g, ','));
    const pctWrong = p.rounds.filter((r, i) => {
      const n = Math.round(r.pickProbability * 100);
      const label = n < 1 ? 'Under 1%' : n > 99 ? 'Over 99%' : `${n}%`;
      const want = `PromoNight's pick: ${clubs.get(r.pick)?.full ?? r.pick} in ${r.modalSeriesLength}, ${r.coinFlip ? 'a coin flip.' : `${label} to win series.`}`;
      return !detailText.some((d) => d.startsWith(want)) || !detailText[i];
    });
    check(`${where}: every pick's detail reads "{n}% to win series" from the stored chance, or "a coin flip"`, pctWrong.length === 0, pctWrong.map((r) => r.pick).join(' '));
    const sc = score(doc, p);
    const wrong: string[] = [];
    for (const m of sc.marks) {
      const li = element(section, `data-pick="${m.id}"`) ?? '';
      const t = textOf(li);
      const nick = clubs.get(m.pick.pick)?.name ?? m.pick.pick;
      const chance = m.pick.coinFlip ? 'Coin flip' : `${Math.round(m.pick.pickProbability * 100)}%`;
      const ok =
        li.includes(`data-pick-outcome="${m.outcome}" data-pick-decided="${m.decided}" data-dimmed="${m.dimmed}"`) &&
        t.includes(`${nick} in ${m.pick.modalSeriesLength} · ${chance}`) &&
        (m.dimmed ? /<details[^>]*opacity-55/.test(li) : !/opacity-55/.test(li));
      if (!ok) wrong.push(`${m.id} want ${m.outcome}/${m.decided}/${m.dimmed} ${nick} ${chance}`);
    }
    check(`${where}: every pick carries the mark the scoring rule gives it, its length and its chance`, wrong.length === 0 && sc.marks.length === doc.series.length, wrong.slice(0, 3).join('; ') || `${sc.marks.length} picks`);
    const card = textOf(element(section, 'data-predictions-scorecard') ?? '');
    const champ = clubs.get(p.champion)?.full ?? p.champion;
    const record = sc.decided === 0 ? 'No series decided yet' : `PromoNight Predicts is ${sc.correct} for ${sc.decided}`;
    check(`${where}: scorecard`, card.includes(record) && card.includes(`${sc.alive} ${sc.alive === 1 ? 'pick' : 'picks'} still alive`) && card.includes(`${champ}, ${sc.champion}`), card);
    const odds = [...p.titleOdds].sort((a, b) => b.odds - a.odds).slice(0, 8);
    const oddsText = textOf(element(section, 'data-title-odds') ?? '');
    const pct = (x: number) => (Math.round(x * 100) < 1 ? 'Under 1%' : `${Math.round(x * 100)}%`);
    check(`${where}: title odds, top eight, each a plain percentage to win the title`, oddsText.startsWith('Title odds') && odds.every((o) => oddsText.includes(`${clubs.get(o.slug)?.full ?? o.slug} ${pct(o.odds)} to win title`)) && count(element(section, 'data-title-odds') ?? '', '<tr') === 9, oddsText.slice(0, 120));

    // The methodology: dates from the stored instants in Eastern, nothing else.
    const method = element(el, 'data-predictions-methodology');
    check(`${where}: methodology section`, !!method);
    if (!method) return;
    const mt = textOf(method);
    const frozen = new Date(p.provenance.frozenAt as string);
    const first = doc.series.flatMap((s) => s.games).every((g) => (g.start ? new Date(g.start).getTime() > frozen.getTime() : g.date ? g.date > etYmd(frozen) : true)) && doc.series.some((s) => s.games.some((g) => g.start || g.date));
    check(`${where}: methodology says when the inputs were locked`, mt.includes(`The inputs were locked on ${longEt(frozen)}${first ? ', before Game 1' : ''}.`), longEt(frozen));
    const computedOn = longEt(new Date(p.computedAt));
    const lockedOn = longEt(instantOf(p.lockedAt as unknown) as Date);
    const when = computedOn === lockedOn ? `computed from those locked inputs and locked on ${computedOn}` : `computed from those locked inputs on ${computedOn} and locked on ${lockedOn}`;
    check(`${where}: methodology says when the bracket was computed and locked, that it is written once, and that the seed is fixed`, mt.includes(`The bracket was ${when}. The locked bracket is written once and never changed, and the simulation runs from a fixed seed, so the same inputs always give the same bracket. The rating, simulation and bracket code is unchanged since the inputs were locked.`) && !/\b(computed|run|ran|calculated|simulated) (only )?(once|one time|a single time)\b|\b(not been|never( been)?) re-?(computed|run|calculated)\b|\bre-?run\b/i.test(mt), when);
    check(`${where}: methodology says it is a simulation, not a staff pick`, mt.includes('PromoNight Predicts is a simulation, not a staff pick.') && mt.includes('The simulation then plays out the postseason'));
    check(`${where}: methodology says what "at lock" means and why a pick can name a club already out`, mt.includes('Every percentage on this page is as it stood when the bracket was locked.') && mt.includes('Postseason results are not among the inputs, so a pick can name a club that was already out by then.'));
    check(`${where}: methodology states the length as the engine computes it`, mt.includes('its length is how many games the pick most often took to win it') && !/most common length|engine( code)? (is |has )?(not changed|unchanged|never changed)/i.test(mt));
    check(`${where}: methodology names ${p.simRuns.toLocaleString('en-US')} simulated postseasons`, mt.includes(`plays out the postseason ${p.simRuns.toLocaleString('en-US')} times`));
    check(`${where}: the backtest, and no other accuracy claim`, mt.includes(BACKTEST[league]) && (mt.match(/\b\d+ of \d+\b/g) ?? []).length === 1 && !/\b(accura\w*|correct\w*|hit rate|record)\b/i.test(mt), BACKTEST[league]);
    check(`${where}: never says the bracket was set before Game 1`, !/(bracket|picks?) (was|were) (locked|set|picked|computed|made)[^.]*before (Game 1|the first (pitch|game|tip)|the postseason)/i.test(mt));

    // TWO LAYERS (WEB4, 2026-10-02). Visible: the summary, from lockedAt in
    // Eastern, and the backtest. Everything else in one native <details>
    // with no `open` attribute, in the served HTML. The summary never says
    // "before Game 1": the bracket was locked after it in both leagues.
    const detail = element(method, 'data-methodology-detail') ?? '';
    const opening = detail.slice(0, detail.indexOf('>') + 1);
    check(`${where}: methodology detail is one native <details>, collapsed by default`, /^<details\b/.test(opening) && !/\sopen(=|\s|>)/.test(opening) && count(method, '<details') === 1, opening.slice(0, 80));
    check(`${where}: the detail's summary reads "How the picks were locked"`, /<summary\b[^>]*>[\s\S]*How the picks were locked<\/summary>/.test(detail));
    const visible = method.replace(detail, '');
    const summaryText = textOf(element(visible, 'data-methodology-summary') ?? '');
    same(`${where}: visible summary, dated by the bracket's own lockedAt`, summaryText, `PromoNight's picks were locked on ${lockedOn} from regular-season results only. They never change.`);
    check(`${where}: the summary never says "before Game 1"`, summaryText.length > 0 && !/Game 1|before the (first|postseason)/i.test(summaryText), summaryText);
    check(`${where}: the backtest is visible, outside the detail`, textOf(element(visible, 'data-backtest') ?? '') === BACKTEST[league] && !detail.includes('data-backtest'));
    check(`${where}: the method, dates and fingerprints are inside the detail`, textOf(detail).includes('PromoNight Predicts is a simulation, not a staff pick.') && detail.includes('data-locked-on') && detail.includes('data-fingerprints') && fingerprints(p).every((f) => count(detail, f) === 1));
    check(`${where}: no ad markup inside the detail`, !/adthrive|raptive|data-ad-|page-content/i.test(detail));
    const titleOdd = /\btitle odd\b/i.exec(html);
    check(`${where}: "title odd" nowhere in the served bytes`, !titleOdd, titleOdd ? html.slice(Math.max(0, titleOdd.index - 40), titleOdd.index + 40) : '');

    // THE FINGERPRINT RULE. Each of the five appears in the served bytes
    // exactly twice: once in the methodology section's markup, and once in
    // the RSC payload's copy of that same markup. In the payload it must be
    // the text of a host <code> inside the methodology section with no client
    // component above it, found by walking the payload as a tree from its
    // root (fingerprintPlacement in ./flight.ts).
    const dom = domOf(html);
    const domMethod = element(dom, 'data-predictions-methodology') ?? '';
    const placement = await fingerprintPlacement(html);
    const bad: string[] = [];
    for (const f of fingerprints(p)) {
      const inDom = count(dom, f);
      const inMethod = count(domMethod, f);
      const total = count(html, f);
      const where2 = await placement(f);
      const clean = inDom === 1 && inMethod === 1 && total === 2 && where2.ok;
      if (!clean) bad.push(`${f.slice(0, 8)} dom ${inDom} method ${inMethod} total ${total} payload ${where2.detail}`);
    }
    check(`${where}: the five fingerprints only in the methodology section and its RSC payload copy, labeled`, bad.length === 0 && mt.includes('Fingerprints'), bad.join('; ') || 'dom 1, payload 1, each');
    const outsideDom = dom.replace(domMethod, '');
    const other = /\b[0-9a-f]{40,}\b/.exec(outsideDom);
    check(`${where}: no hash in the page outside the methodology`, !other, other ? other[0].slice(0, 16) : '');
  }

  // ---- The league pages ----
  for (const league of LEAGUES) {
    const path = `/playoffs/${league.toLowerCase()}`;
    const where = path;
    const got = await fresh(path, league);
    save(path, got.html);
    same(`${where}: status`, got.status, 200);
    const doc = got.built.get(league);
    check(`${where}: the page names a version of the document that was read in this run`, !!doc, got.lag);
    if (!doc || got.status !== 200) continue;
    const changed = instantOf(doc.lastChangedAt);
    const open = currentRound(doc);
    check(`${where}: the document has a series being played`, open !== null, open ? open.roundLabel : 'all final');
    const pred = DISABLED.has(league) ? null : preds.get(league) ?? null;
    const description = open
      ? pred
        ? `The ${SEASON} ${league} postseason bracket, with a simulation's locked pick for every series, marked against the results. Current round: ${open.roundLabel}.`
        : `The ${SEASON} ${league} postseason bracket. Current round: ${open.roundLabel}. Every series, seed and result, with game times in Eastern and the upcoming playoff games.`
      : '(concluded: checked by hand)';
    const want = {
      title: pred ? `${SEASON} ${league} Playoffs: Bracket, Schedule and Predictions` : `${SEASON} ${league} Playoffs: Bracket and Schedule`,
      description,
      canonical: `${SITE}${path}`,
    };
    head(where, got.html, want);
    jsonLd(where, got.html, { ...want, crumbs: [`Home ${SITE}`, `Playoffs ${SITE}/playoffs`, `${league} ${SITE}${path}`], modified: changed ? changed.toISOString() : null });
    const el = article(where, got.html, 'league');
    leaks(where, got.html);
    if (pred) await predictionsOnPage(where, got.html, el, league, doc, pred);
    if (DISABLED.has(league)) {
      const traces = ['id="predictions"', 'data-predictions', 'data-pick', 'po-picks', METHODOLOGY_SECTION_ID, 'Title odds', 'Fingerprints', 'PromoNight Predicts', "PromoNight's", 'PromoNight&#x27;s', 'Predicted champion'].filter((m) => got.html.includes(m));
      check(`${where}: FORCED FAILURE: no predictions section, heading, card or methodology`, traces.length === 0, traces.join(' '));
      check(`${where}: FORCED FAILURE: no hash anywhere`, !/\b[0-9a-f]{40,}\b/.test(domOf(got.html)) && !fingerprints(preds.get(league) as RawPred).some((f) => got.html.includes(f)));
      // See operatorText in ./flight.ts for where it looks and why.
      const said = await operatorText(got.html);
      check(`${where}: FORCED FAILURE: nothing operator-facing in the served HTML`, !said, said ?? '');
    }

    const text = textOf(el);
    if (changed) check(`${where}: change stamp`, text.includes(`Bracket updated ${etStamp(changed)}`), `Bracket updated ${etStamp(changed)}`);
    check(`${where}: heading`, textOf(element(el, '<h1') ?? '') === `${SEASON} ${league} Playoffs`, textOf(element(el, '<h1') ?? ''));

    const pageIds = ids(doc);
    const cards = elements(el, 'data-series-status=');
    const panels = elements(el, 'data-series-panel=');
    same(`${where}: series cards`, cards.length, doc.series.length);
    same(`${where}: series panels`, panels.length, doc.series.length);
    let rows = 0;
    let rowsRight = 0;
    const wrong: string[] = [];
    doc.series.forEach((s, i) => {
      const id = pageIds[i];
      const a = slotName(doc, s.higher);
      const b = slotName(doc, s.lower);
      const line = scoreLine(doc, s);

      // The card in the bracket.
      const card = cards.find((c) => c.includes(`data-series="${id}"`)) ?? '';
      const cardText = textOf(card);
      const cardWant = [
        /data-series-status="([^"]*)"/.exec(card)?.[1] === s.status,
        cardText.includes(`${s.roundLabel}: ${a.name} vs ${b.name}`),
        cardText.includes(`Best of ${s.bestOf}`),
        typeof s.higher.seed === 'number' && a.club ? cardText.includes(`Seed ${s.higher.seed} ${a.name}`) : true,
        typeof s.lower.seed === 'number' && b.club ? cardText.includes(`Seed ${s.lower.seed} ${b.name}`) : true,
        line ? cardText.includes(line) : !/\b(leads|tied|won)\b/.test(cardText),
        // Win counts appear once the series has started, which at 0-0 means
        // a first game in progress.
        s.status !== 'upcoming' ? cardText.includes(`${s.wins.higher} ${s.wins.higher === 1 ? 'win' : 'wins'}`) && cardText.includes(`${s.wins.lower} ${s.wins.lower === 1 ? 'win' : 'wins'}`) : !/\d+ wins?\b/.test(cardText),
        new RegExp(`href="#${id}"`).test(card),
      ];
      if (cardWant.includes(false)) wrong.push(`card ${id} [${cardWant.map((x) => (x ? '.' : 'X')).join('')}] ${cardText.slice(0, 160)}`);

      // The panel with its games.
      const panel = panels.find((p) => p.includes(`data-series-panel="${id}"`)) ?? '';
      const panelText = textOf(panel);
      const panelWant = [
        panelText.startsWith(`${s.roundLabel}${s.conference ? ` · ${s.conference}` : ''} ${a.name} vs ${b.name} Best of ${s.bestOf}`),
        line ? panelText.includes(line) : !/\b(leads|tied|won)\b/.test(panelText),
        new RegExp(`<section id="${id}"`).test(panel),
      ];
      if (panelWant.includes(false)) wrong.push(`panel ${id} [${panelWant.map((x) => (x ? '.' : 'X')).join('')}] ${panelText.slice(0, 160)}`);
      for (const c of [a, b]) {
        if (c.club && c.slug) {
          const link = new RegExp(`<a[^>]*data-club-link="${c.slug}"[^>]*>`).exec(panel)?.[0] ?? '';
          const sport = league.toLowerCase();
          if (!link.includes(`href="/${sport}/${c.slug}"`) || !panelText.includes(`${c.club.full} promotions`)) wrong.push(`club link ${id} ${c.slug}`);
        }
      }
      const served = elements(panel, 'data-game=');
      if (served.length !== s.games.length) wrong.push(`games ${id}: served ${served.length}, document ${s.games.length}`);
      s.games.forEach((g, k) => {
        rows += 1;
        const row = served[k] ?? '';
        const wantRow = gameRow(doc, s, g);
        // The promotion line, when there is one, is checked on its own below.
        const promoEl = element(row, 'data-game-promo=');
        const gotRow = textOf(promoEl ? row.replace(promoEl, '') : row);
        const home = g.homeSide ? slotName(doc, s[g.homeSide]) : null;
        const parkOk = home && home.club && home.club.park && home.club.venuePath ? row.includes(`href="${home.club.venuePath}"`) || !row.includes('<a ') : !row.includes('<a ');
        if (gotRow === wantRow && parkOk) rowsRight += 1;
        else wrong.push(`row ${id} game ${g.gameNumber}: served "${gotRow}" expected "${wantRow}"${parkOk ? '' : ' (park link)'}`);
      });
    });
    same(`${where}: game rows that say exactly what the document says`, rowsRight, rows);
    check(`${where}: every card, panel and club link agrees with the document`, wrong.filter((w) => !w.startsWith('row ')).length === 0, `${doc.series.length} series`);
    for (const w of wrong) console.log(`      ${w}`);

    // The results section: every decided series, with every game that was
    // played and its score, and nothing that is not decided.
    const results = element(el, 'data-series-results=');
    const decided = doc.series.filter((s) => s.status === 'final');
    if (decided.length === 0) check(`${where}: no results section when nothing is decided`, results === null);
    else {
      const missing: string[] = [];
      doc.series.forEach((s, i) => {
        const inSection = results ? results.includes(`data-result="${pageIds[i]}"`) : false;
        if (s.status !== 'final') {
          if (inSection) missing.push(`${pageIds[i]} listed but not decided`);
          return;
        }
        if (!inSection) { missing.push(`${pageIds[i]} not listed`); return; }
        const a = slotName(doc, s.higher);
        const b = slotName(doc, s.lower);
        const line = scoreLine(doc, s);
        const card = element(results as string, `data-result="${pageIds[i]}"`) ?? '';
        const cardText = textOf(card);
        // On the series' own card, not somewhere in the section.
        if (!cardText.includes(`${a.name} vs ${b.name}`) || (line && !cardText.includes(line))) missing.push(`${pageIds[i]} names or score`);
        for (const g of s.games) {
          if (g.status !== 'final' || g.homeScore === null || g.awayScore === null || !g.homeSide) continue;
          const home = slotName(doc, s[g.homeSide]);
          const away = slotName(doc, s[g.homeSide === 'higher' ? 'lower' : 'higher']);
          const h = home.club?.abbr ?? home.name;
          const aw = away.club?.abbr ?? away.name;
          const score = g.homeScore >= g.awayScore ? `${h} ${g.homeScore}, ${aw} ${g.awayScore}` : `${aw} ${g.awayScore}, ${h} ${g.homeScore}`;
          if (!cardText.includes(`G${g.gameNumber} ${score}`)) missing.push(`${pageIds[i]} game ${g.gameNumber}: ${score}`);
        }
        const rows = count(card, 'data-result-game=');
        const played = s.games.filter((g) => g.status === 'final' && g.homeScore !== null && g.awayScore !== null).length;
        if (rows !== played) missing.push(`${pageIds[i]}: ${rows} game rows for ${played} played`);
      });
      check(`${where}: the results section lists every decided series with every game score, and nothing else`, missing.length === 0, `${decided.length} decided${missing.length ? ': ' + missing.slice(0, 4).join('; ') : ''}`);
    }

    // Scores: only on finished games, and every one of them accounted for.
    const finals = doc.series.flatMap((s) => s.games.filter((g) => g.status === 'final' && g.homeScore !== null && g.awayScore !== null));
    same(`${where}: "Final:" lines against finished games in the document`, count(textOf(elements(el, 'data-series-panels=')[0] ?? panels.join(' ')), 'Final:'), finals.length);
    const live = doc.series.flatMap((s) => s.games.filter((g) => g.status === 'live'));
    same(`${where}: in-progress badges present exactly when a game is in progress`, count(el, 'data-game-state="live"') > 0, live.length > 0);
    // A game in progress shows no score: its row is compared whole, above.
    same(`${where}: rows of games in progress that show a score`, elements(el, 'data-game=').filter((r) => r.includes('data-game-state="live"') && /\d+, [A-Z]/.test(textOf(r))).length, 0);

    // Home games: every row is a game the document lists as scheduled.
    const list = elements(el, 'data-home-game=');
    const known = new Set<string>();
    for (const s of doc.series) {
      if (s.status === 'final') continue;
      for (const g of s.games) {
        if (g.status !== 'scheduled' || !g.homeSide) continue;
        const home = slotName(doc, s[g.homeSide]);
        const away = slotName(doc, s[g.homeSide === 'higher' ? 'lower' : 'higher']);
        if (!home.club) continue;
        known.add([`${away.name} at ${home.name}`, `${s.roundLabel} · Game ${g.gameNumber}${conditional(s, g) ? ' · If necessary' : ''}`, whenOf(g), home.club.park ?? ''].join(' ').trim());
      }
    }
    // A promotion line is checked on its own below; it is taken out of the
    // row before the row is compared.
    const withoutPromo = (r: string) => r.replace(/<p data-game-promo=[^>]*>[\s\S]*?<\/p>/g, '');
    const strays = list.map((r) => textOf(withoutPromo(r)).replace(/ Get Tickets.*$/, '').trim()).filter((t) => !known.has(t));
    check(`${where}: every home game row is a scheduled game in the document`, strays.length === 0, `${list.length} rows${strays.length ? `, not in the document: ${strays.join(' || ')}` : ''}`);
    const today = etYmd(new Date());
    const inThree = list.filter((r) => element(el, 'data-home-games-list="primary"')?.includes(r));
    check(`${where}: the short list holds eight rows at most`, inThree.length <= 8, `${inThree.length} rows, today is ${today} in Eastern`);
    same(`${where}: ticket links per home game row, at most one`, list.every((r) => count(r, 'rel="noopener noreferrer sponsored"') <= 1), true);

    // The games list is "Upcoming playoff games": every upcoming game with a
    // known date, "Time TBD" when untimed (ruling of 2026-10-02); nothing
    // visible calls them home games.
    const gamesSection = element(el, 'data-home-games=');
    if (gamesSection) check(`${where}: the games section is headed "Upcoming playoff games"`, /<h2[^>]*>Upcoming playoff games<\/h2>/.test(gamesSection));
    check(`${where}: every listed game has a known date (an untimed one reads "Time TBD")`, list.every((r) => !/Date TBD/.test(textOf(r))), `${list.length} rows, ${list.filter((r) => /Time TBD/.test(textOf(r))).length} Time TBD`);
    const window = renderWindow(got.headers, got.fetchedAt);
    if (open) gamesMatch(where, el, [[league, doc]], window);
    const homeWord = /\bhome games?\b/i.exec(textOf(el) + ' ' + (/<meta name="description" content="([^"]*)"/.exec(got.html)?.[1] ?? ''));
    check(`${where}: nothing in the article or the description says "home games"`, !homeWord, homeWord ? homeWord[0] : '');
    // TBD slots: dashed, on the light fill, in the quietest readable ink.
    const tbd = [...el.matchAll(/<span data-slot="placeholder" class="([^"]+)"/g)].map((m) => m[1]);
    check(`${where}: every TBD slot is dashed on the light cream fill in ink-faint`, tbd.every((c) => /\bborder-dashed\b/.test(c) && c.split(' ').includes('bg-rd-cream/60') && c.split(' ').includes('text-rd-ink-faint')), `${tbd.length} slots`);
    // "Every percentage on this page" (the methodology) stays true: no
    // percentage in the article outside the predictions section and the
    // methodology (a promotion titled "20% off" would make it false).
    let outside = el;
    for (const x of [element(el, 'data-predictions="bracket"'), element(el, 'data-predictions-methodology')]) if (x) outside = outside.replace(x, '');
    const outsidePct = textOf(outside);
    const pct = /.{0,30}\d\s?%.{0,10}/.exec(outsidePct);
    check(`${where}: no percentage in the article outside PromoNight Predicts`, !pct, pct ? pct[0] : '');

    // WHERE THINGS STAND, derived here from the raw document with this
    // file's own formatting. "Next game" depends on the render time, bounded
    // by the response's age: a line derived anywhere in that window is
    // accepted, and nothing else (a missing line only where it derives null).
    const standingEl = element(el, 'data-standing');
    const standingGot = standingEl ? textOf(standingEl) : null;
    const wants = valuesIn(window, [doc], (at) => standingWant(doc, at));
    check(`${where}: "where things stand" says exactly what the document says`, wants.includes(standingGot), `served ${JSON.stringify(standingGot)} expected ${JSON.stringify(wants[0])}`);
    check(`${where}: "where things stand" sits in the introduction, beside the change stamp, and uses no clock word`, standingGot === null || (!!element(el, 'data-page-intro')?.includes('data-standing') && !/\b(today|tonight|live|latest|right now|now|currently|just)\b/i.test(standingGot)));

    // Postseason promotions: every line on the page is a stored row of a
    // host club, not tombstoned, for this league and season, and no row's
    // keys are on the page. Read here by the same equality the page uses.
    const hosts = new Set<string>();
    for (const s of doc.series) for (const g of s.games) if (g.homeSide) { const h = slotName(doc, s[g.homeSide]); if (h.slug) hosts.add(h.slug); }
    const stored = new Map<string, { title: string; key: string }>();
    const internal: string[] = [];
    for (const h of hosts) {
      const snap = await db.collection('teams').doc(h).collection('promos').where('isPostseason', '==', true).get();
      for (const d of snap.docs) {
        const row = d.data() as Record<string, unknown>;
        if (row.tombstoned === true || row.league !== league || row.season !== SEASON) continue;
        if (typeof row.seriesKey === 'string' && typeof row.gameNumber === 'number') stored.set(`${row.seriesKey}#${row.gameNumber}`, { title: String(row.title), key: `${row.seriesKey}#${row.gameNumber}` });
        // opponentSlug is a club's slug, which the page carries as a link
        // to that club in any case; it is not a row's internal field.
        for (const k of ['seriesKey', 'bracketGameId', 'sourceQuote', 'sourceUrl']) if (typeof row[k] === 'string' && (row[k] as string).length > 5 && got.html.includes(row[k] as string)) internal.push(`${k} of ${d.id}`);
        if (got.html.includes(d.id)) internal.push(`the id of ${d.id}`);
      }
    }
    // Each line whole (the icon sits in a span of its own inside it). A row
    // shows twice when its game is in the home games list as well.
    const lines = elements(el, 'data-game-promo=').map((e) => textOf(e));
    const titles = new Set([...stored.values()].map((r) => r.title));
    const unknownLines = lines.filter((l) => ![...titles].some((t) => l.endsWith(t)));
    check(`${where}: every promotion line on the page is a stored postseason row of a host club`, unknownLines.length === 0, `${lines.length} lines, ${stored.size} rows stored${unknownLines.length ? ': ' + unknownLines.join(' | ') : ''}`);
    check(`${where}: no postseason row's internal field is on the page`, internal.length === 0, internal.join(' '));
  }

  // ---- The hub ----
  {
    const path = '/playoffs';
    const where = path;
    const got = await fresh(path, null);
    save(path, got.html);
    same(`${where}: status`, got.status, 200);
    check(`${where}: each card names a version of its document that was read in this run`, got.built.size === LEAGUES.length, got.lag);
    if (got.status === 200 && got.built.size === LEAGUES.length) {
      const at = got.built;
      const playing = LEAGUES.filter((l) => at.get(l) && currentRound(at.get(l) as RawDoc));
      const rounds = playing.map((l) => `${l}: ${(currentRound(at.get(l) as RawDoc) as RawSeries).roundLabel}`).join('. ');
      const names = playing.length === 2 ? `${playing[0]} and ${playing[1]}` : playing.join('');
      const want = {
        title: `${SEASON} Playoffs: MLB and WNBA Brackets`,
        description: `The ${SEASON} postseason brackets for ${names}, series by series, with Eastern game times and upcoming games. ${rounds}.`,
        canonical: `${SITE}${path}`,
      };
      head(where, got.html, want);
      const stamps = LEAGUES.map((l) => instantOf(at.get(l)?.lastChangedAt)).filter((d): d is Date => d !== null).map((d) => d.toISOString()).sort();
      jsonLd(where, got.html, { ...want, crumbs: [`Home ${SITE}`, `Playoffs ${SITE}/playoffs`], modified: stamps.length ? stamps[stamps.length - 1] : null });
      const el = article(where, got.html, 'hub');
      leaks(where, got.html);
      const compHub = /computer/i.exec(got.html);
      check(`${where}: no "computer" anywhere in the served bytes`, !compHub, compHub ? got.html.slice(Math.max(0, compHub.index - 40), compHub.index + 40) : '');
      const anyPrint = [...preds.values()].flatMap(fingerprints).filter((f) => got.html.includes(f));
      check(`${where}: no fingerprint on the hub`, anyPrint.length === 0 && !/\b[0-9a-f]{64}\b/.test(got.html), anyPrint.map((f) => f.slice(0, 8)).join(' '));
      check(`${where}: no "publish soon" placeholder`, !/publish soon/i.test(got.html));
      if (DISABLED.size > 0) {
        const said = await operatorText(got.html);
        check(`${where}: FORCED FAILURE: nothing operator-facing on the hub`, !said, said ?? '');
      }
      const card = element(el, 'data-predictions="locked"');
      const wantLines: string[] = [];
      for (const league of LEAGUES) {
        const d = at.get(league);
        const p = preds.get(league);
        if (!d || !p || !currentRound(d)) continue;
        if (DISABLED.has(league)) {
          check(`${where}: FORCED FAILURE: no ${league} predictions line`, !card || !card.includes(`data-predictions-league="${league.toLowerCase()}"`));
          continue;
        }
        const sc = score(d, p);
        const champ = clubs.get(p.champion)?.full ?? p.champion;
        const claim = sc.champion === 'eliminated' ? `PromoNight Predicts picked ${champ} to win it all` : sc.champion === 'won the title' ? `PromoNight Predicts picked ${champ} to win it all, and they did` : `PromoNight Predicts: ${champ} win it all`;
        const text = `${claim} · ${sc.decided === 0 ? 'no series decided yet' : `${sc.correct} for ${sc.decided}`}`;
        wantLines.push(text);
        const line = card ? element(card, `data-predictions-league="${league.toLowerCase()}"`) : null;
        check(`${where}: ${league} predictions line`, !!line && textOf(line) === text && line.includes(`href="/playoffs/${league.toLowerCase()}#predictions"`), line ? textOf(line) : 'missing');
      }
      same(`${where}: predictions lines on the card`, card ? count(card, 'data-predictions-league=') : 0, wantLines.length);
      for (const league of LEAGUES) {
        const doc = at.get(league);
        if (!doc) continue;
        const card = element(el, `data-league-card="${league}"`) ?? '';
        const text = textOf(card);
        const open = currentRound(doc);
        const changed = instantOf(doc.lastChangedAt);
        const pageIds = ids(doc);
        // The card lists the series of the round being played that are not
        // yet final, each with its standing and its link. A decided series of
        // that round is in the results section and not on the card.
        const lines: string[] = [];
        doc.series.forEach((s, i) => {
          if (!open || s.round !== open.round) return;
          const a = slotName(doc, s.higher);
          const b = slotName(doc, s.lower);
          const onCard = card.includes(`data-series="${pageIds[i]}"`);
          if (s.status === 'final') {
            if (onCard) lines.push(`${pageIds[i]} decided but on the card`);
            return;
          }
          const ok = onCard && text.includes(`${a.name} vs ${b.name}`) && (scoreLine(doc, s) ? text.includes(scoreLine(doc, s) as string) : true) && card.includes(`href="/playoffs/${league.toLowerCase()}#${pageIds[i]}"`);
          if (!ok) lines.push(`${pageIds[i]} ${a.name} vs ${b.name}`);
        });
        check(`${where}: ${league} card names the round and each series still being played, with its standing and its link, and no decided series`, !!open && text.startsWith(`${league} ${open.roundLabel}`) && lines.length === 0, lines.join(' | ') || (open ? open.roundLabel : ''));
        if (changed) check(`${where}: ${league} card change stamp`, text.includes(`Bracket updated ${etStamp(changed)}`), etStamp(changed));
        check(`${where}: ${league} card links to the league page`, card.includes(`href="/playoffs/${league.toLowerCase()}"`));
      }
      const rows = elements(el, 'data-home-game=');
      check(`${where}: home game rows carry one ticket link at most, and a league each`, rows.every((r) => count(r, 'rel="noopener noreferrer sponsored"') <= 1 && /\b(MLB|WNBA)\b/.test(textOf(r))), `${rows.length} rows`);
      const hubGames = element(el, 'data-home-games=');
      if (hubGames) check(`${where}: the games section is headed "Upcoming playoff games"`, /<h2[^>]*>Upcoming playoff games<\/h2>/.test(hubGames));
      check(`${where}: every listed game has a known date (an untimed one reads "Time TBD")`, rows.every((r) => !/Date TBD/.test(textOf(r))), `${rows.length} rows, ${rows.filter((r) => /Time TBD/.test(textOf(r))).length} Time TBD`);
      const activeDocs = LEAGUES.filter((l) => at.get(l) && currentRound(at.get(l) as RawDoc)).map((l) => [l, at.get(l) as RawDoc] as [League, RawDoc]);
      if (activeDocs.length) gamesMatch(where, el, activeDocs, renderWindow(got.headers, got.fetchedAt));
      const hubHome = /\bhome games?\b/i.exec(textOf(el) + ' ' + (/<meta name="description" content="([^"]*)"/.exec(got.html)?.[1] ?? ''));
      check(`${where}: nothing in the article or the description says "home games"`, !hubHome, hubHome ? hubHome[0] : '');
      // Results so far: each league's decided series, one line each, with
      // its round and its score, linking to the series.
      const hubResults = element(el, 'data-hub-results=');
      const anyDecided = LEAGUES.some((l) => (at.get(l)?.series ?? []).some((s) => s.status === 'final'));
      if (!anyDecided) check(`${where}: no results section when nothing is decided`, hubResults === null);
      else {
        const wrong: string[] = [];
        for (const league of LEAGUES) {
          const doc = at.get(league);
          if (!doc) continue;
          const ids = (() => { const seen = new Map<string, number>(); return doc.series.map((s) => { const n = (seen.get(s.round) ?? 0) + 1; seen.set(s.round, n); return `${s.round}-${n}`; }); })();
          const block = hubResults ? element(hubResults, `data-results-league="${league}"`) : null;
          const decidedHere = doc.series.filter((s) => s.status === 'final');
          if (decidedHere.length === 0) { if (block) wrong.push(`${league} listed with nothing decided`); continue; }
          if (!block) { wrong.push(`${league} missing`); continue; }
          const bt = textOf(block);
          doc.series.forEach((s, i) => {
            const listed = block.includes(`data-result="${ids[i]}"`);
            if (s.status !== 'final') { if (listed) wrong.push(`${league} ${ids[i]} not decided`); return; }
            if (!listed) { wrong.push(`${league} ${ids[i]} missing`); return; }
            const a = slotName(doc, s.higher); const b = slotName(doc, s.lower); const line = scoreLine(doc, s);
            if (!bt.includes(`${a.name} vs ${b.name}`) || !bt.includes(`${s.roundLabel} · ${line}`) || !block.includes(`href="/playoffs/${league.toLowerCase()}#${ids[i]}"`)) wrong.push(`${league} ${ids[i]} line`);
          });
        }
        check(`${where}: results so far list each league's decided series with round, score and link, and nothing else`, wrong.length === 0, wrong.slice(0, 4).join('; '));
      }
      // The hub names a game in progress and gives no score for any game.
      const inProgress = LEAGUES.flatMap((l) => (at.get(l)?.series ?? []).filter((s) => s.status !== 'final' && s.games.some((g) => g.status === 'live')));
      same(`${where}: in-progress badges against series with a game in progress`, count(el, 'data-game-state="live"'), inProgress.length);
      const scores = /Final:|\b[A-Z]{2,3} \d+, [A-Z]{2,3} \d+\b/.exec(textOf(el));
      check(`${where}: no game score on the hub`, !scores, scores ? scores[0] : '');
    }
  }

  // ---- Routes that must not exist, and the sitemap ----
  same('/playoffs/nba: status', (await get('/playoffs/nba')).status, 404);
  same('/playoffs/nhl: status', (await get('/playoffs/nhl')).status, 404);
  if (process.env.CASE === '1') same('/playoffs/MLB: status (path case)', (await get('/playoffs/MLB')).status, 404);
  const map = await get('/sitemap.xml');
  same('/sitemap.xml: status', map.status, 200);
  for (const p of ['/playoffs', '/playoffs/mlb', '/playoffs/wnba']) same(`/sitemap.xml: ${p} listed once, on the www host`, count(map.body, `<loc>${SITE}${p}</loc>`), 1);
  same('/sitemap.xml: playoffs entries in all', (map.body.match(/<loc>[^<]*\/playoffs[^<]*<\/loc>/g) ?? []).length, 3);
  const llms = await get('/llms.txt');
  check('/llms.txt: served, and it makes no claim about /playoffs', llms.status === 200 && !/playoffs/i.test(llms.body), `status ${llms.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\nversions of the documents read in this run: ${LEAGUES.map((l) => `${l} ${(versions.get(l) as Map<string, RawDoc>).size}`).join(', ')}; waited ${waited}s for pages to regenerate`);
  console.log(`${results.length - failed.length} of ${results.length} checks pass`);
  for (const f of failed) console.log(`FAILED  ${f.name}  [${f.detail}]`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
