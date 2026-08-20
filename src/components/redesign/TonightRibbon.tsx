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

// Entries to aim for inside ONE copy of the strip. The CSS pins each copy to
// at least the container width, so the loop is seamless at any inventory, but
// a two-promo night would still leave most of that width empty. Repeating the
// short list to roughly fill the band is the ordinary marquee behaviour and
// costs nothing: the strip is decorative and aria-hidden, and every promo in
// it is announced once, properly, by the Tonight rail below.
const TARGET_ENTRIES_PER_COPY = 6;

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

  const repeats = Math.max(1, Math.ceil(TARGET_ENTRIES_PER_COPY / items.length));
  const entries = Array.from({ length: repeats }, () => items).flat();
  const durationS = Math.max(MIN_DURATION_S, entries.length * SECONDS_PER_ITEM);

  // Two copies, identical in rendered output, so the -50% translate lands copy
  // two exactly where copy one began. Any per-copy difference breaks the seam.
  const copies = [0, 1].map((copy) => (
    <div className="rd-ticker-copy" key={copy}>
      {/* Leading label, inside each copy so the seam stays symmetric. Accurate
          by construction: pickHeroBuckets only puts today's promos here. */}
      <span className="rd-ticker-item">Tonight</span>
      {entries.map((promo, i) => (
        <span className="rd-ticker-item" key={`${promo.team.id}-${promo.date}-${i}`}>
          {ribbonLabel(promo)}
        </span>
      ))}
    </div>
  ));

  return (
    <div className="rd-ticker" aria-hidden="true">
      <div className="rd-ticker-track" style={{ animationDuration: `${durationS}s` }}>
        {copies}
      </div>
    </div>
  );
}
