import { archivoHouse } from '@/components/redesign/fonts-house';

// The stop page's layout (Phase 2, 2026-11-18): the same ONE server-rendered
// element the promo family uses, div.pn-promo-page as the direct parent of
// the page's <article class="page-content">, so the stop pages inherit
// Raptive's custom layout for that selector without a new request. Stop pages
// only: the hub and the index sit outside this segment and do not carry it.
export default function EventStopLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${archivoHouse.variable} rd-root min-h-screen pn-promo-page`}>{children}</div>;
}
