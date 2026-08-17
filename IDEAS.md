# 💡 Ideas

Everything we might want to add. Anyone can add a line here — no format rules,
no permission needed.

**The rule: build ONE at a time, and get it fully working before starting the next.**

Half-finished features are the main reason hobby game projects die. A finished
small thing beats three half-built big things.

---

## 🔨 Building right now

- **Level 3, "The Sky Ferry" — platforms that MOVE.** Some ledges slide back and
  forth across a gap too wide to jump, and some go up and down like a lift. You
  stand on one and it carries you. The whole level is built around waiting for
  the right moment instead of just aiming.
  (Notes: [`docs/adr/20260817-moving-platforms-level-3/`](docs/adr/20260817-moving-platforms-level-3/README.md))

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
- A clock in the corner, counting the seconds on the level you're playing — it
  stops the moment you grab the last coin, and the game remembers your fastest
  finish on each level even after you close the tab, so there's always a time
  to beat and a big "NEW BEST TIME!" when you beat it

## 📋 Next up

_Good starting points — each is small enough to finish in one sitting._

- [ ] A mute key, so the game can be played at bedtime
      (for now: set `sound.volume` to `0` in `src/tuning.ts`)

## 🌟 Someday / bigger

- [ ] Enemies that walk back and forth
- [ ] A double-jump that leaves sparkles
- [ ] Real drawn artwork instead of colored shapes
- [ ] Background music
- [ ] A boss at the end
- [ ] Power-ups (super speed, super jump, shield)

## ❓ Questions to figure out

- What's the main character's name?
- What is he collecting the coins *for*?
- Who's the bad guy?
