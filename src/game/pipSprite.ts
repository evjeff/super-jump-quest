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
