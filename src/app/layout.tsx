import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Bebas_Neue, DM_Sans, DM_Mono, Outfit } from 'next/font/google';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { isRedesignEnabled } from '@/lib/redesign';
import { isWorldCupActive } from '@/lib/world-cup-active';
import { RedesignBrandBar, RedesignFooterSlot, RedesignAnnouncementSlot } from '@/components/redesign/GlobalChrome';
import { UTMCaptureProvider } from '@/components/utm-capture-provider';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PageViewTracker } from '@/components/analytics/PageViewTracker';
import { AdProvider } from '@/components/ads/AdProvider';
import { StarredTeamsProvider } from '@/hooks/use-starred-teams';
import { ShareProvider } from '@/components/share';
import { PostStarToastHost } from '@/components/post-star-toast';
import { getPlayoffConfig } from '@/lib/data';
import { getCoverageCounts } from '@/lib/get-coverage-counts';
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
// SpotHeroCTA, ExpediaCTA) and the section H2s above it. Weight set covers
// what the cards need: 600 (CTA secondary text), 700 (Ticketmaster Get
// Tickets), 800 (brand wordmarks), 900 (Fanatics F badge + section H2s).
const outfit = Outfit({
  weight: ['600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-outfit-sans',
  display: 'swap',
});

// generateMetadata rather than a static export so the sitewide description
// derives its team count and league list from the same read every page body
// uses; the literal "169 teams in MLB, ..." it replaced had no alarm for the
// day the collection moves.
export async function generateMetadata(): Promise<Metadata> {
  const c = await getCoverageCounts();
  return {
    metadataBase: new URL('https://www.getpromonight.com'),
    // The default title deliberately carries no category-page head terms
    // ("Theme Nights", "Food Deals"): those made Google test the homepage
    // against queries /promos/theme-nights and /promos/food-deals should own,
    // splitting signal both ways. Brand + the winnable niche only.
    title: {
      default: 'PromoNight: Pro Sports Giveaway & Promo Night Tracker',
      template: '%s | PromoNight',
    },
    description:
      `PromoNight tracks every giveaway, theme night, and food deal across ${c.teamCount} teams in ${c.leagueList}. Never miss bobblehead night.`,
    openGraph: {
      type: 'website',
      siteName: 'PromoNight',
      url: 'https://www.getpromonight.com',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'PromoNight: Every giveaway, every team',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@promo_night_app',
      creator: '@promo_night_app',
      images: ['/og-image.png'],
    },
    // FlexOffers affiliate-network site ownership verification.
    other: {
      'fo-verify': 'b823c9f6-a5b9-4492-9bac-65ea29c2cd38',
    },
  };
}

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

  // Global chrome gate (server-side, matching the team-page template branch).
  // When ON, the light BrandBar/Footer are the chrome on EVERY page; when OFF
  // the layout renders the old dark Nav/Footer exactly as before. The chrome's
  // Archivo instance is preload:false (see GlobalChrome) so this global mount
  // adds no font-preload <link> to any page and gate-off <head> stays identical.
  const redesign = isRedesignEnabled();
  // Server-evaluated so the strip and nav link auto-expire after the final
  // (within one ISR revalidate). Not gated on the redesign: redesign is live.
  const worldCupActive = isWorldCupActive();

  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable} ${outfit.variable}`}>
      <head>
        <script
          data-grow-initializer=""
          dangerouslySetInnerHTML={{
            __html: `!(function(){window.growMe||((window.growMe=function(e){window.growMe._.push(e);}),(window.growMe._=[]));var e=document.createElement("script");(e.type="text/javascript"),(e.src="https://faves.grow.me/main.js"),(e.defer=!0),e.setAttribute("data-grow-faves-site-id","U2l0ZTphZmY4ODEzZi02MzdhLTQ2YTMtYjg4YS02Yzg5NDdjZjYyYjA=");var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t);})();`,
          }}
        />
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
                {worldCupActive && <RedesignAnnouncementSlot />}
                {redesign ? (
                  <RedesignBrandBar playoffsActive={playoffsActive} worldCupActive={worldCupActive} />
                ) : (
                  <Nav playoffsActive={playoffsActive} />
                )}
                <main className="relative z-[1]">{children}</main>
                {redesign ? <RedesignFooterSlot /> : <Footer />}
                <PostStarToastHost />
              </ShareProvider>
            </StarredTeamsProvider>
          </AdProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
