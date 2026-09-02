// CFB calendar helpers. Pure (no Firestore, no server-only import) so the read
// layer, the hub reader and the tests all share them.
//
// Two clocks, on purpose. America/Chicago is the site's date anchor (homepage
// hot-promos rollover, the /cfb rail window). A game's played/upcoming boundary
// is the calendar day in the VENUE's zone: a 7 PM kickoff in Honolulu is still
// today there when Chicago has moved on. CFB has no week numbers on this site;
// windows and games are labelled by date.

/** Today's YYYY-MM-DD in an IANA zone. Throws on an invalid zone (Intl). */
export function todayYMD(zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The site's date anchor (hub rail window, homepage rollover). */
export function chicagoTodayYMD(): string {
  return todayYMD('America/Chicago');
}

/** Today in the zone of the building a game is played in, falling back to the
 *  site anchor when the venue is unmapped. A game is played once the calendar
 *  day has turned where the game was, not in Chicago. */
export function venueTodayYMD(venueZone: string | null): string {
  if (!venueZone) return chicagoTodayYMD();
  try { return todayYMD(venueZone); } catch { return chicagoTodayYMD(); }
}

/** House date format for a window: "AUG 31 – SEP 6", or one date when the
 *  window is a single day. Same formatter the schedule rows use. */
export function dateRangeLabel(startYMD: string, endYMD: string): string {
  const f = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return startYMD === endYMD ? f(startYMD) : `${f(startYMD)} – ${f(endYMD)}`;
}

/** A game dated strictly before today has been played. cfbGames.status never
 *  leaves 'scheduled' (no writer transitions it), so the date is the only
 *  signal. `today` is the calendar day in the VENUE's zone (venueTodayYMD).
 *  A game dated today is NOT played: it kicks off later today. Never
 *  fabricates a result; the caller only stops presenting the row as a fixture. */
export function isPlayedGame(date: string | null | undefined, today: string): boolean {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
}
