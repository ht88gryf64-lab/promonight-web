import Link from 'next/link';
import type { PromoWithTeam } from '@/lib/types';
import { AppDownloadButtons } from './app-download-buttons';
import { AdSlot } from './ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { AggregatorPaginatedGroups } from './aggregator-paginated-groups';

export interface AggregatorGroup {
  label: string;
  promos: PromoWithTeam[];
}

export interface AggregatorPageProps {
  eyebrow: string;
  title: string;
  lead: string;
  lastUpdated: string;
  groups: AggregatorGroup[];
  faqs: { question: string; answer: string }[];
  emptyMessage?: string;
}

export function AggregatorPage({
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
