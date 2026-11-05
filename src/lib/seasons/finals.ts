import 'server-only';
import { cache } from 'react';
import { db } from '../firebase';
import { mapBracketDoc } from '../postseason/map';
import type { PostseasonLeague } from '../postseason/types';
import { siteTodayYmd } from '../site-today';
import {
  BRACKET_LEAGUES,
  bracketFinalYmd,
  currentSeasonPredicate,
  finalsKey,
  leagueWindows,
  type SeasonEligible,
  type SeasonFinals,
} from './season-window';

// The season ends the ranked-surface gate reads from postseasonBrackets (ruling
// 2026-11-05, point 2): for each BRACKET_LEAGUES window, the document
// `${LEAGUE}_${season}`, and from it the Eastern day of the last final game
// once every series is final.
//
// READ FRESH, NOT CACHED ACROSS RENDERS. The pipeline writes the bracket and
// the pages that read this are ISR, so one read per regeneration (at most one
// document per window, four today) is the whole cost. React cache() shares it
// within one render.
//
// A FAILED READ NEVER FAILS A PAGE. The fixed ends in windows.json sit at or
// after the scheduled last game, so without the bracket the gate admits at
// most the few days between the real final and the scheduled one. That is
// logged and accepted; a ranked page that 500s or regenerates empty is worse.

const BRACKETS = 'postseasonBrackets';
const BRACKET_FIELDS = ['league', 'season', 'series', 'lastChangedAt'];

export const getSeasonFinals = cache(async (): Promise<SeasonFinals> => {
  const finals = new Map<string, string>();
  const wanted = BRACKET_LEAGUES.flatMap((league) => leagueWindows(league)).map((w) => ({
    league: w.league as PostseasonLeague,
    season: w.season,
    key: finalsKey(w.league, w.season),
  }));
  if (wanted.length === 0) return finals;
  try {
    const snaps = await db.getAll(
      ...wanted.map((w) => db.collection(BRACKETS).doc(w.key)),
      { fieldMask: BRACKET_FIELDS },
    );
    snaps.forEach((snap, i) => {
      const w = wanted[i];
      if (!snap.exists) return;
      const season = Number(w.season);
      const bracket = Number.isInteger(season) ? mapBracketDoc(snap.data(), { league: w.league, season }) : null;
      if (!bracket) {
        console.error(`[seasons] ${w.key} is not in a shape the web reads; using the fixed season end`);
        return;
      }
      const ymd = bracketFinalYmd(bracket);
      if (ymd) finals.set(w.key, ymd);
    });
  } catch (err) {
    console.error('[seasons] postseasonBrackets read failed; using the fixed season ends', err);
  }
  return finals;
});

/** The eligibility test every ranked surface applies, for the site's today. */
export async function getCurrentSeasonPredicate(now: Date = new Date()): Promise<SeasonEligible> {
  return currentSeasonPredicate(siteTodayYmd(now), await getSeasonFinals());
}
