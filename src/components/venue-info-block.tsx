import { IconClock } from '@tabler/icons-react';
import type { Venue } from '@/lib/types';

function gateTimesFallback(league: string): string {
  switch (league) {
    case 'MLB':
      return 'Gates typically open 90 minutes before first pitch (earlier on giveaway nights).';
    case 'NBA':
    case 'WNBA':
      return 'Doors typically open 90 minutes before tipoff.';
    case 'NFL':
      return 'Gates typically open about 2 hours before kickoff.';
    case 'NHL':
      return 'Gates typically open 75–90 minutes before puck drop.';
    case 'MLS':
      return 'Gates typically open 60–90 minutes before kickoff.';
    default:
      return 'Gates typically open 90 minutes before the game.';
  }
}

export function VenueInfoBlock({
  venue,
  league,
  variant = 'dark',
}: {
  venue: Venue;
  league: string;
  variant?: 'dark' | 'light';
}) {
  // Venue plan always has *something* to show — the generic league cadence
  // covers gate times when the venue record doesn't. Render whenever we have
  // at least a venue name.
  const gate = venue.gatesOpen?.trim() || gateTimesFallback(league);

  const rows: { label: string; content: React.ReactNode }[] = [];
  rows.push({ label: 'Gate times', content: gate });
  if (venue.parkingInfo) rows.push({ label: 'Parking', content: venue.parkingInfo });
  if (venue.publicTransit) rows.push({ label: 'Transit', content: venue.publicTransit });
  if (venue.accessibility) rows.push({ label: 'Accessibility', content: venue.accessibility });
  if (venue.bagPolicyUrl) {
    rows.push({
      label: 'Bag policy',
      content: (
        <a
          href={venue.bagPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-red hover:underline"
        >
          Official {venue.name} bag policy ↗
        </a>
      ),
    });
  }
  if (venue.nearby) rows.push({ label: 'Nearby', content: venue.nearby });

  if (variant === 'light') {
    const lightRows: { label: string; content: React.ReactNode }[] = [];
    lightRows.push({ label: 'Gate times', content: gate });
    if (venue.parkingInfo) lightRows.push({ label: 'Parking', content: venue.parkingInfo });
    if (venue.publicTransit) lightRows.push({ label: 'Transit', content: venue.publicTransit });
    if (venue.accessibility) lightRows.push({ label: 'Accessibility', content: venue.accessibility });
    if (venue.bagPolicyUrl) {
      lightRows.push({
        label: 'Bag policy',
        content: (
          <a
            href={venue.bagPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rd-red hover:underline"
          >
            Official {venue.name} bag policy ↗
          </a>
        ),
      });
    }
    if (venue.nearby) lightRows.push({ label: 'Nearby', content: venue.nearby });

    return (
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <IconClock size={13} stroke={2.25} className="text-rd-ink-faint" />
          <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
            Game day
          </span>
        </div>

        <div className="bg-rd-card border border-rd-line rounded-2xl divide-y divide-rd-line">
          {lightRows.map((row, i) => (
            <div key={i} className="px-5 py-4">
              <div className="font-rd text-[10px] uppercase tracking-wide text-rd-ink-faint">
                {row.label}
              </div>
              <div className="mt-1 text-rd-ink-soft text-sm leading-relaxed">
                {row.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Plan your visit
          </span>
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-2xl p-5 md:p-6 divide-y divide-border-subtle">
          {rows.map((row, i) => (
            <div key={i} className={`flex flex-col md:flex-row gap-1 md:gap-6 ${i === 0 ? 'pb-4' : 'py-4'} ${i === rows.length - 1 ? 'md:pb-0 pb-0' : ''}`}>
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted md:w-32 md:flex-shrink-0 md:pt-0.5">
                {row.label}
              </div>
              <div className="text-text-secondary text-sm leading-relaxed flex-1">
                {row.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
