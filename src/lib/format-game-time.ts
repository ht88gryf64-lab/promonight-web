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
 * Short zone label for a game, e.g. "CDT", "PST", "MST".
 *
 * Derived from the game's own instant rather than a hand-written table, which
 * is the point: America/Phoenix reads MST year round and America/Mexico_City
 * reads CST year round (Mexico dropped DST in 2022), and a "state to zone"
 * table gets both wrong for half the year. Returns null when the instant
 * cannot be resolved, so an unlabelled time is never labelled with a guess.
 */
export function gameZoneAbbrev(tz: string, hhmm: string, dateYmd: string): string | null {
  const instant = resolveGameInstant(tz, hhmm, dateYmd);
  if (!instant) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(instant);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
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
