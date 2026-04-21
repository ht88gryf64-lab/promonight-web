/* eslint-disable no-console */
/**
 * One-off generator for /public/og-image.png.
 *
 * Run with: npx tsx scripts/generate-og.ts
 *
 * Produces a 1200x630 PNG used by Open Graph / Twitter Card previews.
 * Left half: PROMONIGHT wordmark, headline, availability tagline.
 * Right half: the home-screen app screenshot rendered as a tilted phone.
 *
 * Fonts are fetched from Google Fonts on first run and cached under
 * scripts/.fonts/ (gitignored). Regenerate any time by rerunning the script.
 */
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FONT_DIR = join(__dirname, '.fonts');
const SCREENSHOT_PATH = join(REPO_ROOT, 'public', 'screenshots', 'home.png');
const OUTPUT_PATH = join(REPO_ROOT, 'public', 'og-image.png');

const W = 1200;
const H = 630;

// Google Fonts CDN — static TTF URLs picked from current Google Fonts API responses.
const FONTS: { family: string; url: string; file: string }[] = [
  {
    family: 'Bebas Neue',
    url: 'https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf',
    file: 'BebasNeue-Regular.ttf',
  },
  {
    family: 'DM Sans',
    url: 'https://github.com/google/fonts/raw/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf',
    file: 'DMSans.ttf',
  },
];

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureFonts() {
  await mkdir(FONT_DIR, { recursive: true });
  for (const f of FONTS) {
    const out = join(FONT_DIR, f.file);
    if (!(await exists(out))) {
      console.log(`Fetching font: ${f.family}`);
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`Failed to fetch ${f.url}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(out, buf);
    }
    const ok = GlobalFonts.registerFromPath(out, f.family);
    if (!ok) throw new Error(`Failed to register font: ${f.family}`);
  }
}

function roundedRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function main() {
  await ensureFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background: diagonal gradient #140a0a -> #0f0707
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#140a0a');
  bg.addColorStop(1, '#0f0707');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle vignette (radial darkening toward the corners)
  const vign = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);

  // --- RIGHT HALF: tilted phone mockup ---
  const phoneAspect = 2379 / 1179; // screenshot height / width
  const phoneTargetH = 520;
  const phoneW = phoneTargetH / phoneAspect; // ~257px
  const phoneH = phoneTargetH;
  const bezel = 8;
  const radius = 34;
  const cx = 900;
  const cy = H / 2 + 10;
  const angleDeg = -6;
  const angle = (angleDeg * Math.PI) / 180;

  const screenshot = await loadImage(SCREENSHOT_PATH);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Drop shadow: rendered via canvas shadow API applied to the frame fill.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 18;

  // Outer dark frame
  ctx.fillStyle = '#000000';
  roundedRectPath(ctx, -phoneW / 2, -phoneH / 2, phoneW, phoneH, radius);
  ctx.fill();

  // Clear shadow before drawing inner content so screenshot isn't doubly-shadowed
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Inner clipped screenshot
  ctx.save();
  roundedRectPath(
    ctx,
    -phoneW / 2 + bezel,
    -phoneH / 2 + bezel,
    phoneW - bezel * 2,
    phoneH - bezel * 2,
    radius - bezel,
  );
  ctx.clip();
  ctx.drawImage(
    screenshot,
    -phoneW / 2 + bezel,
    -phoneH / 2 + bezel,
    phoneW - bezel * 2,
    phoneH - bezel * 2,
  );
  ctx.restore();

  // Subtle inner highlight on the frame edge
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  roundedRectPath(ctx, -phoneW / 2, -phoneH / 2, phoneW, phoneH, radius);
  ctx.stroke();

  ctx.restore();

  // --- LEFT HALF: wordmark + headline + tagline ---
  const leftX = 72;
  const wordmarkBaselineY = 250;

  // Wordmark: "PROMO" (white) + "NIGHT" (brand red), Bebas Neue
  ctx.font = '140px "Bebas Neue"';
  ctx.textBaseline = 'alphabetic';
  const promoText = 'PROMO';
  const nightText = 'NIGHT';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(promoText, leftX, wordmarkBaselineY);
  const promoWidth = ctx.measureText(promoText).width;
  ctx.fillStyle = '#EF4444';
  ctx.fillText(nightText, leftX + promoWidth, wordmarkBaselineY);

  // Thin red accent bar under wordmark
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(leftX, wordmarkBaselineY + 20, 72, 3);

  // Headline
  ctx.font = '600 54px "DM Sans"';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Every promo.', leftX, wordmarkBaselineY + 100);
  ctx.fillText('Every team.', leftX, wordmarkBaselineY + 162);

  // Tagline
  ctx.font = '500 24px "DM Sans"';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Free on iOS and Android', leftX, wordmarkBaselineY + 220);

  // --- Export ---
  const buf = await canvas.encode('png');
  await writeFile(OUTPUT_PATH, buf);
  console.log(`Wrote ${OUTPUT_PATH} (${buf.length.toLocaleString()} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
