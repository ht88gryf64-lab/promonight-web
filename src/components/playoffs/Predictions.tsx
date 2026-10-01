import type { MethodologyView, PredictionsView } from '@/lib/postseason/predictions';
import { PredictedBracket } from './PredictedBracket';
import { CONDENSED, LockIcon } from './ui';

// The computer's bracket on a league page, in two server components that are
// two separate children of the page's article:
//
//   PredictionsSection     the scorecard, the predicted bracket, title odds.
//                          It sits in the reserved place below the real
//                          bracket, inside the shared controls provider.
//   PredictionsMethodology how the computer picked, with the fingerprints.
//                          Near the foot of the article, OUTSIDE the
//                          provider and outside every client component.
//
// THE FINGERPRINTS GO TO ONE PLACE. The only fingerprints a served page may
// show are the four frozen input hashes and the reviewed sha256, and only
// inside the methodology section, labeled as fingerprints (Shared contracts,
// exception logged by WEB2 on 2026-09-30). MethodologyView is the only type
// with a field for them, this file's PredictionsMethodology is the only
// reader of it, and it is a server component: its text reaches the page as
// markup, and in the RSC payload as that same markup, never as a prop of a
// client component.

export const PREDICTIONS_ID = 'predictions';
export const METHODOLOGY_ID = 'how-promonight-predicts-works';

export function PredictionsSection({
  league,
  leagueSlug,
  season,
  view,
}: {
  league: string;
  leagueSlug: string;
  season: number;
  view: PredictionsView;
}) {
  const { scorecard } = view;
  return (
    <section id={PREDICTIONS_ID} aria-labelledby="predictions-heading" data-predictions="bracket" className="mt-12 scroll-mt-20">
      <div className="flex items-center gap-2 border-b-2 border-rd-line pb-2 text-rd-ink-soft">
        <LockIcon />
        <h2 id="predictions-heading" className="text-[26px] font-extrabold uppercase leading-none text-rd-ink" style={{ fontFamily: CONDENSED }}>
          PromoNight Predicts
        </h2>
      </div>
      <p className="mt-2.5 max-w-[60ch] text-[14.5px] leading-relaxed text-rd-ink-soft">
        PromoNight Predicts picks every series with a simulation built on regular-season results. The picks are locked and never change; each one is marked against the
        real bracket above as correct, busted or still alive. Each card shows the pick, how many games it most likely takes to win and its chance at lock. The
        chances come from regular-season results alone, so they take no account of postseason games already played when the bracket was
        locked.
      </p>

      <div data-predictions-scorecard className="mt-4 grid gap-2 sm:grid-cols-3">
        <p data-record className="rounded-[10px] border border-rd-line bg-rd-card px-4 py-3">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">Record</span>
          <span className="mt-0.5 block text-[22px] font-extrabold uppercase leading-tight text-rd-ink" style={{ fontFamily: CONDENSED }}>
            {scorecard.recordLine}
          </span>
        </p>
        <p data-alive className="rounded-[10px] border border-rd-line bg-rd-card px-4 py-3">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">Still in play</span>
          <span className="mt-0.5 block text-[22px] font-extrabold uppercase leading-tight text-rd-ink" style={{ fontFamily: CONDENSED }}>
            {scorecard.aliveLine}
          </span>
        </p>
        <p data-champion-pick={scorecard.championStatus} className="rounded-[10px] border border-rd-line bg-rd-card px-4 py-3">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">Predicted champion</span>
          <span className="mt-0.5 block text-[22px] font-extrabold uppercase leading-tight text-rd-ink" style={{ fontFamily: CONDENSED }}>
            {scorecard.championLine}
          </span>
        </p>
      </div>

      <PredictedBracket league={league} leagueSlug={leagueSlug} season={season} rounds={view.rounds} />

      <section aria-labelledby="title-odds-heading" data-title-odds className="mt-6">
        <h3 id="title-odds-heading" className="text-[18px] font-bold uppercase tracking-[0.04em] text-rd-ink" style={{ fontFamily: CONDENSED }}>
          Title odds at lock
        </h3>
        <p className="mt-1 text-[13px] text-rd-ink-soft">{view.titleOddsCaption}</p>
        <table className="mt-2 w-full max-w-md border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-rd-line text-left text-[11px] uppercase tracking-[0.1em] text-rd-ink-faint">
              <th scope="col" className="py-1.5 font-semibold">
                Team
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                Title odds
              </th>
            </tr>
          </thead>
          <tbody>
            {view.titleOdds.map((o) => (
              <tr key={o.name} className="border-b border-rd-line last:border-b-0">
                <td className="py-1.5 text-rd-ink">{o.name}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-rd-ink">{o.oddsLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[13px] text-rd-ink-soft">
          <a href={`#${METHODOLOGY_ID}`} className="font-semibold text-rd-red hover:text-rd-red-dark">
            How PromoNight Predicts works
          </a>
        </p>
      </section>
    </section>
  );
}

export function PredictionsMethodology({ view }: { view: MethodologyView }) {
  return (
    <section
      id={METHODOLOGY_ID}
      aria-labelledby="methodology-heading"
      data-predictions-methodology
      className="mt-12 scroll-mt-20 rounded-[10px] border border-rd-line bg-rd-card px-4 py-5"
    >
      <h2 id="methodology-heading" className="text-[22px] font-extrabold uppercase leading-none text-rd-ink" style={{ fontFamily: CONDENSED }}>
        How PromoNight Predicts works
      </h2>
      <div className="mt-3 max-w-[64ch] space-y-2.5 text-[14px] leading-relaxed text-rd-ink-soft">
        <p>
          PromoNight Predicts is a simulation, not a staff pick. Each club gets a rating from its regular-season results. The simulation then
          plays out the postseason {view.simRuns} times from those ratings and picks the side that won each matchup more often. A pick&apos;s chance is how often it won that matchup in the simulated
          postseasons where that matchup came up, and its length is how many games the pick most often took to win it.
        </p>
        <p data-locked-on>
          The inputs were locked on {view.lockedOn}
          {view.lockedBeforeGame1 ? ', before Game 1' : ''}.{' '}
          {view.computedOn === view.bracketLockedOn
            ? `The bracket was computed from those locked inputs and locked on ${view.computedOn}`
            : `The bracket was computed from those locked inputs on ${view.computedOn} and locked on ${view.bracketLockedOn}`}
          . The locked bracket is written once and never changed, and the simulation runs from a fixed seed, so the same inputs always give
          the same bracket. The rating, simulation and bracket code is unchanged since the inputs were locked. Every chance and title odd on this page is as
          it stood when the bracket was locked. Postseason results are not among the inputs, so a pick can name a club that was already out by
          then.
        </p>
        <p data-backtest>{view.backtest}</p>
      </div>
      <h3 className="mt-5 text-[16px] font-bold uppercase tracking-[0.06em] text-rd-ink" style={{ fontFamily: CONDENSED }}>
        Fingerprints
      </h3>
      <p className="mt-1 max-w-[64ch] text-[13px] leading-relaxed text-rd-ink-soft">
        Each is a SHA-256 fingerprint of something that was locked: four of the inputs and the locked bracket file. The bracket format and the
        locked bracket file are fingerprinted as files, the other three as their locked data written out in a fixed order. A change to any of
        them would change its fingerprint.
      </p>
      <dl data-fingerprints className="mt-3 space-y-2.5">
        {view.fingerprints.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{f.label}</dt>
            <dd className="mt-0.5">
              <code className="block break-all font-mono text-[12px] leading-snug text-rd-ink">{f.value}</code>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
