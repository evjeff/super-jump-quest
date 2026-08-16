/**
 * Jump rules — pure logic, no Phaser, no browser.
 *
 * Keeping the RULES separate from the DRAWING means we can test them in
 * milliseconds and prove a change didn't break double-jump.
 */

export interface JumpState {
  /** Jumps used since last touching the ground. */
  jumpsUsed: number
  /** Is the player standing on something right now? */
  onGround: boolean
}

export function createJumpState(): JumpState {
  return { jumpsUsed: 0, onGround: false }
}

/**
 * Can the player jump right now?
 *
 * Standing on the ground always allows a jump. In the air, it depends on how
 * many jumps are left (maxJumps of 2 gives the classic double jump).
 */
export function canJump(state: JumpState, maxJumps: number): boolean {
  if (maxJumps <= 0) return false
  if (state.onGround) return true
  return state.jumpsUsed < maxJumps
}

/** Record that a jump just happened. Returns the new state. */
export function registerJump(state: JumpState): JumpState {
  // Jumping off the ground is jump #1, so a ground jump always resets to 1.
  return {
    jumpsUsed: state.onGround ? 1 : state.jumpsUsed + 1,
    onGround: false,
  }
}

/**
 * Did he touch down on THIS frame?
 *
 * Ask this before calling `syncGrounded`, while the state still remembers that
 * he was in the air. It's the moment to play a landing sound or squash him.
 */
export function justLanded(state: JumpState, onGroundNow: boolean): boolean {
  return onGroundNow && !state.onGround
}

/** Called every frame with whether the player is touching the ground. */
export function syncGrounded(state: JumpState, onGround: boolean): JumpState {
  if (onGround && !state.onGround) {
    // Just landed — refill the jumps.
    return { jumpsUsed: 0, onGround: true }
  }
  return { ...state, onGround }
}
