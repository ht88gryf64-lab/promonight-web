'use client';

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { track, type CapturePromptContext, type CaptureDismissMethod } from '@/lib/analytics';
import {
  successVariant,
  type ConfirmationOutcome,
  type SuccessVariant,
} from '@/lib/subscribe-outcome';
import { useStarredTeamsOptional } from '@/hooks/use-starred-teams';
import {
  selectChips,
  type CaptureChip,
  type CaptureChipPool,
  type CaptureTeamRef,
} from '@/lib/capture/chips';
import {
  ERROR_COPY,
  promptCopy,
  submitErrorKind,
  successCopy,
  SUBMITTING_LABEL,
  SUBMIT_LABEL,
  type CaptureErrorKind,
} from '@/lib/capture/sheet-copy';
import { browserStorage, KEY_DISMISSED_AT, KEY_SUBSCRIBED } from '@/lib/capture/storage';
import { markSignup } from '@/lib/capture/suppression';
import { CaptureSheet } from './CaptureSheet';

// What the sheet SAYS and DOES. CaptureSheet owns where it sits and how it goes
// away; every string it renders comes from lib/capture/sheet-copy.ts, where a
// test can reach it.
//
// FOUR STATES, ONE CONTAINER. Prompt, submitting, error and success are content
// swaps inside a container whose height is measured at submit time and pinned,
// so the swap to success cannot move the sheet under the visitor's thumb. The
// error line is a permanently reserved row rather than an element that appears,
// for the same reason one step earlier.
//
// MOUNTED FOR EVERY QUALIFYING VISITOR since the A/B was dropped. It used to be
// variant_a only; see the header of CaptureTrigger.tsx for why that went away.
// The `variant` on context is still stamped on every event below and still
// gates nothing.
//
// ONE CONSEQUENCE WORTH KNOWING, because it originates here: the two durable
// suppressors (promonight:capture_dismissed_at, promonight:subscribed) are
// written by this component and by nothing else. Now that every qualifying
// browser can reach it, they are written uniformly, so raw capture_prompt_shown
// counts decay the same way for everyone instead of splitting by arm. Reads
// still go per PERSON over the qualifying boolean; see
// docs/capture-telemetry-read.md.

/** Shape of the /api/subscribe response this component reads. */
interface SubscribeResponse {
  ok?: boolean;
  error?: string;
  status?: string;
  confirmation?: ConfirmationOutcome;
}

type Status = 'prompt' | 'submitting' | 'success';

export interface CaptureCardProps {
  /** surface / page_type / team_id / variant, stamped on every event here. */
  context: CapturePromptContext;
  /** The page team, or null on an aggregator. */
  team: CaptureTeamRef | null;
  /** Everything a chip could be, resolved on the server. */
  pool: CaptureChipPool;
  /** Opponents of games this visitor expanded, most recent first. */
  expandedOpponentIds: readonly string[];
}

export function CaptureCard({ context, team, pool, expandedOpponentIds }: CaptureCardProps) {
  const stars = useStarredTeamsOptional();

  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('prompt');
  const [errorKind, setErrorKind] = useState<CaptureErrorKind | null>(null);
  const [variant, setVariant] = useState<SuccessVariant>('confident');
  // FROZEN at success, never recomputed. Tapping a chip stars its team, and a
  // live recompute would then exclude that team and delete the chip the visitor
  // just pressed.
  const [chips, setChips] = useState<CaptureChip[]>([]);
  // The prompt state's rendered height, captured before the content swaps.
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const headingId = 'capture-sheet-heading';

  const handleDismiss = useCallback(
    (method: CaptureDismissMethod) => {
      // REPORTED FROM THE PROMPT STATE ONLY, which is the only state where
      // closing the sheet means rejecting the offer.
      //
      // Not from success: closing a confirmation is not a rejection, counting it
      // would inflate the dismiss rate by exactly the people who converted, and a
      // 30-day dismissal marker is redundant next to the promonight:subscribed
      // flag the submit already wrote, which suppresses ahead of it anyway.
      //
      // Not from submitting either, and that one is subtler. A dismissal landing
      // inside the in-flight window would otherwise emit dismissed and then, when
      // the response arrives, submitted, for one sheet. Skipping it keeps the two
      // events disjoint, so shown still decomposes into dismissed plus submitted
      // plus abandoned with nobody counted twice. A submit that then fails leaves
      // this sheet in the abandoned remainder, which is what it was.
      if (status === 'prompt') {
        browserStorage('local').set(KEY_DISMISSED_AT, String(Date.now()));
        track('capture_prompt_dismissed', { ...context, dismiss_method: method });
      }
      setOpen(false);
    },
    [context, status],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    const trimmed = email.trim();

    // Shape first, so a visibly malformed address never costs a request.
    const preflight = submitErrorKind({ email: trimmed, requestOk: null });
    if (preflight) {
      setErrorKind(preflight);
      return;
    }

    setStatus('submitting');
    setErrorKind(null);

    // THE TEAM GOES IN THE BODY, not just into localStorage. The confirmation
    // link routinely gets opened on a different device from the one that
    // submitted, and a team that only ever lived in this browser's storage would
    // not be on the record when that happens.
    const teams = team ? [team.id] : [];

    let data: SubscribeResponse | null = null;
    let ok = false;
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, teams, source: context.surface }),
      });
      data = (await res.json().catch(() => null)) as SubscribeResponse | null;
      ok = res.ok && data?.ok === true;
    } catch {
      ok = false;
    }

    if (!ok) {
      setStatus('prompt');
      setErrorKind(
        submitErrorKind({
          email: trimmed,
          requestOk: false,
          serverError: data?.error ?? null,
        }),
      );
      return;
    }

    // Measure while the prompt is still what is on screen, and pin it exactly.
    // Copy length varies by team name, by email length and by state, so a
    // hand-tuned constant would be right for one team and wrong for the next;
    // the height the prompt actually rendered at is the only value that is right
    // for all of them.
    setLockedHeight(contentRef.current?.offsetHeight ?? null);

    // Written at SUBMIT, which is what the suppression rule has always expected.
    // It is self-reported and pre-confirmation by design: it says only "this
    // browser once posted an email", which is exactly enough not to nag someone
    // who already signed up here. See storage.ts on why it is never truth.
    browserStorage('local').set(KEY_SUBSCRIBED, String(Date.now()));

    // AND the session flag, which is not redundant with it for two reasons.
    // SafeStorage.set swallows a quota failure, so the durable key above can
    // silently not persist, and this is a second suppressor on a different store
    // that would still hold for the rest of the visit. And session_signup is a
    // declared SuppressionReason with a slot in SUPPRESSION_ORDER: without this
    // call nothing in the app can ever produce it, and a permanently empty
    // series in the suppression_reason breakdown reads as "never happens" rather
    // than "cannot happen".
    markSignup(browserStorage('session'));

    // Chosen BEFORE the submitted event so that event can carry what was
    // offered. Without an exposure count, chip_source on the add events reports
    // which rule produced adds but not which rule produced adds PER CHIP SHOWN,
    // and "is the venue-city rule worth keeping" is a rate question. Same
    // handler, data already in hand, no extra event.
    //
    // No provider means toggleStar is a no-op and isStarred is always false, so
    // a chip would render and then refuse to flip. Better to offer nothing than
    // to offer something inert. The provider is global in app/layout.tsx, so
    // this is a guard against a future mount outside it, not a live case.
    const nextChips = stars
      ? selectChips({
          pool,
          expandedOpponentIds,
          // The page team is starred by this submit, and anything already
          // starred would be a chip that does nothing.
          excludeIds: [...(team ? [team.id] : []), ...stars.starred],
        })
      : [];

    const at = trimmed.lastIndexOf('@');
    track('capture_prompt_submitted', {
      ...context,
      email_domain: trimmed.slice(at + 1).toLowerCase(),
      chip_count: nextChips.length,
      chip_sources: nextChips.map((c) => c.source).join(','),
    });

    // ALSO the cross-surface signup event, and this one is load-bearing rather
    // than a nicety. Signups-by-source in docs/capture-telemetry-read.md counts
    // conversions as `newsletter_signup` per person and splits them on `surface`.
    // Emitting only capture_prompt_submitted would leave the sheet's conversions
    // out of the read the sheet is judged by, and out of every existing signup
    // dashboard; web_engagement_capture was added to the CaptureSurface union for
    // precisely this submit.
    //
    // page_type rides along because `surface` alone cannot separate the sheet's
    // two placements: the team-page sheet and the aggregator sheet both write
    // web_engagement_capture, and only the team-page one has a team and a chip
    // row. It is recoverable by joining to capture_prompt_submitted, which fires
    // on exactly these submits and carries page_type — but a join is a thing a
    // reader has to remember, and this makes the split a GROUP BY.
    track('newsletter_signup', {
      surface: context.surface,
      team_count: teams.length,
      variant: context.variant,
      page_type: context.page_type,
    });

    // Mirror the page team into My Teams. Guarded on isStarred because
    // toggleStar TOGGLES: calling it for a team the visitor already starred
    // would un-star it as a reward for subscribing.
    if (team && stars && !stars.isStarred(team.id)) {
      stars.toggleStar(
        team.id,
        { name: team.displayName, league: team.league, sport: team.sportSlug },
        'capture_sheet_context',
        { suppressIntroToast: true },
      );
    }

    setChips(nextChips);
    setVariant(successVariant(data?.confirmation, data?.status));
    setStatus('success');
  };

  const onChipTap = (chip: CaptureChip, index: number) => {
    if (!stars) return;
    const wasOn = stars.isStarred(chip.id);
    stars.toggleStar(
      chip.id,
      { name: chip.displayName, league: chip.league, sport: chip.sportSlug },
      'capture_sheet_chip',
      { suppressIntroToast: true },
    );
    // Adds only. A flip back to off is already visible as the absence of an add,
    // and a removal event would put two rows in the funnel for one indecisive
    // tap pair.
    if (!wasOn) {
      track('capture_prompt_team_added', {
        ...context,
        added_team_id: chip.id,
        chip_position: index,
        source_team_id: context.team_id,
        chip_source: chip.source,
      });
    }
  };

  const isStarred = (slug: string) => stars?.isStarred(slug) ?? false;

  const body =
    status === 'success' ? (
      <SuccessBody
        headingId={headingId}
        variant={variant}
        email={email.trim()}
        team={team}
        chips={chips}
        isStarred={isStarred}
        onChipTap={onChipTap}
      />
    ) : (
      <PromptBody
        headingId={headingId}
        team={team}
        email={email}
        submitting={status === 'submitting'}
        errorKind={errorKind}
        onEmailChange={(next) => {
          setEmail(next);
          if (errorKind) setErrorKind(null);
        }}
        onSubmit={onSubmit}
      />
    );

  return (
    <CaptureSheet open={open} onDismiss={handleDismiss} labelledBy={headingId}>
      {/* The live region is the CONTAINER, not the individual lines, because it
          has to survive the state swap. A region announces mutations inside
          itself; content that is already there when the region is created is
          not announced. Putting it on the success text would therefore say
          nothing at the moment it matters most, since nothing here takes focus
          and a screen reader has no other cue that the sheet changed. Here it
          covers the swap to success and every rewrite of the confirmation line
          as chips are tapped. The error row carries its own role="alert". */}
      {/* AN EXACT HEIGHT, NOT A MINIMUM. A floor only stops the container
          shrinking; success copy longer than the prompt would still grow it, and
          a confirmation line rewritten from one team to three would still push
          the chip row down, which is the reflow the spec rules out. Pinning the
          measured height means the swap and every rewrite are contained by
          construction rather than by whether the copy happened to be shorter.
          Overflow goes to the success text block, which scrolls on its own. */}
      <div
        ref={contentRef}
        aria-live="polite"
        className="flex flex-col"
        style={lockedHeight !== null ? { height: lockedHeight } : undefined}
      >
        {body}
      </div>
    </CaptureSheet>
  );
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function PromptBody({
  headingId,
  team,
  email,
  submitting,
  errorKind,
  onEmailChange,
  onSubmit,
}: {
  headingId: string;
  team: CaptureTeamRef | null;
  email: string;
  submitting: boolean;
  errorKind: CaptureErrorKind | null;
  onEmailChange: (next: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const copy = promptCopy(team ? team.displayName : null);

  return (
    <>
      {/* pr-10 clears the close button, which is absolutely positioned over
          this corner and must never sit on top of the heading. */}
      <h2
        id={headingId}
        className="pr-10 font-rd text-[15px] font-semibold leading-snug text-rd-ink"
      >
        {copy.heading}
      </h2>
      <p className="mt-1.5 font-rd text-[12.5px] leading-relaxed text-rd-ink-soft">{copy.body}</p>

      {/* noValidate: the browser's own bubble would fire before our check and
          say something different from the copy this sheet is specified to
          show. type=email still gets the right mobile keyboard. */}
      <form onSubmit={onSubmit} noValidate className="mt-3 flex gap-2">
        <label htmlFor="capture-sheet-email" className="sr-only">
          Your email
        </label>
        <input
          id="capture-sheet-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          // NO autoFocus. On a phone it would throw the keyboard up over the
          // page the visitor was reading, which is the opposite of a sheet that
          // leaves the page usable.
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={submitting}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-rd-line-strong bg-white px-3 py-2.5 font-rd text-[14px] text-rd-ink placeholder:text-rd-ink-faint focus:border-rd-red focus:outline-none focus:ring-2 focus:ring-rd-red/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-lg bg-rd-red px-3.5 py-2.5 font-rd text-[13px] font-semibold text-white transition-colors hover:bg-rd-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 focus-visible:ring-offset-rd-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? SUBMITTING_LABEL : SUBMIT_LABEL}
        </button>
      </form>

      {/* Always rendered, empty when there is nothing to say, so an error
          arriving cannot push the form up under the visitor's finger. */}
      <p
        role="alert"
        className="mt-1.5 min-h-[1.05rem] font-rd text-[11.5px] leading-tight text-rd-red"
      >
        {errorKind ? ERROR_COPY[errorKind] : ''}
      </p>
    </>
  );
}

// ── Success ─────────────────────────────────────────────────────────────────

function SuccessBody({
  headingId,
  variant,
  email,
  team,
  chips,
  isStarred,
  onChipTap,
}: {
  headingId: string;
  variant: SuccessVariant;
  email: string;
  team: CaptureTeamRef | null;
  chips: CaptureChip[];
  isStarred: (slug: string) => boolean;
  onChipTap: (chip: CaptureChip, index: number) => void;
}) {
  // Page team first, then chips in the order they are rendered. Short names:
  // this line is rewritten in place and three display names would not fit.
  const starredNames = [
    ...(team ? [team.name] : []),
    ...chips.filter((c) => isStarred(c.id)).map((c) => c.name),
  ];

  const copy = successCopy({
    variant,
    email,
    teamName: team ? team.displayName : null,
    starredNames,
  });

  return (
    // flex-1 pins the chip row to the bottom of the locked height and min-h-0
    // plus overflow lets the text absorb everything above it. Together they are
    // what makes the confirmation line safe to rewrite: naming three teams
    // instead of one takes an extra line out of this block's own scroll, and the
    // chips below it do not move by so much as a pixel.
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2
          id={headingId}
          className="pr-10 font-rd text-[15px] font-semibold leading-snug text-rd-ink"
        >
          {copy.heading}
        </h2>
        {/* ph-no-capture, and it has to be here. This sentence contains the
            visitor's email address, session replay is ON in AnalyticsProvider,
            and its only masking is maskAllInputs, which covers form fields and
            not rendered text. Without this the address would be legible in every
            recording of a signup. Masking the whole paragraph rather than the
            address alone costs nothing: the rest of it is fixed copy. */}
        <p className="ph-no-capture mt-1.5 font-rd text-[12.5px] leading-relaxed text-rd-ink-soft">
          {copy.body}
        </p>
        {copy.starredLine && (
          <p className="mt-1.5 font-rd text-[12.5px] leading-relaxed text-rd-ink-soft">
            {copy.starredLine}
          </p>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex gap-1.5">
          {chips.map((chip, i) => {
            const on = isStarred(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChipTap(chip, i)}
                // flex-1 + truncate is what keeps three chips on one row at
                // 320px. A fourth would wrap, and a wrapped row pushes past the
                // height the prompt state set.
                className={`min-w-0 flex-1 truncate rounded-full border px-2.5 py-2 font-rd text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 focus-visible:ring-offset-rd-card ${
                  on
                    ? 'border-rd-red bg-rd-red text-white'
                    : 'border-rd-line-strong bg-rd-card text-rd-ink hover:border-rd-red'
                }`}
              >
                {/* Decoration only. aria-pressed already tells a screen reader
                    whether the chip is on, and "plus Tigers" would say it a
                    second time in worse words. */}
                <span aria-hidden="true">{on ? '✓ ' : '+ '}</span>
                {chip.name}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
