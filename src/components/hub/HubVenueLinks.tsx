'use client';

import Link from 'next/link';
import { track, type AnalyticsSurface } from '@/lib/analytics';
import type { HubVenueLink } from '@/lib/venue-index';

// Venue-guide link section for the league hubs and the /venues index. Same
// crawlability rule as HubTeamGrid: every anchor is in the server-rendered HTML
// at all times (client components SSR their initial markup), nothing is
// filtered, lazy-mounted, or fetched on interaction. Client component only for
// the venue_hub_click capture on mousedown (the VenueHubLink convention).
//
// `heading` renders the section's own h2 (pro hubs + /venues index). The CFB
// hub passes no heading and wraps this in its own SectionLabel styling, so the
// component degrades to a bare list wrapped in a div instead of a section.
/** The card sub-line: the topics this building actually publishes, sentence
 *  cased. Empty for a building that publishes none, so the card names the
 *  building and its city and promises nothing else. */
function topicLine(topics: string[] | undefined): string {
  const t = topics ?? [];
  if (t.length === 0) return 'Gameday guide';
  if (t.length === 1) return t[0];
  return `${t.slice(0, -1).join(', ')} & ${t[t.length - 1]}`;
}

export function HubVenueLinks({
  venues,
  surface,
  placement,
  sectionId,
  heading,
  intro,
  dark = false,
}: {
  venues: HubVenueLink[];
  surface: AnalyticsSurface;
  placement: string;
  sectionId?: string;
  heading?: string;
  intro?: string;
  dark?: boolean;
}) {
  if (venues.length === 0) return null;

  const list = (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {venues.map((v) => {
        const href = `/venues/${v.slug}`;
        return (
          <li key={v.slug}>
            <Link
              href={href}
              aria-label={`${v.name} bag policy, parking and gameday guide`}
              onMouseDown={() =>
                track('venue_hub_click', {
                  surface,
                  placement,
                  building_slug: v.slug,
                  building_name: v.name,
                  destination_url: href,
                })
              }
              className="group block"
            >
              <span
                className={
                  dark
                    ? 'block font-rd text-[14.5px] font-semibold text-white/85 transition-colors group-hover:text-white'
                    : 'block font-rd text-[14.5px] font-semibold text-rd-ink transition-colors group-hover:text-rd-red'
                }
              >
                {v.name}
              </span>
              <span
                className={
                  dark
                    ? 'block font-rd text-[12.5px] text-white/45'
                    : 'block font-rd text-[12.5px] text-rd-ink-faint'
                }
              >
                {v.city ? `${v.city} · ` : ''}
                {topicLine(v.topics)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (!heading) {
    return <div id={sectionId}>{list}</div>;
  }

  return (
    <section id={sectionId} className="scroll-mt-6">
      <h2
        className={
          dark
            ? 'font-rd text-xl font-bold text-white'
            : 'font-rd text-xl font-bold text-rd-ink'
        }
      >
        {heading}
      </h2>
      {intro ? (
        <p
          className={
            dark
              ? 'mt-1.5 max-w-2xl font-rd text-sm text-white/55'
              : 'mt-1.5 max-w-2xl font-rd text-sm text-rd-ink-soft'
          }
        >
          {intro}
        </p>
      ) : null}
      <div className="mt-5">{list}</div>
    </section>
  );
}
