import Link from 'next/link';
import type { VenueHub } from '@/lib/venue-hub';
import type { BagAnswerModel } from '@/lib/venue-bag-answer';
import { claimSourceHost } from '@/lib/venue-claim';
import { Card, CardLabel, bagCardModel } from './venue-logistics';

// The answer-first bag block (serp-targeting, ruling 2026-11-05). It REPLACES
// the bag card on an eligible building and carries everything that card did:
// the size, the clear-bag rule, the lead of the stored notes, the outside-food
// note, the conflict reason, the official policy link and the MLB comparison
// link. Nothing on the page is lost; the order changes so the answer is the
// first thing under the H1.
//
// Every string here is a sourced field or a verbatim slice of sourced prose
// (src/lib/venue-bag-answer.ts). The two fixed strings, "No bags allowed" and
// the clear-bag line, restate sourced booleans and nothing else.
export function BagAnswerBlock({ hub, model }: { hub: VenueHub; model: BagAnswerModel }) {
  // The bag card's model, for the pieces this block keeps unchanged.
  const card = bagCardModel(hub, true);
  return (
    <Card accent>
      <div data-bag-answer>
        <CardLabel>What size bag can I bring?</CardLabel>
        <p className="m-0 font-rd text-[20px] font-extrabold leading-tight text-rd-ink md:text-[22px]">{model.headline}</p>
        {model.clearLine ? (
          <p className="mt-1 font-rd text-[14px] font-semibold text-rd-ink">{model.clearLine}</p>
        ) : null}
        {card?.noOutsideFood ? (
          <p className="mt-1 font-rd text-[14px] font-semibold text-rd-ink">No outside food or drink.</p>
        ) : null}
        {model.lead ? (
          <p className="mt-2 font-rd text-[14px] leading-[1.55] text-rd-ink">{model.lead.text}</p>
        ) : null}
        {model.clutch ? (
          <p className="mt-1.5 font-rd text-[14px] leading-[1.55] text-rd-ink">{model.clutch.text}</p>
        ) : null}
        {card?.clearBagReason ? (
          <p className="mt-1.5 font-rd text-[12px] text-rd-ink-faint">
            <strong className="text-rd-ink">Clear bag.</strong> {card.clearBagReason}{' '}
            {card.clearBagReasonUrl ? (
              <a href={card.clearBagReasonUrl} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                {claimSourceHost(card.clearBagReasonUrl)} &rsaquo;
              </a>
            ) : null}
          </p>
        ) : null}
        {model.lastVerified || model.sourceUrl ? (
          <p className="mt-2 font-rd text-[12px] text-rd-ink-faint">
            {model.lastVerified ? <span>Last verified {model.lastVerified}</span> : null}
            {model.lastVerified && model.sourceUrl ? ' · ' : null}
            {model.sourceUrl ? (
              <a href={model.sourceUrl} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                {claimSourceHost(model.sourceUrl)} &rsaquo;
              </a>
            ) : null}
          </p>
        ) : null}
        {card?.policyLink ? (
          <div className="mt-1 font-rd text-[12px]">
            <a href={card.policyLink} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
              Official bag policy &rsaquo;
            </a>
          </div>
        ) : null}
        {hub.tenants.some((t) => t.league === 'MLB') ? (
          <div className="mt-1 font-rd text-[12px]">
            <Link href="/venues/bag-policies" className="font-semibold text-rd-ink-soft transition-colors hover:text-rd-red">
              Compare every MLB ballpark&apos;s bag policy &rsaquo;
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
