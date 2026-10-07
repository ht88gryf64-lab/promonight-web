import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { resolveIcon } from '@/lib/promo-helpers';
import type { PromoType, Venue } from '@/lib/types';
import { isTicketPackageDoc, isTicketPackageLeague } from '@/lib/ticket-packages';
import { starredTeamLeague } from '@/lib/starred-team-league';

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
  /** Teams whose promo read failed. The client must not say "nothing in the
   *  next 60 days" about them (OPS, 2026-10-06). Optional: older cached
   *  responses carry no list. */
  failedTeams?: string[];
};

function isDate(value: string): boolean {
  return DATE_RE.test(value);
}

/** Firestore's order for strings (code units), not locale collation. */
function byteOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** getTeamPromos' dedupe on raw docs: date then doc id order, first row per
 *  (date, trimmed lower-case title) wins. NHL and NBA only (see below). */
function dedupeDocsLikeTeamPage<T extends { id: string; data: () => FirebaseFirestore.DocumentData }>(docs: T[]): T[] {
  const ordered = [...docs].sort(
    (a, b) => byteOrder(String(a.data().date), String(b.data().date)) || byteOrder(a.id, b.id),
  );
  const seen = new Set<string>();
  return ordered.filter((doc) => {
    const key = `${doc.data().date}::${String(doc.data().title || '').trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchPromosForTeam(
  teamSlug: string,
  start: string,
  end: string,
): Promise<StarredPromo[] | null> {
  try {
    const [snapshot, league] = await Promise.all([
      db
        .collection('teams')
        .doc(teamSlug)
        .collection('promos')
        .where('date', '>=', start)
        .where('date', '<=', end)
        .get(),
      // The cached teams loader first (no extra read per starred team); the
      // team doc if that misses or throws. See starredTeamLeague.
      starredTeamLeague(teamSlug),
    ]);
    // NHL and NBA special-ticket rows are not promotions (WEB6 G2): My Teams
    // neither lists nor counts them, as the team page counts none of them. On
    // those leagues the rows are also deduped first, in the team page's order
    // (date, then doc id), so the unflagged twin of a package never shows here
    // when the team page lists that pair as the package. Other leagues are
    // read exactly as before.
    const dropPackages = isTicketPackageLeague(league);
    // Visibility filter on the raw docs before shaping: only tombstoned:true
    // and isPostseason:true are hidden; absent and false pass. App-code
    // filter, never a Firestore inequality (which would drop field-absent
    // docs).
    const visible = snapshot.docs.filter((doc) => doc.data().tombstoned !== true && doc.data().isPostseason !== true);
    return (dropPackages ? dedupeDocsLikeTeamPage(visible) : visible)
      .filter((doc) => !(dropPackages && isTicketPackageDoc(doc.data())))
      .map((doc) => {
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
    // One bad team should not poison the rest of the response. The team is
    // reported in failedTeams, and the client says it could not load it; the
    // next refetch (focus or 5-min dedupe expiry) gets a fresh shot.
    console.error('STARRED_PROMOS_TEAM_FETCH_ERR', { teamSlug, err });
    // null, not []: an empty list would tell the client this team has
    // nothing in the window, which a failed read cannot back.
    return null;
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
    return {
      slug: snapshot.docs[0].id,
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
      league: data.league,
      teamId: data.teamId,
      // No prose fields, same as getVenueForTeam: see `Venue` in types.ts.
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

  const failedTeams = slugs.filter((_, i) => promosByTeam[i] === null);
  const promos = promosByTeam.flatMap((list) => list ?? []);
  promos.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const venues: Record<string, Venue | null> = {};
  slugs.forEach((slug, i) => {
    venues[slug] = venuesByTeam[i];
  });

  return NextResponse.json({ promos, venues, failedTeams });
}
