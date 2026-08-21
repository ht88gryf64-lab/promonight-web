import type { Team, Venue } from '@/lib/types';

// Hardcoded, never derived from the clock. A page that renders "2027 promo
// schedule" on 2027-01-01 while its own title, FAQ and JSON-LD still say 2026 is
// worse than one that is deliberately a season behind. Bump this when next
// season's content is ready.
const SEASON_YEAR = 2026;

type LeagueCopy = {
  cadence: string;
  paragraphs: (ctx: { teamName: string; venueName: string; city: string; year: number }) => string[];
};

// League-specific evergreen copy that renders in place of "Upcoming Promos"
// when a team has 0 known promos scheduled. Server-rendered so AI crawlers and
// search engines see the content.
const LEAGUE_COPY: Record<string, LeagueCopy> = {
  // NFL is the only league whose zero-promo pages render a full 18-week slate
  // directly ABOVE this block, so this copy deliberately names no venue, no
  // direction and no module. Each of those was a defect in the version it
  // replaces, and each is fixed by deletion rather than by rewording, so none
  // can regress:
  //   - a single home venue is false for the 8 clubs with a neutral-site
  //     international home game (the Rams open at the Melbourne Cricket
  //     Ground, which the schedule row above names)
  //   - "from the links below" pointed at the affiliate stack, which is
  //     order-[20], ABOVE this on mobile and beside it on desktop
  //   - "listed above" would be coupled to a layout that has already moved once
  // The claim is scoped to OUR data ("PromoNight has no confirmed ... listed"),
  // not to what the clubs have announced. Nothing in this repo ingests NFL
  // promos, so a claim about what 32 real organizations have or have not
  // announced is one we cannot support.
  NFL: {
    cadence: 'preseason to September',
    paragraphs: ({ teamName, year }) => [
      `PromoNight has no confirmed ${year} ${teamName} promotions listed yet. NFL teams typically announce giveaways, theme nights, and kids events close to the September opener, then keep adding dates through the season. Confirmed ${teamName} promos will appear here, with the home date each one runs on.`,
    ],
  },
  WNBA: {
    cadence: 'May start',
    paragraphs: ({ teamName, venueName, year }) => [
      `The WNBA regular season runs May through September. ${teamName} ${year} promotional schedules are typically released in April or early May, so this page fills out as the season gets closer.`,
      `When promos are announced, you'll see every giveaway, theme night, ticket pack, and family event here at ${venueName}. Check back closer to the season opener, or download the free PromoNight app to browse every confirmed promo across all six leagues in one calendar.`,
    ],
  },
  NBA: {
    cadence: 'October–April regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `The ${teamName} haven't announced any ${year} promotional events yet. Most NBA teams release their full promo schedules at the start of the regular season and then add dates throughout the year.`,
      `When ${teamName} promos are confirmed at ${venueName}, they'll appear on this page. In the meantime, the free PromoNight app carries the same calendar, so confirmed events show up there too.`,
    ],
  },
  NHL: {
    cadence: 'October–April regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `The ${teamName} haven't announced any ${year} promotional events yet. NHL teams typically release the bulk of their promo calendar at season open and continue adding dates through the playoffs.`,
      `When ${teamName} giveaways, theme nights, or family events are confirmed at ${venueName}, they'll show up here. The free PromoNight app carries the same calendar as this page.`,
    ],
  },
  MLS: {
    cadence: 'February–October regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `MLS regular season runs February through October. ${teamName} ${year} promo schedules are released throughout the season rather than all at once, so this page grows as new events are confirmed.`,
      `Check back as the season progresses for giveaways, theme matches, and family events at ${venueName}, or browse the same calendar in the free PromoNight app.`,
    ],
  },
  MLB: {
    cadence: 'March–October regular season',
    paragraphs: ({ teamName, venueName, year }) => [
      `The ${teamName} haven't released a full ${year} promotional schedule yet. MLB teams typically publish promo calendars in late January or early February for the full season.`,
      `When ${teamName} ${year} giveaways, theme nights, and fireworks dates are announced for ${venueName}, every event will appear here. The free PromoNight app carries the same calendar once the schedule is posted.`,
    ],
  },
};

const TRAILING_COUNTRY = /^(usa|u\.s\.a\.?|united states|canada|mexico|uk|united kingdom|england)$/i;

// "123 Main St, Kansas City, MO 64129" gives "Kansas City": the city is the
// second-to-last part, because the last part is always region plus postal code.
//
// This previously indexed parts.length - 3, which is index 0 on a 3-part
// address and therefore returned the STREET on all 148 venue docs. The
// `|| team.city` fallback at the call site could never rescue it, because a
// street line is a non-empty string. Measured across the whole venues
// collection: 146 docs are 3-part and 2 are 4-part with a trailing country
// (coca-cola-coliseum, moda-center-portland-fire), which a bare length - 2 would
// render as "ON M6K 3C3" and "OR 97227". Stripping the country first returns a
// clean city on 148 of 148.
function extractCity(address: string | undefined): string {
  if (!address) return '';
  let parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && TRAILING_COUNTRY.test(parts[parts.length - 1]!)) {
    parts = parts.slice(0, -1);
  }
  if (parts.length >= 2) return parts[parts.length - 2] ?? '';
  return parts[0] ?? '';
}

export function ZeroPromoFallback({
  team,
  venue,
  teamName,
  variant = 'dark',
}: {
  team: Team;
  venue: Venue | null;
  teamName: string;
  /** 'dark' is the untouched legacy-path styling and stays the default, so the
   *  one pre-existing call site needs no change. 'light' is the house variant
   *  the redesign template renders, following the same shape as every sibling
   *  section (PromoList, AuthorityStats, TeamFAQ, TeamContentSections). */
  variant?: 'dark' | 'light';
}) {
  // Keyed on team.league, which Firestore stores uppercase ('NFL', 'NBA').
  // NOT team.sportSlug, which is derived at read time and is not on the doc.
  const copy = LEAGUE_COPY[team.league] ?? LEAGUE_COPY.MLB;
  const venueName = venue?.name ?? `${team.name} home venues`;
  const city = extractCity(venue?.address) || team.city;
  const paragraphs = copy.paragraphs({ teamName, venueName, city, year: SEASON_YEAR });

  if (variant === 'light') {
    return (
      <section className="py-12 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
              Coming up
            </span>
            <h2 className="rd-display mt-1 text-2xl text-rd-ink md:text-3xl">
              {SEASON_YEAR} {teamName.toUpperCase()} PROMO SCHEDULE
            </h2>
          </div>

          <div className="space-y-4 rounded-2xl border border-rd-line bg-rd-card p-6 md:p-8">
            {paragraphs.map((p, i) => (
              <p key={i} className="font-rd text-sm leading-relaxed text-rd-ink-soft md:text-base">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Coming up
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            {SEASON_YEAR} {teamName.toUpperCase()} PROMO SCHEDULE
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
