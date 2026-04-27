// Single source of truth for which ad network is wired up. Read by AdProvider
// (loads the network's script) and AdSlot (decides whether to reserve space).
// Defaults to 'none' so dev environments and pre-approval production don't
// reserve dead boxes; flipping NEXT_PUBLIC_AD_NETWORK enables a network
// without code changes.
export type AdNetwork = 'adsense' | 'ezoic' | 'mediavine' | 'raptive' | 'none';

export function resolveAdNetwork(): AdNetwork {
  const raw = process.env.NEXT_PUBLIC_AD_NETWORK?.toLowerCase();
  if (
    raw === 'adsense' ||
    raw === 'ezoic' ||
    raw === 'mediavine' ||
    raw === 'raptive'
  ) {
    return raw;
  }
  return 'none';
}
