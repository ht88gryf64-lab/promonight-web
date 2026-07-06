import { IconMapPin } from '@tabler/icons-react';

// Redesign v2 team-page hero. Built on a DARK warm-charcoal base (bg-rd-ink)
// with the team tint layered in only as a gradient/glow accent, so white text
// stays readable for ANY tint — from near-white team colors to near-black ones.
// Team pages pass their primaryColor; house pages can later pass charcoal.

export interface HeroProps {
  tint: string; // team primaryColor hex (e.g. "#002B5C"); may be any hex
  eyebrow?: React.ReactNode; // e.g. "MLB · AL Central"; the league may be a hub link
  title: string; // the lockup, e.g. "MINNESOTA TWINS"
  subtitle?: string; // e.g. "Promos & Giveaways 2026"
  venueLine?: string; // e.g. "Target Field · Minneapolis, MN"
  scoreboard?: React.ReactNode; // StatScoreboard slot
  primaryCta?: React.ReactNode; // red Get Tickets slot (already-wired CTA)
}

export function Hero(props: HeroProps) {
  const { tint, eyebrow, title, subtitle, venueLine, scoreboard, primaryCta } = props;

  return (
    <section className="relative overflow-hidden rounded-b-[2rem] bg-rd-ink text-white">
      {/* Thin solid tint accent bar along the top edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-20 h-1"
        style={{ backgroundColor: tint }}
      />

      {/* Tint overlay: diagonal wash + soft radial glow, kept at modest opacity
          so the team color reads without washing out the white text. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 opacity-70"
        style={{
          backgroundImage:
            `linear-gradient(135deg, ${tint} 0%, transparent 60%), ` +
            `radial-gradient(120% 80% at 100% 0%, ${tint}55 0%, transparent 70%)`,
        }}
      />

      {/* Bottom padding is tighter on the single-column view (mobile + tablet,
          < lg) so the dark hero doesn't leave an oversized empty band under the
          scoreboard before the calendar that now sits directly beneath it. At lg
          (the two-column desktop layout) it stays py-16 exactly — pt-16 + pb-16. */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-12 md:pt-16 pb-8 lg:pb-16">
        {eyebrow ? (
          <p className="font-rd text-[11px] uppercase tracking-[0.14em] text-white/60">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="rd-display mt-3 text-4xl uppercase text-white md:text-6xl">{title}</h1>

        {subtitle ? <p className="mt-3 text-lg text-white/75">{subtitle}</p> : null}

        {venueLine ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/55">
            <IconMapPin size={16} stroke={1.75} className="shrink-0" />
            <span>{venueLine}</span>
          </p>
        ) : null}

        {primaryCta ? <div className="mt-7">{primaryCta}</div> : null}

        {scoreboard ? <div className="mt-8">{scoreboard}</div> : null}
      </div>
    </section>
  );
}
