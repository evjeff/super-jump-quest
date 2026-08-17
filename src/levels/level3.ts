/**
 * ===========================================================
 *  LEVEL 3 — THE MAP
 * ===========================================================
 *
 * The level where the ground moves.
 *
 * Levels 1 and 2 asked "can you aim?". This one asks "can you WAIT?" — every
 * purple ledge slides back and forth, and standing on one carries you along
 * with it. Three of them, each teaching the same trick a bit harder:
 *
 *   1. THE FERRY. The ground is broken in half and the hole is 500 wide. Three
 *      jumps in a row only carry him about 450, so there is NO jumping this
 *      one — the ferry is the only way across. Stand on the left and wait for
 *      it to come to you. Three coins hang over the hole for the ride.
 *   2. THE LIFT. On the right, a ledge that climbs into the sky and comes back
 *      down. Stand on it and do nothing at all; the coins come to you.
 *   3. THE SKY FERRY. From the shelf at the top, one last slider carries him
 *      back across the roof of the level to the very last coin.
 *
 * The purple ledges are the ones that move. The blue ones stand still. That
 * colour is `colors.movingPlatform` in `tuning.ts`.
 *
 * The numbers work like levels 1 and 2:
 *   x = how far right (0 is the left edge, 960 is the right edge)
 *   y = how far DOWN (0 is the top, 540 is the bottom)
 * x and y are the CENTER of the thing you're placing — and for a platform that
 * moves, they're where it STARTS. `moves` says where it goes from there.
 *
 * What `tuning.ts` allows today decides what's possible here: he rises about
 * 113 pixels in one jump, 225 in two, 338 in three, and moves about 190
 * sideways during a single jump. Every hop on and off a moving ledge is kept
 * well inside ONE jump, because the level is already asking him to time it as
 * well as aim it. The one number chosen against him is the 520-wide hole.
 *
 * Too fast? `platforms.movingSpeed` in `tuning.ts` slows every mover down at
 * once — 0.5 is half speed, and 0 stops them dead.
 */

import type { Level } from './index'

export const LEVEL_3: Level = {
  name: 'The Sky Ferry',

  playerStart: { x: 80, y: 400 },

  platforms: [
    // The ground, in two pieces, with 500 pixels of nothing in between.
    // Left piece: the left edge to x=300. Right piece: x=800 to the right edge.
    { x: 150, y: 520, width: 300, height: 40 },
    { x: 880, y: 520, width: 160, height: 40 },

    // THE FERRY. It waits out over the hole, just past the end of the ground.
    // Stand at the edge, and when it is near, jump across onto it. It carries
    // him the rest of the way in three seconds and finishes with its front end
    // over the far ground, where he walks straight off it. Then it comes all
    // the way back for the next person.
    //
    // Where it waits took three goes, and both wrong answers are worth knowing:
    //
    //   - Parked further right, out in the middle, there was about a third of a
    //     second in every eight when jumping from the edge could reach it. You
    //     had to already know it was coming. So it waits at THIS end.
    //   - Parked over the ground instead, so he could ride from a standing
    //     start, it sat directly above his head — and then jumping just bonked
    //     him on its underside. A platform you are standing under is a ceiling,
    //     not a lift.
    //
    // So its deck stops at x=305, five pixels past where the ground ends: never
    // over him, always within one jump. That gives about a second and a third
    // of a window, which is enough to be caught by someone who has never seen
    // the level before.
    { x: 390, y: 430, width: 170, height: 24, moves: { moveX: 370, seconds: 3 } },

    // THE LIFT. Jump up onto it from the far ground and ride. It climbs 160 and
    // stops level with the shelf, so stepping off at the top is a sideways hop
    // rather than a leap of faith.
    { x: 840, y: 430, width: 120, height: 24, moves: { moveY: -160, seconds: 3.5 } },

    // The shelf the lift delivers him to. This one stands still — after two
    // rides, somewhere to stand and think is a kindness.
    { x: 600, y: 270, width: 220, height: 24 },

    // THE SKY FERRY, along the roof of the level. It starts just past the left
    // end of the shelf and 80 higher, which is one easy jump, then slides left.
    { x: 380, y: 190, width: 130, height: 24, moves: { moveX: -180, seconds: 3.5 } },

    // The perch at the end of everything, just past where the sky ferry stops.
    { x: 60, y: 170, width: 120, height: 24 },
  ],

  coins: [
    // Two to warm up on, both one jump above the starting ground. They sit
    // above where a phone draws its ◀ ▶ buttons, so no coin hides under a thumb.
    //
    // Neither is at x=80, and that matters: he starts at (80, 400), so a coin
    // there would be collected before he had touched a key, and level 3 would
    // open on "COINS 1/13". It did, the first time.
    { x: 40, y: 400 },
    { x: 180, y: 400 },

    // Hanging over the hole, at exactly the height of someone riding the
    // ferry. There is no other way to reach them: standing still IS the trick.
    { x: 450, y: 390 },
    { x: 570, y: 390 },
    { x: 690, y: 390 },

    // Over the far ground, high enough to need a double jump, and clear of both
    // the lift's column and the phone's ▲ button.
    { x: 930, y: 340 },

    // Three up the lift's climb. Get on, stand still, collect all three.
    { x: 840, y: 380 },
    { x: 840, y: 330 },
    { x: 840, y: 285 },

    // On the shelf at the top.
    { x: 600, y: 230 },

    // Two along the sky ferry's crossing, at riding height again.
    { x: 300, y: 150 },
    { x: 240, y: 150 },

    // The last coin in the game, out on the perch at the far end of the sky.
    { x: 60, y: 130 },
  ],
}
