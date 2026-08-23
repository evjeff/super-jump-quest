# 💡 Ideas

Everything we might want to add. Anyone can add a line here — no format rules,
no permission needed.

**The rule: build ONE at a time, and get it fully working before starting the next.**

Half-finished features are the main reason hobby game projects die. A finished
small thing beats three half-built big things.

---

## 🔨 Building right now

_Nothing. Pick one thing from **Next up** and finish it before starting another._

## ✅ Done

- Player that runs and triple-jumps
- Platforms to jump between
- Coins to collect, with a score
- A "you win" screen when you get every coin
- Sounds for jumping, landing, and grabbing a coin — and each jump in a triple
  jump sounds a step higher than the last, so you can hear when you're out
- A little "ta-da!" fanfare when you win — four notes climbing up to a big
  finish, so winning sounds like winning
- He squashes when he lands — goes wide and short for a moment, then springs
  back, so he feels heavy instead of like a sliding box
- A second level, "The Tall Tower" — press N when you finish level 1 and you're
  straight into it: a hole in the ground to jump across, a staircase climbing
  into the sky, and one coin so high up that only a triple jump gets it. Your
  score keeps counting up across both levels, and R started the whole thing over
  (R plays *this* level again now — starting over moved to Shift+R when the
  levels stopped running out; see the last entry down here)
- **It works on a phone.** Turn the phone sideways and the game draws its own
  buttons: ◀ ▶ under your left thumb, a big ▲ under your right, and a little ↻
  in the corner to start over. Two thumbs at once, so you can run and jump
  together. Finish a level and you tap the screen to carry on instead of
  pressing N. Nothing changed on a computer — the keyboard works exactly the
  same as before
- **Platforms that MOVE, and a third level made out of them — "The Sky Ferry".**
  The purple ledges slide; the blue ones stay put. Stand on a purple one and it
  carries you along with it. Level 3 is broken in half by a hole so wide that
  even a triple jump can't clear it, so you have to stand at the edge and *wait*
  for the ferry to come to you, then ride across while three coins float past.
  Then a lift takes you up the sky — stand still and the coins come to you — and
  one last ferry slides along the roof of the level to the very last coin.
  If it's too fast, `platforms.movingSpeed` in `src/tuning.ts` slows every one of
  them down at once (`0.5` is half speed, `0` stops them dead)
- **Real artwork.** He isn't a yellow rectangle any more — he's **Pip**, a boy
  in a red cap and blue dungarees with a big open grin, and he turns to face
  whichever way he's running. Behind him the flat blue sky has become a proper
  night: dark overhead and lighter down at the horizon, a hundred-odd stars, a
  moon with craters and a soft halo, and three rows of hills getting darker as
  they come closer. Every colour of him and of the sky is a number you can
  change in `src/tuning.ts` — give him a green cap, make the moon pink — and
  his actual SHAPE is a little grid of letters in `src/game/pipSprite.ts` that
  you can redraw square by square
- A clock in the corner, counting the seconds on the level you're playing — it
  stops the moment you grab the last coin, and the game remembers your fastest
  finish on each level even after you close the tab, so there's always a time
  to beat and a big "NEW BEST TIME!" when you beat it
- **Stars that twinkle.** About one star in five now fades slowly in and out,
  each on its own timing so they never blink together. The rest of the sky is
  still one painted picture, so this costs almost nothing while you play.
  `stars.twinkleEvery` in `src/tuning.ts` decides how many twinkle (`1` = all of
  them, `0` = back to a still sky), `stars.twinkleMs` how slow the fade is, and
  `stars.dimmest` how faint they get
- **THE GAME NEVER ENDS.** You still beat level 3, you still get YOU WIN! — and
  then you press N and there's a level 4. And a level 5. And a level 500. The
  game makes them up itself, and it never runs out of them. Every one has its
  own made-up name in the corner, like *Star Hoard* or *Sky Wait*, so "I got to
  Coin Canyon" is a thing you can say at tea. **Level 7 is always the same
  level 7** — the same ledges in the same places, forever — so your best times
  still count and you can tell somebody which one to try. They get harder as you
  climb, but not by making the jumps huge: mostly the floor keeps disappearing
  from under you and more and more purple ledges slide about, so it's the
  *waiting* that gets hard, the way level 3 is hard. Each level picks ONE thing
  to be mean about and is kind everywhere else, and it's never the same thing
  two levels running. And it can't hand you a level you can't finish: it builds
  every one by pretending to be Pip, standing where he stands and only ever
  putting the next ledge somewhere he can really jump to. Then it checks its own
  level for things that are broken or boring, and if it doesn't like it, it
  throws it away and builds another one.
  **Two new buttons come with it:** `R` (or `↺` on a phone) plays the level
  you're on again from the very start — coins back, clock back to zero — and `N`
  (or `⏭`) skips a level that's beating you, though you don't get a best time
  for one you skipped. `Shift+R` (or `↻`) is the one that starts the whole game
  over. Want a completely different set of made-up levels? Change
  `levels.worldSeed` in `src/tuning.ts` to any other number and every level past
  3 becomes somewhere you've never been — change it back and the old ones return
  exactly as they were

## 📋 Next up

_Good starting points — each is small enough to finish in one sitting._

- [ ] A mute key, so the game can be played at bedtime
      (for now: set `sound.volume` to `0` in `src/tuning.ts`)
- [ ] **Level 2's free coin is under your thumb on a phone.** The one right where
      you start sits almost exactly where ▶ is drawn. The level checker found it;
      moving it is a decision about a hand-made level, so nobody has moved it
- [ ] **Coins hide behind the writing in the top-left corner.** There's a rule
      that keeps the made-up levels' coins away from the phone buttons, but
      nothing keeps them away from the score, the level name and the clock. It
      happens a lot — about sixty-five coins in the first forty levels, level 5
      included. Adding the rule is easy; the catch is that adding ANY rule
      reshuffles every made-up level and wipes the best times on them, so it is
      worth doing together with anything else we want to change

## 🌟 Someday / bigger

- [ ] Enemies that walk back and forth
- [ ] A double-jump that leaves sparkles
- [ ] Pip WALKS instead of sliding — legs that actually move when he runs
- [ ] Background music
- [ ] A boss at the end
- [ ] Power-ups (super speed, super jump, shield)

## ❓ Questions to figure out

- What's the main character's name? (the code calls him **Pip** for now — that
  was a placeholder, not a decision. Say a better one and he's renamed)
- What is he collecting the coins *for*?
- Who's the bad guy?
