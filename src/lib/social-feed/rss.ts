// RSS 2.0 builder for the social feed (/feeds/social.xml), consumed by Vista
// Social's RSS import. Pure: every value comes from the items and the `now`
// passed in, so the same input always yields byte-identical XML.
//
// Item copy is built only from stored promo fields. No counts, no
// completeness language, no CDATA; every text node and attribute is escaped.

import { buildUtmUrl } from '@/lib/utm';
import { cleanText } from './text';
import { addDaysYMD, FEED_TIME_ZONE, feedKey } from './select';

export const SITE_URL = 'https://www.getpromonight.com';
export const FEED_URL = `${SITE_URL}/feeds/social.xml`;
export const FEED_TITLE = 'PromoNight: Promos This Week';
export const FEED_DESCRIPTION =
  'Upcoming giveaways and theme nights at pro sports games, from PromoNight.';
export const IMAGE_SIZE = 1080;

export interface RssItemInput {
  promoId: string;
  teamId: string;
  sportSlug: string;
  teamName: string;
  title: string;
  date: string;
  opponent?: string | null;
  venue?: string | null;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-09-27" -> "Sun Sep 27". Calendar math only, no time zone involved.
export function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
}

const centralHourFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: FEED_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

// The instant that is 12:00 wall-clock in America/Chicago on `ymd`. Noon is
// never inside a DST transition, so exactly one of the two offsets matches.
export function centralNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  for (const offsetHours of [5, 6]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, 12 + offsetHours));
    if (centralHourFormat.format(candidate) === '12') return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, 18));
}

// Promo date minus 7 days at 12:00 Central, stable across rebuilds. When that
// instant is still ahead of `now` (a day-7 item before noon Central), clamp to
// `now` rounded down to the hour.
export function pubDateFor(ymd: string, now: Date): Date {
  const stable = centralNoon(addDaysYMD(ymd, -7));
  if (stable.getTime() <= now.getTime()) return stable;
  const floored = new Date(now.getTime());
  floored.setUTCMinutes(0, 0, 0);
  return floored;
}

export function teamPageUrl(sportSlug: string, teamId: string): string {
  return `${SITE_URL}/${sportSlug}/${teamId}`;
}

export function itemLink(item: Pick<RssItemInput, 'promoId' | 'sportSlug' | 'teamId'>): string {
  return buildUtmUrl(teamPageUrl(item.sportSlug, item.teamId), {
    source: 'promonight_feed',
    medium: 'social',
    campaign: 'social_rss',
    content: feedKey(item.teamId, item.promoId),
  });
}

export function imageUrl(teamId: string, promoId: string): string {
  return `${SITE_URL}/feeds/social/image/${encodeURIComponent(feedKey(teamId, promoId))}`;
}

export function itemTitle(item: RssItemInput): string {
  const head = [cleanText(item.teamName), cleanText(item.title)].filter(Boolean).join(' ');
  return `${head}, ${formatShortDate(item.date)}`;
}

export function itemDescription(item: RssItemInput): string {
  let text = cleanText(item.title);
  const venue = cleanText(item.venue);
  const opponent = cleanText(item.opponent);
  if (venue) text += ` at ${venue}`;
  if (opponent) text += ` vs ${opponent}`;
  return `${text} on ${formatShortDate(item.date)}.`;
}

function renderItem(item: RssItemInput, now: Date): string {
  const img = escapeXml(imageUrl(item.teamId, item.promoId));
  return [
    '    <item>',
    `      <title>${escapeXml(itemTitle(item))}</title>`,
    `      <link>${escapeXml(itemLink(item))}</link>`,
    `      <description>${escapeXml(itemDescription(item))}</description>`,
    `      <guid isPermaLink="false">${escapeXml(feedKey(item.teamId, item.promoId))}</guid>`,
    `      <pubDate>${pubDateFor(item.date, now).toUTCString()}</pubDate>`,
    `      <enclosure url="${img}" type="image/png" length="0"/>`,
    `      <media:content url="${img}" medium="image" type="image/png" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}"/>`,
    '    </item>',
  ].join('\n');
}

export function buildSocialRss(items: RssItemInput[], now: Date): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    '  <channel>',
    `    <title>${escapeXml(FEED_TITLE)}</title>`,
    `    <link>${SITE_URL}</link>`,
    `    <description>${escapeXml(FEED_DESCRIPTION)}</description>`,
    '    <language>en-us</language>',
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>`,
    '    <ttl>60</ttl>',
    ...items.map((item) => renderItem(item, now)),
    '  </channel>',
    '</rss>',
    '',
  ];
  return lines.join('\n');
}
