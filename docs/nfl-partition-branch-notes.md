# feature/nfl-partition-cards - branch notes

- **tsc exit status must be read directly, never through a pipe.** A piped
  `tsc | head` masked TS2367 on this branch and the error was briefly
  committed; `npx tsc --noEmit; echo $?` is the only trustworthy form.
- **Preview parity**: the 2026-08-07 card preview ran META_TONE='compare'
  (alternating amber/muted); the committed branch is muted-final. Any
  re-verification preview must be cut from the mergeable state.
- **Freshness copy verdict (fix 2)**: no 6-hour ingest exists for ANY league.
  The only schedule cron is mlb-schedule (weekly, Mon 10:00 UTC); NFL has no
  promo cron and a manual game ingest. "Schedules refreshed every 6 hours"
  described the page's ISR interval (revalidate=21600), not a data cadence -
  replaced on /nfl with "Updated as clubs announce promotions." The MLB/WNBA/
  MLS hubs carry the same line on the same ISR-only basis; out of scope here,
  flagged for a separate ruling.
- Raiders at Steelers is NOT a 2026 fixture; near-black seam demos use
  Cardinals-at-Raiders / Steelers-Packers class pairings instead.
