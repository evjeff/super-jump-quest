import { describe, expect, it } from 'vitest'
import { TUNING } from '../tuning'
import { PIP_HEIGHT, PIP_KEYS, PIP_ROWS, PIP_WIDTH } from './pipSprite'

/**
 * Pip is hand-typed letters, so the ways he can break are typing mistakes: a
 * row one letter short, or a letter nobody gave a colour to. Neither would
 * crash the game — he'd just quietly come out the wrong shape or the wrong
 * colour, which is exactly the kind of thing nobody notices until Saturday.
 */
describe('the Pip sprite', () => {
  it('is 24 rows of 16 letters, which is what makes him 32 x 48', () => {
    expect(PIP_ROWS).toHaveLength(PIP_HEIGHT)
    for (const row of PIP_ROWS) {
      expect(row).toHaveLength(PIP_WIDTH)
    }
  })

  it('only uses letters that have been given a colour', () => {
    for (const row of PIP_ROWS) {
      for (const letter of row) {
        if (letter === '.') continue
        expect(PIP_KEYS, `no colour for the letter "${letter}"`).toHaveProperty(letter)
      }
    }
  })

  it('asks for colours that actually exist in tuning.ts', () => {
    for (const name of Object.values(PIP_KEYS)) {
      expect(TUNING.colors.pip).toHaveProperty(name)
    }
  })

  it('has a face: eyes, a mouth and two rosy cheeks', () => {
    const all = PIP_ROWS.join('')
    expect(all).toContain('E')
    expect(all).toContain('M')
    expect(all).toContain('p')
  })
})
