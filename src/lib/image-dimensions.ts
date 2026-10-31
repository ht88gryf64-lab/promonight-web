import { cache } from 'react';

// The pixel size of a stored promo image (follow-up 2026-10-31), for the promo
// page hero's width and height attributes. The pipeline stores the source
// bytes as they were fetched (promo-pipeline promo-image-step.js) and records
// no dimensions on the row or the object, so the size is read from the
// image's own header: the four types the pipeline accepts (JPEG, PNG, WebP,
// GIF) each name it in the first few hundred bytes, JPEG after its metadata
// segments.

export type ImageSize = { width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

const sized = (width: number, height: number): ImageSize | null =>
  width > 0 && height > 0 ? { width, height } : null;

/** The width and height named in an image's header, or null when the bytes
 *  are not one of the four types or stop before the size. */
export function imageSizeFromBytes(b: Uint8Array): ImageSize | null {
  // PNG: the IHDR chunk is first.
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return sized(u32be(b, 16), u32be(b, 20));
  }
  // GIF: the logical screen size.
  if (b.length >= 10 && ascii(b, 0, 4) === 'GIF8') return sized(u16le(b, 6), u16le(b, 8));
  // WebP: lossy (VP8), lossless (VP8L) or extended (VP8X).
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8 ') return sized(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (chunk === 'VP8X') return sized(u24le(b, 24) + 1, u24le(b, 27) + 1);
    return null;
  }
  // JPEG: walk the segments to the first start-of-frame.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return sized(u16be(b, i + 7), u16be(b, i + 5));
      }
      i += 2 + u16be(b, i + 2);
    }
    return null;
  }
  return null;
}

// The head of the object first; the whole object only when the size sits past
// it (a JPEG with large metadata). The route's own revalidate, so the read
// happens when the page regenerates and never makes the route dynamic.
const HEAD_BYTES = 65536;
const FETCH_INIT = { next: { revalidate: 86400 } } as const;

async function fetchBytes(url: string, range?: string): Promise<Uint8Array | null> {
  const res = await fetch(url, { ...FETCH_INIT, ...(range ? { headers: { Range: range } } : {}), signal: AbortSignal.timeout(5000) });
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

/** The size of the image at `url`, once per request. Null when it cannot be
 *  read; the page then renders the image without the two attributes rather
 *  than failing. */
export const storedImageSize = cache(async (url: string): Promise<ImageSize | null> => {
  try {
    const head = await fetchBytes(url, `bytes=0-${HEAD_BYTES - 1}`);
    let size = head ? imageSizeFromBytes(head) : null;
    if (!size && head && head.length >= HEAD_BYTES) {
      const whole = await fetchBytes(url);
      size = whole ? imageSizeFromBytes(whole) : null;
    }
    if (!size) console.warn('[promo-page] image size unreadable', url);
    return size;
  } catch (err) {
    console.warn('[promo-page] image size unreadable', url, err instanceof Error ? err.message : err);
    return null;
  }
});
