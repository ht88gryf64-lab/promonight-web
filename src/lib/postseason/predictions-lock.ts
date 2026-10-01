// The content of each locked computer bracket, pinned. SERVER ONLY: it uses
// node:crypto, so no client component may import it (predictions.ts is kept
// free of it for the same reason).
//
// WHY. The five fingerprints identify the locked inputs and the reviewed
// artifact, but the page shows more than they cover: every pick, chance,
// length and coin flip, the champion, the title odds, the run count and the
// three dates. A document carrying the right fingerprints and different
// picks would publish a bracket nobody locked under a methodology that says
// any change would show. So the fields the page shows are pinned too, as one
// sha256 over a canonical form of the mapped document. The pinned values
// were computed from the stored documents (src/lib/postseason/__fixtures__/
// predicted.*.json), whose picks, chances, lengths, title odds and champion
// are tested equal to the pipeline's golden references, and whose freeze
// instants are tested equal to the pipeline's pins.json.
import { createHash } from 'node:crypto';
import { fingerprintsMatchLock, type PredictedBracket } from './predictions';

/** The fields the page shows, in a fixed order, as one string. */
export function lockedContent(p: PredictedBracket): string {
  return JSON.stringify({
    league: p.league,
    season: p.season,
    simRuns: p.simRuns,
    frozenAt: p.frozenAt,
    computedAt: p.computedAt,
    lockedAt: p.lockedAt,
    champion: p.champion,
    series: p.series.map((s) => [
      s.seriesKey,
      s.round,
      s.conference,
      s.bestOf,
      s.higher.slug,
      s.higher.seed,
      s.lower.slug,
      s.lower.seed,
      s.pick,
      s.pickProbability,
      s.modalSeriesLength,
      s.coinFlip,
    ]),
    titleOdds: p.titleOdds.map((o) => [o.slug, o.odds]),
  });
}

export function lockedContentSha256(p: PredictedBracket): string {
  return createHash('sha256').update(lockedContent(p)).digest('hex');
}

export const LOCKED_CONTENT_SHA256: Readonly<Record<string, string>> = {
  WNBA_2026: '9ad946073545f60f69ed141137fdb2dbb353cc98f96ebd2b34d404f3191264dd',
  MLB_2026: '17c5ce6fed2464f5f41fc41c38c7c536c8027eeb02f86d69e036cf675539a4ff',
};

export type LockCheck = 'ok' | 'fingerprint-mismatch' | 'content-mismatch';

/** Is this the bracket that was locked: its five fingerprints, and every
 *  field the page shows? */
export function checkLock(p: PredictedBracket): LockCheck {
  if (!fingerprintsMatchLock(p)) return 'fingerprint-mismatch';
  const want = LOCKED_CONTENT_SHA256[`${p.league}_${p.season}`];
  return want && lockedContentSha256(p) === want ? 'ok' : 'content-mismatch';
}
