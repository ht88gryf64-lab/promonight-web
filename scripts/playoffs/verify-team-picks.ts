/* eslint-disable no-console */
// Served-HTML verification for the PromoNight Predicts line on the team
// pages, the hub hero line, the final-bracket card and the playoffs back link.
//
// The expected pick line and status line are derived here from the RAW
// locked and bracket documents (expectedStatus, with this file's own reading
// of the rules) and required exactly. The page's code is not used to work
// out what the page should say.
//
// Run:
//   BASE=https://<host> node --require ./scripts/stub-server-only.cjs \
//     --import tsx --env-file=.env.local scripts/playoffs/verify-team-picks.ts
//
//   BASE             origin to fetch from.
//   SHARE            a share link for a protected preview, opened once for its
//                    access cookie (held in memory, never printed).
//   EXPECT_DISABLED  "MLB,WNBA": the deployment was built with
//                    PREDICTIONS_DISABLED for these leagues. Their team pages
//                    must carry the module and no line, and nothing about why.
//   PROD             an origin to compare the module against, byte for byte,
//                    on pages that carry no line (the forced-failure run).
//   OUT              directory to save the fetched pages in.
//
// READ-ONLY: four Firestore documents and the team list are read; nothing is
// written.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../../src/lib/firebase';
import { getAllTeams } from '../../src/lib/data';
import { decodePayload, decodeEntities, walkTree } from './flight';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const PROD = (process.env.PROD || '').replace(/\/$/, '');
/** Production, for the counts that are held to it. */
const COMPARE = (process.env.PROD || 'https://www.getpromonight.com').replace(/\/$/, '');
const SHARE = process.env.SHARE || '';
const OUT = process.env.OUT || '';
const DISABLED = new Set((process.env.EXPECT_DISABLED || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
if (!BASE) {
  console.error('Set BASE.');
  process.exit(2);
}
if (OUT) mkdirSync(OUT, { recursive: true });

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}

let cookie = '';
async function get(origin: string, path: string): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = { 'user-agent': 'Mozilla/5.0 (team-picks served-HTML check)' };
  if (cookie && origin === BASE) headers.cookie = cookie;
  const res = await fetch(`${origin}${path}`, { headers, redirect: 'manual' });
  return { status: res.status, body: await res.text() };
}

// ---- The raw documents ----

type Raw = Record<string, unknown>;
const LEAGUES = ['MLB', 'WNBA'] as const;
type League = (typeof LEAGUES)[number];
const SERIES_KEY = [/\b(?:AL|NL)-(?:WC|DS)-[A-Z]\b/, /\b(?:AL|NL)-CS\b/, /\bR\d-\dv\d\b/, /\bSF-[A-Z]\b/];
const keyIn = (s: string) => SERIES_KEY.map((r) => r.exec(s)?.[0]).find(Boolean) ?? null;

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Every string anywhere in a stored document, for the leak scan. */
function stringsIn(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v as Raw).forEach((x) => stringsIn(x, out));
  return out;
}

/** The section element of the team module, by its opening tag. */
function moduleSection(html: string): string | null {
  const at = html.indexOf('data-playoffs-module="team"');
  if (at < 0) return null;
  const start = html.lastIndexOf('<section', at);
  // The module holds no nested section.
  const end = html.indexOf('</section>', at);
  return start >= 0 && end > 0 ? html.slice(start, end + '</section>'.length) : null;
}

/** The decoded payload node for the team module, as JSON with client
 *  references named, or null. */
export async function payloadModule(html: string): Promise<string | null> {
  const d = await decodePayload(html);
  if (d.error) return `ERROR ${d.error}`;
  const seen = new Set<unknown>();
  let found: unknown = null;
  const ELEMENT = Symbol.for('react.transitional.element');
  const LAZY = Symbol.for('react.lazy');
  /** A lazy or a thenable, resolved; anything else as it is. */
  const settle = async (v: unknown): Promise<unknown> => {
    for (let n = 0; n < 20; n++) {
      if (v && typeof v === 'object' && (v as { $$typeof?: unknown }).$$typeof === LAZY) {
        const lazy = v as { _init: (p: unknown) => unknown; _payload: unknown };
        try {
          v = lazy._init(lazy._payload);
        } catch (thrown) {
          if (thrown && typeof (thrown as { then?: unknown }).then === 'function') await Promise.race([Promise.resolve(thrown).catch(() => null), new Promise((r) => setTimeout(r, 2000))]);
          else return null;
        }
        continue;
      }
      if (v && typeof (v as { then?: unknown }).then === 'function') {
        v = await Promise.race([Promise.resolve(v as Promise<unknown>).catch(() => null), new Promise((r) => setTimeout(() => r(null), 2000))]);
        continue;
      }
      return v;
    }
    return null;
  };
  const visit = async (raw: unknown, depth: number): Promise<void> => {
    const v = await settle(raw);
    if (found || depth > 400 || !v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      for (const x of v) await visit(x, depth + 1);
      return;
    }
    const el = v as { $$typeof?: unknown; type?: unknown; props?: Raw };
    if (el.$$typeof === ELEMENT && el.props) {
      if (el.type === 'section' && el.props['data-playoffs-module'] === 'team') {
        found = el;
        return;
      }
      for (const x of Object.values(el.props)) await visit(x, depth + 1);
      return;
    }
    for (const x of Object.values(v as Raw)) await visit(x, depth + 1);
  };
  await visit(d.root, 0);
  if (!found) return null;
  // Client references carry the build's chunk files (content hash and
  // deployment id): build artefacts, not page content. Everything else,
  // the module ids included, is compared as served.
  return JSON.stringify(found, (k, val) => (k === '_owner' || k === '_store' || k === '_debugInfo' || k === '_debugStack' || k === '_debugTask' ? undefined : typeof val === 'function' ? `[fn ${val.name}]` : typeof val === 'symbol' ? String(val) : typeof val === 'string' && /^static\/chunks\//.test(val) ? '[chunk]' : val));
}

async function main() {
  if (SHARE) {
    const r = await fetch(SHARE, { redirect: 'manual' });
    cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
    check('share link gives an access cookie', cookie.length > 0);
  }

  const teams = await getAllTeams();
  const nick = new Map(teams.map((t) => [t.id, t.name]));
  const sport = new Map(teams.map((t) => [t.id, t.sportSlug]));
  const brackets = new Map<League, Raw>();
  const predicted = new Map<League, Raw>();
  for (const l of LEAGUES) {
    const [b, p] = await Promise.all([db.collection('postseasonBrackets').doc(`${l}_2026`).get(), db.collection('predictedBrackets').doc(`${l}_2026`).get()]);
    brackets.set(l, b.data() as Raw);
    predicted.set(l, p.data() as Raw);
  }

  // Everything the documents hold that is not copy: operator fields, run ids,
  // file paths, hashes and commits. None of it may be served.
  const forbidden = new Set<string>();
  for (const l of LEAGUES) {
    const b = brackets.get(l)!;
    const p = predicted.get(l)!;
    for (const k of ['runId', 'bracketSha256', 'lastRevalidatedSha256', 'source', 'operatorLog']) stringsIn(b[k]).forEach((s) => forbidden.add(s));
    for (const k of ['computedBy', 'frozenBy', 'seedFileAuthoredBy', 'reviewedSha256', 'provenance', 'acks', 'runId']) stringsIn(p[k]).forEach((s) => forbidden.add(s));
    forbidden.add(`${l}_2026`);
  }
  // Club slugs are in every team URL, and a date is not an identifier: what
  // is kept is what reads as an id, a path, an address or a hash.
  for (const s of [...forbidden]) {
    const id = /[0-9a-f]{16}/.test(s) || /[\/@]/.test(s) || (/\d/.test(s) && /[a-z]/i.test(s) && !/\s/.test(s));
    if (s.length < 8 || /^\d{4}-\d{2}-\d{2}/.test(s) || nick.has(s) || !id) forbidden.delete(s);
  }
  forbidden.add('postseasonBrackets');
  forbidden.add('predictedBrackets');
  console.log(`      ${forbidden.size} forbidden values from the documents`);

  // The expected pick line, from the raw locked document.
  const roundLabel = (l: League, key: string) => ((brackets.get(l)!.series as Raw[]).find((s) => s.seriesKey === key)?.roundLabel as string) ?? null;
  const finalLabel = (l: League) => {
    const s = brackets.get(l)!.series as Raw[];
    return s[s.length - 1].roundLabel as string;
  };
  const clubsOf = (l: League) => [...new Set((predicted.get(l)!.rounds as Raw[]).flatMap((r) => [r.higher as string, r.lower as string]))];
  function expectedPick(l: League, club: string): string {
    const mine = (predicted.get(l)!.rounds as Raw[]).filter((r) => r.higher === club || r.lower === club);
    const last = mine[mine.length - 1];
    if (last.pick === club) return `PromoNight's pick: ${nick.get(club)} to win the ${finalLabel(l)}.`;
    return `PromoNight's pick: ${nick.get(club)} to lose the ${roundLabel(l, last.seriesKey as string)} to the ${nick.get(last.pick as string)}.`;
  }
  const STATUS = [
    /^Pick still alive\.$/,
    /^The [A-Z][A-Za-z ]+ decides? this pick\.$/,
    /^Pick correct: the [A-Z][A-Za-z ]+ (beat the [A-Z][A-Za-z ]+ \d-\d in|won) the [A-Z][A-Za-z ]+\.$/,
    /^Pick busted: the [A-Z][A-Za-z ]+ went (out earlier than picked, losing to|further than picked, beating) the [A-Z][A-Za-z ]+ \d-\d in the [A-Z][A-Za-z ]+\.$/,
    /^Pick busted: the [A-Z][A-Za-z ]+ went further than picked and won the [A-Z][A-Za-z ]+\.$/,
    /^Right round, different opponent: the [A-Z][A-Za-z ]+ lost to the [A-Z][A-Za-z ]+ \d-\d in the [A-Z][A-Za-z ]+\. PromoNight picked the [A-Z][A-Za-z ]+\.$/,
  ];
  // The expected status line, worked out here from the raw documents with
  // this file's own reading of the rules: the club's furthest real series
  // against the round its locked pick names. A slot written as a
  // placeholder whose feeder series is final is that series' winner, as
  // the pipeline means it.
  function expectedStatus(l: League, club: string): { kind: string; line: string } {
    const raw = brackets.get(l)!.series as Raw[];
    const byKey = new Map(raw.map((x) => [x.seriesKey as string, x]));
    const slotClub = (slot: Raw): string | null => {
      if (typeof slot.slug === 'string') return slot.slug;
      const feeder = typeof slot.feederSeriesKey === 'string' ? byKey.get(slot.feederSeriesKey) : undefined;
      return feeder && feeder.status === 'final' && typeof feeder.winner === 'string' ? (feeder.winner as string) : null;
    };
    const sides = (x: Raw) => [slotClub(x.higher as Raw), slotClub(x.lower as Raw)];
    const order: string[] = [];
    for (const x of raw) if (!order.includes(x.round as string)) order.push(x.round as string);
    const at = (round: string) => order.indexOf(round);
    const finalSeries = raw[raw.length - 1];
    const finalLbl = finalSeries.roundLabel as string;
    const mineReal = raw.filter((x) => sides(x).includes(club));
    const last = mineReal[mineReal.length - 1];
    const minePred = (predicted.get(l)!.rounds as Raw[]).filter((r) => r.higher === club || r.lower === club);
    const exit = minePred[minePred.length - 1];
    const toWin = exit.pick === club;
    const exitAt = at(exit.round as string);
    const n = (slug: string) => nick.get(slug) as string;
    const score = (x: Raw) => {
      const w = x.wins as { higher: number; lower: number };
      return `${Math.max(w.higher, w.lower)}-${Math.min(w.higher, w.lower)}`;
    };
    const other = (x: Raw) => sides(x).find((c) => c !== club) as string;
    const champion = finalSeries.status === 'final' && finalSeries.winner === club;
    const further = () => {
      if (champion) return { kind: 'busted', line: `Pick busted: the ${n(club)} went further than picked and won the ${finalLbl}.` };
      const through = mineReal.find((x) => x.round === exit.round)!;
      return { kind: 'busted', line: `Pick busted: the ${n(club)} went further than picked, beating the ${n(other(through))} ${score(through)} in the ${through.roundLabel}.` };
    };
    const r = at(last.round as string);
    if (last.status !== 'final') {
      if (r < exitAt) return { kind: 'alive', line: 'Pick still alive.' };
      if (r === exitAt) {
        const lbl = last.roundLabel as string;
        return { kind: 'decides', line: `The ${lbl} ${/s$/.test(lbl) && !/Series$/.test(lbl) ? 'decide' : 'decides'} this pick.` };
      }
      return further();
    }
    if (last.winner === club) {
      if (last === finalSeries) return toWin ? { kind: 'correct', line: `Pick correct: the ${n(club)} won the ${finalLbl}.` } : further();
      return r < exitAt ? { kind: 'alive', line: 'Pick still alive.' } : further();
    }
    const opp = other(last);
    if (r < exitAt || toWin) return { kind: 'busted', line: `Pick busted: the ${n(club)} went out earlier than picked, losing to the ${n(opp)} ${score(last)} in the ${last.roundLabel}.` };
    if (r > exitAt) return further();
    if (opp === exit.pick) return { kind: 'correct', line: `Pick correct: the ${n(opp)} beat the ${n(club)} ${score(last)} in the ${last.roundLabel}.` };
    return { kind: 'different', line: `Right round, different opponent: the ${n(club)} lost to the ${n(opp)} ${score(last)} in the ${last.roundLabel}. PromoNight picked the ${n(exit.pick as string)}.` };
  }
  // The kind each status sentence belongs to, by its opening words.
  const kindOf = (line: string) =>
    line === 'Pick still alive.' ? 'alive' : line.startsWith('The ') ? 'decides' : line.startsWith('Pick correct:') ? 'correct' : line.startsWith('Pick busted:') ? 'busted' : line.startsWith('Right round, different opponent:') ? 'different' : '';

  const pages: { path: string; kind: 'team' | 'hub' | 'league' | 'control'; league: League; club?: string }[] = [];
  for (const l of LEAGUES) for (const c of clubsOf(l)) pages.push({ path: `/${sport.get(c)}/${c}`, kind: 'team', league: l, club: c });
  pages.push({ path: '/mlb', kind: 'hub', league: 'MLB' }, { path: '/wnba', kind: 'hub', league: 'WNBA' });
  pages.push({ path: '/playoffs/mlb', kind: 'league', league: 'MLB' }, { path: '/playoffs/wnba', kind: 'league', league: 'WNBA' });
  pages.push({ path: '/mlb/seattle-mariners', kind: 'control', league: 'MLB' }, { path: '/wnba/chicago-sky', kind: 'control', league: 'WNBA' });
  check('20 playoff team pages from the locked documents', pages.filter((p) => p.kind === 'team').length === 20);

  const kinds = new Map<string, string>();
  for (const p of pages) {
    const r = await get(BASE, p.path);
    const html = r.body;
    if (OUT) writeFileSync(join(OUT, `${p.path.slice(1).replace(/\//g, '__')}.html`), html);
    check(`${p.path}: 200`, r.status === 200, String(r.status));
    if (r.status !== 200) continue;
    const d = await decodePayload(html);
    check(`${p.path}: the payload decodes`, !d.error, d.error ?? '');
    const walked = d.error ? null : await walkTree(d.root, null);
    // A walk that stopped anywhere has not seen the whole payload: every
    // check on its strings and keys below would pass on what it skipped.
    check(`${p.path}: the payload walks cleanly`, !!walked && walked.errors.length === 0, walked ? walked.errors.slice(0, 2).join('; ') : 'not walked');
    const payloadText = walked ? walked.strings.join('\n') : '';

    // ---- Leaks: keys, hashes, documents' own values ----
    const key = keyIn(html) ?? keyIn(decodeEntities(html)) ?? keyIn(payloadText);
    check(`${p.path}: no series key in the HTML or the payload`, key === null, key ?? '');
    // "WS" and "F" are too short for free text: looked for where a key sits,
    // as an attribute value or a link target, and as a whole payload string.
    // A whole payload string "F" is ordinary page data (an affiliate
    // component carries one on every team page in production), so the count
    // is held to production's for the same path: one more is a leak.
    const short = /(?:=|:)\s*"(?:WS|F)"|#(?:WS|F)\b/.exec(html)?.[0];
    check(`${p.path}: no final-round key ("WS", "F") in an attribute or link`, !short, short ?? '');
    const shortCount = (w: { strings: string[] } | null) => (w ? w.strings.filter((x) => x === 'WS' || x === 'F').length : -1);
    const ref = await get(COMPARE, p.path);
    const refDecoded = await decodePayload(ref.body);
    const refWalk = refDecoded.error ? null : await walkTree(refDecoded.root, null);
    check(`${p.path}: production's payload walks cleanly`, !!refWalk && refWalk.errors.length === 0, refWalk ? refWalk.errors.slice(0, 2).join('; ') : 'not walked');
    check(
      `${p.path}: exactly production's count of whole "WS"/"F" payload strings`,
      !!walked && !!refWalk && walked.errors.length === 0 && refWalk.errors.length === 0 && shortCount(walked) === shortCount(refWalk),
      `${shortCount(walked)} vs ${shortCount(refWalk)}`,
    );
    const keyField = walked ? walked.keys.find((k) => /seriesKey|feederSeriesKey|bracketSha|runId|operatorLog/i.test(k)) : undefined;
    check(`${p.path}: no bracket field name in the payload`, !keyField, keyField ?? '');
    const hashes = [...new Set([...(html.match(/[0-9a-f]{64}/g) ?? []), ...(payloadText.match(/[0-9a-f]{64}/g) ?? [])])];
    if (p.kind === 'league') {
      // The five fingerprints are allowed here, in the methodology section
      // (WEB2 contract exception); verify-served.ts holds where they sit.
      const pins = stringsIn((predicted.get(p.league)!.provenance as Raw) ?? {}).concat([predicted.get(p.league)!.reviewedSha256 as string]);
      const other = hashes.filter((h) => !pins.includes(h));
      check(`${p.path}: no hash but the allowed fingerprints`, other.length === 0, other.join(',').slice(0, 80));
    } else {
      check(`${p.path}: no 64-hex hash anywhere`, hashes.length === 0, hashes.join(',').slice(0, 80));
    }
    const leak = [...forbidden].find((s) => (p.kind === 'league' && /^[0-9a-f]{64}$/.test(s) ? false : html.includes(s) || payloadText.includes(s)));
    check(`${p.path}: no operator field, run id, path or document id`, !leak, leak ? leak.slice(0, 40) : '');
    const token = /predictions[-_ ]?unavailable|surface=team|reason=|first[-_ ]series[-_ ]mismatch|no[-_ ]team[-_ ]pick|pick[-_ ]inconsistent/i.exec(html + '\n' + payloadText);
    check(`${p.path}: no failure token`, !token, token?.[0] ?? '');
    check(`${p.path}: no dash in the new copy`, !/[\u2014\u2013]/.test(textOf(moduleSection(html) ?? '') + (/<p data-playoffs-hero[\s\S]*?<\/p>/.exec(html)?.[0] ?? '')));

    // ---- What each page must say ----
    if (p.kind === 'team') {
      const section = moduleSection(html);
      check(`${p.path}: the module is there`, !!section);
      if (!section) continue;
      const lines = (section.match(/data-team-pick="/g) ?? []).length;
      if (DISABLED.has(p.league)) {
        check(`${p.path}: no line (switched off)`, lines === 0 && !/PromoNight/.test(textOf(section)), `${lines}`);
        if (PROD) {
          const prod = await get(PROD, p.path);
          const ps = moduleSection(prod.body);
          const stamp = (h: string | null) => /Bracket updated [^<]+/.exec(h ?? '')?.[0] ?? '';
          if (ps && stamp(ps) === stamp(section)) {
            check(`${p.path}: the module's HTML is production's, byte for byte`, ps === section, ps === section ? '' : 'differs');
            const [a, b] = await Promise.all([payloadModule(html), payloadModule(prod.body)]);
            check(`${p.path}: the module's payload node is production's`, !!a && a === b, !a ? 'not found' : a === b ? '' : 'differs');
          } else {
            check(`${p.path}: production comparable (same bracket stamp)`, false, `${stamp(ps)} vs ${stamp(section)}`);
          }
        }
        continue;
      }
      check(`${p.path}: one line`, lines === 1, String(lines));
      const block = section.slice(section.indexOf('<div data-team-pick='));
      const kind = /data-team-pick="([a-z]+)"/.exec(block)?.[1] ?? '';
      kinds.set(p.club!, kind);
      const ps = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
      check(`${p.path}: eyebrow`, ps[0] === 'PromoNight Predicts', ps[0]);
      check(`${p.path}: the locked pick, from the raw document`, ps[1] === expectedPick(p.league, p.club!), `${ps[1]} | expected ${expectedPick(p.league, p.club!)}`);
      check(`${p.path}: a ruled status line`, STATUS.some((re) => re.test(ps[2] ?? '')), ps[2]);
      const want = expectedStatus(p.league, p.club!);
      check(`${p.path}: the status, from the raw documents`, ps[2] === want.line, `${ps[2]} | expected ${want.line}`);
      check(`${p.path}: the kind ${kind} is the sentence's and the documents'`, kind === kindOf(ps[2] ?? '') && kind === want.kind, `${kind}/${kindOf(ps[2] ?? '')}/${want.kind}`);
      const hrefs = [...block.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      check(`${p.path}: one link, to the league page's predictions`, hrefs.length === 1 && hrefs[0] === `/playoffs/${p.league.toLowerCase()}#predictions`, hrefs.join(','));
      check(`${p.path}: the line is inside the module's section, last`, section.endsWith('</a></div></section>'));
      check(`${p.path}: no ad container or aside in the module`, !/adthrive|<aside|<article|data-ad-/.test(section));
      console.log(`      ${p.club}: ${kind} | ${ps[1]} | ${ps[2]}`);
    }
    if (p.kind === 'control') {
      check(`${p.path}: no module, no line`, !/data-playoffs-module="team"|data-team-pick|PromoNight&#x27;s pick|PromoNight's pick/.test(html));
    }
    if (p.kind === 'hub') {
      const series = brackets.get(p.league)!.series as Raw[];
      const open = series.find((s) => s.status !== 'final');
      const want = open ? `2026 ${p.league} Playoffs: ${open.roundLabel}. Open the bracket` : null;
      const hero = /<p data-playoffs-hero[^>]*>([\s\S]*?)<\/p>/.exec(html);
      check(`${p.path}: the hero line, the real bracket's current round`, !!hero && textOf(hero[1]) === want, hero ? textOf(hero[1]) : 'none');
      check(`${p.path}: the hero line links to the league page`, !!hero && new RegExp(`href="/playoffs/${p.league.toLowerCase()}"`).test(hero[0]));
      check(`${p.path}: the hero line is before page-content`, !!hero && html.indexOf(hero[0]) < html.indexOf('page-content'));
      check(`${p.path}: the full card while active, no final card`, /data-playoffs-module="league" data-playoffs-state="active"/.test(html) && !/data-playoffs-state="final"/.test(html));
    }
    if (p.kind === 'league') {
      const lower = p.league.toLowerCase();
      // Streamed HTML puts <!-- --> between adjacent text nodes.
      const back = [...html.matchAll(new RegExp(`<a [^>]*href="/${lower}"[^>]*>([\\s\\S]*?)</a>`, 'g'))].find((m) => textOf(m[1].replace(/<!-- -->/g, '')) === `All ${p.league} promotions`);
      const at = back ? back.index ?? -1 : -1;
      check(`${p.path}: the back link to /${lower}`, at > 0);
      check(`${p.path}: the back link is outside the article`, at > html.indexOf('</article>'));
    }
  }
  if (kinds.size) console.log(`      kinds served: ${JSON.stringify(Object.fromEntries([...new Set(kinds.values())].map((k) => [k, [...kinds].filter(([, v]) => v === k).length])))}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

if (!process.env.NO_MAIN) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
