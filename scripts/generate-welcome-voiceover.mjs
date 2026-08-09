import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

if (!apiKey) {
  throw new Error(
    "ELEVENLABS_API_KEY is required. Store it as a secret; never commit it.",
  );
}
if (!voiceId) {
  throw new Error(
    "ELEVENLABS_VOICE_ID is required. Copy it from ElevenLabs My Voices.",
  );
}

const scenes = [
  {
    file: "scene-01-upload.mp3",
    text: "Every audit-ready decision begins with the file. Upload the household's certification packet into one secure Certivo I Q workspace.",
  },
  {
    file: "scene-02-extract.mp3",
    text: "Certivo I Q extracts income, assets, signatures, verification dates, and source pages—turning every document into traceable evidence.",
  },
  {
    file: "scene-03-rules.mp3",
    text: "The platform evaluates L I H T C, HOME, Section Eight, HOTMA, and the property's assigned state rule pack together, using versioned rules.",
  },
  {
    file: "scene-04-findings.mp3",
    text: "Each result shows what passed, what failed, the governing citation, and the exact correction path—so the decision is never a black box.",
  },
  {
    file: "scene-05-approval.mp3",
    text: "Certivo I Q prepares the review, while an authorized compliance professional keeps final approval authority and a complete record of every action.",
  },
  {
    file: "scene-06-portfolio.mp3",
    text: "Every completed review updates portfolio readiness, giving leaders a clear view of findings, corrections, upcoming risk, and the properties that need attention now.",
  },
];

const outputDirectory = resolve("public/audio/welcome");
await mkdir(outputDirectory, { recursive: true });

for (let index = 0; index < scenes.length; index += 1) {
  const scene = scenes[index];
  const previousText = scenes[index - 1]?.text;
  const nextText = scenes[index + 1]?.text;
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: scene.text,
      model_id: modelId,
      language_code: "en",
      apply_text_normalization: "on",
      seed: 2048,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
        speed: 0.94,
      },
      ...(previousText ? { previous_text: previousText } : {}),
      ...(nextText ? { next_text: nextText } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `ElevenLabs failed for ${scene.file}: ${response.status} ${detail}`,
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  await writeFile(resolve(outputDirectory, scene.file), audio);
  process.stdout.write(
    `Generated ${scene.file} (${audio.length.toLocaleString()} bytes)\n`,
  );
}

process.stdout.write(`Welcome narration generated with model ${modelId}.\n`);
