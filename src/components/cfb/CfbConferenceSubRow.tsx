'use client';

// The conference sub-row shown in the pro team browsers (home + /teams) ONLY
// when the CFB chip is active. CFB is not a pro league and its 86 schools are a
// separate data stream, so instead of filtering pro cards inline, selecting CFB
// reveals this panel — each conference chip DEEP-LINKS into the /cfb hub
// (/cfb?conf=<slug>), and "View the full hub" opens /cfb. No CFB cards ever
// render in the pro promo grid, and CFB is never counted in the "All" total.

import Link from 'next/link';
import { track } from '@/lib/analytics';
import { CFB_CONFERENCES } from '@/lib/cfb/conferences';

export function CfbConferenceSubRow({
  light = false,
  surface,
}: {
  light?: boolean;
  surface: 'homepage' | 'teams_page';
}) {
  const pill = light
    ? 'rounded-full border px-4 py-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink'
    : 'px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border bg-transparent text-text-secondary border-border-subtle hover:border-border-hover';
  const viewAll = light
    ? 'rounded-full border px-4 py-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors border-rd-ink bg-rd-ink text-white hover:opacity-90'
    : 'px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border bg-accent-red text-white border-accent-red hover:opacity-90';

  return (
    <div className="py-2">
      <p className={light ? 'mb-4 font-rd text-sm text-rd-ink-soft' : 'mb-4 text-sm text-text-secondary'}>
        College football lives in its own hub — pick a conference to jump in.
      </p>
      <div className="flex flex-wrap gap-2">
        {CFB_CONFERENCES.map((c) => (
          <Link
            key={c.slug}
            href={`/cfb?conf=${c.slug}`}
            onClick={() => track('cfb_conf_nav', { surface, conf: c.slug })}
            className={pill}
          >
            {c.bucket}
          </Link>
        ))}
        <Link
          href="/cfb"
          onClick={() => track('cfb_conf_nav', { surface, conf: 'all' })}
          className={viewAll}
        >
          View the full hub →
        </Link>
      </div>
    </div>
  );
}
