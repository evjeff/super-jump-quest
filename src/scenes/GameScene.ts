import Phaser from 'phaser'
import type { Beeper } from '../audio/beeper'
import { createBeeper, webAudioOutput } from '../audio/beeper'
import type { JumpState } from '../game/jump'
import { canJump, createJumpState, justLanded, registerJump, syncGrounded } from '../game/jump'
import { facingDirection, horizontalVelocity } from '../game/movement'
import { pickRide, platformPosition, platformVelocity } from '../game/movingPlatform'
import type { ControlHint, Progress } from '../game/progress'
import { afterLevel, bannerText } from '../game/progress'
import type { ScoreState } from '../game/score'
import { collectCoin, createScoreState, formatScore, isLevelComplete } from '../game/score'
import { coinSound, isDistinctLanding, jumpSound, landingSound, winSound } from '../game/sounds'
import { squashScale } from '../game/squash'
import type { BestTimes } from '../game/timer'
import { bestTimeFor, finishBannerLines, formatTime, recordTime } from '../game/timer'
import type { TouchControlId } from '../game/touchControls'
import type { Level, Platform } from '../levels'
import { LEVELS } from '../levels'
import { loadBestTimes, saveBestTimes } from '../storage/bestTimes'
import { TUNING } from '../tuning'
import { TouchPad, wantsTouchControls } from './TouchPad'

/** What one level hands to the next when you press N. */
interface GameSceneData {
  levelIndex?: number
  points?: number
}

/** A platform that moves, and the level data that says where it should be. */
interface MovingPlatform {
  sprite: Phaser.Physics.Arcade.Sprite
  spec: Platform
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private playerSkin!: Phaser.GameObjects.Image
  private coins!: Phaser.Physics.Arcade.Group
  /**
   * The platforms that move, each paired with the level data it came from —
   * that data is what says where it should be at any given moment.
   */
  private movingPlatforms: MovingPlatform[] = []
  /**
   * The platform he is riding, or null if he is on his own two feet.
   *
   * He keeps it while he is in the air — see `updateRide`.
   */
  private ride: MovingPlatform | null = null
  /** Whether his feet are actually down on that ride, as opposed to over it. */
  private feetOnRide = false
  /**
   * How fast the deck was going sideways when he last had his feet on it.
   *
   * Jumping keeps this speed rather than following the platform, so a ferry
   * turning round below him doesn't turn him round in mid-air.
   */
  private rideVelocityX = 0
  private hud!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text

  private leftKeys: Phaser.Input.Keyboard.Key[] = []
  private rightKeys: Phaser.Input.Keyboard.Key[] = []
  private jumpKeys: Phaser.Input.Keyboard.Key[] = []
  private restartKey: Phaser.Input.Keyboard.Key | null = null
  private nextLevelKey: Phaser.Input.Keyboard.Key | null = null

  /** The on-screen buttons. Null on a computer, where the keyboard is enough. */
  private touchPad: TouchPad | null = null
  /** When the finish banner went up, so a leftover finger can't skip past it. */
  private bannerShownAt = 0

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
    this.bannerShownAt = 0
    this.ride = null
    this.feetOnRide = false
    this.rideVelocityX = 0
    // A fresh clock every time a level starts — and that's every time this runs,
    // whether he pressed N for the next level or R to start the whole game over.
    this.levelTimeMs = 0
    this.bestTimes = loadBestTimes()

    this.buildPlatforms()
    this.buildPlayer()
    this.buildCoins()
    this.buildHud()
    this.bindKeys()
    // Only a touchscreen gets on-screen buttons. Built last so they're drawn
    // over the top of everything else.
    this.touchPad = wantsTouchControls() ? new TouchPad(this) : null
    this.beeper = createBeeper(webAudioOutput(this.sound), TUNING.sound.volume)
  }

  override update(_time: number, delta: number): void {
    // Where the fingers are, before anything asks. Once per frame, first thing.
    this.touchPad?.read()

    // Always redraw him, even on the win screen, so he can never be left
    // frozen mid-squash.
    this.drawPlayer()

    // R — or the ↻ button on a phone — always means the same thing, wherever
    // you press it: back to the very beginning, score and all. Checked before
    // anything else so a kid stuck on a hard jump can start over without
    // reloading the page, and so that pressing ↻ on the finish banner starts
    // the game over rather than counting as a "tap to carry on".
    if (justDown(this.restartKey) || this.touchTapped('restart')) {
      this.scene.restart({ levelIndex: 0, points: 0 })
      return
    }

    // Everything below here is "still playing", so the clock stops the moment
    // the finish banner goes up and doesn't tick while it waits for a key.
    if (this.outcome) {
      this.handleBannerInput(this.outcome)
      return
    }

    this.advanceTimer(delta)
    // Asked BEFORE the platforms are moved on, so it compares where his feet
    // are with where the deck was underneath them this frame.
    this.updateRide()
    this.movePlatforms(delta)
    this.handleMovement()
    this.handleJumping()
    this.handleFalling()
    this.spinCoins()
  }

  /**
   * What only works while the big banner is up: N — or a tap anywhere, on a
   * phone — carries the score forward into the next level. (R and ↻ are
   * handled in `update`, because they work at any time.)
   */
  private handleBannerInput(outcome: Progress): void {
    // A tap only counts once the banner has been up a moment. Winning tends to
    // leave a finger on the jump button, and the very next press of it would
    // otherwise wipe away a "NEW BEST TIME!" nobody had time to read.
    const bannerSettled = this.time.now - this.bannerShownAt >= TUNING.touch.bannerTapDelayMs
    const tapped = bannerSettled && (this.touchPad?.wasScreenTapped() ?? false)

    if (outcome.kind === 'next-level') {
      if (justDown(this.nextLevelKey) || tapped) {
        this.scene.restart({ levelIndex: outcome.levelIndex, points: this.scoreState.points })
      }
      return
    }

    // The game is won. There is no next level, so a tap does what R does.
    if (tapped) this.scene.restart({ levelIndex: 0, points: 0 })
  }

  /**
   * Is this on-screen button being held? Always no on a computer, which has no
   * on-screen buttons — the keyboard is asked separately, and either can say
   * yes.
   */
  private touchHeld(id: TouchControlId): boolean {
    return this.touchPad?.isHeld(id) ?? false
  }

  /** Did this on-screen button go down this frame? Always no on a computer. */
  private touchTapped(id: TouchControlId): boolean {
    return this.touchPad?.wasJustPressed(id) ?? false
  }

  // --- setup -------------------------------------------------------------

  private buildPlatforms(): void {
    const platforms = this.physics.add.staticGroup()
    // Moving platforms can't live in the static group — "static" is Arcade's
    // word for "this never moves", and it bakes the collision box in place.
    // They get their own group: immovable, so standing on one (or shoving it)
    // can't knock it off course, and weightless, so it doesn't fall out of the
    // sky the moment the level starts.
    //
    // `frictionX: 0` turns OFF Arcade's own way of carrying a passenger, which
    // is to shunt anything resting on a moving body along with it. That way is
    // exact while his feet are down and does nothing at all while they are not
    // — so every jump taken aboard a ferry left him a little further back, and
    // a few jumps walked him off the end. `updateRide` below carries him
    // instead, and it keeps carrying him through a jump.
    //
    // This has to stay 0. Both ways at once would carry him twice, at double
    // the ferry's speed and off the front.
    const movers = this.physics.add.group({
      allowGravity: false,
      immovable: true,
      frictionX: 0,
    })
    this.movingPlatforms = []

    for (const spec of this.level.platforms) {
      if (spec.moves) {
        const block = movers.create(
          spec.x,
          spec.y,
          'movingPlatform',
        ) as Phaser.Physics.Arcade.Sprite
        block.setDisplaySize(spec.width, spec.height)
        // We put this one where it belongs ourselves, every frame, out of the
        // level clock. `directControl` is how you tell Arcade that: it works
        // out how fast the platform is going from how far it moved since the
        // last frame, instead of the other way round. Without it, a platform
        // that is simply placed somewhere new looks stationary to the physics,
        // and a stationary platform carries nobody.
        const body = block.body as Phaser.Physics.Arcade.Body
        body.directControl = true
        this.movingPlatforms.push({ sprite: block, spec })
      } else {
        const block = platforms.create(spec.x, spec.y, 'platform') as Phaser.Physics.Arcade.Sprite
        block.setDisplaySize(spec.width, spec.height)
        block.refreshBody()
      }
    }

    // Stored on the scene only long enough to wire the colliders in buildPlayer.
    this.data.set('platforms', platforms)
    this.data.set('movers', movers)
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

    // The same collider against the ones that move. This one only stops him
    // falling through and lifts him when a platform rises underneath him —
    // being carried sideways is `updateRide`'s job, not this collider's.
    const movers = this.data.get('movers') as Phaser.Physics.Arcade.Group
    this.physics.add.collider(this.player, movers)
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
    // A device with no keyboard at all is no longer a dead end: it gets the
    // on-screen buttons instead. Every key below simply never fires.
    if (!keyboard) return

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

  /**
   * Put every moving platform where the level clock says it should be.
   *
   * Where a platform is depends only on how long this level has been running,
   * so it is in the same place at the same second on a slow phone and a fast
   * laptop — which matters, because the game writes down your best time.
   *
   * It runs straight after the clock is advanced, and only while he's playing:
   * the clock stops when the finish banner goes up, so the platforms stop too.
   */
  private movePlatforms(deltaMs: number): void {
    const clock = this.platformClock

    for (const platform of this.movingPlatforms) {
      const { sprite, spec } = platform
      const { x, y } = platformPosition(spec, clock)

      // Feet down on the one he's riding: he goes exactly where it goes, moved
      // by the platform's own step rather than handed its speed and left to
      // the physics to work out. Both numbers then come from the same clock,
      // so there is nothing for them to drift apart by, on a fast machine or a
      // slow one. Giving him the speed instead was out by seven pixels after
      // three jumps on a busy laptop, and nothing pulls that error back.
      //
      // Sideways only. Up and down is the collision's job: a rising platform
      // pushes him up all by itself, and doing it here as well would lift him
      // twice.
      if (platform === this.ride && this.feetOnRide) this.player.x += x - sprite.x

      sprite.setPosition(x, y)
    }

    // In the air above it, he keeps the speed the deck had when he left, and
    // ignores what it does next. Following it would mean a ferry reaching the
    // end of its trip while he was mid-jump would turn him round in mid-air,
    // which is not something a jump should be able to do.
    if (this.ride && !this.feetOnRide) this.player.x += this.rideVelocityX * (deltaMs / 1000)
  }

  /**
   * The level clock as the platforms see it.
   *
   * Scaling the clock rather than the distances is what makes
   * `movingSpeed: 0` freeze everything instead of dividing by nothing.
   */
  private get platformClock(): number {
    return this.levelTimeMs * TUNING.platforms.movingSpeed
  }

  /**
   * Work out which moving platform he is riding.
   *
   * **He keeps his ride while he is in the air**, and that is the whole point
   * of this. Jumping straight up on a ferry should put him back down on the
   * same plank he left — a ferry that slides out from under him mid-jump costs
   * him a hundred pixels of deck, and two or three jumps walk him off the back
   * of it. Riding only while his feet are down is what a physics engine does
   * for free, and it feels wrong.
   *
   * So he only stops riding by landing on something else. Standing on solid
   * ground ends it; being in mid-air never does.
   */
  private updateRide(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const decks = this.movingPlatforms.map(({ sprite, spec }) => ({
      left: sprite.x - spec.width / 2,
      right: sprite.x + spec.width / 2,
      top: sprite.y - spec.height / 2,
      bottom: sprite.y + spec.height / 2,
    }))

    const riding = pickRide(body, decks)
    const platform = riding === null ? undefined : this.movingPlatforms[riding]
    this.feetOnRide = platform !== undefined

    if (platform) {
      this.ride = platform
      // Remembered every frame his feet are down, so the moment he jumps it
      // already holds the speed he is leaving with.
      this.rideVelocityX =
        platformVelocity(platform.spec, this.platformClock).x * TUNING.platforms.movingSpeed
      return
    }

    // Not stood on a moving platform. If he has come to rest on something, it
    // is solid ground and the ride is over. In mid-air, he keeps it.
    //
    // `blocked.down` and not `touching.down`, which is what the jumping code
    // asks for. `touching` says "something brushed me", and it comes back true
    // for the odd frame in the middle of a fall with nothing anywhere near him.
    // One of those used to end the ride 37 pixels above the deck, and by the
    // time his feet found it again the ferry was ten pixels further on — which
    // is exactly the drift this whole thing is here to stop.
    if (body.blocked.down) {
      this.ride = null
      this.rideVelocityX = 0
    }
  }

  private handleMovement(): void {
    // Keys and on-screen buttons say the same thing, so either one moves him —
    // and a laptop with a touchscreen can use whichever is nearer.
    const velocityX = horizontalVelocity(
      {
        left: anyKeyDown(this.leftKeys) || this.touchHeld('left'),
        right: anyKeyDown(this.rightKeys) || this.touchHeld('right'),
      },
      TUNING.player.speed,
    )
    // Just what he asked for. Being carried by a ferry is not a speed he is
    // travelling at — it's the floor moving — and it's applied in
    // `movePlatforms`. So walking on a moving deck adds up the way it should.
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
    // `feetOnRide` is in here because the collision flags flicker on a platform
    // that is moving under him: he sinks a fraction into the deck, gets pushed
    // back out, and the little bounce that follows counts as leaving the floor
    // and landing on it again. That makes him squash over and over while he is
    // just standing there riding, which looks like a fault in the game.
    //
    // Asking where his feet ARE instead of what the collision did this frame
    // is steady: it allows a few pixels of slack, and a bounce off a deck is
    // about one.
    const onGround = body.blocked.down || body.touching.down || this.feetOnRide

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

    const jumpPressed =
      this.jumpKeys.some((key) => Phaser.Input.Keyboard.JustDown(key)) || this.touchTapped('jump')
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
      // ...and not still being carried by the ferry he fell off.
      this.ride = null
      this.feetOnRide = false
      this.rideVelocityX = 0
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
      this.bannerShownAt = this.time.now
      this.player.setVelocity(0, 0)
      // Nothing left to steer, and the banner is the thing to read now. ↻ stays
      // where it is — on a phone it's the only way back to level 1.
      this.touchPad?.setThumbControlsVisible(false)

      // The clock stopped the instant `outcome` was set above, so this is his
      // real time for the level. Only a genuine record gets written down.
      const result = recordTime(this.bestTimes, this.level.name, this.levelTimeMs)
      if (result.isNewBest) {
        this.bestTimes = result.times
        saveBestTimes(result.times)
      }
      // The banner has to ask for something this player can actually do: a key
      // on a computer, a tap on a phone.
      const hint: ControlHint = this.touchPad ? 'touch' : 'keys'
      this.banner.setText(bannerText(outcome, finishBannerLines(this.levelTimeMs, result), hint))
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

/** Did this key go down this frame? A key that doesn't exist never does. */
function justDown(key: Phaser.Input.Keyboard.Key | null): boolean {
  return key !== null && Phaser.Input.Keyboard.JustDown(key)
}
