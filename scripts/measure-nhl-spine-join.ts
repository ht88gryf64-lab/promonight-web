/* eslint-disable no-console */
// OFFLINE season-gate join measurement for NHL. No extraction, no page fetch.
//
// Loads the upcoming NHL promo docs from Firestore (read-only, two queries)
// and joins each one against a dry-run games file produced by
// scripts/ingest-nhl-schedule.ts, using the promo-pipeline's own season gate
// (lib/scanner/season-gate.js: indexSpine + joinTeamPromos). The rows that
// join zero or more than one home game are exactly the rows the gate would
// HOLD once NHL is wired to it, so every one is listed with a diagnosis.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/measure-nhl-spine-join.ts --games=/path/nhl-games-2026.json \
//     [--today=2026-09-01] [--season-gate=/path/to/season-gate.js] [--out=/path/report.json]
//
// The known-bad input block (scanner-framework 6b.6) constructs Calgary's
// seven bare-dated prior-season rows, as read from the club's live page on
// 2026-09-01, resolved forward the way a Sep-Dec / Jan-Jun rollover rule
// would resolve them, and shows what the gate does with each.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { db } from '../src/lib/firebase';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

interface SpineGame {
  id: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  date: string;
  seasonType: string;
  nhlGameId?: number;
}

interface PromoRow {
  promoId: string;
  teamSlug: string;
  date: string | null;
  title: string;
  type: string | null;
  opponent: string | null;
}

interface JoinOk {
  ok: true;
  date: string;
  seasonType: string;
  gameId: string | null;
  opponent: string | null;
  resolvedFrom: string;
  weekCheck: string;
}
interface JoinHeld {
  ok: false;
  reason: string;
  detail: string;
  hold: true;
  promo: PromoRow;
}
interface JoinTeamResult {
  joined: Array<PromoRow & { seasonType: string; gameId: string | null; joinedFrom: string }>;
  held: JoinHeld[];
  stats: { total: number; joined: number; held: number; byReason: Record<string, number>; weekJoinOnly: number };
}
interface SeasonGate {
  indexSpine: (games: SpineGame[]) => Map<string, Map<string, Map<string, SpineGame[]>>>;
  joinTeamPromos: (promos: PromoRow[], spineIndex: unknown, opts: { eligibleSeasonTypes: string[] }) => JoinTeamResult;
  joinPromo: (promo: PromoRow, spineIndex: unknown, opts: { eligibleSeasonTypes: string[]; teamSlug?: string }) => JoinOk | JoinHeld;
  JOIN_REASONS: Record<string, string>;
}

const ELIGIBLE = ['regular', 'preseason'];

// Does the stored opponent string name the club the spine says was the
// visitor that night? The join is date-only, so this is the one extra check
// the spine makes possible: a real date attached to the wrong game shows up
// here as a mismatch. Nickname match on the slug's last token, with Utah
// special-cased because its doc id is utah-hockey-club and its names vary.
function opponentMatches(opponent: string | null, awaySlug: string): boolean | null {
  if (!opponent) return null;
  const o = opponent.toLowerCase();
  // Utah: doc id utah-hockey-club, current name Mammoth, and the 2024-25
  // name Utah Hockey Club still appears in stored rows as "Hockey Club".
  if (awaySlug === 'utah-hockey-club') return o.includes('utah') || o.includes('mammoth') || o.includes('hockey club');
  const nick = awaySlug.split('-').slice(-1)[0];
  return o.includes(nick);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// Diagnose a non-joining row from the spine: is the club away that day, or is
// there a home game within three days, or nothing near at all?
function diagnose(row: PromoRow, games: SpineGame[]): string {
  if (!row.date) return 'no date on the row';
  const home = games.filter((g) => g.homeTeamSlug === row.teamSlug);
  const away = games.filter((g) => g.awayTeamSlug === row.teamSlug);
  const awayThatDay = away.find((g) => g.date === row.date);
  if (awayThatDay) return `ROAD GAME that day (at ${awayThatDay.homeTeamSlug}); the row is dated on an away fixture`;
  const near = home
    .map((g) => ({ g, d: daysBetween(row.date as string, g.date) }))
    .filter((x) => Math.abs(x.d) <= 3)
    .sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  if (near.length) {
    const n = near[0];
    return `no home game that day; nearest home game ${n.g.date} vs ${n.g.awayTeamSlug} (${n.d > 0 ? '+' : ''}${n.d} days), reads as a date shift or club typo`;
  }
  const inWindow = row.date >= '2026-09-01' && row.date <= '2027-06-30';
  return inWindow ? 'no home game within three days; a date the schedule does not carry' : 'outside the 2026-27 window';
}

async function main() {
  const gamesPath = arg('games');
  if (!gamesPath) {
    console.error('--games=<dry-run json> is required');
    process.exit(2);
  }
  const today = arg('today') ?? new Date().toISOString().slice(0, 10);
  const seasonGatePath = arg('season-gate') ?? '/Users/mattkovalik/promonight/promo-pipeline/lib/scanner/season-gate.js';
  const outPath = arg('out');

  const requireCjs = createRequire(process.cwd() + '/');
  const gate = requireCjs(seasonGatePath) as SeasonGate;
  const games = JSON.parse(readFileSync(gamesPath, 'utf8')) as SpineGame[];
  const spineIndex = gate.indexSpine(games);
  console.log(`[measure] spine: ${games.length} game docs from ${gamesPath}; clubs indexed ${spineIndex.size}; today=${today}`);

  // Firestore reads: two queries, read-only.
  let reads = 0;
  const teamsSnap = await db.collection('teams').where('league', '==', 'NHL').get();
  reads += 1;
  const slugs = new Set(teamsSnap.docs.map((d) => d.id));
  const allPromos = await db.collectionGroup('promos').get();
  reads += 1;

  const byClub = new Map<string, PromoRow[]>();
  let nhlDocs = 0;
  let tombstoned = 0;
  let past = 0;
  for (const d of allPromos.docs) {
    const team = d.ref.parent.parent?.id;
    if (!team || !slugs.has(team)) continue;
    nhlDocs += 1;
    const x = d.data() as Record<string, unknown>;
    if (x.tombstoned === true) {
      tombstoned += 1;
      continue;
    }
    const date = typeof x.date === 'string' ? x.date : null;
    if (date && date < today) {
      past += 1;
      continue;
    }
    if (!byClub.has(team)) byClub.set(team, []);
    byClub.get(team)!.push({
      promoId: d.id,
      teamSlug: team,
      date,
      title: typeof x.title === 'string' ? x.title : '',
      type: typeof x.type === 'string' ? x.type : null,
      opponent: typeof x.opponent === 'string' ? x.opponent : null,
    });
  }
  const upcoming = [...byClub.values()].reduce((n, a) => n + a.length, 0);
  console.log(`[measure] Firestore reads ${reads}; NHL promo docs ${nhlDocs}; tombstoned ${tombstoned}; past (< ${today}) ${past}; upcoming ${upcoming} across ${byClub.size} clubs`);

  // Join per club.
  interface ClubRow { club: string; total: number; one: number; onePreseason: number; zero: number; many: number; byReason: Record<string, number> }
  const table: ClubRow[] = [];
  const heldRows: Array<{ club: string; reason: string; detail: string; row: PromoRow; diagnosis: string }> = [];
  const opponentMismatch: Array<{ club: string; date: string; title: string; stored: string; spineAway: string }> = [];
  let opponentChecked = 0;
  for (const club of [...byClub.keys()].sort()) {
    const rows = byClub.get(club)!;
    const r = gate.joinTeamPromos(rows, spineIndex, { eligibleSeasonTypes: ELIGIBLE });
    const zero = r.held.filter((h) => h.reason !== gate.JOIN_REASONS.AMBIGUOUS).length;
    const many = r.held.filter((h) => h.reason === gate.JOIN_REASONS.AMBIGUOUS).length;
    const onePreseason = r.joined.filter((j) => j.seasonType === 'preseason').length;
    table.push({ club, total: r.stats.total, one: r.stats.joined, onePreseason, zero, many, byReason: r.stats.byReason });
    for (const h of r.held) heldRows.push({ club, reason: h.reason, detail: h.detail, row: h.promo, diagnosis: diagnose(h.promo, games) });
    for (const j of r.joined) {
      const g = games.find((x) => x.id === j.gameId);
      if (!g) continue;
      const m = opponentMatches(j.opponent, g.awayTeamSlug);
      if (m == null) continue;
      opponentChecked += 1;
      if (!m) opponentMismatch.push({ club, date: j.date as string, title: j.title, stored: j.opponent as string, spineAway: g.awayTeamSlug });
    }
  }

  console.log('');
  console.log('=== Join per club (upcoming stored promos vs dry-run spine) ===');
  console.log('club                      total   one  (pre)  zero  many  reasons');
  let tOne = 0, tZero = 0, tMany = 0, tTotal = 0, tPre = 0;
  for (const t of table) {
    tOne += t.one; tZero += t.zero; tMany += t.many; tTotal += t.total; tPre += t.onePreseason;
    console.log(`${t.club.padEnd(26)}${String(t.total).padStart(5)}${String(t.one).padStart(6)}${String(t.onePreseason).padStart(7)}${String(t.zero).padStart(6)}${String(t.many).padStart(6)}  ${JSON.stringify(t.byReason)}`);
  }
  console.log(`${'TOTAL'.padEnd(26)}${String(tTotal).padStart(5)}${String(tOne).padStart(6)}${String(tPre).padStart(7)}${String(tZero).padStart(6)}${String(tMany).padStart(6)}`);

  console.log('');
  console.log(`=== Every held row (${heldRows.length}) ===`);
  for (const h of heldRows) {
    console.log(`  ${h.club} | ${h.row.date} | ${h.row.type ?? '?'} | ${h.row.title} | opp=${h.row.opponent ?? ''} | ${h.reason}`);
    console.log(`      gate: ${h.detail}`);
    console.log(`      read: ${h.diagnosis}`);
  }

  console.log('');
  console.log(`=== Opponent consistency on joined rows (stored opponent vs spine visitor) ===`);
  console.log(`  rows with a stored opponent: ${opponentChecked}; mismatches: ${opponentMismatch.length}`);
  for (const m of opponentMismatch) console.log(`  ${m.club} | ${m.date} | ${m.title} | stored "${m.stored}" | spine ${m.spineAway}`);

  // Known-bad input: Calgary's seven bare-dated prior-season rows, verbatim
  // from the live page on 2026-09-01, with the weekday the page prints.
  // "Wed, Mar 18" is a Wednesday in 2026 and a Thursday in 2027, so the true
  // year is 2026 (prior season). A forward rollover rule would read them as
  // 2027. The gate sees only the date it is handed.
  const calgaryVerbatim: Array<{ title: string; monthDay: string; opponent: string }> = [
    { title: 'Regular Season', monthDay: '03-18', opponent: 'St. Louis Blues' },
    { title: "2000's Night", monthDay: '03-20', opponent: 'Florida Panthers' },
    { title: 'Regular Season', monthDay: '03-22', opponent: 'Tampa Bay Lightning' },
    { title: 'Scratchy Tuesday', monthDay: '03-24', opponent: 'Los Angeles Kings' },
    { title: 'Scratchy Tuesday', monthDay: '03-26', opponent: 'Anaheim Ducks' },
    { title: 'South Asian Celebration', monthDay: '03-28', opponent: 'Vancouver Canucks' },
    { title: 'Fan Appreciation', monthDay: '04-16', opponent: 'Los Angeles Kings' },
  ];
  console.log('');
  console.log('=== Known-bad input (6b.6): Calgary bare-dated prior-season rows ===');
  const calgaryHome = games.filter((g) => g.homeTeamSlug === 'calgary-flames' && g.date >= '2027-03-01' && g.date <= '2027-04-30').map((g) => `${g.date} vs ${g.awayTeamSlug}`);
  console.log(`  Flames 2027 Mar-Apr home dates in the spine: ${calgaryHome.join(', ') || 'none'}`);
  const calgaryResults: Array<{ title: string; date: string; year: string; ok: boolean; reason: string; detail: string; coincidental: boolean }> = [];
  for (const year of ['2027', '2026']) {
    for (const c of calgaryVerbatim) {
      const date = `${year}-${c.monthDay}`;
      const r = gate.joinPromo({ promoId: 'kb', teamSlug: 'calgary-flames', date, title: c.title, type: 'theme', opponent: c.opponent }, spineIndex, { eligibleSeasonTypes: ELIGIBLE, teamSlug: 'calgary-flames' });
      const ok = r.ok === true;
      // A coincidental join is a date that happens to carry a real 2027 home
      // game. Check whether the spine opponent matches the page opponent; a
      // mismatch is the tell that the row is on the wrong game.
      let coincidental = false;
      let detail = '';
      if (ok) {
        const j = r as JoinOk;
        coincidental = true;
        detail = `JOINED ${j.date} vs ${j.opponent ?? '?'} (page says vs ${c.opponent}); opponent ${j.opponent && c.opponent.toLowerCase().includes(String(j.opponent).split('-').slice(-1)[0]) ? 'MATCHES' : 'DIFFERS'}`;
      } else {
        const h = r as JoinHeld;
        detail = `${h.reason}: ${h.detail}`;
      }
      calgaryResults.push({ title: c.title, date, year, ok, reason: ok ? 'joined' : (r as JoinHeld).reason, detail, coincidental });
      console.log(`  ${year === '2027' ? 'forward-resolved' : 'true prior-season'}  ${date}  ${c.title.padEnd(24)} vs ${c.opponent.padEnd(20)} -> ${ok ? 'JOINED (coincidental)' : 'HELD'}  ${detail}`);
    }
  }
  const fwdHeld = calgaryResults.filter((r) => r.year === '2027' && !r.ok).length;
  const fwdJoined = calgaryResults.filter((r) => r.year === '2027' && r.ok).length;
  const priorHeld = calgaryResults.filter((r) => r.year === '2026' && !r.ok).length;
  console.log(`  forward-resolved 2027 rows: held ${fwdHeld}, joined by coincidence ${fwdJoined} of 7`);
  console.log(`  true 2026 rows: held ${priorHeld} of 7 (prior season is not in the spine)`);

  if (outPath) {
    writeFileSync(outPath, JSON.stringify({ today, gamesPath, reads, nhlDocs, tombstoned, past, upcoming, table, heldRows, opponentChecked, opponentMismatch, calgaryResults }, null, 1));
    console.log(`[measure] report written to ${outPath}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
