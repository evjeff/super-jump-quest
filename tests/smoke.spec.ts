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

  expect(await hud(page)).toContain('LEVEL 1')

  await collectEveryCoin(page)
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

  await collectEveryCoin(page)
  expect(await banner(page)).toContain('YOU WIN!')

  await holdKey(page, 'KeyR')
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('LEVEL 1')
  expect(await hud(page)).toContain('SCORE 00000')

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
  await collectFirstCoin(page)
  expect(await hud(page)).not.toContain('SCORE 00000')
  expect(await banner(page)).toBe('')

  await holdKey(page, 'KeyR')
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('SCORE 00000')
  expect(await hud(page)).toContain('LEVEL 1')
})

declare global {
  interface Window {
    /** Notes the browser was asked to play, counted by the audio test above. */
    __NOTES_PLAYED__?: number
  }
}

type PlayerProbe = { player?: { y: number; body?: { blocked: { down: boolean } } } }

type CoinSprite = { x: number; y: number; active: boolean; setPosition(x: number, y: number): void }
type LevelProbe = {
  player: { setVelocity(x: number, y: number): void } & CoinSprite
  coins: { getChildren(): CoinSprite[] }
  hud: { text: string }
  banner: { text: string }
  level: { coins: unknown[]; platforms: unknown[] }
  jumpState: { jumpsUsed: number }
  squashStartedAt: number
}

async function hud(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as LevelProbe
    return scene.hud.text
  })
}

async function banner(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as LevelProbe
    return scene.banner.text
  })
}

async function levelState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as LevelProbe
    return {
      hud: scene.hud.text,
      banner: scene.banner.text,
      platforms: scene.level.platforms.length,
      coinsInLevel: scene.level.coins.length,
      coinsAlive: scene.coins.getChildren().filter((coin) => coin.active).length,
      jumpsUsed: scene.jumpState.jumpsUsed,
      squashCleared: scene.squashStartedAt === Number.NEGATIVE_INFINITY,
    }
  })
}

/** Finish a level without playing it: park him on each coin, one frame apart. */
async function collectEveryCoin(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as LevelProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    for (const coin of [...scene.coins.getChildren()]) {
      if (!coin.active) continue
      scene.player.setVelocity(0, 0)
      scene.player.setPosition(coin.x, coin.y)
      await nextFrame()
      await nextFrame()
    }
  })
}

/** Park him on the first coin only, leaving the rest of the level unfinished. */
async function collectFirstCoin(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as LevelProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const coin = scene.coins.getChildren()[0]
    // A level with no coins would leave the score at zero, and the check back
    // in the test says so out loud rather than passing on an empty level.
    if (!coin) return
    scene.player.setVelocity(0, 0)
    scene.player.setPosition(coin.x, coin.y)
    await nextFrame()
    await nextFrame()
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
