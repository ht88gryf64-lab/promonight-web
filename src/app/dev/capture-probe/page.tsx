import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import { CaptureProbeClient } from './probe-client';

// Server half of the probe. Its only job is to emit a viewport meta whose
// initial-scale comes from the URL.
//
// WHY THIS AND NOT A PINCH. The state under test is "layout viewport wider than
// visual viewport". A pinch produces it, focus auto-zoom produces it, and
// `initial-scale` produces it — the same WebKit viewport machinery in all three
// cases, and the only one of the three that is scriptable without a tap.
// /dev/capture-probe?scale=1.75 gives a 393px layout viewport inside a 224.6px
// visual viewport, which is precisely the geometry the fix is derived against.
//
// `width=393` is pinned rather than device-width so a scale sweep varies ONE
// thing. On a 393px device that is what device-width already resolves to.

export const dynamic = 'force-dynamic';

export async function generateViewport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Viewport> {
  const sp = await searchParams;
  const raw = Array.isArray(sp.scale) ? sp.scale[0] : sp.scale;
  const scale = Number(raw);
  const initialScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const w = Array.isArray(sp.w) ? sp.w[0] : sp.w;
  const width = Number(w);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 'device-width',
    initialScale,
  };
}

export default async function CaptureProbePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 404 in production. This route renders the capture sheet unconditionally,
  // bypassing the kill switch and the trigger engine, so on the live site it
  // would show the prompt to anyone who found the URL — including while the
  // switch is off. It is an instrument, not a surface.
  if (process.env.VERCEL_ENV === 'production') notFound();

  const sp = await searchParams;
  const af = Array.isArray(sp.autofocus) ? sp.autofocus[0] : sp.autofocus;
  return <CaptureProbeClient autofocusId={af || undefined} />;
}
