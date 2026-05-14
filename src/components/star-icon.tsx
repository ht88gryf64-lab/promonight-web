type StarIconProps = {
  filled: boolean;
  size?: number;
  surface?: 'light' | 'dark';
};

export function StarIcon({ filled, size = 16, surface = 'light' }: StarIconProps) {
  const strokeColor = filled
    ? '#FBBF24'
    : surface === 'dark'
      ? 'rgba(255,255,255,0.45)'
      : '#000';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2L14.85 8.63L22 9.27L16.5 14.14L18.18 21.02L12 17.27L5.82 21.02L7.5 14.14L2 9.27L9.15 8.63L12 2Z"
        fill={filled ? '#FBBF24' : 'none'}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
