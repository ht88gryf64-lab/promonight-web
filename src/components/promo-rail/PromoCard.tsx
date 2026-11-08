import Link from 'next/link';
import type { LinkedPromo } from '@/lib/promo-pages';
import { dateBlock } from '@/lib/promo-page-copy';

// The rail's compact variant: one row, the month and day on the left, the
// name and a sub line (the opponent and time, or the club), the whole row
// ONE Link to the promo's page. The promo page uses it under the rail when
// there is a single card and for the cross-team block; the archive page
// (/{league}/{team}/promos/past, step 6) lists every past edition with it.
// Server component: strings and a Link, nothing to hydrate.
export function PromoCard({ p, showTeam }: { p: Pick<LinkedPromo, 'href' | 'title' | 'date' | 'teamName' | 'displayOpponent' | 'displayTime'>; showTeam: boolean }) {
  const d = dateBlock(p.date);
  const sub = showTeam ? p.teamName : [p.displayOpponent ? `vs ${p.displayOpponent}` : null, p.displayTime || null].filter(Boolean).join(' · ');
  return (
    <Link href={p.href} className="flex items-center gap-3 rounded-xl border border-rd-line bg-rd-card p-2.5 text-rd-ink no-underline transition-colors hover:border-rd-line-strong">
      <span className="w-11 shrink-0 text-center leading-none">
        <span className="block font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{d.month}</span>
        <span className="rd-numerals block text-[20px]">{d.day}</span>
      </span>
      <span className="min-w-0 flex-1 text-[14px]">
        <span className="block font-semibold">{p.title}</span>
        {sub ? <span className="block text-[12px] text-rd-ink-faint">{sub}</span> : null}
      </span>
    </Link>
  );
}
