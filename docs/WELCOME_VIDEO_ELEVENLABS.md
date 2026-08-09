# CertivoIQ welcome animation: ElevenLabs narration

The welcome animation uses six prerecorded MP3 clips. It intentionally does **not** use browser `speechSynthesis`; browser voices vary by device and caused the robotic narration.

## Recommended voice direction

Create or select an English (American), female, professional narration voice with this direction:

> A confident professional American woman in her late thirties to mid-forties. Warm, articulate, intelligent, and reassuring. Neutral American accent, medium pitch, conversational pace, subtle authority, and natural pauses. Enterprise technology presenter—not breathy, theatrical, overly cheerful, or sales-driven.

Recommended Voice Library filters:

- Language: English
- Accent: American
- Gender: Female
- Age: Middle Aged
- Category: Narration or Educational

Prefer a Voice Design voice or a library voice with a long notice period. ElevenLabs is replacing legacy default voices, so do not hard-code an old default voice without testing its replacement.

## Obtain the voice ID

1. Add the selected voice to **My Voices**.
2. Open its three-dot menu.
3. Select **Copy voice ID**.
4. Store the ID as `ELEVENLABS_VOICE_ID`.

Official instructions: https://elevenlabs.io/docs/help-center/technical/how-do-i-find-the-voice-id-of-my-voices-via-the-website-and-api

## Generate the six tracks

Store both values as environment secrets. Never paste or commit the API key.

```bash
export ELEVENLABS_API_KEY="set-this-securely"
export ELEVENLABS_VOICE_ID="copied-voice-id"
npm run generate:welcome-voiceover
```

Optional model override:

```bash
export ELEVENLABS_MODEL_ID="eleven_v3"
```

The generator calls the official Text-to-Speech endpoint and writes:

- `public/audio/welcome/scene-01-upload.mp3`
- `public/audio/welcome/scene-02-extract.mp3`
- `public/audio/welcome/scene-03-rules.mp3`
- `public/audio/welcome/scene-04-findings.mp3`
- `public/audio/welcome/scene-05-approval.mp3`
- `public/audio/welcome/scene-06-portfolio.mp3`

API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert

## Quality gate before deployment

- Confirm “CertivoIQ” sounds like “Certivo I-Q.”
- Confirm LIHTC, HOME, HOTMA, and Section 8 are pronounced correctly.
- Listen for clipped first or last words.
- Keep the delivery calm and conversational.
- Confirm all six tracks use the same voice and model.
- Verify play, pause, restart, mute, scene selection, captions, and reduced-motion behavior.
- Do not deploy the component until all six files exist; missing files intentionally show a narration-unavailable notice instead of falling back to a robotic browser voice.
