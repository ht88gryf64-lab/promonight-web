'use client';

import { usePathname } from 'next/navigation';
import { isRedesignEnabledClient, isTeamRoute } from '@/lib/redesign';

// Hides global chrome (the dark Nav / Footer) on team routes when the redesign
// gate is ON, so the redesigned team page's own light BrandBar/Footer are the
// only chrome — no double nav, no double footer. Suppression is computed on the
// CLIENT (usePathname + NEXT_PUBLIC gate) per the spec, so the server root
// layout is never touched and stays untouched when the gate is OFF or on any
// non-team route.
export function RedesignChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isRedesignEnabledClient() && isTeamRoute(pathname)) return null;
  return <>{children}</>;
}
