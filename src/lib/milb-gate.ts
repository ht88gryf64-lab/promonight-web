// THE MILB PUBLISH GATE (MiLB Phase 1, rulings of 2026-11-27).
//
// appConfig/milb.milbLive is the one switch for Minor League Baseball on the
// site. Until it is exactly `true`, a MILB team doc does not exist as far as the
// site is concerned: the team loader (src/lib/data.ts loadTeams) drops it from
// getAllTeams AND getTeamBySlug, so no MILB team page, promo page or archive
// page resolves (404), and nothing built from the team list can name a MILB club
// or its promotions: the sitemap, league hubs, best promos, team rankings, the
// weekly digest, the social feed, the today/this-week boards, coverage counts.
// The one reader that counts promos without the team list (getTotalPromoCount)
// subtracts the hidden clubs explicitly.
//
// FAIL CLOSED. Absent doc, absent field, any value but `true`, or a failed read
// all mean "not live". A gate that opened on a read error would publish 120
// clubs on a Firestore blip.
//
// When the gate is open, a MILB team page with no upcoming promotion is noindex
// and stays out of the sitemap (milbTeamIndexable). No other league changes.
//
// Nothing here writes the flag. Flipping it is a ruling, not a code path.
import { db } from './firebase';

export const MILB_LEAGUE = 'MILB';
export const MILB_GATE_DOC = { collection: 'appConfig', doc: 'milb', field: 'milbLive' } as const;

export function isMilbLeague(league: string | null | undefined): boolean {
  return league === MILB_LEAGUE;
}

/** The flag as read from Firestore: true only for an explicit `true`. */
export async function readMilbLive(): Promise<boolean> {
  try {
    const snap = await db.collection(MILB_GATE_DOC.collection).doc(MILB_GATE_DOC.doc).get();
    if (!snap.exists) return false;
    return snap.data()?.[MILB_GATE_DOC.field] === true;
  } catch (err) {
    console.error('[milb-gate] appConfig/milb read failed; MILB stays hidden', err);
    return false;
  }
}

/** Whether a team is served at all under the gate. Every non-MILB team is. */
export function teamVisibleUnderGate(league: string, milbLive: boolean): boolean {
  return milbLive || !isMilbLeague(league);
}

/** Whether a SERVED team page may be indexed and listed in the sitemap: a MILB
 *  page needs at least one upcoming promotion; every other league is unchanged. */
export function milbTeamIndexable(league: string, upcomingCount: number): boolean {
  return !isMilbLeague(league) || upcomingCount > 0;
}
