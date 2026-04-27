import Script from 'next/script';
import { resolveAdNetwork } from '@/lib/ads/network';

// Injects the configured ad network's loader script at the document root.
// Network resolution is shared with AdSlot via lib/ads/network so a single
// env var (NEXT_PUBLIC_AD_NETWORK) controls both whether the loader runs
// and whether slots reserve space. Defaults to 'none'.
export function AdProvider({ children }: { children: React.ReactNode }) {
  const network = resolveAdNetwork();

  if (network === 'adsense') {
    const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
    if (pubId) {
      return (
        <>
          <Script
            id="adsense-loader"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${pubId}`}
          />
          {children}
        </>
      );
    }
  }

  // Other networks (Ezoic, Mediavine, Raptive) wire their loaders here once
  // approved. Until then, fall through to a no-op provider.
  return <>{children}</>;
}
