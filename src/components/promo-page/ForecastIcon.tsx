import type { ForecastIconKey } from '@/lib/forecast-label';

// The forecast row's condition glyph (step 5b): ten inline SVGs in the promo
// type-icon style (24-unit grid, currentColor stroke 2, round caps and
// joins), never NWS's own icons. Server component, decorative (the condition
// is printed beside it), so aria-hidden.
const PATHS: Record<ForecastIconKey, string> = {
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  'cloud-sun': 'M15 3v1.5M20.5 8.5H22M19.6 3.9l-1 1M12 8.5a3.5 3.5 0 0 1 6.5 1.8M4 20h9a3 3 0 0 0 .4-6 4.5 4.5 0 0 0-8.6 1.1A2.5 2.5 0 0 0 4 20z',
  'cloud-moon': 'M21.5 9.5A5.5 5.5 0 0 1 14 3.2 5.5 5.5 0 0 0 15.2 13M4 20h9a3 3 0 0 0 .4-6 4.5 4.5 0 0 0-8.6 1.1A2.5 2.5 0 0 0 4 20z',
  cloud: 'M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 18z',
  rain: 'M7 15h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15zM9 18l-1 3M13 18l-1 3M17 18l-1 3',
  snow: 'M7 15h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15zM9 19h.01M13 19h.01M17 19h.01M11 22h.01M15 22h.01',
  storm: 'M7 14h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 14zM13 14l-3 5h4l-2 4',
  fog: 'M5 10h14M4 14h16M6 18h12M9 6a5 5 0 0 1 8.5 1.5',
  wind: 'M3 10h11a2.5 2.5 0 1 0-2.5-2.5M3 14h15a2.5 2.5 0 1 1-2.5 2.5M3 18h7a2 2 0 1 1-2 2',
};

export function ForecastIcon({ icon, size = 18, className }: { icon: ForecastIconKey; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} data-forecast-icon={icon}>
      <path d={PATHS[icon]} />
    </svg>
  );
}
