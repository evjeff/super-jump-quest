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
})

type PlayerProbe = { player?: { y: number; body?: { blocked: { down: boolean } } } }

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
