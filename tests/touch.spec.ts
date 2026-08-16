import type { BrowserContext, CDPSession, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { TUNING } from '../src/tuning'

/**
 * The black-screen test, for a phone.
 *
 * This file runs only in the `phone` Playwright project: a real phone screen
 * size, in landscape, with touch turned on. Everything here uses genuine
 * browser touch events rather than clicks, because the thing most likely to
 * break is exactly the thing a click can't reach — two thumbs on two buttons at
 * the same time, which is how you run and jump.
 *
 * If this passes, the game is playable on a phone. If it fails, it isn't.
 */

test('the game boots on a phone, with its buttons on the screen', async ({ page }) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await waitForGameScene(page)

  // The picture fits the phone, with nothing hanging off the edge.
  const canvas = page.locator('#game canvas')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.width ?? 0).toBeGreaterThan(0)
  expect(box?.height ?? 0).toBeGreaterThan(0)
  expect(box?.width ?? 0).toBeLessThanOrEqual(viewport?.width ?? 0)
  expect(box?.height ?? 0).toBeLessThanOrEqual(viewport?.height ?? 0)

  // The keyboard instructions are off: there is no keyboard to instruct.
  await expect(page.locator('footer')).toBeHidden()

  // And the game drew itself some buttons.
  expect(await buttonIds(page)).toEqual(['jump', 'left', 'restart', 'right'])

  expect(errors).toEqual([])
})

test('the ▶ button walks him right, and letting go stops him', async ({ page, context }) => {
  await page.goto('/')
  await waitForGameScene(page)
  const fingers = await touchscreen(page, context)

  const startX = await playerX(page)

  await fingers.down(1, await buttonPoint(page, 'right'))
  await page.waitForTimeout(300)
  expect(await playerX(page)).toBeGreaterThan(startX)

  await fingers.up(1)
  await page.waitForTimeout(100)
  // Taking the finger off has to stop him. A button that sticks down would walk
  // him off the edge of the world with nothing on screen to explain it.
  expect(await playerVelocityX(page)).toBe(0)
})

test('the ▲ button jumps, and leaning on it does not spend the whole triple jump', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await waitForGameScene(page)
  const fingers = await touchscreen(page, context)

  // He spawns in mid-air; wait for the ground so this is a real ground jump.
  await expect.poll(() => playerIsGrounded(page), { timeout: 10_000 }).toBe(true)
  const startY = await playerY(page)

  await fingers.down(1, await buttonPoint(page, 'jump'))
  await page.waitForTimeout(200)

  // Screen coordinates grow downward, so a jump makes y smaller.
  expect(await playerY(page)).toBeLessThan(startY)
  // One press is one jump, however long the finger stays there — otherwise a
  // thumb resting on the button burns all three jumps in three frames.
  expect(await jumpsUsed(page)).toBe(1)

  await fingers.up(1)
})

test('two thumbs work at once, so he can run and jump together', async ({ page, context }) => {
  await page.goto('/')
  await waitForGameScene(page)
  const fingers = await touchscreen(page, context)

  await expect.poll(() => playerIsGrounded(page), { timeout: 10_000 }).toBe(true)
  const start = { x: await playerX(page), y: await playerY(page) }

  // One thumb on ▶, the other on ▲ — the jump every gap in level 2 needs.
  await fingers.down(1, await buttonPoint(page, 'right'))
  await fingers.down(2, await buttonPoint(page, 'jump'))
  await page.waitForTimeout(200)

  expect(await playerX(page)).toBeGreaterThan(start.x)
  expect(await playerY(page)).toBeLessThan(start.y)

  await fingers.up(2)
  await fingers.up(1)
})

test('the ↻ button starts the game over', async ({ page, context }) => {
  await page.goto('/')
  await waitForGameScene(page)
  const fingers = await touchscreen(page, context)

  await collectFirstCoin(page)
  expect(await hud(page)).not.toContain('SCORE 00000')

  await fingers.tap(await buttonPoint(page, 'restart'))
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('SCORE 00000')
  expect(await hud(page)).toContain('LEVEL 1')
})

test('finishing a level asks for a tap, and a tap starts the next one', async ({
  page,
  context,
}) => {
  const errors = watchForErrors(page)
  await page.goto('/')
  await waitForGameScene(page)
  const fingers = await touchscreen(page, context)

  // A finger already on the screen when the level ends — which is exactly what
  // winning feels like, since the last coin is usually grabbed mid-jump.
  await fingers.down(1, await buttonPoint(page, 'jump'))
  await collectEveryCoin(page)

  const finished = await banner(page)
  expect(finished).toContain('LEVEL 1 DONE!')
  // It must ask for something a phone can do...
  expect(finished).toContain('tap the screen for level 2')
  expect(finished).toContain('or tap ↻ to start over')
  // ...and never for a key this player doesn't have.
  expect(finished).not.toContain('press N')
  expect(finished).not.toContain('press R')

  // The finger that was already down is not a tap. Nobody's "NEW BEST TIME!"
  // gets wiped away by the jump that earned it.
  await page.waitForTimeout(600)
  expect(await banner(page)).toContain('LEVEL 1 DONE!')
  await fingers.up(1)

  // A fresh tap, anywhere, does what N does.
  await fingers.tap({ x: 400, y: 180 })
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('LEVEL 2')
  expect(await hud(page)).toContain('COINS 0/')

  expect(errors).toEqual([])
})

test('a phone held upright asks to be turned sideways', async ({ page }) => {
  await page.goto('/')
  await waitForGameScene(page)

  const rotate = page.locator('#rotate')
  await expect(rotate).toBeHidden()

  // Turn the phone upright. A 16:9 game in a tall window is a letterbox slot.
  await page.setViewportSize({ width: 360, height: 863 })
  await expect(rotate).toBeVisible()
  await expect(rotate).toContainText('Turn your phone sideways')

  // Turning back gets straight on with the game — it was never stopped.
  await page.setViewportSize({ width: 863, height: 360 })
  await expect(rotate).toBeHidden()
  await expect(page.locator('#game canvas')).toBeVisible()
})

// --- driving a touchscreen -------------------------------------------------

interface Point {
  x: number
  y: number
}

/**
 * Fingers on the glass.
 *
 * Playwright's own `touchscreen.tap` is one finger that presses and lets go
 * instantly, which can't hold ▶ down and can't put a second finger on ▲. So
 * this drives Chrome's touch input directly, where every event carries the full
 * list of fingers currently on the screen.
 */
class Fingers {
  private readonly onScreen = new Map<number, Point>()

  constructor(private readonly cdp: CDPSession) {}

  async down(id: number, point: Point): Promise<void> {
    this.onScreen.set(id, point)
    await this.dispatch('touchStart')
  }

  async up(id: number): Promise<void> {
    this.onScreen.delete(id)
    await this.dispatch('touchEnd')
  }

  /** Press and let go, staying down long enough for the game to see it. */
  async tap(point: Point): Promise<void> {
    await this.down(TAP_FINGER, point)
    await this.hold()
    await this.up(TAP_FINGER)
    await this.hold()
  }

  /**
   * The game reads the screen once per frame, so a press that starts and ends
   * between two frames never happened. A real finger is far slower than this.
   */
  private hold(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 120))
  }

  private async dispatch(type: 'touchStart' | 'touchEnd'): Promise<void> {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type,
      // Chrome wants every finger still on the screen, every time, and works
      // out for itself which one changed.
      touchPoints: [...this.onScreen].map(([id, point]) => ({ x: point.x, y: point.y, id })),
    })
  }
}

/** A finger id used only by `tap`, so it can't collide with a held-down one. */
const TAP_FINGER = 99

async function touchscreen(page: Page, context: BrowserContext): Promise<Fingers> {
  return new Fingers(await context.newCDPSession(page))
}

/** Where a button is on the actual phone screen, in browser pixels. */
async function buttonPoint(page: Page, id: string): Promise<Point> {
  const button = await page.evaluate((wanted) => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.touchPad?.buttons.find((candidate) => candidate.id === wanted) ?? null
  }, id)
  if (!button) throw new Error(`there is no ${id} button on screen`)

  const box = await page.locator('#game canvas').boundingBox()
  if (!box) throw new Error('the game canvas is not on screen')

  // The buttons live on the game's own 960 × 540 grid; the canvas is whatever
  // size the phone made it. Scale from one to the other.
  return {
    x: box.x + (button.x / TUNING.world.width) * box.width,
    y: box.y + (button.y / TUNING.world.height) * box.height,
  }
}

async function buttonIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return (scene.touchPad?.buttons ?? []).map((button) => button.id).sort()
  })
}

// --- reading the game ------------------------------------------------------

type TouchProbe = {
  touchPad: { buttons: { id: string; x: number; y: number }[] } | null
  player: {
    x: number
    y: number
    body: { blocked: { down: boolean }; velocity: { x: number } }
    setVelocity(x: number, y: number): void
    setPosition(x: number, y: number): void
  }
  coins: { getChildren(): { x: number; y: number; active: boolean }[] }
  hud: { text: string }
  banner: { text: string }
  jumpState: { jumpsUsed: number }
}

async function waitForGameScene(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const scene = window.__GAME__?.scene.getScene('Game') as unknown as {
            hud?: { text?: string }
          } | null
          return typeof scene?.hud?.text === 'string'
        }),
      { timeout: 15_000 },
    )
    .toBe(true)
}

async function playerX(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.player.x
  })
}

async function playerY(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.player.y
  })
}

async function playerVelocityX(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.player.body.velocity.x
  })
}

async function playerIsGrounded(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe | undefined
    return scene?.player?.body?.blocked.down ?? false
  })
}

async function jumpsUsed(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.jumpState.jumpsUsed
  })
}

async function hud(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.hud.text
  })
}

async function banner(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    return scene.banner.text
  })
}

/** Finish a level without playing it: park him on each coin, one frame apart. */
async function collectEveryCoin(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
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
async function collectFirstCoin(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as TouchProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const coin = scene.coins.getChildren()[0]
    if (!coin) return
    scene.player.setVelocity(0, 0)
    scene.player.setPosition(coin.x, coin.y)
    await nextFrame()
    await nextFrame()
  })
}

function watchForErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}
