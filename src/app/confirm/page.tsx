import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getConfirmCandidateByToken } from '@/lib/subscribers';
import { CONFIRM_COOKIE } from '@/lib/manage-session';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { ConfirmButton } from '@/components/follow/ConfirmButton';
import { pageOpenGraph } from '@/lib/og';

// The human-action interstitial for double opt-in.
//
// It exists because a link scanner cannot press a button. GET /api/confirm now
// only reads and redirects here; the write happens on the POST this page's
// button makes. See the header of api/confirm/route.ts for why a write on GET
// was a consent problem rather than a performance one.
//
// Never indexed and never cached: it is reached only from a per-subscriber
// emailed link, and its content depends on a cookie.
export const metadata: Metadata = {
  title: 'Confirm Your Subscription',
  openGraph: pageOpenGraph('/confirm'),
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
            Almost there
          </p>
          <h1 className="rd-display mt-1 text-4xl uppercase leading-[0.95] text-white md:text-5xl">
            Confirm your subscription
          </h1>
        </div>
      </section>
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-8">{children}</div>
    </div>
  );
}

export default async function ConfirmPage() {
  const token = (await cookies()).get(CONFIRM_COOKIE)?.value ?? null;
  const candidate = token ? await getConfirmCandidateByToken(token) : null;

  if (!candidate?.found) {
    return (
      <Shell>
        <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
          <h2 className="rd-display text-2xl uppercase text-rd-ink">Link not valid</h2>
          <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
            This confirmation link is missing, or the page was left open too long.
            Open the link in your PromoNight email again, or{' '}
            <a href="/follow" className="font-semibold text-rd-red underline">
              sign up again
            </a>
            .
          </p>
        </div>
      </Shell>
    );
  }

  if (candidate.alreadyConfirmed) {
    return (
      <Shell>
        <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
          <h2 className="rd-display text-2xl uppercase text-rd-ink">
            You&apos;re already confirmed
          </h2>
          <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
            Nothing more to do. Your weekly promo email is on its way as usual.
          </p>
          {/* No manage session is minted here. Landing on this branch proves
              someone holds the CONFIRM token, which is not the same credential
              as the manage token, and handing out a preferences session for a
              re-clicked old link would widen exactly the surface this branch
              exists to narrow. The footer of every email links to preferences. */}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
        <h2 className="rd-display text-2xl uppercase text-rd-ink">One more tap</h2>
        {/* ph-no-capture: the address is rendered as page text and session
            replay masks form fields only, not text. Same rule as
            follow/FollowForm.tsx. */}
        <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
          Confirm that{' '}
          <strong className="ph-no-capture">{candidate.email ?? 'your address'}</strong>{' '}
          wants the weekly PromoNight email.
        </p>
        <ConfirmButton />
        <p className="mx-auto mt-4 max-w-md font-rd text-[12px] text-rd-ink-faint">
          Didn&apos;t sign up? Close this page and nothing happens.
        </p>
      </div>
    </Shell>
  );
}
