import Phaser from 'phaser'
import { PIP_HEIGHT, PIP_KEYS, PIP_ROWS, PIP_WIDTH } from '../game/pipSprite'
import { makeStarfield } from '../game/starfield'
import { TUNING } from '../tuning'

/** How many screen pixels one square of Pip is. 16 x 24 squares x 2 = 32 x 48. */
const PIP_PIXEL = 2

/** How many faint circles the moon's halo is built from. More = smoother. */
const MOON_HALO_RINGS = 34

/**
 * Draws all of the artwork in code instead of loading image files.
 *
 * Why: there are no picture files to lose, no broken file paths, nothing extra
 * to download, and every colour stays a one-number edit in `tuning.ts`. It is
 * the same bargain the sound effects made — see
 * `docs/adr/20260816-synthesized-sound-effects/`.
 *
 * Everything here runs ONCE, before the game starts, and gets baked into a
 * texture. That's what keeps a detailed sky affordable: however many stars and
 * hills go into it, playing costs one picture on the screen. The only part that
 * does any work while you play is the handful of twinkling stars, which
 * `GameScene` adds on top — see `stars.twinkleEvery` in `tuning.ts`.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.makeSkyTexture()
    this.makePipTexture()
    this.makeRectTexture('platform', 32, 32, TUNING.colors.platform)
    // A second, differently colored block for the platforms that move, so you
    // can see which ones slide before you step on one.
    this.makeRectTexture('movingPlatform', 32, 32, TUNING.colors.movingPlatform)
    this.makeCircleTexture('coin', 10, TUNING.colors.coin)

    this.scene.start('Game')
  }

  /**
   * Pip himself: the letter grid in `src/game/pipSprite.ts`, one little
   * square at a time.
   *
   * The finished picture is exactly 32 x 48, which is the size the old yellow
   * rectangle was — so the invisible box the game bumps him into is unchanged,
   * and every jump that worked before still works.
   */
  private makePipTexture(): void {
    const graphics = this.add.graphics()

    for (const [row, letters] of PIP_ROWS.entries()) {
      for (const [column, letter] of [...letters].entries()) {
        // A dot is see-through, and `pipSprite.test.ts` is what guarantees
        // every other letter has a colour waiting for it here.
        const color = PIP_KEYS[letter]
        if (color === undefined) continue
        graphics.fillStyle(TUNING.colors.pip[color], 1)
        graphics.fillRect(column * PIP_PIXEL, row * PIP_PIXEL, PIP_PIXEL, PIP_PIXEL)
      }
    }

    graphics.generateTexture('player', PIP_WIDTH * PIP_PIXEL, PIP_HEIGHT * PIP_PIXEL)
    graphics.destroy()
  }

  /**
   * The night sky: a deep blue that lightens towards the horizon, stars, a
   * moon, and three rows of hills getting darker as they get closer.
   *
   * The stars are scattered by a number pattern that always comes out the
   * same, so the sky looks identical every time you play. That's on purpose —
   * a sky that rearranged itself on every restart would be distracting.
   */
  private makeSkyTexture(): void {
    const { width, height } = TUNING.world
    const { top, middle, horizon, star, moon, crater, hillFar, hillMid, hillNear } =
      TUNING.colors.night
    const graphics = this.add.graphics()

    // Two stacked gradients, so the sky can go dark -> blue -> light rather
    // than straight from one colour to the other.
    graphics.fillGradientStyle(top, top, middle, middle, 1)
    graphics.fillRect(0, 0, width, height / 2)
    graphics.fillGradientStyle(middle, middle, horizon, horizon, 1)
    graphics.fillRect(0, height / 2, width, height / 2)

    // Only the stars that sit still get painted in. The twinkling ones are
    // left out on purpose and GameScene puts them back as real objects it can
    // fade in and out — painting them here too would leave a bright dot
    // underneath that never dims.
    graphics.fillStyle(star, 1)
    for (const { x, y, size, twinkles } of makeStarfield({ width, height, ...TUNING.stars })) {
      if (twinkles) continue
      graphics.fillRect(x, y, size, size)
    }

    const moonX = width * 0.79
    const moonY = height * 0.2
    const moonRadius = height * 0.075
    // A halo, built out of rings that each add a whisper of light. Circles are
    // all Phaser's shape drawing gives us; the trick is using plenty of them,
    // faint and close together, so they blend into a glow instead of looking
    // like a dartboard.
    graphics.fillStyle(moon, 0.012)
    for (let ring = MOON_HALO_RINGS; ring > 0; ring--) {
      graphics.fillCircle(moonX, moonY, moonRadius * (1 + (ring * 3.5) / MOON_HALO_RINGS))
    }
    graphics.fillStyle(moon, 1)
    graphics.fillCircle(moonX, moonY, moonRadius)
    graphics.fillStyle(crater, 1)
    graphics.fillCircle(moonX - moonRadius * 0.3, moonY - moonRadius * 0.2, moonRadius * 0.22)
    graphics.fillCircle(moonX + moonRadius * 0.28, moonY + moonRadius * 0.3, moonRadius * 0.16)

    this.fillHills(graphics, height * 0.62, height * 0.05, 0.006, 0, hillFar)
    this.fillHills(graphics, height * 0.74, height * 0.055, 0.009, 2.1, hillMid)
    this.fillHills(graphics, height * 0.86, height * 0.04, 0.013, 4.4, hillNear)

    graphics.generateTexture('sky', width, height)
    graphics.destroy()
  }

  /**
   * One row of rolling hills, filled in from its top edge all the way down to
   * the bottom of the screen. Two waves of different lengths added together,
   * so the ridge wanders instead of repeating.
   */
  private fillHills(
    graphics: Phaser.GameObjects.Graphics,
    baseY: number,
    amplitude: number,
    frequency: number,
    phase: number,
    color: number,
  ): void {
    const { width, height } = TUNING.world
    const points: Phaser.Math.Vector2[] = []

    for (let x = 0; x <= width; x += 6) {
      const wave = Math.sin(x * frequency + phase) * amplitude
      const ripple = Math.sin(x * frequency * 2.3 + phase) * amplitude * 0.3
      points.push(new Phaser.Math.Vector2(x, baseY + wave + ripple))
    }
    points.push(new Phaser.Math.Vector2(width, height))
    points.push(new Phaser.Math.Vector2(0, height))

    graphics.fillStyle(color, 1)
    graphics.fillPoints(points, true)
  }

  private makeRectTexture(key: string, width: number, height: number, color: number): void {
    const graphics = this.add.graphics()
    graphics.fillStyle(color, 1)
    graphics.fillRect(0, 0, width, height)
    graphics.generateTexture(key, width, height)
    graphics.destroy()
  }

  private makeCircleTexture(key: string, radius: number, color: number): void {
    const size = radius * 2
    const graphics = this.add.graphics()
    graphics.fillStyle(color, 1)
    graphics.fillCircle(radius, radius, radius)
    graphics.generateTexture(key, size, size)
    graphics.destroy()
  }
}
