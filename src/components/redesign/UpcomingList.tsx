'use client';

import { useMemo, useState } from 'react';
import type { Promo, PromoType } from '@/lib/types';
import { PromoRow } from './PromoRow';
import { Button } from './Button';

// Redesign v2 Upcoming Promos list — the canonical LINEAR DOM for crawlers. It
// renders EVERY upcoming promo row into the HTML (lightweight rows, so no 1MB
// concern); rows beyond `initialCount` are present but `hidden` until the
// show-all toggle reveals them, so the content is crawlable while the UI stays
// truncated. Sparse teams get an intentional empty state, not a broken gap.

interface UpcomingListProps {
  promos: Promo[];
  activeCategory?: PromoType | 'all';
  initialCount?: number;
}

export function UpcomingList({ promos, activeCategory = 'all', initialCount = 8 }: UpcomingListProps) {
  const [showAll, setShowAll] = useState(false);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const upcoming = useMemo(
    () =>
      promos
        .filter((p) => p.date >= todayStr)
        .filter((p) => activeCategory === 'all' || p.type === activeCategory)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [promos, activeCategory, todayStr],
  );

  if (upcoming.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rd-line-strong bg-rd-card/60 px-5 py-8 text-center">
        <p className="font-rd font-semibold text-rd-ink">
          {activeCategory === 'all'
            ? 'No upcoming promos announced yet'
            : 'No upcoming promos in this category'}
        </p>
        <p className="mt-1 text-sm text-rd-ink-soft">
          The season schedule fills in as teams announce — check back soon.
        </p>
      </div>
    );
  }

  const head = upcoming.slice(0, initialCount);
  const tail = upcoming.slice(initialCount);

  const renderRow = (p: Promo, i: number) => (
    <PromoRow
      key={`${p.date}-${p.title}-${i}`}
      date={p.date}
      category={p.type}
      title={p.title}
      matchup={p.opponent ? `vs ${p.opponent}` : undefined}
      description={p.description || undefined}
      hot={p.highlight}
      timeLabel={p.time || undefined}
    />
  );

  return (
    <div className="space-y-2">
      {head.map(renderRow)}
      {tail.length > 0 && (
        <div hidden={!showAll} className="space-y-2">
          {tail.map((p, i) => renderRow(p, i + initialCount))}
        </div>
      )}
      {tail.length > 0 && (
        <Button variant="secondary" fullWidth onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${upcoming.length} upcoming promos`}
        </Button>
      )}
    </div>
  );
}
