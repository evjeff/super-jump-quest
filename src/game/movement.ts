/**
 * Horizontal movement rules — pure logic, no Phaser, no browser.
 */

export interface MoveInput {
  left: boolean
  right: boolean
}

/**
 * Turn "which keys are held" into a sideways velocity.
 *
 * Holding both directions at once cancels out, which is what players expect
 * and what stops the sprite from vibrating.
 */
export function horizontalVelocity(input: MoveInput, speed: number): number {
  const direction = Number(input.right) - Number(input.left)
  return direction * speed
}

/** Which way should the sprite face? Keeps facing the last direction moved. */
export function facingDirection(velocityX: number, previous: 'left' | 'right'): 'left' | 'right' {
  if (velocityX < 0) return 'left'
  if (velocityX > 0) return 'right'
  return previous
}
