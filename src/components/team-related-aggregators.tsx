import Link from 'next/link';
import type { Promo } from '@/lib/types';

const BOBBLEHEAD_RE = /bobblehead/i;
const JERSEY_RE = /\b(jersey|cap|hat|jacket|shirt|hoodie)\b/i;

export function TeamRelatedAggregators({ promos }: { promos: Promo[] }) {
  const bobbleheads = promos.filter(
    (p) => BOBBLEHEAD_RE.test(p.title) || BOBBLEHEAD_RE.test(p.description),
  ).length;
  const jerseys = promos.filter(
    (p) => JERSEY_RE.test(p.title) || JERSEY_RE.test(p.description),
  ).length;
  const themes = promos.filter((p) => p.type === 'theme').length;

  const items: { label: string; href: string; hint: string }[] = [];
  if (bobbleheads >= 5) {
    items.push({
      label: 'Every bobblehead across pro sports',
      href: '/promos/bobbleheads',
      hint: `${bobbleheads} on this team`,
    });
  }
  if (jerseys >= 3) {
    items.push({
      label: 'Every jersey & apparel giveaway',
      href: '/promos/jersey-giveaways',
      hint: `${jerseys} on this team`,
    });
  }
  if (themes >= 5) {
    items.push({
      label: 'Every theme night in pro sports',
      href: '/promos/theme-nights',
      hint: `${themes} on this team`,
    });
  }
  items.push({
    label: 'Hot promos this week',
    href: '/promos/this-week',
    hint: 'All leagues',
  });

  return (
    <section className="py-12 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          Browse by type
        </span>
        <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 mb-5">
          SEE IT ACROSS ALL TEAMS
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="group bg-bg-card border border-border-subtle rounded-xl p-4 flex items-center justify-between hover:border-border-hover transition-colors"
            >
              <div>
                <div className="text-white font-semibold text-sm group-hover:text-accent-red transition-colors">
                  {it.label}
                </div>
                <div className="text-text-muted text-xs font-mono mt-0.5">
                  {it.hint}
                </div>
              </div>
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
