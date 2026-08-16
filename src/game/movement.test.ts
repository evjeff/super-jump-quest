import { describe, expect, it } from 'vitest'
import { facingDirection, horizontalVelocity } from './movement'

describe('horizontalVelocity', () => {
  it('stands still when nothing is held', () => {
    expect(horizontalVelocity({ left: false, right: false }, 220)).toBe(0)
  })

  it('moves right at full speed', () => {
    expect(horizontalVelocity({ left: false, right: true }, 220)).toBe(220)
  })

  it('moves left at full speed', () => {
    expect(horizontalVelocity({ left: true, right: false }, 220)).toBe(-220)
  })

  it('cancels out when both directions are held', () => {
    expect(horizontalVelocity({ left: true, right: true }, 220)).toBe(0)
  })
})

describe('facingDirection', () => {
  it('faces left when moving left', () => {
    expect(facingDirection(-220, 'right')).toBe('left')
  })

  it('faces right when moving right', () => {
    expect(facingDirection(220, 'left')).toBe('right')
  })

  it('keeps the previous facing when standing still', () => {
    expect(facingDirection(0, 'left')).toBe('left')
    expect(facingDirection(0, 'right')).toBe('right')
  })
})
