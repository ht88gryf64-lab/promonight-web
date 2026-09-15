import { resolveAdsTxt } from '@/lib/ads-txt';

/**
 * /ads.txt, proxied from Raptive's hosted file.
 *
 * Why a proxy and not a redirect: Google's ads.txt crawler starts at the apex,
 * and our apex is a Vercel project-domain 308 to www resolved at the edge
 * before this app runs. A redirect here would sit BEHIND that hop, putting the
 * crawler's own starting point two redirects from the file. A proxy answers
 * 200 on www, so the apex stays at the single hop it has always had, and we
 * still get Raptive's current partner list without a deploy. See known-issues
 * entry 47.
 *
 * Why not `public/ads.txt`: a static file at that path SHADOWS this route. It
 * was measured, not assumed — with both present the file wins and this handler
 * never executes. The snapshot therefore lives in src/lib/ads-txt-fallback.ts.
 *
 * Statically generated and revalidated hourly, so crawler volume does not reach
 * Raptive and our response time does not depend on theirs. A consequence worth
 * knowing: the first render happens at BUILD time, so if Raptive is unreachable
 * during a build we publish the snapshot and self-heal at the next revalidate.
 */
// MUST be a literal. Next.js statically analyses route segment config and
// rejects the build outright if this is an imported binding
// ("can't recognize the exported `config` field"), which is how the first
// attempt at this file failed. It is kept in step with
// ADS_TXT_REVALIDATE_SECONDS by a test rather than by a shared import.
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const result = await resolveAdsTxt();

  if (result.source === 'fallback') {
    // Visible in Vercel runtime logs. Serving the snapshot is the designed
    // behavior, not an incident, but it is silent otherwise and silence here
    // means nobody learns the partner list has stopped updating.
    console.warn(`[ads.txt] serving committed snapshot: ${result.reason}`);
  }

  return new Response(result.body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Which path produced THIS body, and when the handler actually ran.
      // Because the route is cached, a repeated timestamp across two requests
      // is proof the handler did not re-execute and upstream was not re-hit.
      'x-ads-txt-source': result.source,
      'x-ads-txt-reason': result.reason,
      'x-ads-txt-resolved-at': new Date().toISOString(),
    },
  });
}
