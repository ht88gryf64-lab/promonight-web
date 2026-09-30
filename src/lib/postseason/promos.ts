import 'server-only';
import { db } from '../firebase';
import { resolveIcon } from '../promo-helpers';
import type { PromoType } from '../types';
import type { PostseasonLeague } from './types';
import type { PromoRow } from './view';

// The postseason promotions a host club has published, read BY NAME.
//
// The postseason scanner writes them as rows of teams/{club}/promos with
// isPostseason: true, keyed on a bracket game rather than a date. Every
// regular reader of that subcollection hides them (isVisiblePromo); the
// playoffs pages are the one surface that asks for them, and this is where
// they ask. The query is an equality on a field every such row carries, which
// is a filter Firestore answers. Nothing here claims completeness: a game
// with no row simply has no line.

const TYPES: ReadonlySet<string> = new Set<PromoType>(['giveaway', 'theme', 'kids', 'food']);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One row as stored, reduced to what the page can use, or null when the row
 * is not one to show: tombstoned, another league or season, dated before
 * today, or missing a field the join or the line needs.
 */
export function postseasonPromoRow(data: Record<string, unknown>, league: PostseasonLeague, season: number, today: string): PromoRow | null {
  if (data.isPostseason !== true) return null;
  if (data.tombstoned === true) return null;
  if (data.league !== league || data.season !== season) return null;
  if (typeof data.seriesKey !== 'string' || !data.seriesKey) return null;
  if (typeof data.gameNumber !== 'number' || !Number.isInteger(data.gameNumber) || data.gameNumber < 1) return null;
  if (typeof data.date !== 'string' || !YMD.test(data.date) || data.date < today) return null;
  if (typeof data.title !== 'string' || !data.title.trim()) return null;
  if (typeof data.type !== 'string' || !TYPES.has(data.type)) return null;
  const type = data.type as PromoType;
  return {
    seriesKey: data.seriesKey,
    gameNumber: data.gameNumber,
    title: data.title.trim(),
    type,
    icon: resolveIcon(data.title, type, typeof data.icon === 'string' ? data.icon : ''),
  };
}

/**
 * The rows for the clubs that host a game in this bracket, today or later in
 * Eastern time. One query per host club. A club whose read fails contributes
 * nothing and is logged: a promotion line is an addition to the page, not
 * the page.
 */
export async function readPostseasonPromos(
  league: PostseasonLeague,
  season: number,
  hostClubIds: readonly string[],
  today: string,
): Promise<PromoRow[]> {
  const out: PromoRow[] = [];
  await Promise.all(
    hostClubIds.map(async (club) => {
      try {
        const snap = await db.collection('teams').doc(club).collection('promos').where('isPostseason', '==', true).get();
        for (const doc of snap.docs) {
          const row = postseasonPromoRow(doc.data() as Record<string, unknown>, league, season, today);
          if (row) out.push(row);
        }
      } catch (err) {
        console.error(`[postseason] reading ${club}'s postseason promotions failed; its games show none`, err);
      }
    }),
  );
  return out;
}
