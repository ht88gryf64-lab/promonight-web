import { notFound } from 'next/navigation';
import { getAllTeams } from '@/lib/data';
import {
  buildTicketmasterUrl,
  buildTicketNetworkLink,
  ticketNetworkLandingUrl,
  isPartnerActive,
  TICKET_VENDOR,
} from '@/lib/affiliates';

export const dynamic = 'force-dynamic';

// Dev-only spot-check page for the ticket CTA URL builders. Renders one row per
// team with its generated outbound URLs (Ticketmaster per-surface + the
// TicketNetwork landing/tracked link), the slug used, and whether the
// Ticketmaster Impact wrap env var is wired. Use to eyeball a sample of URLs
// before pushing changes to the URL builders.
//
// Gated to non-production via NODE_ENV. The page is also unindexed (the dev/
// directory is excluded from the sitemap and robots), but the runtime gate
// is the load-bearing one.
export default async function AffiliateCheckPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const teams = await getAllTeams();
  const wrapActive = isPartnerActive('ticketmaster');
  const wrapTemplate = process.env.NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP ?? '';

  const surfaces = ['web_team_page', 'web_promo_detail', 'web_playoffs', 'web_home'] as const;
  type Surface = (typeof surfaces)[number];

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', color: '#0a0a0a', background: '#fff' }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Affiliate URL spot-check</h1>

      <section style={{ marginBottom: 24, padding: 16, border: '1px solid #ddd', borderRadius: 6 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ticket CTA vendors</h2>
        <p>
          The ticket CTA renders <strong>both vendors stacked</strong> across all surfaces —
          Ticketmaster on top, TicketNetwork below — each firing{' '}
          <code>affiliate_click</code> with its own <code>partner</code> value.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>TICKET_VENDOR (legacy):</strong>{' '}
          <span style={{ color: TICKET_VENDOR === 'ticketnetwork' ? '#0a7d3a' : '#9a4400' }}>
            {TICKET_VENDOR}
          </span>{' '}
          — historical sole-vendor switch in <code>src/lib/affiliates.ts</code>; no longer gates
          rendering now that both vendors render.
        </p>
      </section>

      <section style={{ marginBottom: 24, padding: 16, border: '1px solid #ddd', borderRadius: 6 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ticketmaster wrap status</h2>
        <p>
          <strong>NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP:</strong>{' '}
          {wrapActive ? (
            <span style={{ color: '#0a7d3a' }}>set ({wrapTemplate.length} chars)</span>
          ) : (
            <span style={{ color: '#9a4400' }}>
              unset — URLs fall back to direct ticketmaster.com links (no commission)
            </span>
          )}
        </p>
        {wrapActive && (
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 8 }}>
            {wrapTemplate}
          </pre>
        )}
      </section>

      <p style={{ fontSize: 12, color: '#444', marginBottom: 12 }}>
        {teams.length} teams. Each row shows the URL each team would receive on each surface. Click
        any URL to spot-check the destination.
      </p>

      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th style={cellStyle}>league</th>
            <th style={cellStyle}>team</th>
            <th style={cellStyle}>internal slug</th>
            <th style={cellStyle}>tm slug override</th>
            <th style={cellStyle}>tn landing (resolved)</th>
            <th style={cellStyle}>tn tracked (web_team_page)</th>
            {surfaces.map((s) => (
              <th key={s} style={cellStyle}>
                tm: {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td style={cellStyle}>{t.league}</td>
              <td style={cellStyle}>
                {t.city} {t.name}
              </td>
              <td style={cellStyle}>{t.id}</td>
              <td style={cellStyle}>{t.ticketmasterSlug ?? '—'}</td>
              <td style={cellStyle}>{ticketNetworkLandingUrl(t) ?? '—'}</td>
              <td style={cellStyle}>
                {(() => {
                  const tn = buildTicketNetworkLink({ team: t, surface: 'web_team_page' });
                  return tn ? (
                    <a
                      href={tn}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#024BAA', wordBreak: 'break-all' }}
                    >
                      {tn}
                    </a>
                  ) : (
                    '—'
                  );
                })()}
              </td>
              {surfaces.map((s) => {
                const url = buildTicketmasterUrl({
                  teamSlug: t.id,
                  ticketmasterSlug: t.ticketmasterSlug,
                  surface: s as Surface,
                });
                return (
                  <td key={s} style={cellStyle}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#024BAA', wordBreak: 'break-all' }}
                    >
                      {url}
                    </a>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 11, color: '#888', marginTop: 16 }}>
        SeatGeek and StubHub columns were retired on 2026-05-03 alongside the dual-CTA. The
        builders remain in <code>src/lib/affiliates.ts</code> marked <code>@deprecated</code> but
        are no longer rendered by any user-facing surface.
      </p>
    </main>
  );
}

const cellStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
};
