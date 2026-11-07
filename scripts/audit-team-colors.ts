// Team colors audit (per-promo pages v2, content floor step 1, 2026-11-07).
// READ ONLY. For every team with at least one upcoming promo page (a visible
// promo dated today or later carrying a pageSlug), reports whether the team
// doc stores both primaryColor and secondaryColor as the ARGB integers
// mapTeamDoc (src/lib/data.ts argbToHex) turns into the hex the tier 3 card
// route (src/app/api/promo-card) and the share card read. Also reports the
// `venues` collection's primaryColor/accentColor, a second copy of a color
// that nothing on the promo page reads, so the ruling "one source" can be
// checked rather than assumed.
//
// Run: node --env-file=.env.local --import tsx scripts/audit-team-colors.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();

const argbToHex = (argb: number): string => `#${(argb & 0x00ffffff).toString(16).padStart(6, '0')}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

type ColorState = { raw: unknown; hex: string | null; state: 'ok' | 'missing' | 'not-a-number' | 'black-sentinel' | 'white' };
function classify(raw: unknown): ColorState {
  if (raw === undefined || raw === null) return { raw, hex: null, state: 'missing' };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { raw, hex: null, state: 'not-a-number' };
  const hex = argbToHex(raw);
  if (hex === '#000000') return { raw, hex, state: 'black-sentinel' };
  if (hex === '#ffffff') return { raw, hex, state: 'white' };
  return { raw, hex, state: 'ok' };
}

async function main() {
  const [teamsSnap, upcomingSnap, venuesSnap] = await Promise.all([
    db.collection('teams').get(),
    db.collectionGroup('promos').where('date', '>=', today).orderBy('date', 'asc').get(),
    db.collection('venues').get(),
  ]);
  const teams = new Map(teamsSnap.docs.map((d) => [d.id, d.data()]));
  const pagesByTeam = new Map<string, number>();
  for (const d of upcomingSnap.docs) {
    const x = d.data();
    if (x.tombstoned === true || x.isPostseason === true) continue;
    if (typeof x.pageSlug !== 'string' || !x.pageSlug) continue;
    const teamId = d.ref.parent.parent?.id ?? '';
    if (!teams.has(teamId)) continue;
    pagesByTeam.set(teamId, (pagesByTeam.get(teamId) ?? 0) + 1);
  }
  const venueColorsByTeam = new Map<string, { primaryColor: unknown; accentColor: unknown }>();
  for (const d of venuesSnap.docs) {
    const x = d.data();
    if (typeof x.teamId === 'string') venueColorsByTeam.set(x.teamId, { primaryColor: x.primaryColor, accentColor: x.accentColor });
  }

  const rows = [...pagesByTeam.entries()].sort((a, b) => b[1] - a[1]).map(([teamId, pages]) => {
    const t = teams.get(teamId)!;
    const p = classify(t.primaryColor);
    const s = classify(t.secondaryColor);
    return { teamId, league: t.league, pages, primary: p, secondary: s, same: p.hex !== null && p.hex === s.hex, venueCopy: venueColorsByTeam.get(teamId) ?? null };
  });

  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  console.log(`today=${today}  teams=${teams.size}  upcoming promo docs=${upcomingSnap.size}  teams with upcoming pages=${rows.length}  pages=${[...pagesByTeam.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`primary ok=${count((r) => r.primary.state === 'ok')}  secondary ok=${count((r) => r.secondary.state === 'ok')}  both ok=${count((r) => r.primary.state === 'ok' && r.secondary.state === 'ok')}  primary==secondary=${count((r) => r.same)}`);
  console.log(`primary states: ${JSON.stringify(Object.fromEntries(['ok', 'missing', 'not-a-number', 'black-sentinel', 'white'].map((k) => [k, count((r) => r.primary.state === k)])))}`);
  console.log(`secondary states: ${JSON.stringify(Object.fromEntries(['ok', 'missing', 'not-a-number', 'black-sentinel', 'white'].map((k) => [k, count((r) => r.secondary.state === k)])))}`);
  const gaps = rows.filter((r) => r.primary.state !== 'ok' || r.secondary.state !== 'ok' || r.same);
  console.log(`\nGAPS (${gaps.length}):`);
  for (const r of gaps) console.log(`  ${r.teamId} (${r.league}, ${r.pages} pages): primary=${r.primary.state}${r.primary.hex ? ' ' + r.primary.hex : ''} secondary=${r.secondary.state}${r.secondary.hex ? ' ' + r.secondary.hex : ''}${r.same ? ' SAME' : ''}`);
  // Second copy: venues.primaryColor vs teams.primaryColor.
  const withVenue = rows.filter((r) => r.venueCopy && r.venueCopy.primaryColor !== undefined);
  const differ = withVenue.filter((r) => typeof r.venueCopy!.primaryColor === 'string' && r.primary.hex && r.venueCopy!.primaryColor.toLowerCase() !== r.primary.hex.toLowerCase());
  console.log(`\nSECOND COPY: venues.primaryColor present for ${withVenue.length} of ${rows.length} teams; differs from teams.primaryColor on ${differ.length}`);
  for (const r of differ.slice(0, 12)) console.log(`  ${r.teamId}: teams=${r.primary.hex} venues=${r.venueCopy!.primaryColor}`);
  // Field types across ALL team docs (not just those with pages), for the "one source" check.
  const types = new Map<string, number>();
  for (const t of teams.values()) for (const k of ['primaryColor', 'secondaryColor']) { const ty = `${k}:${t[k] === undefined ? 'undefined' : typeof t[k]}`; types.set(ty, (types.get(ty) ?? 0) + 1); }
  console.log(`\nALL TEAM DOCS field types: ${JSON.stringify(Object.fromEntries(types))}`);
  const otherColorFields = new Set<string>();
  for (const t of teams.values()) for (const k of Object.keys(t)) if (/colou?r|hex|brand/i.test(k) && !['primaryColor', 'secondaryColor'].includes(k)) otherColorFields.add(k);
  console.log(`other color-like fields on team docs: ${[...otherColorFields].join(', ') || 'none'}`);
  // Full table (the report's appendix)
  console.log('\nTABLE teamId league pages primary secondary');
  for (const r of rows) console.log(`  ${r.teamId} ${r.league} ${r.pages} ${r.primary.hex ?? r.primary.state} ${r.secondary.hex ?? r.secondary.state}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
