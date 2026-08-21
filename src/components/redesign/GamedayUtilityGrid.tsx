import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { IconArrowRight, IconParking, IconShoppingBag, IconBus, IconClock } from '@tabler/icons-react';
import type { VenueUtilityCounts } from '@/lib/venue-hub';

// "Going to the Game?" utility grid: 4 cards, one per venue-hub section that
// is populated at scale (design-target audit correction 4; hotels, seating,
// and tickets were cut there). Counts arrive derived from getVenueUtilityCounts
// (render-gate mirrors, never hardcoded) and are season-independent: venue
// logistics do not expire with a league's season, so this section renders the
// same in August and December. Internal navigation only — no affiliate links
// on the homepage. All four cards land on the /venues index: its anchors are
// per-league (venues-mlb, venues-nfl, ...), not per-topic, so a topic-level
// deep link does not exist today, and picking one league's anchor would break
// the league-agnostic constraint. Links are plain; event names come at wiring.

const CARDS: Array<{
  key: keyof Omit<VenueUtilityCounts, 'verifiedTotal'>;
  label: string;
  blurb: string;
  Icon: typeof IconParking;
}> = [
  { key: 'parking', label: 'Parking', blurb: 'Lots and rates nearby', Icon: IconParking },
  { key: 'bag', label: 'Bag Policy', blurb: 'What you can bring in', Icon: IconShoppingBag },
  { key: 'transit', label: 'Transit', blurb: 'Trains, buses and routes', Icon: IconBus },
  { key: 'gates', label: 'Gate Times', blurb: 'When doors open', Icon: IconClock },
];

export function GamedayUtilityGrid({ counts }: { counts: VenueUtilityCounts }) {
  const cards = CARDS.filter((c) => counts[c.key] > 0);
  if (cards.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
            <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-cat-kids" />
            Plan your trip
          </div>
          <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
            Going to the Game?
          </h2>
          <p className="mt-2 max-w-md font-rd text-sm text-rd-ink-soft">
            Everything you need once you have picked the night.
          </p>
        </div>
        <TrackedTapLink
          href="/venues"
          trackEvent="gameday_card_tap"
          trackProps={{
            surface: 'web_home',
            card: 'all_venues',
            venue_count: counts.verifiedTotal,
            destination_url: '/venues',
          }}
          className="inline-flex items-center gap-1.5 pb-1 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-rd-red-dark transition-colors hover:text-rd-red"
        >
          All venue guides
          <IconArrowRight size={13} stroke={2.6} />
        </TrackedTapLink>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ key, label, blurb, Icon }) => (
          <TrackedTapLink
            key={key}
            href="/venues"
            trackEvent="gameday_card_tap"
            trackProps={{
              surface: 'web_home',
              card: key,
              venue_count: counts[key],
              destination_url: '/venues',
            }}
            className="group flex flex-col rounded-xl border border-rd-line bg-rd-card p-5 transition-colors hover:border-rd-line-strong"
          >
            <span
              aria-hidden
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rd-ink/[0.06] text-rd-ink"
            >
              <Icon size={19} stroke={1.8} />
            </span>
            <p className="font-rd text-[17px] font-bold uppercase leading-tight text-rd-ink">
              {label}
            </p>
            <p className="mt-1.5 font-rd text-xs leading-snug text-rd-ink-soft">{blurb}</p>
            <p className="mt-3 font-mono text-[10.5px] font-semibold tracking-[0.08em] text-rd-ink-soft">
              {counts[key]} venues
            </p>
          </TrackedTapLink>
        ))}
      </div>
    </section>
  );
}
