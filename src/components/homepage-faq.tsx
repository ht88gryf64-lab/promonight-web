'use client';

import { useEffect, useRef } from 'react';
import { HOMEPAGE_FAQS } from './homepage-json-ld';
import { event } from '@/lib/analytics';

export function HomepageFAQ({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const light = variant === 'light';
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
