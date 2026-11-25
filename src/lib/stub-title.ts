// THE TICKET-STUB CARD'S TITLE SIZE. Pure and client-safe.
//
// The card (src/components/redesign/TicketStubCard.tsx, on the homepage
// Tonight and Best Promos rails) printed every title at 27px under a
// three-line clamp. A short title is fine there. A long one lost its last
// words to the ellipsis: on 2026-11-25 "Evgeni Malkin Talking Bobblehead"
// read "Evgeni Malkin Talking..." (the item gone) and "Cutter Gauthier
// Bobblehead Giveaway" was cut mid-word.
//
// So the size steps down until the title fits: the largest tier in which a
// greedy word wrap needs no more lines than the tier allows and no single
// word overflows a line. The per-line budgets are character counts measured
// on the card at 27px (about 12 bold Archivo characters across the title
// column) and scaled by size. They are estimates on purpose (the server
// cannot measure text), set a little tight so a title that passes here does
// not wrap further in the browser. Every tier fits the card's fixed 81px
// title block, so the card's height never changes. The clamp stays as the
// last resort for a title no tier fits.

export interface StubTitleTier {
  /** Tailwind classes for size, leading and the clamp. */
  className: string;
  /** Characters that fit across the title column at this size. */
  perLine: number;
  maxLines: number;
}

export const STUB_TITLE_TIERS: readonly StubTitleTier[] = [
  { className: 'text-[27px] leading-none line-clamp-3', perLine: 12, maxLines: 3 },
  { className: 'text-[22px] leading-[1.05] line-clamp-3', perLine: 14, maxLines: 3 },
  { className: 'text-[19px] leading-[1.05] line-clamp-4', perLine: 17, maxLines: 4 },
  { className: 'text-[17px] leading-[1.1] line-clamp-4', perLine: 19, maxLines: 4 },
];

/** Lines a greedy word wrap needs at `perLine` characters, or Infinity when
 *  one word is wider than a line (it would be broken or clipped). */
export function wrappedLines(title: string, perLine: number): number {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let lines = 1;
  let used = 0;
  for (const w of words) {
    if (w.length > perLine) return Infinity;
    if (used === 0) used = w.length;
    else if (used + 1 + w.length <= perLine) used += 1 + w.length;
    else { lines += 1; used = w.length; }
  }
  return lines;
}

/** The largest tier the whole title fits; the smallest when none does. */
export function stubTitleTier(title: string): StubTitleTier {
  return STUB_TITLE_TIERS.find((t) => wrappedLines(title, t.perLine) <= t.maxLines) ?? STUB_TITLE_TIERS[STUB_TITLE_TIERS.length - 1];
}
