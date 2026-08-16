import { describe, expect, it } from 'vitest'
import { coinSound, isDistinctLanding, jumpSound, landingSound, winSound } from './sounds'

describe('coinSound', () => {
  it('is two notes, the second higher than the first', () => {
    const [first, second] = coinSound()

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(second?.startFreq).toBeGreaterThan(first?.startFreq ?? 0)
  })

  it('plays the second note after the first has started', () => {
    const [first, second] = coinSound()

    expect(second?.delay ?? 0).toBeGreaterThan(first?.delay ?? 0)
  })
})

describe('jumpSound', () => {
  it('climbs in pitch with each jump in the chain', () => {
    const first = jumpSound(1)[0]
    const second = jumpSound(2)[0]
    const third = jumpSound(3)[0]

    expect(second?.startFreq).toBeGreaterThan(first?.startFreq ?? 0)
    expect(third?.startFreq).toBeGreaterThan(second?.startFreq ?? 0)
  })

  it('swoops upward within a single jump', () => {
    const [beep] = jumpSound(1)

    expect(beep?.endFreq).toBeGreaterThan(beep?.startFreq ?? 0)
  })

  it('stops climbing eventually, so maxJumps of 20 is not a dog whistle', () => {
    expect(jumpSound(20)[0]?.startFreq).toBe(jumpSound(5)[0]?.startFreq)
  })

  it('treats a nonsense jump number as the first jump', () => {
    expect(jumpSound(0)[0]?.startFreq).toBe(jumpSound(1)[0]?.startFreq)
  })
})

describe('landingSound', () => {
  it('lands lower than it starts, like a thud', () => {
    const [beep] = landingSound()

    expect(beep?.endFreq).toBeLessThan(beep?.startFreq ?? 0)
  })
})

describe('winSound', () => {
  // A win screen you have to wait through stops being a reward. The whole
  // fanfare has to be over before the kid reaches for the R key.
  const BUDGET_SECONDS = 1

  it('is a little tune, not a single beep', () => {
    expect(winSound().length).toBeGreaterThan(1)
  })

  it('plays its notes one after another, never all at once', () => {
    const delays = winSound().map((beep) => beep.delay)

    for (let i = 1; i < delays.length; i++) {
      expect(delays[i] ?? 0).toBeGreaterThan(delays[i - 1] ?? 0)
    }
  })

  it('climbs, so it sounds like cheering rather than sighing', () => {
    const pitches = winSound().map((beep) => beep.startFreq)

    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i] ?? 0).toBeGreaterThan(pitches[i - 1] ?? 0)
    }
  })

  it('finishes on the octave above the note it started on', () => {
    const notes = winSound()
    const first = notes[0]
    const last = notes[notes.length - 1]

    // Doubling a pitch is the same note, one octave up. Landing there is what
    // makes it sound finished instead of stopping in the middle.
    expect(last?.startFreq).toBeCloseTo((first?.startFreq ?? 0) * 2, 0)
  })

  it('is over and done with inside the budget', () => {
    const endsAt = Math.max(...winSound().map((beep) => beep.delay + beep.duration))

    expect(endsAt).toBeLessThan(BUDGET_SECONDS)
  })
})

describe('every sound recipe', () => {
  // Web Audio's exponential ramps blow up on zero or negative values, so a
  // recipe with a 0 anywhere is a silent crash waiting to happen.
  const everyBeep = [coinSound(), jumpSound(1), jumpSound(3), landingSound(), winSound()].flat()

  it('uses positive pitches, durations and volumes', () => {
    for (const beep of everyBeep) {
      expect(beep.startFreq).toBeGreaterThan(0)
      expect(beep.endFreq).toBeGreaterThan(0)
      expect(beep.duration).toBeGreaterThan(0)
      expect(beep.volume).toBeGreaterThan(0)
      // Above 1 the note clips into a nasty crackle instead of getting louder.
      expect(beep.volume).toBeLessThanOrEqual(1)
      expect(beep.delay).toBeGreaterThanOrEqual(0)
    }
  })

  it('stays short enough not to overlap the next one', () => {
    for (const beep of everyBeep) {
      expect(beep.duration).toBeLessThan(0.5)
    }
  })
})

describe('isDistinctLanding', () => {
  it('allows the very first landing', () => {
    expect(isDistinctLanding(5000, 0, 120)).toBe(true)
  })

  it('ignores a bounce that re-lands a few frames later', () => {
    expect(isDistinctLanding(5050, 5000, 120)).toBe(false)
  })

  it('allows a real landing after the cooldown', () => {
    expect(isDistinctLanding(5200, 5000, 120)).toBe(true)
  })

  it('allows a landing exactly on the cooldown boundary', () => {
    expect(isDistinctLanding(5120, 5000, 120)).toBe(true)
  })
})
