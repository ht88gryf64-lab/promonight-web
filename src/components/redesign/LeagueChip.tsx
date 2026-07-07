import { chipInk } from '@/lib/chip-contrast';

// Rounded monogram chip for a league hub: accent background with the league
// label ('MLB', 'WNBA'), text color chosen by the SAME max-contrast logic as
// the team-card chips (chip-contrast.ts), so a lightened accent flips to dark
// ink automatically. Decorative (aria-hidden): the accessible name comes from
// the parent link's aria-label. Font size scales with the chip size and shrinks
// for 4-char labels (WNBA) so they still fit the square.
export function LeagueChip({
  accent,
  label,
  size = 28,
}: {
  accent: string;
  label: string;
  size?: number;
}) {
  const fontSize = label.length >= 4 ? Math.round(size * 0.28) : Math.round(size * 0.34);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[9px] font-rd font-extrabold uppercase leading-none tracking-tight"
      style={{ width: size, height: size, backgroundColor: accent, color: chipInk(accent), fontSize }}
    >
      {label}
    </span>
  );
}
