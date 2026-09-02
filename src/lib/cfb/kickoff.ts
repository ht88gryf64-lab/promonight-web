// Venue-local kickoff display. Pure: no Firestore, no server-only import.
//
// cfbGames.kickoff.tz is a two-letter label ("ET", "CT", "MT", "PT") stamped
// by whichever school's site parsed the row, so an away school's parse leaves
// the home venue's game labelled in the away zone: Tennessee vs Texas at
// Neyland is stored "11:00 AM CT" (from texassports.com) and rendered that way
// on a page of ET rows. The verify stage corroborated that value as an INSTANT,
// reading the label through the pipeline's IANA map (guards.ts: CT is
// America/Chicago, MT is America/Denver). This module reads the same instant
// the same way and re-expresses it in the zone of the building the game is
// played in (src/lib/cfb/venue-timezones.ts). It is a labelled instant
// converted to venue-local, never a relabel, and never a conversion of a TBD.
//
// Verify gate unchanged: a time shows only when the game is verified AND the
// kickoff is announced and parseable. Everything else is "Kickoff TBA".

import { normTime, ianaOffsetMinutes, IANA } from '../../../scripts/cfb/lib/guards';

export interface KickoffLike {
  date: string;
  verified: boolean;
  kickoff: { time: string; tz: string; tbd: boolean } | null | undefined;
}

export interface VenueLocalKickoff {
  /** "12:00 PM ET" when shown, else "Kickoff TBA". */
  display: string;
  /** True when a time is shown (verified AND announced AND parseable). */
  verified: boolean;
  /** ISO-8601 with the venue offset, e.g. "2026-09-26T12:00:00-04:00"; null when withheld. */
  iso: string | null;
  /** True when the venue-local rendering differs from the stored label's. */
  converted: boolean;
}

const TBA: VenueLocalKickoff = { display: 'Kickoff TBA', verified: false, iso: null, converted: false };

// Abbreviations the display uses. Family labels (ET/CT/MT/PT) match the rest
// of the site; Phoenix is MST because Arizona does not observe DST and "MT"
// there would read as Denver time, an hour off from September to October.
const ZONE_ABBR: Record<string, string> = {
  'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT',
  'America/Boise': 'MT', 'America/Phoenix': 'MST', 'America/Los_Angeles': 'PT',
  'Pacific/Honolulu': 'HST',
};

function fmt12h(minutesOfDay: number, abbr: string): string {
  const m = ((minutesOfDay % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const min = String(m % 60).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${min} ${ap}${abbr ? ` ${abbr}` : ''}`;
}

/** Resolve a stored label to the IANA zone the verify stage read it as. An
 *  IANA string is accepted as-is (the schema contract); unknown labels return null. */
export function labelZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  if (tz.includes('/')) return tz;
  return IANA[tz.toUpperCase().replace(/[^A-Z_/]/g, '')] ?? null;
}

// A rendered kickoff in the 1:00 to 6:00 AM local window is categorically
// impossible for CFB (earliest real kickoffs are ~11 AM local). Applied to the
// venue-local result, which is what the fan reads.
function isImpossibleAm(display: string): boolean {
  return /^[1-6]:\d{2} AM\b/.test(display);
}

export function venueLocalKickoff(g: KickoffLike, venueZone: string | null): VenueLocalKickoff {
  const k = g.kickoff;
  if (!g.verified || !k || k.tbd || !k.time || /tbd|tba/i.test(k.time)) return TBA;
  const hhmm = normTime(k.time);
  if (hhmm === 'TBD') return TBA;
  const [h, mm] = hhmm.split(':').map(Number);
  const local = h * 60 + mm;

  const fromZone = labelZone(k.tz);
  // No venue zone, or a label that cannot fix the instant: show what is stored,
  // the way the pages always have. Never guess a zone.
  if (!venueZone || !fromZone) {
    const abbr = k.tz && k.tz !== 'TBD' ? (ZONE_ABBR[k.tz] ?? k.tz) : '';
    const display = fmt12h(local, abbr);
    if (isImpossibleAm(display)) return TBA;
    return { display, verified: true, iso: null, converted: false };
  }

  let fromOff: number, toOff: number;
  try {
    fromOff = ianaOffsetMinutes(fromZone, g.date);
    toOff = ianaOffsetMinutes(venueZone, g.date);
  } catch {
    return TBA;
  }
  const utc = local - fromOff;
  const venueLocal = utc + toOff;
  const abbr = ZONE_ABBR[venueZone] ?? '';
  const display = fmt12h(venueLocal, abbr);
  if (isImpossibleAm(display)) return TBA;
  const sign = toOff < 0 ? '-' : '+';
  const abs = Math.abs(toOff);
  const iso = `${g.date}T${String(Math.floor(((venueLocal % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(venueLocal % 60).padStart(2, '0')}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return { display, verified: true, iso, converted: fromOff !== toOff };
}
