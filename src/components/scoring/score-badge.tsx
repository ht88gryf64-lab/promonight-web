import type { CSSProperties } from 'react';

type ScoreBadgeProps = {
  score: number;
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
};

// Three-tier color band, all within existing design-system tokens (no new
// colors): 90+ uses accent-red as a filled pill; 70-89 uses the existing
// subtle surface (bg-card-hover) for a quiet white-on-fill chip; below 70
// renders as plain muted text with no fill. Pure presentation, no hooks.
export function ScoreBadge({ score, size = 'md', className = '', style }: ScoreBadgeProps) {
  const tier: 'hot' | 'warm' | 'cool' =
    score >= 90 ? 'hot' : score >= 70 ? 'warm' : 'cool';

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]';

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
