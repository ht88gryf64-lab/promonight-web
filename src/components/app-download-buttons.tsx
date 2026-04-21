import Image from 'next/image';
import { TrackedAppLink } from './analytics-events';

export const IOS_APP_URL = 'https://apps.apple.com/us/app/promonight/id6761309246';
export const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.promonight.app';

export function AppDownloadButtons({
  section,
  page,
  variant = 'default',
}: {
  section: string;
  page: string;
  variant?: 'default' | 'compact';
}) {
  const sizing =
    variant === 'compact'
      ? 'text-sm px-6 py-3'
      : 'text-[15px] px-7 py-3.5';

  const badgeHeight = variant === 'compact' ? 44 : 52;

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <TrackedAppLink
        href="/download"
        platform="ios"
        section={section}
        page={page}
        className={`inline-flex items-center gap-2 bg-accent-red text-white font-bold rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] ${sizing}`}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Download for iOS
      </TrackedAppLink>
      <TrackedAppLink
        href={ANDROID_APP_URL}
        platform="android"
        section={section}
        page={page}
        className="inline-flex items-center transition-all hover:-translate-y-0.5"
      >
        <Image
          src="/google-play-badge.png"
          alt="Get it on Google Play"
          width={badgeHeight * (646 / 250)}
          height={badgeHeight}
          unoptimized
          priority={false}
        />
      </TrackedAppLink>
    </div>
  );
}
