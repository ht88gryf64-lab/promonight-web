import 'server-only';
import { db } from './firebase';
import type { Team, Promo, PromoWithTeam, Venue, PromoType } from './types';

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
  return {
    date: data.date,
    time: data.time || '',
    opponent: data.opponent || '',
    type: data.type as PromoType,
    title: data.title,
    description: data.description || '',
    highlight: data.highlight || false,
    icon: data.icon || '',
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
  return snapshot.docs.map(mapPromoDoc);
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
    return results;
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
    return allPromos;
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
    return results;
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
    return allPromos;
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
