import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Reads Vercel's edge geo headers and returns the visitor's country/region
// codes. The IP itself is never read or stored — only the derived country and
// region codes are exposed, and only for the lifetime of the response.
//
// `force-dynamic` prevents this route from being cached: we want each request
// to read its own incoming geo headers. Response is short-cached on the client
// for ~24h via localStorage in <TeamGrid>.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const h = await headers();
  return NextResponse.json({
    country: h.get('x-vercel-ip-country') ?? null,
    region: h.get('x-vercel-ip-country-region') ?? null,
  });
}
