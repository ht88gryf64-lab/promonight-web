// Opponent-link audit (per-promo pages v2 content floor, 2026-11-07). READ
// ONLY. For every upcoming promo page (visible rows with a pageSlug dated
// today or later, one page per team + slug, its primary = earliest upcoming
// date), resolves the opponent the way the page does (src/lib/promo-pages.ts
// loadPromoPageContext): the games spine's home game on the primary date,
// one away club across the date, whose team doc exists -> a link; else the
// bare stored opponent string (or nothing). Reports the split and the most
// common unresolved strings.
//
// Run: node --env-file=.env.local --import tsx scripts/audit-opponent-links.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function main() {
  const [teamsSnap, promosSnap, gamesSnap] = await Promise.all([
    db.collection('teams').get(),
    db.collectionGroup('promos').where('date', '>=', today).orderBy('date', 'asc').get(),
    db.collection('games').where('date', '>=', today).get(),
  ]);
  const teams = new Map(teamsSnap.docs.map((d) => [d.id, d.data()]));
  const gamesByKey = new Map<string, { away: string; status: string }[]>();
  for (const d of gamesSnap.docs) {
    const g = d.data();
    if (!g.league || !g.date || !g.homeTeamSlug) continue;
    const k = `${String(g.league).toLowerCase()}|${g.date}|${g.homeTeamSlug}`;
    gamesByKey.set(k, [...(gamesByKey.get(k) ?? []), { away: g.awayTeamSlug, status: g.status ?? 'scheduled' }]);
  }
  // One page per team + slug: the earliest upcoming row is the primary.
  const pages = new Map<string, { teamId: string; league: string; date: string; opponent: string }>();
  for (const d of promosSnap.docs) {
    const x = d.data();
    if (x.tombstoned === true || x.isPostseason === true || typeof x.pageSlug !== 'string' || !x.pageSlug) continue;
    const teamId = d.ref.parent.parent?.id ?? '';
    const t = teams.get(teamId);
    if (!t) continue;
    const key = `${teamId}|${x.pageSlug}`;
    if (!pages.has(key)) pages.set(key, { teamId, league: String(t.league), date: x.date, opponent: typeof x.opponent === 'string' ? x.opponent.trim() : '' });
  }
  let linked = 0;
  const byLeague = new Map<string, { linked: number; bare: number }>();
  const unresolved = new Map<string, number>();
  const reasons = new Map<string, number>();
  for (const p of pages.values()) {
    const key = `${p.league.toLowerCase()}|${p.date}|${p.teamId}`;
    const onDate = (gamesByKey.get(key) ?? []).filter((g) => g.status !== 'postponed' && g.status !== 'canceled');
    const aways = new Set(onDate.map((g) => g.away));
    const away = aways.size === 1 ? [...aways][0] : null;
    const ok = !!away && teams.has(away);
    const lb = byLeague.get(p.league) ?? { linked: 0, bare: 0 };
    if (ok) {
      linked++;
      lb.linked++;
    } else {
      lb.bare++;
      const label = p.opponent || '(no opponent stored)';
      unresolved.set(label, (unresolved.get(label) ?? 0) + 1);
      const why = onDate.length === 0 ? (['MLB', 'NFL', 'NHL', 'NBA'].includes(p.league) ? 'no spine game on the date' : 'league has no games spine') : aways.size > 1 ? 'two home games, two opponents' : 'away slug has no team doc';
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    byLeague.set(p.league, lb);
  }
  const total = pages.size;
  console.log(`today=${today}  upcoming promo pages=${total}  opponent linked=${linked} (${((100 * linked) / total).toFixed(1)}%)  bare or none=${total - linked} (${((100 * (total - linked)) / total).toFixed(1)}%)`);
  console.log('by league:');
  for (const [l, v] of [...byLeague.entries()].sort()) console.log(`  ${l}: linked=${v.linked} bare=${v.bare}`);
  console.log('why bare:');
  for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${r}`);
  console.log('top unresolved opponent strings:');
  for (const [s, n] of [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${n}  ${JSON.stringify(s)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
