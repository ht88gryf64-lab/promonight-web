import Link from 'next/link';
import {
  IconTrophy,
  IconFlame,
  IconShirt,
  IconConfetti,
  IconList,
  IconChevronRight,
  type Icon,
} from '@tabler/icons-react';
import type { Team } from '@/lib/types';

// Redesign v2 sidebar card: a light, editorial invitation to explore more of
// PromoNight. Presentational only — a white card with an "Explore" eyebrow, an
// rd-display heading, and a list of next/link rows (tinted icon square + label
// + chevron). The last row is league-aware ("All MLB teams").

export interface ExploreCardProps {
  team: Team;
  className?: string;
}

interface ExploreLink {
  href: string;
  label: string;
  Icon: Icon;
}

export function ExploreCard({ team, className = '' }: ExploreCardProps) {
  const links: ExploreLink[] = [
    { href: '/promos/bobbleheads', label: 'Every bobblehead', Icon: IconTrophy },
    { href: '/promos/this-week', label: 'Hot this week', Icon: IconFlame },
    { href: '/promos/jersey-giveaways', label: 'Jersey & apparel giveaways', Icon: IconShirt },
    { href: '/promos/theme-nights', label: 'Theme nights', Icon: IconConfetti },
    { href: '/teams', label: `All ${team.league} teams`, Icon: IconList },
  ];

  return (
    <div className={`bg-rd-card rounded-2xl border border-rd-line p-5 ${className}`}>
      <p className="font-rd uppercase text-[11px] tracking-[0.14em] text-rd-ink-faint">
        Explore
      </p>
      <h2 className="rd-display text-xl text-rd-ink mt-1">More to dig into</h2>

      <div className="mt-4 flex flex-col">
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-rd-cream transition-colors"
          >
            <span className="h-9 w-9 rounded-lg bg-rd-cream grid place-items-center shrink-0">
              <Icon size={18} stroke={2} className="text-rd-ink-soft" />
            </span>
            <span className="font-rd font-medium text-rd-ink flex-1">{label}</span>
            <IconChevronRight size={18} stroke={2} className="text-rd-ink-faint shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
