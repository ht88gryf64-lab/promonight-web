'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { TrackedAppLink } from './analytics-events';
import {
  appStoreUrl,
  currentClientPlatform,
  downloadHref,
  playStoreUrl,
  type ClientPlatform,
} from '@/lib/app-link';

// The team page's one app card (app funnel G1C, 2026-10-11). It replaced
// AppPushPitch on team pages and sits INSIDE the promo list, after the
// upcoming rows (or the season-over / nothing-upcoming line) and before
// "Show all" and the past promos. That spot has no Raptive unit on either
// side: units go after whole weave items and after `.page-content` row groups,
// and the rows above it are the list's tail, which is outside `.page-content`
// by design (src/lib/promo-row-groups.ts). So the card adds no ad anchor and
// changes no class Raptive matches. Keep it a plain <div>: never an <aside>
// (Raptive's Sidebar rule is `aside > *`) and never the classes `contents`,
// `page-content` or `rd-weave-item`.
//
// On the 9 or so team pages with no promos at all there is no promo list; the
// `offseason` variant sits in the order-[42] weave item instead, where
// AppPushPitch used to be (Matt, 2026-10-11).
//
// HEIGHT IS LOAD-BEARING. Raptive sizes a team page's in-content unit count
// from the height of the content column (about one unit per 1,000px at our
// density), so the card must be at least as tall as the AppPushPitch block it
// replaced, or pages near a 1,000px step lose a unit. It reaches that height
// with content (the icon, the feature row) and its own padding, never with
// margin outside it. Re-measure all team pages before changing its copy,
// layout or padding (audit-archive/app-funnel-g1/heights-all.mjs).
//
// THE LINK FOLLOWS THE DEVICE. iPhone and iPad go to the App Store, Android to
// Google Play, everything else to /download?src=team_cta_{teamId}, which
// carries the team into /download's store links and QR codes. The server and
// the first client render both use the /download link (a server cannot know
// the device, and a different href on hydration would be a mismatch); an
// effect swaps in the store link once mounted.

const FEATURES = ['Morning-of reminders', 'Home screen widgets', 'Game Day parking and bag policy'];

export function AppAlertCard({
  teamId,
  teamName,
  variant = 'season',
}: {
  teamId: string;
  teamName: string;
  /** `offseason`: the zero-promo pages, which have nothing listed yet. */
  variant?: 'season' | 'offseason';
}) {
  const [platform, setPlatform] = useState<ClientPlatform>('desktop');
  useEffect(() => {
    setPlatform(currentClientPlatform());
  }, []);

  const href =
    platform === 'ios'
      ? appStoreUrl({ surface: 'team_cta', teamId })
      : platform === 'android'
        ? playStoreUrl({ surface: 'team_cta', teamId })
        : downloadHref(teamId);
  const store = platform === 'desktop' ? 'unknown' : platform;

  return (
    <div className="rounded-2xl border border-rd-line bg-rd-card p-6 text-left">
      <div className="flex items-start gap-4">
        <Image
          src="/promonight-app-icon.png"
          alt="PromoNight app icon"
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="font-rd text-base font-semibold leading-snug text-rd-ink">
            {variant === 'offseason' ? `Get alerts when ${teamName} promos are posted` : `Get alerts for ${teamName} promos`}
          </p>
          <p className="mt-1 font-rd text-sm leading-relaxed text-rd-ink-soft">
            Free app. A reminder the morning of every bobblehead night, giveaway and theme night.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-rd text-xs text-rd-ink-soft">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-rd-red" />
                {f}
              </li>
            ))}
          </ul>
          <TrackedAppLink
            href={href}
            platform={store}
            surface="team_cta"
            section="team_app_card"
            page={`team/${teamId}`}
            teamSlug={teamId}
            plainAnchor
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-rd-red px-6 py-3 font-rd text-sm font-semibold text-white transition-colors hover:bg-rd-red-dark"
          >
            Get the app
          </TrackedAppLink>
        </div>
      </div>
    </div>
  );
}
