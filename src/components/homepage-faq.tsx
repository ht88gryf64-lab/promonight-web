'use client';

import { useEffect, useRef } from 'react';
import { buildHomepageFaqs, type HomepageCounts } from './homepage-json-ld';
import { event } from '@/lib/analytics';

// Answers are ALWAYS in the DOM and always visible. There is no accordion and
// no details/summary here, deliberately: the homepage sits inside the Raptive
// visible-word baseline and collapsed answers are not measured. Both layouts
// below render every answer unconditionally.
//
// The FAQPage JSON-LD does not need syncing by hand. buildHomepageFaqs is
// declared once in homepage-json-ld.tsx and called by two consumers: the
// structured data there and the DOM here, both from the SAME derived counts
// passed by the page. Parity is structural, so neither a layout change nor a
// change in the underlying team data can drift the two apart.
export function HomepageFAQ({
  variant = 'dark',
  layout = 'stack',
  counts,
}: {
  variant?: 'dark' | 'light';
  /** Same derived counts the FAQPage schema is built from, so the visible
   *  answers and the structured data cannot diverge. */
  counts: HomepageCounts;
  // Presentation only, and opt-in: 'stack' (default) is what every current
  // caller renders, so the live homepage is untouched until the wiring pass
  // asks for 'card'. 'card' is the design target's treatment, a left-aligned
  // 780px column of bordered cards under an eyebrow.
  layout?: 'stack' | 'card';
}) {
  const light = variant === 'light';
  const cardLayout = light && layout === 'card';
  const faqs = buildHomepageFaqs(counts);
  // Observed element for faq_section_reached. Deliberately the HEADER BLOCK,
  // not the whole section. IntersectionObserver caps the achievable ratio for
  // a target taller than the viewport at viewportHeight / targetHeight, so a
  // threshold of 0.5 on the full section required a viewport at least half the
  // section's height: about 630px in the stack layout and about 790px in the
  // taller card layout. Small phones could never satisfy it, and the card
  // layout would have made that worse, turning a position change into a
  // confounded one. The header block is a fixed ~50px regardless of layout or
  // answer length, so the trigger is now viewport-independent and the event
  // means what it says: the reader reached the FAQ.
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!ref.current || fired.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          event('faq_section_reached', {
            section_id: 'faq',
            page:
              typeof window !== 'undefined' ? window.location.pathname : '/',
          });
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  if (cardLayout) {
    return (
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div ref={ref} className="mb-8">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-cat-theme" />
              FAQ
            </div>
            <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>
          <div className="max-w-[780px]">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="mb-3 rounded-[14px] border border-rd-line bg-rd-card px-6 py-[22px] shadow-[0_1px_2px_rgba(26,16,14,0.05)]"
              >
                <h3 className="font-rd text-[17px] font-bold leading-[1.25] text-rd-ink">
                  {faq.question}
                </h3>
                <p className="mt-2.5 font-rd text-[14.5px] leading-[1.65] text-rd-ink-soft">
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
    <section
      className={`py-20 px-6 border-t ${light ? 'border-rd-line' : 'border-border-subtle'}`}
    >
      <div className="max-w-3xl mx-auto">
        <div ref={ref} className="text-center mb-12">
          <span className={light ? 'font-rd text-[10px] tracking-[1.5px] uppercase text-rd-ink-faint' : 'font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red'}>
            FAQ
          </span>
          {light ? (
            <h2 className="rd-display text-4xl md:text-5xl text-rd-ink mt-2">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          ) : (
            <h2 className="font-display text-4xl md:text-5xl tracking-[1px] mt-2">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          )}
        </div>
        <div className="space-y-8">
          {faqs.map((faq, i) => (
            <div key={i}>
              <h3 className={light ? 'font-rd text-base font-semibold text-rd-ink mb-2' : 'text-white font-semibold text-base mb-2'}>
                {faq.question}
              </h3>
              <p className={light ? 'text-rd-ink-soft text-sm leading-relaxed' : 'text-text-secondary text-sm leading-relaxed'}>
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
