import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    // Mirror the server-only VERCEL_ENV into a client-readable variable so the
    // redesign gate (lib/redesign.ts) computes the SAME result on the client
    // (global-chrome suppression) as on the server (template branch). Empty
    // string when unset (local dev) → !== 'production' → gate on, matching the
    // server's `VERCEL_ENV !== 'production'`. NEXT_PUBLIC, carries no secret.
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? '',
  },
  async redirects() {
    return [
      {
        // Raptive hosts our ads.txt so their partner list stays current without
        // a deploy. public/ads.txt is deleted, not just shadowed: Next resolves
        // redirects before the public/ filesystem, so a file left here would
        // never serve and would rot into a false record of what we declare.
        // Both records it used to carry (google.com pub-8501674430909082 and
        // indexexchange.com 182496) were verified present, with matching
        // relationship values, in the hosted file before deleting it.
        //
        // statusCode: 301, not permanent: true. `permanent` emits 308, and
        // ads.txt crawlers are strict about the status they will follow;
        // Raptive asked for 301 specifically.
        source: '/ads.txt',
        destination:
          'https://ads.adthrive.com/sites/6a9989924f70265a058c50b1/ads.txt',
        statusCode: 301,
      },
      {
        source: '/privacy.html',
        destination: '/privacy',
        permanent: true,
      },
      {
        source: '/terms.html',
        destination: '/terms',
        permanent: true,
      },
      // Legacy and dead-path redirects - fixes GSC redirect-into-404 errors.
      // Each destination returns 200, so these are single-hop 308s (no chain).
      {
        source: '/promos',
        destination: '/promos/this-week',
        permanent: true,
      },
      {
        // Remove this redirect once /promos/fireworks is built as a real page.
        source: '/promos/fireworks',
        destination: '/promos/this-week',
        permanent: true,
      },
      {
        source: '/best-promos/jersey-giveaways',
        destination: '/promos/jersey-giveaways',
        permanent: true,
      },
      {
        source: '/best-promos/theme-nights',
        destination: '/promos/theme-nights',
        permanent: true,
      },
      {
        source: '/best-promos/fireworks',
        destination: '/promos/this-week',
        permanent: true,
      },
      {
        source: '/best-promos/food-deals',
        destination: '/promos/this-week',
        permanent: true,
      },
      {
        source: '/index',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
