// Advance widths of the share card's two text faces (2026-11-03), in
// thousandths of an em, for printable ASCII (32 to 126) plus a few extras.
// Measured once from the committed TTFs (src/app/api/share-card/_fonts) with
// a 1000px canvas; regenerate if the fonts change. Satori exposes no text
// measurement, and an average character width misjudges single long words
// ("BOBBLEHEAD" is 7.3em), so the card fits its text against these.

const EXTRA_BOLD_ASCII = [
  189, 314, 473, 625, 579, 984, 816, 263, 374, 374, 407, 649, 318, 333, 318, 302, 625, 625, 625,
  625, 626, 625, 625, 625, 625, 625, 334, 334, 649, 649, 649, 612, 1005, 747, 745, 752, 755, 699,
  641, 815, 787, 329, 630, 770, 623, 914, 787, 810, 698, 810, 750, 697, 675, 783, 729, 979, 736,
  732, 682, 366, 302, 366, 649, 534, 257, 616, 633, 612, 633, 619, 352, 632, 629, 288, 286, 610,
  288, 937, 629, 636, 633, 633, 407, 579, 385, 629, 574, 859, 612, 574, 535, 391, 265, 391, 649,
];
const EXTRA_BOLD_EXTRA: Record<string, number> = { '\u00b7': 333, '\u2019': 279, '\u00e9': 619, '\u00e1': 616, '\u00f1': 629, '\u00a0': 189 };
const SEMI_BOLD_ASCII = [
  200, 292, 444, 583, 541, 966, 729, 246, 357, 357, 407, 636, 300, 333, 300, 298, 575, 576, 576,
  576, 577, 575, 576, 576, 576, 575, 336, 336, 636, 636, 636, 613, 998, 709, 706, 721, 728, 672,
  609, 794, 732, 282, 585, 695, 570, 844, 732, 782, 670, 782, 717, 667, 619, 724, 671, 954, 686,
  677, 634, 339, 298, 339, 636, 507, 209, 556, 592, 547, 592, 561, 307, 591, 584, 252, 250, 543,
  252, 861, 584, 598, 592, 592, 362, 541, 314, 583, 529, 758, 546, 529, 509, 394, 245, 394, 636,
];
const SEMI_BOLD_EXTRA: Record<string, number> = { '\u00b7': 333, '\u2019': 280, '\u00e9': 561, '\u00e1': 556, '\u00f1': 584, '\u00a0': 200 };

export type CardFace = 'extrabold' | 'semibold';

/** Width in px of `text` at `size` in `face`, with `letterSpacing` px per
 *  character. An unmeasured character counts as the widest capital. */
export function textWidth(text: string, size: number, face: CardFace, letterSpacing = 0): number {
  const ascii = face === 'extrabold' ? EXTRA_BOLD_ASCII : SEMI_BOLD_ASCII;
  const extra = face === 'extrabold' ? EXTRA_BOLD_EXTRA : SEMI_BOLD_EXTRA;
  let units = 0;
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    units += c >= 32 && c <= 126 ? ascii[c - 32] : (extra[ch] ?? 950);
    n += 1;
  }
  return (units / 1000) * size + letterSpacing * n;
}
