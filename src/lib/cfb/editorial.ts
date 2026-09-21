// The ONE definition of how a reader contribution becomes rendered prose.
//
// Shared by the read path (src/lib/cfb/data.ts) and the write path
// (scripts/cfb/approve-contribution.ts) so the two cannot drift: the shape the
// approver writes is by construction the shape the reader flattens.
//
// Deliberately free of any firebase import, so it is unit-testable and can
// never pull `server-only` into a script or a test.

import type { CfbEditorialSection, CfbSchoolEditorial } from '@/lib/cfb/types';

/** Contribution `content` key -> editorial block member.
 *
 *  The form and the template were built at different times and do not agree on
 *  names; this is the whole of the translation. `gameday` is absent ON PURPOSE:
 *  the template's gamedayCulture has no approved destination yet, so a gameday
 *  answer is held rather than silently dropped into a field that renders. */
export const SECTION_MAP = {
  whyYouGo: 'whyYouGo',
  venueInWords: 'venueInTheirWords',
  traditions: 'traditions',
  signatureGame: 'signatureGame',
} as const;

export type ContributionKey = keyof typeof SECTION_MAP;
export type EditorialKey = (typeof SECTION_MAP)[ContributionKey];

/** Sections that can actually reach a reader today.
 *
 *  traditions      has no renderable shape (CfbSchoolPage.tsx Phase 4 TODO).
 *  signatureGame   is free text; the template resolves signatureGameId as a
 *                  GAME ID, and a phrase can never match one. Its real home is
 *                  a themeDesignation on the game doc.
 *
 *  Approving a held section is allowed — it records the decision — but it
 *  publishes nothing, and the approver says so out loud. */
export const RENDERABLE_SECTIONS: readonly EditorialKey[] = ['whyYouGo', 'venueInTheirWords'];

export const HELD_SECTIONS: readonly EditorialKey[] = ['traditions', 'signatureGame'];

/** The flat strings the ONE template paints. */
export interface EditorialView {
  signatureGameId: string | null;
  traditions: unknown[];
  gamedayCulture: string | null;
  whyYouGo: string | null;
  venueInTheirWords: string | null;
  contributor: { name: string; credit: string } | null;
}

const text = (s: CfbEditorialSection | undefined): string | null => {
  const t = typeof s?.text === 'string' ? s.text.trim() : '';
  return t.length ? t : null;
};

/** Stored per-section editorial -> the flat view.
 *
 *  ONLY the contributor's words and first name cross this boundary. approvedAt
 *  and contributionId stay behind: they are the audit trail, not page content.
 *  The contribution's `contact` never reaches this collection at all, so it
 *  cannot be here to leak — asserted in cfb-approve-contribution.test.ts.
 *
 *  signatureGameId and gamedayCulture are null BY CONSTRUCTION, not by
 *  omission. Mapping the free-text signatureGame onto signatureGameId would
 *  hand the template a phrase where it expects a game id. */
export function flattenEditorial(stored: CfbSchoolEditorial | undefined | null): EditorialView {
  const whyYouGo = text(stored?.whyYouGo);
  const venueInTheirWords = text(stored?.venueInTheirWords);
  // The byline names whoever wrote the prose ON SCREEN, in the order the page
  // paints it. Absent when nothing published.
  const credit = (whyYouGo ? stored?.whyYouGo?.contributor?.trim() : '')
    || (venueInTheirWords ? stored?.venueInTheirWords?.contributor?.trim() : '')
    || '';
  return {
    signatureGameId: null,
    traditions: Array.isArray(stored?.traditions) ? stored.traditions : [],
    gamedayCulture: null,
    whyYouGo,
    venueInTheirWords,
    contributor: credit ? { name: credit, credit } : null,
  };
}

/** DERIVED, never stored. A school is a destination exactly when the section
 *  that carries the page's argument for going is live. */
export function deriveEditorialStatus(view: EditorialView): 'auto' | 'destination' {
  return view.whyYouGo ? 'destination' : 'auto';
}

// ── the approve path ────────────────────────────────────────────────────────

/** The stored contribution, as scripts/../contribute/route.ts writes it. */
export interface ContributionDoc {
  schoolId?: unknown;
  name?: unknown;
  contact?: unknown; // an email or a handle. NEVER copied anywhere.
  content?: Record<string, unknown>;
  status?: unknown;
}

export interface ApproveInput {
  contributionId: string;
  doc: ContributionDoc;
  /** Contribution keys to approve. Everything else is held. */
  approve: readonly ContributionKey[];
  /** Corrected text per contribution key: typo fixes only, never a rewrite.
   *  An entry here REPLACES the submitted text for that section. */
  edits?: Partial<Record<ContributionKey, string>>;
  approvedAt: string; // ISO
}

export interface ApproveResult {
  /** The editorial members to merge onto the school doc. Held sections absent. */
  editorial: CfbSchoolEditorial;
  /** Per-section verdict, for the record on the contribution doc. */
  verdicts: Record<string, { verdict: 'approved' | 'held'; renders: boolean; reason?: string }>;
  /** Sections approved but which no template can paint yet. */
  approvedButNotRendered: EditorialKey[];
}

/** FIRST NAME ONLY.
 *
 *  The submitted `name` is free text and the contact is a separate field that
 *  never leaves the contribution doc. Taking the first whitespace-delimited
 *  token keeps a full name from becoming a public byline, and an email typed
 *  into the name box from becoming one either: an address has no space, so the
 *  token would be the whole address, which is exactly why it is rejected here
 *  rather than trimmed. */
export function creditName(name: unknown): string {
  const raw = typeof name === 'string' ? name.trim() : '';
  if (!raw) return '';
  const first = raw.split(/\s+/)[0];
  // never publish something that looks like a contact handle
  if (/@|https?:|\.(com|net|org|io)$/i.test(first)) return '';
  return first.slice(0, 40);
}

/** Build the editorial members for an approval. PURE.
 *
 *  Reads ONLY `content[key]` and `name` off the contribution. `contact` is
 *  never touched, so it cannot reach cfbSchools by any path -- asserted in
 *  cfb-approve-contribution.test.ts. A section with no text is held
 *  automatically: approving an empty answer would publish a blank panel. */
export function buildApproval(input: ApproveInput): ApproveResult {
  const { contributionId, doc, approve, edits = {}, approvedAt } = input;
  const content = (doc.content && typeof doc.content === 'object' ? doc.content : {}) as Record<string, unknown>;
  const contributor = creditName(doc.name);

  const editorial: CfbSchoolEditorial = {};
  const verdicts: ApproveResult['verdicts'] = {};
  const approvedButNotRendered: EditorialKey[] = [];
  const wanted = new Set<ContributionKey>(approve);

  for (const key of Object.keys(SECTION_MAP) as ContributionKey[]) {
    const target = SECTION_MAP[key];
    const submitted = typeof content[key] === 'string' ? (content[key] as string) : '';
    const text = (edits[key] ?? submitted).trim();

    if (!wanted.has(key)) {
      verdicts[target] = { verdict: 'held', renders: false };
      continue;
    }
    if (!text) {
      verdicts[target] = { verdict: 'held', renders: false, reason: 'no text submitted' };
      continue;
    }
    if (!contributor) {
      verdicts[target] = { verdict: 'held', renders: false, reason: 'no publishable first name' };
      continue;
    }
    if (target === 'traditions') {
      // unknown[] with no renderable shape; refuse to invent one.
      verdicts[target] = { verdict: 'held', renders: false, reason: 'no renderable shape (Phase 4)' };
      continue;
    }
    editorial[target] = { text, contributor, approvedAt, contributionId } as CfbEditorialSection;
    const renders = RENDERABLE_SECTIONS.includes(target);
    verdicts[target] = { verdict: 'approved', renders };
    if (!renders) approvedButNotRendered.push(target);
  }

  return { editorial, verdicts, approvedButNotRendered };
}
