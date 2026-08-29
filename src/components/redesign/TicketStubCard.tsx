'use client';

import { IconFlame } from '@tabler/icons-react';
import type { PromoType, PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { teamDisplayName } from '@/lib/promo-helpers';
import { chipInk } from '@/lib/chip-contrast';
import { categoryForPromo } from './categories';
import { StarToggleInline } from '@/components/star-toggle';
import type { StarPlacement } from '@/hooks/use-starred-teams';
import { useUpcomingPromoModal, type UpcomingPromoSurface } from './UpcomingPromoModal';
import { isPurchaseGated } from '@/lib/promo-helpers';

// Ticket-stub promo card for the homepage redesign (docs/homepage-redesign-
// target.html). Built ALONGSIDE LightHomePromoCard; nothing imports this yet.
// Same tap contract as LightHomePromoCard: the whole card opens the shared
// UpcomingPromoModal via the same provider `open`, which fires the same
// game_tap / promo_card_tap events with the same surface tag. The card itself
// emits nothing.
//
// Constraints carried from the Phase 0 audit rather than the target file:
// - The spine's rotated date is inked with chipInk() against the team color,
//   never a fixed white: light brand colors (gold, cyan) flip to dark ink.
//   The audit flagged raw team-color text on a self-tint as a live contrast
//   failure; this card never sets text in raw team color.
// - argbToHex(undefined) upstream silently yields "#000000", so a missing
//   primaryColor cannot be told apart from true black at this level. Both
//   fall back to the house ink (--color-rd-ink #211d18): for a genuinely
//   black-branded team the difference is invisible; for a missing value it
//   avoids the silent pure-black sentinel the audit warned about.
// - Hover lift + tilt are motion-safe only (first card to guard them; the
//   precedent the redesign asked for).
// - The title is a <p>, not a heading: the card can sit inside the hero and
//   a heading here would create an h1-to-h3 skip.
// - The barcode is decoration: aria-hidden, low-opacity, no data.

const FALLBACK_SPINE = '#211d18'; // --color-rd-ink

// Known tradeoff: a genuinely black-branded team and a missing value now
// render identically; the ambiguity moved here rather than being resolved.
function spineColor(primaryColor: string | undefined): string {
  if (!primaryColor || primaryColor === '#000000') return FALLBACK_SPINE;
  return primaryColor;
}

// Text ink for the category tag comes from CategoryMeta.ink. The raw rd-cat
// token on its own 10% tint fails AA at this size (giveaway 2.53:1, food
// 2.95:1, kids 4.49:1); the inks clear it (4.71 / 6.99 / 5.94 / 6.23). This
// file used to carry its own copy of those four hexes, which is a second
// source of truth for one palette; it now reads the shared one. The dot and
// the tint still use the rd-cat token, so this is an ink for the existing
// palette, not a fifth palette.

function spineDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Deterministic barcode rhythm (no randomness: identical SSR/client render).
// Mirrors the target's nth-child pattern: 14 bars, widths 1/1.5/2.5px,
// heights 70/85/100%.
const BARCODE_BARS = Array.from({ length: 14 }, (_, i) => ({
  width: i % 3 === 2 ? 2.5 : i % 5 === 4 ? 1 : 1.5,
  height: i % 2 === 1 ? '70%' : i % 4 === 3 ? '85%' : '100%',
}));

export function TicketStubCard({
  promo,
  contexts,
  surface,
  starPlacement,
  rank,
  notchBg = 'var(--color-rd-cream)',
}: {
  promo: PromoWithTeam;
  contexts: GameContext[] | null;
  surface: UpcomingPromoSurface;
  starPlacement: StarPlacement;
  /** Optional oversized watermark rank (best-promos rail). Decorative. */
  rank?: number;
  /** Background of the punched notches; must match the section behind the
   *  card (cream sections by default, override on bg-alt sections). */
  notchBg?: string;
}) {
  const openModal = useUpcomingPromoModal();
  const { color: catColor, label: catLabel, ink: catInk } = categoryForPromo(promo);
  const teamName = teamDisplayName(promo.team);
  const spine = spineColor(promo.team.primaryColor);
  const spineInk = chipInk(spine);
  const open = () => openModal({ promo, contexts, surface });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        // Keydowns from the nested star button bubble here; the star only
        // stops propagation of its CLICK. Without this guard, Enter or Space
        // on the star would toggle the star AND open the modal.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="group relative grid h-full cursor-pointer grid-cols-[56px_1fr] overflow-hidden rounded-2xl border border-rd-line bg-rd-card shadow-[0_1px_3px_rgba(33,29,24,0.06)] hover:border-rd-line-strong hover:shadow-[0_8px_28px_rgba(33,29,24,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:[transform:translateY(-6px)_rotate(-0.4deg)]"
    >
      {/* Team-color spine with the rotated date. */}
      <div
        className="relative grid place-items-center"
        style={{ background: `linear-gradient(180deg, ${spine}, color-mix(in srgb, ${spine} 70%, #000))` }}
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.14]"
          style={{ background: 'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 8px)' }}
        />
        <span
          className="relative z-[1] -rotate-90 whitespace-nowrap font-mono text-[11.5px] font-semibold uppercase tracking-[0.3em]"
          style={{
            color: spineInk,
            textShadow: spineInk === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.4)' : undefined,
          }}
        >
          {spineDate(promo.date)}
        </span>
      </div>

      {/* Perforation + punched notches on the spine boundary. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 top-0 left-[56px] z-[2] w-0 border-l-[1.5px] border-dashed border-rd-line-strong"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[56px] top-[-8px] z-[3] h-[15px] w-[15px] -translate-x-1/2 rounded-full border border-rd-line"
        style={{ background: notchBg }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[-8px] left-[56px] z-[3] h-[15px] w-[15px] -translate-x-1/2 rounded-full border border-rd-line"
        style={{ background: notchBg }}
      />

      {/* Body. */}
      <div className="flex min-w-0 flex-col p-[18px] pb-4">
        <div className="mb-3 flex items-center gap-2">
          {promo.time && (
            <span className="font-mono text-[13px] font-semibold tracking-[0.06em] text-rd-ink-soft">
              {promo.time}
            </span>
          )}
          {promo.highlight && !isPurchaseGated(promo) && (
            <span className="inline-flex items-center gap-1 rounded-[5px] bg-rd-red px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_2px_8px_rgba(218,45,32,0.3)]">
              <IconFlame size={10} stroke={2.5} />
              HOT
            </span>
          )}
          <span className="ml-auto">
            <StarToggleInline
              teamSlug={promo.team.id}
              teamName={teamName}
              league={promo.team.league}
              sport={promo.team.sportSlug}
              placement={starPlacement}
            />
          </span>
        </div>

        {/* NOT a heading: the card can render inside the hero, and a heading
            here would skip from the page h1 straight to h3s. 27px per the
            target file; a 22px experiment was reverted because its clip
            measurements were taken while font-rd silently rendered DM Sans
            (the compiled-CSS bug), so the size decision waits for real
            Archivo metrics after the font fix lands. min-height equals the
            clamp ceiling (3 lines x 27px leading-none = 81px) so the
            reservation and the clamp agree. */}
        <p className="line-clamp-3 min-h-[81px] font-rd text-[27px] font-bold leading-none tracking-[0.004em] text-rd-ink transition-colors group-hover:text-rd-red">
          {promo.title}
        </p>

        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-rd-ink-soft">
          <span aria-hidden className="h-[15px] w-[3px] flex-none rounded-[2px]" style={{ background: spine }} />
          <span className="truncate">
            {teamName}
            {promo.opponent && <span className="text-rd-ink-faint"> vs {promo.opponent}</span>}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-rd-line pt-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ backgroundColor: `${catColor}1a`, color: catInk }}
          >
            <i aria-hidden className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: catColor }} />
            {catLabel}
          </span>
          <span aria-hidden className="flex h-4 items-end gap-[1.5px] opacity-50">
            {BARCODE_BARS.map((bar, i) => (
              <i key={i} className="block bg-rd-ink" style={{ width: bar.width, height: bar.height }} />
            ))}
          </span>
        </div>

        {rank !== undefined && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-[46px] font-rd text-[52px] font-extrabold leading-none opacity-10"
            style={{ color: spine }}
          >
            {String(rank).padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  );
}
