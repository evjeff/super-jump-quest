import { expect, test } from '@playwright/test'
import type { GameProbe } from './probe'
import {
  banner,
  collectCoins,
  goToLevel,
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
  expect(await banner(page)).toContain('LEVEL 2 DONE!')

  // Two levels' worth of points now, and they have to survive one more hop.
  const scoreAfterLevel2 = (await hud(page)).match(/SCORE \d+/)?.[0] ?? ''
  expect(scoreAfterLevel2).not.toBe(scoreAfterLevel1)

  await holdKey(page, 'KeyN')
  await expect.poll(() => hud(page), { timeout: 5_000 }).toContain('LEVEL 3')

  const level3 = await levelState(page)
  expect(level3.coinsAlive).toBe(level3.coinsInLevel)
  expect(level3.coinsInLevel).toBeGreaterThan(0)
  expect(level3.platforms).toBeGreaterThan(0)
  // The level built around moving platforms has to actually have some — a
  // level 3 whose ferries quietly stopped being built would still look fine
  // to every check above this line.
  expect(level3.movingPlatforms).toBeGreaterThan(0)
  expect(level3.hud).toContain('COINS 0/')
  expect(level3.hud).toContain(scoreAfterLevel2)
  expect(level3.banner).toBe('')
  expect(level3.jumpsUsed).toBe(0)
  expect(level3.squashCleared).toBe(true)
  expect(level3.levelTimeMs).toBeLessThan(600)
  expect(level3.hud).toContain('THIS LEVEL 0:00')

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

/**
 * The guardrail for the whole of level 3.
 *
 * Being carried is the entire feature. A ferry that slides out from under his
 * feet, leaving him standing in mid-air, is a bug with a nice colour — and
 * every unit test would still be green, because where a platform *is* is pure
 * maths and that part would be fine.
 *
 * It is also the thing most likely to break by accident. Arcade does the
 * carrying itself, using the platform's `friction.x`, and a physics group sets
 * that to 0 unless you ask for 1. It did, the first time. So this test asks
 * the only question that matters: with nothing pressed, does he go exactly as
 * far as the ferry does?
 */
test('a sliding platform carries a player standing on it, at its speed', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await waitForGameScene(page)
  await goToLevel(page, 2)

  const ride = await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    // The first mover in level 3 is the ferry across the hole.
    const ferry = scene.movingPlatforms[0] as GameProbe['movingPlatforms'][0]

    // Drop him onto its deck and let him settle. Nothing is pressed after this.
    scene.player.setVelocity(0, 0)
    scene.player.setPosition(ferry.sprite.x, ferry.sprite.y - 40)
    for (let i = 0; i < 30; i += 1) await nextFrame()

    const gapAtStart = scene.player.x - ferry.sprite.x
    let platformTravel = 0
    let playerTravel = 0
    let lastPlatform = ferry.sprite.x
    let lastPlayer = scene.player.x

    for (let i = 0; i < 60; i += 1) {
      await nextFrame()
      platformTravel += ferry.sprite.x - lastPlatform
      playerTravel += scene.player.x - lastPlayer
      lastPlatform = ferry.sprite.x
      lastPlayer = scene.player.x
    }

    return { platformTravel, playerTravel, gapAtStart, gapAtEnd: scene.player.x - ferry.sprite.x }
  })

  // The ferry went somewhere, so there was something to be carried by.
  expect(Math.abs(ride.platformTravel)).toBeGreaterThan(20)
  // He went exactly as far. Twice as far would mean he is being carried once
  // by us and once by Arcade's own `friction.x`, which is why that is set to 0
  // — and he would slide off the front of the ferry.
  expect(ride.playerTravel / ride.platformTravel).toBeCloseTo(1, 1)
  // He keeps his place on the deck exactly — he is moved by the platform's own
  // step, off the same clock, so there is no rounding to accumulate.
  expect(Math.abs(ride.gapAtEnd - ride.gapAtStart)).toBeLessThan(1)

  expect(consoleErrors).toEqual([])
})

/**
 * He keeps his place on the deck, even in mid-air.
 *
 * This is the one that came from playing the game rather than from reasoning
 * about it: the ride felt wrong, because jumping aboard a ferry left him a
 * little further back every time and two or three jumps walked him off the end.
 * Arcade's own carry is exact while his feet are down and does nothing at all
 * while they are not, and a jump is nearly a second of "not".
 *
 * So the ride now survives a jump, and this is what says so. The number it
 * allows is tiny on purpose: three full jumps used to cost him a third of the
 * deck, and are expected to cost him nothing at all.
 */
test('jumping aboard a moving platform leaves him on the same plank', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await waitForGameScene(page)
  await goToLevel(page, 2)

  const out = await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const ferry = scene.movingPlatforms[0] as GameProbe['movingPlatforms'][0]

    scene.player.setVelocity(0, 0)
    scene.player.setPosition(ferry.sprite.x, ferry.sprite.y - 40)
    for (let i = 0; i < 40; i += 1) await nextFrame()

    // Take off just after the ferry turns round, so it is heading one way for
    // the whole jump. A jump that straddles a turnaround genuinely does put him
    // down somewhere else on the deck — he keeps the speed he left with while
    // the ferry goes back — and that is the subject of its own test.
    let previous = ferry.sprite.x
    let heading = 0
    for (let i = 0; i < 1200; i += 1) {
      await nextFrame()
      const step = Math.sign(ferry.sprite.x - previous)
      previous = ferry.sprite.x
      if (step === 0) continue
      if (heading !== 0 && step !== heading) break
      heading = step
    }

    const before = scene.player.x - ferry.sprite.x
    const startedOnDeck = scene.player.body.blocked.down

    // One full jump, straight up, nothing else pressed.
    scene.player.setVelocity(0, -520)
    await nextFrame()
    for (let i = 0; i < 300 && !scene.player.body.blocked.down; i += 1) await nextFrame()
    for (let i = 0; i < 5; i += 1) await nextFrame()

    return {
      before,
      after: scene.player.x - ferry.sprite.x,
      startedOnDeck,
      endedOnDeck: scene.player.body.blocked.down,
    }
  })

  expect(out.startedOnDeck).toBe(true)
  expect(out.endedOnDeck).toBe(true)
  // He came down on the plank he left. It used to be a hundred pixels back.
  expect(Math.abs(out.after - out.before)).toBeLessThan(2)

  expect(consoleErrors).toEqual([])
})

/**
 * A jump is his own, not the ferry's.
 *
 * Keeping the ride through a jump fixed the sliding, and bought a stranger
 * problem: he was following the ferry while airborne, so a ferry reaching the
 * end of its trip mid-jump swept him back the other way in mid-air. Nothing a
 * jump does should be able to reverse it.
 *
 * He takes the speed the deck had at the moment he left it and keeps that,
 * which is what being thrown from a moving thing does.
 */
test('a ferry turning round mid-jump does not turn him round with it', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await waitForGameScene(page)
  await goToLevel(page, 2)

  const out = await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const ferry = scene.movingPlatforms[0] as GameProbe['movingPlatforms'][0]

    scene.player.setVelocity(0, 0)
    scene.player.setPosition(ferry.sprite.x, ferry.sprite.y - 40)
    for (let i = 0; i < 30; i += 1) await nextFrame()

    // Wait until the ferry is nearly at the far end AND still heading for it,
    // so it must turn round while he is off the deck. Checking the direction
    // matters: "nearly at the far end" is also true on the way back, and
    // starting there would watch a jump with no turnaround in it at all.
    let previous = ferry.sprite.x
    for (let i = 0; i < 1200; i += 1) {
      await nextFrame()
      const now = ferry.sprite.x
      const headingForTheFarEnd = now > previous
      previous = now
      if (headingForTheFarEnd && now >= 730) break
    }

    scene.player.setVelocity(0, -520)

    const playerSteps: number[] = []
    const ferrySteps: number[] = []
    let lastPlayer = scene.player.x
    let lastFerry = ferry.sprite.x
    for (let i = 0; i < 45; i += 1) {
      await nextFrame()
      playerSteps.push(scene.player.x - lastPlayer)
      ferrySteps.push(ferry.sprite.x - lastFerry)
      lastPlayer = scene.player.x
      lastFerry = ferry.sprite.x
    }

    const wentBothWays = (steps: number[]) =>
      steps.some((step) => step > 0.1) && steps.some((step) => step < -0.1)

    return { ferryReversed: wentBothWays(ferrySteps), playerReversed: wentBothWays(playerSteps) }
  })

  // The ferry really did turn round while he was in the air...
  expect(out.ferryReversed).toBe(true)
  // ...and he carried straight on.
  expect(out.playerReversed).toBe(false)

  expect(consoleErrors).toEqual([])
})

/**
 * Riding is not a series of landings.
 *
 * A platform moving under his feet makes the collision flags flicker — he sinks
 * a fraction into the deck, gets pushed out, and the little bounce reads as
 * leaving the floor and arriving again. Every one of those squashes him, and
 * riding a lift looked like a fault in the game: "it looks like I am
 * continually landing and getting squished".
 *
 * He is dropped on from a height so he arrives with a real thump and a real
 * bounce, which is how a player gets on it, and then left alone for two full
 * trips.
 */
test('riding a lift does not squash him over and over', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await waitForGameScene(page)
  await goToLevel(page, 2)

  const landings = await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const lift = scene.movingPlatforms[1] as GameProbe['movingPlatforms'][1]

    scene.player.setVelocity(0, 0)
    scene.player.setPosition(lift.sprite.x, lift.sprite.y - 120)
    for (let i = 0; i < 40; i += 1) await nextFrame()

    // Every touchdown restarts the squash, so counting those counts them.
    let count = 0
    let lastSquash = scene.squashStartedAt
    for (let i = 0; i < 900; i += 1) {
      await nextFrame()
      if (scene.squashStartedAt !== lastSquash) {
        count += 1
        lastSquash = scene.squashStartedAt
      }
    }
    return count
  })

  // Not one, in two whole trips up and down.
  expect(landings).toBeLessThan(2)

  expect(consoleErrors).toEqual([])
})

/**
 * The same question for the lift, which is the harder half.
 *
 * Going up, Arcade has to push him up as the platform arrives under his feet.
 * Coming down, he has to fall with it and STAY in contact. If he doesn't, he
 * bounces down the sky in little hops, thudding all the way.
 *
 * What it counts is the share of frames his feet are on something, rather than
 * the number of times he lands. Landings looked like the obvious measure and
 * are the wrong one: a machine busy enough to drop a frame gives him one long
 * fall, and `player.bounce` turns a long fall into a real bounce — on any
 * platform, moving or not. That made the count jump from 1 to 8 on a loaded
 * laptop while the ride itself was perfect. Contact tells the two apart: a
 * dropped frame costs a couple of frames of it, and genuine bouncing costs
 * half of them.
 *
 * It watches for longer than the lift's trip on purpose, so the turnaround at
 * the top — the moment rising becomes falling — happens inside the test.
 */
test('a lift carries a player up and down without bouncing him', async ({ page }) => {
  const consoleErrors = watchForErrors(page)

  await page.goto('/')
  await waitForGameScene(page)
  await goToLevel(page, 2)

  const ride = await page.evaluate(async () => {
    const scene = window.__GAME__?.scene.getScene('Game') as unknown as GameProbe
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    // The second mover in level 3 is the lift up the right-hand side.
    const lift = scene.movingPlatforms[1] as GameProbe['movingPlatforms'][1]

    scene.player.setVelocity(0, 0)
    scene.player.setPosition(lift.sprite.x, lift.sprite.y - 40)
    for (let i = 0; i < 30; i += 1) await nextFrame()

    const gapAtStart = scene.player.y - lift.sprite.y
    let worstGap = 0
    let framesOnTheDeck = 0
    let platformTravel = 0
    let playerTravel = 0
    let lastPlatform = lift.sprite.y
    let lastPlayer = scene.player.y

    const frames = 260
    for (let i = 0; i < frames; i += 1) {
      await nextFrame()
      platformTravel += Math.abs(lift.sprite.y - lastPlatform)
      playerTravel += Math.abs(scene.player.y - lastPlayer)
      lastPlatform = lift.sprite.y
      lastPlayer = scene.player.y
      worstGap = Math.max(worstGap, Math.abs(scene.player.y - lift.sprite.y - gapAtStart))
      if (scene.player.body.blocked.down) framesOnTheDeck += 1
    }

    return { platformTravel, playerTravel, worstGap, framesOnTheDeck, frames }
  })

  expect(ride.platformTravel).toBeGreaterThan(50)
  expect(ride.playerTravel / ride.platformTravel).toBeCloseTo(1, 1)
  // He stays on the deck rather than drifting up off it or sinking into it.
  expect(ride.worstGap).toBeLessThan(8)
  // Standing on it, not bouncing down it.
  expect(ride.framesOnTheDeck / ride.frames).toBeGreaterThan(0.85)

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
      movingPlatforms: scene.movingPlatforms.length,
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
