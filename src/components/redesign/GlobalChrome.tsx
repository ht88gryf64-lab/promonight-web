import { Archivo } from 'next/font/google';
import { BrandBar } from './BrandBar';
import { Footer } from './Footer';

// Gate-ON global chrome slots, mounted by app/layout.tsx.
//
// next/font emits a font-preload <link> on every route that can REACH the font in
// its module graph (not just where it renders). Because this module is imported
// by the root layout, mounting the redesign font here would otherwise add an
// Archivo preload to EVERY page — including gate-off pages, breaking byte-identity.
// So the chrome uses its OWN `preload: false` Archivo instance: same family/axes
// as the team page's (fonts.ts), but it adds NO preload <link> anywhere. Gate-off
// <head> is therefore byte-identical to before, and the team page keeps its own
// preheated (preload:true) instance with no first-paint flash. On gate-on the
// wordmark/links pick up Archivo via display:swap.
const archivoChrome = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
  preload: false,
});

// Each slot wraps its chrome in `${archivoChrome.variable} rd-root contents`:
//   - archivoChrome.variable → defines --font-archivo so font-rd / rd-display resolve
//   - rd-root                → scopes the .rd-root token + .rd-display descendant rules
//   - contents               → display:contents, so no cream box is painted and the
//                              sticky BrandBar still references the tall <body>; the
//                              page body (old dark pages) is left completely untouched.

export function RedesignBrandBar({ playoffsActive }: { playoffsActive?: boolean }) {
  return (
    <div className={`${archivoChrome.variable} rd-root contents`}>
      <BrandBar playoffsActive={playoffsActive} />
    </div>
  );
}

export function RedesignFooterSlot() {
  return (
    <div className={`${archivoChrome.variable} rd-root contents`}>
      <Footer />
    </div>
  );
}
