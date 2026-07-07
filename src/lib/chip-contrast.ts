// Max-contrast text color for a colored chip (team brand color, league accent).
// Picks white or near-black ink, whichever has the HIGHER WCAG contrast against
// the chip background, so a chip is never unreadable regardless of hue or
// lightness: a dark navy flips to white, a bright cyan/gold flips to dark ink.
// Shared by the team-card chips (HubTeamGrid) and the LeagueChip monogram so
// both use identical logic. Plain module, safe to import from client components.

const CHIP_INK_DARK = '#1a1613';

export function relLuminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = toLin(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLin(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLin(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function chipInk(bgHex: string): string {
  const bg = relLuminance(bgHex);
  const contrast = (a: number, b: number) => {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  };
  const white = 1.0;
  const dark = relLuminance(CHIP_INK_DARK);
  return contrast(bg, white) >= contrast(bg, dark) ? '#ffffff' : CHIP_INK_DARK;
}
