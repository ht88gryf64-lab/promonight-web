import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { Bebas_Neue, DM_Sans, DM_Mono, Outfit } from 'next/font/google';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { UTMCaptureProvider } from '@/components/utm-capture-provider';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PageViewTracker } from '@/components/analytics/PageViewTracker';
import { AdProvider } from '@/components/ads/AdProvider';
import { StarredTeamsProvider } from '@/hooks/use-starred-teams';
import { ShareProvider } from '@/components/share';
import { PostStarToastHost } from '@/components/post-star-toast';
import { getPlayoffConfig } from '@/lib/data';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
});

// Outfit powers the affiliate CTA cluster (TicketmasterCTA, FanaticsCTA,
// SpotHeroCTA, BookingCTA) and the section H2s above it. Weight set covers
// what the cards need: 600 (CTA secondary text), 700 (Ticketmaster Get
// Tickets), 800 (brand wordmarks), 900 (Fanatics F badge + section H2s).
const outfit = Outfit({
  weight: ['600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.getpromonight.com'),
  title: {
    default: 'PromoNight: Pro Sports Giveaways, Theme Nights & Food Deals',
    template: '%s | PromoNight',
  },
  description:
    'PromoNight tracks every giveaway, theme night, and food deal across 167 teams in MLB, NBA, NFL, NHL, MLS, and WNBA. Never miss bobblehead night.',
  openGraph: {
    type: 'website',
    siteName: 'PromoNight',
    url: 'https://www.getpromonight.com',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromoNight — Every giveaway, every team',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@promo_night_app',
    creator: '@promo_night_app',
    images: ['/og-image.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fail-closed: if the config read throws (Firestore outage, perms, etc.),
  // hide the Playoffs link rather than 500-ing every page site-wide.
  let playoffsActive = false;
  try {
    const config = await getPlayoffConfig();
    playoffsActive = config?.playoffsActive === true;
  } catch (err) {
    console.error('getPlayoffConfig failed in layout:', err);
  }

  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable} ${outfit.variable}`}>
      <head>
        {/* Impact site verification. Spread bypasses React's typed prop
            check on <meta> so the attribute renders as `value=` exactly
            as Impact's verifier requires (it does not accept `content=`). */}
        <meta
          name="impact-site-verification"
          {...{ value: 'cd6719e8-e432-42a9-9ff5-1940dd89c019' }}
        />
      </head>
      <body className="relative">
        <div style={{ display: 'none' }} aria-hidden="true">
          Impact-Site-Verification: 0374f729-1b46-435a-8cf3-2f5ae8c12a0e
        </div>
        <AnalyticsProvider>
          <AdProvider>
            <StarredTeamsProvider>
              <ShareProvider>
                {/* useSearchParams inside PageViewTracker requires a Suspense
                    boundary during prerender — this scope covers it. */}
                <Suspense fallback={null}>
                  <PageViewTracker />
                </Suspense>
                <UTMCaptureProvider />
                <Nav playoffsActive={playoffsActive} />
                <main className="relative z-[1]">{children}</main>
                <Footer />
                <PostStarToastHost />
              </ShareProvider>
            </StarredTeamsProvider>
          </AdProvider>
        </AnalyticsProvider>
        <Script
          id="grow-me"
          data-grow-initializer=""
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!(function(){window.growMe||((window.growMe=function(e){window.growMe._.push(e);}),(window.growMe._=[]));var e=document.createElement("script");(e.type="text/javascript"),(e.src="https://faves.grow.me/main.js"),(e.defer=!0),e.setAttribute("data-grow-faves-site-id","U2l0ZTphZmY4ODEzZi02MzdhLTQ2YTMtYjg4YS02Yzg5NDdjZjYyYjA=");var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t);})();`,
          }}
        />
      </body>
    </html>
  );
}
