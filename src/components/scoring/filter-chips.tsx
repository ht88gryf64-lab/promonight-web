'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type FilterChipOption<T extends string> = {
  value: T;
  label: string;
};

type FilterChipsProps<T extends string> = {
  // Search-param key this filter writes to. The component is the single
  // source of truth for that param on the page.
  paramKey: string;
  options: readonly FilterChipOption<T>[];
  // When the user selects this value, the param is removed entirely (clean
  // URLs when the user is on the default view). For chips like league
  // ("All") and date range ("90d") the default is implicit.
  defaultValue: T;
  ariaLabel?: string;
  // Fires before the URL update so callers can emit a typed analytics
  // event with the from/to values. Optional; pages that don't need
  // tracking can skip it.
  onChange?: (from: T, to: T) => void;
};

export function FilterChips<T extends string>({
  paramKey,
  options,
  defaultValue,
  ariaLabel,
  onChange,
}: FilterChipsProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get(paramKey) || defaultValue) as T;

  const handleClick = (next: T) => {
    if (next === current) return;
    // Fire the analytics callback first so the from/to values reflect
    // the chip transition cleanly. The URL update then triggers the
    // page to re-render with the new filter.
    onChange?.(current, next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultValue) {
      params.delete(paramKey);
    } else {
      params.set(paramKey, next);
    }
    const qs = params.toString();
    // scroll: false so changing filters doesn't reset the user's scroll
    // position. Replace rather than push so the browser back stack stays
    // clean (filter changes aren't navigation events).
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleClick(opt.value)}
            aria-pressed={active}
            className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
              active
                ? 'bg-accent-red text-white border-accent-red'
                : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
