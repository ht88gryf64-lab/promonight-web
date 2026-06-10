'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PromoWithTeam } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import { isBobbleheadGiveaway } from '@/lib/ebay';
import { EbayResaleLink } from '@/components/affiliates/EbayResaleLink';

// "Earlier this season" section for /promos/bobbleheads: completed bobblehead
// promos, most recent first. Strict-predicate giveaways are exempt from the
// collapse — up to LIFT_VISIBLE render server-side carrying the eBay resale
// CTA; everything else (including loose title/description matches that fail
// the strict predicate) lazy-mounts behind the expander as plain completed
// rows, same SSR-weight strategy as LazyPromoRows on team pages.

const LIFT_VISIBLE = 3;

function dateParts(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

// Completed-row card. The title links to the team page; the card itself is a
// div so the resale CTA is never nested inside another anchor.
function PastBobbleheadRow({ p, withResale }: { p: PromoWithTeam; withResale: boolean }) {
  const { day, weekday, month } = dateParts(p.date);
  return (
    <div className="relative flex gap-4 rounded-xl border border-rd-line bg-rd-card py-4 pl-5 pr-5 opacity-60 transition-opacity hover:opacity-80">
      <div className="w-12 flex-shrink-0 text-center">
        <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
        <div className="rd-numerals text-2xl leading-none text-rd-ink">{day}</div>
        <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${p.team.sportSlug}/${p.team.id}`}
            className="truncate text-sm font-semibold text-rd-ink transition-colors hover:text-rd-red md:text-base"
          >
            {p.title}
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full border border-rd-line px-2 py-0.5 font-rd text-[10px] uppercase tracking-[0.05em] text-rd-ink-faint">
            Completed
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 truncate font-rd text-xs text-rd-ink-soft">
          <span
            aria-hidden
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: p.team.primaryColor }}
          />
          <span className="truncate">
            {teamDisplayName(p.team)}
            {p.opponent && <span className="text-rd-ink-faint"> vs {p.opponent}</span>}
            <span className="text-rd-ink-faint"> · {p.team.league}</span>
          </span>
        </div>
        {withResale && (
          <EbayResaleLink
            promo={p}
            teamSlug={p.team.id}
            teamNickname={p.team.name}
            sport={p.team.sportSlug}
            placement="bobbleheads_hub"
            surface="web_article"
            variant="light"
          />
        )}
      </div>
    </div>
  );
}

export function PastBobbleheadsSection({ promos }: { promos: PromoWithTeam[] }) {
  const [open, setOpen] = useState(false);

  if (promos.length === 0) return null;

  const lifted = promos.filter(isBobbleheadGiveaway).slice(0, LIFT_VISIBLE);
  const liftedSet = new Set(lifted);
  const collapsed = promos.filter((p) => !liftedSet.has(p));

  return (
    <section className="mt-16">
      <div className="mb-4">
        <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
          Already happened
        </span>
        <h2 className="rd-display mt-1 text-2xl uppercase text-rd-ink-soft md:text-3xl">
          EARLIER THIS SEASON
        </h2>
      </div>

      {lifted.length > 0 && (
        <div className="space-y-2.5">
          {lifted.map((p, i) => (
            <PastBobbleheadRow key={`lift-${i}`} p={p} withResale />
          ))}
        </div>
      )}

      {collapsed.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rd-line bg-rd-card px-5 py-2.5 font-rd text-[11px] uppercase tracking-[0.1em] text-rd-ink-soft transition-colors hover:border-rd-line-strong hover:text-rd-ink"
          >
            <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">▸</span>
            {open
              ? `Hide completed ${collapsed.length === 1 ? 'promo' : 'promos'}`
              : `Show ${collapsed.length} ${lifted.length > 0 ? 'more ' : ''}completed ${collapsed.length === 1 ? 'promo' : 'promos'}`}
          </button>
          {open && (
            <div className="mt-4 space-y-2.5">
              {collapsed.map((p, i) => (
                <PastBobbleheadRow key={`rest-${i}`} p={p} withResale={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
