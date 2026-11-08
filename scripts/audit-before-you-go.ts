// "Before you go" audit (per-promo pages v2, build order step 4, 2026-11-08).
// READ ONLY. Counts, in the venueHubs provenance corpus, the buildings with at
// least one field in state `rendered` for each of the four classes the block
// renders (bag policy, parking, gates/doors, transit), broken down by league
// through the building's `tenants[].league`, and the upcoming promo pages
// whose building has no rendered field at all (those pages get no block).
// Also reports which doc fields hold lat/lng on venueHubs and venues, and
// whether any indoor/outdoor flag exists anywhere in the three collections.
//
// A `rendered` state is read literally from `fieldStates` (the pipeline's
// venuehubs-write-guard FIELD_STATES). A legacy doc with no state map has no
// rendered field here, whatever its sources map says: the block keys on the
// state, so the audit does too. The block also needs the field's own read
// time (observedAtByField), so each class reports both counts.
//
// Run: node --env-file=.env.local --import tsx scripts/audit-before-you-go.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKET_PACKAGE_LEAGUES = new Set(['NHL', 'NBA']);

type Data = Record<string, unknown>;
const obj = (v: unknown): Data => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Data) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

// The four classes and the state-map keys that make each one up. Gates live on
// the tenant overlay (venueHubs/{slug}/tenants/{teamId}.fieldStates.gatesOpen).
const BUILDING_CLASSES: Record<'bag' | 'parking' | 'transit', string[]> = {
  bag: ['bagMaxDimensions', 'clearBagRequired', 'bagsProhibited', 'bagPolicyNotes'],
  parking: ['parkingLots'],
  transit: ['publicTransit'],
};
type Cls = 'bag' | 'parking' | 'gates' | 'transit';
const CLASSES: Cls[] = ['bag', 'parking', 'gates', 'transit'];

interface HubFacts {
  slug: string;
  verified: boolean;
  leagues: Set<string>;
  teamIds: Set<string>;
  /** Gates are per TENANT on the page (before-you-go-rows overlayFor): the teams whose own overlay has the gate rule rendered, and rendered with a read time. */
  gatesTeams: Set<string>;
  gatesDatedTeams: Set<string>;
  hasStateMap: boolean;
  /** Per class: any key in state rendered. */
  rendered: Record<Cls, boolean>;
  /** Per class: any rendered key that also carries its observedAtByField read time. */
  renderedDated: Record<Cls, boolean>;
  /** Per class: the other states seen on its keys. */
  otherStates: Record<Cls, Set<string>>;
  lat: unknown;
  lng: unknown;
}

const flagRe = /indoor|outdoor|roof|dome|covered|open.?air|retractable/i;
const geoRe = /^(lat|lng|lon|long|latitude|longitude|geo|coords?|coordinates|location)$/i;
const flagKeys = new Map<string, number>();
const geoKeys = new Map<string, number>();
function scanKeys(where: string, d: Data) {
  for (const [k, v] of Object.entries(d)) {
    if (flagRe.test(k)) flagKeys.set(`${where}.${k}`, (flagKeys.get(`${where}.${k}`) ?? 0) + 1);
    if (geoRe.test(k)) geoKeys.set(`${where}.${k}:${typeof v}`, (geoKeys.get(`${where}.${k}:${typeof v}`) ?? 0) + 1);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const kk of Object.keys(v as Data)) {
        if (flagRe.test(kk)) flagKeys.set(`${where}.${k}.${kk}`, (flagKeys.get(`${where}.${k}.${kk}`) ?? 0) + 1);
        if (geoRe.test(kk)) geoKeys.set(`${where}.${k}.${kk}`, (geoKeys.get(`${where}.${k}.${kk}`) ?? 0) + 1);
      }
    }
  }
}

async function main() {
  const [hubSnap, tenantSnap, venueSnap, teamSnap] = await Promise.all([
    db.collection('venueHubs').get(),
    db.collectionGroup('tenants').get(),
    db.collection('venues').get(),
    db.collection('teams').get(),
  ]);
  const tenantsByHub = new Map<string, Data[]>();
  for (const td of tenantSnap.docs) {
    if (!td.ref.path.startsWith('venueHubs/')) continue;
    const hub = td.ref.parent.parent!.id;
    const list = tenantsByHub.get(hub) ?? [];
    list.push(td.data());
    tenantsByHub.set(hub, list);
    scanKeys('tenants', td.data());
  }

  const hubs: HubFacts[] = [];
  let tenantDocs = 0, tenantStateMaps = 0, tenantGatesRendered = 0, tenantGatesDated = 0, tenantGatesSourcedRule = 0;
  for (const doc of hubSnap.docs) {
    const d = doc.data();
    scanKeys('venueHubs', d);
    const states = obj(d.fieldStates) as Record<string, string>;
    const observed = obj(d.observedAtByField);
    const tenants = Array.isArray(d.tenants) ? (d.tenants as Data[]) : [];
    const f: HubFacts = {
      slug: doc.id,
      verified: d.verified === true,
      leagues: new Set(tenants.map((t) => str(t.league)).filter((x): x is string => !!x)),
      teamIds: new Set(tenants.map((t) => str(t.teamId)).filter((x): x is string => !!x)),
      gatesTeams: new Set(),
      gatesDatedTeams: new Set(),
      hasStateMap: Object.keys(states).length > 0,
      rendered: { bag: false, parking: false, gates: false, transit: false },
      renderedDated: { bag: false, parking: false, gates: false, transit: false },
      otherStates: { bag: new Set(), parking: new Set(), gates: new Set(), transit: new Set() },
      lat: d.lat,
      lng: d.lng,
    };
    for (const cls of ['bag', 'parking', 'transit'] as const) {
      for (const [key, state] of Object.entries(states)) {
        const base = key.split('.')[0];
        if (!BUILDING_CLASSES[cls].includes(base)) continue;
        if (state === 'rendered') {
          f.rendered[cls] = true;
          if (str(observed[key]) || str(observed[base])) f.renderedDated[cls] = true;
        } else f.otherStates[cls].add(state);
      }
    }
    for (const t of tenantsByHub.get(doc.id) ?? []) {
      tenantDocs++;
      const ts = obj(t.fieldStates) as Record<string, string>;
      const to = obj(t.observedAtByField);
      const tsrc = obj(t.sources);
      if (Object.keys(ts).length) tenantStateMaps++;
      const gateState = ts.gatesOpen ?? ts['gatesOpen.ruleText'];
      const ruleText = str(obj(t.gatesOpen).ruleText);
      if (ruleText && t.verified === true && (tsrc.gatesOpen || tsrc['gatesOpen.ruleText'])) tenantGatesSourcedRule++;
      if (gateState === 'rendered') {
        tenantGatesRendered++;
        f.rendered.gates = true;
        if (str(t.teamId)) f.gatesTeams.add(t.teamId as string);
        if (str(to.gatesOpen) || str(to['gatesOpen.ruleText'])) { f.renderedDated.gates = true; tenantGatesDated++; if (str(t.teamId)) f.gatesDatedTeams.add(t.teamId as string); }
      } else if (gateState) f.otherStates.gates.add(gateState);
    }
    hubs.push(f);
  }

  // ── A. the corpus ─────────────────────────────────────────────────────────
  console.log(`\n=== venueHubs corpus (${today}) ===`);
  console.log(`buildings: ${hubs.length}; verified: ${hubs.filter((h) => h.verified).length}; with a fieldStates map: ${hubs.filter((h) => h.hasStateMap).length}`);
  console.log(`tenant overlays: ${tenantDocs}; with a fieldStates map: ${tenantStateMaps}; gatesOpen rendered: ${tenantGatesRendered} (with read time: ${tenantGatesDated}); verified + sourced rule text (the venue page's gate rule, any state): ${tenantGatesSourcedRule}`);

  const leagues = [...new Set(hubs.flatMap((h) => [...h.leagues]))].sort();
  const count = (pred: (h: HubFacts) => boolean, league?: string) => hubs.filter((h) => (league ? h.leagues.has(league) : true) && pred(h)).length;
  const row = (label: string, pred: (h: HubFacts) => boolean) =>
    console.log(`${label.padEnd(34)} all ${String(count(pred)).padStart(3)}  ` + leagues.map((l) => `${l} ${String(count(pred, l)).padStart(3)}`).join('  '));

  console.log(`\n=== buildings with >=1 field in state rendered, by class and league (a shared building counts in each of its leagues) ===`);
  console.log(`${'buildings in league'.padEnd(34)} all ${String(hubs.length).padStart(3)}  ` + leagues.map((l) => `${l} ${String(count(() => true, l)).padStart(3)}`).join('  '));
  for (const cls of CLASSES) {
    row(`${cls}: rendered`, (h) => h.rendered[cls]);
    row(`${cls}: rendered + read time`, (h) => h.renderedDated[cls]);
  }
  row('any class rendered', (h) => CLASSES.some((c) => h.rendered[c]));
  row('any class rendered + read time', (h) => CLASSES.some((c) => h.renderedDated[c]));
  row('all four rendered + read time', (h) => CLASSES.every((c) => h.renderedDated[c]));
  row('zero rendered fields', (h) => !CLASSES.some((c) => h.rendered[c]));
  // The published view (src/lib/venue-published-view.ts) nulls every claim on
  // a building nobody signed off, before the state map is consulted. So the
  // block's real condition is verified AND rendered AND dated.
  console.log(`\n=== the block's condition: verified building, field rendered, read time present ===`);
  for (const cls of CLASSES) row(`${cls}: verified + rendered + read time`, (h) => h.verified && h.renderedDated[cls]);
  row('any class (a block renders)', (h) => h.verified && CLASSES.some((c) => h.renderedDated[c]));
  row('rendered + dated but NOT verified', (h) => !h.verified && CLASSES.some((c) => h.renderedDated[c]));

  console.log(`\n=== other states seen, by class (buildings carrying at least one key in that state) ===`);
  for (const cls of CLASSES) {
    const tally = new Map<string, number>();
    for (const h of hubs) for (const s of h.otherStates[cls]) tally.set(s, (tally.get(s) ?? 0) + 1);
    console.log(`${cls.padEnd(10)} ${[...tally.entries()].map(([s, n]) => `${s} ${n}`).join(', ') || 'none'}`);
  }

  // ── B. upcoming promo pages ───────────────────────────────────────────────
  const teams = new Map(teamSnap.docs.map((d) => [d.id, d.data()]));
  const hubByTeam = new Map<string, HubFacts>();
  for (const h of hubs) for (const t of h.teamIds) if (!hubByTeam.has(t)) hubByTeam.set(t, h);
  const promoSnap = await db.collectionGroup('promos').where('date', '>=', today).get();
  const pages = new Map<string, { teamId: string; league: string }>();
  for (const d of promoSnap.docs) {
    const teamId = d.ref.parent.parent?.id ?? '';
    const team = teams.get(teamId);
    if (!team) continue;
    const data = d.data();
    if (data.tombstoned === true || data.isPostseason === true) continue;
    const pageSlug = str(data.pageSlug);
    const date = typeof data.date === 'string' && YMD_RE.test(data.date) ? data.date : null;
    if (!pageSlug || !date || !str(data.title)) continue;
    const league = String(team.league ?? '').toUpperCase();
    if (TICKET_PACKAGE_LEAGUES.has(league) && data.ticketPackageRequired === true) continue;
    pages.set(`${teamId}/${pageSlug}`, { teamId, league });
  }
  const pageList = [...pages.values()];
  const pageLeagues = [...new Set(pageList.map((p) => p.league))].sort();
  const pcount = (pred: (p: { teamId: string; league: string }, h: HubFacts | undefined) => boolean, league?: string) =>
    pageList.filter((p) => (league ? p.league === league : true) && pred(p, pageView(hubByTeam.get(p.teamId), p.teamId))).length;
  // A page sees its building's classes, except gates, which is its own team's overlay
  // (fixed 2026-11-08: a co-tenant's gate rule counted for every team in the building).
  function pageView(h: HubFacts | undefined, teamId: string): HubFacts | undefined {
    if (!h) return h;
    return { ...h, rendered: { ...h.rendered, gates: h.gatesTeams.has(teamId) }, renderedDated: { ...h.renderedDated, gates: h.gatesDatedTeams.has(teamId) } };
  }
  const prow = (label: string, pred: (p: { teamId: string; league: string }, h: HubFacts | undefined) => boolean) =>
    console.log(`${label.padEnd(44)} all ${String(pcount(pred)).padStart(4)}  ` + pageLeagues.map((l) => `${l} ${String(pcount(pred, l)).padStart(4)}`).join('  '));

  console.log(`\n=== upcoming promo pages (date >= ${today}, visible, with a pageSlug, special-ticket packs excluded) ===`);
  prow('pages', () => true);
  prow('team is not a venueHubs tenant (no building)', (_, h) => !h);
  prow('building has zero rendered fields (no block)', (_, h) => !!h && !CLASSES.some((c) => h.rendered[c]));
  prow('no block at all (no building or zero rendered)', (_, h) => !h || !CLASSES.some((c) => h.rendered[c]));
  prow('building has >=1 rendered field', (_, h) => !!h && CLASSES.some((c) => h.rendered[c]));
  prow('>=1 rendered field with a read time', (_, h) => !!h && CLASSES.some((c) => h.renderedDated[c]));
  prow('  ... on an UNVERIFIED building (view nulls it)', (_, h) => !!h && !h.verified && CLASSES.some((c) => h.renderedDated[c]));
  prow('A BLOCK RENDERS (verified + rendered + dated)', (_, h) => !!h && h.verified && CLASSES.some((c) => h.renderedDated[c]));
  prow('NO BLOCK (everything else)', (_, h) => !(!!h && h.verified && CLASSES.some((c) => h.renderedDated[c])));
  prow('all four classes render', (_, h) => !!h && h.verified && CLASSES.every((c) => h.renderedDated[c]));
  for (const cls of CLASSES) prow(`  pages whose block has a ${cls} row`, (_, h) => !!h && h.verified && h.renderedDated[cls]);
  const teamsNoHub = new Map<string, number>();
  for (const p of pageList) if (!hubByTeam.get(p.teamId)) teamsNoHub.set(p.teamId, (teamsNoHub.get(p.teamId) ?? 0) + 1);
  if (teamsNoHub.size) console.log(`teams with pages but no building: ${[...teamsNoHub.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} (${n})`).join(', ')}`);

  // ── C. coordinates and the indoor/outdoor question ────────────────────────
  for (const d of venueSnap.docs) scanKeys('venues', d.data());
  const hubLatLng = hubs.filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number' && !(h.lat === 0 && h.lng === 0)).length;
  const venueLatLng = venueSnap.docs.filter((d) => { const x = d.data(); return typeof x.lat === 'number' && typeof x.lng === 'number' && !(x.lat === 0 && x.lng === 0); }).length;
  console.log(`\n=== coordinates ===`);
  console.log(`venueHubs/{slug}.lat + .lng numeric (non-zero): ${hubLatLng} of ${hubs.length}`);
  console.log(`venues/{slug}.lat + .lng numeric (non-zero): ${venueLatLng} of ${venueSnap.size}`);
  console.log(`geo-shaped keys seen (collection.key:type -> docs): ${[...geoKeys.entries()].sort().map(([k, n]) => `${k} ${n}`).join('; ') || 'none'}`);
  console.log(`\n=== indoor/outdoor flag ===`);
  console.log(`keys matching /indoor|outdoor|roof|dome|covered|open-air|retractable/i on venueHubs, tenants, venues (top level and one level down): ${flagKeys.size ? [...flagKeys.entries()].map(([k, n]) => `${k} (${n})`).join(', ') : 'NONE'}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
