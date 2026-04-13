import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getTeamBySlug, getTeamPromos } from '@/lib/data';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const teamSlug = request.nextUrl.searchParams.get('team');

  if (!teamSlug) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#060810',
            color: '#fff',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 900, display: 'flex' }}>
            <span>PROMO</span>
            <span style={{ color: '#ef4444' }}>NIGHT</span>
          </div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 16 }}>
            Every giveaway, theme night & food deal
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    return new Response('Team not found', { status: 404 });
  }

  const promos = await getTeamPromos(team.id);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          backgroundColor: '#060810',
          color: '#fff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Team color accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
          }}
        />

        {/* Top: branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 900, display: 'flex' }}>
            <span>PROMO</span>
            <span style={{ color: '#ef4444' }}>NIGHT</span>
          </div>
          <div
            style={{
              fontSize: 14,
              color: team.primaryColor,
              backgroundColor: `${team.primaryColor}20`,
              border: `1px solid ${team.primaryColor}40`,
              borderRadius: 50,
              padding: '4px 12px',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {team.league}
          </div>
        </div>

        {/* Center: team info */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.95, letterSpacing: 2 }}>
            {team.city.toUpperCase()}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.95, letterSpacing: 2, color: team.primaryColor }}>
            {team.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 32, color: '#888', marginTop: 16, letterSpacing: 1 }}>
            2026 PROMO SCHEDULE
          </div>
        </div>

        {/* Bottom: stats */}
        <div style={{ display: 'flex', gap: 40, color: '#888', fontSize: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontSize: 36, fontWeight: 900 }}>{promos.length}</span>
            <span>Promos</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#34d399', fontSize: 36, fontWeight: 900 }}>
              {promos.filter((p) => p.type === 'giveaway').length}
            </span>
            <span>Giveaways</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#a78bfa', fontSize: 36, fontWeight: 900 }}>
              {promos.filter((p) => p.type === 'theme').length}
            </span>
            <span>Theme Nights</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
