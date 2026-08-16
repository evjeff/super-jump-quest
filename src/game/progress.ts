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

/** What the player has to work with: a keyboard, or a screen to poke. */
export type ControlHint = 'keys' | 'touch'

/**
 * The big words in the middle of the screen.
 *
 * People count levels from 1, so everything shown here is one bigger than the
 * numbers the code uses.
 *
 * `extraLines` is for news about the run you just finished — how long it took,
 * whether it was a record. They go directly under the headline, because that's
 * where your eyes already are, and above the "do this next" lines, which you
 * only read once you're done cheering.
 *
 * `controls` decides what those last lines ask for. A phone has no N key and no
 * R key, so telling a kid to press one is telling them the game is stuck.
 */
export function bannerText(
  progress: Progress,
  extraLines: string[] = [],
  controls: ControlHint = 'keys',
): string {
  const lines =
    progress.kind === 'game-complete'
      ? ['YOU WIN!', ...extraLines, ...playAgainLines(controls)]
      : [
          `LEVEL ${progress.levelIndex} DONE!`,
          ...extraLines,
          ...nextLevelLines(progress.levelIndex + 1, controls),
        ]
  return lines.join('\n')
}

function playAgainLines(controls: ControlHint): string[] {
  if (controls === 'touch') return ['tap the screen to play again from level 1']
  return ['press R to play again from level 1']
}

function nextLevelLines(nextLevelNumber: number, controls: ControlHint): string[] {
  // On a phone, "start over" is the ↻ button in the top corner rather than a
  // key — and it has to be named here, because a faint symbol in a corner is
  // not something a seven-year-old goes looking for on their own.
  // Kept short on purpose: the banner is drawn in one long line of big
  // monospace text, and a longer sentence than this runs off both edges of the
  // screen on the narrowest phone.
  if (controls === 'touch') {
    return [`tap the screen for level ${nextLevelNumber}`, 'or tap ↻ to start over']
  }
  return [`press N for level ${nextLevelNumber}`, 'press R to start over at level 1']
}
