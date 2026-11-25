import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import type { Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import type { LeagueGroup } from './helpers';
import { TodayPromoCard } from './TodayPromoCard';

// One league section on the /promos/today board: a header row with the league
// color dot, name, promo count, and a "[League] hub ->" link (only when that
// hub is live, so a league with promos today but no hub yet still shows its
// section without a broken link), then a grid of promo cards. Server component.
export function TodayLeagueSection({
  group,
  venueByTeam,
  surface,
  dimmed = false,
}: {
  group: LeagueGroup;
  venueByTeam: Map<string, Venue | null>;
  surface: AnalyticsSurface;
  dimmed?: boolean;
}) {
  const { label, accent, hubHref, promos } = group;
  return (
    <section aria-label={`${label} promos`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-rd text-[15px] font-bold uppercase tracking-[0.06em] text-rd-ink">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {label}
          <span className="font-rd text-[13px] font-medium normal-case tracking-normal text-rd-ink-faint">
            · {promos.length} {promos.length === 1 ? 'promo' : 'promos'}
          </span>
        </h2>
        {hubHref && (
          <Link
            href={hubHref}
            className="inline-flex shrink-0 items-center gap-1 font-rd text-[13px] font-semibold text-rd-red hover:underline"
          >
            {label} hub
            <IconArrowRight size={14} stroke={2} />
          </Link>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {promos.map((p) => (
          <TodayPromoCard
            key={`${p.team.id}-${p.date}-${p.title}`}
            promo={p}
            venue={venueByTeam.get(p.team.id) ?? null}
            surface={surface}
            dimmed={dimmed}
          />
        ))}
      </div>
    </section>
  );
}
