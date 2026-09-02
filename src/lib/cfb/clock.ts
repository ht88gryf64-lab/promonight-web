// CFB calendar anchor. Pure (no Firestore, no server-only import) so the read
// layer, the hub reader and the tests all share one "today".
//
// America/Chicago is the site's date anchor (homepage hot-promos rollover, the
// /cfb weekly rail): a game is "today" from Chicago midnight to Chicago
// midnight, whichever zone the stadium sits in. Moved here from hub-data.ts so
// the school pages can derive "played" from the same clock.

export function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A game dated strictly before today has been played. cfbGames.status never
 *  leaves 'scheduled' (no writer transitions it), so the date is the only
 *  signal. A game dated today is NOT played: it kicks off later today. Never
 *  fabricates a result; the caller only stops presenting the row as a fixture. */
export function isPlayedGame(date: string | null | undefined, today: string): boolean {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
}
