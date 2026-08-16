/**
 * Scoring rules — pure logic, no Phaser, no browser.
 */

export interface ScoreState {
  points: number
  coinsCollected: number
}

/**
 * A fresh score. `startingPoints` is the score carried in from an earlier
 * level — the points keep adding up across the whole game, but the coin count
 * starts again, because each level has its own coins to find.
 */
export function createScoreState(startingPoints = 0): ScoreState {
  return { points: startingPoints, coinsCollected: 0 }
}

export function collectCoin(state: ScoreState, coinValue: number): ScoreState {
  return {
    points: state.points + coinValue,
    coinsCollected: state.coinsCollected + 1,
  }
}

/** Has the player picked up everything in the level? */
export function isLevelComplete(state: ScoreState, totalCoins: number): boolean {
  return totalCoins > 0 && state.coinsCollected >= totalCoins
}

/** Score shown on screen, zero-padded so the HUD doesn't jitter as it grows. */
export function formatScore(points: number): string {
  return points.toString().padStart(5, '0')
}
