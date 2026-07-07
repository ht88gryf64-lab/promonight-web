// CFB read layer for the /cfb route (Phase 3). Reads the cfb* collections written
// by Phase 2 and shapes them for the ONE template. Verify-gate discipline lives
// here: a game's kickoff renders "Kickoff TBA" unless it is verified AND has an
// announced time — a verified=false value (the flagged date-error games) or an
// unannounced July kickoff never shows a contradicted/unconfirmed time.

import { db } from '@/lib/firebase';
import type { CfbSchool, CfbVenue, CfbGame, CfbRivalry } from '@/lib/cfb/types';
import { CFB_COLLECTIONS } from '@/lib/cfb/types';

const TZ_ABBR: Record<string, string> = {
  'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT',
  'America/Boise': 'MT', 'America/Phoenix': 'MST', 'America/Los_Angeles': 'PT',
};

export interface CfbGameView {
  id: string;
  date: string; // YYYY-MM-DD
  week: number;
  isHome: boolean;
  neutralSite: boolean;
  opponentId: string;
  opponentName: string;
  kickoffDisplay: string; // "7:30 PM ET" only when verified+announced; else "Kickoff TBA"
  kickoffVerified: boolean;
  networkDisplay: string | null; // only when broadcast.confirmed
  rivalry: { name: string; trophy: string | null } | null; // tag-as-fact, crown none
}

export interface CfbSchoolPage {
  school: CfbSchool;
  venue: CfbVenue | null;
  games: CfbGameView[];
  editorialStatus: 'auto' | 'destination';
  // Editorial blocks (Phase 4 populates; ONE template renders them only when present).
  editorial: {
    signatureGameId: string | null;
    traditions: unknown[]; // cfbTraditions later
    gamedayCulture: string | null;
    whyYouGo: string | null;
    venueInTheirWords: string | null;
    contributor: { name: string; credit: string } | null;
  };
}

function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNc\b/, 'NC').replace(/\bUnlv\b/, 'UNLV').replace(/\bUcf\b/, 'UCF')
    .replace(/\bByu\b/, 'BYU').replace(/\bSmu\b/, 'SMU').replace(/\bTcu\b/, 'TCU')
    .replace(/\bUsc\b/, 'USC').replace(/\bUcla\b/, 'UCLA').replace(/\bLsu\b/, 'LSU')
    .replace(/\bTbd\b|\bTba\b/i, 'TBA');
}

function to12h(time: string, tz: string): string | null {
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  const abbr = TZ_ABBR[tz] || tz;
  return `${h}:${min} ${ap} ${abbr}`;
}

// The verify-gate: an announced time shows ONLY when the game is verified AND not
// tbd AND parses. Everything else — unannounced (most of July) or a flagged
// date-error (verified=false) — renders identically as "Kickoff TBA".
function kickoffDisplay(g: CfbGame): { display: string; verified: boolean } {
  const tbd = g.kickoff?.tbd || !g.kickoff?.time || /tbd|tba/i.test(g.kickoff?.time || '');
  if (g.verified && !tbd) {
    const t = to12h(g.kickoff.time, g.kickoff.tz);
    if (t) return { display: t, verified: true };
  }
  return { display: 'Kickoff TBA', verified: false };
}

/** All school ids — for generateStaticParams. */
export async function getAllCfbSchoolIds(): Promise<string[]> {
  const snap = await db.collection(CFB_COLLECTIONS.schools).get();
  return snap.docs.map((d) => d.id);
}

export async function getCfbSchool(id: string): Promise<CfbSchool | null> {
  const doc = await db.collection(CFB_COLLECTIONS.schools).doc(id).get();
  return doc.exists ? (doc.data() as CfbSchool) : null;
}

/** Full page payload for one school. */
export async function getCfbSchoolPage(id: string): Promise<CfbSchoolPage | null> {
  const schoolDoc = await db.collection(CFB_COLLECTIONS.schools).doc(id).get();
  if (!schoolDoc.exists) return null;
  const school = schoolDoc.data() as CfbSchool;

  const [venueDoc, schoolsSnap, rivalriesSnap, homeSnap, awaySnap] = await Promise.all([
    school.venueId ? db.collection(CFB_COLLECTIONS.venues).doc(school.venueId).get() : Promise.resolve(null),
    db.collection(CFB_COLLECTIONS.schools).get(),
    db.collection(CFB_COLLECTIONS.rivalries).get(),
    db.collection(CFB_COLLECTIONS.games).where('homeSchoolId', '==', id).get(),
    db.collection(CFB_COLLECTIONS.games).where('awaySchoolId', '==', id).get(),
  ]);

  const venue = venueDoc && venueDoc.exists ? (venueDoc.data() as CfbVenue) : null;
  const nameById = new Map<string, string>();
  for (const d of schoolsSnap.docs) nameById.set(d.id, (d.data() as CfbSchool).shortName || (d.data() as CfbSchool).name);
  const rivalryById = new Map<string, CfbRivalry>();
  for (const d of rivalriesSnap.docs) rivalryById.set(d.id, d.data() as CfbRivalry);

  const seen = new Set<string>();
  const games: CfbGameView[] = [];
  for (const d of [...homeSnap.docs, ...awaySnap.docs]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const g = d.data() as CfbGame;
    const isHome = g.homeSchoolId === id;
    const opponentId = isHome ? g.awaySchoolId : g.homeSchoolId;
    const kd = kickoffDisplay(g);
    const riv = g.rivalryId ? rivalryById.get(g.rivalryId) : null;
    games.push({
      id: g.id, date: g.date, week: g.week, isHome, neutralSite: !!g.neutralSite,
      opponentId, opponentName: nameById.get(opponentId) || prettifySlug(opponentId),
      kickoffDisplay: kd.display, kickoffVerified: kd.verified,
      networkDisplay: g.broadcast?.confirmed && g.broadcast.network && !/tbd/i.test(g.broadcast.network) ? g.broadcast.network : null,
      rivalry: riv ? { name: riv.name, trophy: riv.trophy } : null,
    });
  }
  games.sort((a, b) => a.date.localeCompare(b.date));

  return {
    school, venue, games,
    editorialStatus: school.editorialStatus || 'auto',
    // Phase 3 auto pages: editorial blocks are all empty; the ONE template hides
    // them. Phase 4 populates these as a DATA change (no template change).
    editorial: { signatureGameId: null, traditions: [], gamedayCulture: null, whyYouGo: null, venueInTheirWords: null, contributor: null },
  };
}
