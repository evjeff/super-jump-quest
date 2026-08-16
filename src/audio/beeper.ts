/**
 * ===========================================================
 *  THE THING THAT ACTUALLY MAKES NOISE
 * ===========================================================
 *
 * Takes a sound recipe from `src/game/sounds.ts` and plays it through the
 * browser's Web Audio, one oscillator per note. No sound files, no downloads,
 * no waiting — the same idea as `BootScene` drawing sprites in code.
 *
 * This is the only file that knows a speaker exists. If it ever needs replacing
 * with real recorded sounds, nothing outside this file has to change.
 */

import Phaser from 'phaser'
import type { Beep, Sound } from '../game/sounds'

/** Where the noise goes. Phaser owns both of these; we borrow them. */
export interface AudioOutput {
  context: AudioContext
  destination: AudioNode
}

export interface Beeper {
  play(sound: Sound): void
}

/** Fades in this fast, in seconds. Starting a note instantly makes an ugly click. */
const ATTACK_SECONDS = 0.008

/** Web Audio cannot ramp to true zero, so "silent" is this instead. */
const NEAR_SILENT = 0.0001

const SILENT_BEEPER: Beeper = { play: () => {} }

/**
 * Build the noise-maker.
 *
 * Returns a beeper that does nothing at all when there's no audio available or
 * the volume is turned down to 0 — so callers never have to check, and turning
 * the sound off can never crash the game.
 */
export function createBeeper(output: AudioOutput | null, masterVolume: number): Beeper {
  if (!output || masterVolume <= 0) return SILENT_BEEPER

  return {
    play(sound: Sound): void {
      // Browsers keep audio asleep until the player touches or presses
      // something. Phaser wakes it on the first input; until then, staying
      // quiet is better than queueing up beeps that all fire at once later.
      if (output.context.state !== 'running') return

      const now = output.context.currentTime
      for (const beep of sound) {
        playBeep(output, beep, now + beep.delay, masterVolume)
      }
    },
  }
}

/**
 * Borrow Phaser's audio plumbing, if it has any.
 *
 * Using Phaser's context rather than our own means Phaser handles waking the
 * audio up on the first key press, and its master mute/volume still work.
 * Returns null on browsers where Phaser fell back to no audio at all.
 */
export function webAudioOutput(manager: Phaser.Sound.BaseSoundManager): AudioOutput | null {
  if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return null

  return { context: manager.context, destination: manager.destination }
}

/** One note: an oscillator sliding in pitch, under a volume envelope. */
function playBeep(output: AudioOutput, beep: Beep, startAt: number, masterVolume: number): void {
  const { context, destination } = output
  const endAt = startAt + beep.duration
  const peak = beep.volume * masterVolume

  const oscillator = context.createOscillator()
  oscillator.type = beep.waveform
  oscillator.frequency.setValueAtTime(beep.startFreq, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(beep.endFreq, endAt)

  const envelope = context.createGain()
  const attackEnd = startAt + Math.min(ATTACK_SECONDS, beep.duration / 2)
  envelope.gain.setValueAtTime(NEAR_SILENT, startAt)
  envelope.gain.exponentialRampToValueAtTime(peak, attackEnd)
  envelope.gain.exponentialRampToValueAtTime(NEAR_SILENT, endAt)

  oscillator.connect(envelope)
  envelope.connect(destination)

  oscillator.onended = () => {
    oscillator.disconnect()
    envelope.disconnect()
  }
  oscillator.start(startAt)
  oscillator.stop(endAt)
}
