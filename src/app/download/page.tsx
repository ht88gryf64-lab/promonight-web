import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { existsSync } from 'fs';
import { join } from 'path';
import { QrCode } from '@/components/qr-code';
import { TrackedAppLink } from '@/components/analytics-events';
import { IOS_APP_URL, ANDROID_BETA_URL } from '@/components/app-download-buttons';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Download PromoNight — iOS & Android Beta',
  description:
    'Download PromoNight on iOS or join the Android beta. Scan the QR code or tap a badge to install the app.',
  alternates: { canonical: 'https://www.getpromonight.com/download' },
};

export default async function DownloadPage() {
  const pushScreenshotExists = existsSync(
    join(process.cwd(), 'public', 'screenshots', 'push.png'),
  );
  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Download
          </span>
          <h1 className="font-display text-4xl md:text-6xl tracking-[1px] mt-2">
            GET PROMONIGHT
          </h1>
          <p className="text-text-secondary text-base md:text-lg mt-4 max-w-2xl mx-auto">
            Every giveaway, theme night, and food deal across MLB, NBA, NHL, NFL, MLS, and WNBA. Free to download. Pro tier adds push notifications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-10 md:gap-16 items-center">
          {/* iOS column */}
          <div className="text-center">
            <QrCode value={IOS_APP_URL} size={200} caption="Scan for iOS" />
          </div>

          <div className="space-y-6">
            <div>
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2">
                iOS
              </div>
              <h2 className="font-display text-3xl tracking-[1px] mb-3">
                DOWNLOAD ON THE APP STORE
              </h2>
              <p className="text-text-secondary text-sm mb-5">
                On your phone? Tap the button. On desktop? Point your phone camera at the QR code.
              </p>
              <TrackedAppLink
                href={IOS_APP_URL}
                platform="ios"
                section="download_page"
                page="download"
                className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-[15px] px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Download for iOS
              </TrackedAppLink>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-10 md:gap-16 items-center mt-16 pt-16 border-t border-border-subtle">
          {/* Android column */}
          <div className="text-center">
            <QrCode value={ANDROID_BETA_URL} size={200} caption="Scan for Android beta" />
          </div>

          <div className="space-y-6">
            <div>
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2">
                Android &middot; Closed beta
              </div>
              <h2 className="font-display text-3xl tracking-[1px] mb-3">
                JOIN THE ANDROID BETA
              </h2>
              <p className="text-text-secondary text-sm mb-2">
                The Android version is in closed testing. It&apos;s open to all testers right now. Tap the button, accept the beta invite, then install from Google Play.
              </p>
              <p className="text-text-muted text-xs font-mono tracking-[0.5px] mb-5">
                Beta builds may have rough edges. Feedback lands at hello@getpromonight.com.
              </p>
              <Link
                href={ANDROID_BETA_URL}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 bg-bg-card text-white font-bold text-[15px] px-7 py-3.5 rounded-xl border border-border-hover transition-all hover:-translate-y-0.5 hover:border-white"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1.0001 0-.5509.4482-.9993.9993-.9993.5511 0 .9993.4484.9993.9993 0 .5515-.4482 1.0001-.9993 1.0001m-11.046 0c-.5511 0-.9993-.4486-.9993-1.0001 0-.5509.4482-.9993.9993-.9993.5511 0 .9993.4484.9993.9993 0 .5515-.4482 1.0001-.9993 1.0001m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396"/></svg>
                Join the Android beta
              </Link>
            </div>
          </div>
        </div>

        {/* Push notification screenshot */}
        <div className="mt-20 pt-16 border-t border-border-subtle">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center">
              <div className="relative w-full max-w-[280px] aspect-[9/19.5] rounded-[36px] p-[3px] bg-gradient-to-br from-[#2a2c38] via-[#18191f] to-[#0e1017] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
                <div className="absolute inset-0 rounded-[36px] border border-white/5 pointer-events-none" />
                <div className="relative w-full h-full rounded-[33px] overflow-hidden bg-[#060810]">
                  {pushScreenshotExists ? (
                    <Image
                      src="/screenshots/push.png"
                      alt="PromoNight push notification: Bobblehead night tonight at Target Field"
                      fill
                      sizes="(max-width: 768px) 80vw, 280px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-start pt-24 bg-gradient-to-b from-[#060810] to-[#0e1017] p-5">
                      <div className="w-full bg-bg-card/95 border border-border-subtle rounded-2xl p-3 flex items-start gap-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-accent-red flex items-center justify-center text-sm">🏆</div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-[9px] tracking-[0.5px] uppercase text-white">PromoNight</div>
                            <div className="font-mono text-[9px] text-text-dim">now</div>
                          </div>
                          <div className="text-[11px] text-white leading-snug mt-1">
                            Bobblehead night tonight at Target Field
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
                PromoNight Pro
              </span>
              <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-2 mb-4">
                NEVER FORGET A PROMO DAY
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                Pro notifies you the morning of every promotional event for teams you follow. So you see &ldquo;Bobblehead night tonight at Target Field&rdquo; when you&apos;re deciding what to do after work, not after the game.
              </p>
              <p className="text-text-muted text-xs font-mono tracking-[0.5px]">
                $5.99 per season per sport &middot; $9.99 per year for all sports
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
