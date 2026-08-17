import Phaser from 'phaser'
import { TUNING } from '../tuning'

/**
 * Draws the sprites in code instead of loading image files.
 *
 * Why: no art assets to lose, no broken file paths, and changing a color is a
 * one-number edit in tuning.ts. When you're ready for real artwork, load PNGs
 * into `public/` here instead and delete the shape drawing.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.makeRectTexture('player', 32, 48, TUNING.colors.player)
    this.makeRectTexture('platform', 32, 32, TUNING.colors.platform)
    // A second, differently colored block for the platforms that move, so you
    // can see which ones slide before you step on one.
    this.makeRectTexture('movingPlatform', 32, 32, TUNING.colors.movingPlatform)
    this.makeCircleTexture('coin', 10, TUNING.colors.coin)

    this.scene.start('Game')
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
