import type { Metadata } from 'next';
import { getAllTeams } from '@/lib/data';
import { getSubscriberByManageToken } from '@/lib/subscribers';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { PreferencesForm } from '@/components/follow/PreferencesForm';

// Token-authenticated preferences page. Never indexed, never cached: the URL
// carries a per-subscriber manage token. Global chrome (brand bar + footer)
// comes from the root layout; this renders the charcoal hero + cream body in
// the light-house scope, matching /follow.
export const metadata: Metadata = {
  title: 'Manage Your Teams',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#1d1714' }}>
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(120% 80% at 100% 0%, rgba(211,17,69,0.22) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-2xl px-6 pb-12 pt-16 md:pb-14 md:pt-20">
          <p
            className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: '#ff5a78' }}
          >
            Your subscription
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-5xl">
            Manage your teams
          </h1>
        </div>
      </section>
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-8">{children}</div>
    </div>
  );
}

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; confirmed?: string; unsub?: string }>;
}) {
  const { token, confirmed, unsub } = await searchParams;
  const subscriber =
    typeof token === 'string' ? await getSubscriberByManageToken(token) : null;

  if (!subscriber) {
    return (
      <Shell>
        <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
          <h2 className="rd-display text-2xl uppercase text-rd-ink">Link not valid</h2>
          <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
            This management link is missing or expired. Open the latest PromoNight
            email, or{' '}
            <a href="/follow" className="font-semibold text-rd-red underline">
              sign up again
            </a>
            .
          </p>
        </div>
      </Shell>
    );
  }

  if (subscriber.status === 'unsubscribed') {
    return (
      <Shell>
        <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
          <h2 className="rd-display text-2xl uppercase text-rd-ink">You&apos;re unsubscribed</h2>
          <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
            {subscriber.email} is no longer receiving PromoNight emails. Changed your
            mind?{' '}
            <a href="/follow" className="font-semibold text-rd-red underline">
              Re-subscribe
            </a>
            .
          </p>
        </div>
      </Shell>
    );
  }

  const teams = await getAllTeams();

  return (
    <Shell>
      {confirmed === '1' && (
        <div className="mb-4 rounded-xl border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] px-4 py-3 text-center">
          <p className="font-rd text-[13px] font-semibold text-[#0f8f5f]">
            Email confirmed. You&apos;re all set.
          </p>
        </div>
      )}
      <PreferencesForm
        teams={teams}
        token={token as string}
        initialTeams={subscriber.teams}
        email={subscriber.email}
        autoConfirmUnsub={unsub === '1'}
      />
    </Shell>
  );
}
