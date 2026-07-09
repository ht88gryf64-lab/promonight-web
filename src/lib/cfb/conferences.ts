// Single source of truth for the CFB conference buckets + their URL slugs.
// Dependency-free (no server imports) so BOTH the client pro-browser conference
// sub-row (team-grid / teams-browser) AND the server hub (hub-data.ts,
// CfbHubBrowse) can import it without dragging in firebase-admin. The bucket
// NAMES here are the same 6 the hub renders; hub-data.ts imports the order from
// here so the two never drift.

export const CFB_CONF_BUCKET_ORDER = [
  'SEC',
  'Big Ten',
  'ACC',
  'Big 12',
  'Group of 5',
  'Independents',
] as const;

export type CfbConfBucket = (typeof CFB_CONF_BUCKET_ORDER)[number];

// Bucket -> URL slug (used in /cfb?conf=<slug> deep links). Kebab-case, stable.
export const CFB_CONF_SLUG: Record<CfbConfBucket, string> = {
  SEC: 'sec',
  'Big Ten': 'big-ten',
  ACC: 'acc',
  'Big 12': 'big-12',
  'Group of 5': 'group-of-5',
  Independents: 'independents',
};

// The sub-row entries (bucket + slug), in display order.
export const CFB_CONFERENCES: { bucket: CfbConfBucket; slug: string }[] =
  CFB_CONF_BUCKET_ORDER.map((bucket) => ({ bucket, slug: CFB_CONF_SLUG[bucket] }));

// Reverse: a ?conf=<slug> value -> the bucket name the hub filter uses. Returns
// null for a missing/unknown slug (the hub then shows all conferences).
export function bucketForConfSlug(slug: string | null | undefined): CfbConfBucket | null {
  if (!slug) return null;
  const want = slug.toLowerCase();
  const match = CFB_CONFERENCES.find((c) => c.slug === want);
  return match ? match.bucket : null;
}
