import { describe, expect, it } from 'vitest'
import { collectCoin, createScoreState, formatScore, isLevelComplete } from './score'

describe('collectCoin', () => {
  it('starts at zero', () => {
    expect(createScoreState()).toEqual({ points: 0, coinsCollected: 0 })
  })

  it('can start from the score carried in from an earlier level', () => {
    // A new level means new coins to find, but the same running score.
    expect(createScoreState(70)).toEqual({ points: 70, coinsCollected: 0 })
  })

  it('adds the coin value and counts the coin', () => {
    const state = collectCoin(createScoreState(), 10)
    expect(state).toEqual({ points: 10, coinsCollected: 1 })
  })

  it('accumulates across several coins', () => {
    let state = createScoreState()
    for (let i = 0; i < 3; i++) {
      state = collectCoin(state, 10)
    }
    expect(state).toEqual({ points: 30, coinsCollected: 3 })
  })

  it('does not mutate the state it was given', () => {
    const before = createScoreState()
    collectCoin(before, 10)
    expect(before).toEqual({ points: 0, coinsCollected: 0 })
  })
})

describe('isLevelComplete', () => {
  it('is false with coins still on the map', () => {
    expect(isLevelComplete({ points: 20, coinsCollected: 2 }, 7)).toBe(false)
  })

  it('is true once every coin is collected', () => {
    expect(isLevelComplete({ points: 70, coinsCollected: 7 }, 7)).toBe(true)
  })

  it('is false for a level with no coins at all', () => {
    // Guards against an empty level instantly reporting "you win".
    expect(isLevelComplete({ points: 0, coinsCollected: 0 }, 0)).toBe(false)
  })
})

describe('formatScore', () => {
  it('pads short scores so the HUD does not jitter', () => {
    expect(formatScore(0)).toBe('00000')
    expect(formatScore(70)).toBe('00070')
  })

  it('leaves long scores alone', () => {
    expect(formatScore(123456)).toBe('123456')
  })
})
