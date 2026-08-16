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
})
