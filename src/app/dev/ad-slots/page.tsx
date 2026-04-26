import { notFound } from 'next/navigation';
import { AD_SLOTS, type AdSlotConfig } from '@/lib/ads/slots';
import { AdSlot } from '@/components/ads/AdSlot';

// Dev-only inventory of every configured ad slot. Not exposed in production
// builds — useful for spot-checking layout, breakpoint visibility, and
// lazy-load behavior without hunting through page templates.
export default function AdSlotsDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const entries = Object.entries(AD_SLOTS) as [string, AdSlotConfig][];

  return (
    <div className="pt-28 pb-20 px-6 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl md:text-4xl tracking-[1px] mb-2">
        AD SLOT REGISTRY (DEV)
      </h1>
      <p className="text-text-secondary text-sm mb-8">
        Every slot defined in <code>src/lib/ads/slots.ts</code>. Resize the
        browser to see breakpoint behavior. Slots without a size for the
        current breakpoint render nothing.
      </p>

      <table className="w-full text-sm border-collapse mb-12">
        <thead>
          <tr className="border-b border-border-subtle text-left font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted">
            <th className="py-2 pr-4">Key</th>
            <th className="py-2 pr-4">ID</th>
            <th className="py-2 pr-4">Desktop</th>
            <th className="py-2 pr-4">Tablet</th>
            <th className="py-2 pr-4">Mobile</th>
            <th className="py-2 pr-4">Lazy</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, config]) => (
            <tr key={key} className="border-b border-border-subtle text-text-secondary">
              <td className="py-2 pr-4 font-mono text-xs">{key}</td>
              <td className="py-2 pr-4 font-mono text-xs">{config.id}</td>
              <td className="py-2 pr-4">{fmtSize(config.sizes.desktop)}</td>
              <td className="py-2 pr-4">{fmtSize(config.sizes.tablet)}</td>
              <td className="py-2 pr-4">{fmtSize(config.sizes.mobile)}</td>
              <td className="py-2 pr-4">{config.lazyLoad ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-display text-2xl tracking-[1px] mb-4">LIVE PREVIEW</h2>
      <div className="space-y-8">
        {entries.map(([key, config]) => (
          <section key={key}>
            <h3 className="font-mono text-xs text-text-muted mb-2">{key}</h3>
            <AdSlot config={config} pageType="dev_preview" />
          </section>
        ))}
      </div>
    </div>
  );
}

function fmtSize(size?: { w: number; h: number }): string {
  if (!size) return '—';
  return `${size.w}×${size.h}`;
}
