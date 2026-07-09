// CFB hub rivalry blocks (§14b treatment, from the approved mockup). Diagonal
// 62/38 split, home-left, four-color primary→secondary fade, seam divider when
// primaries are too close, bottom-heavy scrim for legibility over any combo.
// Two scales: NationalBlock (200px + blurb) and WeekCard (140px + countdown).
// The diagonal is EXCLUSIVE to rivalries — ThemeCard is a single-color card.

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { HubRivalryGame, HubNationalBlock, HubThemeGame, HubTeam } from '@/lib/cfb/hub-data';
import { rivalryBlockColors, orderRivalrySides } from '@/lib/cfb/hub-theme';

const GOLD = '#FFB71E';
const RED = '#e0492e';
const SERIF = 'var(--font-cfb-serif), Georgia, serif';
const MONO = 'var(--font-mono), ui-monospace, monospace';

function CornerName({ team, side }: { team: HubTeam; side: 'left' | 'right' }) {
  return (
    <Link
      href={`/cfb/${team.id}`}
      className="absolute top-3 z-10 text-[10px] font-bold uppercase text-white hover:underline sm:text-[11px]"
      style={{ fontFamily: MONO, textShadow: '0 1px 4px #000', [side]: 14 } as CSSProperties}
    >
      {team.shortName}
    </Link>
  );
}

// The two stacked diagonal fills + divider + scrim shared by both scales.
function DiagonalFill({ a, b, fadeStart, dividerAlpha }: { a: HubTeam; b: HubTeam; fadeStart: number; dividerAlpha: number }) {
  const { pa, pb, sa, sb, divider } = rivalryBlockColors(a, b);
  return (
    <>
      {/* away (right / full background) */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${pb} 0%, ${pb} ${fadeStart}%, ${sb} 112%)` }} />
      {/* home (left wedge, 62/38, dominant) */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${pa} 0%, ${pa} ${fadeStart}%, ${sa} 112%)`, clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0 100%)' }} />
      {/* seam divider when the two primaries are too close in luminance (§14b) */}
      {divider && (
        <div className="absolute inset-0" style={{ background: `linear-gradient(105deg, transparent 49.5%, rgba(255,255,255,${dividerAlpha}) 49.7%, rgba(255,255,255,${dividerAlpha}) 50.3%, transparent 50.5%)` }} />
      )}
      {/* scrim — heavier at the bottom so text holds over any 4-color combo */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.88) 100%)' }} />
    </>
  );
}

export function NationalBlock({ block }: { block: HubNationalBlock }) {
  const { home, away } = block; // hub-data already resolved home-left / neutral→alphabetical
  return (
    <div className="relative h-[200px] overflow-hidden rounded-2xl border border-white/10">
      <DiagonalFill a={home} b={away} fadeStart={40} dividerAlpha={0.55} />
      <CornerName team={home} side="left" />
      <CornerName team={away} side="right" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="text-[10px] tracking-wider text-white/85" style={{ fontFamily: MONO, textShadow: '0 1px 3px #000' }}>{fmtDate(block.date)} · {block.host.toUpperCase()}{block.est ? ` · EST. ${block.est}` : ''}</div>
        {block.trophy && (
          <div className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ fontFamily: MONO, color: '#08070d', background: GOLD }}>{block.trophy}</div>
        )}
        <div className="mt-1.5 italic text-white" style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, textShadow: '0 2px 8px #000' }}>{block.name}</div>
        <div className="mt-1.5 max-w-md text-[12px] leading-snug text-white/80" style={{ textShadow: '0 1px 3px #000' }}>{block.blurb}</div>
      </div>
    </div>
  );
}

export function WeekCard({ game }: { game: HubRivalryGame }) {
  const { a, b } = orderRivalrySides({ ...game.home, isHome: true }, { ...game.away }, game.neutral);
  const countdown = game.days <= 0 ? 'TODAY' : game.days === 1 ? 'TOMORROW' : `IN ${game.days} DAYS`;
  return (
    <div className="relative h-[140px] min-w-[280px] shrink-0 overflow-hidden rounded-xl border border-white/10">
      <DiagonalFill a={a} b={b} fadeStart={45} dividerAlpha={0.5} />
      <CornerName team={a} side="left" />
      <CornerName team={b} side="right" />
      <div className="absolute inset-x-0 bottom-0 p-3.5">
        {/* countdown row — NATIONAL badge is INLINE here, never over a team name (§14) */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-wider" style={{ fontFamily: MONO, color: GOLD }}>{countdown} · {fmtDate(game.date)}</span>
          {game.national && <span className="rounded-lg px-1.5 py-0.5 text-[8px] font-bold text-white" style={{ fontFamily: MONO, background: RED }}>NATIONAL</span>}
        </div>
        <div className="italic text-white" style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1, textShadow: '0 1px 4px #000' }}>
          {game.trophy || `${a.shortName} · ${b.shortName}`}
        </div>
      </div>
    </div>
  );
}

export function ThemeCard({ theme }: { theme: HubThemeGame }) {
  const p = norm(theme.school.primaryColor) ?? '#333333';
  const s = norm(theme.school.secondaryColor) ?? '#ffffff';
  return (
    <Link href={`/cfb/${theme.school.id}`} className="group relative block h-[150px] overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="absolute inset-0 transition-transform group-hover:scale-[1.03]" style={{ background: `linear-gradient(135deg, ${p} 0%, ${p} 55%, ${s}44 100%)` }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.8) 100%)' }} />
      <div className="absolute bottom-0 p-4">
        <div className="text-[9px] tracking-wider text-white/80" style={{ fontFamily: MONO }}>{theme.school.shortName.toUpperCase()} · THEME NIGHT</div>
        <div className="mt-0.5 italic text-white" style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1, textShadow: '0 1px 4px #000' }}>{theme.theme}</div>
      </div>
    </Link>
  );
}

function norm(hex: string | null): string | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/);
  return m ? '#' + m[1] : null;
}
function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
