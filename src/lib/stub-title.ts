// THE TICKET-STUB CARD'S TITLE SIZE. Pure and client-safe.
//
// The card (src/components/redesign/TicketStubCard.tsx, on the homepage
// Tonight and Best Promos rails) printed every title at 27px under a
// three-line clamp. A short title is fine there. A long one lost its last
// words to the ellipsis: on 2026-11-25 "Evgeni Malkin Talking Bobblehead"
// read "Evgeni Malkin Talking..." (the item gone) and "Cutter Gauthier
// Bobblehead Giveaway" was cut mid-word.
//
// So the size steps down until the title fits: the largest tier in which
// the title, wrapped the way the browser wraps it, needs no more lines than
// the tier allows and no single word is wider than the column.
//
// THE WIDTHS ARE MEASURED, NOT GUESSED. The first version counted
// characters (about 12 to a line at 27px) and was wrong both ways on real
// titles: "James Harden" is twelve characters and 187.8px wide in a 180px
// column, so "James Harden Special Bobblehead" still lost its last word,
// while narrow titles were stepped down for nothing. ADVANCE below is the
// advance width of every printable ASCII character in Archivo 700, in
// thousandths of an em, read from the rendered font in Chrome on 2026-11-25
// with the card's letter-spacing (0.004em) included and kerning off. Kerning
// only ever tightens a line, so the estimate errs wide; SAFETY covers the
// rounding. If the card's font, weight or width changes, measure again
// (the test pins eight measured strings against this table).
//
// Every tier fits the card's fixed 81px title block, so the card's height
// never changes. The clamp stays as the last resort for a title no tier fits.

/** The title column: the card is 274px wide (StubRail) with fixed padding. */
export const STUB_TITLE_COLUMN_PX = 180;
/** Pixels kept free on each line for rounding. */
const SAFETY_PX = 1;

// Code points 32 (space) through 126 (~).
const ADVANCE: readonly number[] = [
  200, 305, 460, 604, 560, 977, 768, 257, 368, 368, 411, 645, 311, 337, 311, 304,
  599, 600, 600, 600, 601, 599, 600, 600, 600, 599, 339, 339, 645, 645, 645, 617,
  1005, 728, 726, 737, 743, 687, 626, 806, 758, 305, 607, 729, 595, 876, 758, 797,
  685, 797, 734, 683, 645, 752, 698, 968, 710, 703, 657, 354, 304, 354, 645, 522,
  232, 584, 612, 577, 612, 588, 329, 611, 606, 271, 268, 574, 271, 895, 606, 617,
  612, 612, 384, 560, 346, 605, 551, 802, 576, 551, 523, 397, 257, 397, 645,
];
/** A character outside the table (an accent, a trademark sign): a wide letter. */
const UNKNOWN_ADVANCE = 760;

/** The width of `text` at `px`, in pixels, kerning ignored. */
export function stubTextWidth(text: string, px: number): number {
  let milliEm = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    milliEm += code >= 32 && code <= 126 ? ADVANCE[code - 32] : UNKNOWN_ADVANCE;
  }
  return (milliEm * px) / 1000;
}

export interface StubTitleTier {
  /** Font size in pixels. */
  px: number;
  maxLines: number;
  /** Tailwind classes for size, leading and the clamp. */
  className: string;
}

export const STUB_TITLE_TIERS: readonly StubTitleTier[] = [
  { px: 27, maxLines: 3, className: 'text-[27px] leading-none line-clamp-3' },
  { px: 24, maxLines: 3, className: 'text-[24px] leading-[1.05] line-clamp-3' },
  { px: 22, maxLines: 3, className: 'text-[22px] leading-[1.05] line-clamp-3' },
  { px: 20, maxLines: 4, className: 'text-[20px] leading-none line-clamp-4' },
  { px: 18, maxLines: 4, className: 'text-[18px] leading-[1.1] line-clamp-4' },
  { px: 16, maxLines: 5, className: 'text-[16px] leading-none line-clamp-5' },
];

/** The pieces a browser may break a title between: at spaces, and after a
 *  hyphen inside a word ("Tuch-Designed" is "Tuch-" then "Designed"). Each
 *  piece says whether a space precedes it on the same line. */
function pieces(title: string): Array<{ text: string; space: boolean }> {
  const out: Array<{ text: string; space: boolean }> = [];
  for (const word of title.trim().split(/\s+/).filter(Boolean)) {
    const parts = word.split(/(?<=-)(?=.)/);
    parts.forEach((text, i) => out.push({ text, space: i === 0 && out.length > 0 }));
  }
  return out;
}

/** Lines the title needs at `px` in the card's column, or Infinity when one
 *  unbreakable piece is wider than the column (it would be clipped). */
export function wrappedLines(title: string, px: number, column: number = STUB_TITLE_COLUMN_PX): number {
  const room = column - SAFETY_PX;
  const ps = pieces(title);
  if (ps.length === 0) return 0;
  let lines = 1;
  let used = 0;
  for (const p of ps) {
    const w = stubTextWidth(p.text, px);
    if (w > room) return Infinity;
    const lead = used > 0 && p.space ? stubTextWidth(' ', px) : 0;
    if (used === 0) used = w;
    else if (used + lead + w <= room) used += lead + w;
    else { lines += 1; used = w; }
  }
  return lines;
}

/** The largest tier the whole title fits; the smallest when none does. */
export function stubTitleTier(title: string): StubTitleTier {
  return STUB_TITLE_TIERS.find((t) => wrappedLines(title, t.px) <= t.maxLines) ?? STUB_TITLE_TIERS[STUB_TITLE_TIERS.length - 1];
}
