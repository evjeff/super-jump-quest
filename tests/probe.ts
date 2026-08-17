import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Reaching into the running game from a browser test.
 *
 * Both test files need the same handful of things: wait for the scene, read the
 * HUD, read the banner, finish a level without playing it. They live here
 * rather than being copied into each file because every one of them reaches
 * into GameScene's private fields through `as unknown as GameProbe` —
 * TypeScript cannot check a line of it, so the fewer places that cast, the
 * better. Rename `hud` in the scene and this file is the one place that has to
 * follow.
 *
 * The functions below are deliberately plain and repetitive rather than
 * generated from one clever helper: a reader function has to be shipped into
 * the browser to run, and the tricks for doing that generically are worse to
 * read and worse to debug than eight obvious four-line functions.
 */

/**
 * The bits of GameScene the tests poke at.
 *
 * Nothing checks this against the real scene except the tests going red, which
 * is exactly why there is only one copy of it.
 */
export type GameProbe = {
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
  level: { coins: unknown[]; platforms: unknown[] }
  jumpState: { jumpsUsed: number }
  squashStartedAt: number
  levelTimeMs: number
  /** Null on a computer — only a touchscreen gets on-screen buttons. */
  touchPad: { buttons: { id: string; x: number; y: number }[] } | null
}

/**
 * Wait until the Game scene has finished building itself.
 *
 * Being "active" isn't enough after a reload: for a frame or two the scene
 * exists but its HUD doesn't, and reading text off nothing throws.
 */
export async function waitForGameScene(page: Page): Promise<void> {
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

export async function hud(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return scene.hud.text
  })
}

export async function banner(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return scene.banner.text
  })
}

/** Milliseconds on this level's clock — how long ago the level started. */
export async function levelTimeMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return scene.levelTimeMs
  })
}

export async function playerX(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return scene.player.x
  })
}

export async function playerY(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe | undefined
    return scene?.player?.y ?? Number.NaN
  })
}

export async function playerVelocityX(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return scene.player.body.velocity.x
  })
}

export async function playerIsGrounded(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe | undefined
    return scene?.player?.body?.blocked.down ?? false
  })
}

export async function jumpsUsed(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    return scene.jumpState.jumpsUsed
  })
}

/**
 * Collect coins without playing: park him on each one, a frame apart.
 *
 * `limit` is how many to take. Leave it out to finish the level; pass 1 to take
 * a single coin and leave the rest of the level unfinished, which is how a test
 * gets a score on the board with the level still running.
 */
export async function collectCoins(page: Page, limit = Number.POSITIVE_INFINITY): Promise<void> {
  await page.evaluate(async (howMany) => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

    let taken = 0
    for (const coin of [...scene.coins.getChildren()]) {
      // A level with no coins leaves the score at zero, and the checks back in
      // the test say so out loud rather than passing on an empty level.
      if (taken >= howMany) return
      if (!coin.active) continue
      scene.player.setVelocity(0, 0)
      scene.player.setPosition(coin.x, coin.y)
      taken += 1
      await nextFrame()
      await nextFrame()
    }
  }, limit)
}

/** Collect every console error and page error, so a test can insist on none. */
export function watchForErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}
