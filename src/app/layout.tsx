import type { Metadata } from 'next';
import Script from 'next/script';
import { Bebas_Neue, DM_Sans, DM_Mono } from 'next/font/google';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { GA_MEASUREMENT_ID } from '@/lib/analytics';
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

export const metadata: Metadata = {
  metadataBase: new URL('https://getpromonight.com'),
  title: {
    default: 'PromoNight — Every Giveaway, Theme Night & Food Deal at Your Team\'s Games',
    template: '%s | PromoNight',
  },
  description:
    'Track every bobblehead giveaway, theme night, food deal, and promotion across 167 teams in MLB, NBA, NHL, NFL, MLS, and WNBA. Free app for iOS and Android.',
  openGraph: {
    type: 'website',
    siteName: 'PromoNight',
  },
  twitter: {
    card: 'summary_large_image',
  },
  other: {
    'impact-site-verification': 'fe7143b6-ec57-416e-afa7-a4e85008ce9a',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="relative">
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    send_page_view: true,
                    debug_mode: ${process.env.NODE_ENV === 'development'}
                  });
                `,
              }}
            />
          </>
        )}
        <Nav />
        <main className="relative z-[1]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
