import { IconClock } from '@tabler/icons-react';
import type { Venue } from '@/lib/types';
import { venuesTransitSuppressed } from '@/lib/venue-transit-suppression';

type Row = { label: string; content: React.ReactNode };

/**
 * The rows the record actually supports, in display order. Every row is gated
 * on its own field: nothing here substitutes, defaults, or generates a value
 * when the record is silent, so an empty return means the venue has nothing
 * verified to say and the caller renders no card at all.
 */
function buildRows(
  venue: Venue,
  gate: string | null,
  transit: string | null,
  linkClass: string,
): Row[] {
  const rows: Row[] = [];
  if (gate) rows.push({ label: 'Gate times', content: gate });
  if (venue.parkingInfo) rows.push({ label: 'Parking', content: venue.parkingInfo });
  if (transit) rows.push({ label: 'Transit', content: transit });
  if (venue.accessibility) rows.push({ label: 'Accessibility', content: venue.accessibility });
  if (venue.bagPolicyUrl) {
    rows.push({
      label: 'Bag policy',
      content: (
        <a
          href={venue.bagPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} hover:underline`}
        >
          Official {venue.name} bag policy ↗
        </a>
      ),
    });
  }
  if (venue.nearby) rows.push({ label: 'Nearby', content: venue.nearby });
  return rows;
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
  // A field the record does not carry renders NO row. What stood here was a
  // hardcoded league sentence substituted for an absent gatesOpen and labelled
  // "Gate times" in the same style as a sourced value, on 85 of 169 team pages,
  // and on 69 of those it was the only row in the card. A generated cadence is
  // not a fact about this building. Nothing replaces it: an absent field is
  // absent. See audit/venues-collection-phase0.md.
  const gate = venue.gatesOpen?.trim() || null;
  // Transit withheld in THIS corpus is withheld here. Not the hub-scoped set:
  // the two corpora store independent strings, and of the nine buildings on the
  // suppression list that also publish transit here, only three carry the
  // defect their reason describes. Blanket-transferring would withhold correct
  // text on eight of eleven team pages.
  const transit = venue.publicTransit && !venuesTransitSuppressed(venue.slug) ? venue.publicTransit : null;

  // One row list, both variants. These were two identical copies differing only
  // in the bag link's colour class, which is the same shape of defect as the
  // duplicated Firestore-to-Venue mapping: a gate added to one copy and not the
  // other renders differently depending on which surface you are standing on.
  const rows = buildRows(venue, gate, transit, 'text-accent-red');

  if (variant === 'light') {
    const lightRows = buildRows(venue, gate, transit, 'text-rd-red');

    // A labelled box with nothing in it reads as a failure, not as restraint.
    if (!lightRows.length) return null;
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

  if (!rows.length) return null;
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
