import type { ReactNode } from 'react';

// Light-house league-hub hero. Warm charcoal (#1d1714) base carrying a radial
// accent glow, matching the live /teams light hero. The glow hue is the league's
// locked house-palette accent (LEAGUE_HUB_REGISTRY), passed by the caller, so
// each hub reads in its own color while the geometry and subtlety stay constant.
// Server component; the stat bar is passed as children so it sits inside the
// dark band where white text reads. Importable so a second league hub reuses it.

// Converts a #rrggbb accent to the low-alpha rgba() the glow uses, so the accent
// stays a single hex constant in the registry rather than a duplicated rgba.
function glowRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function HubHero({
  eyebrow,
  title,
  subtitle,
  freshness,
  accent = '#d31145',
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Honest freshness line. Not the playoffs "Updated hourly" copy: this hub
   *  revalidates on a 6h ISR window, so the caller states that cadence. */
  freshness?: string;
  /** League house-palette accent (#rrggbb) for the hero glow. Defaults to the
   *  original brand red when unset. */
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
      <div
        aria-hidden
        className="absolute inset-0 z-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${glowRgba(accent, 0.18)} 0%, transparent 60%)`,
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
