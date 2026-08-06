# Merlin: flying idle reminder + magic tricks

Give the floating wizard helper two personalities depending on what the user is doing.

## Behavior

Merlin's panel (bottom-right helper) tracks activity:

1. **Open and busy** (user just opened him, clicked "Another spell", moved the mouse or typed within the panel in the last 12 seconds) — Merlin performs a short rotating series of magic tricks in place: a wand flourish with sparkle burst, a hat tip, a puff-of-smoke pose swap, and a card/rabbit style pop. Each trick runs about 2 seconds, then the next begins, cycling as long as he stays open and engaged.

2. **Open and idle** (no interaction for 12+ seconds) — Merlin takes flight: he lifts off his pedestal and drifts in a slow looping path across the lower-right area with a trailing sparkle wake, and a small nudge appears: "Still here! Tap the X when you're done with me." Any click, keypress or mouse move over the helper lands him back and returns to trick mode.

3. **Closed** — unchanged: the small round button with a gentle bob.

## Tricks (visual only, no new dependencies)

- Wand flourish: quick rotate + sparkle arc.
- Hat tip: slight tilt with a sparkle popping out of the hat.
- Poof swap: fade-out through a smoke puff and fade back in on a different pose (greeting → pointing → thinking → celebrating).
- Levitating orb: a glowing dot circles his hand.

All built from CSS keyframes and the existing four Merlin pose images. Motion respects `prefers-reduced-motion`: reduced-motion users get static poses and the text nudge, no flight or spinning.

## Technical notes

- `src/styles.css`: add keyframes `merlin-fly` (looping drift path), `merlin-wand`, `merlin-tip`, `merlin-poof`, `merlin-orb`, and a `@media (prefers-reduced-motion: reduce)` block disabling them.
- `src/components/merlin.tsx`: in `WizardHelper`, add `lastActive` timestamp state, a 1s interval to derive `idle`, and a trick index that advances on a 2s interval while open and not idle. Reset activity on panel click / pointer move / key press. When idle, render Merlin inside a positioned flight layer (`pointer-events-none` except for his own hit area) plus the reminder bubble.
- Keep the existing `Merlin`, `MerlinSays` and `MerlinCelebration` exports unchanged; only the helper gains behavior.

## Still outstanding from the previous turn (unchanged)

- Academy catalog for the 20 new certification tracks with exams and certificates.
- `properties/new` AI onboarding & migration wizard hosted by Merlin.
- Self-serve Enterprise checkout / billing page, then full backend and deploy.
