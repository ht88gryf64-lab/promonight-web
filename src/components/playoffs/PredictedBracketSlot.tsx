'use client';

import type { ReactNode } from 'react';
import { useBracketControls } from './controls';

/**
 * RESERVED: the predicted bracket goes here.
 *
 * It is empty of a bracket today. No predicted bracket exists, and nothing
 * on the page says one does. What it holds is the locked-picks card, and
 * only for a league whose inputs were frozen.
 *
 * It already listens to the same controls as the real bracket above it: the
 * round and the conference the reader chose are on this element as data
 * attributes, and they move when the controls move. The predicted bracket
 * will read them from useBracketControls() the same way.
 *
 * It is a separate child of the page from the real bracket, on purpose, so
 * an ad unit can sit between the two and never inside either.
 */
export function PredictedBracketSlot({ children }: { children: ReactNode }) {
  const { round, conference } = useBracketControls();
  return (
    <div data-predicted-bracket-slot data-round={round} data-conference={conference ?? undefined}>
      {children}
    </div>
  );
}
