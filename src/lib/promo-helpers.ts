import type { Team, Promo, PromoType, Venue, PlayoffPromo } from './types';
import { PROMO_TYPE_LABELS } from './types';

const ROUND_LABELS: Record<string, string> = {
  first_round: 'First Round',
  conference_semifinals: 'Conference Semifinals',
  conference_finals: 'Conference Finals',
  nba_finals: 'NBA Finals',
  stanley_cup_final: 'Stanley Cup Final',
};

export function roundLabel(code: string): string {
  return ROUND_LABELS[code] ?? code.replace(/_/g, ' ');
}

// Returns an opponent only when all gameInfo matches across the team's playoff
// promos agree. 0 matches or 2+ distinct matches → null (drop opponent clause
// rather than hallucinate one). Today OKC has one distinct match ("Phoenix
// Suns") across 2 of 9 promos, which qualifies as consistent.
export function extractPlayoffOpponent(promos: PlayoffPromo[]): string | null {
  const opponents = new Set<string>();
  for (const p of promos) {
    const m = p.gameInfo.match(/\bvs\.?\s+([A-Z][^(,]+?)(?:\s*\(|$)/);
    if (m) opponents.add(m[1].trim().replace(/[.,]$/, ''));
  }
  return opponents.size === 1 ? [...opponents][0] : null;
}

function formatPlayoffDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Collapse promos that share a title (case-insensitive). Keeps first occurrence.
// Used to avoid "Playoff T-shirt on Every Seat, Playoff T-Shirt on Every Seat"
// in FAQ lists where the same promo was written once per game.
function dedupeByTitleCI(promos: PlayoffPromo[]): PlayoffPromo[] {
  const seen = new Set<string>();
  const out: PlayoffPromo[] = [];
  for (const p of promos) {
    const key = (p.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// "Wednesday, April 22 and Saturday, April 25" / "Apr 10, Apr 12, and Apr 14"
function joinDateList(isoDates: string[]): string {
  const readable = Array.from(new Set(isoDates.map(formatPlayoffDate)));
  if (readable.length === 0) return '';
  if (readable.length === 1) return readable[0];
  if (readable.length === 2) return `${readable[0]} and ${readable[1]}`;
  return `${readable.slice(0, -1).join(', ')}, and ${readable[readable.length - 1]}`;
}

export interface PlayoffFAQContext {
  promos: PlayoffPromo[];
  round: string;
  opponent: string | null;
}

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
  playoff?: PlayoffFAQContext,
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

  // 6. Playoff-specific questions (appended only when team is in the active playoff bracket)
  if (playoff && playoff.promos.length > 0) {
    const roundName = roundLabel(playoff.round);
    const opponentClause = playoff.opponent ? ` against the ${playoff.opponent}` : '';

    // "What playoff giveaways are the Team handing out..."
    const playoffGiveaways = playoff.promos.filter((p) => p.type === 'giveaway');
    if (playoffGiveaways.length > 0) {
      const uniqueGiveaways = dedupeByTitleCI(playoffGiveaways);
      const giveawayTitles = uniqueGiveaways.slice(0, 4).map((p) => p.title).join(', ');
      const more = uniqueGiveaways.length > 4 ? `, and ${uniqueGiveaways.length - 4} more` : '';
      // ":" when the list is the full set; "including" when we deduped titles
      // that repeat across games (count > unique titles).
      const connector =
        uniqueGiveaways.length === playoffGiveaways.length ? ': ' : ', including ';
      faqs.push({
        question: `What playoff giveaways are the ${team.name} handing out in ${roundName}?`,
        answer: `The ${fullName} have ${playoffGiveaways.length} scheduled playoff giveaway${playoffGiveaways.length !== 1 ? 's' : ''} during ${roundName}${opponentClause}${connector}${giveawayTitles}${more}. Giveaways are typically handed out to the first fans through the gates at ${venueName}, so arrive before puck drop or tipoff.`,
      });
    } else {
      // Generic fallback when no giveaway-typed playoff promos
      const uniquePromos = dedupeByTitleCI(playoff.promos);
      if (uniquePromos.length === 1 && playoff.promos.length > 1) {
        // Same title repeated across games — collapse to count + dates.
        // Venue is intentionally not appended here: it's already established
        // in the generic FAQ #1 and many such titles already embed the venue
        // name (e.g. "Pregame Party at Grand Casino Arena"), so a trailing
        // "at {venue}" would read as duplicate.
        const title = uniquePromos[0].title;
        const isoDates = playoff.promos
          .filter((p) => p.date)
          .map((p) => p.date as string);
        const dateClause = isoDates.length > 0 ? ` on ${joinDateList(isoDates)}` : '';
        faqs.push({
          question: `What playoff promotions do the ${team.name} have in ${roundName}?`,
          answer: `The ${fullName} have ${playoff.promos.length} scheduled playoff events during ${roundName}${opponentClause}: ${title}${dateClause}.`,
        });
      } else {
        const firstFew = uniquePromos.slice(0, 3).map((p) => p.title).join(', ');
        const connector =
          uniquePromos.length === playoff.promos.length ? ': ' : ', including ';
        faqs.push({
          question: `What playoff promotions do the ${team.name} have in ${roundName}?`,
          answer: `The ${fullName} have ${playoff.promos.length} scheduled playoff promotion${playoff.promos.length !== 1 ? 's' : ''} during ${roundName}${opponentClause}${connector}${firstFew}. See the full list on their team page for dates and details.`,
        });
      }
    }

    // "When are the Team home playoff games?"
    const datedPromos = playoff.promos.filter((p) => p.date);
    if (datedPromos.length > 0) {
      const gameDates = Array.from(
        new Set(datedPromos.map((p) => formatPlayoffDate(p.date as string))),
      );
      const dateList = gameDates.slice(0, 4).join(', ');
      faqs.push({
        question: `When are the ${team.name} home playoff games in ${roundName}?`,
        answer: `The ${fullName} host playoff home games at ${venueName} on ${dateList}${gameDates.length > 4 ? `, plus ${gameDates.length - 4} more if the series extends` : ''}. Specific start times depend on the league's playoff broadcast schedule. Check the official team site for confirmed times.`,
      });
    }
  }

  return faqs;
}
