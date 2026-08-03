/**
 * POST /api/preferences  { token: <manageToken>, teams: string[] }
 *
 * Token-authenticated team management from the preferences page. SETS the teams
 * array to exactly the submitted selection (replace, not the capture-path
 * merge): removals persist and an empty array is allowed, reverting the
 * subscriber to the generic list. Saving one or more migrates to personalized
 * automatically (the array length is the only signal, read at send time).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { setSubscriberTeamsByManageToken } from '@/lib/subscribers';
import { MANAGE_COOKIE } from '@/lib/manage-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PreferencesBody {
  teams?: unknown;
}

export async function POST(request: Request) {
  // THE CREDENTIAL COMES FROM THE COOKIE AND ONLY FROM THE COOKIE.
  //
  // This route used to take the manage token from the JSON body, which meant
  // the client had to hold it, which meant it was in the page URL to get there.
  // Reading it here instead has a second effect worth naming: the cookie is
  // sameSite lax, so it is not sent on a cross-site POST. This endpoint had NO
  // CSRF defence before (no token, no Origin or Referer check, and middleware
  // excludes api/), so the exchange closes a cross-site write path as well as
  // the disclosure one.
  //
  // Unlike /api/unsubscribe there is deliberately NO query-string fallback: no
  // mail provider ever calls this route, so accepting a URL credential here
  // would reopen the exposure for nobody's benefit.
  const token = (await cookies()).get(MANAGE_COOKIE)?.value ?? '';
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 });
  }

  let body: PreferencesBody;
  try {
    body = (await request.json()) as PreferencesBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const result = await setSubscriberTeamsByManageToken(token, body.teams);
    if (!result.found) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      team_count: result.teams.length,
      personalized: result.teams.length > 0,
    });
  } catch (e) {
    console.error(`[api:preferences] ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
