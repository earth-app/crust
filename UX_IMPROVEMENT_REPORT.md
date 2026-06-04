# UX & Engagement Expansion Report

## 1. Executive Summary

This pass ships a small library of reusable motion primitives (`SparkleBurst`, `PulseRing`, `CountUp`, `AnimatedGradientBorder`), a content-aware refresh of `InfoCard` (parallax images, pulsing play overlays for video/YouTube, animated equalizer for audio, banner-color affordances), a featured-rail glow via `AnimatedGradientBorder` on `special` `InfoCardGroup`s, a staggered fade-in sweep on the activities listing grid, and a proof-of-concept `MicroQuiz` activity widget with a sky-side `MMicroQuiz` sibling wired into `useAppHaptics`. The remaining roadmap is designed but unshipped to keep diff scope honest. **Headline pick: the `InfoCard` content-aware refresh** — it lands on the most viewed surface in the app, costs near-zero perf, and respects `prefers-reduced-motion` end-to-end.

## 2. Personas Considered

1. **Bored teenager (low/middle attention)** — wants instant payoff, hates dead air, will bounce in 8s if nothing moves.
2. **Hyperactive tween (low attention, middle school)** — wants tap targets, micro-rewards, color, anything to click.
3. **Curious adult (middle attention)** — wants substance + polish; jankiness reads as untrustworthy.
4. **Bored adult (middle/high attention)** — willing to read long-form, but wants a sense of momentum.
5. **Older generation (high attention, invited by family)** — wants legible, calm, predictable; sensitive to motion overload.
6. **Excited teenager invited by friend (middle attention)** — primed to engage, wants visual reward for trying things.

## 3. Ranked Implementation Matrix

Complexity / Ease / Impact are 1-5 (higher = more). Total = Impact + Ease - Complexity. Sorted by Total desc.

| Item                                                                           | Complexity | Ease | UX Impact | Total | Status   | Personas  |
| ------------------------------------------------------------------------------ | ---------- | ---- | --------- | ----- | -------- | --------- |
| InfoCard content-aware enhancements                                            | 2          | 4    | 5         | 7     | shipped  | 1,2,3,4,6 |
| `SparkleBurst` + `PulseRing` + `CountUp` + `AnimatedGradientBorder` primitives | 2          | 5    | 4         | 7     | shipped  | 1,2,4,6   |
| Activities listing staggered fade-in                                           | 1          | 5    | 3         | 7     | shipped  | 3,4,5,6   |
| `MicroQuiz` widget (crust + sky variant)                                       | 3          | 4    | 5         | 6     | shipped  | 1,2,6     |
| `special` InfoCardGroup gradient border                                        | 2          | 4    | 4         | 6     | shipped  | 2,3,4,6   |
| Streak counter in profile header (uses `CountUp`)                              | 2          | 4    | 4         | 6     | designed | 1,2,4,5,6 |
| Tap-to-react on prompt cards (haptic + sparkle burst)                          | 3          | 3    | 5         | 5     | designed | 1,2,6     |
| Discoverable scroll cue on first session                                       | 2          | 4    | 3         | 5     | designed | 1,2,5     |
| Hero stat bar on home (CountUp on impact + planet stats)                       | 3          | 3    | 4         | 4     | designed | 3,4,5     |
| "Daily challenge" chip in NavBar with PulseRing                                | 3          | 3    | 4         | 4     | designed | 1,2,4,6   |
| Article card image Ken-Burns hover                                             | 2          | 3    | 3         | 4     | designed | 3,4       |
| Quest step success micro-confetti (reuse SparkleBurst)                         | 2          | 4    | 4         | 6     | designed | 1,2,4,6   |
| Soft "new badge unlocked" floating ribbon                                      | 3          | 3    | 4         | 4     | designed | 1,2,4,5,6 |

## 4. What Was Shipped

### 4.1 Reusable animation primitives (`src/components/ui/`)

**Files**:

- `/Users/gamer/gmitch215/earth-app/crust/src/components/ui/SparkleBurst.vue`
- `/Users/gamer/gmitch215/earth-app/crust/src/components/ui/PulseRing.vue`
- `/Users/gamer/gmitch215/earth-app/crust/src/components/ui/CountUp.vue`
- `/Users/gamer/gmitch215/earth-app/crust/src/components/ui/AnimatedGradientBorder.vue`

Auto-imported as `<UiSparkleBurst>`, `<UiPulseRing>`, `<UiCountUp>`, `<UiAnimatedGradientBorder>` (Nuxt subfolder prefix convention).

**`UiSparkleBurst`** — props: `trigger: number` (incrementing watcher), `color`, `count` (capped at 60), `duration`. Renders a `pointer-events-none` absolute canvas inside its parent (parent must be `relative`). Particles fall with gravity, fade out, then canvas unmounts. Skipped entirely when `prefers-reduced-motion: reduce` or during SSR.

**`UiPulseRing`** — wraps a slot with a radiating ring via `@keyframes pulse-ring` (scoped CSS). `active` (default true) toggles it; `color` swaps the ring tint.

**`UiCountUp`** — extracts the easeOutCubic counter pattern from `CompletionOverlay.vue` into a reusable element. Animates from previous value to new value over `duration` (default 900ms). Falls back to instant when reduced motion is on.

**`UiAnimatedGradientBorder`** — wraps a slot with a 2px conic-gradient ring that rotates over `speed` seconds. Uses `mask-composite: exclude` to clip the inside; emits no extra DOM under reduced motion.

**Screenshot description**: imagine a soft halo of three colors slowly rotating around a featured card; tap a "correct" answer and 28 colored dots pop outward then fade.

**Rationale**: every reward primitive in the codebase had to be hand-rolled into `CompletionOverlay`. Pulling the pattern into reusable atoms makes the next 10 micro-reward moments a one-line addition.

### 4.2 InfoCard content-aware enhancements

**File**: `/Users/gamer/gmitch215/earth-app/crust/src/components/InfoCard.vue`

Backward-compatible additions:

- root card gains `hover:scale-[1.01]` (one-pixel lift) on hover
- `banner.color === 'error'` → root card plays `motion-preset-shake` on appear
- `banner.color === 'success'` → root card plays `motion-preset-pop` + a small pulsing star icon in the top-right corner
- `image` → parallax via `translate3d` on scroll (±5px, scroll-tied, rAF-throttled)
- `youtubeId` or `video` → centered `mdi:play-circle` overlay with `motion-preset-pulse`, fades in on hover and hides while video is playing
- `object.type` starts with `audio/` → four-bar SVG-free equalizer below the controls while the audio is playing (only when playing — saves CPU when idle)

All gated on `!prefersReducedMotion.value`. Parallax handler is `passive: true` and torn down in `onBeforeUnmount`.

**Rationale**: `InfoCard` is the most reused surface in crust (activities, articles, events, prompts, quest, profile, home all render through it). Content-aware affordances mean the card "knows" what it is and gives the right hint — a play icon when there's a video, a pulse when something deserves attention, a shake when something errored. Cost is small per-card; payoff is on every list page.

### 4.3 `InfoCardGroup` `special` glow

**File**: `/Users/gamer/gmitch215/earth-app/crust/src/components/InfoCardGroup.vue`

Wrapped the card body in a host `div` and added a CSS-only conic-gradient pseudo-ring (`.gradient-border-ring`) that rotates over 12s when `special` is true. No JS, no extra deps. Stripped entirely under reduced motion.

**Rationale**: the `special` prop existed but the styling was identical to the non-special variant in practice. This makes "Recommended for You" rails actually feel featured.

### 4.4 Activities listing fade-in stagger

**File**: `/Users/gamer/gmitch215/earth-app/crust/src/pages/activities/index.vue`

Added `motion-preset-fade-md` + per-card delay style (capped at the 8th card to avoid >400ms wait on long lists) to recommended and all-activities loops. Brings parity with articles / events / prompts pages.

### 4.5 `MicroQuiz` activity widget

**Files**:

- `/Users/gamer/gmitch215/earth-app/crust/src/components/activity/widgets/MicroQuiz.vue`
- `/Users/gamer/gmitch215/earth-app/sky/src/components/activity/widgets/MMicroQuiz.vue`

Single-card 1-question widget (default 3-question pool, prop-overridable). Tap an answer → instant feedback color (success/error) + brief explanation. Correct → triggers `UiSparkleBurst`. "Next" cycles forward and emits `complete` on wrap. Sky variant uses Ionic `IonButton`/`IonCard` and calls `selection` / `notifySuccess` / `notifyWarning` from `useAppHaptics`.

**Auto-import**: `<ActivityWidgetsMicroQuiz>` in crust. Sky requires explicit import (no nested auto-import setup for `widgets/`).

**Rationale**: a low-bar engagement loop that fits inside any activity scroll. Designed to be the simplest of many widget types — proves the "widget folder" pattern without committing to a full quiz system.

## 5. What Was Designed But Not Shipped

### 5.1 Streak counter in profile header

Wire `UiCountUp` into the profile / dashboard header to animate the user's day-streak count on every navigation. Pair with a tiny flame icon. When the streak just incremented, fire `UiSparkleBurst` on the counter.

_Persona benefit_: 1, 2, 5, 6 — visible momentum is the cheapest retention lever for low-attention users; older users like the legible large number. _Complexity_: low-medium — needs a `streak` field on the user store (mantle2 dep, currently absent).

### 5.2 Tap-to-react on prompt cards

A `react` button (heart / spark / brain) on each prompt card. Tap → optimistic count increment via `UiCountUp`, `UiSparkleBurst` over the button, haptic on sky. Backend is a single POST to a new `/v2/prompts/:id/reactions` endpoint (mantle2 + cloud).

_Persona benefit_: 1, 2, 6 — gives the lurk-only segment a lightweight engagement primitive that doesn't require writing a response. _Complexity_: medium — touches backend, needs rate-limiting and dedupe.

### 5.3 First-session scroll cue

A subtle downward chevron with `motion-preset-bounce` that appears below the home hero on a user's first 2 visits, dismissed on first scroll. Stored in `localStorage`.

_Persona benefit_: 1, 2, 5 — older users miss that the page scrolls; tween/teen needs a clear "what now?" affordance. _Complexity_: low. Skipped only because home-page changes are gated by other agents this sprint.

### 5.4 Hero stat bar on home

Three big counters at the top of `/`: total impact points across the platform, total active quests, articles published this week. Each animated in with `UiCountUp` and a faint `AnimatedGradientBorder` on the impact tile.

_Persona benefit_: 3, 4, 5 — adults and older invitees want to feel the platform has scale + life. _Complexity_: medium — needs a public stats endpoint with caching (cloud KV is the right place).

### 5.5 Daily challenge chip in NavBar

A persistent NavBar chip ("Today's Challenge") wrapped in `UiPulseRing` until tapped that day. Routes to a randomized activity quest pulled from the user's interest set.

_Persona benefit_: 1, 2, 4, 6 — restores the "what should I do today" prompt that lower-attention users need. _Complexity_: medium — the daily-challenge selection logic is the work, the UI is a one-line `UiPulseRing` wrap.

### 5.6 Article card image Ken-Burns hover

Slow zoom-and-pan on the thumbnail when hovered for >400ms. Pure CSS, gated on hover + reduced-motion.

_Persona benefit_: 3, 4 — premium-feeling polish for the readers. _Complexity_: low. Skipped to avoid touching three component files for marginal payoff.

### 5.7 Quest step success micro-confetti

Replace the silent state-flip on a quest step completion with a `UiSparkleBurst` over the step tile and a haptic ping on sky. Distinct from the full-quest `CompletionOverlay` — small reward for small wins.

_Persona benefit_: 1, 2, 4, 6 — the hyperactive tween and bored teen need a payoff every step, not just the finale. _Complexity_: low-medium — needs a per-tile trigger ref in `Timeline.vue`.

### 5.8 New-badge floating ribbon

When the user opens any page within 60s of unlocking a new badge, slide a small ribbon ("New Badge: Curious Mind") down from the top with `motion-preset-slide-down`, sparkle burst, auto-dismiss in 4s, click to view.

_Persona benefit_: all six (badges are universal). _Complexity_: medium — needs an "unlocked since last seen" flag from mantle2, plus a global toast-but-richer surface. Worth doing but blocked on a backend signal.

## 6. Persona Reaction Predictions

**Numbers are estimates.** Baseline metrics taken from intuition + recent perf audits, not measured.

1. **Bored teenager** — the image parallax and play-overlay pulse give every scroll a sense of life. Expect first-visit bounce rate to drop noticeably as the page never feels static. _Est. scroll depth +18%, session length +12%, return rate +4% week 1._
2. **Hyperactive tween** — `MicroQuiz` is the headline win here; the sparkle burst on correct answers is exactly the dopamine loop this segment is wired for. The `special` rail glow draws them straight to "Recommended for You". _Est. avg taps per session +35%, session length +22%, return rate +6% week 1._
3. **Curious adult** — the parallax + gradient border read as polish, not noise. Won't change behavior dramatically; will mention the app feels "smoother" if asked. _Est. completion rate on read-throughs +6%, NPS +3 points._
4. **Bored adult** — the play-icon-on-hover and pop-on-success-banner give them feedback they currently lack on the listing pages. _Est. CTR on featured rail +15%, session length +9%._
5. **Older generation** — the most at-risk persona. Reduced-motion respect means they see a calmer, mostly-static version. The hover scale and play overlay are subtle enough not to alarm. **Validate by user-testing with motion turned both on and off.** _Est. unchanged unless they have motion enabled — then watch for "too busy" feedback._
6. **Excited teenager invited by friend** — the gradient border on `Recommended for You` + the `MicroQuiz` pickup is the strongest combo here. They're already primed to engage; the small wins compound. _Est. completion of first quest +20%, day-2 return +10%._

## 7. Anti-patterns to Avoid

- **Don't stack motion on motion.** A pulsing play icon inside a shaking card inside a fading-in column is sensory overload. Pick one motion per element.
- **Don't run canvas-based effects on mount.** Tie them to user actions (tap, hover, scroll) or visibility — `SparkleBurst` only mounts a canvas when triggered, not on every page load.
- **Don't tie animations to required side effects.** Reduced motion must produce the same final state, just instantly. `CountUp` snaps to value, `SparkleBurst` no-ops.
- **Don't auto-import the `widgets/` subfolder without confirming.** Nuxt's three-level prefix can produce ugly names (`ActivityWidgetsMicroQuiz`). Use direct imports for less-frequent components.
- **Don't bake user-specific state into ISR-cached pages.** The new motion primitives are SSR-safe (no `window` outside `onMounted`), but anything that pulls user data must stay client-side per the codebase contract.
- **Don't ship parallax with `position: fixed`.** Always use `transform: translate3d` so the GPU compositor handles it — never trigger layout.

## 8. Follow-up Roadmap

**Phase A (this sprint)** — shipped above. Validate via real-device QA on iPhone SE, Android mid-tier, low-end Chromebook. Confirm `prefers-reduced-motion` produces zero new animations.

**Phase B (next sprint)** —

1. Streak counter on profile / dashboard (needs mantle2 `user.streak`).
2. Tap-to-react on prompt cards (needs mantle2 endpoint).
3. Quest step micro-confetti (frontend-only, can ship immediately after sprint A is validated).

**Phase C (later)** —

1. Hero stat bar on home (needs cloud public stats endpoint).
2. Daily challenge NavBar chip (needs daily-pick selection logic).
3. New-badge floating ribbon (needs "unlocked since last seen" flag).
4. Build a `widgets/` library beyond `MicroQuiz`: `MicroPoll`, `WordOfTheDay`, `ImpactTracker`. Each ~100 LOC, all reusing the same primitives.

**Phase D (instrumentation)** — wire the existing analytics rails to track: time-to-first-interaction on listing pages, sparkle-trigger counts per session, MicroQuiz completion rates. Without this we're guessing.

---

_Word count: ~2,400. Estimates are educated guesses, not measurements — instrument before celebrating._
