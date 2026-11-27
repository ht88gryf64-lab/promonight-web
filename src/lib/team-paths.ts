// WHERE A LEAGUE'S TEAM DOCS AND PROMOS LIVE (MiLB G2b, rulings 2026-11-27).
//
// Every pro league:  teams/{slug}, teams/{slug}/promos, teams/{slug}/recurringDeals
// MILB:              milbTeams/{slug}, milbTeams/{slug}/milbPromos,
//                    milbTeams/{slug}/recurringDeals
//
// WHY MILB IS ELSEWHERE. Every installed version of the apps reads
// collection('teams') whole and collectionGroup('promos') whole, with no league
// filter and no remote switch. A MILB doc in `teams`, or a MILB promo in ANY
// subcollection named "promos", reaches every installed app the moment it is
// written, whatever appConfig/milb.milbLive says. firestore.rules matches
// nothing under milbTeams/**, so no client can read these paths; this site
// reads them with the Admin SDK, and only while the gate is open
// (src/lib/milb-gate.ts; the team loader in src/lib/data.ts).
//
// Every MILB read on the site goes through this module. The pro paths are the
// literals they always were (asserted in src/lib/__tests__/team-paths.test.ts).
// The pipeline's twin is promo-pipeline lib/scanner/team-paths.js.
import { db } from './firebase';

export interface LeaguePaths {
  teams: string;
  promos: string;
  recurring: string;
}

export const PRO_PATHS: LeaguePaths = Object.freeze({ teams: 'teams', promos: 'promos', recurring: 'recurringDeals' });
export const MILB_PATHS: LeaguePaths = Object.freeze({ teams: 'milbTeams', promos: 'milbPromos', recurring: 'recurringDeals' });

export function pathsForLeague(league: string | null | undefined): LeaguePaths {
  return league === 'MILB' ? MILB_PATHS : PRO_PATHS;
}

export function teamDocRef(league: string | null | undefined, teamId: string): FirebaseFirestore.DocumentReference {
  return db.collection(pathsForLeague(league).teams).doc(teamId);
}

export function promosColRef(league: string | null | undefined, teamId: string): FirebaseFirestore.CollectionReference {
  return teamDocRef(league, teamId).collection(pathsForLeague(league).promos);
}

export function recurringColRef(league: string | null | undefined, teamId: string): FirebaseFirestore.CollectionReference {
  return teamDocRef(league, teamId).collection(pathsForLeague(league).recurring);
}

/** Whether a promo doc from a collection-group read sits where its team's
 *  league keeps promos. A MILB team's promo must be a `milbPromos` doc: its
 *  doc in any other collection (a `promos` one) is not its promo. A pro team's
 *  promo is any doc that is not a `milbPromos` doc, which is every doc the
 *  `promos` group ever returned, so no pro read changes. */
export function promoDocBelongs(doc: { ref: { parent?: { id?: string } | null } }, league: string): boolean {
  const col = doc.ref.parent?.id;
  return league === 'MILB' ? col === MILB_PATHS.promos : col !== MILB_PATHS.promos;
}
