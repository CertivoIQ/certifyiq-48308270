# Fix voiceover-to-slide alignment in CertivoIQ animated explainer

## Problem
The animated explainer on `/welcome` cycles through 5 scenes using a fixed total duration of 26.7s. The generated English voiceover is 21.3s and the Spanish voiceover is 25.2s. As a result, the narration ends before the slides and the per-scene pacing is off, making the voiceover feel faster than the visuals.

## Goal
Keep the generated voiceover as-is (the chosen narration pace) and make the animated scenes change exactly when each narration segment ends, so the audio and visuals stay synchronized for both English and Spanish.

## Approach
1. Measure the actual duration of each generated voiceover track (already done via ffprobe).
2. Record empirical per-scene word counts in the voiceover module, then compute a per-scene duration based on the proportion of words in each scene.
3. Replace the hardcoded `SCENES` and `TOTAL` constants in `src/components/explainer-video.tsx` with dynamic values derived from the selected voiceover language.
4. The animation loop will use these dynamic durations, so scene transitions line up with the spoken sentences.

## Files to edit
- `src/lib/explainer-voiceover.ts`: add `VOICEOVER_SCENE_WORDS`, `VOICEOVER_DURATION_MS`, and `getSceneDurations(lang)`.
- `src/components/explainer-video.tsx`: compute `SCENES` and `TOTAL` from `voiceLang` using the new helper; keep the same animation loop logic.

## Verification
- Build the project (`bun run build:dev`).
- Open `/welcome` in the preview.
- Click Play narration.
- Confirm each visual scene transitions as the narrator finishes its sentence, and both audio and animation end at the same time.
- Switch to Spanish and repeat the check.

## Estimated scope
Small, focused change to the explainer component. No backend, billing, auth, or other areas affected.
