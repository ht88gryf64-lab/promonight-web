// Hub FAQ. Question-based H2s with declarative, self-contained answers (each
// answer stands on its own for featured-snippet eligibility). The same
// question/answer array is passed to AggregatorJsonLd so the rendered copy and
// the FAQPage JSON-LD stay identical. Server component.
export interface HubFaqItem {
  question: string;
  answer: string;
}

export function HubFaq({
  faqs,
  // Defaults to the original id so existing non-hub callers (VenueHubView) render
  // unchanged; the league hubs pass their own per-league id.
  sectionId = 'mlb-hub-faq',
}: {
  faqs: HubFaqItem[];
  sectionId?: string;
}) {
  if (faqs.length === 0) return null;
  return (
    <section aria-labelledby={sectionId} className="border-t border-rd-line pt-10">
      <p
        id={sectionId}
        className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint"
      >
        Frequently asked
      </p>
      <div className="mt-6 space-y-8">
        {faqs.map((f) => (
          <div key={f.question}>
            <h2 className="rd-display text-lg text-rd-ink md:text-xl">{f.question}</h2>
            <p className="mt-2 max-w-2xl font-rd text-[15px] leading-relaxed text-rd-ink-soft">
              {f.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
