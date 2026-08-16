import { expect, test } from '@playwright/test'

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
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))

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
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))

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

declare global {
  interface Window {
    /** Notes the browser was asked to play, counted by the audio test above. */
    __NOTES_PLAYED__?: number
  }
}

type PlayerProbe = { player?: { y: number; body?: { blocked: { down: boolean } } } }

async function notesPlayed(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => window.__NOTES_PLAYED__ ?? 0)
}

async function playerY(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as PlayerProbe | undefined
    return scene?.player?.y ?? Number.NaN
  })
}

async function playerIsGrounded(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as PlayerProbe | undefined
    return scene?.player?.body?.blocked.down ?? false
  })
}
