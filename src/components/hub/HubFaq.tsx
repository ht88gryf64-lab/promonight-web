// Hub FAQ. Question-based H2s with declarative, self-contained answers (each
// answer stands on its own for featured-snippet eligibility). The same
// question/answer array is passed to AggregatorJsonLd so the rendered copy and
// the FAQPage JSON-LD stay identical. Server component.
export interface HubFaqItem {
  question: string;
  answer: string;
  /** The page the answer quotes, linked under it on the page. NEVER part of
   *  the FAQPage answer text: JSON-LD carries `answer` alone, so the on-page
   *  answer and the structured one stay the same string. */
  sourceUrl?: string;
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function HubFaq({
  faqs,
  // Defaults to the original id so existing non-hub callers (VenueHubView) render
  // unchanged; the league hubs pass their own per-league id.
  sectionId = 'mlb-hub-faq',
  adItem,
  heading = 'Frequently asked',
}: {
  faqs: HubFaqItem[];
  /** The section eyebrow. The venue bag template passes "Common questions". */
  heading?: string;
  sectionId?: string;
  /** Ad-placement item type, supplied by the host page. Omitted on hosts
   * outside the selector-hook scope so no page gets an item without a
   * region. */
  adItem?: string;
}) {
  if (faqs.length === 0) return null;
  return (
    <section aria-labelledby={sectionId} className="border-t border-rd-line pt-10" data-ad-item={adItem}>
      <p
        id={sectionId}
        className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint"
      >
        {heading}
      </p>
      <div className="mt-6 space-y-8">
        {faqs.map((f) => (
          <div key={f.question}>
            <h2 className="rd-display text-lg text-rd-ink md:text-xl">{f.question}</h2>
            <p className="mt-2 max-w-2xl font-rd text-[15px] leading-relaxed text-rd-ink-soft">
              {f.answer}
            </p>
            {f.sourceUrl ? (
              <p className="mt-1 font-rd text-[12px]">
                <a href={f.sourceUrl} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                  {sourceHost(f.sourceUrl)} &rsaquo;
                </a>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
