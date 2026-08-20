import type { PromoWithTeam } from '@/lib/types';

// Decorative scrolling strip of tonight's promos, welded to the bottom edge of
// the dark hero band. Server component: no 'use client', no matchMedia, no
// effect. The whole thing is CSS (see the .rd-ticker block in globals.css), so
// the prerendered HTML is identical for every visitor and ISR is unaffected.
//
// aria-hidden by design. Every promo shown here is also rendered in the Tonight
// rail below, so announcing it twice would be noise. That also means nothing
// may ever appear ONLY in the ribbon, which holds as long as it is fed the same
// pickHeroBuckets tonight array the rail gets.
//
// Reduced motion SUPPRESSES the strip entirely rather than freezing it: a
// stopped track shows a truncated half list, because the seamless loop depends
// on both copies moving. The rule lives in globals.css next to the layout for
// cascade reasons documented there.
//
// Empty renders nothing (the StubRail precedent), so an offseason or no-game
// day gets no strip rather than an empty scrolling band.

// Seconds of travel per item, applied to the full doubled track. Derived
// rather than the target's fixed 46s, which was calibrated to its own mock
// payload and would read frantic on a two-promo day.
const SECONDS_PER_ITEM = 6;
const MIN_DURATION_S = 24;

function ribbonLabel(promo: PromoWithTeam): string {
  // Time is optional on a real promo (a genuine minority carry an empty
  // string), so the clock segment is dropped rather than faked. The raw stored
  // string is used as-is, the same value TicketStubCard prints, so one page
  // never shows two time formats.
  const parts = [promo.title, promo.team.name];
  if (promo.time) parts.push(promo.time);
  return parts.join(' · ');
}

export function TonightRibbon({ items }: { items: PromoWithTeam[] }) {
  if (items.length === 0) return null;

  const durationS = Math.max(MIN_DURATION_S, items.length * SECONDS_PER_ITEM);

  // Emitted twice, byte-identical, so the -50% translate lands copy two exactly
  // where copy one began. Any per-copy difference would break the seam.
  const track = [0, 1].flatMap((copy) => [
    // Leading label, part of each copy so the seam stays symmetric. Accurate
    // by construction: pickHeroBuckets only puts today's promos in this bucket.
    <span className="rd-ticker-item" key={`${copy}-label`}>
      Tonight
    </span>,
    ...items.map((promo, i) => (
      <span className="rd-ticker-item" key={`${copy}-${promo.team.id}-${promo.date}-${i}`}>
        {ribbonLabel(promo)}
      </span>
    )),
  ]);

  return (
    <div className="rd-ticker" aria-hidden="true">
      <div className="rd-ticker-track" style={{ animationDuration: `${durationS}s` }}>
        {track}
      </div>
    </div>
  );
}
