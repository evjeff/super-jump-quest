# 💡 Ideas

Everything we might want to add. Anyone can add a line here — no format rules,
no permission needed.

**The rule: build ONE at a time, and get it fully working before starting the next.**

Half-finished features are the main reason hobby game projects die. A finished
small thing beats three half-built big things.

---

## 🔨 Building right now

_(nothing yet — pick something from below)_

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
  score keeps counting up across both levels, and R starts the whole thing over
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

## 📋 Next up

_Good starting points — each is small enough to finish in one sitting._

- [ ] A mute key, so the game can be played at bedtime
      (for now: set `sound.volume` to `0` in `src/tuning.ts`)
- [ ] Stars that twinkle. The sky is one still picture at the moment, so the
      stars just sit there

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
