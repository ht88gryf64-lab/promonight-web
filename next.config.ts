import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/download',
        destination: 'https://apps.apple.com/us/app/promonight/id6761309246',
        permanent: false,
      },
      {
        source: '/download/android',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
