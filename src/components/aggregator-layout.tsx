import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconGift, IconConfetti, IconCup, IconFlame, type Icon as TablerIcon } from '@tabler/icons-react';
import type { PromoWithTeam } from '@/lib/types';
import { AppDownloadButtons } from './app-download-buttons';
import { AdSlot } from './ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { AggregatorPaginatedGroups } from './aggregator-paginated-groups';
import { isRedesignEnabled } from '@/lib/redesign';
import { archivoHouse } from './redesign/fonts-house';
import { RedesignAggregatorList } from './redesign/RedesignAggregatorList';
import { FollowCTA } from './follow/FollowCTA';

export interface AggregatorGroup {
  label: string;
  promos: PromoWithTeam[];
}

// Category accent for the gate-on redesign hero/list. Optional + only read in the
// redesign branch, so gate-off is unaffected.
export type AggregatorAccentKey = 'giveaway' | 'theme' | 'food' | 'mixed';

export interface AggregatorPageProps {
  eyebrow: string;
  title: string;
  lead: string;
  lastUpdated: string;
  groups: AggregatorGroup[];
  faqs: { question: string; answer: string }[];
  emptyMessage?: string;
  /** Redesign-only: drives the hero/accent color + icon. Default 'mixed' (red). */
  accentKey?: AggregatorAccentKey;
  /** Redesign-only: page slug for the league_filter_change payload. */
  collection?: string;
  /** Redesign-only optional slot rendered right after the intro capsule (e.g.
   *  a cross-link callout). Undefined for every existing page, so their output
   *  is unchanged. */
  afterIntro?: ReactNode;
  /** Redesign-only optional slot rendered right after the promo list (e.g. the
   *  bobbleheads "Earlier this season" resale section). Same contract as
   *  afterIntro: undefined leaves existing pages unchanged. */
  afterList?: ReactNode;
}

const ACCENTS: Record<AggregatorAccentKey, { color: string; Icon: TablerIcon }> = {
  giveaway: { color: '#f97316', Icon: IconGift },
  theme: { color: '#7c3aed', Icon: IconConfetti },
  food: { color: '#16a34a', Icon: IconCup },
  mixed: { color: '#da2d20', Icon: IconFlame },
};

export function AggregatorPage(props: AggregatorPageProps) {
  if (isRedesignEnabled()) return <RedesignAggregatorPage {...props} />;
  return <LegacyAggregatorPage {...props} />;
}

function RedesignAggregatorPage({
  eyebrow,
  title,
  lead,
  lastUpdated,
  groups,
  faqs,
  emptyMessage,
  accentKey = 'mixed',
  collection = 'collection',
  afterIntro,
  afterList,
}: AggregatorPageProps) {
  const totalCount = groups.reduce((acc, g) => acc + g.promos.length, 0);
  const { color, Icon } = ACCENTS[accentKey];

  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      {/* Charcoal hero */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-60"
          style={{ backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${color}26 0%, transparent 60%)` }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
          <div className="mb-5 flex items-center gap-2 font-rd text-xs text-white/45">
            <Link href="/" className="transition-colors hover:text-white/80">Home</Link>
            <span>/</span>
            <span className="text-white/60">Browse</span>
          </div>
          <span
            className="inline-grid h-12 w-12 place-items-center rounded-xl"
            style={{ backgroundColor: `${color}1f` }}
          >
            <Icon size={26} stroke={2} style={{ color }} />
          </span>
          <p className="mt-4 font-rd text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
            {eyebrow}
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">{title}</h1>
          <p className="mt-3 font-rd text-[11px] uppercase tracking-[0.12em] text-white/45">
            {totalCount} promo{totalCount !== 1 ? 's' : ''} · Last updated {lastUpdated}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 pb-20 pt-10">
        {/* Intro capsule — the declarative answer (AI-citation play). */}
        <p className="rounded-2xl border border-rd-line bg-rd-card p-5 font-rd text-[15px] leading-relaxed text-rd-ink-soft">
          {lead}
        </p>

        {afterIntro}

        <div className="my-8">
          <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="promo_collection" />
        </div>

        {totalCount === 0 ? (
          <div className="rounded-2xl border border-rd-line bg-rd-card p-10 text-center">
            <p className="text-rd-ink-soft">{emptyMessage ?? 'Nothing scheduled right now.'}</p>
          </div>
        ) : (
          <RedesignAggregatorList
            groups={groups}
            accentColor={color}
            collection={collection}
            surface="web_article"
            initialCount={350}
          />
        )}

        {afterList}

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
          <h2 className="rd-display text-2xl uppercase text-rd-ink md:text-3xl">SEE THE FULL CALENDAR ON PROMONIGHT</h2>
          <p className="mx-auto mt-3 max-w-md font-rd text-sm text-rd-ink-soft">
            Get notifications the morning of every giveaway, theme night, and food deal for your teams.
          </p>
          <div className="mt-6 flex justify-center">
            <AppDownloadButtons section="aggregator_cta" page={title.toLowerCase().replace(/\s+/g, '_')} variant="compact" />
          </div>
        </div>

        {/* Email-capture entry; tags the funnel web_aggregator. */}
        <FollowCTA surface="web_aggregator" className="mt-6" />

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="mt-16">
            <h2 className="rd-display mb-5 text-2xl uppercase text-rd-ink md:text-3xl">FREQUENTLY ASKED QUESTIONS</h2>
            <div className="space-y-6">
              {faqs.map((f, i) => (
                <div key={i}>
                  <h3 className="font-rd text-base font-semibold text-rd-ink">{f.question}</h3>
                  <p className="mt-1.5 font-rd text-sm leading-relaxed text-rd-ink-soft">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10">
          <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="promo_collection" />
        </div>
      </div>
    </div>
  );
}

function LegacyAggregatorPage({
  eyebrow,
  title,
  lead,
  lastUpdated,
  groups,
  faqs,
  emptyMessage,
}: AggregatorPageProps) {
  const totalCount = groups.reduce((acc, g) => acc + g.promos.length, 0);

  return (
    <div className="pt-28 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-text-muted text-xs font-mono tracking-[0.5px] mb-6">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-text-secondary">Browse</span>
          </div>
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            {eyebrow}
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            {title}
          </h1>
          <p className="text-text-muted text-xs font-mono tracking-[0.5px] mt-3">
            Last updated {lastUpdated} &middot; {totalCount} promo{totalCount !== 1 ? 's' : ''}
          </p>
          <p className="mt-5 text-text-secondary text-base leading-relaxed max-w-3xl">
            {lead}
          </p>
        </div>

        <div className="mb-10">
          <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="promo_collection" />
        </div>

        <div className="mb-10">
          <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="promo_collection" />
        </div>

        {/* Groups — paginated client-side. Initial 50 promos render as DOM;
         *  "Show more" appends additional 50 from the same prop array (no
         *  network fetch). Trimming overflow promos was sized to keep
         *  /promos/theme-nights and /promos/jersey-giveaways under Bing's 1MB
         *  Site Scan limit. */}
        {totalCount === 0 ? (
          <div className="bg-bg-card border border-border-subtle rounded-2xl p-10 text-center">
            <p className="text-text-secondary">{emptyMessage ?? 'Nothing scheduled right now.'}</p>
          </div>
        ) : (
          <AggregatorPaginatedGroups groups={groups} />
        )}

        {/* CTA */}
        <div className="mt-16 bg-bg-card border border-border-subtle rounded-2xl p-8 text-center">
          <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-3">
            SEE THE FULL CALENDAR ON PROMONIGHT
          </h2>
          <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
            Get notifications the morning of every giveaway, theme night, and food deal for your teams.
          </p>
          <AppDownloadButtons section="aggregator_cta" page={title.toLowerCase().replace(/\s+/g, '_')} variant="compact" />
        </div>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-5">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            <div className="space-y-6">
              {faqs.map((f, i) => (
                <div key={i}>
                  <h3 className="text-white font-semibold text-base mb-1.5">{f.question}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10">
          <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="promo_collection" />
        </div>
      </div>
    </div>
  );
}

export function AggregatorJsonLd({
  url,
  title,
  description,
  lastUpdated,
  faqs,
}: {
  url: string;
  title: string;
  description: string;
  lastUpdated: string;
  faqs: { question: string; answer: string }[];
}) {
  const schemas: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url,
      dateModified: lastUpdated,
      author: {
        '@type': 'Organization',
        name: 'PromoNight',
        url: 'https://www.getpromonight.com',
      },
      publisher: {
        '@type': 'Organization',
        name: 'PromoNight',
        url: 'https://www.getpromonight.com',
      },
    },
  ];

  if (faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  );
}
