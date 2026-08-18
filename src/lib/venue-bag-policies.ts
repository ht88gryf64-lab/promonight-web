// /venues/bag-policies data layer: the 30 MLB ballpark rows, the four policy
// groups, and every number the page shows. ONE computation feeds the DOM, the
// glance stats, the group headers, the FAQ and the ItemList JSON-LD, so a
// declared count can never drift from a served count (aggregator plan §4).
//
// Null discipline (EXTRACTION-RULES 1.1/1.6, binding): clearBagRequired null
// means "the source does not say" and may NEVER render as "No". A group-4 row
// carries only the chips its data affirmatively supports.

// PURE module by design: type-only imports, no Firestore, no server-only —
// the unit tests import this directly (the rivalry-index precedent). The
// loader lives in venue-bag-policies-data.ts.
import type { BagMaxDimensions } from '@/lib/venue-hub';

export const BAG_SEASON = 2026; // hardcoded by house rule, never getFullYear()

/** HARD RULE (build order, pinned by test): kauffman-stadium renders in group
 *  4 as a sources-conflict row regardless of stored values. Its two official
 *  sources disagree on whether any bag may enter, and the item-class test
 *  (EXTRACTION-RULES 1.5) drops the allowance rather than publishing either
 *  reading. The row keeps the policy URL and carries no sizes and no verdict.
 *  Reader-facing copy stays pointer-only: it may say "confirm with the venue",
 *  never why. */
export const SOURCES_CONFLICT_SLUGS: readonly string[] = ['kauffman-stadium'];

export type BagGroupKey = 'no-bags' | 'clear-required' | 'size-limited' | 'check-policy';

export interface BagPolicyRow {
  slug: string;
  venueName: string;
  teamName: string;
  teamColor: string | null;
  clearBagRequired: boolean | null;
  dims: BagMaxDimensions | null;
  dimsText: string | null;
  bagsProhibited: boolean | null;
  bagPolicyUrl: string | null;
  /** Clutch/small-bag exception, parsed conservatively from stored prose:
   *  'sized' carries a printable size; 'affirmed' means the allowance exists
   *  but no single clean size parsed (renders the dashed unconfirmed chip);
   *  null means no clutch allowance is affirmed, so no chip renders. */
  clutch: { kind: 'sized'; text: string } | { kind: 'affirmed' } | null;
  /** True only for SOURCES_CONFLICT_SLUGS: dashed row, URL, no sizes, no verdict. */
  sourcesConflict: boolean;
}

export interface BagPolicyGroup {
  key: BagGroupKey;
  badge: 'strict' | 'warn' | 'ok' | 'neutral';
  title: string;
  sub: string;
  rows: BagPolicyRow[];
}

// ── clutch parsing (render-side presentation of stored, verified prose) ──────
// Conservative by construction: a size renders only when a single unambiguous
// W x H (or W x H x D) figure sits in the same clause as a clutch-class word.
// Anything less yields 'affirmed' (dashed chip) or null. Never a guess.
const CLUTCH_WORDS = /\b(clutch(?:es)?|wristlets?|fanny\s*packs?|small\s+purses?)\b/i;
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(?:"|″|”|in(?:ch(?:es)?)?)?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*(?:"|″|”|in(?:ch(?:es)?)?)?\s*[x×]\s*(\d+(?:\.\d+)?))?\s*(?:"|″|”|\s*in(?:ch(?:es)?)?)?/i;

function fmtDims(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).map((n) => `${n}″`).join(' × ');
}

/** Parse the clutch allowance out of exception/notes prose. Exported for the
 *  per-building fixture tests.
 *
 *  Review-hardened semantics (all pinned by tests on real stored prose):
 *  - ALL clauses across ALL prose entries are scanned; a sized result is
 *    preferred over a bare affirmation, so a size-less overlay clause can
 *    never hijack the chip ahead of a sized notes clause (comerica,
 *    progressive-field).
 *  - The size binds to the figure NEAREST the clutch words, not the first in
 *    the clause: the standard one-sentence shape "clear bag up to A ... or a
 *    clutch up to B" must yield B (camden-yards, guaranteed-rate-field,
 *    tropicana-field), and nationals-park puts the size BEFORE the word.
 *  - A clutch mention scoped to medical necessity is not a clutch allowance
 *    (comerica's overlay); the guard is deliberately narrow so a genuine
 *    "clutches ... are permitted" clause that also mentions diaper bags
 *    still counts.
 *  - A parsed size equal to the row's general cap is the SAME allowance, not
 *    an exception; it suppresses the chip entirely. */
export function parseClutch(
  prose: (string | null | undefined)[],
  rowDimsText: string | null,
): BagPolicyRow['clutch'] {
  let sawSameAsDims = false;
  let sawAffirmed = false;
  for (const p of prose) {
    if (!p) continue;
    for (const clause of p.split(/(?<=[.;])\s+/)) {
      const cw = clause.match(CLUTCH_WORDS);
      if (!cw) continue;
      // A clutch named only as a medical-necessity carve-out is not a general
      // clutch allowance.
      if (/due to medical necessity/i.test(clause)) continue;
      const sizes = [...clause.matchAll(new RegExp(SIZE_RE.source, 'gi'))];
      if (sizes.length === 0) {
        sawAffirmed = true;
        continue;
      }
      // Bind to the size nearest the clutch words (before or after).
      const anchor = cw.index ?? 0;
      let best = sizes[0];
      let bestDist = Infinity;
      for (const m of sizes) {
        const d = Math.abs((m.index ?? 0) - anchor);
        if (d < bestDist) { best = m; bestDist = d; }
      }
      const text = fmtDims([best[1], best[2], best[3]]);
      if (rowDimsText != null && normalizeDims(text) === normalizeDims(rowDimsText)) {
        sawSameAsDims = true;
        continue;
      }
      return { kind: 'sized', text: `up to ${text}` };
    }
  }
  // A clutch cap equal to the general cap is the general cap: no chip, and it
  // outranks a bare affirmation found elsewhere in the prose.
  if (sawSameAsDims) return null;
  return sawAffirmed ? { kind: 'affirmed' } : null;
}

/** Which clutch chip a row renders, group-aware (pinned by tests): a bare
 *  'affirmed' allowance is a meaningful SEPARATE exception only under a
 *  clear-bag requirement; in the size-limited and check-policy groups an
 *  unsized clutch mention falls under the general cap and renders nothing,
 *  and the no-bags group renders its clutch from the stored cap instead. */
export function clutchChipFor(group: BagGroupKey, clutch: BagPolicyRow['clutch']): BagPolicyRow['clutch'] {
  if (!clutch) return null;
  if (clutch.kind === 'sized') return clutch;
  return group === 'clear-required' ? clutch : null;
}

function normalizeDims(s: string): string {
  return (s.match(/\d+(?:\.\d+)?/g) || []).join('x');
}

// ── grouping (the four predicates, evaluated in order) ──────────────────────
export function classifyRow(row: Pick<BagPolicyRow, 'slug' | 'bagsProhibited' | 'clearBagRequired' | 'dims' | 'sourcesConflict'>): BagGroupKey {
  if (row.sourcesConflict) return 'check-policy'; // hard rule wins over stored values
  if (row.bagsProhibited === true) return 'no-bags';
  if (row.clearBagRequired === true) return 'clear-required';
  if (row.clearBagRequired === false && row.dims) return 'size-limited';
  return 'check-policy';
}

export function groupBagPolicyRows(rows: BagPolicyRow[]): BagPolicyGroup[] {
  const by: Record<BagGroupKey, BagPolicyRow[]> = { 'no-bags': [], 'clear-required': [], 'size-limited': [], 'check-policy': [] };
  for (const r of rows) by[classifyRow(r)].push(r);
  for (const k of Object.keys(by) as BagGroupKey[]) by[k].sort((a, b) => a.venueName.localeCompare(b.venueName));
  const groups: BagPolicyGroup[] = [
    {
      key: 'no-bags',
      badge: 'strict',
      title: 'No bags allowed',
      sub: 'Bags stay home at these parks. Only a small clutch and medical or diaper bags make it in.',
      rows: by['no-bags'],
    },
    {
      key: 'clear-required',
      badge: 'strict',
      title: 'Clear bag required',
      sub: 'Only transparent bags beyond a small clutch. Sizes vary by park.',
      rows: by['clear-required'],
    },
    {
      key: 'size-limited',
      badge: 'warn',
      title: 'Size-limited bags',
      sub: 'Ordinary bags pass under a maximum size, and they do not have to be clear.',
      rows: by['size-limited'],
    },
    {
      key: 'check-policy',
      badge: 'neutral',
      title: 'Check the official policy',
      sub: 'These parks publish bag rules without a clear-bag verdict we can confirm. Check the official policy before you pack.',
      rows: by['check-policy'],
    },
  ];
  // Every group renders, populated or not? No: an empty group is omitted
  // entirely (no empty headings), and the counts derive from what renders.
  return groups.filter((g) => g.rows.length > 0);
}

// ── derived numbers (the ONLY source for stats, headers, FAQ, metadata) ─────
export interface BagPolicyStats {
  total: number;
  perGroup: { key: BagGroupKey; badge: BagPolicyGroup['badge']; title: string; count: number }[];
  clearRequired: number;
  sizeLimited: number;
  noBags: number;
  checkPolicy: number;
  /** Most common clear-bag size among clear-required rows, or null. */
  commonClearSize: string | null;
  /** Most common max-bag size among size-limited rows, or null. */
  commonMaxSize: string | null;
}

export function deriveBagStats(groups: BagPolicyGroup[]): BagPolicyStats {
  const count = (k: BagGroupKey) => groups.find((g) => g.key === k)?.rows.length ?? 0;
  const mode = (values: (string | null)[]): string | null => {
    const tally = new Map<string, number>();
    for (const v of values) if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
    let best: string | null = null;
    let n = 0;
    for (const [v, c] of tally) if (c > n) { best = v; n = c; }
    return n >= 2 ? best : null; // a "most common" claim needs at least two
  };
  return {
    total: groups.reduce((n, g) => n + g.rows.length, 0),
    perGroup: groups.map((g) => ({ key: g.key, badge: g.badge, title: g.title, count: g.rows.length })),
    clearRequired: count('clear-required'),
    sizeLimited: count('size-limited'),
    noBags: count('no-bags'),
    checkPolicy: count('check-policy'),
    commonClearSize: mode((groups.find((g) => g.key === 'clear-required')?.rows ?? []).map((r) => r.dimsText)),
    commonMaxSize: mode((groups.find((g) => g.key === 'size-limited')?.rows ?? []).map((r) => r.dimsText)),
  };
}

// ── page copy (ONE builder for generateMetadata AND the page body) ──────────
export function buildBagPolicyPageCopy(s: BagPolicyStats): { title: string; description: string } {
  return {
    title: `MLB Bag Policy ${BAG_SEASON}: All ${s.total} Ballpark Rules`,
    description: `${s.clearRequired} of ${s.total} MLB ballparks require a clear bag in ${BAG_SEASON}. Every park's bag rule, size limit and clutch exception, compared side by side.`,
  };
}

// ── FAQ (visible copy AND FAQPage JSON-LD read this same array) ─────────────
export interface BagFaq { question: string; answer: string }

export function buildBagPolicyFaqs(groups: BagPolicyGroup[]): BagFaq[] {
  const s = deriveBagStats(groups);
  const faqs: BagFaq[] = [];
  if (s.clearRequired > 0) {
    faqs.push({
      question: `How many MLB stadiums require a clear bag in ${BAG_SEASON}?`,
      answer: `${s.clearRequired} of the ${s.total} MLB ballparks require a clear bag for anything larger than a small clutch.${s.commonClearSize ? ` The most common clear-bag size is ${s.commonClearSize}.` : ''}`,
    });
  }
  if (s.sizeLimited > 0) {
    faqs.push({
      question: 'What size bag can I bring to an MLB game?',
      answer: `It depends on the park. ${s.sizeLimited} parks allow ordinary soft-sided bags up to a stated maximum${s.commonMaxSize ? `, most commonly ${s.commonMaxSize}` : ''}, and ${s.clearRequired} more require the bag to be clear. Check your stadium's row above for its exact rule.`,
    });
  }
  if (s.noBags > 0) {
    const names = (groups.find((g) => g.key === 'no-bags')?.rows ?? []).map((r) => r.venueName);
    faqs.push({
      question: 'Do any MLB parks ban bags entirely?',
      answer: `${s.noBags === 1 ? 'One park does' : `${s.noBags} parks do`}: ${names.join(', ')}. A small clutch and medical or diaper bags are the usual exceptions, and the park's own page has the details.`,
    });
  }
  faqs.push({
    question: 'Where does this data come from?',
    answer: `Every value is taken from the ballpark's official published policy and independently verified. Where sources conflict, we show the confirmed portion and omit the disputed number, so confirm the details on the official policy page before you travel.`,
  });
  return faqs;
}

