/**
 * ===========================================================
 *  WHAT THE GAME SOUNDS LIKE
 * ===========================================================
 *
 * Every sound in the game is a recipe: "start at this pitch, slide to that
 * pitch, over this long, this loud". Nothing here makes a noise — these are
 * just numbers, so they can be tested in milliseconds without a browser.
 * `src/audio/beeper.ts` is the part that actually wiggles the speaker.
 *
 * There are no sound FILES to download, lose, or wait for. The computer plays
 * the notes itself, the same way `BootScene` draws the sprites instead of
 * loading pictures.
 *
 * Want a different noise? Change the numbers below and listen.
 */

/** The shape of the note. sine = smooth, square = old-arcade, triangle = soft. */
export type Waveform = 'sine' | 'square' | 'triangle' | 'sawtooth'

/** One note. A "sound" is a list of these, played together or one after another. */
export interface Beep {
  waveform: Waveform
  /** Pitch it starts at, in Hz. Higher number = squeakier. Middle C is 262. */
  startFreq: number
  /** Pitch it slides to by the time it ends. */
  endFreq: number
  /** How long it lasts, in seconds. */
  duration: number
  /** How loud, from 0 to 1, before the master volume in tuning.ts is applied. */
  volume: number
  /** How long to wait before this note starts, in seconds. 0 = immediately. */
  delay: number
}

export type Sound = Beep[]

/** Pitch of the very first jump. Each extra jump in the chain goes up from here. */
const JUMP_BASE_FREQ = 330

/** How much higher each jump in the chain sounds. 1.25 is roughly a musical third. */
const JUMP_PITCH_STEP = 1.25

/** Past this many jumps the pitch stops climbing, so `maxJumps: 20` stays listenable. */
const JUMP_PITCH_CEILING = 5

/**
 * The "boing" when he jumps.
 *
 * `jumpNumber` is which jump this is since he last touched the ground: 1 for the
 * jump off the floor, 2 for the double jump, 3 for the triple. Each one sounds a
 * step higher than the last, so a triple jump plays a little rising ladder and
 * you can HEAR that you're out of jumps.
 */
export function jumpSound(jumpNumber: number): Sound {
  const step = Math.min(Math.max(jumpNumber, 1), JUMP_PITCH_CEILING) - 1
  const startFreq = JUMP_BASE_FREQ * JUMP_PITCH_STEP ** step

  return [
    {
      waveform: 'square',
      startFreq,
      endFreq: startFreq * 2,
      duration: 0.12,
      volume: 0.45,
      delay: 0,
    },
  ]
}

/** The two-note "ding!" when he grabs a coin. */
export function coinSound(): Sound {
  return [
    {
      waveform: 'square',
      startFreq: 988,
      endFreq: 988,
      duration: 0.07,
      volume: 0.35,
      delay: 0,
    },
    {
      waveform: 'square',
      startFreq: 1319,
      endFreq: 1319,
      duration: 0.16,
      volume: 0.35,
      delay: 0.07,
    },
  ]
}

/**
 * The little "ta-da!" when you win.
 *
 * Four notes, one after another, each a step higher: C, E, G, and then C again
 * an octave up. Those first three are a C major chord — the happy-sounding one —
 * so it comes out as a cheer rather than a random pile of beeps, and landing
 * back on C at the top is what makes it sound FINISHED instead of stopping
 * halfway. The last note is held longer and a bit louder: that's the "daaa".
 *
 * The whole thing is over in about six-tenths of a second, so it celebrates and
 * then gets out of the way.
 */
export function winSound(): Sound {
  return [
    {
      waveform: 'square',
      startFreq: 523,
      endFreq: 523,
      duration: 0.1,
      volume: 0.38,
      delay: 0,
    },
    {
      waveform: 'square',
      startFreq: 659,
      endFreq: 659,
      duration: 0.1,
      volume: 0.38,
      delay: 0.09,
    },
    {
      waveform: 'square',
      startFreq: 784,
      endFreq: 784,
      duration: 0.1,
      volume: 0.38,
      delay: 0.18,
    },
    {
      waveform: 'square',
      startFreq: 1046,
      endFreq: 1046,
      duration: 0.3,
      volume: 0.45,
      delay: 0.27,
    },
  ]
}

/** The soft thud when he touches down. Quiet on purpose — it happens a lot. */
export function landingSound(): Sound {
  return [
    {
      waveform: 'triangle',
      startFreq: 200,
      endFreq: 90,
      duration: 0.1,
      volume: 0.4,
      delay: 0,
    },
  ]
}

/**
 * Is this a real landing, or the same landing bouncing?
 *
 * `player.bounce` makes him hop a little when he hits the ground, and each hop
 * counts as landing again. Without this the thud would stutter three times on
 * every touchdown. One thud per landing sounds like a person; three sounds like
 * a bug.
 *
 * All times are in milliseconds.
 */
export function isDistinctLanding(now: number, lastLandingAt: number, cooldownMs: number): boolean {
  return now - lastLandingAt >= cooldownMs
}
