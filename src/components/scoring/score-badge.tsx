import type { CSSProperties } from 'react';

type ScoreBadgeProps = {
  score: number;
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
  // 'dark' (default) is the live badge, byte-identical when the gate is off.
  // 'light' is the cream-house treatment — same 0-100 semantics + high-to-low
  // brand-red cue (filled red / red-tint / muted), legible on white cards.
  variant?: 'dark' | 'light';
};

// Brand red for the scoring family (matches the scoring-page hero accent).
const SCORE_RED = '#d31145';

// Three-tier color band: 90+ filled brand red; 70-89 a quieter mid chip; below
// 70 plain muted text with no fill. Pure presentation, no hooks.
export function ScoreBadge({ score, size = 'md', className = '', style, variant = 'dark' }: ScoreBadgeProps) {
  const tier: 'hot' | 'warm' | 'cool' =
    score >= 90 ? 'hot' : score >= 70 ? 'warm' : 'cool';

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]';

  if (variant === 'light') {
    const colorClasses =
      tier === 'hot'
        ? 'text-white font-semibold'
        : tier === 'warm'
          ? 'font-semibold'
          : 'text-rd-ink-faint font-semibold';
    const colorStyle: CSSProperties =
      tier === 'hot'
        ? { backgroundColor: SCORE_RED }
        : tier === 'warm'
          ? { backgroundColor: `${SCORE_RED}1f`, color: SCORE_RED }
          : {};
    return (
      <span
        className={`inline-flex items-center rounded-full font-rd tabular-nums tracking-wide ${sizeClasses} ${colorClasses} ${className}`}
        aria-label={`Promo score: ${score} out of 100`}
        style={{ ...colorStyle, ...style }}
      >
        {score}
      </span>
    );
  }

  const colorClasses =
    tier === 'hot'
      ? 'bg-accent-red text-white'
      : tier === 'warm'
        ? 'bg-bg-card-hover text-white border border-border-subtle'
        : 'text-text-muted';

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono tracking-wide ${sizeClasses} ${colorClasses} ${className}`}
      aria-label={`Promo score: ${score} out of 100`}
      style={style}
    >
      {score}
    </span>
  );
}
