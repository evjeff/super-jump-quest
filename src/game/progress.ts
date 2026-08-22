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
  /**
   * You beat the levels we drew by hand. Roll the fanfare.
   *
   * `levelIndex` is there when the game doesn't stop afterwards: it's the
   * first made-up level, waiting on the other side of the YOU WIN!. Left out
   * altogether when that really is the end of the game.
   */
  | { kind: 'game-complete'; levelIndex?: number }

/**
 * You just finished the level at `finishedIndex`, out of `levelCount`
 * hand-made levels.
 *
 * Levels are numbered from 0 inside the code, so finishing level 0 (the one a
 * person calls "level 1") hands you level 1 (the one a person calls "level 2").
 *
 * `endless` is `TUNING.levels.endless`. Leave it off and this is the old
 * three-level game, right down to the last full stop: you finish level 3 and
 * that's it.
 *
 * Turn it on and the game never runs out — but beating level 3 is STILL a win.
 * It's the last level anybody drew by hand, and finishing it deserves the
 * fanfare it has always had. So the answer is "you win, AND here is level 4",
 * and the banner says both. After that it's ordinary levels all the way.
 *
 * A level number that doesn't exist counts as finishing the game. That can't
 * happen from playing, but "you win" is a much kinder answer than trying to
 * load a level that isn't there.
 */
export function afterLevel(finishedIndex: number, levelCount: number, endless = false): Progress {
  const nextIndex = finishedIndex + 1
  if (finishedIndex < 0) return { kind: 'game-complete' }

  if (!endless) {
    if (nextIndex >= levelCount) return { kind: 'game-complete' }
    return { kind: 'next-level', levelIndex: nextIndex }
  }

  // The one moment that is both at once: the hand-made levels are finished,
  // and there is more.
  if (nextIndex === levelCount) return { kind: 'game-complete', levelIndex: nextIndex }
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
  const headline =
    progress.kind === 'game-complete' ? 'YOU WIN!' : `LEVEL ${progress.levelIndex} DONE!`

  // Every ending except the true one — the last hand-made level with nothing
  // past it — has somewhere to go next, and says so.
  const ending =
    progress.levelIndex === undefined
      ? [playAgainLine(controls)]
      : nextLevelLines(progress.levelIndex + 1, controls)

  return [headline, ...extraLines, ...ending].join('\n')
}

function playAgainLine(controls: ControlHint): string {
  // Short for the same reason as the lines below: see the note there.
  if (controls === 'touch') return 'tap to play again from level 1'
  // This is the end of the game, so the offer is the whole game again — and
  // that is SHIFT+R now. Plain R would only replay the level you just won.
  return 'press SHIFT+R to start over'
}

function nextLevelLines(nextLevelNumber: number, controls: ControlHint): string[] {
  // On a phone, "start over" is the ↻ button in the top corner rather than a
  // key — and it has to be named here, because a faint symbol in a corner is
  // not something a seven-year-old goes looking for on their own.
  // Kept short on purpose. The banner is drawn as one lump of 40px monospace,
  // centred, and it does not wrap: at that size 34 characters is already the
  // full 960 of the screen, and anything longer is simply cut off at BOTH ends.
  // `progress.test.ts` holds every line to that limit.
  if (controls === 'touch') {
    return [`tap the screen for level ${nextLevelNumber}`, 'or tap ↻ to start over']
  }
  // The second line used to offer the whole game over again. Nobody wanted
  // that here: you have just finished a level, and the thing you want is
  // another go at the one you nearly beat the record on. Starting over is
  // still there — it is SHIFT+R — but it isn't what the banner offers.
  return [`press N for level ${nextLevelNumber}`, 'press R to play this level again']
}
