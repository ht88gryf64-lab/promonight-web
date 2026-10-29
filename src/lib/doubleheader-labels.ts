// "Game 1" / "Game 2" labels for rows that share a date and an opponent.
//
// A doubleheader is two games on one date against one club. The spine stores
// them as two docs: game 1 carries no doubleheaderGame field and game 2 carries
// doubleheaderGame: 2 (src/lib/ingest-mlb.ts). Without a label the two rows
// read as the same game listed twice. The label is keyed on gameNumber when the
// doc has one and on order within the pair otherwise, so game 1 is "Game 1"
// even though its doc never says so.
//
// Pure over the contexts a schedule already holds. Single games get no entry,
// so a renderer that reads `labels.get(id)` prints nothing for them.
import type { GameContext } from './data';

function byGameOrder(a: GameContext, b: GameContext): number {
  const adh = a.game.doubleheaderGame ?? 0;
  const bdh = b.game.doubleheaderGame ?? 0;
  if (adh !== bdh) return adh - bdh;
  return (a.game.gameTime || '').localeCompare(b.game.gameTime || '');
}

export function doubleheaderLabels(contexts: readonly GameContext[]): Map<string, string> {
  const groups = new Map<string, GameContext[]>();
  for (const c of contexts) {
    const opponent = c.isHome ? c.game.awayTeamSlug : c.game.homeTeamSlug;
    const key = `${c.game.date}|${opponent}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  const labels = new Map<string, string>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Two docs for ONE game (a postponed or suspended game listed twice under
    // its gamePk, known-issues 66 and 67) are not a doubleheader. A pair that
    // shares an mlbGameId, or shares a doubleheaderGame number, gets no label
    // rather than "Game 2" twice.
    const gamePks = list.map((c) => c.game.mlbGameId).filter((n): n is number => typeof n === 'number');
    if (new Set(gamePks).size !== gamePks.length) continue;
    const numbers = list.map((c) => c.game.doubleheaderGame).filter((n): n is number => typeof n === 'number');
    if (new Set(numbers).size !== numbers.length) continue;
    list.sort(byGameOrder);
    list.forEach((c, i) => labels.set(c.game.id, `Game ${c.game.doubleheaderGame ?? i + 1}`));
  }
  return labels;
}
