import { CONDENSED, LockIcon } from './ui';

// The reserved place for the predicted bracket. It states one thing, that
// the picks were fixed before the postseason began, and it is rendered only
// when the frozen inputs document for the league exists. It carries no date:
// nothing about when the picks publish has been decided.
export const PREDICTIONS_COPY =
  'Our picks were locked from regular-season data before the postseason began. They will publish soon.';

export function PredictionsCard({ heading, headingId, as = 'h2' }: { heading: string; headingId: string; as?: 'h2' | 'h3' }) {
  const Heading = as;
  return (
    <section
      aria-labelledby={headingId}
      data-predictions="locked"
      className="mt-12 rounded-[10px] border border-dashed border-rd-line-strong px-4 py-5"
    >
      <div className="flex items-center gap-2 text-rd-ink-soft">
        <LockIcon />
        <Heading
          id={headingId}
          className="text-[22px] font-extrabold uppercase leading-none text-rd-ink"
          style={{ fontFamily: CONDENSED }}
        >
          {heading}
        </Heading>
      </div>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-rd-ink-soft">{PREDICTIONS_COPY}</p>
    </section>
  );
}
