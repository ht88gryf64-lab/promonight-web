import { Archivo } from 'next/font/google';

// PRELOAD-DISABLED Archivo for surfaces reachable from the ROOT layout or from a
// route whose gate-off render must stay byte-identical: the global chrome
// (GlobalChrome) and the gate-on RedesignHomePage.
//
// next/font emits a font-preload <link> on every route that can REACH a font in
// its module graph — not just where it renders. A preload:true instance reachable
// from the layout/homepage would therefore add an Archivo <link rel=preload> to
// gate-off pages and break byte-identity. preload:false adds the @font-face (so
// the font still renders via display:swap when the gate-on surface mounts) but NO
// preload <link> anywhere.
//
// This MUST be its own module, separate from ./fonts (which holds the team page's
// preload:true `archivo`): importing a font pulls its whole module into the graph,
// so co-locating the two instances would drag the preload:true one along.
export const archivoHouse = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
  preload: false,
});
