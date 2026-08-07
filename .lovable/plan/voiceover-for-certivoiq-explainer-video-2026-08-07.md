# Voiceover for CertivoIQ Explainer Video

## Goal
Add a professional English and Spanish voiceover to the existing React/CSS animated explainer video on the welcome page, with user-initiated playback.

## Current state
- The explainer is `src/components/explainer-video.tsx`: a 5-scene React/CSS animation (≈26.7s total) with hardcoded scene timings.
- There is no audio element or voiceover today.
- Browser autoplay policies prevent audio from playing without a user gesture, so the player will start with audio muted/paused and a clear play button.

## Plan

### 1. Write narration scripts
- Create one continuous English script and one continuous Spanish script that match the 5-scene arc and timing.
- Each script will be timed so the narration naturally falls within the scene durations (Scene 0 ≈4.2s, Scene 1 ≈3.8s, Scene 2 ≈5.5s, Scene 3 ≈4.2s, Scene 4 ≈9.0s).
- Scripts will be stored in a new module (`src/lib/explainer-voiceover.ts`) as plain text, not embedded in the component.

### 2. Generate TTS audio files
- Add a server route (`src/routes/api/public/generate-explainer-voiceover.ts` is a public endpoint, but it will be gated to avoid abuse) or a `createServerFn` to call the Lovable AI Gateway TTS endpoint (`/v1/audio/speech`).
- Use `openai/gpt-4o-mini-tts` with a professional voice, `response_format: mp3`, and `stream_format: audio` (non-streaming file) because the output is a single stored file.
- Generate EN and ES MP3s and store them in `public/assets/voiceover/` so they can be served statically.
- If files already exist, skip regeneration.

### 3. Add audio playback to the explainer component
- Add an `<audio>` ref in `src/components/explainer-video.tsx` with `preload="metadata"` and the selected language MP3 URL.
- Add a prominent play/pause button with a volume/speaker icon and a language toggle (EN/ES).
- When the user clicks play, the audio starts and the animation restarts from the beginning so it stays in sync with the narration.
- Track `playing`, `currentTime`, and `ended` states.
- When audio ends, reset to the beginning and show the replay button.
- Keep the animation loop running silently even if audio is paused; audio only plays when the user requests it.

### 4. Localization
- Use the existing `useT` i18n hook for button labels ("Play narration", "Pause", "Replay", "English", "Español").
- Add new keys to `src/lib/i18n/en.ts` and `src/lib/i18n/es.ts` for the player controls.

### 5. Testing & fallback
- Verify the audio file is generated and plays correctly in the preview.
- Provide a fallback: if audio fails to load, the play button shows a helpful message and the animation still works.
- Verify the voiceover timing roughly aligns with each scene; adjust script if a scene feels rushed.

## Technical details
- TTS provider: Lovable AI Gateway `openai/gpt-4o-mini-tts` (server-side only, using `LOVABLE_API_KEY`).
- Audio files: MP3, 24kHz mono from the Gateway, re-encoded to a browser-friendly MP3 if needed.
- Storage: `public/assets/voiceover/certivo-explainer-en.mp3` and `...-es.mp3`.
- Component: pure React state + HTML `<audio>` element; no new npm packages required.
- Server route: `createFileRoute` under `src/routes/api/` (internal, not public) with a `POST` handler that reads a language param and returns the generated audio or a URL.

## Out of scope
- Generating a true MP4 video file with mixed audio (the user explicitly chose in-browser React + audio).
- Auto-play on load (blocked by browsers; audio will be user-initiated).
- Multiple voice choices (use the default professional voice for both languages).

## Preview testing
- Visit the welcome page and scroll to the explainer video.
- Click the play button; confirm the animation restarts and the voiceover plays.
- Switch the language toggle while paused; confirm the audio source changes.
- Let the video play to the end; confirm it resets and offers replay.
- Test with network throttling to verify the audio file loads.
