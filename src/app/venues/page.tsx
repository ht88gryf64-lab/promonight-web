import type { Metadata } from 'next';
import Link from 'next/link';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getVenueIndexEntries, SEASON_YEAR } from '@/lib/venue-hub';
import { BAG_SEASON } from '@/lib/venue-bag-policies';
import { groupVenueIndexEntries } from '@/lib/venue-index';
import { HubVenueLinks } from '@/components/hub/HubVenueLinks';
import { getLeagueHub, hubIndexLinkLabel } from '@/lib/league-hubs';
import { pageOpenGraph } from '@/lib/og';

// /venues index: the directory over every indexable building hub. Before this
// page existed the bare path 404ed and each venue page's only inbound internal
// link was its tenant team page(s); this page is the second inbound link for
// all of them, reachable sitewide through the footer.
//
// 24h ISR like the venue pages themselves; on-demand revalidation stays the
// real freshness path when the sweep verifies new buildings.
export const revalidate = 86400;

const CANONICAL = 'https://www.getpromonight.com/venues';
// Season year is the deliberate SEASON_YEAR constant, never getFullYear().
// Retitled off "Bag Policies" so the head term consolidates on the child
// aggregator (/venues/bag-policies) instead of splitting relevance with it.
const TITLE = 'Stadium Guides: Parking & Gameday Rules';
const DESCRIPTION = `Bag policies, parking, gate times, and transit for MLB, NFL, MLS, WNBA, NBA, NHL, and college football stadiums and arenas, verified for the ${SEASON_YEAR} season.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: pageOpenGraph('/venues'),
};

export default async function VenuesIndexPage() {
  const entries = await getVenueIndexEntries();
  const sections = groupVenueIndexEntries(entries);

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <header className="mx-auto max-w-6xl px-6 pt-12">
        <h1 className="rd-display text-4xl text-rd-ink sm:text-5xl">
          STADIUM &amp; ARENA GUIDES
        </h1>
        <p className="mt-4 max-w-2xl font-rd text-[15px] leading-relaxed text-rd-ink-soft">
          {entries.length} verified gameday guides for the {SEASON_YEAR} season: bag
          policies, parking, gate times, and transit, one page per building. Pick
          a venue for the full rundown, or jump to its league below.
        </p>
        {/* The bag-policy aggregator: the namespace's comparison layer over the
            per-building guides. Prominent by design (aggregator plan Build 2). */}
        <Link
          href="/venues/bag-policies"
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-rd-line bg-rd-card px-4 py-3 font-rd text-sm font-semibold text-rd-ink shadow-sm transition-colors hover:border-rd-red hover:text-rd-red"
        >
          MLB Bag Policy {BAG_SEASON}: every ballpark&apos;s rule, compared
          <span aria-hidden>→</span>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-6 pb-20 pt-12">
        {sections.map((s) => {
          const hub = getLeagueHub(s.league);
          const hubLive = hub?.live === true;
          return (
            <section key={s.league} id={`venues-${s.league.toLowerCase()}`} className="scroll-mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="font-rd text-xl font-bold text-rd-ink">{s.heading}</h2>
                {hubLive ? (
                  <Link
                    href={hub.href}
                    className="font-rd text-sm text-rd-ink-soft transition-colors hover:text-rd-red"
                  >
                    {hubIndexLinkLabel(hub)} ›
                  </Link>
                ) : null}
              </div>
              <div className="mt-5">
                <HubVenueLinks
                  venues={s.venues}
                  surface="web_venue_index"
                  placement="venues_index"
                />
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
