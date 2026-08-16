/**
 * ===========================================================
 *  LEVEL 2 — THE MAP
 * ===========================================================
 *
 * Same idea as level 1, but meaner. Three things make it harder:
 *
 *   1. THE HOLE. The ground is broken in half. You have to jump across, land
 *      on the little island in the middle, then jump again. Walking off the
 *      island is not enough — you have to JUMP off it or you drop in the hole.
 *      (Falling in isn't the end: you pop back at the start and keep your score.)
 *   2. THE STAIRCASE. Five ledges climbing up the sky, each one a bit to the
 *      left of the one below. Run to the EDGE and then jump — jumping from the
 *      middle of a ledge means you land short.
 *   3. THE SKY COIN, way up over the left end of the ground. Two jumps can't
 *      reach it. Stand underneath, don't move, and press jump three times.
 *
 * The numbers work like level 1:
 *   x = how far right (0 is the left edge, 960 is the right edge)
 *   y = how far DOWN (0 is the top, 540 is the bottom)
 * x and y are the CENTER of the thing you're placing.
 *
 * Two numbers from `tuning.ts` decide what's possible here: he rises about 113
 * pixels per jump, and he moves sideways about 190 pixels during one jump. So
 * every step up is 90 or less, and every gap across is small enough to clear —
 * as long as you jump at the right moment. The one exception is the long shelf
 * at the end, which is deliberately too far, so that it takes two jumps. If you
 * make him jump higher or run faster in `tuning.ts`, all of this just gets
 * easier.
 */

import type { Level } from './index'

export const LEVEL_2: Level = {
  name: 'The Tall Tower',

  playerStart: { x: 80, y: 400 },

  platforms: [
    // The ground, in two pieces, with a big hole between them.
    // Left piece: from the left edge to x=300. Right piece: from x=660 across.
    { x: 150, y: 520, width: 300, height: 40 },
    { x: 810, y: 520, width: 300, height: 40 },

    // The island in the middle of the hole. Aim for it.
    { x: 470, y: 440, width: 140, height: 24 },

    // The staircase into the sky. Each ledge is 90 higher than the one below
    // and about 80 further left, which is just inside a single jump.
    { x: 890, y: 420, width: 130, height: 24 },
    { x: 670, y: 330, width: 130, height: 24 },
    { x: 460, y: 240, width: 130, height: 24 },
    { x: 250, y: 150, width: 130, height: 24 },

    // The long shelf, way back across the sky to the right. It sits level with
    // the top of the staircase, and it is much too far away for one jump.
    //
    // The trick is WHEN you press jump the second time. Jump off the edge, let
    // yourself drop all the way back down level with the ledge you left, and
    // then jump again: a late second jump carries you furthest, and it keeps
    // him where you can watch him instead of shooting up off the top of the
    // screen.
    { x: 740, y: 150, width: 160, height: 24 },
  ],

  coins: [
    { x: 200, y: 460 }, // free one, right where you start
    { x: 470, y: 400 }, // on the island in the hole
    { x: 780, y: 460 }, // your prize for getting across
    { x: 890, y: 380 }, // and now up the staircase...
    { x: 670, y: 290 },
    { x: 460, y: 200 },
    { x: 250, y: 110 },
    { x: 700, y: 110 }, // three in a row along the long shelf
    { x: 740, y: 110 },
    { x: 780, y: 110 },

    // THE SKY COIN. Floating over the left end of the ground with nothing to
    // stand on. He has to climb 247 pixels to touch it, and two jumps only lift
    // him 225 — so this is the one that needs all three.
    //
    // It sits this far left on purpose. Any closer and stepping off the end of
    // the staircase and simply falling would drop him straight through it, and
    // the one coin the whole level is built around would cost nothing.
    { x: 40, y: 195 },
  ],
}
