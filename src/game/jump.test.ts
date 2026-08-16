import { describe, expect, it } from 'vitest'
import { canJump, createJumpState, registerJump, syncGrounded } from './jump'

describe('canJump', () => {
  it('allows a jump when standing on the ground', () => {
    expect(canJump({ jumpsUsed: 0, onGround: true }, 2)).toBe(true)
  })

  it('allows a second jump in mid-air when maxJumps is 2', () => {
    expect(canJump({ jumpsUsed: 1, onGround: false }, 2)).toBe(true)
  })

  it('refuses a third jump in mid-air when maxJumps is 2', () => {
    expect(canJump({ jumpsUsed: 2, onGround: false }, 2)).toBe(false)
  })

  it('refuses a mid-air jump when maxJumps is 1', () => {
    expect(canJump({ jumpsUsed: 1, onGround: false }, 1)).toBe(false)
  })

  it('refuses every jump when maxJumps is 0', () => {
    expect(canJump({ jumpsUsed: 0, onGround: true }, 0)).toBe(false)
  })
})

describe('registerJump', () => {
  it('counts a ground jump as the first jump', () => {
    expect(registerJump({ jumpsUsed: 0, onGround: true })).toEqual({
      jumpsUsed: 1,
      onGround: false,
    })
  })

  it('increments the counter for an air jump', () => {
    expect(registerJump({ jumpsUsed: 1, onGround: false })).toEqual({
      jumpsUsed: 2,
      onGround: false,
    })
  })
})

describe('syncGrounded', () => {
  it('refills jumps on landing', () => {
    expect(syncGrounded({ jumpsUsed: 2, onGround: false }, true)).toEqual({
      jumpsUsed: 0,
      onGround: true,
    })
  })

  it('does not refill jumps while still airborne', () => {
    expect(syncGrounded({ jumpsUsed: 1, onGround: false }, false)).toEqual({
      jumpsUsed: 1,
      onGround: false,
    })
  })

  it('keeps the counter at zero while standing still on the ground', () => {
    expect(syncGrounded({ jumpsUsed: 0, onGround: true }, true)).toEqual({
      jumpsUsed: 0,
      onGround: true,
    })
  })

  it('remembers spent jumps when walking off a ledge', () => {
    // Walking off an edge without jumping must NOT grant a free ground jump.
    const walkedOff = syncGrounded({ jumpsUsed: 0, onGround: true }, false)
    expect(walkedOff).toEqual({ jumpsUsed: 0, onGround: false })
    expect(canJump(walkedOff, 2)).toBe(true)
  })
})

describe('a full double jump sequence', () => {
  it('allows exactly two jumps between landings', () => {
    let state = createJumpState()
    state = syncGrounded(state, true)

    expect(canJump(state, 2)).toBe(true)
    state = registerJump(state)

    expect(canJump(state, 2)).toBe(true)
    state = registerJump(state)

    expect(canJump(state, 2)).toBe(false)

    state = syncGrounded(state, true)
    expect(canJump(state, 2)).toBe(true)
  })
})
