import type { Team, Promo, PromoType, Venue } from '@/lib/types';
import { generateTeamFAQs, type PlayoffFAQContext } from '@/lib/promo-helpers';

interface TeamFAQProps {
  team: Team;
  promos: Promo[];
  venue: Venue | null;
  promoCounts: Record<PromoType, number>;
  playoffContext?: PlayoffFAQContext;
}

export function TeamFAQ({ team, promos, venue, promoCounts, playoffContext }: TeamFAQProps) {
  const faqs = generateTeamFAQs(team, promos, venue, promoCounts, playoffContext);

  if (faqs.length === 0) return null;

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
