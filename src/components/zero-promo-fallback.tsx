import type { Team, Venue } from '@/lib/types';
import { getCurrentYear } from '@/lib/promo-helpers';

type LeagueCopy = {
  cadence: string;
  paragraphs: (ctx: { teamName: string; venueName: string; city: string; year: number }) => string[];
};

// League-specific evergreen copy that renders in place of "Upcoming Promos"
// when a team has 0 known promos scheduled. Server-rendered so AI crawlers and
// search engines see the content.
const LEAGUE_COPY: Record<string, LeagueCopy> = {
  NFL: {
    cadence: 'preseason to September',
    paragraphs: ({ teamName, venueName, city, year }) => [
      `NFL teams typically announce promotional schedules closer to the season opener in September. Once the ${teamName} reveal their ${year} promo calendar, you'll find every giveaway, theme night, and kids event on this page.`,
      `In the meantime, the ${teamName} play their home schedule at ${venueName}${city ? ` in ${city}` : ''}. Plan a visit with tickets, parking, and hotels from the links below — or download the free PromoNight app to get notified the moment any ${teamName} promo is announced.`,
    ],
  },
  WNBA: {
    cadence: 'May start',
    paragraphs: ({ teamName, venueName, year }) => [
      `The WNBA regular season runs May through September. ${teamName} ${year} promotional schedules are typically released in April or early May, so this page fills out as the season gets closer.`,
      `When promos are announced, you'll see every giveaway, theme night, ticket pack, and family event here at ${venueName}. Check back closer to the season opener, or get the free PromoNight app to be notified the moment ${teamName} announce their promos.`,
    ],
  },
  NBA: {
    cadence: 'October–April regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `The ${teamName} haven't announced additional ${year} promotional events at this time. Most NBA teams release their full promo schedules at the start of the regular season and then add dates throughout the year.`,
      `When new ${teamName} promos are confirmed at ${venueName}, they'll appear on this page. In the meantime, get the free PromoNight app to be notified as soon as new giveaways, theme nights, or kids events are added.`,
    ],
  },
  NHL: {
    cadence: 'October–April regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `The ${teamName} haven't announced additional ${year} promotional events at this time. NHL teams typically release the bulk of their promo calendar at season open and continue adding dates through the playoffs.`,
      `When new ${teamName} giveaways, theme nights, or family events are confirmed at ${venueName}, they'll show up here. Get the free PromoNight app to be notified the moment new promos are added.`,
    ],
  },
  MLS: {
    cadence: 'February–October regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `MLS regular season runs February through October. ${teamName} ${year} promo schedules are released throughout the season rather than all at once, so this page grows as new events are confirmed.`,
      `Check back as the season progresses for giveaways, theme matches, and family events at ${venueName}, or get the free PromoNight app for notifications.`,
    ],
  },
  MLB: {
    cadence: 'March–October regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `The ${teamName} haven't released a full ${year} promotional schedule yet. MLB teams typically publish promo calendars in late January or early February for the full season.`,
      `When ${teamName} ${year} giveaways, theme nights, and fireworks dates are announced for ${venueName}, every event will appear here. Get the free PromoNight app to be notified as soon as the schedule is posted.`,
    ],
  },
};

function extractCity(address: string | undefined): string {
  if (!address) return '';
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  // "123 Main St, Kansas City, MO 64129" → "Kansas City"
  if (parts.length >= 3) return parts[parts.length - 3] ?? '';
  if (parts.length === 2) return parts[0] ?? '';
  return '';
}

export function ZeroPromoFallback({
  team,
  venue,
  teamName,
}: {
  team: Team;
  venue: Venue | null;
  teamName: string;
}) {
  const copy = LEAGUE_COPY[team.league] ?? LEAGUE_COPY.MLB;
  const venueName = venue?.name ?? `${team.name} home venues`;
  const city = extractCity(venue?.address) || team.city;
  const paragraphs = copy.paragraphs({ teamName, venueName, city, year: getCurrentYear() });

  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Coming up
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            {getCurrentYear()} {teamName.toUpperCase()} PROMO SCHEDULE
          </h2>
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 md:p-8 space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-text-secondary text-sm md:text-base leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
