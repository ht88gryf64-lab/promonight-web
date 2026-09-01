'use client';

// BROWSE all 87 (section 14 crawlability rule, NON-NEGOTIABLE). Every team
// <a href> renders in the DOM at all times; the conference selector + search
// are a pure CSS VISIBILITY filter (inline display:none), never
// conditional-render or lazy-fetch, so SEO equity flows to every team page
// regardless of the selected conference. This is a client component, but Next
// SSRs its initial markup, so all 87 links are present in the served HTML.
//
// This paragraph used to ship. Until 2026-09-01 the rule above was ALSO
// rendered as visible body copy under the grid: "All 87 team links render in
// the DOM regardless of the selected conference (visibility filter only), for
// crawlability + SEO equity to team pages", in 10px mono at 30% opacity. It was
// not an HTML comment and not sr-only; fans reading a college football page were
// being shown a note about DOM crawlability, with an em dash in it. Deleted.
//
// Deleting it must not touch what it describes. The unconditional
// browse.flatMap render and the per-chip display:none are the load-bearing
// half; only the prose is gone.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HubTeam } from '@/lib/cfb/hub-data';
import { bucketForConfSlug } from '@/lib/cfb/conferences';

const GOLD = '#FFB71E';
const MONO = 'var(--font-mono), ui-monospace, monospace';

export function CfbHubBrowse({ browse }: { browse: { bucket: string; teams: HubTeam[] }[] }) {
  const [conf, setConf] = useState<string>('All');
  const [q, setQ] = useState('');
  const buckets = ['All', ...browse.map((b) => b.bucket)];
  const query = q.trim().toLowerCase();

  // Honor a /cfb?conf=<slug> deep link (the pro-browser conference sub-row links
  // here). Read client-side from the URL so the page stays STATICALLY rendered
  // (all 86 links in the SSR HTML for crawlability) — the param only sets the
  // initial visibility filter after hydration. Unknown/missing slug -> "All".
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('conf');
    const bucket = bucketForConfSlug(slug);
    if (bucket && browse.some((b) => b.bucket === bucket)) setConf(bucket);
  }, [browse]);

  const chip = (t: HubTeam, bucket: string) => {
    const show = (conf === 'All' || conf === bucket) && (query === '' || t.name.toLowerCase().includes(query) || t.shortName.toLowerCase().includes(query));
    return (
      <Link
        key={t.id}
        href={`/cfb/${t.id}`}
        data-conf={bucket}
        style={{ display: show ? undefined : 'none' }}
        className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
      >
        {t.name}
      </Link>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {buckets.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setConf(b)}
            className="rounded-md border px-4 py-2 text-[12px] font-bold tracking-wide transition-colors"
            style={{ fontFamily: MONO, borderColor: conf === b ? GOLD : 'rgba(255,255,255,0.12)', background: conf === b ? 'rgba(255,183,30,0.10)' : 'transparent', color: conf === b ? GOLD : '#888' }}
          >
            {b}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter teams…"
          aria-label="Filter teams by name"
          // text-base (16px), not text-sm: below 16 iOS Safari zooms the page on
          // focus. See the note in capture/CaptureCard.tsx.
          className="ml-auto w-40 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-base text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
        />
      </div>
      {/* ALL teams from ALL buckets render here always — filter is visibility only */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {browse.flatMap((b) => b.teams.map((t) => chip(t, b.bucket)))}
      </div>
    </div>
  );
}
