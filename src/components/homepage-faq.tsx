'use client';

import { useEffect, useRef } from 'react';
import { HOMEPAGE_FAQS } from './homepage-json-ld';
import { event } from '@/lib/analytics';

// Answers are ALWAYS in the DOM and always visible. There is no accordion and
// no details/summary here, deliberately: the homepage sits inside the Raptive
// visible-word baseline and collapsed answers are not measured. Both layouts
// below render every answer unconditionally.
//
// The FAQPage JSON-LD does not need syncing by hand. HOMEPAGE_FAQS is declared
// once in homepage-json-ld.tsx and read by two consumers: the structured data
// there and the DOM here. Parity is structural, so a layout change like the
// one below cannot drift from the schema. This commit leaves that array byte
// identical, which is why the JSON-LD output is unchanged.
export function HomepageFAQ({
  variant = 'dark',
  layout = 'stack',
}: {
  variant?: 'dark' | 'light';
  // Presentation only, and opt-in: 'stack' (default) is what every current
  // caller renders, so the live homepage is untouched until the wiring pass
  // asks for 'card'. 'card' is the design target's treatment, a left-aligned
  // 780px column of bordered cards under an eyebrow.
  layout?: 'stack' | 'card';
}) {
  const light = variant === 'light';
  const cardLayout = light && layout === 'card';
  const ref = useRef<HTMLElement>(null);
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
      <section ref={ref} className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-cat-theme" />
              FAQ
            </div>
            <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>
          <div className="max-w-[780px]">
            {HOMEPAGE_FAQS.map((faq, i) => (
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
      ref={ref}
      className={`py-20 px-6 border-t ${light ? 'border-rd-line' : 'border-border-subtle'}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
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
          {HOMEPAGE_FAQS.map((faq, i) => (
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
