import { archivoHouse } from './fonts-house';
import { BrandBar } from './BrandBar';
import { Footer } from './Footer';

// Gate-ON global chrome slots, mounted by app/layout.tsx.
//
// next/font emits a font-preload <link> on every route that can REACH the font in
// its module graph (not just where it renders). Because this module is imported
// by the root layout, a preload:true font here would add an Archivo preload to
// EVERY page — including gate-off pages, breaking byte-identity. So the chrome
// uses the shared `archivoHouse` (preload:false) instance from fonts.ts: it adds
// NO preload <link> anywhere, so gate-off <head> stays byte-identical. On gate-on
// the wordmark/links pick up Archivo via display:swap.

// Each slot wraps its chrome in `${archivoHouse.variable} rd-root contents`:
//   - archivoHouse.variable  → defines --font-archivo so font-rd / rd-display resolve
//   - rd-root                → scopes the .rd-root token + .rd-display descendant rules
//   - contents               → display:contents, so no cream box is painted and the
//                              sticky BrandBar still references the tall <body>; the
//                              page body (old dark pages) is left completely untouched.

export function RedesignBrandBar({ playoffsActive }: { playoffsActive?: boolean }) {
  return (
    <div className={`${archivoHouse.variable} rd-root contents`}>
      <BrandBar playoffsActive={playoffsActive} />
    </div>
  );
}

export function RedesignFooterSlot() {
  return (
    <div className={`${archivoHouse.variable} rd-root contents`}>
      <Footer />
    </div>
  );
}
