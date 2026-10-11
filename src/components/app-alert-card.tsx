'use client';

import { useEffect, useState } from 'react';
import { TrackedAppLink } from './analytics-events';
import { appStoreUrl, currentClientPlatform, playStoreUrl, type ClientPlatform } from '@/lib/app-link';

// The team page's one app card (app funnel G1C, 2026-10-11). It replaced
// AppPushPitch on team pages and sits INSIDE the promo list, after the
// upcoming rows (or the season-over line) and before "Show all" and the past
// promos. That spot has no Raptive unit on either side: units go after whole
// weave items and after `.page-content` row groups, and the rows above it are
// the list's tail, which is outside `.page-content` by design
// (src/lib/promo-row-groups.ts). So the card adds no ad anchor and changes no
// class Raptive matches. Keep it a plain <div>: never an <aside> (Raptive's
// Sidebar rule is `aside > *`) and never the classes `contents`,
// `page-content` or `rd-weave-item`.
//
// THE LINK FOLLOWS THE DEVICE. iPhone and iPad go to the App Store, Android to
// Google Play, everything else to /download. The server and the first client
// render both use the /download link (a server cannot know the device, and a
// different href on hydration would be a mismatch); an effect swaps in the
// store link once mounted.
export function AppAlertCard({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [platform, setPlatform] = useState<ClientPlatform>('desktop');
  useEffect(() => {
    setPlatform(currentClientPlatform());
  }, []);

  const href =
    platform === 'ios'
      ? appStoreUrl({ surface: 'team_cta', teamId })
      : platform === 'android'
        ? playStoreUrl({ surface: 'team_cta', teamId })
        : `/download?src=team_cta_${teamId}`;
  const store = platform === 'desktop' ? 'unknown' : platform;

  return (
    <div className="mt-6 rounded-2xl text-left border border-rd-line bg-rd-card p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="font-rd text-base font-semibold text-rd-ink">Get alerts for {teamName} giveaways</p>
        <p className="mt-1 font-rd text-sm text-rd-ink-soft">Free app. A reminder the morning of every promo game.</p>
      </div>
      <TrackedAppLink
        href={href}
        platform={store}
        surface="team_cta"
        section="team_app_card"
        page={`team/${teamId}`}
        teamSlug={teamId}
        className="mt-4 inline-flex shrink-0 items-center justify-center rounded-xl bg-rd-red px-6 py-3 font-rd text-sm font-semibold text-white transition-colors hover:bg-rd-red-dark sm:mt-0"
      >
        Get the app
      </TrackedAppLink>
    </div>
  );
}
