// The game line's <time> element (ruling 2026-11-08, ux-review D11): the
// machine-readable instant with its zone offset, and the venue zone's
// generic abbreviation for the label ("7:00 PM CT"). Pure, Intl only.
//
// Inputs are what the page has: the stored date (YYYY-MM-DD), the display
// time as the team publishes it ("7:00 PM"), and the game's IANA zone from
// the spine (the building's when the spine lacks one). Without a time the
// element carries the date alone; without a zone it carries the local time
// with no offset and the label gets no abbreviation, because a guessed zone
// is a wrong zone somewhere.

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

/** "7:00 PM" -> { h: 19, m: 0 }; null for anything else. */
export function parseDisplayTime(t: string | null | undefined): { h: number; m: number } | null {
  const m = TIME_RE.exec((t ?? '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  const mm = Number(m[2]);
  if (Number(m[1]) < 1 || Number(m[1]) > 12 || mm > 59) return null;
  return { h, m: mm };
}

function zonePart(tz: string, instant: Date, style: 'longOffset' | 'shortGeneric' | 'short'): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style }).formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}

/** "-05:00" for the zone at `instant`, or null when the zone is unknown. */
export function zoneOffsetAt(tz: string, instant: Date): string | null {
  const v = zonePart(tz, instant, 'longOffset');
  if (v === 'GMT') return '+00:00';
  const m = v ? /^GMT([+-])(\d{2}):(\d{2})$/.exec(v) : null;
  return m ? `${m[1]}${m[2]}:${m[3]}` : null;
}

/** The zone's generic abbreviation at `instant` ("CT", "ET", "PT", "MT"),
 *  else its short name ("MST" for Arizona, "AEST"), else null for an opaque
 *  offset-only zone. */
export function zoneAbbrevAt(tz: string, instant: Date): string | null {
  const generic = zonePart(tz, instant, 'shortGeneric');
  if (generic && !/^GMT/.test(generic) && generic.length <= 5) return generic;
  const short = zonePart(tz, instant, 'short');
  return short && !/^GMT[+-]/.test(short) ? short : null;
}

export interface GameTimeMarkup {
  /** The <time dateTime> value: the date, or the local time with its offset. */
  dateTime: string;
  /** The abbreviation to print after the time, or null. */
  zone: string | null;
}

export function gameTimeMarkup(date: string, displayTime: string | null | undefined, timeZone: string | null | undefined): GameTimeMarkup {
  const t = parseDisplayTime(displayTime);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { dateTime: date, zone: null };
  const hh = String(t.h).padStart(2, '0');
  const mm = String(t.m).padStart(2, '0');
  const local = `${date}T${hh}:${mm}:00`;
  if (!timeZone || !timeZone.includes('/')) return { dateTime: local, zone: null };
  const [y, mo, d] = date.split('-').map(Number);
  // The wall time read as UTC is within a day of the true instant, close
  // enough for the zone's offset on that date; the offset then corrects it.
  const guess = new Date(Date.UTC(y, mo - 1, d, t.h, t.m));
  const offset = zoneOffsetAt(timeZone, guess);
  if (!offset) return { dateTime: local, zone: null };
  const sign = offset.startsWith('-') ? -1 : 1;
  const [oh, om] = offset.slice(1).split(':').map(Number);
  const instant = new Date(guess.getTime() - sign * (oh * 60 + om) * 60_000);
  return { dateTime: `${local}${offset}`, zone: zoneAbbrevAt(timeZone, instant) };
}
