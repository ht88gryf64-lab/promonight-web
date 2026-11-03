import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { textWidth } from './share-card-metrics';

// The promo share card (2026-11-03): the 1200x630 og:image of every promo
// page, drawn so a shared link previews as PromoNight in iMessage, SMS,
// email, Slack, X and Facebook. Pure: a model in, a PNG out. The route
// (src/app/api/share-card/[promoId]/route.tsx) builds the model from the
// stored row and fetches the panel image.
//
// LAYOUT. A brand red frame around a dark ground (the house ink); a team
// colour stripe down the left edge; the PromoNight wordmark; the type badge
// (with the quantity when stored); the promo name in the display face
// (Archivo 800, uppercase, as the page's H1); the game line; the
// getpromonight.com footer. On the right, a rounded panel: the stored item
// photo (tier 1, with its credit printed small in the footer), or for tier 3
// a solid block of the team's primary colour with the team's name in the
// display face, white (Gate A ruling 2026-11-03), so every share reads as
// one family.
//
// LEGIBILITY AT ~300px WIDE (an iMessage thumbnail is a quarter scale): the
// smallest text that carries meaning is the badge at 28px (7px at quarter
// scale, 21 device pixels on a 3x phone); the name never drops below 50px.

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;

const RED = '#da2d20'; // rd-red, the brand red
const INK = '#211d18'; // rd-ink, the dark ground
const CREAM = '#f7f3ea'; // rd-cream, the photo panel
const WHITE = '#ffffff';

const FONT_DIR = join(process.cwd(), 'src/app/api/share-card/_fonts');
let fontsPromise: Promise<[Buffer, Buffer, Buffer]> | null = null;
/** [SemiBold 600, Bold 700, ExtraBold 800], read once per process. */
export function loadShareCardFonts(): Promise<[Buffer, Buffer, Buffer]> {
  fontsPromise ??= Promise.all([
    readFile(join(FONT_DIR, 'Archivo-SemiBold.ttf')),
    readFile(join(FONT_DIR, 'Archivo-Bold.ttf')),
    readFile(join(FONT_DIR, 'Archivo-ExtraBold.ttf')),
  ]);
  return fontsPromise;
}

export type ShareCardPanel =
  | { kind: 'photo'; src: string; credit: string; width: number; height: number }
  | { kind: 'team'; name: string; color: string }
  | null;

export interface ShareCardModel {
  /** "Giveaway · First 10,000", "Theme Night", "Removed". */
  badge: string;
  title: string;
  /** The game line in two parts: the matchup ("Dallas Stars vs Panthers")
   *  and the day ("Sun Nov 15", or a series' "3 home games · ..."). One line
   *  "{lead} · {tail}" when it fits, else the two parts on two lines. */
  game: { lead: string; tail: string };
  /** #rrggbb for the stripe. */
  accent: string;
  panel: ShareCardPanel;
}

// ── geometry ────────────────────────────────────────────────────────────────

const FRAME = 16;
const STRIPE = 14;
const PAD_X = 44;
const PAD_TOP = 40;
const PAD_BOTTOM = 34;
const GAP = 40;
const PHOTO_W = 400;
const TEAM_PANEL_PAD = 32;
const TEAM_SIZES = [84, 76, 68, 60, 54, 48, 44, 40, 36];
const INNER_W = SHARE_CARD_WIDTH - 2 * FRAME;
const INNER_H = SHARE_CARD_HEIGHT - 2 * FRAME;

/** The photo's box: its own aspect, contained in PHOTO_W x maxH, so a wide
 *  team graphic is a wide rounded panel rather than a tall one with bands. */
export function photoBox(width: number, height: number, maxH: number): { w: number; h: number } {
  if (!(width > 0 && height > 0)) return { w: PHOTO_W, h: maxH };
  const scale = Math.min(PHOTO_W / width, maxH / height);
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

function columnWidth(panel: ShareCardPanel): number {
  const free = INNER_W - STRIPE - 2 * PAD_X;
  if (!panel) return free;
  return free - GAP - PHOTO_W;
}

const TITLE_SIZES = [96, 88, 80, 72, 64, 58, 54, 50];
const TITLE_LS = -1;
const TITLE_LH = 0.98;
const GAME_SIZE = 36;
const GAME_LH = 1.15;
const BADGE_H = 52; // 28px type, 1.2 line height, 9px padding top and bottom
const STACK_GAP = 18;
const WORDMARK_H = 40;
const FOOTER_H = 36;
/** The middle stack's height budget: the content box less the wordmark, the
 *  footer and 20px of air above and below the stack. */
const STACK_MAX = INNER_H - PAD_TOP - PAD_BOTTOM - WORDMARK_H - FOOTER_H - 40;

/** Lines a greedy word wrap takes for `text` at `size`, measured against the
 *  face's real advance widths (src/lib/share-card-metrics.ts). */
export function wrapLines(text: string, size: number, width: number, face: 'extrabold' | 'semibold', letterSpacing = 0): number {
  const space = textWidth(' ', size, face, letterSpacing);
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = textWidth(word, size, face, letterSpacing);
    if (used === 0) used = w;
    else if (used + space + w <= width) used += space + w;
    else {
      lines += 1;
      used = w;
    }
    // A word wider than the line breaks across lines of its own.
    if (w > width) {
      lines += Math.ceil(w / width) - 1;
      used = w % width;
    }
  }
  return lines;
}

/** Whether every word of `text` fits `width` on its own. Satori never breaks
 *  inside a word, so a size where one word is wider than the line overflows
 *  the box however few lines the wrap counts. */
export function wordsFit(text: string, size: number, width: number, face: 'extrabold' | 'semibold', letterSpacing = 0): boolean {
  return text.split(/\s+/).filter(Boolean).every((w) => textWidth(w, size, face, letterSpacing) <= width);
}

/** The game line's layout: one line when "{lead} · {tail}" fits the column,
 *  else lead and tail on lines of their own. */
export function gameLayout(game: { lead: string; tail: string }, width: number): string[] {
  if (!game.tail) return game.lead ? [game.lead] : [];
  const one = `${game.lead} \u00b7 ${game.tail}`;
  return textWidth(one, GAME_SIZE, 'semibold') <= width ? [one] : [game.lead, game.tail];
}

/** The largest name size whose wrap is at most 3 lines AND whose stack
 *  (badge, name, game line) fits the height between the wordmark and the
 *  footer. At the floor it takes 4 lines and lineClamp has the last word. */
export function titleFit(title: string, width: number, gameLines = 1): { size: number; lines: number } {
  const game = gameLines ? STACK_GAP + gameLines * GAME_SIZE * GAME_LH : 0;
  const upper = title.toUpperCase();
  for (const size of TITLE_SIZES) {
    if (!wordsFit(upper, size, width, 'extrabold', TITLE_LS)) continue;
    const lines = wrapLines(upper, size, width, 'extrabold', TITLE_LS);
    const height = BADGE_H + STACK_GAP + lines * size * TITLE_LH + game;
    if (lines <= 3 && height <= STACK_MAX) return { size, lines };
  }
  return { size: TITLE_SIZES[TITLE_SIZES.length - 1], lines: 4 };
}

/** The team name's size in the tier 3 block: the largest at which every
 *  word fits the block's inner width and the name takes at most 3 lines.
 *  The floor, 36px, is 9px at a 300px-wide thumbnail; the longest stored
 *  name word ("PHILADELPHIA") sets at 48. */
export const TEAM_NAME_W = PHOTO_W - 2 * TEAM_PANEL_PAD - 6; // 6: the outline a dark block takes
export function teamNameFit(name: string): number {
  const upper = name.toUpperCase();
  for (const size of TEAM_SIZES) {
    if (wordsFit(upper, size, TEAM_NAME_W, 'extrabold', TITLE_LS) && wrapLines(upper, size, TEAM_NAME_W, 'extrabold', TITLE_LS) <= 3) return size;
  }
  return TEAM_SIZES[TEAM_SIZES.length - 1];
}

// ── colour ──────────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-f]{6}$/i;
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Whether a colour stands off the ink ground on its own. A black or
 *  near-black team block takes a faint outline so it still reads as a panel. */
export function separates(c: string): boolean {
  return HEX_RE.test(c) && contrast(c, INK) >= 1.6;
}

/** White text on `c`: the WCAG ratio, for the Gate B colour audit. */
export function whiteContrast(c: string): number {
  return HEX_RE.test(c) ? contrast(c, WHITE) : 0;
}

/** The stripe colour: the team's primary when it shows on the ink ground,
 *  else its secondary, else cream (a black or near-black club). */
export function accentFor(primary: string | null | undefined, secondary: string | null | undefined): string {
  for (const c of [primary, secondary]) {
    if (c && HEX_RE.test(c) && contrast(c, INK) >= 1.6) return c;
  }
  return CREAM;
}

// ── drawing ─────────────────────────────────────────────────────────────────

export async function renderShareCard(model: ShareCardModel, headers?: Record<string, string>): Promise<ImageResponse> {
  const [semi, bold, extra] = await loadShareCardFonts();
  const col = columnWidth(model.panel);
  const gameLines = gameLayout(model.game, col);
  const fit = titleFit(model.title, col, gameLines.length);
  const credit = model.panel?.kind === 'photo' ? model.panel.credit : '';
  const panelH = INNER_H - PAD_TOP - PAD_BOTTOM;
  const box = model.panel?.kind === 'photo' ? photoBox(model.panel.width, model.panel.height, panelH) : { w: 0, h: 0 };

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: RED, padding: FRAME }}>
        <div style={{ flex: 1, display: 'flex', background: INK, borderRadius: 22, overflow: 'hidden' }}>
          <div style={{ width: STRIPE, height: '100%', background: model.accent, display: 'flex' }} />
          <div style={{ flex: 1, display: 'flex', padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`, gap: GAP }}>
            <div style={{ width: col, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Archivo', color: WHITE }}>
              <div style={{ display: 'flex', height: WORDMARK_H, fontSize: 40, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>
                <span style={{ color: WHITE }}>PROMO</span>
                <span style={{ color: RED }}>NIGHT</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ display: 'block', fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: INK, background: WHITE, padding: '9px 16px', borderRadius: 10, lineClamp: 1, maxWidth: col }}>
                    {model.badge}
                  </div>
                </div>
                <div style={{ display: 'block', overflowWrap: 'break-word', fontSize: fit.size, fontWeight: 800, lineHeight: TITLE_LH, letterSpacing: TITLE_LS, textTransform: 'uppercase', lineClamp: fit.lines }}>{model.title}</div>
                {gameLines.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: GAME_SIZE, fontWeight: 600, lineHeight: GAME_LH, color: 'rgba(255,255,255,0.86)' }}>
                    {gameLines.map((l) => (
                      <div key={l} style={{ display: 'block', lineClamp: 1 }}>{l}</div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: WHITE }}>getpromonight.com</div>
                {credit ? <div style={{ display: 'block', fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.62)', lineClamp: 1 }}>{credit}</div> : null}
              </div>
            </div>

            {model.panel?.kind === 'photo' ? (
              <div style={{ width: PHOTO_W, height: panelH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', background: CREAM }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
                  <img src={model.panel.src} width={box.w} height={box.h} style={{ width: box.w, height: box.h, objectFit: 'contain' }} alt="" />
                </div>
              </div>
            ) : model.panel?.kind === 'team' ? (
              <div style={{ width: PHOTO_W, height: panelH, display: 'flex', alignItems: 'flex-end', background: model.panel.color, borderRadius: 20, padding: TEAM_PANEL_PAD, ...(separates(model.panel.color) ? {} : { border: '3px solid rgba(255,255,255,0.18)' }) }}>
                <div style={{ display: 'block', width: TEAM_NAME_W, overflowWrap: 'break-word', fontFamily: 'Archivo', fontSize: teamNameFit(model.panel.name), fontWeight: 800, lineHeight: TITLE_LH, letterSpacing: TITLE_LS, textTransform: 'uppercase', color: WHITE, lineClamp: 3 }}>
                  {model.panel.name}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      fonts: [
        { name: 'Archivo', data: semi, weight: 600, style: 'normal' },
        { name: 'Archivo', data: bold, weight: 700, style: 'normal' },
        { name: 'Archivo', data: extra, weight: 800, style: 'normal' },
      ],
      headers,
    },
  );
}
