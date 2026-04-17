import type { Team, Promo, PromoType, Venue } from './types';
import { PROMO_TYPE_LABELS } from './types';

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function resolveIcon(title: string, type: PromoType, iconFromData: string): string {
  const t = (title || '').toLowerCase();

  if (/fireworks/.test(t)) return '💥';

  const looksLikeBobblehead = /bobblehead|figurine|figure|statue/.test(t);
  const icon = (iconFromData || '').trim();

  if (!icon || icon === '💥') {
    if (looksLikeBobblehead) return '🎎';
    if (type === 'giveaway') return '🎁';
  }

  if (!icon) {
    if (type === 'theme') return '🎭';
    if (type === 'kids') return '👦';
    if (type === 'food') return '🌭';
    return '🎁';
  }

  return icon;
}

export function dedupePromos<T extends { date: string; title: string }>(
  promos: T[],
  extraKey?: (p: T) => string,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of promos) {
    const key = `${extraKey ? extraKey(p) : ''}::${p.date}::${(p.title || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function formatDateReadable(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function getPromosByType(promos: Promo[], type: PromoType): Promo[] {
  return promos.filter((p) => p.type === type);
}

export function getTopGiveaway(promos: Promo[]): Promo | null {
  const giveaways = getPromosByType(promos, 'giveaway');
  if (giveaways.length === 0) return null;

  // Prioritize bobbleheads and jerseys as highest-interest
  const priority = giveaways.find(
    (p) =>
      /bobblehead/i.test(p.title) ||
      /bobblehead/i.test(p.description)
  );
  if (priority) return priority;

  const jersey = giveaways.find(
    (p) =>
      /jersey|replica/i.test(p.title) ||
      /jersey|replica/i.test(p.description)
  );
  if (jersey) return jersey;

  // Fall back to highlighted, then first upcoming
  const highlighted = giveaways.find((p) => p.highlight);
  return highlighted || giveaways[0];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateTeamFAQs(
  team: Team,
  promos: Promo[],
  venue: Venue | null,
  promoCounts: Record<PromoType, number>,
): FAQItem[] {
  const year = getCurrentYear();
  const fullName = `${team.city} ${team.name}`;
  const venueName = venue?.name || 'their home stadium';
  const faqs: FAQItem[] = [];

  // 1. Total promo count (always shown if promos exist)
  if (promos.length > 0) {
    const parts: string[] = [];
    if (promoCounts.giveaway > 0)
      parts.push(`${promoCounts.giveaway} giveaway night${promoCounts.giveaway !== 1 ? 's' : ''}`);
    if (promoCounts.theme > 0)
      parts.push(`${promoCounts.theme} theme night${promoCounts.theme !== 1 ? 's' : ''}`);
    if (promoCounts.food > 0)
      parts.push(`${promoCounts.food} food deal event${promoCounts.food !== 1 ? 's' : ''}`);
    if (promoCounts.kids > 0)
      parts.push(`${promoCounts.kids} kids/family event${promoCounts.kids !== 1 ? 's' : ''}`);

    faqs.push({
      question: `How many promotional nights do the ${team.name} have in ${year}?`,
      answer: `The ${fullName} have ${promos.length} promotional events scheduled for the ${year} season, including ${parts.join(', ')}. These events take place at ${venueName}${venue?.address ? ` in ${venue.address.split(',').slice(-2, -1)[0]?.trim() || venue.address}` : ''}.`,
    });
  }

  // 2. Best giveaway (skip if 0 giveaways)
  if (promoCounts.giveaway > 0) {
    const top = getTopGiveaway(promos);
    if (top) {
      faqs.push({
        question: `What is the best ${team.name} giveaway night in ${year}?`,
        answer: `The most anticipated ${team.name} giveaway in ${year} is ${top.title} on ${formatDateReadable(top.date)}${top.opponent ? ` against the ${top.opponent}` : ''}. ${top.description || `${PROMO_TYPE_LABELS.giveaway} nights typically go to the first fans through the gates, so arrive early when gates open.`}`,
      });
    }
  }

  // 3. Food deals (skip if 0)
  if (promoCounts.food > 0) {
    const foodPromos = getPromosByType(promos, 'food');
    const foodList = foodPromos
      .slice(0, 3)
      .map((p) => p.title)
      .join(', ');

    faqs.push({
      question: `Does ${venueName} have food deals on game days?`,
      answer: `Yes. ${venueName} offers food deal promotions during ${fullName} games. Scheduled food deals include ${foodList}${foodPromos.length > 3 ? `, and ${foodPromos.length - 3} more` : ''}. Check the PromoNight app for specific dates and details for each food promotion.`,
    });
  }

  // 4. Kids events (skip if 0)
  if (promoCounts.kids > 0) {
    const kidsPromos = getPromosByType(promos, 'kids');
    const kidsList = kidsPromos
      .slice(0, 3)
      .map((p) => `${p.title} (${formatDateReadable(p.date)})`)
      .join(', ');

    faqs.push({
      question: `When are ${team.name} kids and family events in ${year}?`,
      answer: `The ${fullName} have ${promoCounts.kids} kids and family event${promoCounts.kids !== 1 ? 's' : ''} scheduled for ${year}. Upcoming family events include ${kidsList}${kidsPromos.length > 3 ? `, and ${kidsPromos.length - 3} more throughout the season` : ''}. These events are designed for young fans and families attending games at ${venueName}.`,
    });
  }

  // 5. How to track (always shown)
  faqs.push({
    question: `How can I track ${fullName} promotional events?`,
    answer: `PromoNight is a free app that tracks every giveaway, theme night, food deal, and promotion for the ${fullName} and 166 other teams across MLB, NBA, NFL, NHL, MLS, and WNBA. Download it on iOS or Android to get a calendar view of all upcoming promos and push notifications before game day.`,
  });

  return faqs;
}
