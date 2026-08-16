/**
 * What happens when you finish a level — pure logic, no Phaser, no browser.
 *
 * There is exactly one question here: you just picked up the last coin in a
 * level, so is there another level waiting, or have you beaten the whole game?
 */

/** Where the player goes next. */
export type Progress =
  /** There's more to play. `levelIndex` is the level to load (0 = the first). */
  | { kind: 'next-level'; levelIndex: number }
  /** That was the last one. Roll the fanfare. */
  | { kind: 'game-complete' }

/**
 * You just finished the level at `finishedIndex`, out of `levelCount` levels.
 *
 * Levels are numbered from 0 inside the code, so finishing level 0 (the one a
 * person calls "level 1") hands you level 1 (the one a person calls "level 2").
 *
 * A level number that doesn't exist counts as finishing the game. That can't
 * happen from playing, but "you win" is a much kinder answer than trying to
 * load a level that isn't there.
 */
export function afterLevel(finishedIndex: number, levelCount: number): Progress {
  const nextIndex = finishedIndex + 1
  if (finishedIndex < 0 || nextIndex >= levelCount) return { kind: 'game-complete' }
  return { kind: 'next-level', levelIndex: nextIndex }
}

/**
 * The big words in the middle of the screen.
 *
 * People count levels from 1, so everything shown here is one bigger than the
 * numbers the code uses.
 *
 * `extraLines` is for news about the run you just finished — how long it took,
 * whether it was a record. They go directly under the headline, because that's
 * where your eyes already are, and above the "press a key" lines, which you
 * only read once you're done cheering.
 */
export function bannerText(progress: Progress, extraLines: string[] = []): string {
  const lines =
    progress.kind === 'game-complete'
      ? ['YOU WIN!', ...extraLines, 'press R to play again from level 1']
      : [
          `LEVEL ${progress.levelIndex} DONE!`,
          ...extraLines,
          `press N for level ${progress.levelIndex + 1}`,
          'press R to start over at level 1',
        ]
  return lines.join('\n')
}
