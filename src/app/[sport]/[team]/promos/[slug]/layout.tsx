import { archivoHouse } from '@/components/redesign/fonts-house';

// The promo family's layout (hotfix 2026-10-30, ruling: option 3). The
// house wrapper the view used to render (the Archivo variable, rd-root, the
// full-height floor) now lives here, with pn-promo-page on it: ONE
// server-rendered element, the first-byte parent of the page's <article>, so
// Raptive can target the family's custom ad layout with a descendant
// selector. The article keeps its own width, padding and `page-content`
// hook, so Raptive's anchor rule (.page-content > *) and its article
// measurement are unchanged. A <body> class was ruled out: only a root
// layout renders <body>, and a second root layout needs every other route
// moved into a group of its own.
export default function PromoPageLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${archivoHouse.variable} rd-root min-h-screen pn-promo-page`}>{children}</div>;
}
