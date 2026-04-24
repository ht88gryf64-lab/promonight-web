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

export function VenueInfoBlock({ venue, league }: { venue: Venue; league: string }) {
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

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Plan your visit
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            AT {venue.name.toUpperCase()}
          </h2>
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
