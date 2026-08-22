import { describe, expect, it } from 'vitest'
import { afterLevel, bannerText } from './progress'

describe('afterLevel', () => {
  it('sends you to the next level when there is one', () => {
    expect(afterLevel(0, 2)).toEqual({ kind: 'next-level', levelIndex: 1 })
  })

  it('is the end of the game after the last level', () => {
    expect(afterLevel(1, 2)).toEqual({ kind: 'game-complete' })
  })

  it('is the end of the game when there is only one level', () => {
    expect(afterLevel(0, 1)).toEqual({ kind: 'game-complete' })
  })

  it('is the end of the game for a level number that does not exist', () => {
    // Nothing should ever ask this, but "you win" is a much kinder answer than
    // sending him to a level that isn't there.
    expect(afterLevel(7, 2)).toEqual({ kind: 'game-complete' })
    expect(afterLevel(-1, 2)).toEqual({ kind: 'game-complete' })
  })

  it('is the end of the game when there are no levels at all', () => {
    expect(afterLevel(0, 0)).toEqual({ kind: 'game-complete' })
  })

  // Levels 1 to 3 are the ones we drew. Past them the game makes its own up
  // and never runs out — but finishing the last hand-made one is still a real
  // win, so YOU WIN! stays exactly where it was.
  describe('when the levels never run out', () => {
    it('still wins the game after the last hand-made level', () => {
      expect(afterLevel(2, 3, true)).toEqual({ kind: 'game-complete', levelIndex: 3 })
    })

    it('says which made-up level the win leads on to', () => {
      // Index 3 is the one a person calls level 4 — the first one the game
      // makes up for itself.
      const outcome = afterLevel(2, 3, true)
      expect(outcome.kind === 'game-complete' && outcome.levelIndex).toBe(3)
    })

    it('just carries on once you are past the hand-made levels', () => {
      expect(afterLevel(3, 3, true)).toEqual({ kind: 'next-level', levelIndex: 4 })
      expect(afterLevel(4, 3, true)).toEqual({ kind: 'next-level', levelIndex: 5 })
      expect(afterLevel(499, 3, true)).toEqual({ kind: 'next-level', levelIndex: 500 })
    })

    it('goes level to level exactly as before inside the hand-made ones', () => {
      expect(afterLevel(0, 3, true)).toEqual({ kind: 'next-level', levelIndex: 1 })
      expect(afterLevel(1, 3, true)).toEqual({ kind: 'next-level', levelIndex: 2 })
    })

    it('is still the plain old ending when endless is switched off', () => {
      // Nothing extra on the answer at all: the win screen has no level to
      // point at, so it says what it has always said.
      expect(afterLevel(2, 3, false)).toStrictEqual({ kind: 'game-complete' })
    })
  })
})

describe('bannerText', () => {
  it('counts levels from 1, the way a person does', () => {
    // Finishing level 1 (index 0) hands you level 2 (index 1).
    expect(bannerText({ kind: 'next-level', levelIndex: 1 })).toBe(
      'LEVEL 1 DONE!\npress N for level 2\npress R to start over at level 1',
    )
  })

  it('says which level is next further into the game', () => {
    expect(bannerText({ kind: 'next-level', levelIndex: 2 })).toContain('LEVEL 2 DONE!')
    expect(bannerText({ kind: 'next-level', levelIndex: 2 })).toContain('press N for level 3')
  })

  it('is the real win when the whole game is finished', () => {
    expect(bannerText({ kind: 'game-complete' })).toBe(
      'YOU WIN!\npress R to play again from level 1',
    )
  })

  it('puts extra lines right under the headline, where you look first', () => {
    expect(
      bannerText({ kind: 'next-level', levelIndex: 1 }, ['TIME 0:24.6', 'NEW BEST TIME!']),
    ).toBe(
      'LEVEL 1 DONE!\nTIME 0:24.6\nNEW BEST TIME!\npress N for level 2\npress R to start over at level 1',
    )
  })

  it('puts them on the win screen too', () => {
    expect(bannerText({ kind: 'game-complete' }, ['TIME 0:24.6', 'BEST 0:20.1'])).toBe(
      'YOU WIN!\nTIME 0:24.6\nBEST 0:20.1\npress R to play again from level 1',
    )
  })

  // Once the levels never run out, YOU WIN! is no longer the end of the
  // evening — it is a doorway into level 4.
  describe('when the win leads on to a made-up level', () => {
    it('points at the next level instead of only offering another go', () => {
      expect(bannerText({ kind: 'game-complete', levelIndex: 3 })).toBe(
        'YOU WIN!\npress N for level 4\npress R to start over at level 1',
      )
    })

    it('still says YOU WIN! and still shows the time', () => {
      const banner = bannerText({ kind: 'game-complete', levelIndex: 3 }, [
        'TIME 0:24.6',
        'NEW BEST TIME!',
      ])

      expect(banner.startsWith('YOU WIN!\nTIME 0:24.6\nNEW BEST TIME!')).toBe(true)
    })

    it('asks a phone for a tap, and keeps every line short enough to fit', () => {
      const banner = bannerText({ kind: 'game-complete', levelIndex: 3 }, ['TIME 0:24.6'], 'touch')

      expect(banner).toBe(
        'YOU WIN!\nTIME 0:24.6\ntap the screen for level 4\nor tap ↻ to start over',
      )
      for (const line of banner.split('\n')) {
        expect(line.length).toBeLessThanOrEqual(34)
      }
    })
  })

  // On a phone there is no N and no R, so the banner has to ask for something a
  // finger can actually do. Everything above the "press this" lines — the
  // headline, the time, the record — is the same either way.
  describe('on a touchscreen', () => {
    it('asks for a tap instead of the N key', () => {
      expect(bannerText({ kind: 'next-level', levelIndex: 1 }, [], 'touch')).toBe(
        'LEVEL 1 DONE!\ntap the screen for level 2\nor tap ↻ to start over',
      )
    })

    it('keeps every line short enough to fit on a phone', () => {
      // The banner is one lump of 40px monospace with no wrapping, so 34
      // characters is already the full width of the screen and anything longer
      // is cut off at both ends.
      //
      // BOTH endings are checked here. Only checking the next-level one is how
      // the win screen came to ship at 41 characters, quietly clipping the "1"
      // off "play again from level 1".
      const banners = [
        bannerText({ kind: 'next-level', levelIndex: 9 }, ['TIME 0:24.6'], 'touch'),
        bannerText({ kind: 'game-complete' }, ['TIME 0:24.6', 'NEW BEST TIME!'], 'touch'),
      ]

      for (const banner of banners) {
        for (const line of banner.split('\n')) {
          expect(line.length).toBeLessThanOrEqual(34)
        }
      }
    })

    it('asks for a tap instead of the R key on the win screen', () => {
      expect(bannerText({ kind: 'game-complete' }, [], 'touch')).toBe(
        'YOU WIN!\ntap to play again from level 1',
      )
    })

    it('still shows the time and the record', () => {
      expect(
        bannerText({ kind: 'game-complete' }, ['TIME 0:24.6', 'NEW BEST TIME!'], 'touch'),
      ).toContain('TIME 0:24.6\nNEW BEST TIME!')
    })

    it('never mentions a key a phone does not have', () => {
      const touchBanners = [
        bannerText({ kind: 'next-level', levelIndex: 1 }, [], 'touch'),
        bannerText({ kind: 'game-complete' }, [], 'touch'),
      ]

      for (const banner of touchBanners) {
        expect(banner).not.toContain('press N')
        expect(banner).not.toContain('press R')
      }
    })
  })
})
