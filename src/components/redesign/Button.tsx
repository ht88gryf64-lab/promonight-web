import Link from 'next/link';
import type { ReactNode } from 'react';

// Redesign v2 button primitive. Presentational and polymorphic: renders a
// next/link for internal hrefs, a plain <a> for external hrefs, or a <button>
// when no href is given. Shared by the redesigned team-page components so the
// visual language (radius, weight, brand red) stays consistent.

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-rd font-semibold ' +
  'tracking-[-0.01em] transition-colors disabled:opacity-50 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-[var(--color-rd-red)] focus-visible:ring-offset-[var(--color-rd-cream)]';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-rd-red text-white hover:bg-rd-red-dark',
  secondary:
    'bg-rd-card text-rd-ink border border-rd-line-strong hover:border-rd-ink hover:bg-rd-cream',
  ghost: 'bg-transparent text-rd-ink-soft hover:text-rd-ink hover:bg-rd-line',
};

const SIZES: Record<Size, string> = {
  sm: 'text-[13px] px-3.5 py-2',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-6 py-3.5',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps & {
  href?: undefined;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  'aria-label'?: string;
};

type LinkProps = CommonProps & {
  href: string;
  external?: boolean;
  target?: string;
  rel?: string;
  onMouseDown?: () => void;
  'aria-label'?: string;
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', fullWidth, className = '', children } = props;
  const cls = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  if ('href' in props && props.href !== undefined) {
    const { href, external, target, rel, onMouseDown } = props;
    const isExternal = external ?? /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a
          href={href}
          target={target ?? '_blank'}
          rel={rel ?? 'noopener noreferrer'}
          onMouseDown={onMouseDown}
          aria-label={props['aria-label']}
          className={cls}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} aria-label={props['aria-label']}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      className={cls}
    >
      {children}
    </button>
  );
}
