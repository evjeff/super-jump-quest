import Phaser from 'phaser'
import type { Beeper } from '../audio/beeper'
import { createBeeper, webAudioOutput } from '../audio/beeper'
import type { JumpState } from '../game/jump'
import { canJump, createJumpState, justLanded, registerJump, syncGrounded } from '../game/jump'
import { facingDirection, horizontalVelocity } from '../game/movement'
import type { Progress } from '../game/progress'
import { afterLevel, bannerText } from '../game/progress'
import type { ScoreState } from '../game/score'
import { collectCoin, createScoreState, formatScore, isLevelComplete } from '../game/score'
import { coinSound, isDistinctLanding, jumpSound, landingSound, winSound } from '../game/sounds'
import { squashScale } from '../game/squash'
import type { BestTimes } from '../game/timer'
import { bestTimeFor, finishBannerLines, formatTime, recordTime } from '../game/timer'
import type { Level } from '../levels'
import { LEVELS } from '../levels'
import { loadBestTimes, saveBestTimes } from '../storage/bestTimes'
import { TUNING } from '../tuning'

/** What one level hands to the next when you press N. */
interface GameSceneData {
  levelIndex?: number
  points?: number
}

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
  private nextLevelKey!: Phaser.Input.Keyboard.Key

  private beeper: Beeper = createBeeper(null, 0)

  private jumpState: JumpState = createJumpState()
  private scoreState: ScoreState = createScoreState()
  private facing: 'left' | 'right' = 'right'
  private lastLandingAt = 0
  /** When he last touched down. Infinitely long ago means "not squashed". */
  private squashStartedAt = Number.NEGATIVE_INFINITY
  /** Null while he's still playing; set the moment the last coin is grabbed. */
  private outcome: Progress | null = null

  /**
   * How long he's been on THIS level, in milliseconds. It's added up from the
   * game's own frames rather than read off a wall clock, so it can only count
   * time the game was really running.
   */
  private levelTimeMs = 0
  /** The clock as it was last drawn, so the HUD is only redrawn when a tenth ticks over. */
  private shownTime = ''
  /** The best times we've saved, read once when the level starts. */
  private bestTimes: BestTimes = {}

  /** Which level he's on, counting from 0. Level 0 is the one people call 1. */
  private levelIndex = 0
  private level: Level = LEVELS[0]
  /** The score he arrived with, so points keep adding up across levels. */
  private startingPoints = 0

  constructor() {
    super('Game')
  }

  /** Phaser hands us whatever `scene.restart(...)` was called with. */
  init(data: GameSceneData): void {
    this.levelIndex = data.levelIndex ?? 0
    this.level = LEVELS[this.levelIndex] ?? LEVELS[0]
    this.startingPoints = data.points ?? 0
  }

  create(): void {
    this.cameras.main.setBackgroundColor(TUNING.colors.sky)

    // Wipe the last level's state FIRST, so everything below is built from a
    // clean slate. (The HUD in particular is drawn straight from the score, and
    // level 2 opening on "COINS 7/11" is exactly the kind of leak this stops.)
    this.jumpState = createJumpState()
    this.scoreState = createScoreState(this.startingPoints)
    this.facing = 'right'
    this.lastLandingAt = 0
    this.squashStartedAt = Number.NEGATIVE_INFINITY
    this.outcome = null
    // A fresh clock every time a level starts — and that's every time this runs,
    // whether he pressed N for the next level or R to start the whole game over.
    this.levelTimeMs = 0
    this.bestTimes = loadBestTimes()

    this.buildPlatforms()
    this.buildPlayer()
    this.buildCoins()
    this.buildHud()
    this.bindKeys()
    this.beeper = createBeeper(webAudioOutput(this.sound), TUNING.sound.volume)
  }

  override update(_time: number, delta: number): void {
    // Always redraw him, even on the win screen, so he can never be left
    // frozen mid-squash.
    this.drawPlayer()

    // R always means the same thing, wherever you press it: back to the very
    // beginning, score and all. Checked before anything else so a kid stuck on
    // a hard jump can start over without reloading the page.
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart({ levelIndex: 0, points: 0 })
      return
    }

    // Everything below here is "still playing", so the clock stops the moment
    // the finish banner goes up and doesn't tick while it waits for a key.
    if (this.outcome) {
      this.handleBannerKeys(this.outcome)
      return
    }

    this.advanceTimer(delta)
    this.handleMovement()
    this.handleJumping()
    this.handleFalling()
    this.spinCoins()
  }

  /**
   * The extra key that only works while the big banner is up: N carries the
   * score forward into the next level. (R is handled in `update`, because it
   * works at any time.)
   */
  private handleBannerKeys(outcome: Progress): void {
    if (outcome.kind === 'next-level' && Phaser.Input.Keyboard.JustDown(this.nextLevelKey)) {
      this.scene.restart({ levelIndex: outcome.levelIndex, points: this.scoreState.points })
    }
  }

  // --- setup -------------------------------------------------------------

  private buildPlatforms(): void {
    const platforms = this.physics.add.staticGroup()
    for (const spec of this.level.platforms) {
      const block = platforms.create(spec.x, spec.y, 'platform') as Phaser.Physics.Arcade.Sprite
      block.setDisplaySize(spec.width, spec.height)
      block.refreshBody()
    }
    // Stored on the scene only long enough to wire the collider in buildPlayer.
    this.data.set('platforms', platforms)
  }

  private buildPlayer(): void {
    const { playerStart } = this.level
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
    for (const spec of this.level.coins) {
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
    this.nextLevelKey = keyboard.addKey(KeyCodes.N)
  }

  // --- per-frame behaviour ------------------------------------------------

  /**
   * Move the clock on by however long the last frame took.
   *
   * `delta` is the game's own measure of that, which matters when the tab is
   * hidden: a hidden tab draws no frames at all, so the clock simply waits
   * there instead of quietly running on in the background, and Phaser caps the
   * one long frame you get on the way back. Reading a wall clock instead would
   * hand him a level that took eleven minutes because he went for lunch.
   *
   * The HUD is only rewritten when the tenth on screen actually changes.
   */
  private advanceTimer(delta: number): void {
    this.levelTimeMs += delta
    if (formatTime(this.levelTimeMs) !== this.shownTime) this.refreshHud()
  }

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
      // He squashes on EVERY touchdown, including the little bounces after
      // the first one — unlike the thud, which is debounced, because three
      // thuds in a row sound like a bug. Every squash is the same depth: a
      // gentle bounce flattens him just as much as a long drop, so a bounce
      // re-flattens him part-way through springing back. Restarting it on
      // every touchdown does mean he can never be left stuck mid-squash.
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
    // Falling in the pit puts him back at the start of the level, but it is NOT
    // starting the level again: he keeps his score, his coins and his clock.
    // Falling in costs you time — that's what makes a fast run worth something.
    if (this.player.y > TUNING.world.deathDepth) {
      this.player.setPosition(this.level.playerStart.x, this.level.playerStart.y)
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

    if (isLevelComplete(this.scoreState, this.level.coins.length)) {
      const outcome = afterLevel(this.levelIndex, LEVELS.length)
      this.outcome = outcome
      this.player.setVelocity(0, 0)

      // The clock stopped the instant `outcome` was set above, so this is his
      // real time for the level. Only a genuine record gets written down.
      const result = recordTime(this.bestTimes, this.level.name, this.levelTimeMs)
      if (result.isNewBest) {
        this.bestTimes = result.times
        saveBestTimes(result.times)
      }
      this.banner.setText(bannerText(outcome, finishBannerLines(this.levelTimeMs, result)))
      this.refreshHud()
      // Only reachable by picking up the last coin, and every coin is switched
      // off by then — so the fanfare plays once per win, never twice. Starting a
      // level runs create() again, which puts the coins back and clears
      // `outcome`, so the next win cheers too.
      if (outcome.kind === 'game-complete') this.beeper.play(winSound())
    }
  }

  private refreshHud(): void {
    const total = this.level.coins.length
    this.shownTime = formatTime(this.levelTimeMs)
    const best = bestTimeFor(this.bestTimes, this.level.name)

    // Short lines, and only THREE of them. The HUD has to keep out of the way
    // of the player, and it has been in his way twice now: once sideways, when
    // putting the level name on the same line as the score stretched it two
    // thirds of the way across the screen, and once downwards — a fourth line
    // reaches to y=106, and standing on the top ledge of level 2 puts the top
    // of his head at y=90, so he'd be behind the writing. Three lines stop at
    // y=83, clear of the highest ledge he can stand on in either level, which
    // is why the clock and the record share a line instead of taking one each.
    //
    // "THIS LEVEL" says out loud what is being timed — this level, not the
    // whole game — so it matches the coin count on the line above it.
    const clock = best === null ? '' : `  BEST ${formatTime(best)}`
    this.hud.setText([
      `LEVEL ${this.levelIndex + 1} ${this.level.name}`,
      `SCORE ${formatScore(this.scoreState.points)}   COINS ${this.scoreState.coinsCollected}/${total}`,
      // No record shown until there IS one: nothing to beat on your first go,
      // and an empty "BEST --:--" is just a puzzle for a kid to read.
      `THIS LEVEL ${this.shownTime}${clock}`,
    ])
  }
}

function anyKeyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown)
}
