import Script from 'next/script';

type AdNetwork = 'adsense' | 'ezoic' | 'mediavine' | 'raptive' | 'none';

function resolveNetwork(): AdNetwork {
  const raw = process.env.NEXT_PUBLIC_AD_NETWORK?.toLowerCase();
  if (raw === 'adsense' || raw === 'ezoic' || raw === 'mediavine' || raw === 'raptive') {
    return raw;
  }
  return 'none';
}

// Injects the configured ad network's loader script at the document root.
// Defaults to 'none' so dev environments and pre-approval production show
// only AdSlot placeholders; flipping NEXT_PUBLIC_AD_NETWORK enables a network
// without code changes.
export function AdProvider({ children }: { children: React.ReactNode }) {
  const network = resolveNetwork();

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
