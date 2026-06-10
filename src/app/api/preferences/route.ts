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
import { setSubscriberTeamsByManageToken } from '@/lib/subscribers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PreferencesBody {
  token?: unknown;
  teams?: unknown;
}

export async function POST(request: Request) {
  let body: PreferencesBody;
  try {
    body = (await request.json()) as PreferencesBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.token !== 'string' || body.token.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  }

  try {
    const result = await setSubscriberTeamsByManageToken(body.token, body.teams);
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
