import type { Team, Promo, PromoType, Venue } from '@/lib/types';
import { generateTeamFAQs, type PlayoffFAQContext } from '@/lib/promo-helpers';

interface TeamFAQProps {
  team: Team;
  /** UPCOMING promos and their counts. These answers ship inside FAQPage
   *  structured data, so they may only describe promos still ahead. The page
   *  splits once and passes the upcoming half here. */
  upcomingPromos: Promo[];
  venue: Venue | null;
  upcomingCounts: Record<PromoType, number>;
  /** Total teams, derived by the page from getAllTeams().length. */
  teamCount: number;
  playoffContext?: PlayoffFAQContext;
  variant?: 'dark' | 'light';
}

export function TeamFAQ({ team, upcomingPromos, venue, upcomingCounts, teamCount, playoffContext, variant = 'dark' }: TeamFAQProps) {
  const faqs = generateTeamFAQs(team, upcomingPromos, venue, upcomingCounts, teamCount, playoffContext);

  if (faqs.length === 0) return null;

  if (variant === 'light') {
    return (
      <section className="py-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="rd-display text-3xl md:text-4xl text-rd-ink mb-8">
            FREQUENTLY ASKED QUESTIONS
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i}>
                <h3 className="font-rd font-semibold text-base text-rd-ink mb-2">
                  {faq.question}
                </h3>
                <p className="text-rd-ink-soft text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mb-8">
          FREQUENTLY ASKED QUESTIONS
        </h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i}>
              <h3 className="text-white font-semibold text-base mb-2">
                {faq.question}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
