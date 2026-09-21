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
