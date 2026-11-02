import { robotsTxt } from '@/lib/robots-txt';

// A route handler, not app/robots.ts, so the line order in each group is ours
// (see src/lib/robots-txt.ts). force-static: built once, served from the CDN.
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(robotsTxt(), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
