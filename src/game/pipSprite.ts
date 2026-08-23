/**
 * Pip, drawn as a little grid of coloured squares.
 *
 * Each letter is one square. A dot is see-through. The grid is 16 squares
 * across and 24 down; the game draws every square 2 pixels wide, which makes
 * him exactly 32 x 48 — the same size the old yellow rectangle was, so nothing
 * about how he bumps into platforms changes.
 *
 * TO REDRAW HIM: edit the letters. Every row must stay 16 letters long and
 * there must stay 24 rows, or the test next door will tell you off. What each
 * letter is COLOURED is not here — that's `colors.pip` in `src/tuning.ts`.
 */
export const PIP_ROWS = [
  '....CCCCCCCC....',
  '...CCCCCCCCCC...',
  '...CCCCCCCCCC...',
  '...cccccccccccc.',
  '...SSSSSSSSSS...',
  '...SSEWSSEWSS...',
  '...SSEESSEESS...',
  '...SpSSSSSSpS...',
  '...SSWWWWWWSS...',
  '...SSSMMMMSSS...',
  '...SSSSSSSSSS...',
  '..YYYYYYYYYYYY..',
  '..YBBBBBBBBBBY..',
  '..YBBBBBBBBBBY..',
  '..SBBBBBBBBBBS..',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '...BBBB..BBBB...',
  '...bbbb..bbbb...',
  '...bbbb..bbbb...',
  '...bbbb..bbbb...',
  '..KKKKK..KKKKK..',
  '..KKKKK..KKKKK..',
] as const

/** How wide he is in squares — and therefore how long every row has to be. */
export const PIP_WIDTH = 16

/** How tall he is in squares. */
export const PIP_HEIGHT = 24

/**
 * How many screen pixels one square of him is drawn as.
 *
 * It lives here, beside the grid, because the two only mean anything together:
 * 16 × 24 squares at 2 pixels each is the 32 × 48 boy you see. `BootScene`
 * draws him at this size and the level-maker keeps ledges wider than he is,
 * both from `PIP_ON_SCREEN` below — so redrawing him a square taller in the
 * grid above makes the generated levels give him room for it, on their own.
 */
export const PIP_PIXEL = 2

/** How big he actually is on the 960 × 540 grid the levels are drawn on. */
export const PIP_ON_SCREEN = {
  width: PIP_WIDTH * PIP_PIXEL,
  height: PIP_HEIGHT * PIP_PIXEL,
}

/** The names of the colours he's made of. Each one is a key of `colors.pip`. */
export type PipColorName =
  | 'cap'
  | 'capBrim'
  | 'skin'
  | 'blush'
  | 'eye'
  | 'highlight'
  | 'mouth'
  | 'shirt'
  | 'overalls'
  | 'trousers'
  | 'shoes'

/** Which colour each letter in the grid above means. */
export const PIP_KEYS: Record<string, PipColorName> = {
  C: 'cap',
  c: 'capBrim',
  S: 'skin',
  p: 'blush',
  E: 'eye',
  W: 'highlight',
  M: 'mouth',
  Y: 'shirt',
  B: 'overalls',
  b: 'trousers',
  K: 'shoes',
}
