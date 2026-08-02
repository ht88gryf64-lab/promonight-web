'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { track } from '@/lib/analytics';
import { resolveBrowserVariant } from '@/lib/capture/variant';
import type { CaptureSurface } from '@/lib/follow-surface';

// The email funnel's entry link, and the client leaf that lets a SERVER
// component emit an arm-labelled email_cta_click.
//
// WHY NOT TrackedTapLink, which this otherwise duplicates. That component takes
// trackProps as a VALUE, evaluated during render. The arm has to be resolved at
// CLICK time instead, for two reasons that both matter:
//
//   1. resolveBrowserVariant touches localStorage, and a storage write during
//      render is a render side effect. Under StrictMode and concurrent
//      rendering that runs more than once, on a path where nothing should run
//      at all until the visitor actually clicks.
//   2. FollowCTA is a server component. It cannot read localStorage itself, and
//      it cannot hand TrackedTapLink a thunk to defer the read either, because
//      functions do not cross the server/client boundary.
//
// Passing the props lazily was therefore not available, and resolving eagerly
// was not correct, so the click handler moves here instead. Everything else is
// a plain next/link.

type EmailCtaLinkProps = Omit<ComponentProps<typeof Link>, 'onClick'> & {
  surface: CaptureSurface;
  /** Pre-starred team from a team-page CTA. Omitted on the site-wide footer. */
  teamSlug?: string;
};

export function EmailCtaLink({ surface, teamSlug, ...rest }: EmailCtaLinkProps) {
  return (
    <Link
      onClick={() => {
        track('email_cta_click', {
          surface,
          team_slug: teamSlug,
          variant: resolveBrowserVariant(),
        });
      }}
      {...rest}
    />
  );
}
