'use client';

import type { PromoWithTeam } from '@/lib/types';
import { TicketStubCard } from '@/components/redesign/TicketStubCard';
import { UpcomingPromoModalProvider } from '@/components/redesign/UpcomingPromoModal';
import { relLuminance } from '@/lib/chip-contrast';

// Client shell for the dev preview: mounts the ONE shared modal provider the
// homepage uses (showTeamLink, same as the homepage) and lays the cards out at
// the target's rail density (274px fixed stubs). Contexts are passed as null,
// which exercises the LegacyPromoExpand modal path: the card's contract is
// identical either way, it hands whatever contexts it received to the provider.

function Rail({ promos, withRank }: { promos: PromoWithTeam[]; withRank?: boolean }) {
  return (
    <div className="flex gap-5 overflow-x-auto px-1 py-2" style={{ scrollSnapType: 'x mandatory' }}>
      {promos.map((p, i) => (
        <div key={`${p.team.id}-${p.date}-${p.title}`} className="w-[274px] flex-none" style={{ scrollSnapAlign: 'start' }}>
          <TicketStubCard
            promo={p}
            contexts={null}
            surface="web_home_tonight"
            starPlacement="homepage_this_week_inline"
            rank={withRank ? i + 1 : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export function TicketStubPreview({ promos }: { promos: PromoWithTeam[] }) {
  const byLum = promos
    .map((p) => ({ p, lum: relLuminance(p.team.primaryColor ?? '#000000') }))
    .sort((a, b) => a.lum - b.lum);
  const darkest = byLum[0];
  const lightest = byLum[byLum.length - 1];

  return (
    <UpcomingPromoModalProvider showTeamLink>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rd-ink-faint">
          Dev preview · not linked anywhere · prod 404s this route
        </p>
        <h1 className="rd-display mt-2 text-4xl uppercase text-rd-ink">Ticket Stub Card</h1>
        <p className="mt-2 max-w-xl font-rd text-sm text-rd-ink-soft">
          {promos.length} real promos spanning all four types. Tap any card: it opens the same
          shared modal as the live homepage cards, firing the same events on the same surface.
        </p>

        <h2 className="mt-12 font-rd text-lg font-bold text-rd-ink">Tonight-rail presentation</h2>
        <Rail promos={promos} />

        <h2 className="mt-10 font-rd text-lg font-bold text-rd-ink">Best-promos presentation (rank watermark)</h2>
        <Rail promos={promos} withRank />

        <h2 className="mt-10 font-rd text-lg font-bold text-rd-ink">Spine ink extremes</h2>
        <p className="mb-2 font-rd text-sm text-rd-ink-soft">
          Darkest team color in the set: {darkest.p.team.primaryColor} (luminance{' '}
          {darkest.lum.toFixed(3)}). Lightest: {lightest.p.team.primaryColor} (luminance{' '}
          {lightest.lum.toFixed(3)}). The rotated date picks white or dark ink via chipInk.
        </p>
        <div className="flex gap-5">
          <div className="w-[274px] flex-none">
            <TicketStubCard
              promo={darkest.p}
              contexts={null}
              surface="web_home_tonight"
              starPlacement="homepage_this_week_inline"
            />
          </div>
          <div className="w-[274px] flex-none">
            <TicketStubCard
              promo={lightest.p}
              contexts={null}
              surface="web_home_tonight"
              starPlacement="homepage_this_week_inline"
            />
          </div>
        </div>
      </div>
    </UpcomingPromoModalProvider>
  );
}
