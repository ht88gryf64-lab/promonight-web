// Dependency-free date formatter shared by the promo-card (server) and
// game-card (client) integration points so the preview + share text read
// identically across surfaces. Kept out of share-channels.ts (which imports
// the analytics layer) so server components can import it without pulling
// client-only code into their module graph.
export function formatShareDate(dateStr: string): string {
  // Noon anchor avoids the UTC-midnight off-by-one that shifts the weekday.
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
