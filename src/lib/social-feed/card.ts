// Resolves an image-card request key ("{teamId}~{promoId}") to the fields the
// card renders. Pure: the reads are injected (feed.ts wires Firestore), so the
// team-scoping and 404 rules are unit-testable.
//
// One document read, teams/{teamId}/promos/{promoId}. A malformed key, a
// missing team or doc, a tombstoned doc, or a doc without a usable date or
// title resolves to null, which the route serves as 404.

import type { Team } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import type { RssItemInput } from './rss';
import { cleanText } from './text';
import { parseFeedKey } from './select';

export interface CardPromoDoc {
  date?: string | null;
  title?: string | null;
  opponent?: string | null;
  tombstoned?: boolean;
}

export interface CardDeps {
  getPromo: (teamId: string, promoId: string) => Promise<CardPromoDoc | null>;
  getTeam: (teamId: string) => Promise<Pick<Team, 'id' | 'city' | 'name' | 'sportSlug'> | null>;
  getVenueName: (teamId: string) => Promise<string | null>;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function resolveCard(key: string, deps: CardDeps): Promise<RssItemInput | null> {
  const parsed = parseFeedKey(key);
  if (!parsed) return null;
  const [team, promo] = await Promise.all([
    deps.getTeam(parsed.teamId),
    deps.getPromo(parsed.teamId, parsed.promoId),
  ]);
  if (!team || !promo || promo.tombstoned === true) return null;
  if (typeof promo.date !== 'string' || !YMD.test(promo.date)) return null;
  if (!cleanText(promo.title)) return null;
  return {
    promoId: parsed.promoId,
    teamId: team.id,
    sportSlug: team.sportSlug,
    teamName: teamDisplayName(team),
    title: promo.title as string,
    date: promo.date,
    opponent: promo.opponent ?? '',
    venue: await deps.getVenueName(team.id),
  };
}
