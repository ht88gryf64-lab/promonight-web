// Pure builders for the share URL + per-channel text, plus the analytics
// emit. No DOM side effects live here — the imperative window.open /
// clipboard calls stay in ShareSheet so this module is trivially testable.
import {
  inferSurfaceFromPath,
  normalizeSport,
  track,
  type ShareChannel,
} from '@/lib/analytics';
import type { ShareItem } from './types';

// Share links intentionally point at the bare apex (no www) to match the
// brand string used in the share copy itself.
const SHARE_ORIGIN = 'https://getpromonight.com';

// X copy must stay well under the 280 limit; the brief pins it under 240 so a
// quote-tweet prefix still fits.
const TWEET_MAX = 240;

/** Canonical team-page URL every channel links to. */
export function shareUrlFor(item: ShareItem): string {
  return `${SHARE_ORIGIN}/${item.sport}/${item.teamSlug}`;
}

/** SMS body: icon + title / team · date / venue / brand. */
export function buildSmsText(item: ShareItem): string {
  const lines = [
    `${item.icon} ${item.promoTitle}`.trim(),
    `${item.teamName} · ${item.date}`,
  ];
  if (item.venue) lines.push(item.venue);
  lines.push('', 'getpromonight.com');
  return lines.join('\n');
}

/** Tweet text — same intro as SMS, swapped tail, capped under TWEET_MAX. */
export function buildTweetText(item: ShareItem): string {
  const tail =
    '\n\nFull promo calendar → getpromonight.com via @promo_night_app';
  const venueLine = item.venue ? `\n${item.venue}` : '';
  const build = (title: string) =>
    `${item.icon} ${title}\n${item.teamName} · ${item.date}${venueLine}${tail}`;

  let text = build(item.promoTitle);
  if (text.length > TWEET_MAX) {
    // Only the title is elastic — trim it (with an ellipsis) until the whole
    // tweet fits, keeping the team/date/venue/URL tail intact.
    const overflow = text.length - TWEET_MAX;
    const keep = Math.max(0, item.promoTitle.length - overflow - 1);
    text = build(item.promoTitle.slice(0, keep).trimEnd() + '…');
  }
  return text;
}

/** Email subject — icon + title. */
export function buildEmailSubject(item: ShareItem): string {
  return `${item.icon} ${item.promoTitle}`.trim();
}

/** Email body — short plain-text message ending in the team-page URL. */
export function buildEmailBody(item: ShareItem): string {
  const lines = [
    `${item.icon} ${item.promoTitle}`.trim(),
    '',
    `${item.teamName} · ${item.date}`,
  ];
  if (item.venue) lines.push(item.venue);
  lines.push('', `See the full schedule: ${shareUrlFor(item)}`, '', 'via PromoNight');
  return lines.join('\n');
}

/**
 * Fire the canonical `share_initiated` event. track() dual-emits to PostHog
 * and GA4 and auto-attaches page_path / device_class / source_*, so we only
 * pass the share-specific dimensions here. Surface is derived from the live
 * pathname so call sites never plumb it through.
 */
export function fireShareInitiated(
  item: ShareItem,
  channel: ShareChannel,
  placement: string,
): void {
  track('share_initiated', {
    surface: inferSurfaceFromPath(
      typeof window !== 'undefined' ? window.location.pathname : '',
    ),
    channel,
    placement,
    promo_title: item.promoTitle,
    promo_type: item.promoType,
    team_slug: item.teamSlug,
    sport: normalizeSport(item.sport),
  });
}
