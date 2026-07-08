import type { ReactNode } from 'react';

// Light-house league-hub hero. Warm charcoal (#1d1714) base carrying a brand-red
// (#d31145 = rgb 211,17,69) radial glow, matching the live /teams light hero.
// Server component; the stat bar is passed as children so it sits inside the
// dark band where white text reads. Importable so a second league hub reuses it.
export function HubHero({
  eyebrow,
  title,
  subtitle,
  freshness,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Honest freshness line. Not the playoffs "Updated hourly" copy: this hub
   *  revalidates on a 6h ISR window, so the caller states that cadence. */
  freshness?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
      <div
        aria-hidden
        className="absolute inset-0 z-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.18) 0%, transparent 60%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
        <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          {eyebrow}
        </p>
        <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-6xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl font-rd text-base text-white/65">{subtitle}</p>
        ) : null}
        {freshness ? (
          <p className="mt-3 font-rd text-[12px] text-white/45">{freshness}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
