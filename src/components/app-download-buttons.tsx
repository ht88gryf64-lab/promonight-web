import { TrackedAppLink } from './analytics-events';

export const IOS_APP_URL = 'https://apps.apple.com/us/app/promonight/id6761309246';
export const ANDROID_BETA_URL = 'https://play.google.com/apps/testing/com.promonight.app';

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
        href={ANDROID_BETA_URL}
        platform="android"
        section={section}
        page={page}
        className={`inline-flex items-center gap-2 bg-bg-card text-white font-bold rounded-xl border border-border-hover transition-all hover:-translate-y-0.5 hover:border-white ${sizing}`}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1.0001 0-.5509.4482-.9993.9993-.9993.5511 0 .9993.4484.9993.9993 0 .5515-.4482 1.0001-.9993 1.0001m-11.046 0c-.5511 0-.9993-.4486-.9993-1.0001 0-.5509.4482-.9993.9993-.9993.5511 0 .9993.4484.9993.9993 0 .5515-.4482 1.0001-.9993 1.0001m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396"/></svg>
        Android Beta
      </TrackedAppLink>
    </div>
  );
}
