import Phaser from 'phaser'
import type { Beeper } from '../audio/beeper'
import { createBeeper, webAudioOutput } from '../audio/beeper'
import type { JumpState } from '../game/jump'
import { canJump, createJumpState, justLanded, registerJump, syncGrounded } from '../game/jump'
import { facingDirection, horizontalVelocity } from '../game/movement'
import type { ScoreState } from '../game/score'
import { collectCoin, createScoreState, formatScore, isLevelComplete } from '../game/score'
import { coinSound, isDistinctLanding, jumpSound, landingSound, winSound } from '../game/sounds'
import { squashScale } from '../game/squash'
import type { Level } from '../levels/level1'
import { LEVEL_1 } from '../levels/level1'
import { TUNING } from '../tuning'

const LEVEL: Level = LEVEL_1

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private playerSkin!: Phaser.GameObjects.Image
  private coins!: Phaser.Physics.Arcade.Group
  private hud!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text

  private leftKeys: Phaser.Input.Keyboard.Key[] = []
  private rightKeys: Phaser.Input.Keyboard.Key[] = []
  private jumpKeys: Phaser.Input.Keyboard.Key[] = []
  private restartKey!: Phaser.Input.Keyboard.Key

  private beeper: Beeper = createBeeper(null, 0)

  private jumpState: JumpState = createJumpState()
  private scoreState: ScoreState = createScoreState()
  private facing: 'left' | 'right' = 'right'
  private lastLandingAt = 0
  /** When he last touched down. Infinitely long ago means "not squashed". */
  private squashStartedAt = Number.NEGATIVE_INFINITY
  private won = false

  constructor() {
    super('Game')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(TUNING.colors.sky)

    this.buildPlatforms()
    this.buildPlayer()
    this.buildCoins()
    this.buildHud()
    this.bindKeys()
    this.beeper = createBeeper(webAudioOutput(this.sound), TUNING.sound.volume)

    // Reset per-restart state so `scene.restart()` is always a clean slate.
    this.jumpState = createJumpState()
    this.scoreState = createScoreState()
    this.facing = 'right'
    this.lastLandingAt = 0
    this.squashStartedAt = Number.NEGATIVE_INFINITY
    this.won = false
  }

  override update(): void {
    // Always redraw him, even on the win screen, so he can never be left
    // frozen mid-squash.
    this.drawPlayer()

    if (this.won) {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) this.scene.restart()
      return
    }

    this.handleMovement()
    this.handleJumping()
    this.handleFalling()
    this.spinCoins()
  }

  // --- setup -------------------------------------------------------------

  private buildPlatforms(): void {
    const platforms = this.physics.add.staticGroup()
    for (const spec of LEVEL.platforms) {
      const block = platforms.create(spec.x, spec.y, 'platform') as Phaser.Physics.Arcade.Sprite
      block.setDisplaySize(spec.width, spec.height)
      block.refreshBody()
    }
    // Stored on the scene only long enough to wire the collider in buildPlayer.
    this.data.set('platforms', platforms)
  }

  private buildPlayer(): void {
    const { playerStart } = LEVEL
    this.player = this.physics.add.sprite(playerStart.x, playerStart.y, 'player')
    this.player.setBounce(TUNING.player.bounce)
    this.player.setCollideWorldBounds(false)
    this.player.setGravityY(TUNING.player.gravity)

    // The yellow rectangle you actually SEE is a separate, physics-free copy
    // that follows him around. Squashing the physics sprite would squash his
    // invisible collision box too, and he'd sink into platforms or hover above
    // them. This way the squash is pure drawing and can't break the game.
    //
    // Its handle is at its feet (origin 0.5, 1) and it's parked on the bottom
    // of his collision box, so squashing presses him INTO the floor instead of
    // shrinking him away from it.
    this.player.setVisible(false)
    this.playerSkin = this.add.image(playerStart.x, playerStart.y, 'player')
    this.playerSkin.setOrigin(0.5, 1)

    const platforms = this.data.get('platforms') as Phaser.Physics.Arcade.StaticGroup
    this.physics.add.collider(this.player, platforms)
  }

  private buildCoins(): void {
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true })
    for (const spec of LEVEL.coins) {
      this.coins.create(spec.x, spec.y, 'coin')
    }

    this.physics.add.overlap(this.player, this.coins, (_player, coin) => {
      this.onCoinCollected(coin as Phaser.Physics.Arcade.Sprite)
    })
  }

  private buildHud(): void {
    this.hud = this.add.text(16, 14, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: TUNING.colors.text,
    })
    this.hud.setScrollFactor(0)

    this.banner = this.add.text(TUNING.world.width / 2, TUNING.world.height / 2, '', {
      fontFamily: 'monospace',
      fontSize: '40px',
      color: TUNING.colors.text,
      align: 'center',
    })
    this.banner.setOrigin(0.5)
    this.banner.setScrollFactor(0)

    this.refreshHud()
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable — the game needs a keyboard to play.')
    }

    const { KeyCodes } = Phaser.Input.Keyboard
    this.leftKeys = [keyboard.addKey(KeyCodes.LEFT), keyboard.addKey(KeyCodes.A)]
    this.rightKeys = [keyboard.addKey(KeyCodes.RIGHT), keyboard.addKey(KeyCodes.D)]
    this.jumpKeys = [
      keyboard.addKey(KeyCodes.SPACE),
      keyboard.addKey(KeyCodes.UP),
      keyboard.addKey(KeyCodes.W),
    ]
    this.restartKey = keyboard.addKey(KeyCodes.R)
  }

  // --- per-frame behaviour ------------------------------------------------

  private handleMovement(): void {
    const velocityX = horizontalVelocity(
      { left: anyKeyDown(this.leftKeys), right: anyKeyDown(this.rightKeys) },
      TUNING.player.speed,
    )
    this.player.setVelocityX(velocityX)

    this.facing = facingDirection(velocityX, this.facing)
    this.playerSkin.setFlipX(this.facing === 'left')
  }

  /** Put the drawn player where the physics player is, squashed if he just landed. */
  private drawPlayer(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const { scaleX, scaleY } = squashScale(
      this.time.now - this.squashStartedAt,
      TUNING.player.landingSquash,
      TUNING.player.landingSquashMs,
    )

    this.playerSkin.setPosition(body.center.x, body.bottom)
    this.playerSkin.setScale(scaleX, scaleY)
  }

  private handleJumping(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down

    // Ask before syncing, while the state still remembers he was airborne.
    if (justLanded(this.jumpState, onGround)) {
      // He squashes on EVERY touchdown, including the little bounces — unlike
      // the thud, which is debounced. Three thuds in a row sound like a bug;
      // three shrinking squashes LOOK like something bouncing, which is what
      // he's doing. It also means he can never be left mid-squash.
      this.squashStartedAt = this.time.now
      this.playLanding()
    }
    this.jumpState = syncGrounded(this.jumpState, onGround)

    const jumpPressed = this.jumpKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))
    if (jumpPressed && canJump(this.jumpState, TUNING.player.maxJumps)) {
      this.player.setVelocityY(-TUNING.player.jumpVelocity)
      this.jumpState = registerJump(this.jumpState)
      // Each jump in the chain sounds a step higher than the one before it.
      this.beeper.play(jumpSound(this.jumpState.jumpsUsed))
    }
  }

  private playLanding(): void {
    const now = this.time.now
    if (!isDistinctLanding(now, this.lastLandingAt, TUNING.sound.landingCooldownMs)) return

    this.lastLandingAt = now
    this.beeper.play(landingSound())
  }

  private handleFalling(): void {
    if (this.player.y > TUNING.world.deathDepth) {
      this.player.setPosition(LEVEL.playerStart.x, LEVEL.playerStart.y)
      this.player.setVelocity(0, 0)
      this.jumpState = createJumpState()
      // Start the new life at his normal shape, not stuck mid-squash.
      this.squashStartedAt = Number.NEGATIVE_INFINITY
    }
  }

  private spinCoins(): void {
    const delta = this.game.loop.delta / 1000
    for (const coin of this.coins.getChildren()) {
      const sprite = coin as Phaser.Physics.Arcade.Sprite
      sprite.angle += TUNING.coins.spinSpeed * delta
    }
  }

  private onCoinCollected(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return
    coin.disableBody(true, true)
    this.beeper.play(coinSound())

    this.scoreState = collectCoin(this.scoreState, TUNING.coins.value)
    this.refreshHud()

    if (isLevelComplete(this.scoreState, LEVEL.coins.length)) {
      this.won = true
      this.player.setVelocity(0, 0)
      this.banner.setText('YOU WIN!\npress R to play again')
      // Only reachable by picking up the last coin, and every coin is switched
      // off by then — so the fanfare plays once per win, never twice. Pressing R
      // runs create() again, which puts the coins back and clears `won`, so the
      // next win cheers too.
      this.beeper.play(winSound())
    }
  }

  private refreshHud(): void {
    const total = LEVEL.coins.length
    this.hud.setText(
      `SCORE ${formatScore(this.scoreState.points)}   COINS ${this.scoreState.coinsCollected}/${total}`,
    )
  }
}

function anyKeyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown)
}
