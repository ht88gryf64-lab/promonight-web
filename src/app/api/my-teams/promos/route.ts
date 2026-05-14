import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { resolveIcon } from '@/lib/promo-helpers';
import { getVenueOverride } from '@/lib/venue-overrides';
import type { PromoType, Venue } from '@/lib/types';

// Maximum starred teams a single request will fan out for. 200 is well past
// the practical ceiling (the user would have to star more than every team
// in a single league) but caps the worst-case parallel read count if a
// malformed client request shows up.
const MAX_TEAMS = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type StarredPromo = {
  promoId: string;
  teamSlug: string;
  date: string;
  time: string;
  opponent: string;
  type: PromoType;
  title: string;
  description: string;
  highlight: boolean;
  icon: string;
  recurring: boolean;
};

export type StarredPromosResponse = {
  promos: StarredPromo[];
  venues: Record<string, Venue | null>;
};

function isDate(value: string): boolean {
  return DATE_RE.test(value);
}

async function fetchPromosForTeam(
  teamSlug: string,
  start: string,
  end: string,
): Promise<StarredPromo[]> {
  try {
    const snapshot = await db
      .collection('teams')
      .doc(teamSlug)
      .collection('promos')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const type = data.type as PromoType;
      return {
        promoId: doc.id,
        teamSlug,
        date: data.date,
        time: data.time || '',
        opponent: data.opponent || '',
        type,
        title: data.title || '',
        description: data.description || '',
        highlight: data.highlight === true,
        icon: resolveIcon(data.title || '', type, data.icon || ''),
        recurring: data.recurring === true,
      };
    });
  } catch (err) {
    // One bad team should not poison the rest of the response. The client
    // will silently miss that team's promos for this request; the next
    // refetch (focus or 5-min dedupe expiry) gets a fresh shot.
    console.error('STARRED_PROMOS_TEAM_FETCH_ERR', { teamSlug, err });
    return [];
  }
}

async function fetchVenueForTeam(
  teamSlug: string,
): Promise<Venue | null> {
  try {
    const teamDoc = await db.collection('teams').doc(teamSlug).get();
    if (!teamDoc.exists) return null;
    const teamData = teamDoc.data()!;
    const fullName = `${teamData.city} ${teamData.name}`;
    const snapshot = await db
      .collection('venues')
      .where('team', '==', fullName)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    const override = getVenueOverride(teamSlug);
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
      parkingInfo: data.parkingInfo ?? override?.parkingInfo,
      publicTransit: data.publicTransit ?? override?.publicTransit,
      bagPolicyUrl: data.bagPolicyUrl ?? override?.bagPolicyUrl,
      accessibility: data.accessibility ?? override?.accessibility,
      nearby: data.nearby ?? override?.nearby,
    };
  } catch (err) {
    console.error('STARRED_PROMOS_VENUE_FETCH_ERR', { teamSlug, err });
    return null;
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<StarredPromosResponse | { error: string }>> {
  const teamsParam = request.nextUrl.searchParams.get('teams') ?? '';
  const start = request.nextUrl.searchParams.get('start') ?? '';
  const end = request.nextUrl.searchParams.get('end') ?? '';

  if (!isDate(start) || !isDate(end) || start > end) {
    return NextResponse.json(
      { error: 'invalid date range' },
      { status: 400 },
    );
  }

  const slugs = Array.from(
    new Set(
      teamsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[a-z0-9-]+$/.test(s)),
    ),
  ).slice(0, MAX_TEAMS);

  if (slugs.length === 0) {
    return NextResponse.json({ promos: [], venues: {} });
  }

  // Parallel fan-out: one promo read + one venue read per starred team.
  // Firestore handles bursty parallel reads well; the per-team `where date
  // in [start, end]` query is cheap (small subcollection, indexed by date).
  // For 30+ teams this stays inside Vercel's 60s default timeout by a wide
  // margin even with a cold connection.
  const [promosByTeam, venuesByTeam] = await Promise.all([
    Promise.all(slugs.map((slug) => fetchPromosForTeam(slug, start, end))),
    Promise.all(slugs.map((slug) => fetchVenueForTeam(slug))),
  ]);

  const promos = promosByTeam.flat();
  promos.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const venues: Record<string, Venue | null> = {};
  slugs.forEach((slug, i) => {
    venues[slug] = venuesByTeam[i];
  });

  return NextResponse.json({ promos, venues });
}
