// Server wiring for the social RSS feed and its image cards. The selection
// and XML logic live in select.ts / rss.ts as pure functions; this module
// only supplies the Firestore-backed loaders and the venue join.

import 'server-only';
import { db } from '@/lib/firebase';
import { getAllTeams, getScoredPromosInDateRange, getVenueForTeam, mapPromoDoc } from '@/lib/data';
import { dedupePromos, isVisiblePromo, teamDisplayName } from '@/lib/promo-helpers';
import type { Team } from '@/lib/types';
import type { RssItemInput } from './rss';
import { addDaysYMD, centralYMD, PROMO_ID, selectFeedItems, type FeedCandidate, type FeedSelection } from './select';

export interface FeedPromo extends FeedCandidate {
  // Both reads filter on a date range, so a null-date doc never arrives here;
  // select.ts still re-checks the shape.
  date: string;
  team: Team;
  opponent: string;
}

// Pass 1 source: the /best-promos reader. The cap is set well above anything a
// 7-day window holds so the slice never trims before the feed's own caps run.
async function loadScored(start: string, end: string): Promise<FeedPromo[]> {
  const scored = await getScoredPromosInDateRange(start, end, 5000);
  return scored.map((p) => ({
    promoId: p.promoId,
    teamId: p.team.id,
    team: p.team,
    date: p.date,
    title: p.title,
    type: p.type,
    opponent: p.opponent,
    score: p.score,
    itemType: p.derivedSignals?.itemType ?? null,
    tombstoned: p.tombstoned,
  }));
}

// Same read as getPromosInDateRange in lib/data.ts (collectionGroup date range
// on the existing index, per-team fallback, mapPromoDoc, isVisiblePromo,
// dedupePromos), kept here only because that reader drops the doc id and the
// feed needs promoId for guid, utm_content and the image route.
async function readVisiblePromos(start: string, end: string): Promise<FeedPromo[]> {
  const teams = await getAllTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  let docs: FirebaseFirestore.QueryDocumentSnapshot[];
  try {
    const snapshot = await db
      .collectionGroup('promos')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date', 'asc')
      .get();
    docs = snapshot.docs;
  } catch {
    const perTeam = await Promise.all(
      teams.map(async (team) => {
        const s = await db
          .collection('teams')
          .doc(team.id)
          .collection('promos')
          .where('date', '>=', start)
          .where('date', '<=', end)
          .get();
        return s.docs;
      }),
    );
    docs = perTeam.flat().sort((a, b) => String(a.get('date')).localeCompare(String(b.get('date'))));
  }
  const out: FeedPromo[] = [];
  for (const doc of docs) {
    const team = doc.ref.parent.parent ? teamById.get(doc.ref.parent.parent.id) : undefined;
    if (!team) continue;
    const p = mapPromoDoc(doc);
    out.push({
      promoId: doc.id,
      teamId: team.id,
      team,
      date: p.date,
      title: p.title,
      type: p.type,
      opponent: p.opponent,
      score: p.score ?? null,
      itemType: p.derivedSignals?.itemType ?? null,
      tombstoned: p.tombstoned,
    });
  }
  return out.filter(isVisiblePromo);
}

async function readPromosInDateRange(start: string, end: string): Promise<FeedPromo[]> {
  return dedupePromos(await readVisiblePromos(start, end), (p) => p.teamId);
}

export async function getFeedSelection(now: Date): Promise<FeedSelection<FeedPromo>> {
  return selectFeedItems<FeedPromo>({
    now,
    loadScored: (w) => loadScored(w.start, w.end),
    loadUnscored: (w) => readPromosInDateRange(w.start, w.end),
  });
}

async function venueNames(teamIds: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(teamIds)];
  const venues = await Promise.all(unique.map((id) => getVenueForTeam(id)));
  return new Map(unique.map((id, i) => [id, venues[i]?.name ?? null]));
}

function toRssItem(p: FeedPromo, venue: string | null): RssItemInput {
  return {
    promoId: p.promoId,
    teamId: p.team.id,
    sportSlug: p.team.sportSlug,
    teamName: teamDisplayName(p.team),
    title: p.title,
    date: p.date,
    opponent: p.opponent,
    venue,
  };
}

export async function getFeedRssItems(now: Date): Promise<{ items: RssItemInput[]; selection: FeedSelection<FeedPromo> }> {
  const selection = await getFeedSelection(now);
  const venues = await venueNames(selection.items.map((p) => p.teamId));
  return { items: selection.items.map((p) => toRssItem(p, venues.get(p.teamId) ?? null)), selection };
}

// Image cards resolve any giveaway or theme promo dated from 14 days back
// through the end of the feed window, so a card stays fetchable for a while
// after its item leaves the feed. Anything else is unknown (404).
export const IMAGE_LOOKBACK_DAYS = 14;

export async function findCardPromo(promoId: string, now: Date): Promise<RssItemInput | null> {
  if (!PROMO_ID.test(promoId)) return null;
  const today = centralYMD(now);
  // Not content-deduped: a pass-1 item can be the scored twin of a row the
  // date-ordered dedupe would drop, and its card must still resolve.
  const promos = await readVisiblePromos(addDaysYMD(today, -IMAGE_LOOKBACK_DAYS), addDaysYMD(today, 7));
  const match = promos.find((p) => p.promoId === promoId && (p.type === 'giveaway' || p.type === 'theme'));
  if (!match || typeof match.date !== 'string' || !match.date) return null;
  const venue = (await getVenueForTeam(match.teamId))?.name ?? null;
  return toRssItem(match, venue);
}
