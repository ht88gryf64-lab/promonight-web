/**
 * Pure helpers for the `hydration_mismatch` event. No DOM, no window, no
 * imports: `src/instrumentation-client.ts` runs in the main client chunk on
 * every pageview, so anything this file pulls in is paid for by everyone.
 *
 * Context is known-issues entry 50. Raptive's head script can insert its ad
 * containers into React-owned DOM before hydration reaches them; React then
 * throws minified error #418, rebuilds the tree, and every ad unit is deleted.
 * The race is proven. How often real visitors lose it is not, and that number
 * decides whether ad loading has to change.
 */

/**
 * Production builds only ever say this. The development wording ("Hydration
 * failed because...") is deliberately NOT matched: it is a different string in
 * every React minor and it never reaches a visitor.
 *
 * The lookahead keeps #4180 (should it ever exist) from matching.
 */
const MINIFIED_418 = /Minified React error #418(?!\d)/;

export function isHydrationMismatchMessage(message: unknown): boolean {
  return typeof message === 'string' && MINIFIED_418.test(message);
}

/**
 * Anything Raptive inserts. `<html>` and `<body>` are excluded because Raptive
 * writes `adthrive-device-*` onto `<body>`, and a class on an element React
 * already owns is not a foreign node and cannot cause a mismatch.
 */
export const AD_NODE_SELECTOR =
  '[id^="AdThrive_"], [class*="adthrive"]:not(html):not(body)';

export type ViewportDevice = 'phone' | 'tablet' | 'desktop';

/**
 * Raptive's own breakpoints (tablet 768, desktop 1024), NOT the 640/1024 that
 * `device_class` uses elsewhere in analytics. This value exists to be compared
 * against Raptive's device split, and their body class cannot be read for it:
 * it may not have been written yet, and React resets it during the rebuild.
 */
export function viewportDevice(innerWidth: number): ViewportDevice {
  if (innerWidth < 768) return 'phone';
  if (innerWidth < 1024) return 'tablet';
  return 'desktop';
}

export type HydrationMismatchSnapshot = {
  route: string;
  viewport_device: ViewportDevice;
  adthrive_present: boolean;
  ms_since_navigation_start: number;
};

export function buildHydrationMismatchSnapshot(input: {
  pathname: string;
  innerWidth: number;
  adNodeSeen: boolean;
  nowMs: number;
}): HydrationMismatchSnapshot {
  return {
    route: input.pathname,
    viewport_device: viewportDevice(input.innerWidth),
    adthrive_present: input.adNodeSeen,
    ms_since_navigation_start: Math.max(0, Math.round(input.nowMs)),
  };
}
