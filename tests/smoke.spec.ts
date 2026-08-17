import { expect, test } from '@playwright/test'
import type { GameProbe } from './probe'
import {
  banner,
  collectCoins,
  hud,
  levelTimeMs,
  playerIsGrounded,
  playerY,
  waitForGameScene,
  watchForErrors,
} from './probe'

/**
 * The single most valuable guardrail in this repo.
 *
 * Types can check and unit tests can pass while the game still shows a black
 * screen. This test opens the real game in a real browser and proves it boots,
 * renders, and reaches the playable scene without console errors.
 *
 * If this test passes, the game runs. If it fails, do not merge.
 */

test('the game boots and reaches the playable scene', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')

  // A canvas exists and has real dimensions.
  const canvas = page.locator('#game canvas')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(0)
  expect(box?.height ?? 0).toBeGreaterThan(0)

  // The Phaser game booted and handed off to the Game scene.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__GAME__
          if (!game?.isRunning) return false
          return game.scene.isActive('Game')
        }),
      { timeout: 15_000 },
    )
    .toBe(true)

  expect(consoleErrors).toEqual([])
})

test('the player can jump', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')

  await expect
    .poll(() => page.evaluate(() => window.__GAME__?.scene.isActive('Game') ?? false), {
      timeout: 15_000,
    })
    .toBe(true)

  // The player spawns in mid-air. Wait until he has landed so this exercises a
  // real ground jump rather than an accidental air jump.
  await expect.poll(() => playerIsGrounded(page), { timeout: 10_000 }).toBe(true)

  const yBefore = await playerY(page)

  // Hold the key across at least one render frame. Phaser's Key.onUp clears the
  // "just pressed" flag, so a down+up inside a single frame is never seen.
  await page.keyboard.down('Space')
  await page.waitForTimeout(80)
  await page.keyboard.up('Space')
  await page.waitForTimeout(150)

  const yAfter = await playerY(page)

  // Screen coordinates grow downward, so a jump makes y smaller.
  expect(yAfter).toBeLessThan(yBefore)

  expect(consoleErrors).toEqual([])
})

/**
 * The audio equivalent of the black-screen test.
 *
 * The sound recipes are unit tested, but nothing in a unit test proves they
 * reach a speaker: one wrong wire in `src/audio/beeper.ts` and the game goes
 * silent with every check still green. So count the notes the browser is
 * actually asked to play.
 */
test('jumping actually plays a note', async ({ page }) => {
  await page.addInitScript(() => {
    window.__NOTES_PLAYED__ = 0
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function counted() {
      const oscillator = createOscillator.call(this)
      const start = oscillator.start.bind(oscillator)
      oscillator.start = (when?: number) => {
        window.__NOTES_PLAYED__ = (window.__NOTES_PLAYED__ ?? 0) + 1
        start(when)
      }
      return oscillator
    }
  })

  await page.goto('/')

  await expect
    .poll(() => page.evaluate(() => window.__GAME__?.scene.isActive('Game') ?? false), {
      timeout: 15_000,
    })
    .toBe(true)

  // Browsers keep audio asleep until the player presses something. This press
  // is the wake-up; it is not the jump under test.
  await page.keyboard.press('KeyA')

  const audioAwake = await page
    .waitForFunction(
      () => (window.__GAME__?.sound as { context?: AudioContext })?.context?.state === 'running',
      null,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false)

  // Some environments refuse to start audio at all. That is the browser's
  // choice, not a broken game — say so out loud instead of failing.
  test.skip(!audioAwake, 'this browser never woke its audio up')

  await expect.poll(() => playerIsGrounded(page), { timeout: 10_000 }).toBe(true)

  const notesBefore = await notesPlayed(page)

  await page.keyboard.down('Space')
  await page.waitForTimeout(80)
  await page.keyboard.up('Space')
  await page.waitForTimeout(150)

  expect(await notesPlayed(page)).toBeGreaterThan(notesBefore)
})

/**
 * The guardrail for having more than one level.
 *
 * Finishing a level and walking into the next one is the one thing unit tests
 * can't see: the rules are pure and tested, but only a real browser proves the
 * second level actually builds itself, with its own platforms and coins and
 * nothing left over from the level before.
 *
 * It plays the game by teleporting him onto each coin one frame at a time
 * rather than by pressing keys, so it finishes in a second and always does the
 * same thing.
 */
test('finishing a level starts the next one, and finishing the last one wins', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => window.__GAME__?.scene.isActive('Game') ?? false), {
      timeout: 15_000,
    })
    .toBe(true)

  expect(await hud(page)).toContain('LEVEL 1')

  // Dawdle before finishing, so level 1 puts a second and a half on the clock.
  // A clock that forgot to go back to zero would carry that into level 2, and
  // the checks below would see it.
  await page.waitForTimeout(1500)

  await collectCoins(page)
  expect(await banner(page)).toContain('LEVEL 1 DONE!')

  // The points he earned in level 1 have to travel with him into level 2.
  const scoreAfterLevel1 = (await hud(page)).match(/SCORE \d+/)?.[0] ?? ''
  expect(scoreAfterLevel1).not.toBe('SCORE 00000')

  // Phaser ignores a key that goes down and up inside one frame, so hold it.
  await holdKey(page, 'KeyN')
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('LEVEL 2')

  const level2 = await levelState(page)
  expect(level2.coinsAlive).toBe(level2.coinsInLevel)
  expect(level2.coinsInLevel).toBeGreaterThan(0)
  expect(level2.platforms).toBeGreaterThan(0)
  // Nothing leaks across: fresh coin count, fresh jumps, no leftover squash.
  expect(level2.hud).toContain('COINS 0/')
  expect(level2.hud).toContain(scoreAfterLevel1)
  expect(level2.banner).toBe('')
  expect(level2.jumpsUsed).toBe(0)
  expect(level2.squashCleared).toBe(true)
  // ...and the clock starts the new level from zero rather than carrying on.
  expect(level2.levelTimeMs).toBeLessThan(600)
  expect(level2.hud).toContain('THIS LEVEL 0:00')

  // Dawdle again, so the same check after R has something to catch.
  await page.waitForTimeout(1500)

  await collectCoins(page)
  expect(await banner(page)).toContain('YOU WIN!')

  await holdKey(page, 'KeyR')
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('LEVEL 1')
  expect(await hud(page)).toContain('SCORE 00000')

  // Starting the whole game over gives him a fresh clock too.
  const afterRestart = await levelState(page)
  expect(afterRestart.levelTimeMs).toBeLessThan(600)
  expect(afterRestart.hud).toContain('THIS LEVEL 0:00')

  expect(consoleErrors).toEqual([])
})

/**
 * The page and the README both promise that R starts over. It has to work while
 * he is still playing, not only on the win screen — being stuck on a hard jump
 * with no way back except reloading the page is how a Saturday morning ends.
 */
test('R starts the game over in the middle of a level', async ({ page }) => {
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => window.__GAME__?.scene.isActive('Game') ?? false), {
      timeout: 15_000,
    })
    .toBe(true)

  // One coin, so there is something for the restart to wipe, and six left over
  // so the level is still being played rather than finished.
  await collectCoins(page, 1)
  expect(await hud(page)).not.toContain('SCORE 00000')
  expect(await banner(page)).toBe('')

  await holdKey(page, 'KeyR')
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('SCORE 00000')
  expect(await hud(page)).toContain('LEVEL 1')
})

/**
 * The guardrail for remembering anything.
 *
 * The clock's sums and the "is this a record?" rule are unit tested, but only a
 * real browser proves the clock is wired to the game's own frames, that it
 * stops when the level does, and that a best time written into the browser's
 * memory is still there after a reload — including when that memory comes back
 * as nonsense, which a real browser will do to you one day.
 */
test('the level clock runs, stops at the finish, and the best time is remembered', async ({
  page,
}) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await waitForGameScene(page)

  // A level nobody has finished has a clock but nothing to beat yet.
  expect(await hud(page)).toContain('THIS LEVEL 0:0')
  expect(await hud(page)).not.toContain('BEST')

  // It counts up.
  const atStart = await hud(page)
  await page.waitForTimeout(1200)
  expect(await hud(page)).not.toBe(atStart)

  // Finishing stops it dead: the banner must not sit there racking up time.
  await collectCoins(page)
  expect(await banner(page)).toContain('NEW BEST TIME!')
  const atFinish = await levelTimeMs(page)
  await page.waitForTimeout(500)
  expect(await levelTimeMs(page)).toBe(atFinish)

  // The number written down has to be the number the clock showed. Take the
  // time straight off the banner and insist the record matches it, so a game
  // that remembers some other number entirely can't slip past.
  const shown = (await banner(page)).match(/TIME (\d+:\d\d\.\d)/)?.[1] ?? ''
  expect(shown).not.toBe('')
  expect(await hud(page)).toContain(`BEST ${shown}`)

  // The record outlives the page — and it's still the same number afterwards.
  const saved = await page.evaluate(() => localStorage.getItem('super-jump-quest.best-times'))
  expect(saved).toContain('First Steps')
  await page.reload()
  await waitForGameScene(page)
  expect(await hud(page)).toContain(`BEST ${shown}`)

  // ...and scribbled-over memory is forgotten rather than shown as NaN.
  await page.evaluate(() => localStorage.setItem('super-jump-quest.best-times', 'not json at all'))
  await page.reload()
  await waitForGameScene(page)
  expect(await hud(page)).toContain('THIS LEVEL 0:0')
  expect(await hud(page)).not.toContain('NaN')
  expect(await hud(page)).not.toContain('BEST')

  expect(consoleErrors).toEqual([])
})

declare global {
  interface Window {
    /** Notes the browser was asked to play, counted by the audio test above. */
    __NOTES_PLAYED__?: number
  }
}

async function levelState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return {
      hud: scene.hud.text,
      banner: scene.banner.text,
      platforms: scene.level.platforms.length,
      coinsInLevel: scene.level.coins.length,
      coinsAlive: scene.coins.getChildren().filter((coin) => coin.active).length,
      jumpsUsed: scene.jumpState.jumpsUsed,
      squashCleared: scene.squashStartedAt === Number.NEGATIVE_INFINITY,
      levelTimeMs: scene.levelTimeMs,
    }
  })
}

async function holdKey(page: import('@playwright/test').Page, key: string): Promise<void> {
  await page.keyboard.down(key)
  await page.waitForTimeout(80)
  await page.keyboard.up(key)
}

async function notesPlayed(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => window.__NOTES_PLAYED__ ?? 0)
}
