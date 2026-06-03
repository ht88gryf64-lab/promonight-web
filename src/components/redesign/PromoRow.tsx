import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconFlame } from '@tabler/icons-react';
import type { PromoType } from '@/lib/types';
import { categoryFor } from '@/components/redesign/categories';

// Redesign v2 PromoRow. A single linear row for the canonical, crawlable
// UpcomingList of upcoming games/promos. Presentational and self-contained:
// the parent (a client component) may pass onClick to jump the calendar to a
// date, or href to make the whole row an internal link. No 'use client' here —
// this only attaches a handler the client parent owns.

export interface PromoRowProps {
  date: string; // YYYY-MM-DD
  category: PromoType; // drives the colored pill + icon
  title: string;
  matchup?: string; // e.g. "vs Tigers" or "at Yankees"
  description?: string;
  hot?: boolean;
  timeLabel?: string; // e.g. "7:10 PM" or "TBD"
  href?: string; // optional internal link for the whole row
  onClick?: () => void; // optional (parent may jump the calendar to this date)
  rightSlot?: ReactNode; // optional CTA/area on the right
}

const ROW_CLASS =
  'group flex w-full items-center gap-4 rounded-xl border border-rd-line bg-rd-card ' +
  'px-4 py-3.5 text-left transition-colors hover:border-rd-line-strong';

export function PromoRow({
  date,
  category,
  title,
  matchup,
  description,
  hot,
  timeLabel,
  href,
  onClick,
  rightSlot,
}: PromoRowProps) {
  const meta = categoryFor(category);
  const { color, label, Icon } = meta;

  const d = new Date(date + 'T12:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.toLocaleDateString('en-US', { day: 'numeric' });

  const interactive = Boolean(href || onClick);

  // The date block + middle column are the "main content" that becomes the link
  // or button target. The right slot stays outside so its own CTA stays clickable.
  const mainContent = (
    <>
      {/* Date block */}
      <div className="flex w-11 shrink-0 flex-col items-center leading-none">
        <span className="text-[10px] font-rd font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">
          {month}
        </span>
        <span className="rd-numerals text-xl text-rd-ink">{day}</span>
      </div>

      {/* Middle */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon size={12} stroke={2.25} />
            <span>{label}</span>
          </span>
          {hot && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-rd-red">
              <IconFlame size={12} stroke={2.25} />
              <span>Hot</span>
            </span>
          )}
        </div>

        <p className="mt-1 truncate font-rd font-semibold text-rd-ink">{title}</p>

        {(matchup || timeLabel) && (
          <p className="truncate text-xs text-rd-ink-soft">
            {matchup}
            {matchup && timeLabel ? ' · ' : ''}
            {timeLabel}
          </p>
        )}

        {description && (
          <p className="truncate text-xs text-rd-ink-faint">{description}</p>
        )}
      </div>
    </>
  );

  const rightContent =
    rightSlot ??
    (interactive ? (
      <IconChevronRight
        size={18}
        stroke={2}
        className="text-rd-ink-faint transition-colors group-hover:text-rd-ink-soft"
      />
    ) : null);

  // When the whole row links/acts, the date+middle is the target; rightSlot sits
  // beside it so an embedded CTA isn't nested inside a link/button.
  if (href) {
    return (
      <div className={ROW_CLASS}>
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
          {mainContent}
        </Link>
        {rightContent && <div className="shrink-0">{rightContent}</div>}
      </div>
    );
  }

  if (onClick) {
    return (
      <div className={ROW_CLASS}>
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          {mainContent}
        </button>
        {rightContent && <div className="shrink-0">{rightContent}</div>}
      </div>
    );
  }

  return (
    <div className={ROW_CLASS}>
      {mainContent}
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </div>
  );
}
