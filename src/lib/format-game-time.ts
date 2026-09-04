// Time-rendering helper for game cells.
//
// Two paths gated on `gameTimeTz`:
//
// - LEGACY UTC path (tz === 'UTC'): stored hhmm is treated as UTC, the date
//   argument is ignored, and the output renders in the RENDER RUNTIME's zone
//   against a fixed Jan-1-2026 anchor. Both of those are defects, and both
//   were shipping: on Vercel the runtime is UTC, so this printed a 7:10 PM
//   first pitch as "2:10 AM" in the prerendered HTML, and the January anchor
//   drops daylight saving so the value is an hour early in every northern
//   DST-observing zone during the season.
//
//   NOTHING IN THE APP REACHES THIS BRANCH ANY MORE. As of 2026-09-01
//   mapGameDoc (src/lib/data.ts) resolves a real IANA zone for every MLB game
//   before it leaves the data layer, so no Game object carries 'UTC'. The
//   branch is kept because formatGameTime is exported and the pinned suite in
//   scripts/test-format-game-time.ts documents exactly what the old behaviour
//   was. Do not route anything back into it.
//
// - VENUE path (tz is a real IANA zone, e.g. 'America/Los_Angeles'):
//   stored hhmm is UTC and `dateYmd` is the venue-local YYYY-MM-DD. We resolve
//   the UTC instant by trying the local date offset by {0, +1, -1} days until
//   the local-date readout in `tz` matches `dateYmd`, then format the
//   resulting Date in `tz`. This handles the cross-midnight-UTC case (PT
//   primetime games stored as next-day UTC with same-day venue-local date).
//   DST is applied correctly because the resolution uses the game's actual
//   date, not a Jan-1 anchor. This is the path both NFL and, since
//   2026-09-01, MLB take.

function ymdInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) return '';
  return `${y}-${m}-${d}`;
}

/**
 * The kickoff/first-pitch instant, reconstructed from the stored triple.
 *
 * `hhmm` is UTC and `dateYmd` is the VENUE-LOCAL day of that instant, so the
 * instant is "hhmm UTC on whichever UTC date makes the venue-local day equal
 * dateYmd", at most one day away in either direction. Extracted so the time
 * label and the zone abbreviation resolve the same instant by the same rule
 * rather than each carrying their own copy of it.
 *
 * Returns null when the triple cannot be resolved: a malformed time, a
 * malformed date, the legacy 'UTC' sentinel (which carries no venue), or a
 * timezone string Intl rejects.
 */
export function resolveGameInstant(tz: string, hhmm: string, dateYmd: string): Date | null {
  if (!tz || tz === 'UTC') return null;
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateYmd.split('-').map(Number);
  try {
    for (const offset of [0, 1, -1]) {
      const candidate = new Date(Date.UTC(y, mo - 1, d + offset, h, m, 0));
      if (ymdInTz(candidate, tz) === dateYmd) return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Long zone names to the abbreviation an English-speaking reader expects.
 *
 * WHY THIS MAP IS KEYED ON THE LONG NAME AND NOT ON THE ZONE. Intl's `short`
 * style only returns a letter abbreviation where the en-US locale has one,
 * which in practice means North America. Everywhere else it returns a bare
 * offset, so the NFL international slate rendered "10:35 AM GMT+10" for
 * Melbourne and "2:30 PM GMT+1" for London. The `long` style always returns a
 * real name, and that name already tracks DST: Melbourne reads "Australian
 * Eastern Standard Time" in September and "Australian Eastern Daylight Time"
 * from October, and London flips to "Greenwich Mean Time" on 25 October 2026,
 * which is the same day the Paris game kicks off. A per-venue table would have
 * to encode every one of those transitions by hand and would be wrong the
 * first time a date moved. Keying on the long name keeps the DST decision
 * inside Intl, where it is already correct, and leaves this map holding only
 * the stable name-to-initials step.
 *
 * Initials cannot be computed from the name: "Central European Standard Time"
 * is CET, not CEST, so the standard/summer pairs have to be written out.
 */
const LONG_ZONE_NAME_TO_ABBREV: Record<string, string> = {
  // Australia: Melbourne Cricket Ground, NFL week 1.
  'Australian Eastern Standard Time': 'AEST',
  'Australian Eastern Daylight Time': 'AEDT',
  // United Kingdom: Tottenham Hotspur Stadium, Wembley.
  'British Summer Time': 'BST',
  'Greenwich Mean Time': 'GMT',
  // Western Europe: Stade de France, Santiago Bernabeu, FC Bayern Munich.
  'Central European Standard Time': 'CET',
  'Central European Summer Time': 'CEST',
  // Finland: Veikkaus Arena, the two NHL Helsinki games.
  'Eastern European Standard Time': 'EET',
  'Eastern European Summer Time': 'EEST',
  // Brazil: Maracana. Brazil abolished DST in 2019, so only the standard name
  // can occur today; the summer name is kept because the corpus outlives the
  // policy and an unmapped name would silently fall back to "GMT-2".
  'Brasilia Standard Time': 'BRT',
  'Brasilia Summer Time': 'BRST',
};

function zoneNamePart(tz: string, instant: Date, style: 'short' | 'long'): string | null {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style })
    .formatToParts(instant);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
}

/**
 * Short zone label for a game, e.g. "CDT", "PST", "MST", "AEST", "BST".
 *
 * Derived from the game's own instant rather than a hand-written table, which
 * is the point: America/Phoenix reads MST year round and America/Mexico_City
 * reads CST year round (Mexico dropped DST in 2022), and a "state to zone"
 * table gets both wrong for half the year. Returns null when the instant
 * cannot be resolved, so an unlabelled time is never labelled with a guess.
 *
 * THE SHORT NAME IS PREFERRED AND THE MAP IS THE FALLBACK, not the other way
 * round. A letter abbreviation from Intl is already the right answer for every
 * North American zone in all three corpora, so taking it first means this
 * change cannot move a single MLB, NHL or domestic NFL label: those never
 * reach the map. Only an opaque "GMT+10" style offset falls through to
 * LONG_ZONE_NAME_TO_ABBREV, and that set is exactly the international venues.
 *
 * America/Mexico_City deliberately keeps Intl's "CST". Its long name is the
 * literal string "Central Standard Time", indistinguishable from US Central,
 * so the map could not disambiguate it even if it were consulted, and the
 * short-name-first rule means it is not. See the note in the gate report: a
 * "CST (MX)" style label would also move MLB's Mexico City Series output,
 * which this change is scoped not to touch.
 *
 * An unmapped opaque zone returns the offset unchanged rather than null. That
 * is deliberate: "GMT+5:30" is opaque but true, and a reader is better served
 * by a true offset than by a time with no zone at all.
 */
export function gameZoneAbbrev(tz: string, hhmm: string, dateYmd: string): string | null {
  const instant = resolveGameInstant(tz, hhmm, dateYmd);
  if (!instant) return null;
  try {
    const short = zoneNamePart(tz, instant, 'short');
    if (short && !/^GMT[+-]/.test(short)) return short;
    const long = zoneNamePart(tz, instant, 'long');
    if (long && LONG_ZONE_NAME_TO_ABBREV[long]) return LONG_ZONE_NAME_TO_ABBREV[long];
    return short ?? null;
  } catch {
    return null;
  }
}

/**
 * `zoneAbbrev` is appended after the time when supplied, e.g. "7:10 PM CDT".
 * It is OPTIONAL and absent for NFL, whose call sites pass nothing, so NFL
 * output is unchanged by construction rather than by review. MLB call sites
 * pass game.gameTimeZoneAbbrev, which only the MLB branch of mapGameDoc sets.
 */
export function formatGameTime(
  tz: string,
  hhmm: string,
  dateYmd?: string,
  zoneAbbrev?: string | null,
): string {
  if (!hhmm) return '';
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);

  // LEGACY UTC path. Unreachable from the app; see the header note.
  if (tz === 'UTC') {
    const d = new Date(Date.UTC(2026, 0, 1, h, m, 0));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // Venue path. Requires the date.
  if (!dateYmd) return hhmm;
  const instant = resolveGameInstant(tz, hhmm, dateYmd);
  if (!instant) return hhmm;
  const time = instant.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  });
  return zoneAbbrev ? `${time} ${zoneAbbrev}` : time;
}
