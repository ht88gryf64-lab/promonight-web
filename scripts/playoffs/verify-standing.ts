/* eslint-disable no-console */
// The standing-line and methodology-summary check, on its own (Matt's
// ruling, 2026-10-02). For each league page it prints the exact "where
// things stand" line and methodology summary as served, derives both from
// the RAW documents (postseasonBrackets, predictedBrackets, team records)
// with this file's own code, and requires an exact match. It shares no code
// with the page (src/lib/postseason/standing.ts) or with verify-served.ts.
//
//   BASE=https://<host> BYPASS=<secret> node --require ./scripts/stub-server-only.cjs \
//     --import tsx --env-file=.env.local scripts/playoffs/verify-standing.ts
//
// "Next game" depends on the moment the page was rendered, which the response
// bounds: between the fetch minus the cache's `age` header and the fetch. A
// line derived anywhere in that window (at its ends and at every game start
// inside it) is accepted, and nothing else. When the page carries an older
// change stamp than the document (ISR not yet regenerated), the check waits
// and refetches, up to three minutes.
import { db } from '../../src/lib/firebase';
import { getAllTeams } from '../../src/lib/data';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const BYPASS = process.env.BYPASS || '';
if (!BASE) {
  console.error('Set BASE to the origin to check.');
  process.exit(2);
}
const SEASON = 2026;
const ET = 'America/New_York';

type Doc = Record<string, any>;
type Team = { name: string; full: string };

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ET, ...o }).formatToParts(d).map((p) => [p.type, p.value]));
const ymd = (d: Date) => { const p = fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
const longDay = (d: Date) => { const p = fmt(d, { year: 'numeric', month: 'long', day: 'numeric' }); return `${p.month} ${p.day}, ${p.year}`; };
const shortWhen = (d: Date) => {
  const a = fmt(d, { weekday: 'short', month: 'short', day: 'numeric' });
  const t = fmt(d, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${a.weekday}, ${a.month} ${a.day}, ${t.hour}:${t.minute} ${t.dayPeriod} ET`;
};
const isInstant = (v: unknown): v is string => typeof v === 'string' && /T\d\d:\d\d/.test(v);
const asDate = (v: any): Date | null => (v == null ? null : typeof v === 'string' ? new Date(v) : typeof v.toDate === 'function' ? v.toDate() : null);
// The pipeline's series keys ("AL-WC-B", "NL-CS", "R1-1v8", "SF-A"). A stored
// label holding one is never shown; the page says "To be decided".
const SERIES_KEY = [/\b(?:AL|NL)-(?:WC|DS)-[A-Z]\b/, /\b(?:AL|NL)-CS\b/, /\bR\d-\dv\d\b/, /\bSF-[A-Z]\b/];
const ONE = new Set(['Liberty', 'Dream', 'Fever', 'Lynx', 'Mercury', 'Sky', 'Storm', 'Sun', 'Tempo', 'Fire']);

function expectedLine(doc: Doc, teams: Map<string, Team>, now: Date): string | null {
  const series: Doc[] = doc.series;
  const winnerSlug = (s: Doc): string | null => (s.winner === 'higher' || s.winner === 'lower' ? s[s.winner]?.slug ?? null : s.winner ?? null);
  // A slot as the page names it: a club, a resolved feeder winner, "A / B
  // winner" from two candidates, or the stored text.
  const slot = (x: Doc): { team: Team | null; text: string } => {
    if (x.slug && teams.has(x.slug)) return { team: teams.get(x.slug)!, text: teams.get(x.slug)!.name };
    if (x.feederSeriesKey) {
      const f = series.find((s) => s.seriesKey === x.feederSeriesKey);
      const w = f && f.status === 'final' ? winnerSlug(f) : null;
      if (w && teams.has(w)) return { team: teams.get(w)!, text: teams.get(w)!.name };
    }
    if (Array.isArray(x.candidates) && x.candidates.length === 2 && x.candidates.every((c: string) => teams.has(c))) {
      return { team: null, text: `${teams.get(x.candidates[0])!.name} / ${teams.get(x.candidates[1])!.name} winner` };
    }
    const label = String(x.placeholder ?? '');
    return { team: null, text: !label || SERIES_KEY.some((re) => re.test(label)) ? 'To be decided' : label };
  };
  const rounds: string[] = [];
  for (const s of series) if (!rounds.includes(s.round)) rounds.push(s.round);
  const inRound = (r: string) => {
    const list = series.filter((s) => s.round === r);
    const confs: (string | null)[] = [];
    for (const s of list) if (!confs.includes(s.conference ?? null)) confs.push(s.conference ?? null);
    return confs.flatMap((c) => list.filter((s) => (s.conference ?? null) === c));
  };
  const labelOf = (r: string) => series.find((s) => s.round === r)!.roundLabel as string;

  const open = rounds.findIndex((r) => series.some((s) => s.round === r && s.status !== 'final'));
  if (open < 0) {
    const last = inRound(rounds[rounds.length - 1]);
    if (last.length !== 1) return null;
    const s = last[0];
    const w = winnerSlug(s);
    const side = w === s.higher.slug ? 'higher' : w === s.lower.slug ? 'lower' : null;
    if (!side) return null;
    const other = side === 'higher' ? 'lower' : 'higher';
    const W = teams.get(s[side].slug);
    const L = teams.get(s[other].slug);
    if (!W || !L || s.wins[side] <= s.wins[other]) return null;
    return `The ${W.full} won the ${doc.season} ${labelOf(rounds[rounds.length - 1])}, beating the ${L.full} ${s.wins[side]}-${s.wins[other]}.`;
  }

  const begun = (s: Doc) => s.status !== 'upcoming' || s.wins.higher + s.wins.lower > 0 || s.games.some((g: Doc) => g.status === 'final' || g.status === 'live');
  const playing = rounds.filter((r, i) => i >= open && inRound(r).some(begun));

  // The next game: one ordered list of every unplayed game.
  const UNPLAYED = ['scheduled', 'postponed', 'suspended'];
  const scope = playing.length ? playing : [rounds[open]];
  const later = rounds.filter((r, i) => i >= open && !scope.includes(r));
  let next: { s: Doc; g: Doc } | null = null;
  let blockedByEmpty = false;
  const pool: { s: Doc; g: Doc; inScope: boolean; day: string; time: string }[] = [];
  for (const r of [...scope, ...later]) {
    for (const s of inRound(r)) {
      if (s.status === 'final') continue;
      const left = s.games.filter((g: Doc) => UNPLAYED.includes(g.status));
      if (scope.includes(r) && left.length === 0 && !s.games.some((g: Doc) => g.status === 'live')) blockedByEmpty = true;
      for (const g of left) {
        const timed = !g.startTimeTBD && isInstant(g.start);
        const day = timed ? ymd(new Date(g.start)) : g.date ?? (scope.includes(r) ? '' : null);
        if (day === null) continue;
        pool.push({ s, g, inScope: scope.includes(r), day, time: timed ? new Date(g.start).toISOString() : '' });
      }
    }
  }
  if (!blockedByEmpty && pool.length) {
    pool.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    const [a, b] = pool;
    const ok =
      a.inScope && a.g.status === 'scheduled' && a.time !== '' && Date.parse(a.time) >= now.getTime() &&
      !(b && b.day === a.day && b.time === a.time) &&
      !a.s.games.some((g: Doc) => g.gameNumber < a.g.gameNumber && UNPLAYED.includes(g.status));
    if (ok) next = { s: a.s, g: a.g };
  }
  const gameText = ({ s, g }: { s: Doc; g: Doc }) => {
    const hi = slot(s.higher).text;
    const lo = slot(s.lower).text;
    const matchup = g.homeSide === 'higher' ? `${lo} at ${hi}` : g.homeSide === 'lower' ? `${hi} at ${lo}` : `${lo} vs ${hi}`;
    return `Game ${g.gameNumber}, ${matchup}, ${shortWhen(new Date(g.start))}`;
  };

  if (!playing.length) {
    const r = rounds[open];
    return next ? `Next round: ${labelOf(r)}. It opens with ${gameText(next)}.` : `Next round: ${labelOf(r)}.`;
  }
  const sentences: string[] = [];
  for (const r of playing) {
    const said: string[] = [];
    let unset = 0;
    for (const s of inRound(r)) {
      const A = slot(s.higher);
      const B = slot(s.lower);
      const wa = s.wins.higher;
      const wb = s.wins.lower;
      if (!A.team && !B.team) { unset++; continue; }
      if (!A.team || !B.team) {
        if (wa + wb > 0 || s.status === 'final') return null;
        const c = (A.team ? A : B).text;
        const o = (A.team ? B : A).text;
        said.push(`the ${c} ${ONE.has(c) ? 'awaits' : 'await'} ${o.endsWith(' winner') ? `the ${o}` : 'an opponent'}`);
        continue;
      }
      if (s.status === 'final') {
        const w = winnerSlug(s);
        if (w === s.higher.slug && wa > wb) said.push(`the ${A.text} beat the ${B.text} ${wa}-${wb}`);
        else if (w === s.lower.slug && wb > wa) said.push(`the ${B.text} beat the ${A.text} ${wb}-${wa}`);
        else return null;
      } else if (wa === wb) said.push(wa === 0 ? `the ${A.text} and the ${B.text} have not completed a game` : `the ${A.text} and the ${B.text} are tied ${wa}-${wb}`);
      else {
        const [w, l, x, y] = wa > wb ? [A.text, B.text, wa, wb] : [B.text, A.text, wb, wa];
        said.push(`the ${w} ${ONE.has(w) ? 'leads' : 'lead'} the ${l} ${x}-${y}`);
      }
    }
    if (!said.length) return null;
    if (unset) said.push(unset === 1 ? 'one matchup is to be set' : `${unset} matchups are to be set`);
    sentences.push(`${labelOf(r)}: ${said.join('; ')}.`);
  }
  return next ? `${sentences.join(' ')} Next game: ${gameText(next)}.` : sentences.join(' ');
}

function textOfElement(html: string, marker: string): string | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const open = html.lastIndexOf('<', at);
  const close = html.indexOf('</p>', at);
  return html
    .slice(html.indexOf('>', open) + 1, close)
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

async function main() {
  const teams = new Map<string, Team>((await getAllTeams()).map((t) => [t.id, { name: t.name, full: `${t.city} ${t.name}` }]));
  let failed = 0;
  for (const league of ['MLB', 'WNBA'] as const) {
    const path = `/playoffs/${league.toLowerCase()}`;
    let attempt = 0;
    for (;;) {
      attempt++;
      const bracket = (await db.collection('postseasonBrackets').doc(`${league}_${SEASON}`).get()).data() as Doc;
      const predicted = (await db.collection('predictedBrackets').doc(`${league}_${SEASON}`).get()).data() as Doc;
      const res = await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'Mozilla/5.0 (standing check)', ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}) } });
      const html = await res.text();
      const now = new Date();
      const age = Number(res.headers.get('age'));
      const from = Number.isFinite(age) && age > 0 ? now.getTime() - age * 1000 : now.getTime();
      const changed = asDate(bracket.lastChangedAt);
      const served = /"dateModified":"([^"]+)"/.exec(html)?.[1] ?? null;
      const stale = changed && served && Date.parse(served) < changed.getTime();
      if (stale && attempt < 7) {
        console.log(`      ${path}: page stamp ${served} is older than the document's ${changed!.toISOString()}; waiting 30s`);
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      const line = textOfElement(html, 'data-standing');
      const summary = textOfElement(html, 'data-methodology-summary');
      // The window's ends and every game start inside it.
      const instants = new Set<number>([from, now.getTime()]);
      for (const s of bracket.series) for (const g of s.games) {
        const t = isInstant(g.start) ? Date.parse(g.start) : NaN;
        if (t > from && t <= now.getTime()) { instants.add(t - 1); instants.add(t); }
      }
      const wants = [...new Set([...instants].sort().map((t) => expectedLine(bracket, teams, new Date(t))))];
      const lockedAt = asDate(predicted?.lockedAt);
      const wantSummary = lockedAt ? `PromoNight's picks were locked on ${longDay(lockedAt)} from regular-season results only. They never change.` : null;
      const okLine = res.status === 200 && wants.includes(line);
      const okSummary = res.status === 200 && summary === wantSummary && !/Game 1/.test(summary ?? '');
      console.log(`${okLine ? 'PASS' : 'FAIL'}  ${path} standing line (HTTP ${res.status})`);
      console.log(`      served:   ${JSON.stringify(line)}`);
      console.log(`      expected: ${wants.map((w) => JSON.stringify(w)).join(' or ')}  (render window ${new Date(from).toISOString()} to ${now.toISOString()})`);
      console.log(`${okSummary ? 'PASS' : 'FAIL'}  ${path} methodology summary`);
      console.log(`      served:   ${JSON.stringify(summary)}`);
      console.log(`      expected: ${JSON.stringify(wantSummary)}`);
      if (!okLine) failed++;
      if (!okSummary) failed++;
      break;
    }
  }
  console.log(failed ? `\n${failed} of 4 checks FAIL` : '\n4 of 4 checks pass');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(2);
});
