'use client';

import { useEffect, useRef } from 'react';
import { HOMEPAGE_FAQS } from './homepage-json-ld';
import { event } from '@/lib/analytics';

export function HomepageFAQ() {
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

  return (
    <section
      ref={ref}
      className="py-20 px-6 border-t border-border-subtle"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            FAQ
          </span>
          <h2 className="font-display text-4xl md:text-5xl tracking-[1px] mt-2">
            FREQUENTLY ASKED QUESTIONS
          </h2>
        </div>
        <div className="space-y-8">
          {HOMEPAGE_FAQS.map((faq, i) => (
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
