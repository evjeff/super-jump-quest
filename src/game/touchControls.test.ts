import { describe, expect, it } from 'vitest'
import type { TouchButton, TouchControlId } from './touchControls'
import {
  isOnButton,
  justPressed,
  newFingerLanded,
  pressedButtons,
  touchButtonLayout,
} from './touchControls'

const OPTIONS = {
  width: 960,
  height: 540,
  radius: 52,
  jumpRadius: 60,
  restartRadius: 22,
  margin: 24,
  directionGap: 12,
}

const LAYOUT = touchButtonLayout(OPTIONS)

function button(id: TouchControlId): TouchButton {
  const found = LAYOUT.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no ${id} button in the layout`)
  return found
}

/** How far apart two buttons' middles are. */
function distance(a: TouchButton, b: TouchButton): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('touchButtonLayout', () => {
  it('lays out one button for each control', () => {
    expect(LAYOUT.map((entry) => entry.id).sort()).toEqual([
      'jump',
      'left',
      'playAgain',
      'restart',
      'right',
      'skip',
    ])
  })

  it('gives every button its own symbol', () => {
    // Three little rings in a row along the top only work if you can tell them
    // apart at a glance: ↻ start over, ↺ this level again, ⏭ skip it.
    const labels = LAYOUT.map((entry) => entry.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps every button fully on the screen', () => {
    // A button whose edge hangs off the screen is a button you cannot press.
    for (const entry of LAYOUT) {
      expect(entry.x - entry.radius).toBeGreaterThanOrEqual(0)
      expect(entry.y - entry.radius).toBeGreaterThanOrEqual(0)
      expect(entry.x + entry.radius).toBeLessThanOrEqual(OPTIONS.width)
      expect(entry.y + entry.radius).toBeLessThanOrEqual(OPTIONS.height)
    }
  })

  it('never lets two buttons overlap', () => {
    // Overlapping buttons mean one thumb pressing two things, which in this
    // game would be walking and restarting the level at the same time.
    for (const a of LAYOUT) {
      for (const b of LAYOUT) {
        if (a.id === b.id) continue
        expect(distance(a, b)).toBeGreaterThan(a.radius + b.radius)
      }
    }
  })

  it('puts the two direction buttons side by side at the bottom left', () => {
    const left = button('left')
    const right = button('right')

    expect(left.x).toBeLessThan(right.x)
    expect(left.y).toBe(right.y)
    // Bottom half of the screen, left half of the screen.
    expect(left.y).toBeGreaterThan(OPTIONS.height / 2)
    expect(right.x).toBeLessThan(OPTIONS.width / 2)
  })

  it('puts jump in the opposite bottom corner, within reach of the other thumb', () => {
    const jump = button('jump')

    expect(jump.x).toBeGreaterThan(OPTIONS.width / 2)
    expect(jump.y).toBeGreaterThan(OPTIONS.height / 2)
    // The button pressed most often is the biggest one.
    expect(jump.radius).toBeGreaterThan(button('left').radius)
  })

  it('puts restart at the top, out of both thumbs’ way and clear of the score', () => {
    const restart = button('restart')

    expect(restart.y).toBeLessThan(OPTIONS.height / 2)
    // The score and clock are drawn in the top-LEFT corner.
    expect(restart.x).toBeGreaterThan(OPTIONS.width / 2)
    // Small, so an accidental brush of the corner misses it.
    expect(restart.radius).toBeLessThan(button('left').radius)
  })

  it('lines the three little buttons up along the top, out of both thumbs’ way', () => {
    for (const entry of [button('restart'), button('playAgain'), button('skip')]) {
      expect(entry.y).toBe(button('restart').y)
      expect(entry.radius).toBe(OPTIONS.restartRadius)
      // Top half, right half: the score and the clock are drawn top-LEFT, and
      // the whole button has to be clear of them, not just its middle.
      expect(entry.y).toBeLessThan(OPTIONS.height / 2)
      expect(entry.x - entry.radius).toBeGreaterThan(OPTIONS.width / 2)
    }
  })

  it('keeps start-over in the far corner, with the two new ones inside it', () => {
    // ↻ has always been the corner one and has always meant the same thing.
    // Moving it would mean a thumb that knows where to go finding a different
    // button under it.
    expect(button('restart').x).toBeGreaterThan(button('playAgain').x)
    expect(button('playAgain').x).toBeGreaterThan(button('skip').x)
  })

  it('leaves a gap between the little buttons, so one press is one button', () => {
    const pairs: [TouchButton, TouchButton][] = [
      [button('restart'), button('playAgain')],
      [button('playAgain'), button('skip')],
    ]

    for (const [a, b] of pairs) {
      expect(distance(a, b) - a.radius - b.radius).toBeGreaterThanOrEqual(OPTIONS.directionGap)
    }
  })

  it('leaves the skip button out when skipping is switched off', () => {
    const without = touchButtonLayout({ ...OPTIONS, showSkip: false })

    expect(without.map((entry) => entry.id).sort()).toEqual([
      'jump',
      'left',
      'playAgain',
      'restart',
      'right',
    ])
  })

  it('leaves every other button exactly where it was when skipping is off', () => {
    // Switching skipping off must not shuffle the buttons a thumb already
    // knows the place of.
    for (const entry of touchButtonLayout({ ...OPTIONS, showSkip: false })) {
      expect(entry).toEqual(button(entry.id))
    }
  })

  it('keeps the skip button’s spot by default', () => {
    // The level-maker asks this same question when it decides where NOT to put
    // a coin. If switching the skip button off took its spot away, every
    // made-up level would quietly come out a different shape — and every best
    // time with it. So the spot is kept unless somebody asks for it not to be.
    expect(LAYOUT.some((entry) => entry.id === 'skip')).toBe(true)
  })

  it('moves the buttons with the screen size', () => {
    const smaller = touchButtonLayout({ ...OPTIONS, width: 480, height: 270 })
    const jump = smaller.find((entry) => entry.id === 'jump')

    expect(jump?.x).toBeLessThan(480)
    expect(jump?.y).toBeLessThan(270)
  })
})

describe('isOnButton', () => {
  const jump = button('jump')

  it('counts a finger in the middle', () => {
    expect(isOnButton(jump, { x: jump.x, y: jump.y })).toBe(true)
  })

  it('counts a finger right on the edge', () => {
    expect(isOnButton(jump, { x: jump.x + jump.radius, y: jump.y })).toBe(true)
  })

  it('ignores a finger just outside', () => {
    expect(isOnButton(jump, { x: jump.x + jump.radius + 1, y: jump.y })).toBe(false)
  })

  it('measures a real circle, not a square', () => {
    // The far corner of the button's bounding box is outside the circle.
    expect(isOnButton(jump, { x: jump.x + jump.radius, y: jump.y + jump.radius })).toBe(false)
  })
})

describe('pressedButtons', () => {
  const left = button('left')
  const jump = button('jump')

  it('presses nothing when nobody is touching the screen', () => {
    expect(pressedButtons(LAYOUT, [])).toEqual(new Set())
  })

  it('presses nothing when the touch is on empty screen', () => {
    expect(pressedButtons(LAYOUT, [{ x: 480, y: 270 }])).toEqual(new Set())
  })

  it('presses the button under the finger', () => {
    expect(pressedButtons(LAYOUT, [{ x: left.x, y: left.y }])).toEqual(new Set(['left']))
  })

  it('presses two buttons at once, so he can run and jump together', () => {
    const pressed = pressedButtons(LAYOUT, [
      { x: left.x, y: left.y },
      { x: jump.x, y: jump.y },
    ])

    expect(pressed).toEqual(new Set(['left', 'jump']))
  })

  it('tells the little top buttons apart', () => {
    // They sit side by side, so a finger on ↺ must not also press ↻ and throw
    // the whole run away.
    const playAgain = button('playAgain')
    expect(pressedButtons(LAYOUT, [{ x: playAgain.x, y: playAgain.y }])).toEqual(
      new Set(['playAgain']),
    )
  })

  it('counts two fingers on the same button once', () => {
    const pressed = pressedButtons(LAYOUT, [
      { x: jump.x, y: jump.y },
      { x: jump.x + 5, y: jump.y + 5 },
    ])

    expect(pressed).toEqual(new Set(['jump']))
  })

  it('lets go the moment the finger is no longer on the button', () => {
    // The whole point of asking every frame: a finger that slides off, or
    // leaves the screen without a "came up", cannot leave him running forever.
    expect(pressedButtons(LAYOUT, [{ x: left.x, y: left.y }])).toEqual(new Set(['left']))
    expect(pressedButtons(LAYOUT, [{ x: 480, y: 270 }])).toEqual(new Set())
  })
})

describe('justPressed', () => {
  const none: Set<TouchControlId> = new Set()

  it('fires on the frame the button goes down', () => {
    expect(justPressed(none, new Set(['jump']), 'jump')).toBe(true)
  })

  it('does not fire again while the button is held', () => {
    // Otherwise holding JUMP would spend a whole triple jump in three frames.
    expect(justPressed(new Set(['jump']), new Set(['jump']), 'jump')).toBe(false)
  })

  it('does not fire when the button comes back up', () => {
    expect(justPressed(new Set(['jump']), none, 'jump')).toBe(false)
  })

  it('fires again after a real second press', () => {
    expect(justPressed(new Set(['jump']), none, 'jump')).toBe(false)
    expect(justPressed(none, new Set(['jump']), 'jump')).toBe(true)
  })

  it('skips one level per press, however long the thumb stays there', () => {
    // Leaning on ⏭ must not skip level after level after level.
    expect(justPressed(none, new Set(['skip']), 'skip')).toBe(true)
    expect(justPressed(new Set(['skip']), new Set(['skip']), 'skip')).toBe(false)
  })

  it('does not confuse one button for another', () => {
    expect(justPressed(none, new Set(['left']), 'jump')).toBe(false)
  })
})

describe('newFingerLanded', () => {
  it('is a tap when the first finger lands', () => {
    expect(newFingerLanded(0, 1)).toBe(true)
  })

  it('is not a tap when a finger stays put', () => {
    // Winning happens mid-jump, so a thumb is still on ▲ when the banner goes
    // up. That finger must not skip the banner nobody has read yet.
    expect(newFingerLanded(1, 1)).toBe(false)
  })

  it('is not a tap when a finger comes up', () => {
    expect(newFingerLanded(1, 0)).toBe(false)
    expect(newFingerLanded(2, 1)).toBe(false)
  })

  it('is a tap even while another thumb is resting on the screen', () => {
    // The left thumb is usually still parked where ◀ was. Asking "is the screen
    // being touched" would answer yes the whole time and swallow this tap.
    expect(newFingerLanded(1, 2)).toBe(true)
  })

  it('is a tap when a hand lands with more than one finger at once', () => {
    expect(newFingerLanded(0, 2)).toBe(true)
  })
})
