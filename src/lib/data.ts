import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';
import type {
  Team,
  Promo,
  PromoWithTeam,
  Venue,
  PromoType,
  PlayoffPromo,
  PlayoffPromoWithTeam,
  PlayoffPromoType,
  PlayoffConfig,
  ActivePlayoffTeam,
} from './types';
import { resolveIcon, dedupePromos } from './promo-helpers';

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return null;
}

function argbToHex(argb: number): string {
  const hex = (argb & 0x00ffffff).toString(16).padStart(6, '0');
  return `#${hex}`;
}

function mapTeamDoc(doc: FirebaseFirestore.DocumentSnapshot): Team {
  const data = doc.data()!;
  return {
    id: doc.id,
    city: data.city,
    name: data.name,
    abbreviation: data.abbreviation,
    primaryColor: argbToHex(data.primaryColor),
    secondaryColor: argbToHex(data.secondaryColor),
    league: data.league,
    sportSlug: data.league.toLowerCase(),
    division: data.division,
  };
}

function mapPromoDoc(doc: FirebaseFirestore.DocumentSnapshot): Promo {
  const data = doc.data()!;
  const type = data.type as PromoType;
  return {
    date: data.date,
    time: data.time || '',
    opponent: data.opponent || '',
    type,
    title: data.title,
    description: data.description || '',
    highlight: data.highlight || false,
    icon: resolveIcon(data.title, type, data.icon || ''),
    recurring: data.recurring || false,
  };
}

export async function getAllTeams(): Promise<Team[]> {
  const snapshot = await db.collection('teams').get();
  const teams = snapshot.docs.map(mapTeamDoc);
  teams.sort((a, b) => a.league.localeCompare(b.league) || a.city.localeCompare(b.city));
  return teams;
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  const doc = await db.collection('teams').doc(slug).get();
  if (!doc.exists) return null;
  return mapTeamDoc(doc);
}

export async function getTeamPromos(teamId: string): Promise<Promo[]> {
  const snapshot = await db
    .collection('teams')
    .doc(teamId)
    .collection('promos')
    .orderBy('date', 'asc')
    .get();
  return dedupePromos(snapshot.docs.map(mapPromoDoc));
}

export async function getHighlightedPromos(limit: number = 6): Promise<PromoWithTeam[]> {
  const today = new Date().toISOString().split('T')[0];

  // Try collection group query first (requires composite index).
  // Fall back to per-team sampling if the index doesn't exist yet.
  try {
    const snapshot = await db
      .collectionGroup('promos')
      .where('highlight', '==', true)
      .where('date', '>=', today)
      .orderBy('date', 'asc')
      .limit(limit)
      .get();

    const results: PromoWithTeam[] = [];
    for (const doc of snapshot.docs) {
      const teamRef = doc.ref.parent.parent!;
      const teamDoc = await teamRef.get();
      if (teamDoc.exists) {
        results.push({
          ...mapPromoDoc(doc),
          team: mapTeamDoc(teamDoc),
        });
      }
    }
    return results;
  } catch {
    // Fallback: sample highlighted promos from a few teams
    const teams = await getAllTeams();
    const sampleTeams = teams.slice(0, 30);
    const allHighlighted: PromoWithTeam[] = [];

    await Promise.all(
      sampleTeams.map(async (team) => {
        const snapshot = await db
          .collection('teams')
          .doc(team.id)
          .collection('promos')
          .where('highlight', '==', true)
          .get();
        for (const doc of snapshot.docs) {
          const promo = mapPromoDoc(doc);
          if (promo.date >= today) {
            allHighlighted.push({ ...promo, team });
          }
        }
      })
    );

    allHighlighted.sort((a, b) => a.date.localeCompare(b.date));
    return allHighlighted.slice(0, limit);
  }
}

// Returns every promo (across all teams) within [startDate, endDate], inclusive.
// Dates are YYYY-MM-DD strings. Used for cross-team aggregator pages.
export async function getPromosInDateRange(
  startDate: string,
  endDate: string,
): Promise<PromoWithTeam[]> {
  const teams = await getAllTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  try {
    const snapshot = await db
      .collectionGroup('promos')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get();

    const results: PromoWithTeam[] = [];
    for (const doc of snapshot.docs) {
      const teamRef = doc.ref.parent.parent!;
      const team = teamById.get(teamRef.id);
      if (team) {
        results.push({ ...mapPromoDoc(doc), team });
      }
    }
    return dedupePromos(results, (p) => p.team.id);
  } catch {
    const allPromos: PromoWithTeam[] = [];
    await Promise.all(
      teams.map(async (team) => {
        const snapshot = await db
          .collection('teams')
          .doc(team.id)
          .collection('promos')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .get();
        for (const doc of snapshot.docs) {
          allPromos.push({ ...mapPromoDoc(doc), team });
        }
      })
    );
    allPromos.sort((a, b) => a.date.localeCompare(b.date));
    return dedupePromos(allPromos, (p) => p.team.id);
  }
}

// Returns every promo across all teams from `startDate` forward.
// Used for aggregator pages that filter by keyword or type.
export async function getPromosFromDate(startDate: string): Promise<PromoWithTeam[]> {
  const teams = await getAllTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  try {
    const snapshot = await db
      .collectionGroup('promos')
      .where('date', '>=', startDate)
      .orderBy('date', 'asc')
      .get();

    const results: PromoWithTeam[] = [];
    for (const doc of snapshot.docs) {
      const teamRef = doc.ref.parent.parent!;
      const team = teamById.get(teamRef.id);
      if (team) {
        results.push({ ...mapPromoDoc(doc), team });
      }
    }
    return dedupePromos(results, (p) => p.team.id);
  } catch {
    const allPromos: PromoWithTeam[] = [];
    await Promise.all(
      teams.map(async (team) => {
        const snapshot = await db
          .collection('teams')
          .doc(team.id)
          .collection('promos')
          .where('date', '>=', startDate)
          .get();
        for (const doc of snapshot.docs) {
          allPromos.push({ ...mapPromoDoc(doc), team });
        }
      })
    );
    allPromos.sort((a, b) => a.date.localeCompare(b.date));
    return dedupePromos(allPromos, (p) => p.team.id);
  }
}

export async function getPromoCount(): Promise<number> {
  const snapshot = await db.collectionGroup('promos').count().get();
  return snapshot.data().count;
}

export async function getVenueForTeam(teamId: string): Promise<Venue | null> {
  // Venues use a short teamId like "min", but we need to match by team name
  // Try querying by the full team name first
  const team = await getTeamBySlug(teamId);
  if (!team) return null;

  const fullName = `${team.city} ${team.name}`;
  const snapshot = await db
    .collection('venues')
    .where('team', '==', fullName)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const data = snapshot.docs[0].data();
  return {
    name: data.name,
    address: data.address,
    team: data.team,
    sport: data.sport,
    sportIcon: data.sportIcon,
    primaryColor: data.primaryColor,
    accentColor: data.accentColor,
    lat: data.lat,
    lng: data.lng,
    hasAmenityData: data.hasAmenityData,
    amenityCount: data.amenityCount,
    gatesOpen: data.gatesOpen,
    league: data.league,
    teamId: data.teamId,
  };
}

// ── Playoff data layer ─────────────────────────────────────────────────────

function mapPlayoffPromoDoc(
  doc: FirebaseFirestore.DocumentSnapshot,
): PlayoffPromo {
  const data = doc.data()!;
  return {
    teamId: data.teamId,
    league: data.league,
    round: data.round,
    title: data.title || '',
    description: data.description || '',
    date: tsToIso(data.date),
    gameInfo: data.gameInfo || '',
    type: (data.type || 'event') as PlayoffPromoType,
    recurring: data.recurring || false,
    recurringDetail: data.recurringDetail || '',
    highlight: data.highlight || false,
    isPlayoff: data.isPlayoff !== false,
    teamName: data.teamName || '',
    teamAbbr: data.teamAbbr || '',
    source: data.source || '',
    createdAt: tsToIso(data.createdAt) || '',
    updatedAt: tsToIso(data.updatedAt) || '',
  };
}

function sortByDateThenCreated(a: PlayoffPromo, b: PlayoffPromo): number {
  // Dated promos first (asc), recurring (null date) last, stable by createdAt.
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  if (a.date && b.date) return a.date.localeCompare(b.date);
  return a.createdAt.localeCompare(b.createdAt);
}

export async function getPlayoffConfig(): Promise<PlayoffConfig | null> {
  const doc = await db.collection('appConfig').doc('playoffs').get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    playoffsActive: data.playoffsActive === true,
    nbaActive: data.nbaActive === true,
    nhlActive: data.nhlActive === true,
    nbaRound: data.nbaRound || 'first_round',
    nhlRound: data.nhlRound || 'first_round',
    activeTeamIds: Array.isArray(data.activeTeamIds) ? data.activeTeamIds : [],
    eliminatedTeamIds: Array.isArray(data.eliminatedTeamIds)
      ? data.eliminatedTeamIds
      : [],
    lastScanDate: tsToIso(data.lastScanDate),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export async function isTeamInPlayoffs(
  teamId: string,
  config?: PlayoffConfig | null,
): Promise<boolean> {
  const cfg = config ?? (await getPlayoffConfig());
  if (!cfg || !cfg.playoffsActive) return false;
  return cfg.activeTeamIds.includes(teamId);
}

export async function getActivePlayoffTeams(): Promise<ActivePlayoffTeam[]> {
  const config = await getPlayoffConfig();
  if (!config || !config.playoffsActive || config.activeTeamIds.length === 0) {
    return [];
  }
  const teamDocs = await Promise.all(
    config.activeTeamIds.map((id) => db.collection('teams').doc(id).get()),
  );
  const results: ActivePlayoffTeam[] = [];
  for (const doc of teamDocs) {
    if (!doc.exists) continue;
    const team = mapTeamDoc(doc);
    const round = team.league === 'NBA' ? config.nbaRound : config.nhlRound;
    results.push({ ...team, round });
  }
  results.sort(
    (a, b) =>
      a.league.localeCompare(b.league) || a.city.localeCompare(b.city),
  );
  return results;
}

export async function getPlayoffPromosForTeam(
  teamId: string,
): Promise<PlayoffPromoWithTeam[]> {
  const [snapshot, team] = await Promise.all([
    db
      .collection('playoffPromos')
      .where('teamId', '==', teamId)
      .where('isPlayoff', '==', true)
      .get(),
    getTeamBySlug(teamId),
  ]);
  if (!team) return [];
  const venue = await getVenueForTeam(teamId);
  const promos = snapshot.docs.map(mapPlayoffPromoDoc);
  promos.sort(sortByDateThenCreated);
  return promos.map((p) => ({ ...p, team, venue }));
}

export async function getAllPlayoffPromos(): Promise<{
  config: PlayoffConfig | null;
  byLeague: Record<
    'NBA' | 'NHL',
    { team: Team; promos: PlayoffPromo[] }[]
  >;
  totalPromos: number;
  totalTeams: number;
}> {
  const config = await getPlayoffConfig();
  const empty = {
    config,
    byLeague: { NBA: [], NHL: [] } as Record<
      'NBA' | 'NHL',
      { team: Team; promos: PlayoffPromo[] }[]
    >,
    totalPromos: 0,
    totalTeams: 0,
  };
  if (!config || !config.playoffsActive) return empty;

  const activeIds = new Set(config.activeTeamIds);
  const [snapshot, allTeams] = await Promise.all([
    db
      .collection('playoffPromos')
      .where('isPlayoff', '==', true)
      .get(),
    getAllTeams(),
  ]);
  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  const grouped = new Map<string, PlayoffPromo[]>();
  for (const doc of snapshot.docs) {
    const p = mapPlayoffPromoDoc(doc);
    if (!activeIds.has(p.teamId)) continue;
    const arr = grouped.get(p.teamId) ?? [];
    arr.push(p);
    grouped.set(p.teamId, arr);
  }

  const byLeague: Record<
    'NBA' | 'NHL',
    { team: Team; promos: PlayoffPromo[] }[]
  > = { NBA: [], NHL: [] };
  let totalPromos = 0;
  for (const [teamId, promos] of grouped) {
    const team = teamById.get(teamId);
    if (!team) continue;
    promos.sort(sortByDateThenCreated);
    const league = team.league as 'NBA' | 'NHL';
    if (league !== 'NBA' && league !== 'NHL') continue;
    byLeague[league].push({ team, promos });
    totalPromos += promos.length;
  }
  for (const league of ['NBA', 'NHL'] as const) {
    byLeague[league].sort((a, b) => a.team.city.localeCompare(b.team.city));
  }

  return {
    config,
    byLeague,
    totalPromos,
    totalTeams: grouped.size,
  };
}

export async function getTeamsWithPromoCounts(): Promise<(Team & { promoCount: number; promoCounts: Record<PromoType, number> })[]> {
  const teams = await getAllTeams();
  const results = await Promise.all(
    teams.map(async (team) => {
      const promos = await getTeamPromos(team.id);
      const promoCounts: Record<PromoType, number> = { giveaway: 0, theme: 0, kids: 0, food: 0 };
      for (const p of promos) {
        if (promoCounts[p.type] !== undefined) {
          promoCounts[p.type]++;
        }
      }
      return { ...team, promoCount: promos.length, promoCounts };
    })
  );
  return results;
}
