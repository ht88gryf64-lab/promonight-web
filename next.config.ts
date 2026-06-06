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
