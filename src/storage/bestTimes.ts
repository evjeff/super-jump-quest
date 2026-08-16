/**
 * The one place in the game that remembers anything after you close the tab.
 *
 * It keeps the best times in the browser's own little notebook (localStorage).
 * Every call is wrapped in a "if this doesn't work, never mind": a browser can
 * have storage switched off, or be full, or be in a private window that refuses
 * to write. In all of those the game plays exactly the same — it just forgets
 * your records when you leave.
 *
 * Deciding whether a run is a record, and what the saved data may look like,
 * is not decided here: that's `src/game/timer.ts`, which is pure and tested.
 */

import type { BestTimes } from '../game/timer'
import { readBestTimes } from '../game/timer'

/** The name the records are filed under in the browser's notebook. */
const STORAGE_KEY = 'super-jump-quest.best-times'

/** The notebook, or nothing if this browser won't let us near it. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Every best time we've saved. An empty list if there aren't any, or if we can't look. */
export function loadBestTimes(): BestTimes {
  try {
    return readBestTimes(storage()?.getItem(STORAGE_KEY) ?? null)
  } catch {
    return {}
  }
}

/** Write the records down. Silently does nothing if this browser won't let us. */
export function saveBestTimes(times: BestTimes): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(times))
  } catch {
    // Storage full, switched off, or a private window. Not worth spoiling a
    // game over — he just won't have a record waiting next time.
  }
}
