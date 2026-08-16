/**
 * The stopwatch rules — pure logic, no Phaser, no browser.
 *
 * The clock times ONE LEVEL: it starts when the level starts and stops the
 * moment you grab the last coin. That matches the coin counter next to it, and
 * it means "my best time on The Tall Tower" is a thing you can chase.
 *
 * Nothing in here reads or writes the browser's memory. Saving lives in
 * `src/storage/bestTimes.ts`, which hands the saved text to `readBestTimes`
 * below and gets a clean answer back.
 */

/** The highest the clock can show: 99:59.9. Longer than that and it just sits there. */
const CLOCK_LIMIT_MS = 99 * 60_000 + 59_900

/**
 * The clock the way you read it on screen: minutes, seconds and one tenth,
 * like `0:07.4`.
 *
 * It always counts DOWN to the nearest tenth, never up, so it can't show a
 * tenth you haven't actually spent yet. Anything that isn't a real, positive
 * number of milliseconds shows `0:00.0` — a broken clock should say zero, not
 * "NaN". And it stops climbing at 99:59.9, so leaving the game running all
 * afternoon can't stretch the line of text across the screen.
 */
export function formatTime(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.min(ms, CLOCK_LIMIT_MS) : 0

  const tenths = Math.floor(safe / 100)
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor(tenths / 10) % 60
  const tenth = tenths % 10

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenth}`
}

/**
 * Every best time we remember: the level's name, and how many milliseconds the
 * fastest finish took. Names rather than level numbers, so shuffling the list
 * of levels around doesn't hand your Tall Tower record to some other level.
 */
export type BestTimes = Record<string, number>

/** What finishing a level did to the records. */
export interface FinishResult {
  /** The records to save, with this run already folded in. */
  times: BestTimes
  /** The record for this level now — this run if it was a new best, the old one if not. */
  best: number
  /** Was this run a new record? */
  isNewBest: boolean
}

/**
 * Turn saved text back into best times, throwing away anything that doesn't
 * look like a time.
 *
 * A browser's saved data can come back as leftovers from an older version, as
 * something another tab scribbled over, or as nothing at all. None of that is
 * allowed to break the game: whatever we can't understand is simply forgotten,
 * and the level starts again with no record to beat.
 */
export function readBestTimes(raw: string | null): BestTimes {
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }

  // Must be a plain bag of names and numbers. A list, a word or a number on its
  // own is somebody else's data, not ours.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const times: BestTimes = {}
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    // A finish always takes at least a moment, so zero or less is impossible.
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) times[name] = value
  }
  return times
}

/** The record for one level, or `null` if nobody has finished it yet. */
export function bestTimeFor(times: BestTimes, levelName: string): number | null {
  return times[levelName] ?? null
}

/**
 * You just finished `levelName` in `timeMs`. Is that a new record?
 *
 * The first finish is always a record — there was nothing to beat. After that
 * you have to be strictly faster: matching your old time to the tenth leaves
 * the record where it is, because a record is something you BEAT, not something
 * you tie, and a "NEW BEST TIME!" for the same time as last time would be a lie.
 */
export function recordTime(times: BestTimes, levelName: string, timeMs: number): FinishResult {
  const previous = bestTimeFor(times, levelName)
  const isNewBest = previous === null || timeMs < previous
  if (!isNewBest) return { times, best: previous, isNewBest: false }

  return { times: { ...times, [levelName]: timeMs }, best: timeMs, isNewBest: true }
}

/** The two lines the finish banner adds: how long you took, and the record. */
export function finishBannerLines(timeMs: number, result: FinishResult): string[] {
  const second = result.isNewBest ? 'NEW BEST TIME!' : `BEST ${formatTime(result.best)}`
  return [`TIME ${formatTime(timeMs)}`, second]
}
