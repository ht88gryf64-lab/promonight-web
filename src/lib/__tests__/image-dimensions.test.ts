// src/lib/image-dimensions.ts: the promo hero's width and height, read from
// the stored image's own header (follow-up 2026-10-31).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageSizeFromBytes } from '@/lib/image-dimensions';

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

test('PNG: the IHDR width and height', () => {
  const png = bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], 'IHDR', [0, 0, 0x04, 0xb0, 0, 0, 0x02, 0x76]);
  assert.deepEqual(imageSizeFromBytes(png), { width: 1200, height: 630 });
});

test('GIF: the logical screen size', () => {
  assert.deepEqual(imageSizeFromBytes(bytes('GIF89a', [0x40, 0x01, 0xf0, 0x00])), { width: 320, height: 240 });
});

test('JPEG: walks past APP segments to the start of frame', () => {
  const app1 = [0xff, 0xe1, 0x00, 0x08, 1, 2, 3, 4, 5, 6];
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0, 0];
  const sof2 = [0xff, 0xc2, 0x00, 0x11, 8, 0x02, 0x58, 0x03, 0x20, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(imageSizeFromBytes(bytes([0xff, 0xd8], app1, dqt, sof2)), { width: 800, height: 600 });
  // DHT (C4) is not a frame header.
  const dht = [0xff, 0xc4, 0x00, 0x04, 0, 0];
  assert.deepEqual(imageSizeFromBytes(bytes([0xff, 0xd8], dht, sof2)), { width: 800, height: 600 });
  // Cut before the frame header: unknown, not a guess.
  assert.equal(imageSizeFromBytes(bytes([0xff, 0xd8], app1, dqt)), null);
});

test('WebP: lossy, lossless and extended', () => {
  const riff = (chunk: string, body: number[]) => bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, [0, 0, 0, 0], body);
  assert.deepEqual(imageSizeFromBytes(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0xb0, 0x04, 0x76, 0x02])), { width: 1200, height: 630 });
  // VP8L: 14-bit width-1 and height-1 after the 0x2f signature (1200x630).
  const w = 1199, h = 629, bits = w | (h << 14);
  assert.deepEqual(imageSizeFromBytes(riff('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff, 0, 0, 0, 0, 0])), { width: 1200, height: 630 });
  assert.deepEqual(imageSizeFromBytes(riff('VP8X', [0, 0, 0, 0, 0xaf, 0x04, 0x00, 0x75, 0x02, 0x00])), { width: 1200, height: 630 });
});

test('anything else, or a zero size, is null', () => {
  for (const b of [new Uint8Array(0), bytes('<html>'), bytes('GIF89a', [0, 0, 0, 0]), bytes([0xff, 0xd8, 0x00])]) {
    assert.equal(imageSizeFromBytes(b), null);
  }
});
