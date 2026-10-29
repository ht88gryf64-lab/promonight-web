// The static DM Sans TTFs committed beside the social image route, loaded once
// per process. Shared by the 1080x1080 social card and the 1200x630 promo
// page card (src/app/api/promo-card): Satori reads neither variable fonts nor
// WOFF2, so these two files are the only faces either card can draw with.
// OFL.txt sits with them.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CARD_FONT_DIR = join(process.cwd(), 'src/app/feeds/social/image/_fonts');

let fontsPromise: Promise<[Buffer, Buffer]> | null = null;

/** [regular, bold] */
export function loadCardFonts(): Promise<[Buffer, Buffer]> {
  fontsPromise ??= Promise.all([
    readFile(join(CARD_FONT_DIR, 'DMSans-Regular.ttf')),
    readFile(join(CARD_FONT_DIR, 'DMSans-Bold.ttf')),
  ]);
  return fontsPromise;
}
