// Time-rendering helper for game cells.
//
// Two paths gated on `gameTimeTz`:
//
// - MLB path (tz === 'UTC'): preserved bit-for-bit from the original
//   inline implementation in team-calendar.tsx. Stored hhmm is UTC, the
//   date argument is ignored, and the output renders in the viewer's
//   local time zone. The Jan-1-2026 anchor is intentional — it keeps
//   the displayed time stable regardless of DST or when the page is
//   loaded, matching what production has shipped since MLB schedule
//   ingestion went live. Scripts/test-format-game-time.ts pins this
//   invariant.
//
// - NFL path (tz is a real IANA zone, e.g. 'America/Los_Angeles'):
//   stored hhmm is still UTC and `dateYmd` is the venue-local YYYY-MM-DD.
//   We resolve the UTC instant by trying the local date offset by
//   {0, +1, -1} days until the local-date readout in `tz` matches
//   `dateYmd`, then format the resulting Date in `tz`. This handles the
//   cross-midnight-UTC case (PT primetime games stored as next-day UTC
//   with same-day venue-local date). DST is applied correctly because
//   the resolution uses the game's actual date, not a Jan-1 anchor.

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

export function formatGameTime(tz: string, hhmm: string, dateYmd?: string): string {
  if (!hhmm) return '';
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);

  // MLB path — preserved exactly as it shipped in team-calendar.tsx.
  if (tz === 'UTC') {
    const d = new Date(Date.UTC(2026, 0, 1, h, m, 0));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // NFL path — venue-local rendering. Requires the date.
  if (!dateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return hhmm;
  const [y, mo, d] = dateYmd.split('-').map(Number);
  for (const offset of [0, 1, -1]) {
    const candidate = new Date(Date.UTC(y, mo - 1, d + offset, h, m, 0));
    if (ymdInTz(candidate, tz) === dateYmd) {
      return candidate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
      });
    }
  }
  return hhmm;
}
